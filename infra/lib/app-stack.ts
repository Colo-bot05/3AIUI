import { CfnOutput, Stack, type StackProps } from "aws-cdk-lib";
import * as apprunner from "aws-cdk-lib/aws-apprunner";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";

export interface AppStackProps extends StackProps {
  ecrRepo: ecr.IRepository;
  anthropicSecret: secretsmanager.ISecret;
  dbSecret: secretsmanager.ISecret;
  vpcConnector: apprunner.CfnVpcConnector;
  accessRole: iam.IRole;
  instanceRole: iam.IRole;
}

export class AppStack extends Stack {
  constructor(scope: Construct, id: string, props: AppStackProps) {
    super(scope, id, props);

    const service = new apprunner.CfnService(this, "Service", {
      serviceName: "3aiui",
      sourceConfiguration: {
        autoDeploymentsEnabled: true,
        authenticationConfiguration: {
          accessRoleArn: props.accessRole.roleArn,
        },
        imageRepository: {
          imageIdentifier: `${props.ecrRepo.repositoryUri}:latest`,
          imageRepositoryType: "ECR",
          imageConfiguration: {
            port: "3000",
            runtimeEnvironmentVariables: [
              { name: "APP_ENV", value: "production" },
              { name: "MEETING_PROVIDER", value: "anthropic" },
              { name: "PORT", value: "3000" },
              { name: "HOSTNAME", value: "0.0.0.0" },
            ],
            runtimeEnvironmentSecrets: [
              {
                name: "ANTHROPIC_API_KEY",
                value: props.anthropicSecret.secretArn,
              },
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
        instanceRoleArn: props.instanceRole.roleArn,
      },
      networkConfiguration: {
        egressConfiguration: {
          egressType: "VPC",
          vpcConnectorArn: props.vpcConnector.attrVpcConnectorArn,
        },
      },
      healthCheckConfiguration: {
        protocol: "HTTP",
        path: "/",
        interval: 20,
        timeout: 10,
        healthyThreshold: 1,
        unhealthyThreshold: 5,
      },
    });

    new CfnOutput(this, "AppRunnerServiceUrl", {
      value: service.attrServiceUrl,
    });
  }
}
