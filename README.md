# 筋トレ記録アプリ（MVP）

Next.js（App Router）+ Supabase（Google OAuth）で作る筋トレログPWAです。
iPhone Safari を最優先に、片手操作・短時間入力での記録を重視します。

## 無料で作る方針（重要）
- Supabase: Free（Auth + Postgres + RLS）
- Hosting: Vercel Free（HTTPS必須。iOSのホーム画面追加/PWA運用のため）
- 認証: Google OAuth（無料）

※ 無料枠の上限（リクエスト数/DB容量/同時接続など）はあります。MVP想定の個人利用を前提に設計します。

## セットアップ（ローカル開発）
### 1) 依存関係をインストール
PowerShell の実行ポリシーで `npm.ps1` がブロックされる環境では、`npm.cmd` を使います。

```bash
npm.cmd install
```

### 2) 環境変数
`.env.local` を作り、[.env.example](.env.example) を参考に設定します。

#### ローカルモード（Supabase無しでサイト単体）
UIを色々直したいとき向けに、Supabase無しで動くモードがあります。

`.env.local` に下記を追加してください。

```dotenv
NEXT_PUBLIC_GYMAPP_LOCAL_ONLY=1
```

- データは `c:\gymapp\.localdb.json` に保存されます（gitignore 済み）
- ログインは不要になります（/login は自動で / にリダイレクト）

### 3) 開発サーバ起動
```bash
npm.cmd run dev
```

## Supabase（DB/RLS）
- Supabase プロジェクト作成（無料枠）
- SQL Editor で [supabase/schema.sql](supabase/schema.sql) を実行

## Supabase（Google OAuth）
手順は [docs/supabase-setup.md](docs/supabase-setup.md) を参照。

## Vercel デプロイ（iPhoneからクラウド保存まで）
1) GitHub に push
2) Vercel で Import → Deploy
3) Vercel の Environment Variables を設定（Production/Preview）
	- `NEXT_PUBLIC_SUPABASE_URL`
	- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
	- `NEXT_PUBLIC_GYMAPP_LOCAL_ONLY=0`（未設定でもOKだが、明示推奨）
4) Supabase 側 Authentication → URL Configuration
	- Site URL: `https://<your-vercel-domain>`
	- Additional Redirect URLs:
	  - `https://<your-vercel-domain>/auth/callback`
5) Google Cloud 側の OAuth 設定（使う場合）
	- Authorized redirect URI に `https://<your-vercel-domain>/auth/callback` を追加

※ ローカル（UI調整）だけしたいときは `.env.local` の `NEXT_PUBLIC_GYMAPP_LOCAL_ONLY=1` に戻すと、ログイン不要で動きます。

## 画面（MVP）
- ログイン（Googleのみ）
- 月カレンダー（実施日マーク/今日枠/日付タップ遷移）
- 設定（ジムログインURLを保存、🏋️ ジムボタン表示）
- その日のワークアウト一覧（同日複数OK、種目・kg/回数を概要表示）
- ワークアウト入力/編集（種目/セット/前回コピー/削除）
- 種目管理（ユーザー専用マスタ、部位タグ、履歴）

## 実装済み（現状まとめ）
### 画面/導線
- カレンダー（/）
	- 月表示（週の並びは「月〜日」）
	- 実施日はマーク表示、今日を強調表示
	- 月サマリー（トレ日数/総セット数/部位別セット数）
	- 「＋ 今日の記録」から当日ワークアウトを作成して編集へ
	- （任意）ジムログインURLを設定すると、ヘッダーに「🏋️ ジム」ボタンが出て外部URLを新しいタブで開く
- 日付ページ（/day/[date]）
	- その日のワークアウト一覧を表示
	- ワークアウトを開かなくても、種目名＋セット概要（例: `60kg×10`）を表示
	- 「カレンダーに戻る」ボタンあり
- ワークアウト編集（/workouts/[id]）
	- 日付/メモの保存（保存完了メッセージ表示）
	- 種目追加/削除、セット追加/更新/削除、前回セットのコピー
	- 種目追加時に「前回トップセット」を表示（例: `前回 60kg×10`）
	- 各種目カードに「前回：xxkg×yy」を表示
	- セット入力のUX改善（+1回/-1回、+2.5kg/-2.5kg、長押し連続、前セット自動複製）
	- 「カレンダーへ戻る」「この日へ」ボタン
	- ワークアウト削除ボタン（削除後はその日のページへ戻る）
- 種目管理（/exercises, /exercises/[id]）
	- 種目の追加/編集/削除
	- 部位タグ（複数選択）
	- 種目別の履歴表示（日時、各セット）

### テーマ/配色
- OS設定に追従するダークモード対応（`prefers-color-scheme`）
- アクセントは「頑張れる」グリーン（主要ボタン/今日の強調/マーカー）

### データ/モード
- Supabase モード: RLS によりユーザーごと完全分離（設計は [supabase/schema.sql](supabase/schema.sql) が正）
- ローカルモード: `NEXT_PUBLIC_GYMAPP_LOCAL_ONLY=1`
	- Supabase無しでサイト単体で動作（擬似ユーザーでログイン不要）
	- データは `c:\gymapp\.localdb.json` に保存
