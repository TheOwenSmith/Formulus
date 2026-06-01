import { ECRClient, GetAuthorizationTokenCommand } from '@aws-sdk/client-ecr';
import { fromThrowableAsync, internal, type AppError } from '@worker/utils/error-handling';
import Docker from 'dockerode';
import { err, ok, type Result } from 'neverthrow';
import { config } from './config';

declare global {
  var docker: Docker | undefined;
}

globalThis.docker ??= new Docker();

export const docker = globalThis.docker;

async function getEcrAuthConfig(
  image: string,
): Promise<{ username: string; password: string; serveraddress: string }> {
  const registry = image.split('/')[0];
  const ecr = new ECRClient({ region: config.getKey('AWS_REGION') });
  const { authorizationData } = await ecr.send(new GetAuthorizationTokenCommand({}));
  const decoded = Buffer.from(authorizationData![0].authorizationToken!, 'base64').toString(
    'utf-8',
  );
  const colonIdx = decoded.indexOf(':');
  return {
    password: decoded.slice(colonIdx + 1),
    serveraddress: `https://${registry}`,
    username: decoded.slice(0, colonIdx),
  };
}

export async function pullImageIfAbsent(image: string): Promise<Result<undefined, AppError>> {
  const inspectResult = await fromThrowableAsync(
    () => docker.getImage(image).inspect(),
    (e) => internal(e),
  );
  if (inspectResult.isOk()) return ok(undefined);

  console.log(`Pulling image: ${image}`);

  let authconfig: { username: string; password: string; serveraddress: string } | undefined;
  if (image.includes('.amazonaws.com')) {
    const authResult = await fromThrowableAsync(
      () => getEcrAuthConfig(image),
      (e) => internal(e, `Failed to get ECR auth for '${image}'`),
    );
    if (authResult.isErr()) return err(authResult.error);
    authconfig = authResult.value;
  }

  return fromThrowableAsync(
    () =>
      new Promise<void>((resolve, reject) => {
        docker.pull(
          image,
          {},
          (pullErr: Error | null, stream: NodeJS.ReadableStream | undefined) => {
            if (pullErr) return reject(pullErr);
            if (stream == undefined) return reject(new Error('Pull returned no stream'));
            docker.modem.followProgress(stream, (progressErr: Error | null) => {
              if (progressErr) return reject(progressErr);
              resolve();
            });
          },
          authconfig,
        );
      }),
    (e) => internal(e, `Failed to pull image '${image}'`),
  ).map(() => undefined);
}
