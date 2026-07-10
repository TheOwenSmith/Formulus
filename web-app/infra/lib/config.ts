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
const envVarsClient = [...envVarsCdk, 'VITE_SERVER_URL', 'VITE_ENABLE_TOOLTIPS'] as const;

export const envVarsLambda = [
  'NODE_ENV',
  'CORS_ORIGIN',
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'COHERE_API_KEY',
  'COHERE_MODEL',
  'STRIPE_API_KEY',
  'STRIPE_PRICE_ID',
  'STRIPE_WEBHOOK_SECRET',
  'REDIS_URL',
  'PFP_BUCKET_NAME',
] as const satisfies string[];

const envVarsApi = [...envVarsCdk, ...envVarsLambda] as const;

export const envVarsWorkerCdk = [
  ...envVarsCdk,
  'ALPHA_VANTAGE_API_KEY',
  'DATA_BUCKET',
  'DATABASE_URL',
  'NODE_ENV',
] as const satisfies string[];

export type ClientEnvVar = (typeof envVarsClient)[number];
export type ApiEnvVar = (typeof envVarsApi)[number];
export type WorkerCdkEnvVar = (typeof envVarsWorkerCdk)[number];
export type EnvVar = ClientEnvVar | ApiEnvVar | WorkerCdkEnvVar;

const environmentVariablesByDeployTarget = {
  client: envVarsClient,
  api: envVarsApi,
  worker: envVarsWorkerCdk,
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
