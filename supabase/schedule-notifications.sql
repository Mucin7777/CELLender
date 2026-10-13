-- cellender の通知を 1 分ごとに判定するジョブ
-- 前提：
--   1. supabase/notifications.sql を実行済み
--   2. Edge Function の cellender-reminders をデプロイ済み
--   3. Supabase Vault に「cellender_cron_secret」という名前で、
--      Edge Function Secrets の CELLENDER_CRON_SECRET と同じ値を保存済み
-- 同じ名前で再実行すると、ジョブの内容が更新されます。

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'cellender-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://hmhiglayyilleuyepftp.supabase.co/functions/v1/cellender-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cellender_cron_secret' limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
