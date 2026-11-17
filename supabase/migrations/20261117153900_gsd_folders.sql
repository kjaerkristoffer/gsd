-- Folders: one set of Library folders the person owns and orders (they replace both shelves and areas).
-- Every save sits in at most one folder (items.folder_id; null = Unsorted). The worker picks one for each new save
-- unless the person chose it (items.area_locked). Each folder names its own filters, e.g. "To cook" / "Tried & tested".
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  emoji text not null default '📁' check (length(emoji) between 1 and 16),
  todo_label text not null default 'To do' check (length(btrim(todo_label)) between 1 and 30),
  done_label text not null default 'Done' check (length(btrim(done_label)) between 1 and 30),
  about text not null default '' check (length(about) <= 200),
  pos int not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index folders_name on public.folders (user_id, lower(btrim(name)));
create index folders_user_pos on public.folders (user_id, pos);
alter table public.folders enable row level security;
create policy own_all on public.folders for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.folders from anon;
grant select, insert, update, delete on public.folders to authenticated;

-- A save can only point at its owner's folder; deleting a folder makes its saves Unsorted.
alter table public.items add column folder_id uuid;
alter table public.items add constraint items_folder_fk foreign key (folder_id, user_id)
  references public.folders (id, user_id) on delete set null (folder_id);
create index items_folder on public.items (folder_id) where folder_id is not null;

-- The starting set.
create or replace function public.seed_folders(p_user uuid) returns void
language sql security definer set search_path = public as $$
  insert into folders (user_id, name, emoji, todo_label, done_label, about, pos)
  select p_user, f.name, f.emoji, f.todo, f.done, f.about, f.pos
  from (values
    (1, 'Personal Growth', '🌱', 'To do', 'Done', 'Habits, mindset, productivity, careers, advice and articles on living well'),
    (2, 'Restaurants', '🍜', 'To try', 'Been there', 'Restaurants, cafés, bars, bakeries and food spots to visit'),
    (3, 'Home', '🏠', 'To do', 'Done', 'Interior, furniture, IKEA hacks, storage, cleaning, garden and things for the home'),
    (4, 'Movies', '🎬', 'To watch', 'Watched', 'Films, series and documentaries to watch'),
    (5, 'Books', '📚', 'To read', 'Read', 'Books and long reads'),
    (6, 'Recipes', '🍳', 'To cook', 'Tried & tested', 'Recipes, dishes, drinks and cooking techniques'),
    (7, 'Workout', '🏋️', 'To do', 'Done', 'Workouts, training programmes, mobility, running and health'),
    (8, 'Golf', '⛳', 'To practice', 'Practiced', 'Golf swing tips, drills, courses and gear'),
    (9, 'AI', '🤖', 'To try', 'Tried', 'AI tools, models, prompts, apps and tech to build with'),
    (10, 'Fashion', '👕', 'Wishlist', 'Got it', 'Clothes, shoes, style and outfits')
  ) as f(pos, name, emoji, todo, done, about)
  on conflict do nothing;
$$;
revoke execute on function public.seed_folders(uuid) from public, anon, authenticated;

create or replace function public.profiles_seed_folders() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform seed_folders(new.user_id); return new; end $$;
revoke execute on function public.profiles_seed_folders() from public, anon, authenticated;
create trigger profiles_seed_folders after insert on public.profiles for each row execute function public.profiles_seed_folders();

-- Saves the order of the folders (ids in the new order). Row-level security keeps it to your own.
create or replace function public.reorder_folders(p_ids uuid[]) returns void
language sql security invoker set search_path = public as $$
  update folders set pos = array_position(p_ids, id) where id = any(p_ids) and user_id = (select auth.uid());
$$;
revoke execute on function public.reorder_folders(uuid[]) from public, anon;
grant execute on function public.reorder_folders(uuid[]) to authenticated;

-- Existing people and saves.
select public.seed_folders(user_id) from public.profiles;
update public.items i set folder_id = f.id
from public.folders f
where f.user_id = i.user_id and i.folder_id is null and f.name = case
  when i.kind = 'recipe' then 'Recipes'
  when i.kind in ('film', 'show') then 'Movies'
  when i.kind = 'book' then 'Books'
  when i.kind = 'workout' or i.area = 'Health & Fitness' then 'Workout'
  when i.kind = 'place' then 'Restaurants'
  when i.area = 'Lifestyle & Home' then 'Home'
  when i.area = 'AI & Technology' or i.kind = 'tool' then 'AI'
  when i.area in ('Personal Growth', 'Learning & Knowledge', 'Business & Career', 'Mindfulness & Wellbeing', 'Wisdom') then 'Personal Growth'
  when i.area = 'Books & Reading' then 'Books'
end;
