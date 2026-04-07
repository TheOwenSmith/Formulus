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
      queue: sqs.IQueue;
      deadLetterQueue: sqs.IQueue;
      cluster: ecs.ICluster;
      taskDefinition: ecs.ITaskDefinition;
      taskSubnets: ec2.SubnetSelection;
      taskSecurityGroups: ec2.ISecurityGroup[];
    },
  ) {
    super(scope, id, props);

    const fn = new lambdaNodejs.NodejsFunction(this, 'Dispatcher', {
      entry: path.join(process.cwd(), 'lambda', 'dispatcher.ts'),
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        CLUSTER_ARN: props.cluster.clusterArn,
        TASK_DEFINITION_ARN: props.taskDefinition.taskDefinitionArn,
        SUBNET_IDS: cdk.Fn.join(
          ',',
          props.cluster.vpc.selectSubnets(props.taskSubnets).subnetIds,
        ),
        SECURITY_GROUP_IDS: cdk.Fn.join(',', props.taskSecurityGroups.map((sg) => sg.securityGroupId)),
      },
    });

    fn.addEventSource(
      new sources.SqsEventSource(props.queue, {
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
    fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['iam:PassRole'],
        resources: ['*'],
      }),
    );

    props.queue.grantConsumeMessages(fn);
  }
}

