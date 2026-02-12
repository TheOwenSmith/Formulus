import { docker } from '@worker/lib/docker';
import { cleanup } from '@worker/utils/cleanup';
import {
  badRequest,
  fromThrowable,
  fromThrowableAsync,
  internal,
  type AppError,
} from '@worker/utils/error-handling';
import { randomUUID } from 'crypto';
import type { Container } from 'dockerode';
import fs from 'fs';
import { err, ok, Result } from 'neverthrow';
import os from 'os';
import path from 'path';
import { PassThrough } from 'stream';
import z, { ZodType } from 'zod';
import {
  EXTENSION_BY_LANGUAGE,
  IMAGE_BY_LANGUAGE,
  RUNNER_CODE_FROM_LANGUAGE_AND_CODE_FILENAMES,
  START_COMMAND_BY_LANGUAGE,
  UTILS_CODE_FROM_LANGUAGE,
  UTILS_HEADER_FROM_LANGUAGE,
  type SupportedLanguage,
} from './languages';
import { wrapCppUserCode } from './languages/cpp';

const resultSchema = z.discriminatedUnion('ok', [
  z.object({
    ok: z.literal(true),
    result: z.unknown(),
  }),
  z.object({
    ok: z.literal(false),
    error: z.unknown(),
  }),
]);

const MAX_OUT_BYTES = 1 * 1024 * 1024; // 1MB
const COMPILING_TIMEOUT_MS = 40_000;
const RPC_TIMEOUT_MS = 3_000;

export type RpcFunction<In extends unknown[], Out> = ((
  ...args: In
) => Promise<Result<Out, AppError>>) & {
  end: () => Promise<Result<undefined, AppError>>;
};

export async function createRpcFunction<In extends unknown[], Out>({
  files,
  image,
  startCommand,
  userCodePostValidation,
  userResponseSchema,
}: {
  files: Record<string, string>;
  image: string;
  startCommand: string[];
  userCodePostValidation?: (args: In, result: Out) => Result<undefined, AppError>;
  userResponseSchema: ZodType<Out>;
}): Promise<Result<RpcFunction<In, Out>, AppError>> {
  // Validate filenames
  for (const filename in files) {
    if (!/^[a-zA-Z0-9-_()]+\.[a-z]+$/.test(filename)) {
      return err(badRequest(`Invalid filename '${filename}'`));
    }
  }

  // Initialize variables
  const jobId = randomUUID();
  const hostJobDir = path.join(os.tmpdir(), 'runner-jobs', jobId);
  const hostJobDirAbs = path.resolve(hostJobDir);

  const stdout = new PassThrough();
  const stderr = new PassThrough();

  let inflight: {
    args: In;
    resolve: (value: Out) => void;
    reject: (err: AppError) => void;
  } | null = null;
  let compilation: {
    resolve: () => void;
    reject: (err: AppError) => void;
  } | null = null;
  let ended = false;

  let container: Container | null = null;
  let stream: NodeJS.ReadWriteStream | null = null;

  // Cleanup function
  async function end(error: AppError): Promise<Result<undefined, AppError>> {
    if (ended) return ok(undefined);
    ended = true;

    console.log('Cleaning up...');
    const cleanupResult = await cleanup([
      () => stdout.removeAllListeners(),
      () => stderr.removeAllListeners(),
      () => stdout.destroy(),
      () => stderr.destroy(),
      () => stream?.end(),
      () => fs.rmSync(hostJobDirAbs, { recursive: true, force: true }),
      async () => {
        console.log('Killing container...');
        await container?.kill();
        console.log('Container killed');
        return;
      },
      () => fs.rmSync(hostJobDirAbs, { recursive: true, force: true }),
      () => {
        if (inflight != null) {
          inflight.reject(error);
          inflight = null;
        }
      },
      () => {
        if (compilation != null) {
          compilation.reject(error);
          compilation = null;
        }
      },
    ]);
    if (cleanupResult.isErr()) return err(internal(cleanupResult.error));
    return ok(undefined);
  }

  // Write code files to temp directory
  const createHostJobDirResponse = fromThrowable(
    () => fs.mkdirSync(hostJobDir, { recursive: true }),
    (e) => internal(e),
  );
  if (createHostJobDirResponse.isErr()) return err(createHostJobDirResponse.error);

  for (const filename in files) {
    const writeFileResponse = fromThrowable(
      () =>
        fs.writeFileSync(path.join(hostJobDir, filename), files[filename], { encoding: 'utf8' }),
      (e) => internal(e),
    );
    if (writeFileResponse.isErr()) {
      await end(writeFileResponse.error);
      return err(writeFileResponse.error);
    }
  }

  // Create docker container
  const createContainerResponse = await fromThrowableAsync(
    () =>
      docker.createContainer({
        Cmd: startCommand,
        HostConfig: {
          AutoRemove: true,
          Binds: [`${hostJobDirAbs}:/sandbox:ro`],
          CpuQuota: 50_000,
          Memory: 256 * 1024 * 1024, // 256MB
          NetworkMode: 'none',
          PidsLimit: 64,
          ReadonlyRootfs: false,
        },
        Image: image,
        OpenStdin: true,
        StdinOnce: false,
        Tty: false,
        WorkingDir: '/app',
      }),
    (e) => internal(e),
  );
  if (createContainerResponse.isErr()) return err(createContainerResponse.error);
  container = createContainerResponse.value;

  const startContainerResponse = await fromThrowableAsync(
    () => container.start(),
    (e) => internal(e),
  );
  if (startContainerResponse.isErr()) {
    await end(startContainerResponse.error);
    return err(startContainerResponse.error);
  }
  console.log('Container started');

  // Create stream
  const createStreamResponse = await fromThrowableAsync(
    () =>
      container.attach({
        hijack: true,
        stderr: true,
        stdin: true,
        stdout: true,
        stream: true,
      }),
    (e) => internal(e),
  );
  if (createStreamResponse.isErr()) {
    await end(createStreamResponse.error);
    return err(createStreamResponse.error);
  }
  stream = createStreamResponse.value;

  stdout.on('data', async (data: Buffer) => {
    if (data.length > MAX_OUT_BYTES) {
      await end({
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Output exceeded stream limit of 1MB',
      });
      return;
    }

    if (compilation != null) {
      if (data.toString('utf-8') !== 'compiled\n') {
        await end(badRequest('Compilation failed', data.toString('utf-8')));
        return;
      }
      compilation.resolve();
      compilation = null;
      return;
    }

    const jsonParseResponse = fromThrowable(
      () => JSON.parse(data.toString('utf-8')),
      (e) => badRequest('Failed to parse JSON', e),
    );
    if (jsonParseResponse.isErr()) {
      await end(jsonParseResponse.error);
      return;
    }
    const parsedJson = jsonParseResponse.value;

    // Should follow { ok: true, result: Out } | { ok: false, error: Error } structure
    const zodResultSchemaParseResponse = fromThrowable(
      () => resultSchema.parse(parsedJson),
      (e) => badRequest('Failed to parse result', e),
    );
    if (zodResultSchemaParseResponse.isErr()) {
      await end(zodResultSchemaParseResponse.error);
      return;
    }
    const rpcOutput = zodResultSchemaParseResponse.value;

    if (!rpcOutput.ok) {
      await end(badRequest('Invalid result', rpcOutput.error));
      return;
    }

    // Should follow Out structure
    const zodUserResponseSchemaResponse = fromThrowable(
      () => userResponseSchema.parse(rpcOutput.result),
      (e) => badRequest('Invalid user response', e),
    );
    if (zodUserResponseSchemaResponse.isErr()) {
      await end(zodUserResponseSchemaResponse.error);
      return;
    }
    const userCodeResult = zodUserResponseSchemaResponse.value;

    // Post-validatiom
    if (userCodePostValidation != null && inflight != null) {
      const postValidationResponse = userCodePostValidation(inflight.args, userCodeResult);
      if (postValidationResponse.isErr()) {
        await end(postValidationResponse.error);
        return;
      }
    }

    inflight?.resolve(userCodeResult);
    inflight = null;
  });

  stderr.on('data', async (data: Buffer) => {
    if (data.length > MAX_OUT_BYTES) {
      await end({
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Output exceeded stream limit of 1MB',
      });
      return;
    }

    await end(badRequest('Code execution error', data.toString('utf-8')));
  });

  // Demux Docker's multiplexed stream into stdout/stderr
  const demuxStreamResponse = await fromThrowable(
    () => docker.modem.demuxStream(stream, stdout, stderr),
    (e) => internal(e),
  );
  if (demuxStreamResponse.isErr()) {
    await end(demuxStreamResponse.error);
    return err(demuxStreamResponse.error);
  }

  const compilationResponse = await new Promise<Result<undefined, AppError>>((resolve) => {
    const timer = setTimeout(
      () => resolve(err(badRequest('Compilation timed out'))),
      COMPILING_TIMEOUT_MS,
    );
    compilation = {
      resolve: () => {
        clearTimeout(timer);
        resolve(ok(undefined));
      },
      reject: (e: AppError) => {
        clearTimeout(timer);
        resolve(err(e));
      },
    };
  });
  if (compilationResponse.isErr()) {
    await end(compilationResponse.error);
    return err(compilationResponse.error);
  }
  console.log('Code compiled');

  function call(...args: In): Promise<Result<Out, AppError>> {
    const p = new Promise<Result<Out, AppError>>((resolve) => {
      const timer = setTimeout(() => {
        void end(badRequest('User code timed out'));
      }, RPC_TIMEOUT_MS);
      inflight = {
        args,
        resolve: (result: Out) => {
          clearTimeout(timer);
          resolve(ok(result));
        },
        reject: (e: AppError) => {
          clearTimeout(timer);
          resolve(err(e));
        },
      };
    });

    stream!.write(JSON.stringify({ args }) + '\n');
    return p;
  }

  // Return RPC function
  call.end = () => end(internal(undefined, 'Runner force quit early'));
  return ok(call);
}

export async function createBatchRpcFunctionFromUserCode<
  In extends Record<number, unknown[]>,
  Out extends Record<number, unknown>,
>({
  userCodeByFilename,
  userResponseSchemas,
  language,
}: {
  userCodeByFilename: Record<string, string>;
  userResponseSchemas: Record<number, ZodType<Out[number]>>;
  language: SupportedLanguage;
}): Promise<Result<RpcFunction<[In], Out>, AppError>> {
  const userResponseSchema = z.record(z.coerce.number(), z.unknown()).superRefine((data, ctx) => {
    for (const index in data) {
      if (!(index in userResponseSchemas)) {
        ctx.addIssue({
          code: 'custom',
          input: data,
          message: `Received unexpected data for index '${index}'`,
        });
      }

      const zodParseIndexResponse = userResponseSchemas[index].safeParse(data[index]);
      if (!zodParseIndexResponse.success) {
        for (const issue of zodParseIndexResponse.error.issues) {
          ctx.addIssue({
            code: 'custom',
            message: issue.message,
            path: ['result', ...issue.path],
          });
        }
      }
    }
  });

  function userCodePostValidiation(args: [In], userCodeResult: Out): Result<undefined, AppError> {
    for (const index in args[0]) {
      if (!(index in userCodeResult)) {
        return err(badRequest(`Expected data from index '${index}' but received none`));
      }
    }
    for (const index in userCodeResult) {
      if (!(index in args[0])) {
        return err(badRequest(`Recieved unexpected data from index '${index}'`));
      }
    }
    return ok(undefined);
  }

  const extension = EXTENSION_BY_LANGUAGE[language];
  const runnerCode = RUNNER_CODE_FROM_LANGUAGE_AND_CODE_FILENAMES(
    language,
    Object.keys(userCodeByFilename),
    language === 'cpp' ? userCodeByFilename : undefined,
  );

  const files: Record<string, string> = {
    [`runner.${extension}`]: runnerCode,
    [`utils.${extension}`]: UTILS_CODE_FROM_LANGUAGE[language],
  };

  // Add header file for C++ and wrap user code
  if (language === 'cpp' && UTILS_HEADER_FROM_LANGUAGE.cpp) {
    files['utils.hpp'] = UTILS_HEADER_FROM_LANGUAGE.cpp;
    for (const [filename, code] of Object.entries(userCodeByFilename)) {
      files[filename] = wrapCppUserCode(filename, code);
    }
  } else {
    // For other languages, use files as-is
    Object.assign(files, userCodeByFilename);
  }

  return createRpcFunction<[In], Out>({
    files,
    image: IMAGE_BY_LANGUAGE[language],
    startCommand: START_COMMAND_BY_LANGUAGE[language],
    userCodePostValidation: userCodePostValidiation,
    // @ts-expect-error - userResponseSchema is incorrectly typed as ZodType<[]>
    userResponseSchema: userResponseSchema,
  });
}
