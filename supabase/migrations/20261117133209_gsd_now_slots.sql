-- GSD "Now": three slots you commit to, a short Up next queue, a done record on every save,
-- and scroll passes you earn by finishing what is in Now.

-- ---------- items: lanes and the done record ----------
alter table public.items
  add column if not exists lane text check (lane in ('now','next')),
  add column if not exists slot smallint check (slot between 1 and 3),
  add column if not exists lane_at timestamptz,
  add column if not exists next_pos double precision,
  add column if not exists plan_action_id uuid references public.actions(id) on delete set null,
  add column if not exists done_at timestamptz,
  add column if not exists done_count int not null default 0,
  add column if not exists rating text check (rating in ('loved','good','meh')),
  add column if not exists done_note text not null default '';
create unique index if not exists items_now_slot on public.items (user_id, slot) where lane = 'now';
create index if not exists items_lane on public.items (user_id, lane) where lane is not null;
grant update (lane, next_pos, plan_action_id, done_at, done_count, rating, done_note) on public.items to authenticated;

-- The one action that counts as having done the save (cook it, watch it, go there).
alter table public.actions add column if not exists is_primary boolean not null default false;

-- ---------- profiles: the rules ----------
alter table public.profiles
  add column if not exists weekly_goal int not null default 3 check (weekly_goal between 1 and 21),
  add column if not exists pass_minutes int not null default 15 check (pass_minutes between 5 and 60),
  add column if not exists pass_cap int not null default 3 check (pass_cap between 1 and 6);
grant update (weekly_goal, pass_minutes, pass_cap) on public.profiles to authenticated;

-- ---------- history of everything that went through Now ----------
create table if not exists public.focus_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  title text not null default '',
  kind text not null default 'other',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  outcome text check (outcome in ('done','parked','dropped')),
  rating text
);
create unique index if not exists focus_log_open on public.focus_log (item_id) where ended_at is null;
create index if not exists focus_log_user on public.focus_log (user_id, started_at desc);
alter table public.focus_log enable row level security;
create policy own_select on public.focus_log for select to authenticated using (user_id = (select auth.uid()));

-- ---------- scroll passes ----------
-- earned: banked when a Now item is finished, spent when started from the gate.
-- hunt:   Now is empty, so a time-boxed scroll to find what is next.
-- slip:   opened anyway. Allowed, and counted.
create table if not exists public.scroll_passes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('earned','hunt','slip')),
  item_id uuid references public.items(id) on delete set null,
  minutes int not null check (minutes between 1 and 120),
  earned_at timestamptz not null default now(),
  started_at timestamptz,
  ends_at timestamptz,
  app text not null default ''
);
create index if not exists scroll_passes_user on public.scroll_passes (user_id, earned_at desc);
create index if not exists scroll_passes_banked on public.scroll_passes (user_id) where source = 'earned' and started_at is null;
alter table public.scroll_passes enable row level security;
create policy own_select on public.scroll_passes for select to authenticated using (user_id = (select auth.uid()));

alter table public.gate_events drop constraint if exists gate_events_choice_check;
alter table public.gate_events add constraint gate_events_choice_check check (choice in ('did_it','do_now','skipped','shown','pass','hunt','slip'));

-- ---------- lane rules (slots, caps, ordering) ----------
create or replace function public.items_lane_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int; s int;
begin
  if new.status = 'let_go' then new.lane := null; end if;
  if new.lane is not null and new.status = 'inbox' then new.status := 'kept'; end if;
  if tg_op = 'INSERT' or new.lane is distinct from old.lane then
    new.lane_at := case when new.lane is null then null else now() end;
    if new.lane = 'now' then
      perform pg_advisory_xact_lock(hashtext('gsd_now_' || new.user_id::text));
      select count(*) into n from items where user_id = new.user_id and lane = 'now' and id <> new.id;
      if n >= 3 then raise exception 'now_full' using hint = 'Now holds three things. Finish or park one first.'; end if;
      select min(g) into s from generate_series(1, 3) g
       where not exists (select 1 from items where user_id = new.user_id and lane = 'now' and slot = g and id <> new.id);
      new.slot := s; new.next_pos := null;
    elsif new.lane = 'next' then
      perform pg_advisory_xact_lock(hashtext('gsd_next_' || new.user_id::text));
      select count(*) into n from items where user_id = new.user_id and lane = 'next' and id <> new.id;
      if n >= 5 then raise exception 'next_full' using hint = 'Up next holds five things.'; end if;
      new.slot := null;
      if new.next_pos is null then
        select coalesce(max(next_pos), 0) + 1 into new.next_pos from items where user_id = new.user_id and lane = 'next' and id <> new.id;
      end if;
    else
      new.slot := null; new.next_pos := null;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.items_lane_before() from public, anon, authenticated;
drop trigger if exists items_lane_before on public.items;
create trigger items_lane_before before insert or update on public.items for each row execute function public.items_lane_before();

-- ---------- history, plan actions and earned passes ----------
create or replace function public.items_lane_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare was_now boolean := tg_op = 'UPDATE' and old.lane is not distinct from 'now';
        is_now boolean := new.lane is not distinct from 'now';
        oc text; mins int; cap int; banked int;
begin
  if is_now and not was_now then
    insert into focus_log (user_id, item_id, title, kind) values (new.user_id, new.id, new.title, new.kind) on conflict do nothing;
    if new.plan_action_id is not null then
      update actions set status = 'doing', started_at = coalesce(started_at, now()) where id = new.plan_action_id and status = 'suggested';
    end if;
  elsif was_now and not is_now then
    oc := case when new.done_at is not null and new.done_at is distinct from old.done_at then 'done'
               when new.status = 'let_go' then 'dropped' else 'parked' end;
    update focus_log set ended_at = now(), outcome = oc, rating = new.rating, title = new.title, kind = new.kind
     where item_id = new.id and ended_at is null;
    if new.plan_action_id is not null then
      if oc = 'done' then update actions set status = 'done', done_at = now() where id = new.plan_action_id and status <> 'done';
      else update actions set status = 'suggested' where id = new.plan_action_id and status = 'doing'; end if;
    end if;
    if oc = 'done' then
      select pass_minutes, pass_cap into mins, cap from profiles where user_id = new.user_id;
      select count(*) into banked from scroll_passes where user_id = new.user_id and source = 'earned' and started_at is null;
      if banked < coalesce(cap, 3) then
        insert into scroll_passes (user_id, source, item_id, minutes) values (new.user_id, 'earned', new.id, coalesce(mins, 15));
      end if;
    end if;
  elsif is_now and was_now then
    if new.title is distinct from old.title or new.kind is distinct from old.kind then
      update focus_log set title = new.title, kind = new.kind where item_id = new.id and ended_at is null;
    end if;
    if new.plan_action_id is distinct from old.plan_action_id then
      if old.plan_action_id is not null then update actions set status = 'suggested' where id = old.plan_action_id and status = 'doing'; end if;
      if new.plan_action_id is not null then update actions set status = 'doing', started_at = coalesce(started_at, now()) where id = new.plan_action_id and status = 'suggested'; end if;
    end if;
  end if;
  return null;
end $$;
revoke execute on function public.items_lane_after() from public, anon, authenticated;
drop trigger if exists items_lane_after on public.items;
create trigger items_lane_after after insert or update on public.items for each row execute function public.items_lane_after();

create or replace function public.items_lane_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update focus_log set ended_at = now(), outcome = 'dropped' where item_id = old.id and ended_at is null;
  return old;
end $$;
revoke execute on function public.items_lane_delete() from public, anon, authenticated;
drop trigger if exists items_lane_delete on public.items;
create trigger items_lane_delete before delete on public.items for each row execute function public.items_lane_delete();

-- ---------- spending a pass ----------
create or replace function public.use_pass(p_mode text, p_app text default '') returns public.scroll_passes
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r scroll_passes; mins int; a text := left(lower(coalesce(p_app, '')), 40);
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if p_mode not in ('pass','hunt','slip') then raise exception 'bad_mode'; end if;
  select * into r from scroll_passes where user_id = uid and ends_at > now() order by ends_at desc limit 1;
  if found then return r; end if;
  select pass_minutes into mins from profiles where user_id = uid;
  mins := coalesce(mins, 15);
  if p_mode = 'pass' then
    select * into r from scroll_passes where user_id = uid and source = 'earned' and started_at is null order by earned_at limit 1 for update skip locked;
    if not found then raise exception 'no_pass'; end if;
    update scroll_passes set started_at = now(), ends_at = now() + make_interval(mins => r.minutes), app = a where id = r.id returning * into r;
  else
    if p_mode = 'hunt' and exists (select 1 from items where user_id = uid and lane = 'now') then raise exception 'now_not_empty'; end if;
    insert into scroll_passes (user_id, source, minutes, started_at, ends_at, app)
    values (uid, p_mode, mins, now(), now() + make_interval(mins => mins), a) returning * into r;
  end if;
  insert into gate_events (user_id, app, choice) values (uid, a, p_mode);
  return r;
end $$;
revoke execute on function public.use_pass(text, text) from public, anon;
grant execute on function public.use_pass(text, text) to authenticated;

create or replace function public.end_pass() returns void
language sql security definer set search_path = public as $$
  update scroll_passes set ends_at = now() where user_id = auth.uid() and ends_at > now();
$$;
revoke execute on function public.end_pass() from public, anon;
grant execute on function public.end_pass() to authenticated;

-- ---------- carry over: saves with an action in progress go into Now ----------
do $$
declare r record;
begin
  for r in select distinct on (a.item_id) a.item_id, a.id from actions a join items i on i.id = a.item_id
            where a.status = 'doing' and i.status <> 'let_go' and i.lane is null order by a.item_id, a.started_at desc nulls last loop
    begin
      update items set lane = 'now', plan_action_id = r.id where id = r.item_id;
    exception when others then
      update items set lane = 'next', plan_action_id = r.id where id = r.item_id;
    end;
  end loop;
end $$;
-- Done actions mark their save as done (no passes for history).
update items i set done_at = d.done_at, done_count = greatest(i.done_count, 1)
  from (select item_id, max(done_at) done_at from actions where status = 'done' and item_id is not null group by item_id) d
 where d.item_id = i.id and i.done_at is null and i.lane is null;
