import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
import path from 'path';

export class DispatcherStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    // All compute-stack values are passed as plain strings — no CDK cross-stack construct
    // references — so this stack has no Fn::ImportValue calls into FormulusCompute*.
    // The capacity provider name is resolved at Lambda runtime via DescribeClusters rather
    // than at deploy time, which avoids the 1-CP-per-ASG rename restriction in ECS.
    props: cdk.StackProps & {
      clusterArn: string;
      taskDefinitionArn: string;
      taskRoleArn: string;
      executionRoleArn: string;
      queueBaseName: string;
    },
  ) {
    super(scope, id, props);

    // Look up the queue by ARN rather than accepting it as a cross-stack CDK prop.
    // Passing queue.queue across stacks creates a CloudFormation export in FormulusQueue
    // that gets dropped when the app is synthesized without FormulusApi, causing
    // CloudFormation to refuse the changeset (export still in use by FormulusApi).
    const queue = sqs.Queue.fromQueueArn(
      this,
      'Queue',
      this.formatArn({ service: 'sqs', resource: props.queueBaseName }),
    );

    const fn = new lambdaNodejs.NodejsFunction(this, 'Dispatcher', {
      entry: path.join(process.cwd(), 'lambda', 'dispatcher.ts'),
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      environment: {
        CLUSTER_ARN: props.clusterArn,
        TASK_DEFINITION_ARN: props.taskDefinitionArn,
      },
    });

    fn.addEventSource(
      new sources.SqsEventSource(queue, { batchSize: 1, reportBatchItemFailures: false }),
    );

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ecs:DescribeClusters'],
        resources: [props.clusterArn],
      }),
    );

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ecs:RunTask'],
        // Allow any revision of this task definition family.
        resources: [`${props.taskDefinitionArn}:*`, props.taskDefinitionArn],
      }),
    );

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: [props.taskRoleArn, props.executionRoleArn],
      }),
    );

    queue.grantConsumeMessages(fn);
  }
}
