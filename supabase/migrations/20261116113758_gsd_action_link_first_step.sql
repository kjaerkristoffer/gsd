-- When a real link is attached to an action, a first step that says "search for it" is out of date.
create or replace function public.action_link_first_step() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.link is not null and (old.link is null or old.link is distinct from new.link) and new.first_step ~* '^\s*(search|look up|google|find)\M' then
    new.first_step := case
      when new.link_label in ('Read it','Read the paper') then 'Open it and read the first two paragraphs.'
      when new.link_label = 'Open the repo' then 'Open the repository and read the README.'
      when new.link_label = 'Where to watch' then 'Open it and see where you can watch it.'
      when new.link_label in ('Play it','Watch it') then 'Open it and play the first two minutes.'
      when new.link_label = 'Website' then 'Open the website and check when it is open.'
      else 'Open the link and take a first look.' end;
  end if;
  return new;
end $$;
revoke execute on function public.action_link_first_step() from public, anon, authenticated;
drop trigger if exists actions_link_first_step on public.actions;
create trigger actions_link_first_step before update on public.actions for each row execute function public.action_link_first_step();
-- Apply to links found before this rule existed.
update public.actions set first_step = case
      when link_label in ('Read it','Read the paper') then 'Open it and read the first two paragraphs.'
      when link_label = 'Open the repo' then 'Open the repository and read the README.'
      else 'Open the link and take a first look.' end
 where link is not null and first_step ~* '^\s*(search|look up|google|find)\M';;
