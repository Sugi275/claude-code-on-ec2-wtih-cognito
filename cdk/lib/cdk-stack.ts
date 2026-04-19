import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";

import * as cr from "aws-cdk-lib/custom-resources";

export interface CodeServerStackProps extends cdk.StackProps {
  userName: string;
  email: string;
  vpc: ec2.Vpc;
  instanceType?: string;
}

export class CodeServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CodeServerStackProps) {
    super(scope, id, props);

    const { userName, email, vpc, instanceType = "t3.large" } = props;
    const ssmPrefix = `/codeserver/${userName}`;

    // --- Security Group (CloudFront origin-facing IPs only) ---
    const sg = new ec2.SecurityGroup(this, "Sg", {
      vpc,
      allowAllOutbound: true,
    });
    const cfPrefixList = ec2.Peer.prefixList(
      ec2.PrefixList.fromPrefixListId(
        this,
        "CloudFrontPL",
        "pl-58a04531"
      ).prefixListId
    );
    sg.addIngressRule(cfPrefixList, ec2.Port.tcp(8080), "CloudFront only");

    // --- Cognito ---
    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: `codeserver-${userName}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      mfa: cognito.Mfa.REQUIRED,
      mfaSecondFactor: { sms: false, otp: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.NONE,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      userInvitation: {
        emailSubject: "【Claude Code】開発環境のご案内",
        emailBody:
          "Claude Code 開発環境をご利用いただけるようになりました。<br><br>" +
          "以下の情報でログインしてください。<br><br>" +
          "メールアドレス: {username}<br>" +
          "仮パスワード: {####}<br><br>" +
          "ログイン URL は管理者からお知らせします。<br><br>" +
          "初回ログイン時にパスワードの変更と、認証アプリ (Google Authenticator, Authy 等) による MFA の設定が必要です。",
      },
    });

    const cfnUserPool = userPool.node.defaultChild as cognito.CfnUserPool;
    cfnUserPool.addPropertyOverride("UserPoolTier", "ESSENTIALS");

    const domainPrefix = `codeserver-${userName}-${cdk.Aws.ACCOUNT_ID}`;
    const domain = userPool.addDomain("Domain", {
      cognitoDomain: { domainPrefix },
    });
    const cfnDomain = domain.node.defaultChild as cognito.CfnUserPoolDomain;
    cfnDomain.addPropertyOverride("ManagedLoginVersion", 2);

    const userPoolClient = userPool.addClient("Client", {
      userPoolClientName: `codeserver-${userName}-client`,
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        callbackUrls: ["https://placeholder.cloudfront.net"],
        logoutUrls: ["https://placeholder.cloudfront.net"],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
    });

    new cognito.CfnManagedLoginBranding(this, "ManagedLoginBranding", {
      userPoolId: userPool.userPoolId,
      clientId: userPoolClient.userPoolClientId,
      useCognitoProvidedValues: true,
    });

    // --- SSM Parameters (Lambda@Edge reads at cold start) ---
    new ssm.StringParameter(this, "ParamPoolId", {
      parameterName: `${ssmPrefix}/userPoolId`,
      stringValue: userPool.userPoolId,
    });
    new ssm.StringParameter(this, "ParamClientId", {
      parameterName: `${ssmPrefix}/clientId`,
      stringValue: userPoolClient.userPoolClientId,
    });
    new ssm.StringParameter(this, "ParamDomain", {
      parameterName: `${ssmPrefix}/domain`,
      stringValue: `${domainPrefix}.auth.ap-northeast-1.amazoncognito.com`,
    });

    // --- EC2 (Public Subnet, SG restricted to CloudFront IPs) ---
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      "set -ex",
      "export HOME=/root",
      "apt-get update -y",
      // code-server
      "curl -fsSL https://code-server.dev/install.sh | sh",
      "mkdir -p /home/ubuntu/.config/code-server",
      'cat > /home/ubuntu/.config/code-server/config.yaml << EOF',
      "bind-addr: 0.0.0.0:8080",
      "auth: none",
      "cert: false",
      "EOF",
      "chown -R ubuntu:ubuntu /home/ubuntu/.config",
      "systemctl enable --now code-server@ubuntu",
      // Claude Code
      "su - ubuntu -c 'curl -fsSL https://claude.ai/install.sh | bash'",
      "su - ubuntu -c 'mkdir -p ~/claudecode'",
      // Bedrock test invoke to trigger Marketplace subscription
      `echo '{"anthropic_version":"bedrock-2023-05-31","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}' > /tmp/bedrock-body.json`,
      `for MODEL in us.anthropic.claude-sonnet-4-6 us.anthropic.claude-opus-4-7 us.anthropic.claude-opus-4-6-v1 us.anthropic.claude-haiku-4-5-20251001-v1:0; do echo "Invoking $MODEL (us-east-1)..." && aws bedrock-runtime invoke-model --model-id "$MODEL" --region us-east-1 --body fileb:///tmp/bedrock-body.json --content-type application/json --accept application/json /dev/null 2>&1 || true; done`,
      `for MODEL in global.anthropic.claude-sonnet-4-6 global.anthropic.claude-opus-4-7 global.anthropic.claude-opus-4-6-v1 global.anthropic.claude-haiku-4-5-20251001-v1:0; do echo "Invoking $MODEL (us-east-1)..." && aws bedrock-runtime invoke-model --model-id "$MODEL" --region us-east-1 --body fileb:///tmp/bedrock-body.json --content-type application/json --accept application/json /dev/null 2>&1 || true; done`
    );

    const instance = new ec2.Instance(this, "Instance", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: new ec2.InstanceType(instanceType),
      machineImage: ec2.MachineImage.fromSsmParameter(
        "/aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id"
      ),
      securityGroup: sg,
      userData,
      blockDevices: [
        {
          deviceName: "/dev/sda1",
          volume: ec2.BlockDeviceVolume.ebs(30, {
            volumeType: ec2.EbsDeviceVolumeType.GP3,
          }),
        },
      ],
    });

    instance.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")
    );

    // Bedrock permissions for Claude Code
    instance.role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        sid: "AllowModelAndInferenceProfileAccess",
        actions: [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream",
          "bedrock:ListInferenceProfiles",
        ],
        resources: [
          "arn:aws:bedrock:*:*:inference-profile/*",
          "arn:aws:bedrock:*:*:application-inference-profile/*",
          "arn:aws:bedrock:*:*:foundation-model/*",
        ],
      })
    );
    instance.role.addToPrincipalPolicy(
      new iam.PolicyStatement({
        sid: "AllowMarketplaceSubscription",
        actions: [
          "aws-marketplace:ViewSubscriptions",
          "aws-marketplace:Subscribe",
        ],
        resources: ["*"],
        conditions: {
          StringEquals: {
            "aws:CalledViaLast": "bedrock.amazonaws.com",
          },
        },
      })
    );

    // --- Lambda@Edge (Viewer Request) ---
    const lambdaSrcDir = path.join(__dirname, "../lambda/auth");
    const entryPoint = path.join(lambdaSrcDir, "index.js");

    const edgeFn = new cloudfront.experimental.EdgeFunction(this, "AuthFn", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "index.handler",
      timeout: cdk.Duration.seconds(5),
      code: lambda.Code.fromAsset(lambdaSrcDir, {
        assetHashType: cdk.AssetHashType.CUSTOM,
        assetHash: `auth-${userName}-v2`,
        bundling: {
          image: lambda.Runtime.NODEJS_20_X.bundlingImage,
          command: ["bash", "-c", "echo docker"],
          local: {
            tryBundle(outputDir: string): boolean {
              const outFile = path.join(outputDir, "index.js");
              execSync(
                `npx esbuild ${entryPoint} --bundle --platform=node --target=node20 --minify --outfile=${outFile}`,
                { stdio: "inherit" }
              );
              let code = fs.readFileSync(outFile, "utf-8");
              code = code.replace(/\{\{SSM_PREFIX\}\}/g, ssmPrefix);
              fs.writeFileSync(outFile, code);
              return true;
            },
          },
        },
      }),
      stackId: `EdgeAuth-${userName}`,
    });

    edgeFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          `arn:aws:ssm:ap-northeast-1:${cdk.Aws.ACCOUNT_ID}:parameter${ssmPrefix}/*`,
        ],
      })
    );

    // --- CloudFront ---
    const distribution = new cloudfront.Distribution(this, "Dist", {
      errorResponses: [
        { httpStatus: 502, ttl: cdk.Duration.seconds(0) },
        { httpStatus: 503, ttl: cdk.Duration.seconds(0) },
        { httpStatus: 504, ttl: cdk.Duration.seconds(0) },
      ],
      defaultBehavior: {
        origin: new origins.HttpOrigin(instance.instancePublicDnsName, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          httpPort: 8080,
        }),
        viewerProtocolPolicy:
          cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        edgeLambdas: [
          {
            functionVersion: edgeFn.currentVersion,
            eventType: cloudfront.LambdaEdgeEventType.VIEWER_REQUEST,
          },
        ],
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
      },
    });

    // Fix Cognito callback URLs to actual CloudFront domain
    const cfnClient =
      userPoolClient.node.defaultChild as cognito.CfnUserPoolClient;
    cfnClient.callbackUrLs = [
      `https://${distribution.distributionDomainName}`,
    ];
    cfnClient.logoutUrLs = [
      `https://${distribution.distributionDomainName}`,
    ];

    // --- Cognito User (auto-created on deploy) ---
    new cr.AwsCustomResource(this, "CognitoUser", {
      onCreate: {
        service: "CognitoIdentityServiceProvider",
        action: "adminCreateUser",
        parameters: {
          UserPoolId: userPool.userPoolId,
          Username: email,
          UserAttributes: [
            { Name: "email", Value: email },
            { Name: "email_verified", Value: "true" },
          ],
          TemporaryPassword: "TempPass1!",
        },
        physicalResourceId: cr.PhysicalResourceId.of(`cognito-user-${userName}`),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ["cognito-idp:AdminCreateUser"],
          resources: [userPool.userPoolArn],
        }),
      ]),
    });

    // --- Outputs ---
    new cdk.CfnOutput(this, "CloudFrontUrl", {
      value: `https://${distribution.distributionDomainName}`,
      description: "code-server URL",
    });
    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });
  }
}
