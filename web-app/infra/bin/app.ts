import { AmplifyStack } from '@/lib/amplify-stack.js';
import {
  ApiGatewayStack,
  defaultApiCorsHeaders,
  formulusApiLambdaBundlingShell,
} from '@/lib/api-gateway-stack.js';
import { ComputeStack } from '@/lib/compute-stack.js';
import { config, envVarsLambda, type ApiEnvVar, type ClientEnvVar } from '@/lib/config.js';
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

let apiUrl: string | undefined;

if (!amplifyOnly) {
  const ecr = new EcrStack(app, 'FormulusEcr', { env });
  const queue = new QueueStack(app, 'FormulusQueue', { env });

  const compute = new ComputeStack(app, 'FormulusCompute', {
    env,
    workerEnv: {
      DATABASE_URL: config.getKey<ApiEnvVar>('DATABASE_URL'),
      NODE_ENV: config.getKey<ApiEnvVar>('NODE_ENV'),
    },
    workerImageRepo: ecr.workerRepo,
  });

  new DispatcherStack(app, 'FormulusDispatcher', {
    capacityProviderName: compute.capacityProviderName,
    cluster: compute.cluster,
    env,
    taskDefinition: compute.taskDefinition,
    taskSecurityGroups: compute.taskSecurityGroups,
    taskSubnets: compute.taskSubnets,
  });

  if (!workerOnly) {
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

    const api = new ApiGatewayStack(app, 'FormulusApi', {
      backtestQueueArn: queue.queue.queueArn,
      bundlingCommand: ['bash', '-c', formulusApiLambdaBundlingShell()],
      codeRoot: WEB_APP_ROOT,
      corsHeaders: defaultApiCorsHeaders,
      corsOrigins,
      env,
      handler: 'lambda.handler',
      lambdaEnvironment: {
        ...baseApiEnv,
        QUEUE_URL: queue.queue.queueUrl,
      },
      ...(apiDomainName != null &&
        apiSubDomain != null && {
          domainName: apiDomainName,
          subDomain: apiSubDomain,
        }),
    });

    new ApiGatewayStack(app, 'FormulusApiStaging', {
      backtestQueueArn: queue.queue.queueArn,
      bundlingCommand: ['bash', '-c', formulusApiLambdaBundlingShell()],
      codeRoot: WEB_APP_ROOT,
      corsHeaders: defaultApiCorsHeaders,
      corsOrigins,
      env,
      handler: 'lambda.handler',
      lambdaEnvironment: {
        ...baseApiEnv,
        QUEUE_URL: queue.queue.queueUrl,
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
