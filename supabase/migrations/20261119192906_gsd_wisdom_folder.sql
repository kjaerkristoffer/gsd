-- Wisdom comes back as a Library folder: notes saved with "Also save the note to Wisdom" when finishing something land here.
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
    (10, 'Fashion', '👕', 'Wishlist', 'Got it', 'Clothes, shoes, style and outfits'),
    (11, 'Wisdom', '💎', 'To remember', 'Lived by', 'Your own notes and lessons, written when you finish something; not for saved links')
  ) as f(pos, name, emoji, todo, done, about)
  on conflict do nothing;
$$;
revoke execute on function public.seed_folders(uuid) from public, anon, authenticated;

-- Existing people: add Wisdom at the end of their folders (unless they already have one), then move their Wisdom notes in.
insert into public.folders (user_id, name, emoji, todo_label, done_label, about, pos)
select p.user_id, 'Wisdom', '💎', 'To remember', 'Lived by', 'Your own notes and lessons, written when you finish something; not for saved links',
  coalesce((select max(pos) from public.folders f where f.user_id = p.user_id), 0) + 1
from public.profiles p
on conflict do nothing;

update public.items i set folder_id = f.id, area_locked = true
from public.folders f
where f.user_id = i.user_id and lower(btrim(f.name)) = 'wisdom' and i.area = 'Wisdom' and i.source = 'note';
