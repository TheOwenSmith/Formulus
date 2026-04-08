import { config as dotenvConfig } from 'dotenv';
import { validateEnvVars } from './validate-env-vars.js';
dotenvConfig();

/** In GitHub Actions only `bin/app.ts` reads account/region; Lambda env is passed via `-c apiEnvJson`. */
const envVarsCdkOnly = ['CDK_DEFAULT_ACCOUNT', 'CDK_DEFAULT_REGION'] as const satisfies string[];

const envVarsAll = [
  'ALPHA_VANTAGE_API_KEY',
  'NODE_ENV',
  'PORT',
  'CORS_ORIGIN',
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'QUEUE_URL',
  'AWS_REGION',
  'AWS_ENDPOINT_URL',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'COHERE_API_KEY',
  'COHERE_MODEL',
  'CDK_DEFAULT_ACCOUNT',
  'CDK_DEFAULT_REGION',
] as const satisfies string[];

/** Lambda uses the execution role for AWS APIs; LocalStack uses explicit keys + endpoint. */
const envVarsLambda = envVarsAll.filter(
  (k) =>
    k !== 'PORT' &&
    k !== 'AWS_ENDPOINT_URL' &&
    k !== 'AWS_ACCESS_KEY_ID' &&
    k !== 'AWS_SECRET_ACCESS_KEY',
) as readonly (typeof envVarsAll)[number][];

type EnvVar = (typeof envVarsAll)[number];

class Config {
  private constructor() {
    const inLambda = process.env['AWS_EXECUTION_ENV'] != null;
    const inGithubCi = process.env['GITHUB_ACTIONS'] === 'true';
    const toValidate = inLambda ? envVarsLambda : inGithubCi ? envVarsCdkOnly : envVarsAll;
    validateEnvVars(toValidate);
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
