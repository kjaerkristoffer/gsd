alter table public.profiles add column if not exists country text not null default 'Denmark';
alter table public.profiles add column if not exists preferences text not null default '';
grant update (country, preferences) on public.profiles to authenticated;;
