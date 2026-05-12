import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export class QueueStack extends cdk.Stack {
  readonly queue: sqs.Queue;
  readonly dlq: sqs.Queue;

  constructor(scope: Construct, id: string, props: cdk.StackProps & { queueBaseName: string }) {
    super(scope, id, props);

    this.dlq = new sqs.Queue(this, 'BacktestJobsDLQ', {
      queueName: `${props.queueBaseName}-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
    });

    this.queue = new sqs.Queue(this, 'BacktestJobsQueue', {
      queueName: props.queueBaseName,
      visibilityTimeout: cdk.Duration.hours(6),
      retentionPeriod: cdk.Duration.days(4),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      deadLetterQueue: {
        maxReceiveCount: 5,
        queue: this.dlq,
      },
    });
  }
}

