#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import * as fs from "fs";
import * as path from "path";
import { VpcStack } from "../lib/vpc-stack";
import { CodeServerStack } from "../lib/cdk-stack";

const app = new cdk.App();

// ユーザーリスト: users.txt から読み込み (ユーザー名,メールアドレス)
const usersFile = path.join(__dirname, "../users.txt");
const users = fs
  .readFileSync(usersFile, "utf-8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => {
    const [userName, email] = l.split(",").map((s) => s.trim());
    return { userName, email };
  });

const suffix = app.node.tryGetContext("suffix") || "001";

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: "ap-northeast-1",
};

const vpcStack = new VpcStack(app, `CodeServer-Vpc-${suffix}`, { env });

for (const { userName, email } of users) {
  new CodeServerStack(app, `CodeServer-${userName}-${suffix}`, {
    userName,
    email,
    vpc: vpcStack.vpc,
    env,
  });
}
