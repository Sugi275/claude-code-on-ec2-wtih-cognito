# Claude Code on EC2 with Cognito

ブラウザだけで Claude Code が使える開発環境を、ユーザーごとに独立してデプロイする CDK プロジェクトです。

## アーキテクチャ

```
ブラウザ (HTTPS)
  → CloudFront (*.cloudfront.net, ドメイン不要)
  → Lambda@Edge (cognito-at-edge, Viewer Request)
  → Cognito Managed Login (TOTP MFA)
  → EC2 (Ubuntu 24.04, code-server + Claude Code)
```

### 共有リソース (1 つだけ)

- VPC (Public Subnet × 2AZ, NAT なし)

### 1 ユーザーあたりのリソース

- CloudFront ディストリビューション
- Lambda@Edge (認証)
- Cognito User Pool (Essentials tier, TOTP MFA, Managed Login v2)
- Cognito Managed Login Branding
- EC2 インスタンス (t3.large)
- Security Group (CloudFront IP レンジのみ許可)
- SSM Parameters × 3 (Lambda@Edge 用 Cognito 設定)
- IAM Role (SSM + Bedrock + Marketplace)

## 前提条件

- Node.js 18+
- AWS CLI (設定済み)
- CDK CLI (`npm install -g aws-cdk`)
- CDK Bootstrap 済み (ap-northeast-1 と us-east-1 の両方)
  ```bash
  cdk bootstrap aws://ACCOUNT_ID/ap-northeast-1
  cdk bootstrap aws://ACCOUNT_ID/us-east-1
  ```
- Bedrock で Claude モデルへのアクセスを有効化済み

## セットアップ

```bash
cd cdk
npm install
```

## ユーザー管理

`cdk/bin/cdk.ts` のユーザーリストを編集:

```typescript
const users = ["user-a", "user-b", "user-c", "user-d", "user-e"];
```

## デプロイ

```bash
cd cdk

# 全ユーザー分デプロイ
npx cdk deploy --all --require-approval never

# 特定ユーザーだけデプロイ
npx cdk deploy CodeServer-user-a-001 EdgeAuth-user-a
```

スタック名のサフィックス (`001`) は `cdk/bin/cdk.ts` の `suffix` で管理。
リソース再作成が必要な場合は `-c suffix=002` で新しいスタックを作成できます:

```bash
npx cdk deploy --all -c suffix=002
```

## ユーザー作成

デプロイ後、Cognito にユーザーを作成:

```bash
aws cognito-idp admin-create-user \
  --user-pool-id <UserPoolId from output> \
  --username user@example.com \
  --user-attributes Name=email,Value=user@example.com Name=email_verified,Value=true \
  --temporary-password 'TempPass1!' \
  --region ap-northeast-1
```

## お客様に渡す情報

1. CloudFront URL (Output の `CloudFrontUrl`)
2. メールアドレスと仮パスワード

## お客様のログインフロー

1. CloudFront URL にアクセス
2. Cognito Managed Login 画面でメール + 仮パスワードを入力
3. パスワード変更を求められるので新しいパスワードを設定
4. TOTP MFA の設定 (Google Authenticator 等)
5. code-server が表示される

## 削除

```bash
cd cdk

# 特定ユーザーの環境を削除
npx cdk destroy CodeServer-user-a-001 EdgeAuth-user-a

# 全削除
npx cdk destroy --all
```

> **注意**: Lambda@Edge と CloudFront の削除には数分〜数時間かかることがあります (エッジロケーションのレプリカ削除待ち)。

## 概算コスト (東京リージョン, 月額)

| リソース | 1 ユーザー | 5 ユーザー |
|---|---|---|
| EC2 t3.large | $80 | $400 |
| CloudFront | ~$1 | ~$5 |
| Lambda@Edge | ~$0 | ~$0 |
| Cognito (Essentials tier) | ~$0 | ~$0 |
| SSM Parameter Store | ~$0 | ~$0 |
| Bedrock (Claude) | 従量課金 | 従量課金 |
| **合計 (インフラのみ)** | **~$81** | **~$405** |

※ Bedrock の利用料は別途発生します。[Bedrock 料金](https://aws.amazon.com/bedrock/pricing/) を参照してください。

## 技術的な注意点

- Lambda@Edge は環境変数が使えないため、Cognito の設定値は SSM Parameter Store (ap-northeast-1) に保存し、コールドスタート時に読み込みます
- `cognito-at-edge` + `@aws-sdk/client-ssm` は esbuild でバンドル + minify して Viewer Request の 1MB 制限内 (圧縮後 242KB) に収めています
- Lambda@Edge は自動的に us-east-1 にデプロイされます (`EdgeAuth-*` スタック)
- CloudFront VPC Origin は WebSocket 非対応のため、EC2 は Public Subnet に配置し、Security Group で CloudFront の IP レンジ (AWS Managed Prefix List) のみ許可しています
- Lambda@Edge では WebSocket アップグレードリクエストと code-server の静的アセット (`/static/`, `/_static/`) は認証をスキップします
- EC2 の IAM Role には Bedrock (InvokeModel) と Marketplace (Subscribe) の権限が付与されています
