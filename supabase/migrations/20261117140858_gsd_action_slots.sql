-- Actions can take a Now slot (or a place in Up next) on their own, so three articles recommended
-- by one save can fill Now. Now (3) and Up next (5) are shared between saves and actions.

alter table public.actions
  add column if not exists lane text check (lane in ('now','next')),
  add column if not exists slot smallint check (slot between 1 and 3),
  add column if not exists lane_at timestamptz,
  add column if not exists next_pos double precision;
create unique index if not exists actions_now_slot on public.actions (user_id, slot) where lane = 'now';
create index if not exists actions_lane on public.actions (user_id, lane) where lane is not null;

-- History rows say which action they were. An open stay is unique per save, or per action.
alter table public.focus_log add column if not exists action_id uuid references public.actions(id) on delete set null;
drop index if exists public.focus_log_open;
create unique index if not exists focus_log_open_item on public.focus_log (item_id) where ended_at is null and action_id is null;
create unique index if not exists focus_log_open_action on public.focus_log (action_id) where ended_at is null;
alter table public.scroll_passes add column if not exists action_id uuid references public.actions(id) on delete set null;

-- Shared capacity: how many saves and actions are in a lane, and which Now slot is free.
create or replace function public.lane_count(p_user uuid, p_lane text, p_item uuid, p_action uuid) returns int
language sql stable security definer set search_path = public as $$
  select (select count(*) from items where user_id = p_user and lane = p_lane and id is distinct from p_item)::int
       + (select count(*) from actions where user_id = p_user and lane = p_lane and id is distinct from p_action)::int;
$$;
create or replace function public.free_slot(p_user uuid, p_item uuid, p_action uuid) returns int
language sql stable security definer set search_path = public as $$
  select min(g) from generate_series(1, 3) g
   where not exists (select 1 from items where user_id = p_user and lane = 'now' and slot = g and id is distinct from p_item)
     and not exists (select 1 from actions where user_id = p_user and lane = 'now' and slot = g and id is distinct from p_action);
$$;
create or replace function public.next_tail(p_user uuid) returns double precision
language sql stable security definer set search_path = public as $$
  select coalesce(greatest((select max(next_pos) from items where user_id = p_user and lane = 'next'),
                           (select max(next_pos) from actions where user_id = p_user and lane = 'next')), 0) + 1;
$$;
revoke execute on function public.lane_count(uuid, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.free_slot(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.next_tail(uuid) from public, anon, authenticated;

-- ---------- saves: same rules as before, now counting actions too ----------
create or replace function public.items_lane_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'let_go' then new.lane := null; end if;
  if new.lane is not null and new.status = 'inbox' then new.status := 'kept'; end if;
  if tg_op = 'INSERT' or new.lane is distinct from old.lane then
    new.lane_at := case when new.lane is null then null else now() end;
    if new.lane = 'now' then
      perform pg_advisory_xact_lock(hashtext('gsd_now_' || new.user_id::text));
      if lane_count(new.user_id, 'now', new.id, null) >= 3 then raise exception 'now_full' using hint = 'Now holds three things. Finish or park one first.'; end if;
      new.slot := free_slot(new.user_id, new.id, null); new.next_pos := null;
    elsif new.lane = 'next' then
      perform pg_advisory_xact_lock(hashtext('gsd_next_' || new.user_id::text));
      if lane_count(new.user_id, 'next', new.id, null) >= 5 then raise exception 'next_full' using hint = 'Up next holds five things.'; end if;
      new.slot := null;
      if new.next_pos is null then new.next_pos := next_tail(new.user_id); end if;
    else
      new.slot := null; new.next_pos := null;
    end if;
  end if;
  return new;
end $$;

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
     where item_id = new.id and action_id is null and ended_at is null;
    if new.plan_action_id is not null then
      if oc = 'done' then update actions set status = 'done', done_at = now() where id = new.plan_action_id and status <> 'done' and lane is null;
      else update actions set status = 'suggested' where id = new.plan_action_id and status = 'doing' and lane is null; end if;
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
      update focus_log set title = new.title, kind = new.kind where item_id = new.id and action_id is null and ended_at is null;
    end if;
    if new.plan_action_id is distinct from old.plan_action_id then
      if old.plan_action_id is not null then update actions set status = 'suggested' where id = old.plan_action_id and status = 'doing' and lane is null; end if;
      if new.plan_action_id is not null then update actions set status = 'doing', started_at = coalesce(started_at, now()) where id = new.plan_action_id and status = 'suggested'; end if;
    end if;
  end if;
  return null;
end $$;

create or replace function public.items_lane_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update focus_log set ended_at = now(), outcome = 'dropped' where item_id = old.id and action_id is null and ended_at is null;
  return old;
end $$;

-- ---------- actions in a lane ----------
create or replace function public.actions_lane_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('done', 'dismissed') then new.lane := null; end if;
  if tg_op = 'INSERT' or new.lane is distinct from old.lane then
    new.lane_at := case when new.lane is null then null else now() end;
    if new.lane = 'now' then
      perform pg_advisory_xact_lock(hashtext('gsd_now_' || new.user_id::text));
      if exists (select 1 from items where plan_action_id = new.id and lane = 'now') then
        raise exception 'already_plan' using hint = 'This is already in Now, as the plan of its save.';
      end if;
      if lane_count(new.user_id, 'now', null, new.id) >= 3 then raise exception 'now_full' using hint = 'Now holds three things. Finish or park one first.'; end if;
      new.slot := free_slot(new.user_id, null, new.id); new.next_pos := null;
      if new.status = 'suggested' then new.status := 'doing'; new.started_at := coalesce(new.started_at, now()); end if;
    elsif new.lane = 'next' then
      perform pg_advisory_xact_lock(hashtext('gsd_next_' || new.user_id::text));
      if lane_count(new.user_id, 'next', null, new.id) >= 5 then raise exception 'next_full' using hint = 'Up next holds five things.'; end if;
      new.slot := null;
      if new.next_pos is null then new.next_pos := next_tail(new.user_id); end if;
      if tg_op = 'UPDATE' and old.lane = 'now' and new.status = 'doing' then new.status := 'suggested'; end if;
    else
      new.slot := null; new.next_pos := null;
      if tg_op = 'UPDATE' and old.lane = 'now' and new.status = 'doing'
         and not exists (select 1 from items where plan_action_id = new.id and lane = 'now') then new.status := 'suggested'; end if;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.actions_lane_before() from public, anon, authenticated;
drop trigger if exists actions_lane_before on public.actions;
create trigger actions_lane_before before insert or update on public.actions for each row execute function public.actions_lane_before();

create or replace function public.actions_lane_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare was_now boolean := tg_op = 'UPDATE' and old.lane is not distinct from 'now';
        is_now boolean := new.lane is not distinct from 'now';
        oc text; mins int; cap int; banked int; k text;
begin
  if is_now and not was_now then
    -- What kind of thing it is: the recommended resource's type when there is one, else its save's kind.
    select coalesce(i.resources -> new.resource_idx ->> 'type', i.kind) into k from items i where i.id = new.item_id;
    insert into focus_log (user_id, item_id, action_id, title, kind)
    values (new.user_id, new.item_id, new.id, new.title, coalesce(k, 'other')) on conflict do nothing;
  elsif was_now and not is_now then
    oc := case when new.status = 'done' and old.status is distinct from 'done' then 'done'
               when new.status = 'dismissed' then 'dropped' else 'parked' end;
    update focus_log set ended_at = now(), outcome = oc, title = new.title where action_id = new.id and ended_at is null;
    if oc = 'done' then
      select pass_minutes, pass_cap into mins, cap from profiles where user_id = new.user_id;
      select count(*) into banked from scroll_passes where user_id = new.user_id and source = 'earned' and started_at is null;
      if banked < coalesce(cap, 3) then
        insert into scroll_passes (user_id, source, item_id, action_id, minutes) values (new.user_id, 'earned', new.item_id, new.id, coalesce(mins, 15));
      end if;
    end if;
  elsif is_now and was_now and new.title is distinct from old.title then
    update focus_log set title = new.title where action_id = new.id and ended_at is null;
  end if;
  return null;
end $$;
revoke execute on function public.actions_lane_after() from public, anon, authenticated;
drop trigger if exists actions_lane_after on public.actions;
create trigger actions_lane_after after insert or update on public.actions for each row execute function public.actions_lane_after();

create or replace function public.actions_lane_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update focus_log set ended_at = now(), outcome = 'dropped' where action_id = old.id and ended_at is null;
  return old;
end $$;
revoke execute on function public.actions_lane_delete() from public, anon, authenticated;
drop trigger if exists actions_lane_delete on public.actions;
create trigger actions_lane_delete before delete on public.actions for each row execute function public.actions_lane_delete();

-- A hunt needs Now to be empty of saves and actions.
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
    if p_mode = 'hunt' and lane_count(uid, 'now', null, null) > 0 then raise exception 'now_not_empty'; end if;
    insert into scroll_passes (user_id, source, minutes, started_at, ends_at, app)
    values (uid, p_mode, mins, now(), now() + make_interval(mins => mins), a) returning * into r;
  end if;
  insert into gate_events (user_id, app, choice) values (uid, a, p_mode);
  return r;
end $$;
revoke execute on function public.use_pass(text, text) from public, anon;
grant execute on function public.use_pass(text, text) to authenticated;
