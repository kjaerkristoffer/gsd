-- Map links are resolved from the database's own network: Google and Apple answer it with the real page
-- (place name in the redirect address or the page title), which the function's runtime does not get.
create or replace function public.map_link_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.source = 'maps' and new.url ~ '^https://(maps\.app\.goo\.gl|goo\.gl|maps\.google\.com|(www\.)?google\.[a-z.]+|maps\.apple\.com|maps\.apple)/'
     and new.url !~ '(/maps/place/|[?&](name|q|address)=)' then
    new.provider_job := jsonb_build_object('map_req', net.http_get(
      url := new.url,
      headers := jsonb_build_object('User-Agent','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15','Accept-Language','en'),
      timeout_milliseconds := 10000));
  end if;
  return new;
end $$;
revoke execute on function public.map_link_before_insert() from public, anon, authenticated;
create or replace trigger items_map_link before insert on public.items for each row execute function public.map_link_before_insert();

create or replace function public.resolve_map_links() returns void
language plpgsql security definer set search_path = public as $$
declare r record; v_status int; v_loc text; v_content text; got boolean; tries int;
        newurl text; nm text; ttl text; addr text; q text; sep text;
begin
  for r in select id, url, (provider_job->>'map_req')::bigint as req from items
            where source = 'maps' and stage not in ('ready','failed') and provider_job ? 'map_req' loop
    tries := 0; got := false;
    loop
      select true, status_code, headers->>'location', content into got, v_status, v_loc, v_content from net._http_response where id = r.req;
      got := coalesce(got, false);
      exit when got or tries >= 14;
      perform pg_sleep(0.5); tries := tries + 1;
    end loop;
    newurl := r.url;
    if got then
      sep := case when r.url like '%?%' then '&' else '?' end;
      if v_loc is not null and v_loc ~ '/maps/(place|search)/' then
        newurl := case when v_loc like 'http%' then v_loc else 'https://www.google.com' || v_loc end;
      else
        nm := coalesce(nullif(substring(v_content from 'og:title"[^>]*content="([^"]*)'), ''), nullif(substring(v_content from 'content="([^"]*)"[^>]*og:title'), ''));
        ttl := substring(v_content from '<title[^>]*>([^<]*)');
        if nm is null or nm ~* '^\s*(google |apple )?maps\s*$' then
          nm := nullif(trim(regexp_replace(coalesce(ttl, ''), '( in .*)? - Apple Maps\s*$', '')), '');
          if nm ~* '^\s*(google |apple )?maps\s*$' then nm := null; end if;
        end if;
        addr := substring(ttl from ' in (.+) - Apple Maps');
        q := substring(v_content from '/maps/preview/place\?[^"]*[&;]q=([^&"]+)');
        if nm is not null then
          nm := replace(nm, '&amp;', '&');
          newurl := r.url || sep || 'name=' || replace(replace(replace(replace(replace(nm,'%','%25'),'&','%26'),'#','%23'),'+','%2B'),' ','%20')
                    || coalesce('&address=' || replace(replace(replace(replace(replace(replace(addr,'&amp;','&'),'%','%25'),'&','%26'),'#','%23'),'+','%2B'),' ','%20'), '');
        elsif q is not null then
          newurl := r.url || sep || 'q=' || q;
        end if;
      end if;
    end if;
    update items set url = newurl, provider_job = null where id = r.id;
  end loop;
end $$;
revoke execute on function public.resolve_map_links() from public, anon, authenticated;

create or replace function public.claim_items(p_n int) returns setof public.items
language plpgsql security definer set search_path = public as $$
begin
  perform public.resolve_map_links();
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
revoke execute on function public.claim_items(int) from public, anon, authenticated;;
