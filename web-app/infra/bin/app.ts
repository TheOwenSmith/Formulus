import { AmplifyStack } from '@/lib/amplify-stack.js';
import {
  ApiGatewayStack,
  defaultApiCorsHeaders,
  formulusApiLambdaBundlingShell,
} from '@/lib/api-gateway-stack.js';
import { ComputeStack } from '@/lib/compute-stack.js';
import {
  config,
  envVarsLambda,
  type ApiEnvVar,
  type ClientEnvVar,
  type WorkerCdkEnvVar,
} from '@/lib/config.js';
import { WEB_APP_ROOT } from '@/lib/constants.js';
import { DispatcherStack } from '@/lib/dispatcher-stack.js';
import { EcrStack } from '@/lib/ecr-stack.js';
import { QueueStack } from '@/lib/queue-stack.js';
import * as cdk from 'aws-cdk-lib';

const app = new cdk.App();

const env = {
  account: config.getKey('CDK_DEFAULT_ACCOUNT'),
  region: config.getKey('CDK_DEFAULT_REGION'),
};

// One of these must be set to true via CDK context (-c deployClient=true, etc.).
const deployClient = app.node.tryGetContext('deployClient') === 'true';
const deployApi = app.node.tryGetContext('deployApi') === 'true';
const deployWorker = app.node.tryGetContext('deployWorker') === 'true';

function baseApiEnvFromApp(): Record<string, string> {
  const ctx = app.node.tryGetContext('apiEnvJson') as unknown;
  if (ctx != null) {
    if (typeof ctx === 'string') return JSON.parse(ctx) as Record<string, string>;
    return ctx as Record<string, string>;
  }
  const fromEnv: Record<string, string> = {};
  for (const key of envVarsLambda) {
    fromEnv[key] = config.getKey<ApiEnvVar>(key);
  }
  return fromEnv;
}

// Construct queue URL/ARN from known names — avoids CDK cross-stack CF exports that block
// stack deletion when one stack's exports are imported by another.
const PROD_QUEUE = 'formulus-backtest-jobs';
const STAGING_QUEUE = 'formulus-backtest-jobs-staging';

function makeQueueArn(account: string, region: string, name: string) {
  return `arn:aws:sqs:${region}:${account}:${name}`;
}
function makeQueueUrl(account: string, region: string, name: string) {
  return `https://sqs.${region}.amazonaws.com/${account}/${name}`;
}

if (deployWorker) {
  const ecr = new EcrStack(app, 'FormulusEcr', { env });

  const workerEnvConfig = {
    ALPHA_VANTAGE_API_KEY: config.getKey<WorkerCdkEnvVar>('ALPHA_VANTAGE_API_KEY'),
    DATA_BUCKET: config.getKey<WorkerCdkEnvVar>('DATA_BUCKET'),
    DATABASE_URL: config.getKey<WorkerCdkEnvVar>('DATABASE_URL'),
    NODE_ENV: config.getKey<WorkerCdkEnvVar>('NODE_ENV'),
  };

  for (const { suffix, clusterName, imageTag, logGroupName, queueBaseName } of [
    {
      clusterName: 'formulus-backtest',
      imageTag: 'latest',
      logGroupName: '/formulus/worker',
      queueBaseName: PROD_QUEUE,
      suffix: '',
    },
    {
      clusterName: 'formulus-backtest-staging',
      imageTag: 'staging',
      logGroupName: '/formulus/worker-staging',
      queueBaseName: STAGING_QUEUE,
      suffix: 'Staging',
    },
  ]) {
    const taskDefFamily = `${clusterName}-worker`;
    const taskRoleName = `${clusterName}-task-role`;
    const executionRoleName = `${clusterName}-exec-role`;

    const clusterArn = `arn:aws:ecs:${env.region}:${env.account}:cluster/${clusterName}`;
    const taskDefinitionArn = `arn:aws:ecs:${env.region}:${env.account}:task-definition/${taskDefFamily}`;
    const taskRoleArn = `arn:aws:iam::${env.account}:role/${taskRoleName}`;
    const executionRoleArn = `arn:aws:iam::${env.account}:role/${executionRoleName}`;

    new ComputeStack(app, `FormulusCompute${suffix}`, {
      clusterName,
      env,
      executionRoleName,
      imageTag,
      logGroupName,
      runnerImageRepos: [ecr.typescriptRunnerRepo, ecr.cppRunnerRepo],
      taskDefinitionFamily: taskDefFamily,
      taskRoleName,
      workerEnv: workerEnvConfig,
      workerImageRepo: ecr.workerRepo,
    });

    new DispatcherStack(app, `FormulusDispatcher${suffix}`, {
      clusterArn,
      env,
      executionRoleArn,
      queueBaseName,
      taskDefinitionArn,
      taskRoleArn,
    });
  }
}

if (deployApi) {
  new QueueStack(app, 'FormulusQueue', { env, queueBaseName: PROD_QUEUE });
  new QueueStack(app, 'FormulusQueueStaging', { env, queueBaseName: STAGING_QUEUE });

  const baseApiEnv = baseApiEnvFromApp();

  const corsOriginEnv = baseApiEnv['CORS_ORIGIN'] ?? '*';
  const corsOrigins = corsOriginEnv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const apiDomainName = app.node.tryGetContext('apiDomainName') as string | undefined;
  const apiSubDomain = app.node.tryGetContext('apiSubDomain') as string | undefined;
  const apiStagingDomainName = app.node.tryGetContext('apiStagingDomainName') as
    | string
    | undefined;
  const apiStagingSubDomain = app.node.tryGetContext('apiStagingSubDomain') as string | undefined;

  new ApiGatewayStack(app, 'FormulusApi', {
    backtestQueueArn: makeQueueArn(env.account, env.region, PROD_QUEUE),
    bundlingCommand: ['bash', '-c', formulusApiLambdaBundlingShell()],
    codeRoot: WEB_APP_ROOT,
    corsHeaders: defaultApiCorsHeaders,
    corsOrigins,
    env,
    handler: 'lambda.handler',
    lambdaEnvironment: {
      ...baseApiEnv,
      QUEUE_URL: makeQueueUrl(env.account, env.region, PROD_QUEUE),
    },
    ...(apiDomainName != null &&
      apiSubDomain != null && {
        domainName: apiDomainName,
        subDomain: apiSubDomain,
      }),
  });

  new ApiGatewayStack(app, 'FormulusApiStaging', {
    backtestQueueArn: makeQueueArn(env.account, env.region, STAGING_QUEUE),
    bundlingCommand: ['bash', '-c', formulusApiLambdaBundlingShell()],
    codeRoot: WEB_APP_ROOT,
    corsHeaders: defaultApiCorsHeaders,
    corsOrigins,
    env,
    handler: 'lambda.handler',
    lambdaEnvironment: {
      ...baseApiEnv,
      QUEUE_URL: makeQueueUrl(env.account, env.region, STAGING_QUEUE),
    },
    restApiDisplayName: 'formulus-api-staging',
    ...(apiStagingDomainName != null &&
      apiStagingSubDomain != null && {
        domainName: apiStagingDomainName,
        subDomain: apiStagingSubDomain,
      }),
  });
}

if (deployClient) {
  const viteServerUrl = config.getKey<ClientEnvVar>('VITE_SERVER_URL');
  const enableTooltips = config.getKey<ClientEnvVar>('VITE_ENABLE_TOOLTIPS');

  for (const client of [
    {
      branchName: 'client-prod',
      id: 'FormulusAmplify',
      mapRootDomain: true,
      subDomain: 'prod',
    },
    {
      branchName: 'client-staging',
      id: 'FormulusAmplifyStaging',
      mapRootDomain: false,
      subDomain: 'staging',
    },
  ]) {
    new AmplifyStack(app, client.id, {
      branchName: client.branchName,
      domainName: 'formulus.ai',
      enableTooltips,
      env,
      mapRootDomain: client.mapRootDomain,
      subDomain: client.subDomain,
      viteServerUrl,
    });
  }
}
