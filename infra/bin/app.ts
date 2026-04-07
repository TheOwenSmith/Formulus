import * as cdk from 'aws-cdk-lib';
import { EcrStack } from '../lib/ecr-stack.js';
import { QueueStack } from '../lib/queue-stack.js';
import { ComputeStack } from '../lib/compute-stack.js';
import { DispatcherStack } from '../lib/dispatcher-stack.js';

const app = new cdk.App();

/**
 * This CDK app intentionally avoids hardcoding account/region.
 * Use environment configuration in CI/CD (GitHub OIDC) or `cdk bootstrap` locally.
 */
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const ecr = new EcrStack(app, 'PhoenixTraderEcr', { env });
const queue = new QueueStack(app, 'PhoenixTraderQueue', { env });

// NOTE: The current worker code uses dockerode to spawn sandbox containers.
// That requires a Docker daemon, which is not available in ECS Fargate.
// ComputeStack therefore provisions an ECS *EC2* cluster by default.
const compute = new ComputeStack(app, 'PhoenixTraderCompute', {
  env,
  workerImageRepo: ecr.workerRepo,
});

new DispatcherStack(app, 'PhoenixTraderDispatcher', {
  env,
  queue: queue.queue,
  deadLetterQueue: queue.dlq,
  cluster: compute.cluster,
  taskDefinition: compute.taskDefinition,
  taskSubnets: compute.taskSubnets,
  taskSecurityGroups: compute.taskSecurityGroups,
});

