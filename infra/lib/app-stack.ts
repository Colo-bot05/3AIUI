import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import * as apprunner from "aws-cdk-lib/aws-apprunner";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";

export interface AppStackProps extends StackProps {
  vpc: ec2.Vpc;
  dbInstance: rds.DatabaseInstance;
  dbSecret: secretsmanager.Secret;
  appConnectorSg: ec2.SecurityGroup;
}

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const ecrRepo = new ecr.Repository(this, "EcrRepo", {
      repositoryName: "3aiui",
      imageScanOnPush: true,
    });

    const anthropicSecret = new secretsmanager.Secret(this, "AnthropicSecret", {
      secretName: "3aiui/anthropic-api-key",
      description:
        "Anthropic API key consumed by the meeting provider. Value is blank on first deploy — set with `aws secretsmanager put-secret-value` afterwards.",
    });

    // VPC connector security group is created in DbStack so RDS can allow
    // ingress from it without a circular dependency.
    const vpcConnector = new apprunner.CfnVpcConnector(this, "VpcConnector", {
      vpcConnectorName: "3aiui-connector",
      subnets: props.vpc
        .selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS })
        .subnetIds,
      securityGroups: [props.appConnectorSg.securityGroupId],
    });

    const accessRole = new iam.Role(this, "AccessRole", {
      assumedBy: new iam.ServicePrincipal("build.apprunner.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSAppRunnerServicePolicyForECRAccess",
        ),
      ],
    });

    const instanceRole = new iam.Role(this, "InstanceRole", {
      assumedBy: new iam.ServicePrincipal("tasks.apprunner.amazonaws.com"),
    });
    props.dbSecret.grantRead(instanceRole);
    anthropicSecret.grantRead(instanceRole);

    const service = new apprunner.CfnService(this, "Service", {
      serviceName: "3aiui",
      sourceConfiguration: {
        autoDeploymentsEnabled: true,
        authenticationConfiguration: { accessRoleArn: accessRole.roleArn },
        imageRepository: {
          imageIdentifier: `${ecrRepo.repositoryUri}:latest`,
          imageRepositoryType: "ECR",
          imageConfiguration: {
            port: "3000",
            runtimeEnvironmentVariables: [
              { name: "APP_ENV", value: "production" },
              { name: "MEETING_PROVIDER", value: "anthropic" },
              { name: "PORT", value: "3000" },
            ],
            runtimeEnvironmentSecrets: [
              { name: "ANTHROPIC_API_KEY", value: anthropicSecret.secretArn },
              {
                name: "DB_HOST",
                value: `${props.dbSecret.secretArn}:host::`,
              },
              {
                name: "DB_PORT",
                value: `${props.dbSecret.secretArn}:port::`,
              },
              {
                name: "DB_USER",
                value: `${props.dbSecret.secretArn}:username::`,
              },
              {
                name: "DB_PASSWORD",
                value: `${props.dbSecret.secretArn}:password::`,
              },
              {
                name: "DB_NAME",
                value: `${props.dbSecret.secretArn}:dbname::`,
              },
            ],
          },
        },
      },
      instanceConfiguration: {
        cpu: "0.25 vCPU",
        memory: "0.5 GB",
        instanceRoleArn: instanceRole.roleArn,
      },
      networkConfiguration: {
        egressConfiguration: {
          egressType: "VPC",
          vpcConnectorArn: vpcConnector.attrVpcConnectorArn,
        },
      },
      healthCheckConfiguration: {
        protocol: "TCP",
        interval: 10,
        timeout: 5,
        healthyThreshold: 1,
        unhealthyThreshold: 5,
      },
    });

    new CfnOutput(this, "EcrRepositoryUri", { value: ecrRepo.repositoryUri });
    new CfnOutput(this, "AppRunnerServiceUrl", {
      value: service.attrServiceUrl,
    });
    new CfnOutput(this, "AnthropicSecretArn", {
      value: anthropicSecret.secretArn,
    });
    new CfnOutput(this, "DbSecretArn", { value: props.dbSecret.secretArn });
  }
}
