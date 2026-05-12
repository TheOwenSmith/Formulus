import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
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
  readonly capacityProviderName: string;

  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps & {
      workerImageRepo: ecr.IRepository;
      workerEnv: { DATABASE_URL: string; NODE_ENV: string };
    },
  ) {
    super(scope, id, props);

    // Cost-lean default: public subnets, no NAT. Lock down SG outbound if needed later.
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
      clusterName: 'formulus-backtest',
    });

    // EC2 (not Fargate): the worker uses Dockerode, which requires a Docker daemon on the host.
    // Create the ASG directly (not via cluster.addCapacity) so that addAsgCapacityProvider
    // below is the sole caller of configureAutoScalingGroup. Using addCapacity + a separate
    // AsgCapacityProvider on the same ASG causes a duplicate 'DrainECSHook' construct error.
    const asg = new autoscaling.AutoScalingGroup(this, 'WorkerAsg', {
      vpc: this.vpc,
      instanceType: new ec2.InstanceType('c7i.large'),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
      desiredCapacity: 0,
      minCapacity: 0,
      maxCapacity: 10,
      associatePublicIpAddress: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    asg.addUserData(
      'echo "ECS_ENABLE_TASK_IAM_ROLE=true" >> /etc/ecs/ecs.config',
      'echo "ECS_ENABLE_TASK_IAM_ROLE_NETWORK_HOST=true" >> /etc/ecs/ecs.config',
    );

    // Capacity provider with managed scaling allows the ASG to start from 0 when a task
    // is dispatched, and scale back to 0 when idle. Without this, RunTask fails immediately
    // when no instances are running.
    const capacityProvider = new ecs.AsgCapacityProvider(this, 'WorkerCapacityProvider', {
      autoScalingGroup: asg,
      enableManagedScaling: true,
      enableManagedTerminationProtection: false,
      minimumScalingStepSize: 1,
      maximumScalingStepSize: 5,
      targetCapacityPercent: 100,
    });
    this.cluster.addAsgCapacityProvider(capacityProvider);
    this.capacityProviderName = capacityProvider.capacityProviderName;

    const logGroup = new logs.LogGroup(this, 'WorkerLogGroup', {
      logGroupName: '/formulus/worker',
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

    // Bind-mount the host Docker socket so the worker can launch user-code containers via Dockerode.
    this.taskDefinition.addVolume({
      name: 'docker-sock',
      host: { sourcePath: '/var/run/docker.sock' },
    });

    const container = this.taskDefinition.addContainer('WorkerContainer', {
      image: ecs.ContainerImage.fromEcrRepository(props.workerImageRepo, 'latest'),
      memoryReservationMiB: 1024,
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: 'worker' }),
      environment: {
        NODE_ENV: props.workerEnv.NODE_ENV,
        DATABASE_URL: props.workerEnv.DATABASE_URL,
        // SUBMISSION_ID is injected via container overrides by the dispatcher Lambda at launch time.
        AWS_REGION: cdk.Stack.of(this).region,
      },
      privileged: true,
    });

    container.addMountPoints({
      containerPath: '/var/run/docker.sock',
      readOnly: false,
      sourceVolume: 'docker-sock',
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
