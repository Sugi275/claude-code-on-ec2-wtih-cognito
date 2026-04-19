# 削除方法

デプロイした環境を削除する手順です。Lambda@Edge の仕様上、3 段階に分けて実行します。

## なぜ一括削除できないのか

Lambda@Edge は CloudFront のエッジロケーションにレプリカが自動作成されます。CloudFront を削除してもレプリカの削除には数時間かかり、レプリカが残っている間は Lambda 関数を削除できません。そのため、CloudFront を含むスタックを先に削除し、時間を置いてから Lambda@Edge のスタックを削除する必要があります。

## 削除手順

CloudShell で `cd ~/claude-code-on-ec2-wtih-cognito/cdk` に移動してから実行してください。

### Step 1. ユーザースタックを削除

EC2・CloudFront・Cognito などユーザーごとのリソースを削除します。

```
npm run destroy:users
```

### Step 2. Lambda@Edge スタックを削除（数時間後）

Step 1 の完了から **数時間後**（目安: 1〜3 時間）に実行してください。

```
npm run destroy:edge
```

> **エラーが出た場合**: レプリカがまだ残っています。時間を置いて再実行してください。
>
> それでも削除できない場合は、以下のコマンドで Lambda 関数を保持したままスタックを削除できます。
>
> ```
> aws cloudformation delete-stack \
>   --stack-name EdgeAuth-ユーザー名 \
>   --retain-resources 失敗したリソースのLogicalId \
>   --region us-east-1
> ```
>
> 保持した Lambda 関数はレプリカ削除後に手動で削除してください。

### Step 3. 共有リソースを削除

VPC を削除します。Step 2 が完了してから実行してください。

```
npm run destroy:shared
```

## npm scripts 一覧

| スクリプト | 対象スタック | リージョン |
|---|---|---|
| `destroy:users` | `CodeServer-user*` | ap-northeast-1 |
| `destroy:edge` | `EdgeAuth-*` | us-east-1 |
| `destroy:shared` | `CodeServer-Vpc-*` | ap-northeast-1 |
