create extension if not exists vector with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end $$;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  areas text[] not null default array[
    'Personal Growth','Learning & Knowledge','AI & Technology','Business & Career',
    'Creativity & Art','Health & Fitness','Books & Reading','Travel & Experiences',
    'Relationships','Lifestyle & Home','Finance','Mindfulness & Wellbeing'],
  interests text[] not null default '{}',
  goals text not null default '',
  daily_minutes int not null default 15 check (daily_minutes between 5 and 120),
  city text not null default '',
  language text not null default '',
  timezone text not null default 'Europe/Copenhagen',
  taste text not null default '',
  intention text not null default '',
  commitment text not null default 'none' check (commitment in ('none','action_first')),
  save_budget int check (save_budget between 1 and 100),
  transcribe_minutes int not null default 10 check (transcribe_minutes between 0 and 30),
  auto_remember boolean not null default false,
  notify_hour int not null default 8 check (notify_hour between 0 and 23),
  notify_focus boolean not null default true,
  notify_recall boolean not null default true,
  notify_review boolean not null default true,
  notify_ready boolean not null default true,
  purge_days int not null default 30 check (purge_days between 1 and 365),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create table public.allowed_emails (email text primary key);
create table public.app_config (key text primary key, value text not null);
insert into public.app_config values ('invite_only','true');

-- Invite-only: the first account ever created is always allowed (the owner); later ones need allowed_emails.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select value from app_config where key = 'invite_only') = 'true'
     and exists (select 1 from profiles)
     and not exists (select 1 from allowed_emails where lower(email) = lower(new.email)) then
    raise exception 'GSD is invite-only for now.';
  end if;
  insert into profiles (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  url text,
  canonical_url text,
  source text not null default 'web' check (source in ('youtube','instagram','tiktok','x','facebook','reddit','web','note','image')),
  via text not null default 'app' check (via in ('app','shortcut','share_target','bookmarklet','api')),
  kind text not null default 'other',
  title text not null default '',
  title_edited boolean not null default false,
  author text,
  thumb_path text,
  image_path text,
  start_seconds int,
  duration_seconds int,
  language text,
  published_at timestamptz,
  content_text text,
  transcript jsonb,
  summary text not null default '',
  insight text not null default '',
  takeaways jsonb not null default '[]',
  quotes jsonb not null default '[]',
  entities jsonb not null default '{}',
  area text not null default 'Other',
  area_locked boolean not null default false,
  tags text[] not null default '{}',
  note text not null default '',
  status text not null default 'inbox' check (status in ('inbox','kept','let_go')),
  let_go_at timestamptz,
  stage text not null default 'queued' check (stage in ('queued','resolving','fetching','understanding','ready','failed')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  locked_until timestamptz,
  error_code text,
  quality text check (quality in ('full','caption_only','title_only')),
  provider_job jsonb,
  resaved_count int not null default 0,
  last_saved_at timestamptz not null default now(),
  remember boolean not null default false,
  last_surfaced_at timestamptz,
  opened_count int not null default 0,
  embedding extensions.vector(1536),
  fts tsvector generated always as (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(note,''))) stored,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index items_user_canonical on public.items (user_id, canonical_url) where canonical_url is not null;
create index items_user_created on public.items (user_id, created_at desc);
create index items_queue on public.items (next_attempt_at) where stage not in ('ready','failed');
create index items_tags on public.items using gin (tags);
create index items_fts on public.items using gin (fts);
create index items_embedding on public.items using hnsw (embedding extensions.vector_cosine_ops);
create trigger items_touch before update on public.items for each row execute function public.touch_updated_at();

create table public.item_chunks (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  idx int not null,
  content text not null,
  start_ms int,
  embedding extensions.vector(1536) not null,
  fts tsvector generated always as (to_tsvector('simple', content)) stored,
  unique (item_id, idx)
);
create index item_chunks_embedding on public.item_chunks using hnsw (embedding extensions.vector_cosine_ops);
create index item_chunks_fts on public.item_chunks using gin (fts);
create index item_chunks_user on public.item_chunks (user_id);

create table public.item_links (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_a uuid not null references public.items(id) on delete cascade,
  item_b uuid not null references public.items(id) on delete cascade,
  sentence text not null,
  created_at timestamptz not null default now(),
  primary key (item_a, item_b)
);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null, emoji text not null default '',
  created_at timestamptz not null default now()
);
create table public.collection_items (
  collection_id uuid not null references public.collections(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  primary key (collection_id, item_id)
);

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  title text not null,
  why text not null default '',
  minutes int not null default 15 check (minutes between 1 and 480),
  first_step text not null default '',
  steps jsonb not null default '[]',
  mode text not null default 'grow' check (mode in ('learn','create','build','grow','experience')),
  effort text not null default 'real' check (effort in ('tiny','real')),
  context text not null default 'anywhere' check (context in ('anywhere','home','computer','out')),
  origin text not null default 'ai' check (origin in ('ai','user','ask')),
  status text not null default 'suggested' check (status in ('suggested','doing','done','dismissed')),
  planned_for date,
  reflection text not null default '',
  again boolean,
  started_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index actions_user_status on public.actions (user_id, status, created_at desc);
create index actions_item on public.actions (item_id);
create trigger actions_touch before update on public.actions for each row execute function public.touch_updated_at();

create table public.daily_focus (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  action_id uuid references public.actions(id) on delete set null,
  state text not null default 'offered' check (state in ('offered','accepted','done','skipped')),
  swaps int not null default 0,
  primary key (user_id, day)
);

create table public.recall_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  q text not null, a text not null,
  active boolean not null default false,
  step int not null default 0,
  due date,
  last_result text check (last_result in ('got','almost','forgot')),
  reviewed_at timestamptz
);
create index recall_due on public.recall_cards (user_id, due) where active;
create index recall_item on public.recall_cards (item_id);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  target int not null default 3 check (target between 1 and 50),
  period text not null default 'week' check (period in ('week','month')),
  mode text check (mode in ('learn','create','build','grow','experience')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null, headline text not null, body text not null,
  themes jsonb not null default '[]',
  nudge_action_id uuid references public.actions(id) on delete set null,
  stats jsonb not null default '{}', seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);
create table public.checkins (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day date not null,
  worth text not null check (worth in ('yes','meh','no')),
  note text not null default '',
  primary key (user_id, day)
);
create table public.gate_events (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  app text not null default '',
  choice text not null check (choice in ('did_it','do_now','skipped')),
  created_at timestamptz not null default now()
);
create table public.capture_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default 'iPhone Shortcut',
  token_hash text not null unique,
  last_used_at timestamptz, revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique, p256dh text not null, auth text not null,
  user_agent text not null default '', last_ok_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  captures int not null default 0, asks int not null default 0, transcribe_minutes int not null default 0,
  primary key (user_id, day)
);
create table public.ai_calls (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  job text not null, model text not null,
  in_tokens int not null default 0, out_tokens int not null default 0, ms int not null default 0,
  ok boolean not null default true,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['items','collections','collection_items','actions','daily_focus','challenges','checkins','gate_events','capture_tokens','push_subscriptions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy own_all on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
  foreach t in array array['profiles','recall_cards','reviews'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy own_select on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
    execute format('create policy own_update on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
  foreach t in array array['item_chunks','item_links','usage_daily','ai_calls'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy own_select on public.%I for select to authenticated using (user_id = (select auth.uid()))', t);
  end loop;
end $$;
alter table public.allowed_emails enable row level security;
alter table public.app_config enable row level security;

revoke update on public.items from authenticated;
grant update (title, title_edited, note, status, let_go_at, area, area_locked, tags, remember, last_surfaced_at, opened_count, kind) on public.items to authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name, areas, interests, goals, daily_minutes, city, language, timezone, intention, commitment, save_budget, transcribe_minutes, auto_remember, notify_hour, notify_focus, notify_recall, notify_review, notify_ready, purge_days, onboarded_at) on public.profiles to authenticated;
revoke update on public.recall_cards from authenticated;
grant update (active, step, due, last_result, reviewed_at) on public.recall_cards to authenticated;
revoke update on public.reviews from authenticated;
grant update (seen_at) on public.reviews to authenticated;
revoke all on public.items, public.profiles, public.actions, public.item_chunks, public.recall_cards from anon;

create or replace function public.match_library(query_text text, query_embedding extensions.vector(1536), match_count int default 24)
returns table (chunk_id uuid, item_id uuid, content text, start_ms int, score double precision)
language sql stable security invoker set search_path = public, extensions as $$
  with sem as (
    select c.id, row_number() over (order by c.embedding <=> query_embedding) as rn
    from item_chunks c join items i on i.id = c.item_id
    where i.status <> 'let_go' order by c.embedding <=> query_embedding limit 40),
  kw as (
    select c.id, row_number() over (order by ts_rank_cd(c.fts, websearch_to_tsquery('simple', query_text)) desc) as rn
    from item_chunks c join items i on i.id = c.item_id
    where i.status <> 'let_go' and c.fts @@ websearch_to_tsquery('simple', query_text) limit 40)
  select c.id, c.item_id, c.content, c.start_ms,
         (coalesce(1.0 / (60 + sem.rn), 0) + coalesce(1.0 / (60 + kw.rn), 0))::double precision as score
  from item_chunks c left join sem on sem.id = c.id left join kw on kw.id = c.id
  where sem.id is not null or kw.id is not null
  order by score desc limit match_count;
$$;

create or replace function public.related_items(p_item uuid, p_count int default 5)
returns table (item_id uuid, similarity double precision)
language sql stable security invoker set search_path = public, extensions as $$
  select i.id, (1 - (i.embedding <=> src.embedding))::double precision
  from items i, (select embedding from items where id = p_item) src
  where i.id <> p_item and i.status <> 'let_go' and i.embedding is not null and src.embedding is not null
  order by i.embedding <=> src.embedding limit p_count;
$$;

create or replace function public.bump_usage(p_user uuid, p_day date, p_field text, p_amount int)
returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if p_field not in ('captures','asks','transcribe_minutes') then raise exception 'bad field'; end if;
  execute format('insert into usage_daily (user_id, day, %1$I) values ($1, $2, $3)
     on conflict (user_id, day) do update set %1$I = usage_daily.%1$I + $3 returning %1$I', p_field)
    into v using p_user, p_day, p_amount;
  return v;
end $$;
revoke execute on function public.bump_usage(uuid, date, text, int) from public, anon, authenticated;

-- The items table is the work queue: claim up to p_n items that are due and not locked.
create or replace function public.claim_items(p_n int) returns setof public.items
language plpgsql security definer set search_path = public as $$
begin
  update items set stage = 'failed', error_code = coalesce(error_code, 'provider_down')
   where stage not in ('ready','failed') and attempts >= 4;
  return query
  update items set locked_until = now() + interval '3 minutes', attempts = attempts + 1
   where id in (select id from items
                 where stage not in ('ready','failed') and next_attempt_at <= now()
                   and (locked_until is null or locked_until < now())
                 order by created_at limit p_n for update skip locked)
  returning *;
end $$;
revoke execute on function public.claim_items(int) from public, anon, authenticated;

-- Internal secret lives only in Vault; functions verify it through this check.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'gsd_internal');
create or replace function public.check_internal(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'gsd_internal' and decrypted_secret = p);
$$;
revoke execute on function public.check_internal(text) from public, anon, authenticated;

create or replace function public.call_internal(path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://dzyvmropxtvkdajzzkdw.supabase.co/functions/v1/gsd/' || path,
    headers := jsonb_build_object('Content-Type','application/json','x-internal-secret',
               (select decrypted_secret from vault.decrypted_secrets where name = 'gsd_internal')),
    body := '{}'::jsonb, timeout_milliseconds := 5000);
end $$;
revoke execute on function public.call_internal(text) from public, anon, authenticated;

-- When a save is queued, start the worker right away.
create or replace function public.kick_worker() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform public.call_internal('worker'); return new; end $$;
create trigger items_kick after insert on public.items for each row execute function public.kick_worker();

select cron.schedule('gsd-ingest', '* * * * *', $$select public.call_internal('worker') where exists (select 1 from public.items where stage not in ('ready','failed') and next_attempt_at <= now())$$);
select cron.schedule('gsd-purge', '15 3 * * *', $$
  delete from public.items i using public.profiles p
   where p.user_id = i.user_id and i.status = 'let_go' and i.let_go_at < now() - make_interval(days => p.purge_days);
  delete from public.ai_calls where created_at < now() - interval '90 days';
  delete from public.usage_daily where day < current_date - 90;
$$);

alter publication supabase_realtime add table public.items, public.actions;

insert into storage.buckets (id, name, public) values ('captures','captures', false), ('thumbs','thumbs', true) on conflict (id) do nothing;
create policy captures_own on storage.objects for all to authenticated
  using (bucket_id = 'captures' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'captures' and (storage.foldername(name))[1] = (select auth.uid())::text);;
