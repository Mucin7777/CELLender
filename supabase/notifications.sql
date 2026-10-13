-- cellender のプッシュ通知用テーブル
-- supabase/setup.sql（クラウド同期）を実行したあとに、SQL Editor で 1 回実行してください（再実行しても安全）。
-- 既存の他アプリのテーブルには触れず、cellender_ で始まる名前だけを追加します。

-- 端末ごとの通知の購読と設定
create table if not exists public.cellender_push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  daily_enabled boolean not null default true,
  daily_time    text    not null default '09:00' check (daily_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  assay_lead    integer default 30 check (assay_lead is null or assay_lead in (0, 15, 30, 60)),
  timezone      text    not null default 'Asia/Tokyo',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists cellender_push_subscriptions_user on public.cellender_push_subscriptions (user_id);

-- 送信履歴（同じ通知を二重に送らないためのキー）
create table if not exists public.cellender_push_deliveries (
  subscription_id uuid not null references public.cellender_push_subscriptions (id) on delete cascade,
  key             text not null,
  status          text not null default 'sending' check (status in ('sending', 'sent')),
  claimed_at      timestamptz not null default now(),
  sent_at         timestamptz,
  primary key (subscription_id, key)
);
create index if not exists cellender_push_deliveries_claimed on public.cellender_push_deliveries (claimed_at);

-- どちらのテーブルも Edge Function（サービスロール）からだけ扱う。ブラウザからは直接読み書きできない
alter table public.cellender_push_subscriptions enable row level security;
alter table public.cellender_push_deliveries enable row level security;
revoke all on public.cellender_push_subscriptions from anon, authenticated;
revoke all on public.cellender_push_deliveries from anon, authenticated;

-- 送信の権利を原子的に確保する。
-- 未送信なら確保して true。送信済み、または他の実行が 3 分以内に確保中なら false。
-- 送信に失敗・中断した場合は、3 分後に別の実行が再び確保できる。
create or replace function public.cellender_claim_delivery(p_subscription uuid, p_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean;
begin
  insert into public.cellender_push_deliveries (subscription_id, key)
  values (p_subscription, p_key)
  on conflict (subscription_id, key) do update
    set claimed_at = now(), status = 'sending'
    where cellender_push_deliveries.status <> 'sent'
      and cellender_push_deliveries.claimed_at < now() - interval '3 minutes'
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

revoke all on function public.cellender_claim_delivery(uuid, text) from public, anon, authenticated;
