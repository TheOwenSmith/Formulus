import { config as dotenvConfig } from 'dotenv';
import { validateEnvVars } from './validate-env-vars';
dotenvConfig();

const devEnvVars = [
  'AWS_ENDPOINT_URL',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
] as const satisfies string[];
type DevEnvVar = (typeof devEnvVars)[number];

const envVars = ['NODE_ENV', 'DATABASE_URL', 'SUBMISSION_ID'] as const satisfies string[];
type EnvVar = (typeof envVars)[number];

class Config {
  private constructor() {
    validateEnvVars(envVars);
    if (this.env === 'dev') {
      validateEnvVars(devEnvVars);
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

  get env(): 'dev' | 'staging' | 'prod' {
    return this.getKey('NODE_ENV') as 'dev' | 'staging' | 'prod';
  }
}

export const config = Config.instance;
