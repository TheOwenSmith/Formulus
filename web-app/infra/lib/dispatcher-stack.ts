import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';
import path from 'path';

export class DispatcherStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps & {
      cluster: ecs.ICluster;
      taskDefinition: ecs.TaskDefinition;
      taskSubnets: ec2.SubnetSelection;
      taskSecurityGroups: ec2.ISecurityGroup[];
      capacityProviderName: string;
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
      this.formatArn({ service: 'sqs', resource: 'formulus-backtest-jobs' }),
    );

    const fn = new lambdaNodejs.NodejsFunction(this, 'Dispatcher', {
      entry: path.join(process.cwd(), 'lambda', 'dispatcher.ts'),
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(60),
      memorySize: 256,
      environment: {
        CAPACITY_PROVIDER_NAME: props.capacityProviderName,
        CLUSTER_ARN: props.cluster.clusterArn,
        SECURITY_GROUP_IDS: cdk.Fn.join(',', props.taskSecurityGroups.map((sg) => sg.securityGroupId)),
        SUBNET_IDS: cdk.Fn.join(
          ',',
          props.cluster.vpc.selectSubnets(props.taskSubnets).subnetIds,
        ),
        TASK_DEFINITION_ARN: props.taskDefinition.taskDefinitionArn,
      },
    });

    fn.addEventSource(
      new sources.SqsEventSource(queue, {
        batchSize: 1,
        reportBatchItemFailures: false,
      }),
    );

    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ecs:RunTask'],
        resources: [props.taskDefinition.taskDefinitionArn],
      }),
    );

    const passRoleResources = [props.taskDefinition.taskRole.roleArn];
    if (props.taskDefinition.executionRole != null) {
      passRoleResources.push(props.taskDefinition.executionRole.roleArn);
    }
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: passRoleResources,
      }),
    );

    queue.grantConsumeMessages(fn);
  }
}
