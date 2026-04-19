# Claude Code on EC2 with Cognito

ブラウザだけで Claude Code が使える開発環境を、ユーザーごとに独立してデプロイする CDK プロジェクトです。

## 前提条件

- Node.js 18+
- AWS CLI (設定済み)
- CDK CLI (`npm install -g aws-cdk`)
- Bedrock で Claude モデルへのアクセスを有効化済み

## セットアップ

```bash
cd cdk
npm install
```

## ユーザー管理

`cdk/users.txt` を編集 (1行1ユーザー、ユーザー名とメールアドレスをカンマ区切り):

```
# ユーザー名,メールアドレス
user-a,testusera@example.com
user-b,testuserb@example.com
```

デプロイ時に Cognito ユーザーが自動作成され、招待メールが送信されます。

## デプロイ

```bash
cd cdk
npm install
npm run deploy
```

`npm run deploy` は以下を自動実行します:
1. CDK Bootstrap (ap-northeast-1 + us-east-1)
2. 全スタックの並列デプロイ

個別操作が必要な場合:

```bash
# 特定ユーザーだけデプロイ
npx cdk deploy CodeServer-user-a-001 EdgeAuth-user-a --require-approval never
```

スタック名のサフィックス (`001`) は `cdk/bin/cdk.ts` の `suffix` で管理。
リソース再作成が必要な場合は `-c suffix=002` で新しいスタックを作成できます:

```bash
npx cdk deploy --all -c suffix=002
```

## ユーザー作成

デプロイ時に Cognito にユーザーが自動作成され、招待メールが送信されます。

## お客様に渡す情報

1. CloudFront URL (`npm run list` で確認)
2. メールアドレスと仮パスワード (招待メールで自動送信)

```bash
cd cdk
npm run list
```

## お客様のログインフロー

1. CloudFront URL にアクセス
2. Cognito Managed Login 画面でメール + 仮パスワードを入力
3. パスワード変更を求められるので新しいパスワードを設定
4. TOTP MFA の設定 (Google Authenticator 等)
5. code-server が表示される

詳細な手順は以下のドキュメントを参照してください。

| ドキュメント | 対象 | 内容 |
|---|---|---|
| [デプロイ方法](docs/deploy.md) | 管理者 | CloudShell からのデプロイ手順 |
| [ログイン方法](docs/login.md) | お客様 | ログイン〜Claude Code 初期設定〜ファイル操作 |

## 削除

```bash
cd cdk

# 特定ユーザーの環境を削除
npx cdk destroy CodeServer-user-a-001 EdgeAuth-user-a

# 全削除
npx cdk destroy --all
```

> **注意**: Lambda@Edge と CloudFront の削除には数分〜数時間かかることがあります (エッジロケーションのレプリカ削除待ち)。

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
