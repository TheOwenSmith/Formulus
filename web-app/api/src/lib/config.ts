import { config as dotenvConfig } from 'dotenv';
import { validateEnvVars } from './validate-env-vars';
dotenvConfig();

const envVars = [
  'ALPHA_VANTAGE_API_KEY',
  'NODE_ENV',
  'PORT',
  'CORS_ORIGIN',
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'CREATOR_ID',
] as const satisfies string[];
type EnvVar = (typeof envVars)[number];

class Config {
  private constructor() {
    validateEnvVars(envVars);
  }

  static #instance: Config | null = null;
  static get instance() {
    return this.#instance ?? (this.#instance = new Config());
  }

  getKey(key: EnvVar) {
    return process.env[key]!;
  }

  get port(): number {
    const port = parseInt(this.getKey('PORT'));
    if (isNaN(port)) {
      throw new Error(`Environment variable PORT '${this.getKey('PORT')}' is not a number`);
    }
    return port;
  }

  get env(): 'dev' | 'staging' | 'prod' {
    return this.getKey('NODE_ENV') as 'dev' | 'staging' | 'prod';
  }
}

export const config = Config.instance;
