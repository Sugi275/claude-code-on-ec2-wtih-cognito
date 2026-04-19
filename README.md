# Claude Code on EC2 with Cognito

ブラウザだけで Claude Code が使える開発環境を、ユーザーごとに独立してデプロイする CDK プロジェクトです。

| ドキュメント | 対象 | 内容 |
|---|---|---|
| [デプロイ方法](docs/deploy.md) | AWS 管理者 | CloudShell からのデプロイ手順 |
| [削除方法](docs/destroy.md) | AWS 管理者 | 環境の削除手順 |
| [ログイン方法](docs/login.md) | Claude Code 利用者 | ログイン〜Claude Code 初期設定〜ファイル操作 |

# 特徴

- **簡単セットアップ** — CloudShell からコマンドを実行するだけでデプロイ完了
- **ブラウザだけで完結** — ローカル PC への追加インストール不要
- **MFA 対応** — Cognito + TOTP (Authy 等) でセキュアにログイン
- **ユーザーごとに独立** — 1 人 1 台の EC2 でパフォーマンスもセキュリティも分離

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

## アーキテクチャの他の選択肢

導入手順をできるだけ簡単にするため、独自ドメインや追加サービスが不要な構成を選択しました。

| 選択肢 | 不採用の理由 |
|---|---|
| ALB + Cognito Managed Login | ALB の HTTPS リスナーには独自ドメイン + ACM 証明書が必要 |
| MFA を Email (SES) で実施 | SES の利用には独自ドメインの検証が必要 |

→ CloudFront (デフォルトドメイン) + Cognito Managed Login + TOTP MFA + EC2 の構成を採用。