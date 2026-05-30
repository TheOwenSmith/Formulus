import { config as dotenvConfig } from 'dotenv';
import { validateEnvVars } from './validate-env-vars';
dotenvConfig();

const devEnvVars = [
  'AWS_ENDPOINT_URL',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'QUEUE_URL',
] as const satisfies string[];
type DevEnvVar = (typeof devEnvVars)[number];

const envVars = [
  'NODE_ENV',
  'DATABASE_URL',
  'AWS_REGION',
] as const satisfies string[];
type EnvVar = (typeof envVars)[number];

const deployEnvVars = ['DATA_BUCKET', 'ECR_REGISTRY', 'SUBMISSION_ID'] as const satisfies string[];
type DeployEnvVar = (typeof deployEnvVars)[number];

class Config {
  private constructor() {
    validateEnvVars(envVars);
    if (this.env === 'dev') {
      validateEnvVars(devEnvVars);
    } else {
      validateEnvVars(deployEnvVars);
    }
  }

  static #instance: Config | null = null;
  static get instance() {
    return this.#instance ?? (this.#instance = new Config());
  }

  getKey(key: EnvVar) {
    return process.env[key]!;
  }

  getDevKey(key: DevEnvVar) {
    return process.env[key]!;
  }

  getDeployKey(key: DeployEnvVar) {
    return process.env[key]!;
  }

  get env(): 'dev' | 'staging' | 'prod' {
    return this.getKey('NODE_ENV') as 'dev' | 'staging' | 'prod';
  }
}

export const config = Config.instance;
