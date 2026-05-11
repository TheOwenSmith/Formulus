import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export type AmplifyStackProps = cdk.StackProps & {
  /** Full tRPC HTTP URL, e.g. `https://xxx.execute-api.region.amazonaws.com/trpc` */
  viteServerUrl: string;
  /** Optional Git repository URL (HTTPS). If omitted, connect a repo in the Amplify console. */
  repository?: string;
  /** GitHub / GitLab OAuth or personal access token for cloning `repository`. */
  accessToken?: string;
};

export class AmplifyStack extends cdk.Stack {
  readonly app: amplify.CfnApp;

  constructor(scope: Construct, id: string, props: AmplifyStackProps) {
    super(scope, id, props);

    const buildSpec = [
      'version: 1',
      'frontend:',
      '  phases:',
      '    preBuild:',
      '      commands:',
      '        - corepack enable',
      '        - cd web-app/client && pnpm install --frozen-lockfile',
      '    build:',
      '      commands:',
      '        - cd web-app/client && pnpm run build',
      '  artifacts:',
      '    baseDirectory: web-app/client/dist',
      '    files:',
      '      - "**/*"',
      '  cache:',
      '    paths:',
      '      - web-app/client/node_modules/**/*',
    ].join('\n');

    this.app = new amplify.CfnApp(this, 'Web', {
      name: 'formulus-web',
      description: 'Formulus Vite client (Amplify Hosting)',
      platform: 'WEB',
      buildSpec,
      ...(props.repository != null && props.repository !== ''
        ? { oauthToken: props.accessToken, repository: props.repository }
        : {}),
      environmentVariables: [
        { name: 'VITE_SERVER_URL', value: props.viteServerUrl },
        { name: 'NODE_OPTIONS', value: '--max-old-space-size=4096' },
      ],
      customRules: [
        {
          source: '/<*>',
          target: '/index.html',
          status: '404-200',
        },
      ],
    });

    new amplify.CfnBranch(this, 'ProdBranch', {
      appId: this.app.attrAppId,
      branchName: 'client-prod',
      enableAutoBuild: false,
      stage: 'PRODUCTION',
    });

    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value: this.app.attrAppId,
      description: 'Amplify app ID (used by CI to trigger builds)',
      exportName: 'FormulusAmplifyAppId',
    });
  }
}
