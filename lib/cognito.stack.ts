import { join } from "path";
import { Construct } from "constructs";
import * as cdk from "aws-cdk-lib";
import { CfnUserPoolGroup, UserPool, UserPoolOperation } from "aws-cdk-lib/aws-cognito";
import { Function, Runtime, Code, LayerVersion } from "aws-cdk-lib/aws-lambda";
import { ServicePrincipal, PolicyStatement } from "aws-cdk-lib/aws-iam";

export class CognitoStack extends cdk.Stack {
  private readonly layer: LayerVersion;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    this.layer = this.createLayer();

    const userPool = this.createUserPool();
    const [
      defineAuthChallengeLambda,
      createAuthChallengeLambda,
      verifyAuthChallengeResponseLambda,
      preSignUpLambda,
    ] = this.createCustomChallengeLambdas();
    userPool.addTrigger(
      UserPoolOperation.CREATE_AUTH_CHALLENGE,
      createAuthChallengeLambda
    );
    userPool.addTrigger(
      UserPoolOperation.DEFINE_AUTH_CHALLENGE,
      defineAuthChallengeLambda
    );
    userPool.addTrigger(
      UserPoolOperation.VERIFY_AUTH_CHALLENGE_RESPONSE,
      verifyAuthChallengeResponseLambda
    );
    userPool.addTrigger(UserPoolOperation.PRE_SIGN_UP, preSignUpLambda);

    new CfnUserPoolGroup(this, "AdminGroup", {
      groupName: "Admin",
      userPoolId: userPool.userPoolId,
    });
    new CfnUserPoolGroup(this, "UserGroup", {
      groupName: "User",
      userPoolId: userPool.userPoolId,
    });
  }

  private createLayer(): LayerVersion {
    return new LayerVersion(this, "cognito-lambda-layer", {
      code: Code.fromAsset(join(__dirname, "layers/sms-libs")),
      compatibleRuntimes: [Runtime.NODEJS_18_X],
      description: "SMS libs for cognito",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
  }

  private createUserPool(): UserPool {
    const userPool = new UserPool(this, "cognito-user-pool", {
      userPoolName: "CognitoUserPool",
      selfSignUpEnabled: true,
      signInAliases: {
        phone: true,
        preferredUsername: true,
        username: true
      },
      autoVerify: {
        phone: true,
      },
      standardAttributes: {
        familyName: {
          required: true,
          mutable: true,
        },
        givenName: {
          required: true,
          mutable: true,
        },
        gender: {
          required: true,
          mutable: true,
        },
        birthdate: {
          required: true,
          mutable: true,
        },
        phoneNumber: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        "famliyNameKana": new cdk.aws_cognito.StringAttribute(),
        "givenNameKana": new cdk.aws_cognito.StringAttribute(),
      },
      accountRecovery: cdk.aws_cognito.AccountRecovery.NONE,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const mobileClient = userPool.addClient("cognito-user-pool-mobile-client", {
      userPoolClientName: "CognitoUserPoolMobileClient",
      authFlows: {
        custom: true,
      },
      accessTokenValidity: cdk.Duration.days(1),
      idTokenValidity: cdk.Duration.days(1),
      refreshTokenValidity: cdk.Duration.days(3650),
    });

    const webClient = userPool.addClient("cognito-user-pool-web-client", {
      userPoolClientName: "CognitoUserPoolWebClient",
      authFlows: {
        userSrp: true,
      },
      preventUserExistenceErrors: true,
      accessTokenValidity: cdk.Duration.days(1),
      idTokenValidity: cdk.Duration.days(1),
      refreshTokenValidity: cdk.Duration.days(3650),
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.userPoolId,
    });
    new cdk.CfnOutput(this, "UserPoolMobileClientId", {
      value: mobileClient.userPoolClientId,
    });
    new cdk.CfnOutput(this, "UserPoolWebClientId", {
      value: webClient.userPoolClientId,
    });

    return userPool;
  }

  private createCustomChallengeLambdas(): Function[] {
    const defineAuthChallengeLambda = new Function(
      this,
      "defineAuthChallengeLambda",
      {
        runtime: Runtime.NODEJS_18_X,
        handler: "index.handler",
        code: Code.fromAsset(join(__dirname, "lambdas/define-auth-challenge")),
      }
    );
    const createAuthChallengeLambda = new Function(
      this,
      "createAuthChallengeLambda",
      {
        runtime: Runtime.NODEJS_18_X,
        handler: "index.handler",
        code: Code.fromAsset(join(__dirname, "lambdas/create-auth-challenge")),
        layers: [this.layer]
      }
    );
    const verifyAuthChallengeResponseLambda = new Function(
      this,
      "verifyAuthChallengeResponseLambda",
      {
        runtime: Runtime.NODEJS_18_X,
        handler: "index.handler",
        code: Code.fromAsset(
          join(__dirname, "lambdas/verify-auth-challenge-response")
        ),
      }
    );
    const preSignUpLambda = new Function(this, "preSignUpLambda", {
      runtime: Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: Code.fromAsset(join(__dirname, "lambdas/pre-sign-up")),
    });
    CognitoStack.grantLambdaInvokePermission(
      defineAuthChallengeLambda,
      "defineAuthChallengeLambda"
    );
    CognitoStack.grantLambdaInvokePermission(
      createAuthChallengeLambda,
      "createAuthChallengeLambda"
    );
    CognitoStack.grantLambdaInvokePermission(
      verifyAuthChallengeResponseLambda,
      "verifyAuthChallengeResponseLambda"
    );
    CognitoStack.grantLambdaInvokePermission(
      preSignUpLambda,
      "preSignUpLambda"
    );
    const snsPublishPolicy = new PolicyStatement({
      actions: ["sns:Publish"],
      resources: ["*"],
    })
    createAuthChallengeLambda.addToRolePolicy(snsPublishPolicy);
    return [
      defineAuthChallengeLambda,
      createAuthChallengeLambda,
      verifyAuthChallengeResponseLambda,
      preSignUpLambda,
    ];
  }

  private static grantLambdaInvokePermission(lambda: Function, alias: string) {
    lambda.addPermission(`cognito-cognito-invoke-permission-${alias}`, {
      principal: new ServicePrincipal("cognito-idp.amazonaws.com"),
      action: "lambda:InvokeFunction",
    });
  }
}
