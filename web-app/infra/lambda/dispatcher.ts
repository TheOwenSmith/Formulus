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

  for (const record of event.Records ?? []) {
    const msg = JSON.parse(record.body) as { submissionId?: string };
    if (!msg.submissionId) throw new Error('Missing submissionId');

    await ecs.send(
      new RunTaskCommand({
        cluster: clusterArn,
        taskDefinition: taskDefinitionArn,
        launchType: 'EC2',
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: subnetIds,
            securityGroups: securityGroupIds,
            assignPublicIp: 'ENABLED',
          },
        },
        overrides: {
          containerOverrides: [
            {
              name: 'WorkerContainer',
              environment: [{ name: 'SUBMISSION_ID', value: msg.submissionId }],
            },
          ],
        },
      }),
    );
  }
}

