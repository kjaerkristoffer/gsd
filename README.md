# GSD — Get Sh*t Done

Save what inspires you. Do something with it. Live more.

## How it works
- **Now: three slots.** Only three saves are active at a time. Each has a plan (the one action that counts as doing it: cook it, watch it, go there). Up to five more wait in **Up next**; everything else lives on **Library shelves** (Watch, Cook, Go, Read, Try, Move, Listen, Ideas).
- **Finish to earn.** Finishing something in Now earns a scroll pass (15 min by default, bank up to 3). With Now empty, scrolling opens in time-boxed *hunts* to find what's next.
- **The gate.** An iPhone automation on Instagram, YouTube and TikTok checks `gate-check`; with no pass running, GSD opens first and shows your Now. "Open anyway" always works and is counted as a slip.
- **Done is a record.** Finishing asks how it was (😍 / 👍 / 😐) plus a note, so the Cook shelf builds a *Tried & tested* list, and Watch, Go and Read shelves keep what you've seen and been to.
- **Metrics are about Now:** the weekly gauge (finished vs your goal), streak of weeks, passes banked, minutes scrolled through passes, slips and times you turned back. You → *Your focus* shows eight weeks.
- Save from the iPhone share sheet with a Now / Up next / Library menu (or `#now` / `#next` in the text). Setup steps are in the app: You → Set up the iPhone.

## What is here
- `index.html`, `app.js` — the whole web app. No build step. Deploy the folder as a static site (Vercel: framework "Other", no build command).
- `manifest.webmanifest`, `icon-*.png` — install to the iPhone Home Screen / desktop.
- `vercel.json` — security headers.

## Backend (already live on Supabase project `dzyvmropxtvkdajzzkdw`)
- Database: migration `gsd_init` (19 tables, row-level security, queue-in-table, cron).
- Edge Function `gsd` with routes `capture`, `worker`, `reprocess`, `ask`, `suggest`, `gate-check`.
  Source lives in Supabase → Edge Functions → gsd.
- Secrets (Supabase → Edge Functions → Secrets): `OPENAI_API_KEY`, `SUPADATA_API_KEY`.
  Optional: `MODEL_UNDERSTAND`, `MODEL_VISION`, `MODEL_ASK`, `MODEL_EMBED`, `APP_ORIGINS`.

## Decisions that differ from the build specification
- Frontend is plain JavaScript without a build step (spec: React + Vite), so it could be tested and shipped from an environment without package installs.
- One Edge Function with routes instead of eight functions.
- The `items` table is the work queue (`claim_items`), instead of Supabase Queues.
- Sign-in is email + password (spec: emailed 6-digit code, which needs an email-template change).
- The first account created is the owner; later sign-ups need a row in `allowed_emails`.
- Ask returns the whole answer at once (spec: streamed).
- Bigger models than the spec: `gpt-6.1-sol` reads each save, `gpt-6.1-terra` with web search finds the real links. Roughly $0.05-0.10 per save; the You tab shows the month's estimate against a $5 guide.
- Short clips are also watched (Supadata extract) so on-screen text is read; toggle in You.
- Not built yet: push notifications, offline outbox, service worker, weekly review, collections, export/delete account, the swipe picker for films and recipes.

## After deploying
1. Supabase → Authentication → URL Configuration: set Site URL to the deployed address.
2. Optional: set the `APP_ORIGINS` secret to that address to lock the API to it.
