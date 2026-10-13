-- cellender のクラウド同期用テーブル
-- Supabase の SQL Editor に貼り付けて 1 回実行してください（何度実行しても安全です）。
--
-- 1 ユーザーにつき 1 行。アプリの全データ（細胞ライン・継代・播種・アッセイ・予定）を JSON で保存します。
-- 行レベルセキュリティ（RLS）により、ログインした本人の行だけを読み書きできます。

create table if not exists public.cellender_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null,
  rev        bigint      not null default 1,   -- 更新のたびに +1（同時編集の検出に使う）
  updated_at timestamptz not null default now()
);

alter table public.cellender_state enable row level security;

drop policy if exists "cellender_state: select own" on public.cellender_state;
drop policy if exists "cellender_state: insert own" on public.cellender_state;
drop policy if exists "cellender_state: update own" on public.cellender_state;
drop policy if exists "cellender_state: delete own" on public.cellender_state;

create policy "cellender_state: select own" on public.cellender_state
  for select to authenticated using (auth.uid() = user_id);
create policy "cellender_state: insert own" on public.cellender_state
  for insert to authenticated with check (auth.uid() = user_id);
create policy "cellender_state: update own" on public.cellender_state
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "cellender_state: delete own" on public.cellender_state
  for delete to authenticated using (auth.uid() = user_id);

-- ログインしていない利用者（anon）には一切の権限を与えない
revoke all on public.cellender_state from anon;
grant select, insert, update, delete on public.cellender_state to authenticated;

-- 更新のたびに rev を +1 し、updated_at を更新する
create or replace function public.cellender_state_bump()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.rev := old.rev + 1;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists cellender_state_bump on public.cellender_state;
create trigger cellender_state_bump
  before update on public.cellender_state
  for each row execute function public.cellender_state_bump();

-- 他の端末での変更をすぐに受け取るため、リアルタイム配信に追加する
do $$
begin
  alter publication supabase_realtime add table public.cellender_state;
exception
  when duplicate_object then null;   -- すでに追加済み
  when undefined_object then null;   -- リアルタイムが無効なプロジェクト（定期確認で同期されます）
end;
$$;
