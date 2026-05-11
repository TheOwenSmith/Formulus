import { AmplifyStack } from '@/lib/amplify-stack.js';
import {
  ApiGatewayStack,
  defaultApiCorsHeaders,
  formulusApiLambdaBundlingShell,
} from '@/lib/api-gateway-stack.js';
import { ComputeStack } from '@/lib/compute-stack.js';
import { config, type ClientEnvVar } from '@/lib/config.js';
import { DispatcherStack } from '@/lib/dispatcher-stack.js';
import { EcrStack } from '@/lib/ecr-stack.js';
import { QueueStack } from '@/lib/queue-stack.js';
import { WEB_APP_ROOT } from '@/lib/repo-paths.js';
import * as cdk from 'aws-cdk-lib';

const app = new cdk.App();

const env = {
  account: config.getKey('CDK_DEFAULT_ACCOUNT'),
  region: config.getKey('CDK_DEFAULT_REGION'),
};

// When true, only the Amplify stack is synthesized (skips API/compute stacks
// that require DATABASE_URL and other API-only secrets).
const amplifyOnly = app.node.tryGetContext('amplifyOnly') === 'true';

/** Matches `envVarsLambda` in `web-app/api/src/lib/config.ts` (exclude `QUEUE_URL`, set by CDK; exclude `AWS_REGION`, reserved by Lambda). */
const LAMBDA_ENV_KEYS = [
  'ALPHA_VANTAGE_API_KEY',
  'NODE_ENV',
  'CORS_ORIGIN',
  'DATABASE_URL',
  'BETTER_AUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'COHERE_API_KEY',
  'COHERE_MODEL',
] as const;

function baseApiEnvFromApp(): Record<string, string> {
  const ctx = app.node.tryGetContext('apiEnvJson') as unknown;
  if (ctx != null) {
    if (typeof ctx === 'string') return JSON.parse(ctx) as Record<string, string>;
    return ctx as Record<string, string>;
  }
  const fromEnv: Record<string, string> = {};
  for (const key of LAMBDA_ENV_KEYS) {
    const v = process.env[key];
    if (v != null && v !== '') fromEnv[key] = v;
  }
  return fromEnv;
}

let apiUrl: string | undefined;

if (!amplifyOnly) {
  const baseApiEnv = baseApiEnvFromApp();

  const corsOriginEnv = baseApiEnv['CORS_ORIGIN'] ?? '*';
  const corsOrigins = corsOriginEnv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const apiDomainName = app.node.tryGetContext('apiDomainName') as string | undefined;
  const apiSubDomain = app.node.tryGetContext('apiSubDomain') as string | undefined;
  const apiStagingDomainName = app.node.tryGetContext('apiStagingDomainName') as string | undefined;
  const apiStagingSubDomain = app.node.tryGetContext('apiStagingSubDomain') as string | undefined;

  const ecr = new EcrStack(app, 'FormulusEcr', { env });
  const queue = new QueueStack(app, 'FormulusQueue', { env });

  const compute = new ComputeStack(app, 'FormulusCompute', {
    env,
    workerImageRepo: ecr.workerRepo,
  });

  new DispatcherStack(app, 'FormulusDispatcher', {
    env,
    queue: queue.queue,
    deadLetterQueue: queue.dlq,
    cluster: compute.cluster,
    taskDefinition: compute.taskDefinition,
    taskSubnets: compute.taskSubnets,
    taskSecurityGroups: compute.taskSecurityGroups,
  });

  const api = new ApiGatewayStack(app, 'FormulusApi', {
    env,
    codeRoot: WEB_APP_ROOT,
    bundlingCommand: ['bash', '-c', formulusApiLambdaBundlingShell()],
    corsHeaders: defaultApiCorsHeaders,
    corsOrigins,
    handler: 'lambda.handler',
    lambdaEnvironment: {
      ...baseApiEnv,
      QUEUE_URL: queue.queue.queueUrl,
    },
    backtestQueueArn: queue.queue.queueArn,
    ...(apiDomainName != null &&
      apiSubDomain != null && {
        domainName: apiDomainName,
        subDomain: apiSubDomain,
      }),
  });

  new ApiGatewayStack(app, 'FormulusApiStaging', {
    env,
    codeRoot: WEB_APP_ROOT,
    bundlingCommand: ['bash', '-c', formulusApiLambdaBundlingShell()],
    corsHeaders: defaultApiCorsHeaders,
    corsOrigins,
    handler: 'lambda.handler',
    restApiDisplayName: 'formulus-api-staging',
    lambdaEnvironment: {
      ...baseApiEnv,
      QUEUE_URL: queue.queue.queueUrl,
    },
    backtestQueueArn: queue.queue.queueArn,
    ...(apiStagingDomainName != null &&
      apiStagingSubDomain != null && {
        domainName: apiStagingDomainName,
        subDomain: apiStagingSubDomain,
      }),
  });

  apiUrl = api.apiUrl;
}

const amplifyRepository = app.node.tryGetContext('amplifyRepository') as string | undefined;
const amplifyAccessToken = app.node.tryGetContext('amplifyAccessToken') as string | undefined;

const viteServerUrl = amplifyOnly
  ? config.getKey<ClientEnvVar>('VITE_SERVER_URL')
  : `${apiUrl!.replace(/\/$/, '')}/trpc`;

new AmplifyStack(app, 'FormulusAmplify', {
  env,
  viteServerUrl,
  repository: amplifyRepository,
  accessToken: amplifyAccessToken,
});
