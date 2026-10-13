# ホーム画面・通知・起動演出

## 実装内容

関連ファイル：`vite.config.ts`（manifest・Service Worker の設定）、`src/sw.ts`、`src/lib/pwa.ts`、`src/components/Splash.tsx`、`src/lib/notify.ts`、`src/components/AppSettings.tsx`、`supabase/notifications.sql`、`supabase/schedule-notifications.sql`、`supabase/functions/`（`_shared/reminders.ts` は通知判定の共通ロジックで、`src/lib/reminders.test.ts` でテスト）

- ホーム画面用 manifest / 192・512px アイコン / maskable アイコン。GitHub Pages の `/CELLender/` とルート配信に対応。
- 本番ビルド時に全アプリ静的ファイルをプリキャッシュ。初回オンライン起動・Service Worker準備後はオフラインでも表示・記録可能。外部フォントはキャッシュ対象外（代替フォントに切替）。Supabaseの認証や研究データはService Workerにキャッシュしない。
- 新版はバックグラウンドで準備。「設定 → 最新版に更新」で適用。入力中の画面を突然リロードしない。
- シンボル＋文字の約1.5秒の静かな起動演出。タップ・キー入力でスキップ。設定でOFF、reduced-motionでは省略。ページ起動ごとに1回で、タブ移動・復帰では再生しない。OS自身のスプラッシュはOS管理なので変更できない。
- 通知は初期OFF、端末ごとにON/OFF。ログインと明示的な通知許可が必要。ログアウト時もその端末の購読を解除。
- 毎日の予定まとめ（初期09:00）と時刻指定アッセイ（初期30分前、OFF/予定時刻/15/30/60分前）。完了・破棄・アーカイブ済み、削除済みの対象を除外。日付のみの予定は朝のまとめに含む。予定がない日は送らない。
- 通知タップで該当日の画面へ。ロック画面には細胞名や実験名を載せず、件数・時刻のみ表示。

## 一度だけ必要なSupabase設定

GitHub Pagesだけでは閉じたアプリに予定通知を送れません。以下のサーバー設定が済むまで通知欄は「準備中」と表示されます。フロントのビルドに秘密鍵は不要です。

1. 既存の `supabase/setup.sql` によるクラウド同期を先に用意し、続いて `supabase/notifications.sql` をSQL Editorで実行。
2. VAPID鍵を一度だけ作成：`npx web-push@3.6.7 generate-vapid-keys`。公開鍵・秘密鍵を保存し、再デプロイのたびに再生成しない。秘密鍵をGitHubやVITE_*に入れない。
3. SupabaseのEdge Function Secretsに以下を設定。秘密値はチャットへ貼り付けずダッシュボードで登録。

| 名前 | 内容 |
| --- | --- |
| VAPID_PUBLIC_KEY | 生成した公開鍵 |
| VAPID_PRIVATE_KEY | 生成した秘密鍵 |
| VAPID_SUBJECT | 管理者の連絡先（mailto:実際のメールアドレス） |
| CELLENDER_CRON_SECRET | パスワード生成器等で作った十分長いランダム文字列（32バイト以上推奨） |
| CELLENDER_APP_URL | https://mucin7777.github.io/CELLender/ |

SUPABASE_URLとSUPABASE_SERVICE_ROLE_KEYはホスト環境の既定値を使います。フロントには渡しません。

4. 認証済みSupabase CLIから対象プロジェクトへデプロイ：

```sh
supabase functions deploy cellender-push --project-ref hmhiglayyilleuyepftp
supabase functions deploy cellender-reminders --project-ref hmhiglayyilleuyepftp
```

`supabase/config.toml`でgatewayのJWTチェックを無効にしていますが、公開実行を許す意味ではありません。cellender-pushは関数内でauth.getUserによるJWT検証とuser_idによるアクセス制限を行い、cellender-remindersは専用のCron秘密値を検証します。

5. Supabase Vaultに `cellender_cron_secret` という名前で、SecretsのCELLENDER_CRON_SECRETと**同じ値**を保存。Cron/pg_net拡張を有効にして `supabase/schedule-notifications.sql` を実行。1分間隔で送信判定します。同じ名前で再実行するとジョブを更新します。
6. 本番アプリでログイン・クラウド同期を完了し、「設定 → 通知」をON、「テスト通知」を押す。まとめ通知を数分後に変更し、実際の端末でアプリを閉じた状態も確認。

iPhone/iPadはiOS 16.4以降でホーム画面へ追加し、そのアイコンから起動して許可してください。Android Chromeはアプリ内の追加ボタンまたはブラウザメニューを使用します。開発時の `npm run dev` ではService Workerは登録しません。検証は `npm run build && npm run preview` で行います。ローカルで通知APIも使う場合は、検証専用プロジェクトのCELLENDER_APP_URLをプレビューURLに合わせます。

## 動作と運用上の限界

- サーバーはクラウドに同期済みのデータを読むため、未同期・競合中の編集は通知に反映されません。端末が閉じていても送信可能ですが、通信・集中モード・省電力設定などにより遅延・未達があります。精密タイマー用途ではありません。
- 最大10分の送信遅延を取り戻し、古い通知を大量に送らないようにしています。10分を超えるCron停止中の通知は再送しません。
- 配信キーをDBで原子的に確保し、並行Cronの重複を防止。送信失敗・実行中断は3分後に再試行可能。送信直後の中断ではまれに再送され得ます（通知tagで同じ予定をまとめる）。送信履歴は30日後に整理。
- 期限切れ購読（404/410）は削除。OFF時にサーバーへ接続できなくても端末の購読を解除し、停止させます。
- 設定は端末ごとに保存。タイムゾーンはONにした端末から取得し、旅行後は通知設定で切替可能。DSTで存在しない時刻はスキップ。
- 個人・小規模利用向け。大量端末ではEdge Functionの実行時間上限を踏まえキュー分割を追加してください。
- Supabaseは別アプリと共用なので、既存テーブル・認証設定・Secretsを削除せず、cellender用の名前だけ追加してください。

## 検証

`npm test` / `npm run build` を実行。初回インストール、サブパスでのSWスコープ、オフライン再起動、更新、起動演出のOFF/reduced-motionを確認してください。SupabaseのSQLとEdge Functions、実端末への通知配信は別途上記手順で検証が必要です。

参考：
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- https://supabase.com/docs/guides/functions/schedule-functions
- https://github.com/web-push-libs/web-push
