# cellender

細胞培養・アッセイのスケジュール管理 Web アプリ。
継代、播種、アッセイまでの予定と進捗をひとつのカレンダーでまとめて管理できます。

## 主な機能

スマートフォンでの利用を主に想定した、片手で操作しやすい画面構成です。

| タブ | できること |
| --- | --- |
| **カレンダー** | 2 週間表示。帯の**色＝細胞ライン**、帯の**形＝種類**（継代：淡い塗り／播種：淡い塗り＋点／培地交換：白地＋枠／アッセイ：濃い塗り）。左右スワイプで 2 週間ずつ移動。日付をタップするとその日の画面へ |
| **その日の画面** | その日の予定を一覧し、完了したらチェック（継代予定は丸を押すと継代の記録へ）。今日は「遅れているもの」も表示。前後の日へ移動可 |
| **細胞** | ライン・ロットの一覧（次の継代が近い順）。詳細画面から「継代する」「播種する」、継代履歴、アーカイブ |
| **＋（中央）** | 継代・播種・アッセイ・培地交換などをどの画面からでも追加 |
| **播種** | 培養中 / アッセイ（予定・実施履歴）/ 終了。詳細画面でアッセイのチェック、状態変更、同条件での再播種 |
| **設定** | JSON バックアップ / 復元、CSV 出力、週の始まり、サンプルデータ |

### デザインの方針

「細胞の成長と、実験の時間の循環」をイメージした、淡く落ち着いた清潔感のある配色です。

| 用途 | 色 | トークン |
| --- | --- | --- |
| テーマカラー | ソフトセージ `#A8CDBD` | `sage` |
| 選択部分・淡い塗り | ミント `#CEE7DD` | `mint` |
| メインボタン・選択中の輪郭 | ティール `#397D70` | `teal` |
| 未選択アイコン | グレーセージ `#7D928D` | `gray-sage` |
| 画面背景 | オフホワイト `#F7FAF8` | `canvas` |
| 本文 | ダークグリーングレー `#283E38` | `ink` |

- 色の値は `src/index.css` の `@theme` に集約（JS で必要な値は `src/lib/constants.ts` の `THEME`）。文字色は背景に対して 4.5:1 以上を確保
- 細胞ラインの色は、基準色から淡い色（帯・面）と濃い色（文字）を `src/lib/color.ts` の `lineTone()` で導出。エラー・遅れは落ち着いたレンガ色 `danger` で意味を保持
- 入力や詳細はボトムシート、基本項目以外は折りたたみ。タップできる要素は 44px 以上

### アセット

| 場所 | 内容 |
| --- | --- |
| `cellender-design-kit/assets/` | 受け取った原本画像 11 点（変更しない。横長ロゴ `cellender-logo.png`、マトリちゃん `lovematri-matri.png` を含む） |
| `src/assets/icons/` | ナビ用アイコン（`{calendar,cells,seeding,settings}-{default,active}.png`、144px） |
| `src/assets/brand/cellender-symbol.png` | 空状態用シンボル（384px） |
| `src/assets/brand/cellender-logo.png` | 横長ロゴ（高さ 192px・256 色。ロゴタイプはシンボルに対して 20% 小さく組み直し）。ヘッダー・ようこそ・設定で使う |
| `src/assets/brand/cellender-mark.png`, `cellender-wordmark.png` | 起動画面用（シンボルの下にロゴタイプ） |
| `src/assets/external/lovematri.png` | 設定の外部接続（LoveMatri）に出すマトリちゃん（144px） |
| `public/` | `favicon.ico`（16/32/48）、`favicon-16.png`、`favicon-32.png`、`apple-touch-icon.png`（180px・オフホワイト背景） |

原本から処理版を作り直すときは `python3 scripts/process-assets.py`（Pillow・numpy が必要）。
透過部分の薄いノイズと白フチを除去し、default / active が同じ位置・大きさで重なるよう余白を揃えています。

### 便利な操作フロー

- **継代する** ボタン 1 つで P 数 +1、継代履歴に記録、次回予定日を継代間隔から自動設定
- 継代の直後に「播種も記録」でそのまま播種登録へ（ライン・日付・P 数が自動入力）
- 播種登録時にアッセイ予定（播種から何日目か）と培地交換（N 日ごと）を一括登録
- アッセイの完了状況に応じて播種記録の状態を自動更新
- 予定の詳細から日付を変更（PC でも同じ操作）

## データの保存

データはブラウザの `localStorage` に自動保存されます（アプリを閉じても保持、オフラインでも操作可）。

### クラウド同期（PC とスマホで同じデータを使う）

**設定 → クラウド同期** からメールアドレスとパスワードでログインすると、データが Supabase に保存され、どの端末でも同じ内容になります。

- 変更は約 1 秒後に自動でクラウドへ送信。他の端末の変更は、リアルタイム通知・画面に戻ったとき・30 秒ごとの確認で取り込み
- 2 台で同時に編集して内容が食い違ったときは、黙って上書きせず「クラウドの内容を使う／この端末の内容を使う」を選ぶ画面を表示
- オフライン中の変更は、つながったときに送信。ログアウトしても端末のデータは残ります
- データは行レベルセキュリティ（RLS）により、ログインした本人しか読み書きできません

#### 初回だけ必要な準備（Supabase 側）

1. Supabase のプロジェクト（LoveMatri と同じ `hmhiglayyilleuyepftp`）を開き、**SQL Editor** で [`supabase/setup.sql`](supabase/setup.sql) の内容を貼り付けて実行
2. **Authentication → Sign In / Providers** で Email が有効になっていることを確認
3. （推奨）**Authentication → URL Configuration** の Redirect URLs に `https://mucin7777.github.io/CELLender/` を追加（確認メールのリンクからアプリに戻れるようになります）

接続先は `src/lib/cloud/config.ts`（ビルド時の環境変数 `VITE_SUPABASE_URL` / `VITE_SUPABASE_KEY` で上書き可）。
ここに書く Publishable キーは公開して問題ない値です。

ログインしない場合は、端末ごとにデータが分かれます。**設定 → バックアップを保存** で定期的にバックアップしてください。

## ホーム画面・オフライン・通知

ホーム画面に追加すると URL バーのない全画面で起動し、オフラインでも表示・記録できます。起動時にシンボルの演出（設定で OFF 可）が入ります。
予定の通知（毎朝のまとめ・時刻つきアッセイ）には Supabase 側の設定が一度だけ必要です。手順と仕様は [docs/PWA-NOTIFICATIONS.md](docs/PWA-NOTIFICATIONS.md) を参照してください。

## 開発

```bash
npm install
npm run dev        # 開発サーバー (http://localhost:5173)
npm test           # ユニットテスト (vitest)
npm run build      # 本番ビルド (dist/)
npm run preview    # ビルド結果のプレビュー
```

### 技術スタック

- React 18 + TypeScript + Vite
- Tailwind CSS v4
- Zustand（状態管理 + localStorage 永続化）
- Supabase（認証・クラウド同期。supabase-js は同期を使うときだけ読み込み）
- date-fns（日付計算・日本語ロケール）
- lucide-react（アイコン）

### 構成

```
src/
  types.ts              データモデル（CellLine / PassageRecord / Seeding / Assay / Task）
  store/useStore.ts     データストア（全操作・永続化）
  store/useUI.ts        モーダル・トーストの状態
  store/usePrefs.ts     表示設定（週の始まり、カレンダーの帯の表示）
  lib/cloud/            クラウド同期（sync.ts: 同期エンジン、supabaseBackend.ts: Supabase との通信）
supabase/setup.sql      クラウド側のテーブルとアクセス制御（RLS）
  lib/events.ts         データ → カレンダーイベントへの変換
  views/                各画面
  components/           フォーム・共通 UI
```

将来的に複数人で使う場合は、`useStore` の永続化先を Supabase / Firebase などのバックエンドに差し替えることで対応できます。

### デプロイ (GitHub Pages)

`main` ブランチへの push で `.github/workflows/deploy.yml` が実行されます。
初回のみリポジトリの **Settings → Pages → Source** を「GitHub Actions」に設定してください。
