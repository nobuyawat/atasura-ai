# アタスラAI 運用ガイド

## 環境構成

| 環境 | URL | Supabase | Stripe | 用途 |
|------|-----|----------|--------|------|
| **local** | `http://localhost:3000` | `.env.local` で指定 | TEST キー | 開発・デバッグ |
| **staging** | Vercel Preview（PRごと自動） | 本番と同じ or TESTプロジェクト | TEST キー | 統合テスト・レビュー |
| **production** | `https://atasura-ai.vercel.app` | 本番プロジェクト | LIVE キー | ユーザー公開 |

---

## ローカル開発

### セットアップ

```bash
# リポジトリクローン後
cp .env.example .env.local
# .env.local に各サービスのキーを設定

npm install
npm run dev
```

### 環境変数（.env.local）

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
SUPABASE_SERVICE_ROLE_KEY=eyJhb...

NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

GEMINI_API_KEY=AI...

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Stripe Webhook のローカルテスト

```bash
stripe listen --forward-to localhost:3000/api/webhook
```

---

## ステージング環境

### Vercel Preview デプロイ

- `main` 以外のブランチにプッシュ → Vercel が自動で Preview URL を発行
- PR 上に Preview URL がコメントされる
- 環境変数は Vercel Dashboard > Settings > Environment Variables で `Preview` 用に設定

### ステージング用の環境変数

Vercel Dashboard で Preview 環境に以下を設定:

- `NEXT_PUBLIC_SUPABASE_URL`: テスト用 Supabase プロジェクト URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: テスト用 anon key
- `SUPABASE_SERVICE_ROLE_KEY`: テスト用 service role key
- `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`: `pk_test_...`
- `STRIPE_SECRET_KEY`: `sk_test_...`
- `STRIPE_WEBHOOK_SECRET`: Preview 用の webhook secret
- `GEMINI_API_KEY`: 開発用 Gemini API キー

### ステージングでのテスト手順

1. feature ブランチを作成してプッシュ
2. Vercel Preview URL にアクセス
3. テストユーザーでログインして動作確認
4. Stripe テストカード（`4242 4242 4242 4242`）で課金テスト
5. 問題なければ PR をマージ

---

## 本番デプロイ

### デプロイフロー

```
feature branch → PR → Review → Merge to main → Vercel 自動デプロイ
```

### デプロイ前チェックリスト

- [ ] ローカルで `npm run build` が成功すること
- [ ] ステージング（Preview）で動作確認済み
- [ ] DB マイグレーションが必要な場合は先に適用
- [ ] Stripe の Webhook URL が本番向けに設定済み

### DB マイグレーション手順

```bash
# Supabase Dashboard の SQL Editor で実行
# ファイル: supabase/migrations/XXX_*.sql

# 1. マイグレーションファイルの内容を確認
# 2. Supabase Dashboard > SQL Editor で実行
# 3. テーブル構造を確認
```

### ロールバック

- Vercel Dashboard > Deployments から過去のデプロイメントを Redeploy
- DB の変更がある場合は手動でロールバック SQL を実行

---

## クレジットシステム

### プラン別クレジット

| プラン | 月間クレジット | 備考 |
|--------|---------------|------|
| Free | 0（台本生成3回まで） | `free_script_uses` カウンター |
| Starter | 30 | |
| Basic | 300 | |
| Creator | 600 | |

### クレジット消費ルール

- 各 AI 生成 API 呼び出しにつき **1 クレジット** 消費
- **成功時のみ消費**（失敗・タイムアウト時は消費しない）
- `request_id`（UUID）による冪等性保証（二重消費防止）
- 消費タイミング: AI API 呼び出し成功後、レスポンス返却前

### クレジット消費対象 API

| API | アクション名 | 消費量 |
|-----|-------------|--------|
| `/api/generate-outline` | `generate_outline` | 1 |
| `/api/generate-script` | `generate_script` | 1 |
| `/api/generate-slides` | `generate_slides` | 1 |
| `/api/generate-slides-v2` | `generate_slides` | 1 |
| `/api/generate-slide-image` | `generate_slide_image` | 1 |

### トラブルシューティング

#### クレジットが消費されない場合

1. `usage_logs` テーブルで `request_id` の重複がないか確認
2. `user_credits` テーブルの `credits_remaining` を確認
3. Vercel Logs で `[generate-*] Credit consumed` のログを確認

#### クレジットが二重消費された場合

1. `usage_logs` で同一 `request_id` のレコードを確認
2. 冪等キーが正しく送信されているか確認（フロント側の `crypto.randomUUID()`）

---

## 監視・ログ

### Vercel Logs

各 API ルートは以下の形式で構造化ログを出力:

```
[generate-script] Token usage: user=xxx, route=generate-script, prompt_tokens=123, output_tokens=456, total_tokens=579, duration_ms=1234
```

### Supabase テーブル

- `user_credits`: ユーザーのクレジット残高
- `usage_logs`: 生成履歴（`request_id`, `status`, `error_message` 付き）
- `generation_logs`: トークン使用量の詳細ログ

---

## セキュリティ

- `SUPABASE_SERVICE_ROLE_KEY` はサーバーサイドのみで使用
- Stripe の Webhook は署名検証（`STRIPE_WEBHOOK_SECRET`）で保護
- すべての API ルートで `supabase.auth.getUser()` による認証チェック
- クレジット消費は PostgreSQL の `FOR UPDATE` ロックで原子性保証
