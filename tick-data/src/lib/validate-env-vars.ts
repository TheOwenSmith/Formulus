export function validateEnvVars(envVars: string[]) {
  const missingEnvVars = envVars.filter((envVar) => process.env[envVar] == undefined);
  if (missingEnvVars.length > 0) {
    throw new Error(
      `Environment variable(s) ${missingEnvVars.join(', ')} ${missingEnvVars.length > 1 ? 'are' : 'is'} not set`,
    );
  }
}
