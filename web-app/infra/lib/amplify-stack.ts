import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as cdk from 'aws-cdk-lib';
import type { Construct } from 'constructs';

export interface AmplifyStackProps extends cdk.StackProps {
  viteServerUrl: string;
  branchName: string;
  domainName: string;
  subDomain: string;
  /** Map the root domain (formulus.ai) to this branch. */
  mapRootDomain?: boolean;
}

export class AmplifyStack extends cdk.Stack {
  readonly app: amplify.CfnApp;

  constructor(scope: Construct, id: string, props: AmplifyStackProps) {
    super(scope, id, props);

    this.app = new amplify.CfnApp(this, 'Web', {
      name: `formulus-web-${props.branchName}`,
      description: `Formulus Vite client (${props.branchName})`,
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

    const branch = new amplify.CfnBranch(this, 'Branch', {
      appId: this.app.attrAppId,
      branchName: props.branchName,
      enableAutoBuild: false,
      stage: 'PRODUCTION',
    });

    const subDomainSettings: amplify.CfnDomain.SubDomainSettingProperty[] = [
      { branchName: props.branchName, prefix: props.subDomain },
    ];
    if (props.mapRootDomain) {
      subDomainSettings.push({ branchName: props.branchName, prefix: '' });
    }

    const domain = new amplify.CfnDomain(this, 'Domain', {
      appId: this.app.attrAppId,
      domainName: props.domainName,
      subDomainSettings,
      enableAutoSubDomain: false,
    });
    domain.addDependency(branch);

    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value: this.app.attrAppId,
      description: 'Amplify app ID (used by CI to trigger deployments)',
    });
  }
}
