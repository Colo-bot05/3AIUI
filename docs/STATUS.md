# 3AIUI 現状ドキュメント

最終更新: 2026-04-17

このファイルは、3AIUI の現在地、直近の主要変更、未実装項目、次アクションを 1 箇所にまとめた進捗メモです。README は setup 手順に集中させ、MVP の進行状況はこのドキュメントを正とします。

## 1. 全体状況

3AIUI は、MVP の土台実装がかなり進んだ状態にあります。ローカルでは `docker compose up --build` で app / db 起動確認済み、`http://localhost:3001` で表示確認済みです。hydration error は時刻表示の timezone 固定で解消済みで、その修正は PR #27 経由で `main` に入っています。

プロダクト全体の位置づけとしては、Colobiz 社内 AI 基盤の用途別 UI のひとつであり、複数 LLM を前提に、会話・統合・判定を扱う会議 UI として整理されています。共通基盤側では、RAG、ルール（プロンプト）、評価、履歴管理を持つ構想です。

## 2. すでに入っている中核機能

初期 MVP として、以下はすでに成立しています。

- チャット型 workspace UI
- 3 モード切替
  - brainstorm
  - discussion
  - debate
- モードごとの state 遷移
  - brainstorm / discussion → synthesized
  - debate → awaiting_judgment → judged
- 明示トリガーによる synthesis / judgment
- debate の役割割当 UI
- provider adapter / registry / mock provider
- session persistence scaffold
- presentation layer 分離
- timezone 固定による hydration 修正

アーキテクチャも、UI / presentation / domain / orchestration / API route の層で整理されています。

## 3. 直近で `main` に入った主要変更

### PR #28 — workspace 右下アクションの分離

- brainstorm / discussion
  - Continue conversation
  - Synthesize
- debate
  - Continue debate
  - Judge

継続系と終了系を別導線として見せる UI に変更。視覚的分離、disabled 条件、debate の役割制約、既存 state 遷移は維持。Claude Code レビューでも Approve 扱いで、そのままマージ済み。

### PR #29 — attachment context support

meeting に資料添付を持ち込めるようにした。

対応形式:

- pdf
- docx
- pptx
- xlsx
- md
- txt

実装内容:

- 添付 UI
- 添付一覧
- `POST /api/attachments/parse`
- `MeetingRunInput.attachments`
- parse / preview / 削除
- mock provider への反映

また、PDF 文字化けについては、低品質抽出を UI に出さないよう品質ヒューリスティックを追加し、preview を安全側に倒している。

### PR #30 — attachment の session / history linkage

attachment を session 側に接続。

追加イベント:

- `attachment_attached`
- `attachment_removed`

さらに `meeting_generated` に attachment 参照情報を残し、後から「どの資料を前提に会議が走ったか」を辿れるようにした。保存するのは軽量メタデータのみで、`extractedText` 全文や preview 断片は session に保存していない。PR #30 は quality 通過後、squash merge 済み。

## 4. attachment 機能の現在地

attachment 機能は、MVP としてはかなり成立しています。

- readable PDF は preview 表示
- unreadable PDF は mojibake を出さず安全に止める
- docx / pptx / xlsx / md / txt も preview 確認済み
- 添付ありで brainstorm / discussion / debate / judge まで動作確認済み
- continue / finalize 分離も維持済み

また、1 ファイルの parse 失敗で全添付が消える問題は、`Promise.all` 由来のバッチ失敗伝播として指摘され、追加コミットで解消済み。成功・soft error・hard error を個別に扱えるようになっている。

## 5. 今の運用ルール

このスレッドでの開発運用前提は次の通り。

- 実装 → Codex
- レビュー / マージ → Claude Code

この役割分担で今後も進める前提。また、ユーザー本人は GitHub / 実装を深く触らず、コピペ運用中心。こちらはそれに合わせて、Codex 向け実装指示 と Claude Code 向けレビュー依頼 を分けて出す運用が妥当。これはこの会話で明示確認済み。

## 6. まだ未実装 / 保留中の大きい項目

現状ドキュメント上で、まだ未実装 / スコープ外にあるものは以下。

- 実 provider SDK 接続（OpenAI / Anthropic / Google / ローカル LLM）
- DB 永続化
- 履歴 sidebar / session restore UI
- 本格 RAG
- 認証
- AWS 本番デプロイ

つまり、今は UI 土台 + mock orchestration + attachment + session linkage までは来ているけれど、まだ本物の LLM 接続前です。

## 7. 残っている backlog / 技術的負債

現状ドキュメントとレビューから見ると、次に候補になりやすいのはこのあたり。

- `debateJudgment` を optional / debate-only にする
- `INITIAL_RESULT.debateJudgment` の重複排除
- `meeting-workspace.tsx` の分割
- provider / presentation 境界の継続整理
- provider に渡す attachment 要約戦略
- attachment history UI
- dependency footprint の見直し（pdf-parse 周辺）

特に `debateJudgment` の optional 化は、現状ドキュメントで次に取り組める小 PR 候補の優先 1 位として整理されている。

## 8. Prompt Settings の位置づけ

Prompt Settings は必要性は高いが、今すぐではないという整理。

理由:

- まだ実 LLM が入っていない
- 先に実 provider を 1 本つなぐ方が自然
- prompt 設定は、実 LLM 接続の直後〜本格インフラ前がちょうどよい

要件定義上、共通基盤には「ルール（プロンプト）」が含まれるので、最終的には重要機能。ただし、順番としては attachment → session linkage → 境界整理 → 実 LLM 接続 → Prompt Settings がきれい。

## 9. インフラ着手までの見立て

現状はまだ mock 中心なので、今すぐインフラ本格突入ではない。ただし遠くもなく、新機能追加を増やさずに進めれば、あと数 PR でインフラ着手ラインに入れる可能性がある。

最低限その前に欲しいもの:

- 小さめの境界整理
- 実 provider 1 本接続
- session / history の最低限の設計整理

AWS 本番デプロイや DB 永続化はそのあと。

## 10. 現時点のおすすめ次アクション

一番自然なのはこれ。

1. `debateJudgment` の optional 化
2. `INITIAL_RESULT` 重複整理
3. `meeting-workspace.tsx` 分割
4. 実 provider 1 本接続
5. その後に Prompt Settings 検討

つまり、次は新機能を増やすより境界整理に戻るターン。
