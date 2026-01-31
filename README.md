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
	- Authorized redirect URI は Supabase 側の Callback URL を設定
	  - 例: `https://<project-ref>.supabase.co/auth/v1/callback`

※ ローカル（UI調整）だけしたいときは `.env.local` の `NEXT_PUBLIC_GYMAPP_LOCAL_ONLY=1` に戻すと、ログイン不要で動きます。

## 画面（MVP）
- ログイン（Googleのみ）
- 月カレンダー（実施日マーク/今日枠/日付タップ遷移）
- 設定（ジムログインURLを保存、🏋️ ジムボタン表示）
- その日のワークアウト一覧（同日複数OK、種目・kg/回数を概要表示）
- ワークアウト入力/編集（種目/セット/前回コピー/削除）
- 種目管理（ユーザー専用マスタ、部位タグ、履歴）

## 仕様（現状 / MVP）

このセクションは「今の実装」の仕様をまとめたものです。
（方針: iPhone Safari 最優先 / 片手操作 / 短時間入力 / MVP範囲外の分析やSNSは扱わない）

### 1. アプリ概要
- 種目（ユーザー専用マスタ）を登録し、日付ごとにワークアウトを作成して「重量・回数」を記録する
- テンプレ（よくあるメニュー）を作成して、ワークアウトに適用できる
- 種目ごとの履歴・軌跡（伸び）を見られる

### 2. 動作モード
#### 2.1 Supabase モード（本番想定）
- Next.js（App Router）+ Supabase（Auth + Postgres）
- RLS によりユーザーごと完全分離
- DB設計の正は [supabase/schema.sql](supabase/schema.sql)

#### 2.2 ローカルモード（UI調整用）
- 環境変数: `NEXT_PUBLIC_GYMAPP_LOCAL_ONLY=1`
- Supabase無しで動作（ログイン不要）
- データ保存先: `.localdb.json`（リポジトリ直下 / gitignore対象）

### 3. データモデル（概念）
- exercises: 種目マスタ（ユーザーごと）
	- name（重複不可: user_id + lower(name)）
	- target_parts（胸/背中/肩/腕/脚/腹 の配列）
- workouts: その日のワークアウト（同一日複数可）
- workout_exercises: 1ワークアウトに含めた種目（並び順あり）
- exercise_sets: 1種目のセット（set_order、weight、reps）
- workout_templates / workout_template_exercises / workout_template_sets: テンプレ（ユーザーごと）
- user_settings: ジムログインURLなど

### 4. 画面/ルーティング
#### 4.1 カレンダー（/）
- 月カレンダー
	- 週の並びは「月〜日」
	- 記録がある日をマーク
	- 今日を強調
- 今月サマリー
	- トレ日数
	- 総セット数
	- 部位別セット数
- 「＋ 今日の記録」
	- 今日の日付でワークアウトを作成し、ワークアウト編集へ遷移

#### 4.2 日付ページ（/day/[date]）
- その日のワークアウト一覧（同日複数ワークアウト可）
- 一覧上で「種目名」と「セット概要（例: 60kg×10）」を短く表示
- 「この日のワークアウトを作成」ボタン

#### 4.3 ワークアウト編集（/workouts/[id]）
- 日付・メモはオートセーブ
- 種目追加
	- 部位別グループ表示
	- 検索（部分一致）で絞り込み可能
- 種目ブロック
	- 前回のトップセット（前回：60kg×10 など）を表示
	- セット行（重量/回数）を編集
	- ボタン:
		- 前回コピー（直近の同種目セットを複製）
		- セット＋（直前セットの重量/回数を複製して追加）
		- 種目削除
- 画面上部に戻る導線
	- カレンダーへ戻る
	- この日へ

#### 4.4 種目管理（/exercises, /exercises/[id]）
- 種目の追加/編集/削除
- 部位タグ（複数選択）
- 種目一覧は部位別セクション
- 種目別の履歴（日時、各セット）

#### 4.5 テンプレ（/templates, /templates/new）
- /templates/new
	- 新規テンプレ作成
- /templates
	- 既存テンプレ編集
	- テンプレから「今日のワークアウトを作成」（作成→テンプレ適用→ワークアウト編集へ遷移）
- テンプレ編集/作成のUI
	- 種目追加（部位別 + 検索）
	- セット編集（weight/reps）

#### 4.6 軌跡（/progress）
- 種目を選択（部位別 + 検索）
- 種目の伸びをグラフで表示
	- 表示点は「2週間ごと」の代表（その期間のベストセット）
	- ベストセット判定: 重量が高い → 同重量なら回数が多い
- 履歴リストから該当ワークアウトへ遷移

#### 4.7 設定（/settings）
- ジムログインURLを保存
- 設定するとヘッダーに「🏋️ ジム」ボタンが表示され、外部URLを開く

### 5. UX/入力（iPhone最優先）
- 主要な操作は「短時間で完了」することを優先
- ボタン/リンクに押下フィードバック（activeの縮み＋色変化）
- セット入力
	- inputMode（numeric/decimal）
	- ±ボタン（+2.5kg/-2.5kg、+1回/-1回）
	- 長押しで連続増減
	- 入力はオートセーブ

### 6. 初期データ（種目プリセット）
- 初回/不足時にプリセット種目のseedを行い、ユーザーの種目一覧に追加できる
- 既存ユーザーでも不足分を補完する（重複は追加しない）

### 7. 非対象（MVP範囲外）
- 体重/体脂肪の長期分析
- SNS共有/ランキング
- 複雑な集計（週次/部位別の詳細分析など）
- パーソナルな推定（1RMなど）

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
