#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { AppStack } from "../lib/app-stack";
import { DbStack } from "../lib/db-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT ?? process.env.AWS_ACCOUNT_ID,
  region:
    process.env.CDK_DEFAULT_REGION ??
    process.env.AWS_REGION ??
    "ap-northeast-1",
};

const dbStack = new DbStack(app, "ThreeAiUiDbStack", { env });
new AppStack(app, "ThreeAiUiAppStack", {
  env,
  ecrRepo: dbStack.ecrRepo,
  anthropicSecret: dbStack.anthropicSecret,
  dbSecret: dbStack.dbSecret,
  vpcConnector: dbStack.vpcConnector,
  accessRole: dbStack.accessRole,
  instanceRole: dbStack.instanceRole,
});
