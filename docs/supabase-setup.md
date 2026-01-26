# Supabase セットアップ（Google OAuth / PWA向け）

## 1. Supabase プロジェクト作成
- 無料枠でOK

## 2. DB スキーマ投入
- Supabase Dashboard → SQL Editor
- [supabase/schema.sql](../supabase/schema.sql) を実行

## 3. Google OAuth 設定
### 3.1 Google Cloud 側
- OAuth 同意画面を作成
- OAuth クライアントID（Webアプリ）を作成

### 3.2 Supabase 側
- Dashboard → Authentication → Providers → Google を有効化
- Google の Client ID / Client Secret を登録

## 4. リダイレクトURL
Supabase の Authentication 設定に合わせて、下記を許可します。

- ローカル開発
  - `http://localhost:3000/auth/callback`

- 本番（例: Vercel）
  - `https://<your-domain>/auth/callback`

※ App Router 実装では、コールバックURLのパスは実装に合わせて固定します。

## 5. Site URL / Additional Redirect URLs
- Authentication → URL Configuration
  - Site URL:
    - 開発: `http://localhost:3000`
    - 本番（Vercel）: `https://<your-vercel-domain>`
  - Additional Redirect URLs:
    - 開発: `http://localhost:3000/auth/callback`
    - 本番: `https://<your-vercel-domain>/auth/callback`

## 6. 環境変数
- `.env.local` に以下を設定
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

