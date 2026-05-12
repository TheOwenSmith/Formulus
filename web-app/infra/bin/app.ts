import { AmplifyStack } from '@/lib/amplify-stack.js';
import {
  ApiGatewayStack,
  defaultApiCorsHeaders,
  formulusApiLambdaBundlingShell,
} from '@/lib/api-gateway-stack.js';
import { ComputeStack } from '@/lib/compute-stack.js';
import { config, envVarsLambda, type ApiEnvVar, type ClientEnvVar } from '@/lib/config.js';
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

// amplifyOnly: synthesize only Amplify stacks (skips API/compute, which require DB secrets).
const amplifyOnly = app.node.tryGetContext('amplifyOnly') === 'true';
// workerOnly: synthesize ECR + Queue + Compute + Dispatcher only (skips API + Amplify stacks).
const workerOnly = app.node.tryGetContext('workerOnly') === 'true';

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

let apiUrl: string | undefined;

if (!amplifyOnly) {
  const ecr = new EcrStack(app, 'FormulusEcr', { env });
  new QueueStack(app, 'FormulusQueue', { env, queueBaseName: PROD_QUEUE });
  new QueueStack(app, 'FormulusQueueStaging', { env, queueBaseName: STAGING_QUEUE });

  const workerEnvConfig = {
    DATABASE_URL: config.getKey<ApiEnvVar>('DATABASE_URL'),
    NODE_ENV: config.getKey<ApiEnvVar>('NODE_ENV'),
  };

  for (const { suffix, clusterName, imageTag, logGroupName, queueBaseName } of [
    { suffix: '', clusterName: 'formulus-backtest', imageTag: 'latest', logGroupName: '/formulus/worker', queueBaseName: PROD_QUEUE },
    { suffix: 'Staging', clusterName: 'formulus-backtest-staging', imageTag: 'staging', logGroupName: '/formulus/worker-staging', queueBaseName: STAGING_QUEUE },
  ]) {
    // Derive known resource names from the cluster name so they can be passed as plain strings
    // to both stacks, eliminating all CDK cross-stack CF exports between Compute and Dispatcher.
    const taskDefFamily = `${clusterName}-worker`;
    const taskRoleName = `${clusterName}-task-role`;
    const executionRoleName = `${clusterName}-exec-role`;

    const clusterArn = `arn:aws:ecs:${env.region}:${env.account}:cluster/${clusterName}`;
    const taskDefinitionArn = `arn:aws:ecs:${env.region}:${env.account}:task-definition/${taskDefFamily}`;
    const taskRoleArn = `arn:aws:iam::${env.account}:role/${taskRoleName}`;
    const executionRoleArn = `arn:aws:iam::${env.account}:role/${executionRoleName}`;

    new ComputeStack(app, `FormulusCompute${suffix}`, {
      env,
      clusterName,
      imageTag,
      logGroupName,
      workerEnv: workerEnvConfig,
      workerImageRepo: ecr.workerRepo,
      taskDefinitionFamily: taskDefFamily,
      taskRoleName,
      executionRoleName,
    });

    new DispatcherStack(app, `FormulusDispatcher${suffix}`, {
      clusterArn,
      taskDefinitionArn,
      taskRoleArn,
      executionRoleArn,
      env,
      queueBaseName,
    });
  }

  if (!workerOnly) {
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

    const api = new ApiGatewayStack(app, 'FormulusApi', {
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

    apiUrl = api.apiUrl;
  }
}

if (!workerOnly) {
  const viteServerUrl = amplifyOnly
    ? config.getKey<ClientEnvVar>('VITE_SERVER_URL')
    : `${apiUrl!.replace(/\/$/, '')}/trpc`;

  for (const client of [
    {
      id: 'FormulusAmplify',
      branchName: 'client-prod',
      subDomain: 'prod',
      mapRootDomain: true,
    },
    {
      id: 'FormulusAmplifyStaging',
      branchName: 'client-staging',
      subDomain: 'staging',
      mapRootDomain: false,
    },
  ]) {
    new AmplifyStack(app, client.id, {
      branchName: client.branchName,
      domainName: 'formulus.ai',
      env,
      mapRootDomain: client.mapRootDomain,
      subDomain: client.subDomain,
      viteServerUrl,
    });
  }
}
