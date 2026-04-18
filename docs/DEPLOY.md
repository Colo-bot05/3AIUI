# 3AIUI デプロイガイド（Phase 1 / AWS App Runner + RDS）

このドキュメントは、最初の社内閲覧向けに 3AIUI を AWS にデプロイするための手順書です。Phase 1 のスコープは以下に絞っています:

- Container: **App Runner**（HTTPS 自動、オートスケール、VPC Connector で RDS に到達）
- DB: **RDS Postgres** `db.t4g.micro`（最小構成）
- Secrets: **Secrets Manager** に Anthropic API キーと DB 資格情報を保管
- Image registry: **ECR**
- Logs: **CloudWatch Logs**
- Region: `ap-northeast-1`（東京）デフォルト

CloudFront / Route53 / 独自ドメイン / 認証は Phase 2 以降。App Runner のデフォルトドメインを使います。

---

## 1. 料金感（参考）

月額目安:

- App Runner (0.25 vCPU / 0.5 GB, 1 インスタンス常駐): **約 $25–35**
- RDS t4g.micro (single-AZ, 20 GB gp3): **約 $15–20**
- NAT Gateway (1 基): **約 $32**（アイドル時も課金）
- Secrets Manager (2 シークレット): **$0.80**
- ECR (ストレージ数 GB): **$1 前後**
- データ転送 / CloudWatch Logs: **$1–5**

合計: **月 $75–95 程度**（NAT Gateway の固定費が思いのほか大きい点に注意）。停止時は `npm run infra:destroy` でまとめて削除できます。

> ℹ️ NAT Gateway を外して VPC Endpoint に置き換えれば月 $30–40 台まで下がります。必要になったら Phase 2 で検討。

---

## 2. 初回のみ: AWS コンソール側の準備

1. IAM ユーザーを作成
   - IAM → Users → Create user
   - Access type: Programmatic access
   - Policy: `AdministratorAccess`（Phase 1 の scaffold 用。production では絞る）
   - 発行された **Access key ID / Secret access key** を控える
2. ローカルに AWS CLI を設定
   ```sh
   brew install awscli   # macOS の場合
   aws configure
   # Access key, Secret, region=ap-northeast-1, output=json
   ```
3. CDK を一度だけブートストラップ（アカウント × リージョン初回のみ）
   ```sh
   cd infra
   npm install
   npx cdk bootstrap aws://<ACCOUNT_ID>/ap-northeast-1
   ```

---

## 3. IaC コマンド（ローカル）

ルートディレクトリから:

```sh
npm run infra:install   # infra/ の依存を取得（初回のみ）
npm run infra:synth     # CloudFormation テンプレートを synth（AWS 認証不要）
npm run infra:diff      # 既存環境との差分（要 AWS 認証）
npm run infra:deploy    # 全スタック適用（要 AWS 認証）
npm run infra:destroy   # 全スタック削除（要 AWS 認証）
```

`infra:synth` はネットワーク到達なしで動くので、PR ごとに CDK コードが壊れていないかのチェックに使えます。

---

## 4. 初回 deploy フロー

1. インフラを立ち上げる
   ```sh
   npm run infra:install
   npm run infra:deploy
   ```
   スタックは 2 段: `ThreeAiUiDbStack`（VPC + RDS + DbSecret）→ `ThreeAiUiAppStack`（ECR + Secrets + App Runner + VPC Connector）。15–20 分程度。
2. デプロイ完了後、CloudFormation の出力で下記を確認:
   - `EcrRepositoryUri`
   - `AppRunnerServiceUrl`
   - `AnthropicSecretArn`
3. Anthropic API キーを Secret に書き込む（初回は空で作成される）
   ```sh
   aws secretsmanager put-secret-value \
     --secret-id "3aiui/anthropic-api-key" \
     --secret-string "sk-ant-..."
   ```
4. 本番用イメージをビルドして ECR に push
   ```sh
   # ECR にログイン
   aws ecr get-login-password --region ap-northeast-1 \
     | docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com

   # ビルド & タグ付け（linux/amd64 を明示）
   docker build -f Dockerfile.production --platform linux/amd64 -t 3aiui:latest .
   docker tag 3aiui:latest <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/3aiui:latest
   docker push <ACCOUNT_ID>.dkr.ecr.ap-northeast-1.amazonaws.com/3aiui:latest
   ```
5. App Runner は `autoDeploymentsEnabled: true` を指定しているため、新しい `:latest` イメージ push で自動デプロイが走ります。
6. 初回のみ DB マイグレーションを実行
   - App Runner のコンテナから直接 migration を流してもよいが、Phase 1 では手元マシンから VPN or bastion 経由で一度だけ `npm run db:migrate` を叩く想定
   - 簡易案: 一時的に `infra/lib/db-stack.ts` の RDS を `publiclyAccessible: true` に変更して migrate → 元に戻す（production では非推奨、開発期間だけ）
7. `AppRunnerServiceUrl` にブラウザでアクセス → 動作確認

---

## 5. 日常運用

- アプリのコード更新: `npm run build` → Docker build → ECR push → App Runner 自動デプロイ
- schema 変更: `npm run db:generate` → migration ファイル commit → 次回 deploy 時に `db:migrate` 実行
- シークレット変更: `aws secretsmanager put-secret-value`
- ログ閲覧: CloudWatch Logs の `/aws/apprunner/3aiui/...` ログ グループ

---

## 6. destroy 手順

```sh
npm run infra:destroy
```

注意:

- `ThreeAiUiDbStack` の RDS は `removalPolicy: DESTROY` で設定してあるので、実行すると **DB データが消えます**。
- Anthropic API キーと DB 資格情報の Secret は `removalPolicy: DESTROY`（デフォルト）なので、実際には 7 日間のリカバリ期間つきで削除されます。
- ECR リポジトリの中のイメージは残ります（手動 `aws ecr batch-delete-image` で削除）。

production 運用前に以下を必ず見直し:

- `infra/lib/db-stack.ts`: `removalPolicy`, `deletionProtection`, `backupRetention`
- `infra/lib/app-stack.ts`: `autoDeploymentsEnabled`, cpu / memory
- IAM ポリシーの絞り込み

---

## 7. このタスクでは実行しないこと

- `npm run infra:deploy` を叩くのはユーザー側の判断。本 PR はコードとドキュメントの追加のみ
- 本番環境の作成・破棄
- 認証・独自ドメイン（Task 12 以降）
