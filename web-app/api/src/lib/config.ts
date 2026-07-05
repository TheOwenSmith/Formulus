import { config as dotenvConfig } from 'dotenv';
import { validateEnvVars } from './validate-env-vars';
dotenvConfig();

const devEnvVars = ['PORT', 'AWS_ENDPOINT_URL'] as const satisfies string[];
type DevEnvVar = (typeof devEnvVars)[number];

const envVarsAll = [
  'NODE_ENV',
  'CORS_ORIGIN',
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'QUEUE_URL',
  'AWS_REGION',
  'COHERE_API_KEY',
  'COHERE_MODEL',
  'STRIPE_API_KEY',
  'STRIPE_PRICE_ID',
  'STRIPE_WEBHOOK_SECRET',
] as const satisfies string[];

type EnvVar = (typeof envVarsAll)[number];

class Config {
  private constructor() {
    validateEnvVars(envVarsAll);
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

  get port(): number {
    const port = parseInt(this.getDevKey('PORT'));
    if (isNaN(port)) {
      throw new Error(`Environment variable PORT '${this.getDevKey('PORT')}' is not a number`);
    }
    return port;
  }

  get env(): 'dev' | 'staging' | 'prod' {
    return this.getKey('NODE_ENV') as 'dev' | 'staging' | 'prod';
  }
}

export const config = Config.instance;
