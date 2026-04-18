import { Stack, type StackProps, Duration, RemovalPolicy } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";

export class DbStack extends Stack {
  readonly vpc: ec2.Vpc;
  readonly dbInstance: rds.DatabaseInstance;
  readonly dbSecret: secretsmanager.Secret;
  readonly appConnectorSg: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    this.dbSecret = new secretsmanager.Secret(this, "DbSecret", {
      secretName: "3aiui/db",
      description: "RDS postgres credentials for 3aiui (rotated by RDS)",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: "postgres" }),
        generateStringKey: "password",
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    this.appConnectorSg = new ec2.SecurityGroup(this, "AppConnectorSg", {
      vpc: this.vpc,
      description: "App Runner VPC connector egress",
      allowAllOutbound: true,
    });

    this.dbInstance = new rds.DatabaseInstance(this, "Db", {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_3,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MICRO,
      ),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      credentials: rds.Credentials.fromSecret(this.dbSecret, "postgres"),
      databaseName: "three_ai_ui",
      allocatedStorage: 20,
      maxAllocatedStorage: 50,
      multiAz: false,
      publiclyAccessible: false,
      backupRetention: Duration.days(7),
      deletionProtection: false,
      // Phase 1: allow destroy so `npm run infra:destroy` works in dev.
      // Flip to RETAIN before the first production workload.
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.dbInstance.connections.allowDefaultPortFrom(this.appConnectorSg);
  }
}
