import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { PNPM_VERSION } from './pnpm-version.js';

/** Paths under `codeRoot` (must be `web-app/`: siblings `api/` + `shared/`). */
export type FormulusApiBundlingPaths = {
  /** Directory under `codeRoot` with `package.json` + `esbuild.lambda.config.mjs` (default `api`). */
  apiPackagePath?: string;
  /** Directory under `codeRoot` with `prisma/schema.prisma` and generated client (default `shared`). */
  sharedPackagePath?: string;
  /** Appended after the Lambda asset is assembled under `/asset-output`. */
  bundlingPostCommand?: string;
};

export const defaultApiCorsHeaders = [
  'Content-Type',
  'Authorization',
  'Cookie',
  'X-Requested-With',
  'Accept',
  'Origin',
  'Referer',
  'User-Agent',
  'X-Amz-Date',
  'X-Api-Key',
  'X-Amz-Security-Token',
  'X-Amz-User-Agent',
];

/**
 * Docker bundling script for the API Lambda. `codeRoot` must be **`web-app/`** so the container
 * sees **`api/`** and **`shared/`** as siblings (`api` imports `@shared/*`; Prisma uses `shared/prisma`).
 *
 * Prisma: temporarily patch `binaryTargets` to Linux-only for this image, then restore schema (trap).
 * Runtime deps: `install-lambda-runtime-deps.mjs` installs only `pg` + `@prisma/client` without editing
 * api/package.json or pnpm-lock.yaml (avoids CI frozen-lockfile errors).
 */
export function formulusApiLambdaBundlingShell(
  paths: FormulusApiBundlingPaths = {},
): string {
  const apiRel = paths.apiPackagePath ?? 'api';
  const sharedRel = paths.sharedPackagePath ?? 'shared';
  const apiDir = `/asset-input/${apiRel}`;
  const sharedDir = `/asset-input/${sharedRel}`;
  const parts = [
    'set -euo pipefail',
    'export CI=1',
    `rm -rf ${apiDir}/node_modules ${sharedDir}/node_modules ${apiDir}/.lambda-runtime-deps`,
    'corepack enable',
    `corepack prepare pnpm@${PNPM_VERSION} --activate`,
    `cd ${apiDir}`,
    'pnpm install --frozen-lockfile --config.node-linker=hoisted',
    `trap 'mv -f ${sharedDir}/prisma/schema.prisma.bak ${sharedDir}/prisma/schema.prisma 2>/dev/null || true' EXIT`,
    `cp ${sharedDir}/prisma/schema.prisma ${sharedDir}/prisma/schema.prisma.bak`,
    `sed -i 's|binaryTargets = \\["native", "rhel-openssl-3.0.x"\\]|binaryTargets = ["rhel-openssl-3.0.x"]|' ${sharedDir}/prisma/schema.prisma`,
    `pnpm exec prisma generate --schema=../${sharedRel}/prisma/schema.prisma`,
    'node esbuild.lambda.config.mjs',
    'node scripts/install-lambda-runtime-deps.mjs',
    'cp dist/lambda.js /asset-output/',
    'if [ -f dist/lambda.js.map ]; then cp dist/lambda.js.map /asset-output/; fi',
    // `esbuild.lambda.config.mjs` emits ESM; Lambda loads handler from `lambda.js` as ESM when type is module.
    `node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));const d=p.dependencies||{};fs.writeFileSync('/asset-output/package.json',JSON.stringify({name:'api',private:true,type:'module',dependencies:{'@prisma/client':d['@prisma/client'],pg:d.pg}},null,2));"`,
    'cp -rL node_modules /asset-output/',
  ];
  const post = paths.bundlingPostCommand;
  if (post != null && post.trim() !== '') {
    parts.push(post.trim());
  }
  return parts.join(' && ');
}

export type ApiGatewayStackProps = cdk.StackProps & {
  /**
   * Asset root mounted at `/asset-input` in the bundling container. Must be **`web-app/`** so
   * **`api/`** and **`shared/`** exist as siblings (API imports `@shared/*`, Prisma schema under `shared/prisma`).
   */
  codeRoot: string;
  /** Docker bundling command (e.g. `['bash', '-c', formulusApiLambdaBundlingShell()]`) */
  bundlingCommand: string[];
  corsHeaders: string[];
  corsOrigins: string[];
  /** Same keys as `web-app/api` `.env` (plus CDK-injected `QUEUE_URL`). */
  lambdaEnvironment: Record<string, string>;
  backtestQueueArn: string;
  handler: string;
  /** When set with `subDomain`, provisions ACM + custom domain + Route53 alias. */
  domainName?: string;
  subDomain?: string;
  /** API Gateway name in AWS console (unique per account/region). */
  restApiDisplayName?: string;
  /** API Gateway stage name (default `prod`). */
  stageName?: string;
  lambdaMemorySize?: number;
  lambdaTimeout?: cdk.Duration;
};

export class ApiGatewayStack extends cdk.Stack {
  readonly api: apigateway.RestApi;
  readonly apiFunction: lambda.IFunction;
  readonly apiUrl: string;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    const stageName = props.stageName ?? 'prod';
    const allowWildcardOrigin = props.corsOrigins.includes('*');

    const databaseUrl = process.env['DATABASE_URL']?.trim();
    if (databaseUrl == null || databaseUrl === '') {
      throw new Error(
        'DATABASE_URL must be set when synthesizing or deploying the API stack (Prisma runs during Lambda asset bundling). On CI, ensure the deploy job sets DATABASE_URL (e.g. from secrets). Locally, set it in the environment or web-app/infra/.env before running CDK.',
      );
    }

    const apiFunction = new lambda.Function(this, `${id}-lambda-function`, {
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: props.handler,
      code: lambda.Code.fromAsset(props.codeRoot, {
        bundling: {
          image: lambda.Runtime.NODEJS_24_X.bundlingImage,
          user: 'root',
          command: props.bundlingCommand,
          environment: {
            DATABASE_URL: databaseUrl,
          },
        },
      }),
      environment: props.lambdaEnvironment,
      memorySize: props.lambdaMemorySize ?? 1024,
      timeout: props.lambdaTimeout ?? cdk.Duration.seconds(29),
      logGroup: new logs.LogGroup(this, `${id}-api-logs`, {
        retention: logs.RetentionDays.ONE_WEEK,
      }),
    });

    apiFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['sqs:SendMessage'],
        resources: [props.backtestQueueArn],
      }),
    );

    this.apiFunction = apiFunction;

    const restApiName = props.restApiDisplayName ?? 'formulus-api';

    this.api = new apigateway.RestApi(this, `${id}-api`, {
      restApiName,
      description: `Formulus API (REST) - ${restApiName}`,
      defaultCorsPreflightOptions: {
        allowOrigins: props.corsOrigins,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: props.corsHeaders,
        allowCredentials: !allowWildcardOrigin,
      },
      deployOptions: {
        stageName,
      },
    });

    const lambdaIntegration = new apigateway.LambdaIntegration(apiFunction);

    this.api.root.addMethod('ANY', lambdaIntegration);
    const proxy = this.api.root.addResource('{proxy+}');
    proxy.addMethod('ANY', lambdaIntegration);

    if (props.domainName != null && props.subDomain != null) {
      const fqdn = `${props.subDomain}.${props.domainName}`;
      const hostedZone = route53.HostedZone.fromLookup(this, `${id}-hosted-zone`, {
        domainName: props.domainName,
      });
      const certificate = new certificatemanager.Certificate(this, `${id}-certificate`, {
        domainName: fqdn,
        validation: certificatemanager.CertificateValidation.fromDns(hostedZone),
      });
      const customDomain = new apigateway.DomainName(this, `${id}-domain`, {
        domainName: fqdn,
        certificate,
        securityPolicy: apigateway.SecurityPolicy.TLS_1_2,
      });
      customDomain.addApiMapping(this.api.deploymentStage, { basePath: '' });
      new route53.ARecord(this, `${id}-alias-record`, {
        zone: hostedZone,
        recordName: props.subDomain,
        target: route53.RecordTarget.fromAlias(new route53targets.ApiGatewayDomain(customDomain)),
      });
      this.apiUrl = `https://${fqdn}`;
    } else {
      this.apiUrl = this.api.url;
    }

    new cdk.CfnOutput(this, `${id}-api-url`, {
      value: this.apiUrl,
      description: 'Public API base URL (append /trpc for tRPC HTTP adapter)',
    });

    new cdk.CfnOutput(this, `${id}-api-id`, {
      value: this.api.restApiId,
      description: 'API Gateway REST API ID',
    });
  }
}
