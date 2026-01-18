import Docker from 'dockerode';

declare global {
  var docker: Docker | undefined;
}

globalThis.docker ??= new Docker();

export const docker = globalThis.docker;
