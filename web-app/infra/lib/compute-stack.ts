import * as cdk from 'aws-cdk-lib';
import * as autoscaling from 'aws-cdk-lib/aws-autoscaling';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export class ComputeStack extends cdk.Stack {
  readonly vpc: ec2.Vpc;
  readonly cluster: ecs.Cluster;
  readonly taskDefinition: ecs.Ec2TaskDefinition;
  readonly capacityProviderName: string;

  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps & {
      workerImageRepo: ecr.IRepository;
      workerEnv: { ALPHA_VANTAGE_API_KEY: string; DATA_BUCKET: string; DATABASE_URL: string; NODE_ENV: string };
      clusterName?: string;
      imageTag?: string;
      logGroupName?: string;
      taskDefinitionFamily?: string;
      taskRoleName?: string;
      executionRoleName?: string;
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
      clusterName: props.clusterName ?? 'formulus-backtest',
    });

    // EC2 (not Fargate): the worker uses Dockerode, which requires a Docker daemon on the host.
    // Create the ASG directly (not via cluster.addCapacity) so that addAsgCapacityProvider
    // below is the sole caller of configureAutoScalingGroup. Using addCapacity + a separate
    // AsgCapacityProvider on the same ASG causes a duplicate 'DrainECSHook' construct error.
    //
    // LaunchTemplate (not LaunchConfiguration): AWS has blocked LaunchConfiguration creation
    // in this account. requireImdsv2 on a LaunchTemplate also enforces IMDSv2.
    const instanceRole = new iam.Role(this, 'WorkerInstanceRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AmazonEC2ContainerServiceforEC2Role',
        ),
      ],
    });

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'echo "ECS_ENABLE_TASK_IAM_ROLE=true" >> /etc/ecs/ecs.config',
      'echo "ECS_ENABLE_TASK_IAM_ROLE_NETWORK_HOST=true" >> /etc/ecs/ecs.config',
    );

    const lt = new ec2.LaunchTemplate(this, 'WorkerLaunchTemplate', {
      instanceType: new ec2.InstanceType('c7i.large'),
      machineImage: ecs.EcsOptimizedImage.amazonLinux2(),
      requireImdsv2: true,
      role: instanceRole,
      userData,
    });

    const asg = new autoscaling.AutoScalingGroup(this, 'WorkerAsg', {
      desiredCapacity: 0,
      launchTemplate: lt,
      maxCapacity: 10,
      minCapacity: 0,
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // Capacity provider with managed scaling allows the ASG to start from 0 when a task
    // is dispatched, and scale back to 0 when idle. Without this, RunTask fails immediately
    // when no instances are running.
    const capacityProvider = new ecs.AsgCapacityProvider(this, 'WorkerCapacityProvider', {
      autoScalingGroup: asg,
      enableManagedScaling: true,
      enableManagedTerminationProtection: false,
      maximumScalingStepSize: 5,
      minimumScalingStepSize: 1,
      targetCapacityPercent: 100,
    });
    this.cluster.addAsgCapacityProvider(capacityProvider);
    this.capacityProviderName = capacityProvider.capacityProviderName;

    const logGroup = new logs.LogGroup(this, 'WorkerLogGroup', {
      logGroupName: props.logGroupName ?? '/formulus/worker',
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Explicit roles with known names so app.ts can construct their ARNs as plain strings and
    // pass them to DispatcherStack without creating CloudFormation cross-stack exports.
    const executionRole = new iam.Role(this, 'WorkerExecutionRole', {
      ...(props.executionRoleName != null && { roleName: props.executionRoleName }),
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonECSTaskExecutionRolePolicy'),
      ],
    });

    const taskRole = new iam.Role(this, 'WorkerTaskRole', {
      ...(props.taskRoleName != null && { roleName: props.taskRoleName }),
      assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    // HOST network mode: the task shares the EC2 instance's network stack, giving it internet
    // access through the instance's public IP without a NAT gateway. AWS_VPC mode would require
    // assignPublicIp (Fargate-only) or a NAT gateway for outbound connectivity.
    // ECS_ENABLE_TASK_IAM_ROLE_NETWORK_HOST=true in the ASG user data enables IAM roles in this mode.
    this.taskDefinition = new ecs.Ec2TaskDefinition(this, 'WorkerTaskDef', {
      networkMode: ecs.NetworkMode.HOST,
      ...(props.taskDefinitionFamily != null && { family: props.taskDefinitionFamily }),
      taskRole,
      executionRole,
    });

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue', 'ssm:GetParameter', 'ssm:GetParameters'],
        resources: ['*'],
      }),
    );

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:ListBucket'],
        resources: [`arn:aws:s3:::${props.workerEnv.DATA_BUCKET}`],
      }),
    );

    taskRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`arn:aws:s3:::${props.workerEnv.DATA_BUCKET}/*`],
      }),
    );

    // Bind-mount the host Docker socket so the worker can launch user-code containers via Dockerode.
    this.taskDefinition.addVolume({
      name: 'docker-sock',
      host: { sourcePath: '/var/run/docker.sock' },
    });

    // Bind-mount the runner-jobs scratch directory so that inner containers spawned via the
    // host Docker socket can resolve the same path. When Dockerode passes a Binds path to the
    // host daemon, the host looks up that path on its own filesystem — not inside the ECS
    // container. Mapping the same host path into the container keeps the two in sync.
    this.taskDefinition.addVolume({
      name: 'runner-jobs',
      host: { sourcePath: '/tmp/runner-jobs' },
    });

    const container = this.taskDefinition.addContainer('WorkerContainer', {
      environment: {
        // SUBMISSION_ID is injected via container overrides by the dispatcher Lambda at launch time.
        ALPHA_VANTAGE_API_KEY: props.workerEnv.ALPHA_VANTAGE_API_KEY,
        AWS_REGION: cdk.Stack.of(this).region,
        DATA_BUCKET: props.workerEnv.DATA_BUCKET,
        DATABASE_URL: props.workerEnv.DATABASE_URL,
        ECR_REGISTRY: `${cdk.Aws.ACCOUNT_ID}.dkr.ecr.${cdk.Aws.REGION}.amazonaws.com`,
        NODE_ENV: props.workerEnv.NODE_ENV,
      },
      image: ecs.ContainerImage.fromEcrRepository(
        props.workerImageRepo,
        props.imageTag ?? 'latest',
      ),
      logging: ecs.LogDrivers.awsLogs({ logGroup, streamPrefix: 'worker' }),
      memoryReservationMiB: 1024,
      privileged: true,
    });

    container.addMountPoints({
      containerPath: '/var/run/docker.sock',
      readOnly: false,
      sourceVolume: 'docker-sock',
    });

    container.addMountPoints({
      containerPath: '/tmp/runner-jobs',
      readOnly: false,
      sourceVolume: 'runner-jobs',
    });
  }
}
