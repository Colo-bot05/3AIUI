# CLAUDE.md — 3AIUI Claude Code 運用マニュアル

このファイルは、ローカル Claude Code がこのリポジトリで作業するときに **最初に読む** 運用ルールです。Cowork（司令塔）からタスクが来たら、ここに書かれた手順を必ず踏んでください。

---

## 0. このリポジトリでの役割分担

- **司令塔 = Cowork**: 要件整理、ロードマップ、タスク切り、PR 指示書の作成。
- **実装者 = ローカル Claude Code（あなた）**: 実装、テスト、commit、push、PR 作成、自己レビュー、auto-merge の設定。
- **レビュアー（Phase 2 以降）= GitHub Actions 上の Claude Code**: PR を読んで review コメント / approve / change request。
- **ゲートキーパー = GitHub**: branch protection と CI で品質を担保。
- **最終決裁者 = ユーザー本人**: Tier C タスクのマージ承認のみ。それ以外は自動。

## 1. タスクの受け取り方

Cowork から渡される指示書は `## Task`, `## Context`, `## Acceptance Criteria`, `## Tier`, `## Branch`, `## Notes` の 6 セクションを持ちます。全セクションを読んでから着手すること。`## Tier` の値（A / B / C）はマージ戦略を変えます（後述）。

## 2. 基本ワークフロー

1. `main` を最新化する: `git fetch origin && git checkout main && git pull --ff-only`
2. 新しいブランチを切る: `git checkout -b <指示書の ## Branch の値>`
3. 指示書の Acceptance Criteria をすべて満たすように実装する。
4. 品質チェックをローカルで必ず通す:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run build`
5. commit する。メッセージは Conventional Commits に寄せる（例: `feat: make debateJudgment optional`）。
6. push する: `git push -u origin <ブランチ名>`。
7. PR を作る: `gh pr create --fill`（タイトル・本文は指示書 `## PR Template` がある場合それを使う）。
8. 自己レビューする（セクション 4 参照）。
9. Tier ごとのマージ戦略に従う（セクション 5 参照）。

## 3. 禁止事項

- `main` への直接 push は禁止。必ず PR 経由。
- 指示書の Acceptance Criteria を満たせない場合、勝手に「それっぽい代替」で埋めない。Cowork に返す（PR の draft 状態で止めて、PR 本文に「⚠️ Cowork へ確認が必要」と書く）。
- `npm install` で新規の重い依存を入れる時は、指示書に明示されていない限り禁止。
- secrets（Anthropic API key / DB password など）はコードにハードコードしない。`.env.example` にプレースホルダを増やすのみ。
- 勝手に大規模リファクタしない。指示書のスコープ厳守。

## 4. 自己レビュー手順

PR を作った直後に、次を自分でやる。

1. `gh pr diff` で diff を全部読む。
2. Acceptance Criteria を PR 本文の末尾に「- [x] ...」形式で列挙して全部チェック済みにする。満たしていない項目があれば PR を draft に戻す。
3. 「意図せず触ってしまったファイル」がないか確認する。あれば revert する。
4. テスト / lint / typecheck / build が CI で green になるのを待つ。
5. 自分がレビュアーだったら指摘しそうな箇所を PR にセルフコメントで残す（後から Actions 側のレビュアーや人間が読む材料になる）。

## 5. Tier ごとのマージ戦略

指示書の `## Tier` に書かれた値に従う。

### Tier A（docs / 小さな境界整理 / 型修正）
- 対象: README 追記、`docs/*` 更新、小さな型修正、デッドコード削除、重複排除。
- 動作: CI green を待って `gh pr merge --auto --squash` を打つ。Claude Code は完了後に Cowork 宛に「merged: <PR URL>」と報告。

### Tier B（UI 追加 / 小機能 / UI 微改修）
- 対象: 既存層に閉じた機能追加・UI 変更。新規外部依存なし。
- 動作: CI green + 自己レビュー完了を確認後、`gh pr merge --auto --squash` を打つ。Phase 2 稼働後は Actions レビュアーの approve も待つ。

### Tier C（実 provider 接続 / 認証 / DB schema / infra / secrets）
- 対象: 外部 SDK 導入、認証導入、DB スキーマ変更、AWS 系インフラ変更、secrets 追加。
- 動作: **auto-merge を打たない**。PR を ready for review にしたら停止し、Cowork に「Tier C のため承認待ち: <PR URL>」と報告。ユーザー本人の OK が来たら `gh pr merge --squash` を打つ。

## 6. 失敗したときのリカバリ

- CI が落ちた: ログを読んで修正 → 追加 commit → push。PR は開いたまま。3 回連続で落ちたら Cowork に相談。
- 自己レビューで NG が出た: 修正 → push。PR は draft に戻さない（すでに人間レビューが走る前なら OK）。
- merge conflict: `git fetch && git rebase origin/main` で解決。解決できなければ Cowork に相談。
- 指示書の Acceptance Criteria を満たせないと判明した: すぐ PR を draft に戻し、PR 本文に「⚠️ 要再設計: <理由>」と書いて Cowork に返す。

## 7. Cowork との通信プロトコル

Claude Code からユーザー（Cowork を使っている本人）に返す報告は、次の形式に揃える。

```
[result]
- status: merged | awaiting_user_approval | blocked | failed
- pr: <PR URL>
- branch: <branch name>
- tier: A | B | C
- next: <次に Cowork にお願いしたいこと、あれば>
```

これを最後に必ず出す。Cowork はこの [result] ブロックを読んで次のタスクを組み立てる。

## 8. 参考ドキュメント

- 進捗メモ: `docs/STATUS.md`
- README: `./README.md`
- CI 定義: `.github/workflows/ci.yml`
