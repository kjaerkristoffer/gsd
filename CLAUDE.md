# GSD (Get Sh*t Done)

Personal inspiration-to-action web app. Vanilla JS frontend (no build step) on Vercel, Supabase backend.

- Frontend: `index.html`, `app.js` (supabase-js from CDN). Deploys from `main` on push.
- Backend: `supabase/functions/gsd/index.ts`, one Deno Edge Function with routes capture, worker, reprocess, ask, suggest, gate-check. verify_jwt is off; auth is done in code.
  Deploy: `supabase functions deploy gsd --project-ref dzyvmropxtvkdajzzkdw --no-verify-jwt`
- Database: schema was applied as migrations in the Supabase project (gsd_init ... gsd_country_and_preferences). Run `supabase db pull` once to bring them into `supabase/migrations/`.
- Secrets (set in Supabase, never in the repo): OPENAI_API_KEY, SUPADATA_API_KEY. Optional model overrides: MODEL_UNDERSTAND, MODEL_VISION, MODEL_ASK, MODEL_ENRICH, MODEL_EMBED.
- Pipeline: items table is a work queue; worker handles one item per run (read, understand, then find real links). Map links are resolved inside Postgres via pg_net.
- Design: black/white, system font, pill buttons, emoji icons, `data-theme` light/dark.
- Rules: output is always English; links prefer the person's country version (profiles.country); budget guide about $5/month of OpenAI.
