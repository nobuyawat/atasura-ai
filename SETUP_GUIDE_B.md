# アタスラAI Bプラン セットアップガイド

## 概要

このドキュメントでは、Next.js統合版（Bプラン）のセットアップ手順を説明します。

### Bプランの特徴

- **同一オリジン**: LP・認証・課金・本体がすべて同一のNext.jsアプリ
- **サーバーサイドガード**: Middlewareによる認証保護
- **シンプルな構成**: iframe/postMessage不要

---

## 目次

1. [必要なアカウント](#必要なアカウント)
2. [Supabase設定](#supabase設定)
3. [Google OAuth設定](#google-oauth設定)
4. [Stripe設定](#stripe設定)
5. [環境変数の設定](#環境変数の設定)
6. [データベースセットアップ](#データベースセットアップ)
7. [ローカル開発](#ローカル開発)
8. [動作確認](#動作確認)
9. [本番デプロイ](#本番デプロイ)

---

## 必要なアカウント

- **Supabase**: https://supabase.com
- **Google Cloud Platform**: https://console.cloud.google.com
- **Stripe**: https://dashboard.stripe.com

---

## Supabase設定

### 1. プロジェクト作成（すでに作成済みの場合はスキップ）

1. [Supabase Dashboard](https://supabase.com/dashboard) にログイン
2. 「New Project」をクリック
3. プロジェクト名: `atasura-b`
4. リージョン: `Northeast Asia (Tokyo)`

### 2. API設定の取得

Supabase Dashboard > Settings > API:

- **Project URL**: `https://xxxxx.supabase.co`
- **anon public key**: `eyJxxxx...`
- **service_role key**: `eyJxxxx...`（サーバーのみ）

---

## Google OAuth設定

### 1. Google Cloud Console設定

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを作成または選択
3. **APIs & Services > OAuth consent screen**
   - User Type: External
   - アプリ名、サポートメールを入力
4. **APIs & Services > Credentials > Create Credentials > OAuth client ID**
   - Application type: Web application
   - **Authorized JavaScript origins**:
     ```
     http://localhost:3000
     https://your-production-domain.com
     ```
   - **Authorized redirect URIs**:
     ```
     https://fscxvlbwwibsebmptprh.supabase.co/auth/v1/callback
     ```
5. **Client ID** と **Client Secret** をメモ

### 2. Supabase認証設定

Supabase Dashboard > Authentication > Providers:

1. Googleを有効化
2. Client ID と Client Secret を入力

### 3. URL Configuration

Supabase Dashboard > Authentication > URL Configuration:

- **Site URL**: `http://localhost:3000`（本番時は変更）
- **Redirect URLs**: `http://localhost:3000/auth/callback`

---

## Stripe設定

### 1. 商品と価格の作成

Stripe Dashboard > Products > Add product:

| プラン名 | 価格 | Price ID |
|---------|------|----------|
| スタータープラン | ¥500/月 | `price_xxx_starter` |
| ベーシックプラン | ¥990/月 | `price_xxx_basic` |
| クリエイタープラン | ¥1,980/月 | `price_xxx_creator` |

### 2. APIキーの取得

Stripe Dashboard > Developers > API keys:

- **Publishable key**: `pk_test_xxxxx`
- **Secret key**: `sk_test_xxxxx`

### 3. Webhook設定（本番用）

Stripe Dashboard > Developers > Webhooks > Add endpoint:

- **Endpoint URL**: `https://your-domain.com/api/stripe/webhook`
- **Events**:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- **Signing secret**: `whsec_xxxxx`

---

## 環境変数の設定

`.env.local` を編集:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://fscxvlbwwibsebmptprh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_test_xxxxx
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PRICE_ID_STARTER=price_xxxxx
STRIPE_PRICE_ID_BASIC=price_xxxxx
STRIPE_PRICE_ID_CREATOR=price_xxxxx

# Gemini API
GEMINI_API_KEY=AIzaSyxxxxx

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## データベースセットアップ

### 1. SQLスキーマの実行

Supabase Dashboard > SQL Editor:

1. `supabase/schema.sql` の内容をコピー
2. SQL Editorに貼り付けて「Run」

### 2. 確認

Tables:
- `profiles`
- `subscriptions`

Triggers:
- `on_auth_user_created`

Functions:
- `get_current_user_plan()`
- `has_plan_access()`

---

## ローカル開発

### 1. 依存関係のインストール

```bash
cd /Users/watanabenobuya/Shopify_KMNWorks/atasura-b
npm install
```

### 2. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開く

---

## 動作確認

### 認証フロー

1. http://localhost:3000 → LP表示
2. 「無料で始める」クリック → /login
3. Googleでログイン
4. /auth/callback → /app にリダイレクト
5. 本体（講座作成画面）が表示される

### 認証ガード確認

1. ログアウト状態で http://localhost:3000/app に直接アクセス
2. → /login にリダイレクトされることを確認

### 課金フロー（Stripe設定後）

1. /pricing でプランを選択
2. Stripe Checkout にリダイレクト
3. テストカード（4242 4242 4242 4242）で決済
4. /checkout/success → /app
5. プラン表示が更新されていることを確認

---

## 本番デプロイ

### Vercel

1. GitHubにプッシュ
2. Vercelでインポート
3. 環境変数を設定
4. デプロイ

### 環境変数（本番）

```
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Supabase URL更新

- Site URL: `https://your-domain.com`
- Redirect URLs: `https://your-domain.com/auth/callback`

### Google OAuth更新

- Authorized origins: `https://your-domain.com`

### Stripe Webhook更新

- Endpoint: `https://your-domain.com/api/stripe/webhook`

---

## ディレクトリ構成

```
atasura-b/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx           # ログインページ
│   │   └── auth/callback/route.ts   # OAuth コールバック
│   ├── (checkout)/
│   │   ├── pricing/page.tsx         # 料金ページ
│   │   └── checkout/
│   │       ├── success/page.tsx     # 決済成功
│   │       └── cancel/page.tsx      # 決済キャンセル
│   ├── (main)/
│   │   └── app/page.tsx             # 本体メイン画面
│   ├── api/
│   │   ├── stripe/
│   │   │   ├── create-checkout-session/route.ts
│   │   │   └── webhook/route.ts
│   │   └── ...                      # 既存のAPI routes
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                     # LP
├── components/
│   ├── editor/                      # 本体のエディタ
│   ├── setup/                       # 本体のセットアップ
│   └── ...
├── lib/
│   ├── supabase/
│   │   ├── client.ts                # ブラウザ用
│   │   ├── server.ts                # サーバー用
│   │   └── middleware.ts            # Middleware用
│   └── types.ts                     # 型定義
├── supabase/
│   └── schema.sql                   # DBスキーマ
├── middleware.ts                    # 認証ガード
├── .env.example
├── .env.local
└── SETUP_GUIDE_B.md
```

---

## トラブルシューティング

### Googleログインが動かない

1. Supabase > Authentication > Providers でGoogle有効化確認
2. Google Cloud Consoleのリダイレクトuriを確認
3. 環境変数 `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` を確認

### /app にアクセスできない

1. ブラウザのCookieをクリア
2. 再度ログイン
3. middleware.tsのログを確認

### Stripeチェックアウトが動かない

1. 環境変数 `STRIPE_SECRET_KEY` を確認
2. Price IDが正しいか確認
3. /api/stripe/create-checkout-session のログを確認

### Webhookが動かない

1. Stripe Dashboard > Webhooks でイベントログを確認
2. `STRIPE_WEBHOOK_SECRET` を確認
3. /api/stripe/webhook のログを確認

---

## 移行元との差分

| 項目 | 旧構成（iframe） | Bプラン |
|------|----------------|---------|
| LP | Vite (port 3000) | Next.js / |
| 本体 | Next.js (port 3001) | Next.js /app |
| 認証 | Supabase + iframe postMessage | Supabase + Middleware |
| 課金 | Netlify Functions | Next.js API Routes |
| 統合方式 | iframe埋め込み | 同一アプリ |
