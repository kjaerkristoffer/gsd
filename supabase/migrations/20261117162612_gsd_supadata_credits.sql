-- Supadata credit accounting. Each save remembers the credits it used; each day sums them per person;
-- the account's real balance (Supadata GET /v1/me) is cached in one row so the worker and the app can read it cheaply.
alter table public.items add column if not exists supadata_credits int not null default 0;
alter table public.usage_daily add column if not exists supadata_credits int not null default 0;

create table if not exists public.provider_account (
  provider text primary key,
  plan text,
  used_credits int not null default 0,
  max_credits int not null default 0,
  checked_at timestamptz not null default now()
);
alter table public.provider_account enable row level security;
-- Signed-in people may read the balance (it is the app's shared transcript account); only the function writes it.
drop policy if exists provider_account_read on public.provider_account;
create policy provider_account_read on public.provider_account for select to authenticated using (true);
grant select on public.provider_account to authenticated;

create or replace function public.bump_usage(p_user uuid, p_day date, p_field text, p_amount int)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if p_field not in ('captures','asks','transcribe_minutes','supadata_credits') then raise exception 'bad field'; end if;
  execute format('insert into usage_daily (user_id, day, %1$I) values ($1, $2, $3)
     on conflict (user_id, day) do update set %1$I = usage_daily.%1$I + $3 returning %1$I', p_field)
    into v using p_user, p_day, p_amount;
  return v;
end $$;
revoke execute on function public.bump_usage(uuid, date, text, int) from public, anon, authenticated;

-- Credits a worker run spent on one save: added to the save, to the person's day, and to the cached balance
-- (so the balance stays close to true between checks with Supadata).
create or replace function public.note_credits(p_item uuid, p_user uuid, p_n int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_n is null or p_n <= 0 then return; end if;
  update items set supadata_credits = supadata_credits + p_n where id = p_item;
  perform bump_usage(p_user, (now() at time zone 'utc')::date, 'supadata_credits', p_n);
  update provider_account set used_credits = used_credits + p_n where provider = 'supadata';
end $$;
revoke execute on function public.note_credits(uuid, uuid, int) from public, anon, authenticated;
