import { config as dotenvConfig } from 'dotenv';
import { validateEnvVars } from './validate-env-vars';
dotenvConfig();

const envVars = ['ALPHA_VANTAGE_API_KEY'] as const satisfies string[];
type EnvVar = (typeof envVars)[number];

class Config {
  private constructor() {
    validateEnvVars(envVars);
  }

  static #instance: Config;
  static get instance() {
    return this.#instance ?? (this.#instance = new Config());
  }

  getKey(key: EnvVar) {
    return process.env[key]!;
  }
}

export const config = Config.instance;
