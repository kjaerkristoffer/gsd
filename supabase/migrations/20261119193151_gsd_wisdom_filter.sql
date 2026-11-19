-- Wisdom is a Library filter (notes with area 'Wisdom', source 'note'), not a folder: undo gsd_wisdom_folder.
-- The starting set goes back to ten.
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

-- Wisdom notes leave their folder, and the Wisdom folders made for them go (only when nothing else is in them).
update public.items set folder_id = null where area = 'Wisdom' and source = 'note';
delete from public.folders f where lower(btrim(f.name)) = 'wisdom' and f.emoji = '💎'
  and not exists (select 1 from public.items i where i.folder_id = f.id);
