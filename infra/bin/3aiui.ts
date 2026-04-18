#!/usr/bin/env node
import "source-map-support/register";
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
  vpc: dbStack.vpc,
  dbInstance: dbStack.dbInstance,
  dbSecret: dbStack.dbSecret,
  appConnectorSg: dbStack.appConnectorSg,
});
