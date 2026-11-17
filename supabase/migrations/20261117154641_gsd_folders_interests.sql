-- "What you care about" now picks from folders: carry the old area names over to their folders.
update public.profiles p set interests = coalesce((
  select array_agg(distinct f.name) from unnest(p.interests) a(x)
  join public.folders f on f.user_id = p.user_id and f.name = case a.x
    when 'Personal Growth' then 'Personal Growth' when 'Learning & Knowledge' then 'Personal Growth' when 'Business & Career' then 'Personal Growth'
    when 'Mindfulness & Wellbeing' then 'Personal Growth' when 'AI & Technology' then 'AI' when 'Health & Fitness' then 'Workout'
    when 'Books & Reading' then 'Books' when 'Lifestyle & Home' then 'Home' else a.x end), '{}');
