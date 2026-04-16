# 3AI Meeting UI

3AI Meeting UI は、1つのテーマに対して 3つの視点で議論し、最後に統合結論まで確認できる MVP です。

この初期PRでは、以下の土台を用意しています。

- Next.js + TypeScript + App Router によるフロントエンド基盤
- 構想AI / 現実AI / 監査AI を表示する単一画面の会議UI
- モックの orchestrator API (`/api/meeting/run`)
- Docker / Docker Compose によるローカル開発環境
- PostgreSQL コンテナの初期定義
- GitHub Actions の CI

## Tech Stack

- Next.js
- TypeScript
- App Router
- Tailwind CSS v4
- PostgreSQL (Docker Compose 上の開発用コンテナ)

## Directory Outline

```text
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
    mock-orchestrator.ts       # 将来差し替え前提のモックロジック
```

## Environment Variables

`.env.example` を参考にしてください。

```bash
APP_ENV=development
DATABASE_URL=postgresql://postgres:postgres@db:5432/three_ai_ui
MEETING_PROVIDER=mock
```

今のMVPでは `MEETING_PROVIDER=mock` を前提にしています。将来的には Provider Adapter を追加して、商用LLMやローカルLLMへ差し替える想定です。

## Local Development

依存関係をインストールして起動します。

```bash
npm install
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## Docker Desktop で起動する

Docker Desktop が起動している状態で、以下を実行します。

```bash
cp .env.example .env
docker compose up --build
```

起動後のアクセス先:

- App: [http://localhost:3000](http://localhost:3000)
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

このPRの次に進めやすい候補:

1. orchestrator のレスポンス設計を少し拡張し、実LLM差し替え口を明確化する
2. セッション保存のスキーマと repository 層を追加する
3. UI のストリーミング表現や markdown 表示を整える
