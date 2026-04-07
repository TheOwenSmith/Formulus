import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export class ComputeStack extends cdk.Stack {
  readonly vpc: ec2.Vpc;
  readonly cluster: ecs.Cluster;
  readonly taskDefinition: ecs.Ec2TaskDefinition;
  readonly taskSubnets: ec2.SubnetSelection;
  readonly taskSecurityGroups: ec2.ISecurityGroup[];

  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps & {
      workerImageRepo: ecr.IRepository;
    },
  ) {
    super(scope, id, props);

    // Cost-lean default: single-AZ, public subnets; avoid NAT by default.
    // If you need private subnets + NAT or existing VPC/RDS integration, adapt this stack.
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    this.cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: this.vpc,
      clusterName: 'phoenixtrader-backtest',
    });

    // ECS on EC2 because the worker uses dockerode (requires a Docker daemon).
    // The instances can be scaled down to 0 when idle, but cold-start latency will be minutes.
    const asg = this.cluster.addCapacity('WorkerCapacity', {
      instanceType: new ec2.InstanceType('c7i.large'),
      desiredCapacity: 0,
      minCapacity: 0,
      maxCapacity: 10,
      associatePublicIpAddress: true,
      spotPrice: undefined,
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
    });

    // Allow the task to use the instance Docker daemon.
    // (The worker container itself will talk to /var/run/docker.sock on the host.)
    asg.addUserData(
      'echo "ECS_ENABLE_TASK_IAM_ROLE=true" >> /etc/ecs/ecs.config',
      'echo "ECS_ENABLE_TASK_IAM_ROLE_NETWORK_HOST=true" >> /etc/ecs/ecs.config',
    );

    const logGroup = new logs.LogGroup(this, 'WorkerLogGroup', {
      logGroupName: '/phoenixtrader/worker',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.taskDefinition = new ecs.Ec2TaskDefinition(this, 'WorkerTaskDef', {
      networkMode: ecs.NetworkMode.AWS_VPC,
    });

    this.taskDefinition.addToTaskRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue', 'ssm:GetParameter', 'ssm:GetParameters'],
        resources: ['*'],
      }),
    );

    const container = this.taskDefinition.addContainer('WorkerContainer', {
      image: ecs.ContainerImage.fromEcrRepository(props.workerImageRepo, 'latest'),
      memoryReservationMiB: 1024,
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: 'worker' }),
      environment: {
        // Worker code should read these via its config singleton; these are placeholders.
        NODE_ENV: 'production',
      },
    });

    const sg = new ec2.SecurityGroup(this, 'WorkerTaskSG', {
      vpc: this.vpc,
      description: 'Security group for backtest worker tasks',
      allowAllOutbound: true,
    });

    this.taskSubnets = { subnetType: ec2.SubnetType.PUBLIC };
    this.taskSecurityGroups = [sg];
  }
}

