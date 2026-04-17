# 3AI Meeting UI

3AI Meeting UI は、1つのテーマに対して 3つの視点で議論し、最後に統合結論まで確認できる MVP です。

この初期PRでは、以下の土台を用意しています。

- Next.js + TypeScript + App Router によるフロントエンド基盤
- 構想AI / 現実AI / 監査AI を表示する単一画面の会議UI
- モックの orchestrator API (`/api/meeting/run`)
- Docker / Docker Compose によるローカル開発環境
- PostgreSQL コンテナの初期定義
- GitHub Actions の CI

## Status

MVP の進行状況、直近の主要変更、未実装項目、次アクションは [`docs/STATUS.md`](docs/STATUS.md) にまとめています。README は setup 手順中心に保ち、進捗メモはそちらを正とします。

## Tech Stack

- Next.js
- TypeScript
- App Router
- Tailwind CSS v4
- PostgreSQL (Docker Compose 上の開発用コンテナ)

## Directory Outline

```
src/
  app/
    api/meeting/run/route.ts   # 会議実行API（今はモック）
    layout.tsx
    page.tsx
  components/
    meeting-workspace.tsx      # 1画面UI
  features/meeting/
    mode-config.ts             # UI用モード定義
    types.ts                   # 会議データ構造
  lib/orchestrator/
    provider-adapter.ts        # provider interface
    provider-registry.ts       # provider選択
    providers/
      mock-provider.ts         # 現在のモック実装
```

## Environment Variables

`.env.example` を参考にしてください。

```bash
APP_ENV=development
DATABASE_URL=postgresql://postgres:postgres@db:5432/three_ai_ui
MEETING_PROVIDER=mock
```

現在のMVPでは `MEETING_PROVIDER=mock` を前提にしており、会議実行APIは provider adapter経由でモックを実行する構造になっています。将来的には商用LLMやローカルLLMのアダプターを追加する予定です。

## Local Development

依存関係をインストールして起動します。

```bash
npm install
npm run dev
```

ブラウザで http://localhost:3001 を開いてください。

## Docker Desktop で起動する

Docker Desktop が起動している状態で、以下を実行します。

```bash
cp .env.example .env
docker compose up --build
```

起動後のアクセス先:

- App: http://localhost:3001
- PostgreSQL: `localhost:5432`

この構成は、ローカルでは bind mount で開発しやすくしつつ、将来的に ECS Fargate へ寄せやすい「コンテナ前提」の土台を意識しています。

## Quality Checks

```bash
npm run lint
npm run typecheck
npm run build
```

## CI

`.github/workflows/ci.yml` で以下をチェックします。

- install
- lint
- typecheck
- build

`push` と `pull_request` の両方で実行されます。

## Next Steps

直近の候補は [`docs/STATUS.md`](docs/STATUS.md) の「現時点のおすすめ次アクション」を参照してください。
