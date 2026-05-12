import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';

type SqsRecord = {
  body: string;
};

type SqsEvent = {
  Records: SqsRecord[];
};

const ecs = new ECSClient({});

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function handler(event: SqsEvent) {
  const clusterArn = requiredEnv('CLUSTER_ARN');
  const taskDefinitionArn = requiredEnv('TASK_DEFINITION_ARN');
  const subnetIds = requiredEnv('SUBNET_IDS').split(',').map((s) => s.trim()).filter(Boolean);
  const securityGroupIds = requiredEnv('SECURITY_GROUP_IDS')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const capacityProviderName = requiredEnv('CAPACITY_PROVIDER_NAME');

  for (const record of event.Records ?? []) {
    const msg = JSON.parse(record.body) as { submissionId?: string };
    if (!msg.submissionId) throw new Error('Missing submissionId in SQS message body');

    console.log(`Dispatching ECS task for submission: ${msg.submissionId}`);

    const result = await ecs.send(
      new RunTaskCommand({
        cluster: clusterArn,
        taskDefinition: taskDefinitionArn,
        // Use the capacity provider strategy rather than launchType so ECS can scale the
        // ASG from 0 when a task arrives (launchType bypasses capacity provider scaling).
        capacityProviderStrategy: [{ base: 0, capacityProvider: capacityProviderName, weight: 1 }],
        networkConfiguration: {
          awsvpcConfiguration: {
            assignPublicIp: 'ENABLED',
            securityGroups: securityGroupIds,
            subnets: subnetIds,
          },
        },
        overrides: {
          containerOverrides: [
            {
              environment: [{ name: 'SUBMISSION_ID', value: msg.submissionId }],
              name: 'WorkerContainer',
            },
          ],
        },
      }),
    );

    if ((result.failures?.length ?? 0) > 0) {
      const failure = result.failures![0];
      throw new Error(`RunTask failed: ${failure.reason ?? 'unknown'} — ${failure.detail ?? ''}`);
    }

    console.log(`Task started: ${result.tasks?.[0]?.taskArn ?? '(no arn)'}`);
  }
}
