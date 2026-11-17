-- Saver by default: a save is read with the cheap Supadata calls unless a full read is asked for.
alter table public.items add column if not exists deep_read boolean not null default false;
alter table public.profiles add column if not exists full_read boolean not null default false;
grant update (full_read) on public.profiles to authenticated;
