alter table public.items drop constraint if exists items_source_check;
alter table public.items add constraint items_source_check check (source in ('youtube','instagram','tiktok','x','facebook','reddit','web','note','image','maps'));
alter table public.items add column if not exists resources jsonb not null default '[]';
alter table public.items add column if not exists enrich_state text not null default 'none' check (enrich_state in ('none','pending','done'));
alter table public.actions add column if not exists link text;
alter table public.actions add column if not exists link_label text;
alter table public.actions add column if not exists resource_idx int;
alter table public.ai_calls add column if not exists searches int not null default 0;
alter table public.profiles add column if not exists watch_video boolean not null default true;
grant update (watch_video) on public.profiles to authenticated;

-- Work queue: items still being read, plus ready items waiting for links to be found.
create or replace function public.claim_items(p_n int) returns setof public.items
language plpgsql security definer set search_path = public as $$
begin
  update items set stage = 'failed', error_code = coalesce(error_code, 'provider_down')
   where stage not in ('ready','failed') and attempts >= 4;
  update items set enrich_state = 'none' where stage = 'ready' and enrich_state = 'pending' and attempts >= 3;
  return query
  update items set locked_until = now() + interval '3 minutes', attempts = attempts + 1
   where id in (select id from items
                 where (stage not in ('ready','failed') or (stage = 'ready' and enrich_state = 'pending'))
                   and next_attempt_at <= now()
                   and (locked_until is null or locked_until < now())
                 order by created_at limit p_n for update skip locked)
  returning *;
end $$;
revoke execute on function public.claim_items(int) from public, anon, authenticated;

select cron.unschedule('gsd-ingest');
select cron.schedule('gsd-ingest', '* * * * *', $$select public.call_internal('worker') where exists (select 1 from public.items where (stage not in ('ready','failed') or (stage = 'ready' and enrich_state = 'pending')) and next_attempt_at <= now())$$);;
