#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { VpcStack } from "../lib/vpc-stack";
import { CodeServerStack } from "../lib/cdk-stack";

const app = new cdk.App();

// ユーザーリスト: ここに追加・削除するだけでスタックが増減する
const users = ["user-a", "user-b"];

// スタック名のサフィックス
// 通常は固定。再作成が必要なときだけ変更: cdk deploy --all -c suffix=002
const suffix = app.node.tryGetContext("suffix") || "001";

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: "ap-northeast-1",
};

const vpcStack = new VpcStack(app, `CodeServer-Vpc-${suffix}`, { env });

for (const userName of users) {
  new CodeServerStack(app, `CodeServer-${userName}-${suffix}`, {
    userName,
    vpc: vpcStack.vpc,
    env,
  });
}
