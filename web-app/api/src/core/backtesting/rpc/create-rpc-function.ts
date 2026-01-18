import { docker } from '@api/lib/docker';
import { cleanup } from '@api/utils/cleanup';
import { ErrorWithCode, tryAsync, trySync } from '@api/utils/error-handling';
import { randomUUID } from 'crypto';
import fs from 'fs';
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

export type RpcFunction<In extends unknown[], Out> = ((...args: In) => Promise<Out>) & {
  end: () => Promise<void>;
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
  userCodePostValidation?: (args: In, result: Out) => void;
  userResponseSchema: ZodType<Out>;
}): Promise<RpcFunction<In, Out>> {
  // Write code files to temp directory
  const jobId = randomUUID();
  const hostJobDir = path.join(os.tmpdir(), 'runner-jobs', jobId);
  fs.mkdirSync(hostJobDir, { recursive: true });

  for (const filename in files) {
    if (!/^[a-zA-Z0-9-_()]+\.[a-z]+$/.test(filename)) {
      throw new ErrorWithCode(`Invalid filename '${filename}'`, 'BAD_REQUEST');
    }
    fs.writeFileSync(path.join(hostJobDir, filename), files[filename], { encoding: 'utf8' });
  }

  const hostJobDirAbs = path.resolve(hostJobDir);

  // Create docker container
  const createContainerResponse = await tryAsync(() =>
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
  );
  if (!createContainerResponse.ok) throw createContainerResponse.error;
  const container = createContainerResponse.data;

  const stdout = new PassThrough();
  const stderr = new PassThrough();

  let inflight: {
    args: In;
    resolve: (value: Out) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  } | null = null;
  let compilation: {
    resolve: (message: string) => void;
    reject: (err: Error) => void;
    timer: NodeJS.Timeout;
  } | null = null;
  let ended = false;

  // Cleanup function
  async function end(error: Error): Promise<void> {
    if (ended) return;
    ended = true;

    console.log('Cleaning up...');
    await cleanup([
      () => stdout.removeAllListeners(),
      () => stderr.removeAllListeners(),
      () => stdout.destroy(),
      () => stderr.destroy(),
      () => stream.end(),
      () => fs.rmSync(hostJobDirAbs, { recursive: true, force: true }),
      async () => {
        console.log('Killing container...');
        await container.kill();
        console.log('Container killed');
        return;
      },
      () => fs.rmSync(hostJobDirAbs, { recursive: true, force: true }),
      () => {
        if (inflight != null) {
          console.log('Clearing inflight');
          clearTimeout(inflight.timer);
          inflight.reject(error);
          inflight = null;
        }
      },
      () => {
        if (compilation != null) {
          compilation.reject(error);
          clearTimeout(compilation.timer);
          compilation = null;
        }
      },
    ]);
  }

  const startContainerResponse = await tryAsync(() => container.start());
  if (!startContainerResponse.ok) {
    await end(new ErrorWithCode(startContainerResponse.error, 'INTERNAL_SERVER_ERROR'));
    throw startContainerResponse.error;
  }
  console.log('Container started');

  const createStreamResponse = await tryAsync(
    () =>
      container.attach({
        hijack: true,
        stderr: true,
        stdin: true,
        stdout: true,
        stream: true,
      }) as unknown as Promise<NodeJS.ReadWriteStream>,
  );
  if (!createStreamResponse.ok) {
    await end(new ErrorWithCode(createStreamResponse.error, 'INTERNAL_SERVER_ERROR'));
    throw createStreamResponse.error;
  }
  const stream = createStreamResponse.data;

  stdout.on('data', async (data: Buffer) => {
    if (data.length > MAX_OUT_BYTES) {
      await end(new ErrorWithCode('Output exceeded stream limit of 1MB', 'PAYLOAD_TOO_LARGE'));
      return;
    }

    if (compilation != null) {
      if (data.toString('utf-8') !== 'compiled\n') {
        await end(new ErrorWithCode(data.toString('utf-8'), 'BAD_REQUEST'));
        return;
      }
      compilation.resolve('');
      compilation = null;
      return;
    }

    const jsonParseResponse = trySync(() => JSON.parse(data.toString('utf-8')));
    if (!jsonParseResponse.ok) {
      await end(new ErrorWithCode(jsonParseResponse.error, 'BAD_REQUEST'));
      return;
    }
    const parsedJson = jsonParseResponse.data;

    // Should follow { ok: true, result: Out } | { ok: false, error: Error } structure
    const zodResultSchemaParseResponse = trySync(() => resultSchema.parse(parsedJson));
    if (!zodResultSchemaParseResponse.ok) {
      await end(new ErrorWithCode(zodResultSchemaParseResponse.error, 'BAD_REQUEST'));
      return;
    }
    const rpcOutput = zodResultSchemaParseResponse.data;

    if (!rpcOutput.ok) {
      await end(new ErrorWithCode(rpcOutput.error, 'BAD_REQUEST'));
      return;
    }

    // Should follow Out structure
    const zodUserResponseSchemaResponse = trySync(() => userResponseSchema.parse(rpcOutput.result));
    if (!zodUserResponseSchemaResponse.ok) {
      await end(new ErrorWithCode(zodUserResponseSchemaResponse.error, 'BAD_REQUEST'));
      return;
    }
    const userCodeResult = zodUserResponseSchemaResponse.data;

    // Post-validatiom
    if (userCodePostValidation != null && inflight != null) {
      const postValidationResponse = trySync(() =>
        userCodePostValidation(inflight!.args, userCodeResult),
      );
      if (!postValidationResponse.ok) {
        await end(new ErrorWithCode(postValidationResponse.error, 'BAD_REQUEST'));
        return;
      }
    }

    clearTimeout(inflight?.timer);
    inflight?.resolve(userCodeResult);
    inflight = null;
  });

  stderr.on('data', async (data: Buffer) => {
    if (data.length > MAX_OUT_BYTES) {
      await end(new ErrorWithCode('Output exceeded stream limit of 1MB', 'PAYLOAD_TOO_LARGE'));
      return;
    }

    await end(new ErrorWithCode(data.toString('utf-8'), 'BAD_REQUEST'));
  });

  // Demux Docker's multiplexed stream into stdout/stderr
  const demuxStreamResponse = await tryAsync(() =>
    docker.modem.demuxStream(stream, stdout, stderr),
  );
  if (!demuxStreamResponse.ok) {
    await end(new ErrorWithCode(demuxStreamResponse.error, 'INTERNAL_SERVER_ERROR'));
    throw demuxStreamResponse.error;
  }

  const compilationResponse = await tryAsync(
    () =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject('Compilation timed out'), COMPILING_TIMEOUT_MS);
        compilation = { resolve, reject, timer };
      }),
  );
  if (!compilationResponse.ok) {
    await end(new ErrorWithCode(compilationResponse.error, 'BAD_REQUEST'));
    throw compilationResponse.error;
  }
  console.log('Code compiled');

  function call(...args: In): Promise<Out> {
    const p = new Promise<Out>((resolve, reject) => {
      const timer = setTimeout(() => {
        void end(new ErrorWithCode('User code timed out', 'BAD_REQUEST'));
      }, RPC_TIMEOUT_MS);
      inflight = { args, resolve, reject, timer };
    });

    stream.write(JSON.stringify({ args }) + '\n');
    return p;
  }

  // Return RPC function
  call.end = () => end(new ErrorWithCode('Runner force quit early', 'INTERNAL_SERVER_ERROR'));
  return call;
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
}): Promise<RpcFunction<[In], Out>> {
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

  function userCodePostValidiation(args: [In], userCodeResult: Out): void {
    for (const index in args[0]) {
      if (!(index in userCodeResult)) {
        throw new ErrorWithCode(
          `Expected data from index '${index}' but received none`,
          'BAD_REQUEST',
        );
      }
    }
    for (const index in userCodeResult) {
      if (!(index in args[0])) {
        throw new ErrorWithCode(`Recieved unexpected data from index '${index}'`, 'BAD_REQUEST');
      }
    }
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
