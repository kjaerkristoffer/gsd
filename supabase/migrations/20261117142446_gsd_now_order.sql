-- Now always fills from the front: when something leaves, the rest close up (1, 2, 3), so free slots are last.
-- The order can be changed by hand (drag and drop) with reorder_lane, for Now and for Up next.

-- Renumber what is in Now as 1..n: in p_order's order when given, otherwise keeping the current order.
-- Slots are cleared first so the per-table unique slot indexes never clash halfway through.
create or replace function public.compact_now(p_user uuid, p_order uuid[] default null) returns void
language plpgsql security definer set search_path = public as $$
declare ids uuid[]; ts text[]; sl int[];
begin
  perform pg_advisory_xact_lock(hashtext('gsd_now_' || p_user::text));
  select array_agg(id order by coalesce(array_position(p_order, id), 100 + slot), slot),
         array_agg(t order by coalesce(array_position(p_order, id), 100 + slot), slot),
         array_agg(slot::int order by coalesce(array_position(p_order, id), 100 + slot), slot)
    into ids, ts, sl
    from (select id, 'i'::text t, slot from items where user_id = p_user and lane = 'now'
          union all select id, 'a'::text, slot from actions where user_id = p_user and lane = 'now') x;
  if ids is null then return; end if;
  if sl = (select array_agg(g) from generate_series(1, array_length(ids, 1)) g) then return; end if; -- already in order
  update items set slot = null where user_id = p_user and lane = 'now' and slot is not null;
  update actions set slot = null where user_id = p_user and lane = 'now' and slot is not null;
  for k in 1 .. array_length(ids, 1) loop
    if ts[k] = 'i' then update items set slot = k where id = ids[k];
    else update actions set slot = k where id = ids[k]; end if;
  end loop;
end $$;
revoke execute on function public.compact_now(uuid, uuid[]) from public, anon, authenticated;

-- Drag and drop: the new order of Now or Up next, as a list of save and action ids.
create or replace function public.reorder_lane(p_lane text, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); ids uuid[];
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if p_lane = 'now' then perform compact_now(uid, p_ids);
  elsif p_lane = 'next' then
    perform pg_advisory_xact_lock(hashtext('gsd_next_' || uid::text));
    select array_agg(id order by coalesce(array_position(p_ids, id), 1000), next_pos) into ids
      from (select id, next_pos from items where user_id = uid and lane = 'next'
            union all select id, next_pos from actions where user_id = uid and lane = 'next') x;
    for k in 1 .. coalesce(array_length(ids, 1), 0) loop
      update items set next_pos = k where id = ids[k] and user_id = uid;
      update actions set next_pos = k where id = ids[k] and user_id = uid;
    end loop;
  else raise exception 'bad_lane';
  end if;
end $$;
revoke execute on function public.reorder_lane(text, uuid[]) from public, anon;
grant execute on function public.reorder_lane(text, uuid[]) to authenticated;

-- Close up the gap whenever a save or an action leaves Now (moved, finished, let go or deleted).
create or replace function public.now_close_gap() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.lane = 'now' then perform compact_now(old.user_id); end if;
  elsif old.lane = 'now' and new.lane is distinct from 'now' then
    perform compact_now(new.user_id);
  end if;
  return null;
end $$;
revoke execute on function public.now_close_gap() from public, anon, authenticated;
drop trigger if exists items_now_close_gap on public.items;
create trigger items_now_close_gap after update or delete on public.items for each row execute function public.now_close_gap();
drop trigger if exists actions_now_close_gap on public.actions;
create trigger actions_now_close_gap after update or delete on public.actions for each row execute function public.now_close_gap();

-- Close up any gaps there are today.
select public.compact_now(user_id) from public.profiles;
