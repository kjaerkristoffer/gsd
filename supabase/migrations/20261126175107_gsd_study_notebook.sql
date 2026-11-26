-- Study: a notebook for anything you learn from (a podcast, a book, an article, a video), on a save or on one of its
-- children (an action that recommends one resource, e.g. one of five podcast episodes a reel recommends).
-- highlights: what you keep from it. kind: insight | quote | question | todo. at: where in it ("34:12", "p. 112").
-- A starred highlight shows under the Library's 💎 Wisdom filter.
create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  action_id uuid references public.actions(id) on delete cascade,
  kind text not null default 'insight' check (kind in ('insight', 'quote', 'question', 'todo')),
  text text not null check (length(btrim(text)) between 1 and 4000),
  at text not null default '' check (length(at) <= 24),
  starred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index highlights_user on public.highlights (user_id, created_at desc);
create index highlights_item on public.highlights (item_id);
create index highlights_action on public.highlights (action_id) where action_id is not null;
alter table public.highlights enable row level security;
create policy own_all on public.highlights for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.highlights from anon;
grant select, insert, update, delete on public.highlights to authenticated;

-- A highlight on a child must belong to that child's save, and both must be the person's own.
create or replace function public.highlights_check() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from items where id = new.item_id and user_id = new.user_id) then raise exception 'not_your_item'; end if;
  if new.action_id is not null and not exists (select 1 from actions where id = new.action_id and item_id = new.item_id and user_id = new.user_id) then
    raise exception 'not_this_items_action'; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger highlights_check before insert or update on public.highlights for each row execute function public.highlights_check();

-- study: the guide GSD writes on request (what to listen or read for, key ideas, chapters, verified sources).
-- position: where you left off ("41:05", "chapter 3", "p. 88").
alter table public.items add column study jsonb, add column position text not null default '' check (length(position) <= 40);
alter table public.actions add column study jsonb, add column position text not null default '' check (length(position) <= 40);
grant update (position) on public.items to authenticated;
revoke update (study) on public.actions from authenticated;
