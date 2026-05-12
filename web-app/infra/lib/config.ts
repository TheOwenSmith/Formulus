import { config as dotenvConfig } from 'dotenv';
import { validateEnvVars } from './validate-env-vars.js';
dotenvConfig();

const envVarsCdk = [
  'CDK_DEFAULT_ACCOUNT',
  'CDK_DEFAULT_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_REGION',
] as const;
const envVarsClient = [...envVarsCdk, 'VITE_SERVER_URL'] as const;

export const envVarsLambda = [
  'ALPHA_VANTAGE_API_KEY',
  'NODE_ENV',
  'CORS_ORIGIN',
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'COHERE_API_KEY',
  'COHERE_MODEL',
] as const satisfies string[];

const envVarsApi = [...envVarsCdk, ...envVarsLambda] as const;

export type ClientEnvVar = (typeof envVarsClient)[number];
export type ApiEnvVar = (typeof envVarsApi)[number];
export type EnvVar = ClientEnvVar | ApiEnvVar;

const environmentVariablesByDeployTarget = {
  client: envVarsClient,
  api: envVarsApi,
  worker: envVarsApi,
} as const;

type DeployTarget = keyof typeof environmentVariablesByDeployTarget;

class Config {
  private constructor() {
    const deployTarget = process.env['DEPLOY_TARGET'] as DeployTarget | undefined;
    if (deployTarget == null || !(deployTarget in environmentVariablesByDeployTarget)) {
      throw new Error(
        `DEPLOY_TARGET must be one of: ${Object.keys(environmentVariablesByDeployTarget).join(', ')}. ` +
          `Got: ${deployTarget ?? '(not set)'}. Set it in .env or the CI workflow.`,
      );
    }
    validateEnvVars(environmentVariablesByDeployTarget[deployTarget]);
  }

  static #instance: Config | null = null;
  static get instance() {
    return this.#instance ?? (this.#instance = new Config());
  }

  getKey<K extends EnvVar = EnvVar>(key: K): string {
    return process.env[key]!;
  }

  get env(): 'dev' | 'staging' | 'prod' {
    return this.getKey('NODE_ENV') as 'dev' | 'staging' | 'prod';
  }
}

export const config = Config.instance;
