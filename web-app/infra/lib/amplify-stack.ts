import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as cdk from 'aws-cdk-lib';
import type { Construct } from 'constructs';

export interface AmplifyStackProps extends cdk.StackProps {
  viteServerUrl: string;
  branchName: string;
}

export class AmplifyStack extends cdk.Stack {
  readonly app: amplify.CfnApp;

  constructor(scope: Construct, id: string, props: AmplifyStackProps) {
    super(scope, id, props);

    this.app = new amplify.CfnApp(this, 'Web', {
      name: 'formulus-web',
      description: 'Formulus Vite client (Amplify Hosting)',
      platform: 'WEB',
      environmentVariables: [
        { name: 'VITE_SERVER_URL', value: props.viteServerUrl },
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
      branchName: props.branchName,
      enableAutoBuild: false,
      stage: 'PRODUCTION',
    });

    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value: this.app.attrAppId,
      description: 'Amplify app ID (used by CI to trigger deployments)',
      exportName: 'FormulusAmplifyAppId',
    });
  }
}
