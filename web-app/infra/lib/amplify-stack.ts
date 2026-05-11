import { App, CustomRule, GitHubSourceCodeProvider, Platform } from '@aws-cdk/aws-amplify-alpha';
import * as cdk from 'aws-cdk-lib';
import { SecretValue } from 'aws-cdk-lib';
import { BuildSpec } from 'aws-cdk-lib/aws-codebuild';
import { ManagedPolicy, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export interface AmplifyStackProps extends cdk.StackProps {
  viteServerUrl: string;
  repositoryOwner: string;
  repositoryName: string;
  patGithub: string;
  branchName: string;
}

export class AmplifyStack extends cdk.Stack {
  readonly amplifyApp: App;

  constructor(scope: Construct, id: string, props: AmplifyStackProps) {
    super(scope, id, props);

    const role = new Role(this, 'AmplifyRole', {
      assumedBy: new ServicePrincipal('amplify.amazonaws.com'),
      managedPolicies: [ManagedPolicy.fromAwsManagedPolicyName('AdministratorAccess-Amplify')],
    });

    this.amplifyApp = new App(this, 'Web', {
      appName: 'formulus-web',
      description: 'Formulus Vite client (Amplify Hosting)',
      role,
      platform: Platform.WEB,
      sourceCodeProvider: new GitHubSourceCodeProvider({
        oauthToken: SecretValue.unsafePlainText(props.patGithub),
        owner: props.repositoryOwner,
        repository: props.repositoryName,
      }),
      environmentVariables: {
        AMPLIFY_MONOREPO_APP_ROOT: 'web-app/client',
        VITE_SERVER_URL: props.viteServerUrl,
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
      customRules: [CustomRule.SINGLE_PAGE_APPLICATION_REDIRECT],
      buildSpec: BuildSpec.fromObjectToYaml({
        version: '1.0',
        applications: [
          {
            appRoot: 'web-app/client',
            frontend: {
              phases: {
                preBuild: {
                  commands: [
                    'corepack enable',
                    'corepack prepare pnpm@9.15.4 --activate',
                    'cd ../shared && pnpm install --frozen-lockfile',
                    'cd ../api && pnpm install --frozen-lockfile',
                    'cd ../api && pnpm run prisma:generate',
                    'cd ../worker && pnpm install --frozen-lockfile',
                    'cd ../client && pnpm install --frozen-lockfile',
                  ],
                },
                build: {
                  commands: ['pnpm run build'],
                },
              },
              artifacts: {
                baseDirectory: 'dist',
                files: ['**/*'],
              },
              cache: {
                paths: ['node_modules/**/*'],
              },
            },
          },
        ],
      }),
    });

    const branch = this.amplifyApp.addBranch('ProdBranch', {
      branchName: props.branchName,
      autoBuild: false,
    });
    branch.node.addDependency(this.amplifyApp);

    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value: this.amplifyApp.appId,
      description: 'Amplify app ID (used by CI to trigger builds)',
      exportName: 'FormulusAmplifyAppId',
    });
  }
}
