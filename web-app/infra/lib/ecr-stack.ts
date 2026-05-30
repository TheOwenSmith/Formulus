import * as cdk from 'aws-cdk-lib';
import * as ecr from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

export class EcrStack extends cdk.Stack {
  readonly workerRepo: ecr.Repository;
  readonly typescriptRunnerRepo: ecr.Repository;
  readonly cppRunnerRepo: ecr.Repository;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.workerRepo = new ecr.Repository(this, 'WorkerRepo', {
      repositoryName: 'formulus-worker',
      imageScanOnPush: true,
      encryption: ecr.RepositoryEncryption.AES_256,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.typescriptRunnerRepo = new ecr.Repository(this, 'TypescriptRunnerRepo', {
      repositoryName: 'formulus-runner-typescript',
      imageScanOnPush: true,
      encryption: ecr.RepositoryEncryption.AES_256,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.cppRunnerRepo = new ecr.Repository(this, 'CppRunnerRepo', {
      repositoryName: 'formulus-runner-cpp',
      imageScanOnPush: true,
      encryption: ecr.RepositoryEncryption.AES_256,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });
  }
}

