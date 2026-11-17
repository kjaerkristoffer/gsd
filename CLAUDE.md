# GSD (Get Sh*t Done)

Personal inspiration-to-action web app. Vanilla JS frontend (no build step) on Vercel, Supabase backend.

- Frontend: `index.html`, `app.js` (supabase-js from CDN). Deploys from `main` on push.
- Backend: `supabase/functions/gsd/index.ts`, one Deno Edge Function with routes capture, worker, reprocess, ask, suggest, gate-check. verify_jwt is off; auth is done in code.
  Deploy: `supabase functions deploy gsd --project-ref dzyvmropxtvkdajzzkdw --no-verify-jwt`
- Database: schema was applied as migrations in the Supabase project (gsd_init ... gsd_country_and_preferences). Run `supabase db pull` once to bring them into `supabase/migrations/`.
- Secrets (set in Supabase, never in the repo): OPENAI_API_KEY, SUPADATA_API_KEY. Optional model overrides: MODEL_UNDERSTAND, MODEL_VISION, MODEL_ASK, MODEL_ENRICH, MODEL_EMBED.
- Core model, "Now": at most 3 things are active (slot 1-3), up to 5 wait in Up next (lane = 'next', ordered by next_pos). A thing is a whole save (items.lane) or a single action from a save (actions.lane), e.g. three articles one reel recommends; the caps are shared (lane_count/free_slot) and a save's plan action can't also take its own slot (already_plan). Now always fills from the front: compact_now renumbers 1..n whenever something leaves, and reorder_lane(lane, ids) saves drag-and-drop order for Now and Up next. everything else sits on Library shelves (derived from kind: Watch, Cook, Go, Read, Try, Move, Listen, Ideas, Wisdom). The caps, slot numbers, the focus_log history, plan-action status and earned scroll_passes are all enforced by triggers on items (migration gsd_now_slots); the app just sets lane. Finishing = clearing lane with done_at, done_count, rating (loved/good/meh), done_note. Every metric (weekly gauge, streak, passes, slips, turned back) is about Now.
- Scroll gate: an iPhone automation calls gate-check?app=instagram on app open; it returns open "yes" unless a pass is running. Passes are spent via the use_pass RPC (pass | hunt when Now is empty | slip).
- Pipeline: items table is a work queue; worker handles one item per run (read, understand, then find real links). Map links are resolved inside Postgres via pg_net.
- Design: black/white, system font, pill buttons, emoji icons, `data-theme` light/dark.
- Rules: output is always English; links prefer the person's country version (profiles.country); budget guide about $5/month of OpenAI.
