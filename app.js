"use strict";
/* GSD web app. No build step: this file + index.html + supabase-js from the CDN. */
const CFG = { url: "https://dzyvmropxtvkdajzzkdw.supabase.co", key: "sb_publishable_sRyymLJo8ksNKnBn2fz1fA_x4wEYwS2" };

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : "" } catch { return "" } };
const iso = (d = new Date()) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d) };
const now = () => new Date().toISOString();
const ago = t => { const d = Math.floor((Date.now() - new Date(t)) / 864e5); return d < 1 ? "today" : d === 1 ? "yesterday" : d < 30 ? d + " days ago" : d < 365 ? Math.floor(d / 30) + " mo ago" : Math.floor(d / 365) + " y ago" };
const KIND = { video: "▶️", film: "🎬", show: "📺", article: "📚", place: "📍", recipe: "🍽️", book: "📖", quote: "💬", idea: "💡", tool: "🛠️", workout: "🏃", product: "🛍️", event: "🎟️", music: "🎵", note: "📝", other: "✨" };
// Library shelves: what you would do with a save. Its kind puts it on one shelf.
const SHELF = Object.fromEntries([
  ["watch", "🎬", "Watch", ["film", "show", "video"], "To watch", "Watched"],
  ["cook", "🍳", "Cook", ["recipe"], "To cook", "Tried & tested"],
  ["go", "📍", "Go", ["place", "event"], "To go", "Been there"],
  ["read", "📖", "Read", ["book", "article"], "To read", "Read"],
  ["try", "🛠️", "Try", ["tool", "product"], "To try", "Tried"],
  ["move", "🏃", "Move", ["workout"], "To do", "Done"],
  ["listen", "🎵", "Listen", ["music"], "To play", "Played"],
  ["ideas", "💡", "Ideas", ["idea", "quote", "note", "other"], "Open", "Done"],
  ["wisdom", "💎", "Wisdom", [], "", ""],
].map(([key, em, name, kinds, todo, done], order) => [key, { key, em, name, kinds, todo, done, order }]));
const shelfOf = it => it.area === "Wisdom" && it.source === "note" ? SHELF.wisdom : Object.values(SHELF).find(s => s.kinds.includes(it.kind)) || SHELF.ideas;
// Library folders: the person's own set, in their order (folders table). A save sits in one; without one it is Unsorted.
// Each folder names its two filters, e.g. Recipes: "To cook" / "Tried & tested".
const UNSORTED = { id: "none", emoji: "🗂️", name: "Unsorted", todo_label: "To do", done_label: "Done", about: "" };
const fById = id => id === "none" ? UNSORTED : S.folders.find(f => f.id === id) || null;
const folderOf = it => S.folders.find(f => f.id === it.folder_id) || UNSORTED;
// Notes kept with "Also save the note to Wisdom" live under the Library's 💎 Wisdom filter, not in a folder.
const isWis = i => i.area === "Wisdom" && i.source === "note";
const inFolder = (f, l = live()) => l.filter(i => !isWis(i) && folderOf(i).id === f.id);
const fLabel = f => `${f.emoji} ${f.name}`;
const RANK = { loved: 3, good: 2, meh: 1 };
const byRating = (a, b) => (RANK[b.rating] || 0) - (RANK[a.rating] || 0) || (b.done_count || 0) - (a.done_count || 0) || new Date(b.done_at) - new Date(a.done_at);
// A new folder's emoji and filters, guessed from its name. All editable.
const FGUESS = [
  [/film|movie|series|\bshows?\b|\btv\b|watch|documentar|cinema/i, "🎬", "To watch", "Watched"],
  [/recipe|cook|food|bak|dinner|lunch|meal|dessert|drink|cocktail/i, "🍳", "To cook", "Tried & tested"],
  [/restaurant|caf[eé]|\bbars?\b|\beat|brunch|coffee|wine/i, "🍜", "To try", "Been there"],
  [/book|read|novel|article/i, "📚", "To read", "Read"],
  [/travel|trip|holiday|vacation|hotel|destination|place|city|cities|countr/i, "✈️", "To go", "Been there"],
  [/music|song|album|playlist|podcast|listen/i, "🎧", "To listen", "Listened"],
  [/game/i, "🎮", "To play", "Played"],
  [/fashion|cloth|style|outfit|shoe|wardrobe|shop|gift|wish/i, "🛍️", "Wishlist", "Got it"],
  [/golf|tennis|padel|football|ski|surf|climb/i, "🏅", "To practice", "Practiced"],
  [/workout|gym|fitness|\brun|train|yoga|sport|health|mobility/i, "🏋️", "To do", "Done"],
  [/\bai\b|tech|tool|\bapps?\b|code|coding|software|startup/i, "🤖", "To try", "Tried"],
  [/art|draw|paint|design|craft|photo|creative|diy/i, "🎨", "To make", "Made"],
  [/learn|course|study|language|skill/i, "🎓", "To learn", "Learned"],
  [/home|house|garden|interior|furniture|clean/i, "🏠", "To do", "Done"],
];
const guessFolder = name => { const g = FGUESS.find(([re]) => re.test(name)); return g ? { emoji: g[1], todo_label: g[2], done_label: g[3] } : { emoji: "📁", todo_label: "To do", done_label: "Done" } };
const VERB = { recipe: "Cooked", film: "Watched", show: "Watched", video: "Watched", place: "Been there", event: "Went", book: "Read", article: "Read", workout: "Done", tool: "Tried", product: "Tried", music: "Played" };
const MARK = { recipe: "I cooked it", film: "I watched it", show: "I watched it", video: "I watched it", place: "I went", event: "I went", book: "I read it", article: "I read it", music: "I played it", tool: "I tried it", product: "I tried it" };
const doneVerb = it => VERB[it.kind] || "Done";
const markOf = it => MARK[it.kind] || "I did it";
const RATE = { loved: ["😍", "Loved it"], good: ["👍", "Good"], meh: ["😐", "Meh"] };
const tested = it => !!it.done_at && it.rating !== "meh"; // tried, and worth doing again
const APPS = { instagram: "Instagram", youtube: "YouTube", tiktok: "TikTok", x: "X", twitter: "X", facebook: "Facebook", reddit: "Reddit" };
const JW = { denmark: "dk", sweden: "se", norway: "no", finland: "fi", germany: "de", netherlands: "nl", france: "fr", spain: "es", italy: "it", "united kingdom": "uk", uk: "uk", england: "uk", "united states": "us", usa: "us", us: "us", canada: "ca", australia: "au" };
const MODE = { learn: ["📚", "Learn"], create: ["🎨", "Create"], build: ["🛠️", "Build"], grow: ["🌱", "Grow"], experience: ["📍", "Experience"] };
const RES = { article: "📰", book: "📖", paper: "📄", film: "🎬", show: "📺", podcast: "🎧", video: "▶️", tool: "🛠️", repo: "💻", course: "🎓", product: "🛍️", place: "📍", person: "👤", music: "🎵", other: "✨" };
const RES_LABEL = { article: "Read it", paper: "Read the paper", book: "See the book", film: "Where to watch", show: "Where to watch", podcast: "Play it", video: "Watch it", tool: "Open it", repo: "Open the repo", course: "Open the course", place: "Website", product: "See it", person: "Their page", music: "Play it", other: "Open it" };
// Rough OpenAI prices in dollars per million tokens (input, output), plus one cent per web search.
const PRICE = { "gpt-6-luna": [.1, .5], "gpt-6.1-terra": [1, 5], "gpt-6.1-sol": [2, 10], "gpt-6-astra": [10, 50], "text-embedding-3-small": [.02, 0] };
const BUDGET = 5;
const LADDER = [1, 3, 7, 14, 30, 60, 120];
const ITEM_COLS = "id,url,canonical_url,source,kind,title,author,thumb_path,start_seconds,summary,insight,takeaways,quotes,entities,area,tags,note,status,stage,error_code,quality,resaved_count,remember,last_surfaced_at,opened_count,created_at,diag,resources,enrich_state,lane,slot,lane_at,next_pos,plan_action_id,done_at,done_count,rating,done_note,folder_id,area_locked,deep_read,supadata_credits,duration_seconds";
const ERR = {
  private_or_missing: "This post is private or was removed. GSD can only read public links.",
  unreadable: "GSD couldn't read this page. You can still add your own note.",
  unsupported_type: "This kind of file isn't supported yet.",
  provider_down: "Reading it took too long. Tap Re-read to try again.",
  ai_error: "Something went wrong understanding this. Tap Re-read.",
  no_content: "The reader couldn't get anything from this post. It may be private, or the reader service refused it. Tap Re-read to try again.",
  reader_not_configured: "The transcript key isn't working (Supabase → Edge Functions → Secrets → SUPADATA_API_KEY). Then tap Re-read.",
  reader_limit: "Out of transcript credits, and there was nothing free to read. Tap Re-read when Supadata renews (You shows the balance).",
  ai_not_configured: "The AI key isn't set up yet (Supabase → Edge Functions → Secrets → OPENAI_API_KEY). Then tap Re-read.",
};
function toast(m, undo) {
  const t = $("#toast");
  t.innerHTML = `<div class="toast" role="status">${esc(m)}${undo ? ` <button data-act="undo" style="text-decoration:underline;margin-left:8px">Undo</button>` : ""}</div>`;
  toast.undo = undo; clearTimeout(toast.t); toast.t = setTimeout(() => { t.innerHTML = ""; toast.undo = null }, undo ? 5000 : 2600);
}
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return (h >>> 0) / 4294967296 };

/* ---------- theme ---------- */
const themePref = () => { try { return localStorage.getItem("gsd_theme") || "auto" } catch { return "auto" } };
function applyTheme() {
  const p = themePref(), dark = p === "dark" || (p === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  $("#themecolor")?.setAttribute("content", dark ? "#000000" : "#f2f2f5");
  if ($(".iv")) setThemeColor();
  return dark;
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { applyTheme(); if (S.screen === "app") render() });

/* ---------- state ---------- */
const S = { screen: "boot", user: null, profile: null, items: [], actions: [], cards: [], log: [], passes: [], gates: [], tokens: [],
  tab: "now", sheet: null, q: "", fid: "", shelfTab: "todo", lib: "folders", folder: "", folders: [], mode: "inspire", seen: new Set(), ask: null,
  authMode: "in", authMsg: "", busy: false, related: {}, more: false, newToken: "" };
let sb = null, confirmDel = null;

/* ---------- data ---------- */
const must = r => { if (r.error) throw r.error; return r.data };
const api = {
  async load() {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const [p, i, a, c, u, f] = await Promise.all([
      sb.from("profiles").select("*").eq("user_id", S.user.id).maybeSingle(),
      sb.from("items").select(ITEM_COLS).order("created_at", { ascending: false }).limit(1000),
      sb.from("actions").select("*").order("created_at", { ascending: false }).limit(3000),
      sb.from("recall_cards").select("id,item_id,q,a,active,step,due").limit(5000),
      sb.from("ai_calls").select("job,model,in_tokens,out_tokens,searches").gte("created_at", monthStart).limit(5000),
      sb.from("folders").select("*").order("pos").order("created_at"),
      api.loadFocus(),
    ]);
    S.profile = must(p); S.items = must(i); S.actions = must(a); S.cards = must(c); S.usage = u.data || []; S.folders = must(f);
  },
  // Now's history, the scroll passes and the gate's pauses: what the gauge and the stats are made of.
  async loadFocus() {
    const since = new Date(Date.now() - 140 * 864e5).toISOString();
    const [l, ps, g] = await Promise.all([
      sb.from("focus_log").select("*").or(`ended_at.is.null,started_at.gte."${since}"`).order("started_at", { ascending: false }).limit(2000),
      sb.from("scroll_passes").select("*").or(`started_at.is.null,earned_at.gte."${since}"`).order("earned_at", { ascending: false }).limit(2000),
      sb.from("gate_events").select("choice,app,created_at").gte("created_at", since).order("created_at", { ascending: false }).limit(5000),
    ]);
    S.log = must(l); S.passes = must(ps); S.gates = must(g);
  },
  async upd(table, id, patch) {
    const key = table === "recall_cards" ? "cards" : table;
    const r = S[key].find(x => x.id === id), before = r && { ...r };
    if (r) Object.assign(r, patch);
    const { error } = await sb.from(table).update(patch).eq("id", id);
    if (error) { if (r) Object.assign(r, before); toast("Couldn't save that change"); throw error }
  },
  async ins(table, row) { const data = must(await sb.from(table).insert(row).select().single()); S[table].unshift(data); return data },
  async del(table, id) { S[table] = S[table].filter(x => x.id !== id); const { error } = await sb.from(table).delete().eq("id", id); if (error) toast("Couldn't delete") },
  async profile(patch) {
    Object.assign(S.profile, patch);
    const { error } = await sb.from("profiles").update(patch).eq("user_id", S.user.id);
    if (error) toast("Couldn't save settings");
  },
  // Supadata transcript credits: the account's real balance and what GSD spent this month (see the credits route).
  async loadCredits() { const r = await api.fn("credits", {}); if (r && !r.error) S.credits = r; return S.credits },
  async fn(route, body) {
    const { data, error } = await sb.functions.invoke("gsd/" + route, { body });
    if (error) { let j = {}; try { j = await error.context.json() } catch {} return { error: j.error || "error", message: j.message || error.message } }
    return data;
  },
  async refreshItem(id) {
    const [i, a, c] = await Promise.all([
      sb.from("items").select(ITEM_COLS).eq("id", id).maybeSingle(),
      sb.from("actions").select("*").eq("item_id", id),
      sb.from("recall_cards").select("id,item_id,q,a,active,step,due").eq("item_id", id),
    ]);
    if (i.error) return null;
    if (!i.data) { S.items = S.items.filter(x => x.id !== id); return null }
    const cur = item(id); if (cur) Object.assign(cur, i.data); else S.items.unshift(i.data);
    if (a.data) S.actions = [...a.data, ...S.actions.filter(x => x.item_id !== id)];
    if (c.data) S.cards = [...c.data, ...S.cards.filter(x => x.item_id !== id)];
    return i.data;
  },
  // A new folder. Its filters and emoji are guessed from the name; a leading emoji in the name is used as its emoji.
  async addFolder(raw) {
    let name = String(raw || "").replace(/\s+/g, " ").trim(), emoji = "";
    const m = name.match(/^(\p{Extended_Pictographic}[\u{FE0F}\u{200D}\u{1F3FB}-\u{1F3FF}\p{Extended_Pictographic}]*)\s*(.*)$/u);
    if (m && m[2]) { emoji = m[1]; name = m[2] }
    name = name.slice(0, 40); if (!name) return null;
    const ex = S.folders.find(f => f.name.toLowerCase() === name.toLowerCase()); if (ex) return ex;
    const g = guessFolder(name), row = { name, ...g, ...(emoji ? { emoji } : {}), pos: Math.max(0, ...S.folders.map(f => f.pos)) + 1 };
    const { data, error } = await sb.from("folders").insert(row).select().single();
    if (error) { console.error(error); toast("Couldn't add the folder"); return null }
    S.folders.push(data); return data;
  },
  // A note kept when finishing something, shown under the Library's 💎 Wisdom filter.
  async saveWisdom(text, from) {
    const { data, error } = await sb.from("items").insert({ source: "note", kind: "quote", via: "app", title: text.split("\n")[0].slice(0, 80), summary: text, insight: text.slice(0, 240), content_text: text,
      area: "Wisdom", area_locked: true, folder_id: null, status: "kept", stage: "ready", quality: "full", note: "From: " + from }).select(ITEM_COLS).single();
    if (error) { console.error(error); toast("Couldn't save to Wisdom"); return false }
    S.items.unshift(data); return true;
  },
  async refreshActs(id) { const { data } = await sb.from("actions").select("*").eq("item_id", id); if (data) S.actions = [...data, ...S.actions.filter(x => x.item_id !== id)] },
  // Move a save or a single action between Now, Up next and the library.
  async move(id, lane, extra = {}) {
    if (!actOf(id)) return api.lane(id, lane, extra);
    const { data, error } = await sb.from("actions").update({ lane, ...extra }).eq("id", id).select("*").single();
    if (error) { const m = error.message || ""; for (const k of ["now_full", "next_full", "already_plan"]) if (m.includes(k)) return k; console.error(error); toast("Couldn't move it"); return "error" }
    Object.assign(actOf(id), data); closeGaps();
    return "ok";
  },
  // Move a save between Now, Up next and the library. The database checks the caps, picks the slot and keeps the history.
  async lane(id, lane, extra = {}) {
    const { data, error } = await sb.from("items").update({ lane, ...extra }).eq("id", id).select(ITEM_COLS).single();
    if (error) { const m = error.message || ""; if (/now_full/.test(m)) return "now_full"; if (/next_full/.test(m)) return "next_full"; console.error(error); toast("Couldn't move it"); return "error" }
    const cur = item(id); if (cur) Object.assign(cur, data); else S.items.unshift(data);
    await api.refreshActs(id); closeGaps();
    return "ok";
  },
};

/* ---------- derived ---------- */
const item = id => S.items.find(i => i.id === id);
const pending = i => !["ready", "failed"].includes(i.stage);
const busy = i => pending(i) || i.enrich_state === "pending";
function spend() {
  let total = 0, saves = 0;
  for (const c of S.usage || []) { const p = PRICE[c.model] || [2, 10]; total += (c.in_tokens * p[0] + c.out_tokens * p[1]) / 1e6 + (c.searches || 0) * .01; if (c.job === "understand") saves++ }
  return { total, saves };
}
const live = () => S.items.filter(i => i.status !== "let_go");
const inbox = () => S.items.filter(i => i.status === "inbox" && !i.lane && !pending(i));
const dueCards = () => S.cards.filter(c => c.active && c.due && c.due <= iso() && item(c.item_id) && item(c.item_id).status !== "let_go").sort((a, b) => a.due < b.due ? -1 : 1).slice(0, 5);
const thumbUrl = it => it.thumb_path ? `${CFG.url}/storage/v1/object/public/thumbs/${it.thumb_path}` : "";
// Now (three slots) and Up next (five, in order) hold whole saves and single actions, side by side.
const isAct = x => !!x && "first_step" in x;
const actOf = id => S.actions.find(a => a.id === id);
const entry = id => item(id) || actOf(id);
const nowItems = () => [...S.items.filter(i => i.lane === "now"), ...S.actions.filter(a => a.lane === "now")].sort((a, b) => a.slot - b.slot);
const nextItems = () => [...S.items.filter(i => i.lane === "next"), ...S.actions.filter(a => a.lane === "next")].sort((a, b) => a.next_pos - b.next_pos);
// Now fills from the front: what is in it is numbered 1..n in order, free slots come last (as the database does).
const closeGaps = () => nowItems().forEach((x, k) => { x.slot = k + 1 });
const itemActs = id => S.actions.filter(a => a.item_id === id && a.status !== "dismissed");
// The plan: what doing a whole save means. Your pick, else the action that counts as doing it, else the first idea.
// An action that sits in Now or Up next on its own is not the save's plan.
function planOf(it) {
  const acts = itemActs(it.id), open = acts.filter(a => a.status !== "done" && !a.lane);
  return acts.find(a => a.id === it.plan_action_id && !a.lane) || open.find(a => a.is_primary) || open.sort((x, y) => (x.resource_idx ?? 99) - (y.resource_idx ?? 99))[0] || null;
}
// An action's own icon: what it recommends (article, film, repo…), else its kind of action.
const actEm = a => { const r = item(a.item_id)?.resources?.[a.resource_idx]; return r ? RES[r.type] || "✨" : (MODE[a.mode] || MODE.grow)[0] };
const actType = a => { const r = item(a.item_id)?.resources?.[a.resource_idx]; return r ? cap1(r.type) : (MODE[a.mode] || MODE.grow)[1] };
const daysIn = it => it.lane_at ? Math.floor((Date.now() - new Date(it.lane_at)) / 864e5) : 0;
const goal = () => S.profile.weekly_goal || 3;
const passMin = () => S.profile.pass_minutes || 15;
const passTimer = () => { try { return localStorage.getItem("gsd_passtimer") === "1" } catch { return false } };
const banked = () => S.passes.filter(p => p.source === "earned" && !p.started_at);
const activePass = () => S.passes.find(p => p.ends_at && new Date(p.ends_at) > Date.now());
const minsLeft = p => Math.max(1, Math.ceil((new Date(p.ends_at) - Date.now()) / 60000));
// Weeks start on Monday. off = 0 is this week, 1 is last week.
function weekStart(off = 0) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7) - 7 * off); return d }
const inWeek = (t, off) => { const x = new Date(t); return x >= weekStart(off) && (off === 0 || x < weekStart(off - 1)) };
const finished = () => S.log.filter(l => l.outcome === "done");
const weekDone = (off = 0) => finished().filter(l => inWeek(l.ended_at, off)).length;
function streak() { let n = weekDone(0) >= goal() ? 1 : 0; for (let w = 1; w < 20; w++) { if (weekDone(w) >= goal()) n++; else break } return n }
// Scrolling that went through GSD that week: passes, hunts and slips, in the minutes they actually ran.
function weekScroll(off = 0) {
  const ps = S.passes.filter(p => p.started_at && inWeek(p.started_at, off));
  const minutes = ps.reduce((s, p) => s + Math.max(0, Math.round((Math.min(Date.now(), new Date(p.ends_at)) - new Date(p.started_at)) / 60000)), 0);
  return { minutes, opened: ps.length, slips: ps.filter(p => p.source === "slip").length };
}
// Times the gate showed and you did not go on to scroll.
const turnedBack = (off = 0) => Math.max(0, S.gates.filter(g => g.choice === "shown" && inWeek(g.created_at, off)).length - weekScroll(off).opened);
function median(xs) { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
// How well a save fits a free slot today: time you have, the weekend, what you care about, what's been waiting.
function fitScore(it) {
  const p = S.profile, mins = p.daily_minutes || 15, pl = planOf(it), dow = new Date().getDay(), weekend = dow === 0 || dow === 6, sh = shelfOf(it).key, age = (Date.now() - new Date(it.created_at)) / 864e5;
  let s = 0;
  if (pl) { s += 10; if (pl.minutes <= 2 * mins) s += 10 }
  if ((p.interests || []).includes(folderOf(it).name)) s += 15;
  if (age <= 7) s += 12; else if (age > 30) s += 8;
  if (it.resaved_count > 0) s += 8;
  if (it.note) s += 10;
  if (weekend && ["go", "cook", "move", "watch"].includes(sh)) s += 15;
  if (!weekend && pl?.effort === "tiny") s += 5;
  return s + 10 * hash(S.user.id + iso() + it.id);
}
const candidates = () => S.items.filter(i => !i.lane && i.status !== "let_go" && i.stage === "ready" && !i.done_at && shelfOf(i).key !== "wisdom").sort((a, b) => fitScore(b) - fitScore(a));

/* ---------- pieces ---------- */
const thumb = (it, cls = "thumb", extra = "") => `<div class="${cls}">${KIND[it.kind] || "✨"}${thumbUrl(it) ? `<img src="${esc(thumbUrl(it))}" alt="" loading="lazy" onerror="this.remove()">` : ""}${extra}</div>`;
const badge = it => { const n = S.actions.filter(a => a.item_id === it.id && a.lane === "now").length;
  return it.lane === "now" ? `<span class="bdg now">⚡ Now</span>` : n ? `<span class="bdg now">⚡ ${n} in Now</span>` : it.lane === "next" ? `<span class="bdg">⏭ Next</span>`
  : it.done_at ? `<span class="bdg done">${it.rating ? RATE[it.rating][0] : "✓"} ${esc(doneVerb(it))}</span>` : "" };
// A thumbnail for a save, or for a single action (its save's picture, with what it is in the corner).
const thumbX = (x, cls) => { if (!isAct(x)) return thumb(x, cls); const it = item(x.item_id), u = it ? thumbUrl(it) : "";
  return `<div class="${cls}">${actEm(x)}${u ? `<img src="${esc(u)}" alt="" loading="lazy" onerror="this.remove()"><span class="th-em" aria-hidden="true">${actEm(x)}</span>` : ""}</div>` };
const tile = it => { const f = folderOf(it); return `<button class="tile" data-act="open" data-id="${it.id}">${thumb(it, "thumb", badge(it))}<div class="tx"><div class="t">${pending(it) ? '<span class="spin"></span> Reading…' : esc(it.title || it.url || "Untitled")}</div><div class="tiny">${f.emoji} ${esc(f.name)} · ${ago(it.created_at)}</div></div></button>` };
// One idea inside its save. The plan is the one that counts: finishing the save finishes it.
function actRow(a, it) {
  const m = MODE[a.mode] || MODE.grow, isPlan = planOf(it)?.id === a.id, link = safeUrl(a.link), saveNow = it.lane === "now";
  return `<div class="card${isPlan ? " plan" : ""}"><div class="act"><div class="em" aria-hidden="true">${isPlan ? "📌" : m[0]}</div><div class="bd">
    <h3>${esc(a.title)}</h3><div class="small mute">${a.minutes} min · ${esc(actType(a))}${isPlan ? " · the plan" : ""}${a.lane === "now" ? ` · ⚡ in Now, slot ${a.slot}` : a.lane === "next" ? " · ⏭ in Up next" : ""}</div>
    ${a.why && a.status !== "done" ? `<p class="small" style="margin-top:8px">${esc(a.why)}</p>` : ""}
    ${a.status !== "done" && a.first_step ? `<p class="small" style="margin-top:8px"><b>Start:</b> ${esc(a.first_step)}</p>` : ""}
    ${isPlan && a.status !== "done" && a.steps?.length ? `<ul class="tk small">${a.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
    ${a.status === "done" ? `<div class="tiny" style="margin-top:6px">Done ${ago(a.done_at)}</div>` : ""}${a.reflection && !a.reflection.startsWith("dismissed:") && a.status !== "suggested" ? `<blockquote class="small" style="white-space:pre-wrap">${esc(a.reflection)}</blockquote>` : ""}
    <div class="row" style="margin-top:12px">${a.status === "done" ? ""
      : a.lane === "now" ? `<button class="btn sm keep" data-act="finish" data-id="${a.id}">✓ Done</button><button class="btn sm line" data-act="park" data-id="${a.id}">Park</button>`
      : a.lane === "next" ? `<button class="btn sm" data-act="pull" data-id="${a.id}">⚡ Now</button><button class="btn sm ghost" data-act="tolib" data-id="${a.id}">Out of Up next</button>`
      : isPlan && saveNow ? `<button class="btn sm keep" data-act="finish" data-id="${it.id}">✓ Done</button>`
      : `<button class="btn sm" data-act="pull" data-id="${a.id}">⚡ Now</button><button class="btn sm ghost" data-act="tonext" data-id="${a.id}">⏭ Up next</button>${isPlan ? "" : `<button class="btn sm ghost" data-act="plan" data-id="${a.id}">📌 Make it the plan</button><button class="btn sm ghost" data-act="dismiss" data-id="${a.id}">Not for me</button>`}`}
      ${link && a.status !== "done" ? `<a class="btn sm line" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(a.link_label || "Open it")} ↗</a>` : ""}</div>
  </div></div></div>`;
}
// The weekly gauge: one segment for each thing you want to finish from Now this week.
function gauge(done, goal) {
  const R = 100, cx = 120, cy = 122, pt = t => `${(cx + R * Math.cos(t)).toFixed(2)} ${(cy - R * Math.sin(t)).toFixed(2)}`, arc = (a, b) => `M${pt(a)} A${R} ${R} 0 0 1 ${pt(b)}`;
  const hit = done >= goal, segs = goal <= 6 ? goal : 1, gap = segs > 1 ? .3 : 0, len = (Math.PI - gap * (segs - 1)) / segs;
  let track = "", fill = "";
  if (segs > 1) for (let k = 0; k < segs; k++) { const a = Math.PI - k * (len + gap), d = arc(a, a - len); track += `<path d="${d}" class="g-tr"/>`; if (k < done) fill += `<path d="${d}" class="g-on" style="animation-delay:${k * 140}ms"/>` }
  else { const d = arc(Math.PI, 0), L = Math.PI * R, f = Math.min(1, done / goal); track = `<path d="${d}" class="g-tr"/>`; if (f > 0) fill = `<path d="${d}" class="g-on" stroke-dasharray="${L.toFixed(1)}" stroke-dashoffset="${(L * (1 - f)).toFixed(1)}"/>` }
  return `<div class="gauge${hit ? " hit" : ""}" role="img" aria-label="${done} of ${goal} finished from Now this week"><svg viewBox="0 0 240 132"><defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#0284c7"/></linearGradient><linearGradient id="gh" x1="0" x2="1"><stop offset="0" stop-color="#4ade80"/><stop offset="1" stop-color="#16a34a"/></linearGradient></defs>${track}${fill}</svg>
  <div class="n"><b>${done}<span>/${goal}</span></b><small>${hit ? "GOAL HIT THIS WEEK" : "DONE THIS WEEK"}</small></div></div>`;
}

/* ---------- views ---------- */
// The slot number doubles as the drag handle (arrow keys move it too).
const grip = (x, n) => `<button class="slot-n grip" data-act="nudge" data-id="${x.id}" aria-label="Slot ${n}. Drag, or use the arrow keys, to change the order" title="Drag to reorder">${n}</button>`;
function slotCard(it, n = it.slot) {
  const pl = planOf(it), d = daysIn(it), link = safeUrl(pl?.link), sh = shelfOf(it);
  return `<article class="slot" data-sid="${it.id}">
    <button class="slot-hd" data-act="open" data-id="${it.id}">${thumb(it, "slot-th")}
      <span class="slot-tx"><span class="tiny">${sh.em} ${esc(sh.name)} · ${d ? `${d} day${d > 1 ? "s" : ""} in Now` : "new in Now"}</span>
      <b>${pending(it) ? '<span class="spin"></span> Reading…' : esc(it.title || "Untitled")}</b></span></button>${grip(it, n)}
    ${pl ? `<div class="slot-plan"><b>${esc(pl.title)}</b> <span class="mute">· ${pl.minutes} min</span>${pl.first_step ? `<span class="slot-step">Start: ${esc(pl.first_step)}</span>` : ""}</div>`
      : `<div class="slot-plan mute">${pending(it) ? "A plan shows up once it's read." : "No plan needed: just do it. Or open it to pick one."}</div>`}
    ${d >= 7 ? `<p class="stale">${d} days in Now. Still the right one? Park it if not.</p>` : ""}
    <div class="slot-acts"><button class="btn sm keep" data-act="finish" data-id="${it.id}">✓ Done</button>
      ${link ? `<a class="btn sm ghost" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(pl.link_label || "Open it")} ↗</a>` : ""}
      <button class="btn sm line" data-act="park" data-id="${it.id}" title="Move it to Up next">Park</button></div></article>`;
}
function actSlot(a, n = a.slot) {
  const it = item(a.item_id), d = daysIn(a), link = safeUrl(a.link);
  return `<article class="slot" data-sid="${a.id}">
    <button class="slot-hd" data-act="open" data-id="${it ? it.id : ""}">${thumbX(a, "slot-th")}
      <span class="slot-tx"><span class="tiny">${actEm(a)} ${esc(actType(a))} · ${d ? `${d} day${d > 1 ? "s" : ""} in Now` : "new in Now"}</span>
      <b>${esc(a.title)}</b>${it ? `<span class="tiny slot-from">from ${esc(it.title || "a save")}</span>` : ""}</span></button>${grip(a, n)}
    ${a.first_step || a.why ? `<div class="slot-plan">${a.first_step ? `<b>Start:</b> ${esc(a.first_step)}` : esc(a.why)}<span class="slot-step">${a.minutes} min</span></div>` : ""}
    ${d >= 7 ? `<p class="stale">${d} days in Now. Still the right one? Park it if not.</p>` : ""}
    <div class="slot-acts"><button class="btn sm keep" data-act="finish" data-id="${a.id}">✓ Done</button>
      ${link ? `<a class="btn sm ghost" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(a.link_label || "Open it")} ↗</a>` : ""}
      <button class="btn sm line" data-act="park" data-id="${a.id}" title="Move it to Up next">Park</button></div></article>`;
}
function emptySlot(n, sug) {
  return `<article class="slot empty"><div class="slot-free"><span class="slot-n" aria-hidden="true">${n}</span><b>Free slot</b></div>
    ${sug ? `<p class="tiny">${sug.lane === "next" ? "Next in line" : "A good fit from your library"}</p><button class="slot-pull" data-act="pull" data-id="${sug.id}" aria-label="Put ${esc(sug.title || "it")} in Now">${thumbX(sug, "slot-th sm")}<span>${esc(sug.title || "Untitled")}</span><i aria-hidden="true">⚡</i></button>`
      : `<p class="small mute">Save something worth doing, or share it here from Instagram.</p>`}
    <div class="slot-acts"><button class="btn sm ghost" data-act="pick">Choose…</button><button class="btn sm line" data-act="save" data-id="now">+ New</button></div></article>`;
}
// One row in Up next, the gate, swap and pick lists: a whole save (with its plan) or a single action (with its save).
const nrow = (x, btn, lead = "", attrs = "") => {
  if (isAct(x)) { const it = item(x.item_id); return `<div class="nrow"${attrs}>${lead}${thumbX(x, "slot-th sm")}<button class="nrow-t" data-act="open" data-id="${it ? it.id : ""}"><b>${esc(x.title)}</b><span class="tiny">${actEm(x)} ${esc(it ? "from " + (it.title || "a save") : actType(x))}</span></button>${btn}</div>` }
  const pl = planOf(x), sh = shelfOf(x);
  return `<div class="nrow"${attrs}>${lead}${thumb(x, "slot-th sm")}<button class="nrow-t" data-act="open" data-id="${x.id}"><b>${esc(x.title || "Untitled")}</b><span class="tiny">${sh.em} ${esc(pl ? pl.title : sh.name)}${x.done_at ? ` · ${esc(doneVerb(x).toLowerCase())} before` : ""}</span></button>${btn}</div>` };
const nextRow = it => nrow(it, `<div class="nrow-b"><button class="ib" data-act="pull" data-id="${it.id}" aria-label="Move into Now" title="Move into Now">⚡</button><button class="ib" data-act="tolib" data-id="${it.id}" aria-label="Back to the library" title="Back to the library">✕</button></div>`,
  `<button class="grip ngrip" data-act="nudge" data-id="${it.id}" aria-label="Drag, or use the arrow keys, to change the order" title="Drag to reorder"><i></i><i></i><i></i></button>`, ` data-sid="${it.id}"`);
function vNow() {
  const nw = nowItems(), nx = nextItems(), p = S.profile, g = goal(), wd = weekDone(), st = streak(), bk = banked(), ap = activePass(), ib = inbox(), du = dueCards();
  const h = new Date().getHours(), hi = h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const pool = [...nx, ...candidates()];
  const recent = live().filter(i => !i.lane).slice(0, 4);
  return `<h1>${hi}.<br>${nw.length ? `<em>${["", "One thing", "Two things", "Three things"][Math.min(3, nw.length)]}</em> in Now.` : `Now is <em>clear</em>.`}</h1>
  <p class="mute" style="margin-top:8px">${nw.length ? `Finish one to earn ${passMin()} minutes of scrolling.` : finished().length ? "You cleared it. Scrolling is open for a hunt: go find what's next." : "Pick up to three things you'll actually do. Everything else can wait."}</p>
  <div class="sec gwrap">${gauge(wd, g)}
    <div class="chips gchips">${ap ? `<span class="chip b">⏱ <b data-left>${minsLeft(ap)}</b> min of scrolling left</span><button class="chip" data-act="endpass">End it now</button>`
      : `<span class="chip${bk.length ? " g" : ""}">🎟️ ${bk.length ? `${bk.length} pass${bk.length > 1 ? "es" : ""} · ${bk.reduce((s, x) => s + x.minutes, 0)} min` : "No passes banked"}</span>`}
      <span class="chip">🔥 ${st ? `${st}-week streak` : "No streak yet"}</span>
      ${p.commitment !== "none" ? `<span class="chip">📵 Turned back ${turnedBack()}× this week</span>` : `<button class="chip" data-act="capsetup">📵 Set up the scroll gate</button>`}</div></div>
  <div class="sec"><div class="hd"><h2>Now<span class="cnt">${nw.length}/3</span></h2><button class="small mute" data-act="rules">How it works</button></div>
    <div class="slots" data-sort="now">${nw.map((it, k) => isAct(it) ? actSlot(it, k + 1) : slotCard(it, k + 1)).join("")}${[...Array(Math.max(0, 3 - nw.length))].map((_, k) => emptySlot(nw.length + k + 1, pool[k])).join("")}</div>
    ${nw.length > 1 ? `<p class="tiny" style="margin-top:8px">Drag the numbers to change the order.</p>` : ""}</div>
  <div class="sec"><div class="hd"><h2>Up next<span class="cnt">${nx.length}/5</span></h2>${nx.length < 5 ? `<button class="small mute" data-act="pick" data-id="next">+ Add</button>` : ""}</div>
    ${nx.length ? `<div class="nlist" data-sort="next">${nx.map(nextRow).join("")}</div>` : `<p class="small mute">Line up what comes after Now. When a slot frees up, the first one here is ready to pull in.</p>`}</div>
  ${ib.length || du.length ? `<div class="sec"><div class="row">
    ${ib.length ? `<button class="btn ghost" data-act="triage">🗂️ Sort ${ib.length} new save${ib.length > 1 ? "s" : ""}</button>` : ""}
    ${du.length ? `<button class="btn ghost" data-act="review">🧠 Revisit ${du.length} idea${du.length > 1 ? "s" : ""}</button>` : ""}</div></div>` : ""}
  <div class="sec"><button class="field mute" style="text-align:left" data-act="ask">🔎 Ask your library anything…</button></div>
  <div class="sec"><div class="hd"><h2>Recently saved</h2><button class="small mute" data-act="tab" data-id="library">Library</button></div>
    ${recent.length ? `<div class="grid">${recent.map(tile).join("")}</div>` : `<div class="card soft"><p class="mute">Nothing saved yet. Tap + and paste a link from Instagram, YouTube, TikTok or anywhere.</p></div>`}</div>`;
}
/* ---------- library folders: vanilla port of the glass-folder-cards component ----------
   Back to front: a back panel holding generated liquid artwork, the saves inside as real sheets, and a frosted front
   panel hinged on its bottom edge. Hover leans the glass, a tap opens it and fans the saves, the key goes into the folder.
   The stage is drawn at 340 × 272 folder units and scaled by --k to whatever width the grid gives it. */
const GF_ART = {
  aurora: { style: "streak", colors: ["#f4efe9", "#e9c2b8", "#c2433f", "#2a1e2a", "#22395e", "#6f97c2", "#e5edf4"], scale: .7, warp: 1.4, angle: -.62, gloss: .18, veins: 0 },
  ember: { style: "marble", colors: ["#07090c", "#16252c", "#3d5f68", "#1a1416", "#a3201a", "#ef4a2b", "#ff8a5c"], scale: .62, warp: 3.2, angle: -.5, gloss: .55, veins: .6 },
  dusk: { style: "marble", colors: ["#120c18", "#3e2850", "#8f6c9c", "#2b1a24", "#b3502f", "#eab08a", "#fbe7d2"], scale: .75, warp: 3.6, angle: .8, gloss: .5, veins: .5 },
  glacier: { style: "streak", colors: ["#f7f8fa", "#d9e2ea", "#9fb4c7", "#e8edf2", "#bccbd8", "#ffffff"], scale: .7, warp: 1.6, angle: .35, gloss: .25, veins: 0 },
  verdant: { style: "marble", colors: ["#070b08", "#173024", "#4f7a5a", "#141812", "#a7843a", "#e9cf87", "#fbf3d6"], scale: .7, warp: 3.4, angle: 2.1, gloss: .5, veins: .5 },
};
const GF_PRESETS = Object.keys(GF_ART);
const gfHex = h => { h = h.replace("#", ""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] };
function gfRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
const gfSeed = s => Math.floor(hash(s) * 4294967296);
// Seeded gradient noise, summed into octaves with a rotation between each.
function gfFbm(seed) {
  const r = gfRng(seed), perm = new Uint8Array(512), grad = new Float32Array(512), p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]] }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) { const a = r() * Math.PI * 2; grad[i * 2] = Math.cos(a); grad[i * 2 + 1] = Math.sin(a) }
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const h00 = perm[X + perm[Y]] * 2, h10 = perm[X + 1 + perm[Y]] * 2, h01 = perm[X + perm[Y + 1]] * 2, h11 = perm[X + 1 + perm[Y + 1]] * 2;
    const d00 = grad[h00] * xf + grad[h00 + 1] * yf, d10 = grad[h10] * (xf - 1) + grad[h10 + 1] * yf, d01 = grad[h01] * xf + grad[h01 + 1] * (yf - 1), d11 = grad[h11] * (xf - 1) + grad[h11 + 1] * (yf - 1);
    const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = yf * yf * yf * (yf * (yf * 6 - 15) + 10);
    return d00 + u * (d10 - d00) + v * (d01 - d00 + u * (d11 - d01 - d10 + d00));
  };
  return (x, y, oct) => { let s = 0, amp = .5; for (let i = 0; i < oct; i++) { s += amp * noise(x, y); const nx = 1.6 * x + 1.2 * y + 7.1; y = -1.2 * x + 1.6 * y + 3.3; x = nx; amp *= .5 } return s };
}
// The artwork as a job spread over frames: a field domain-warped twice, normalised by its own percentiles, then lit as a
// liquid surface (slope → normal → diffuse + specular) with fine striations along the contours.
function gfArtJob(w, h, rec, seed) {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  const stops = rec.colors.map((c, i) => ({ t: i / (rec.colors.length - 1), c: gfHex(c) }));
  const { scale = .7, warp = 3, gloss = .4, veins = 0 } = rec, streak = rec.style === "streak", fbm = gfFbm(seed * 977 + 13), r = gfRng(seed + 1);
  const ox = r() * 50, oy = r() * 50, ang = (rec.angle || 0) + (r() - .5) * .5, ca = Math.cos(ang), sa = Math.sin(ang), m = Math.min(w, h);
  const gw = Math.ceil(w / 2) + 3, gh = Math.ceil(h / 2) + 3, G = new Float32Array(gw * gh), GQ = new Float32Array(gw * gh), F = new Float32Array(w * h), Q = new Float32Array(w * h);
  const px8 = new Uint8ClampedArray(w * h * 4); let row = 0;
  const field = gy => { for (let gx = 0; gx < gw; gx++) {
    const u = ((gx - 1) * 2 - w / 2) / m, v = ((gy - 1) * 2 - h / 2) / m;
    let px = (u * ca - v * sa) * scale, py = (u * sa + v * ca) * scale; if (streak) { px *= .14; py *= 2.2 } px += ox; py += oy;
    const qx = fbm(px, py, 3), qy = fbm(px + 5.2, py + 1.3, 3), rx = fbm(px + warp * qx + 1.7, py + warp * qy + 9.2, 3), ry = fbm(px + warp * qx + 8.3, py + warp * qy + 2.8, 3);
    G[gy * gw + gx] = fbm(px + warp * rx, py + warp * ry, 4); GQ[gy * gw + gx] = Math.sqrt(qx * qx + qy * qy) } };
  const upsample = () => { // Catmull-Rom from the half-resolution grid keeps the slope continuous for the lighting
    const cr = (a, b, c, d) => (-a + 9 * b + 9 * c - d) / 16, T = new Float32Array(w * gh);
    for (let gy = 0; gy < gh; gy++) { const o = gy * gw; for (let x = 0; x < w; x++) { const c = (x >> 1) + 1; T[gy * w + x] = x & 1 ? cr(G[o + c - 1], G[o + c], G[o + c + 1], G[o + c + 2]) : G[o + c] } }
    for (let y = 0; y < h; y++) { const c = (y >> 1) + 1; for (let x = 0; x < w; x++) {
      F[y * w + x] = y & 1 ? cr(T[(c - 1) * w + x], T[c * w + x], T[(c + 1) * w + x], T[(c + 2) * w + x]) : T[c * w + x];
      const gx = (x >> 1) + 1, q0 = GQ[c * gw + gx], qx = x & 1 ? (q0 + GQ[c * gw + gx + 1]) / 2 : q0;
      const q1 = y & 1 ? (x & 1 ? (GQ[(c + 1) * gw + gx] + GQ[(c + 1) * gw + gx + 1]) / 2 : GQ[(c + 1) * gw + gx]) : qx; Q[y * w + x] = (qx + q1) / 2 } } };
  const colorize = () => {
    const smp = [], st = Math.max(1, Math.floor(F.length / 4096)); for (let i = 0; i < F.length; i += st) smp.push(F[i]); smp.sort((a, b) => a - b);
    const lo = smp[Math.floor(smp.length * .02)], hi = smp[Math.floor(smp.length * .98)], k = 1 / (hi - lo || 1), lx = -.55, ly = -.65, lz = .52, slope = k * m * .012;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; let t = Math.min(1, Math.max(0, (F[i] - lo) * k)), j = 1;
      while (j < stops.length - 1 && stops[j].t < t) j++;
      const a = stops[j - 1], b = stops[j]; let f = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t || 1))); f = f * f * (3 - 2 * f);
      const gx = (F[x < w - 1 ? i + 1 : i] - F[x > 0 ? i - 1 : i]) * slope, gy = (F[y < h - 1 ? i + w : i] - F[y > 0 ? i - w : i]) * slope;
      const nd = (-gx * lx - gy * ly + lz) / Math.sqrt(gx * gx + gy * gy + 1), spec = Math.pow(nd > 0 ? nd : 0, 24) * gloss * 255;
      const lit = (.82 + .28 * nd) * (1 + .035 * Math.sin(t * 150 + Q[i] * 24)) * (1 - veins * Math.max(0, 1 - Math.abs(Q[i] - .42) * 14) * .6);
      for (let ch = 0; ch < 3; ch++) px8[i * 4 + ch] = (a.c[ch] + (b.c[ch] - a.c[ch]) * f) * lit + spec;
      px8[i * 4 + 3] = 255 } };
  return { w, h, px: px8, step(rows) { if (row >= gh) return true; const end = Math.min(gh, row + rows); while (row < end) field(row++); if (row < gh) return false; upsample(); colorize(); return true } };
}
// One shared painter: every folder queues its art here and the queue spends ~7ms a frame, so a row of folders never janks.
const GF_DONE = new Map(), GF_WAIT = new Map(), GF_Q = []; let gfPumping = false;
function gfPump() {
  if (gfPumping) return; gfPumping = true;
  const tick = () => { const until = performance.now() + 7;
    while (GF_Q.length && performance.now() < until) { const j = GF_Q[0]; if (!j.job.step(4)) continue; GF_Q.shift();
      const c = document.createElement("canvas"); c.width = j.job.w; c.height = j.job.h; c.getContext("2d").putImageData(new ImageData(j.job.px, c.width, c.height), 0, 0);
      j.fin(c) }
    if (GF_Q.length) requestAnimationFrame(tick); else gfPumping = false };
  requestAnimationFrame(tick);
}
// Finished art is also kept as a small JPEG between visits (newest 16), so a folder only ever paints once per size.
const gfStore = (() => { try { return JSON.parse(localStorage.getItem("gsd_art") || "{}") } catch { return {} } })();
function gfKeep(key, c) { try { gfStore[key] = c.toDataURL("image/jpeg", .86); const ks = Object.keys(gfStore); ks.slice(0, Math.max(0, ks.length - 16)).forEach(k => delete gfStore[k]); localStorage.setItem("gsd_art", JSON.stringify(gfStore)) } catch {} }
function gfPaint(preset, seed, w, h, done) {
  const key = [preset, seed, w, h].join("|"), got = GF_DONE.get(key); if (got) return done(got, true);
  if (!GF_WAIT.has(key)) { GF_WAIT.set(key, []);
    const fin = c => { GF_DONE.set(key, c); (GF_WAIT.get(key) || []).forEach(f => f(c)); GF_WAIT.delete(key) };
    const paint = () => { GF_Q.push({ key, job: gfArtJob(w, h, GF_ART[preset], seed), fin: c => { fin(c); gfKeep(key, c) } }); gfPump() };
    if (gfStore[key]) { const im = new Image(); im.onload = () => fin(im); im.onerror = paint; im.src = gfStore[key] } else paint() }
  GF_WAIT.get(key).push(c => done(c, false));
}
// The back's lower part is 4px smaller than the front all round, so none of its art shows past the front's edges
// (the two used to share an outline, and anti-aliasing let a sliver of the art through at the sides and bottom).
// It steps in only where the front's straight sides begin (left y 96, right y 128), so the step is always behind the glass.
const GF_BACK = "M0 56A22 22 0 0 1 22 34L146 34C170 34 172 0 198 0L318 0A22 22 0 0 1 340 22L340 128L336 134L336 250A18 18 0 0 1 318 268L22 268A18 18 0 0 1 4 250L4 104L0 98Z";
const GF_FRONT = "M0 22A22 22 0 0 1 22 0L118 0C144 0 146 32 172 32L318 32A22 22 0 0 1 340 54L340 176A22 22 0 0 1 318 198L22 198A22 22 0 0 1 0 176Z";
const gfSlot = (i, n) => n <= 1 ? 0 : (i / (n - 1)) * 2 - 1;
const gfSeen = new Set(); // folders that have already assembled themselves once this session
// The glass folders: yours in your order, then Unsorted when anything is in it.
function gfFolders() {
  const l = live(), list = [...S.folders, UNSORTED].map(f => ({ f, items: inFolder(f, l) })).filter(x => x.f.id !== "none" || x.items.length);
  const used = {}, art = {};
  for (const k of list.map(x => x.f.id).sort()) { const s = Math.floor(hash("gf:" + k) * GF_PRESETS.length);
    const p = [...GF_PRESETS.keys()].map(d => GF_PRESETS[(s + d) % GF_PRESETS.length]).reduce((b, p) => (used[p] || 0) < (used[b] || 0) ? p : b); used[p] = (used[p] || 0) + 1; art[k] = p }
  return list.map(({ f, items }) => { const done = items.filter(i => i.done_at).length;
    return { key: f.id, art: art[f.id], name: f.name, label: fLabel(f),
      meta: items.length ? `${items.length} save${items.length === 1 ? "" : "s"}${done ? ` · ${done} done` : ""}` : "Empty",
      items: items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) } });
}
function gfSheet(it, v, n) {
  const r = gfRng(gfSeed(it.id)), src = thumbUrl(it), name = pending(it) ? "Reading…" : it.title || hostOf(it.url) || "Untitled";
  const style = `--gf-slot:${gfSlot(v, n)};--gf-depth:${n - 1 - v};--gf-jx:${((r() - .5) * 10).toFixed(2)}px;--gf-jr:${((r() - .5) * 3.2).toFixed(2)}deg;z-index:${v + 1}`;
  return `<div role="listitem" class="gf-slot"><button class="gf-sheet${src ? " gf-sheet--art" : ""}" style="${style}" data-act="open" data-id="${it.id}">
    ${src ? `<img class="gf-sheet-art" src="${esc(src)}" alt="" loading="lazy" draggable="false" onerror="this.parentNode.classList.remove('gf-sheet--art');this.remove()">` : ""}
    <span class="gf-paper" aria-hidden="true"><span class="gf-em">${KIND[it.kind] || "✨"}</span>${esc(it.insight || it.summary || it.title || it.url || "")}</span>
    <span class="gf-sheet-head"><span class="gf-sheet-name">${esc(name)}</span><span class="gf-sheet-meta">${esc(ago(it.created_at))}</span></span></button></div>`;
}
function gfFolder(f, i) {
  const n = f.items.length, show = f.items.slice(0, 4).reverse(), preset = f.art, open = S.folder === f.key;
  return `<div class="gf" data-act="gfopen" data-id="${esc(f.key)}" data-key="${esc(f.key)}" style="--d:${i * 110}ms"${open ? " data-open" : ""}${gfSeen.has(f.key) ? " data-entered" : ""}>
  <div class="gf-stage"><div class="gf-tilt">
    <div class="gf-shadow" aria-hidden="true"></div>
    <div class="gf-back" style="clip-path:path('${GF_BACK}')" aria-hidden="true"><canvas class="gf-art" data-art="${preset}" data-seed="${gfSeed(f.key) % 997}"></canvas><div class="gf-back-sheen"></div></div>
    <svg class="gf-rim gf-back-rim" viewBox="0 0 340 272" aria-hidden="true"><path d="${GF_BACK}"/></svg>
    <div class="gf-front" style="clip-path:path('${GF_FRONT}')">
      <div class="gf-tint" aria-hidden="true"></div><div class="gf-spec" aria-hidden="true"></div>
      <svg class="gf-rim gf-front-rim" viewBox="0 0 340 198" aria-hidden="true"><path d="${GF_FRONT}" stroke="url(#gf-rim)"/></svg>
      <button class="gf-hit" data-act="gfopen" data-id="${esc(f.key)}" aria-expanded="${open}" aria-label="${open ? "Close" : "Open"} ${esc(f.name)}, ${esc(f.meta)}"></button>
      <div class="gf-label"><span class="gf-title">${esc(f.label)}</span><span class="gf-meta">${esc(f.meta)}</span></div>
    </div>
    <div class="gf-files" role="list" aria-label="Latest in ${esc(f.name)}"${open ? "" : " inert"}>${show.map((it, v) => gfSheet(it, v, show.length)).join("")}</div>
    <button class="gf-key" data-act="grp" data-id="${esc(f.key)}" aria-label="Show all ${n} in ${esc(f.name)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M12.5 6l6 6-6 6"/></svg></button>
  </div></div></div>`;
}
let gfRO = null, gfIO = null;
function gfMount() {
  gfRO?.disconnect(); gfIO?.disconnect();
  const els = [...document.querySelectorAll(".gf")]; if (!els.length) return;
  const dpr = Math.min(1.5, Math.max(1, devicePixelRatio || 1));
  // Size: --k scales the 340-unit stage to the column. Resize observers run after layout and before paint, so nothing flashes.
  gfRO = new ResizeObserver(es => es.forEach(e => { const el = e.target, k = el.clientWidth / 340; if (!k) return;
    el.style.setProperty("--k", k.toFixed(4));
    const step = Math.max(.5, Math.round(k * dpr * 4) / 4), cv = el.querySelector(".gf-art"); // paint in quarter steps, so a resize doesn't repaint every pixel
    if (cv.dataset.step === String(step)) return; cv.dataset.step = step;
    gfPaint(cv.dataset.art, +cv.dataset.seed, 364 * step, 296 * step, (src, now) => { if (!cv.isConnected || cv.dataset.step !== String(step)) return;
      cv.width = src.width; cv.height = src.height; cv.getContext("2d").drawImage(src, 0, 0); if (now) cv.classList.add("now"); cv.dataset.ready = "" }) }));
  // Entrance: each folder assembles itself the first time it scrolls into view, staggered along the row.
  gfIO = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; gfIO.unobserve(e.target);
    const el = e.target; setTimeout(() => { el.setAttribute("data-entered", ""); gfSeen.add(el.dataset.key) }, parseInt(el.style.getPropertyValue("--d")) || 0) }), { threshold: .25 }) : null;
  for (const el of els) {
    gfRO.observe(el);
    if (!el.hasAttribute("data-entered")) gfIO ? gfIO.observe(el) : (el.setAttribute("data-entered", ""), gfSeen.add(el.dataset.key));
    // Light and parallax follow the pointer; written once a frame, never re-rendered.
    let raf = 0, px = 0, py = 0; const write = () => { raf = 0; el.style.setProperty("--gf-px", px.toFixed(3)); el.style.setProperty("--gf-py", py.toFixed(3)) };
    el.addEventListener("pointermove", e => { if (e.pointerType === "touch") return; const r = el.getBoundingClientRect(); px = (e.clientX - r.left) / r.width * 2 - 1; py = (e.clientY - r.top) / r.height * 2 - 1; raf ||= requestAnimationFrame(write) });
    el.addEventListener("pointerleave", () => { px = py = 0; raf ||= requestAnimationFrame(write) });
  }
}
// Open one folder at a time without re-rendering, so the glass and the fan animate.
function gfSet(area) {
  S.folder = area;
  document.querySelectorAll(".gf").forEach(el => { const on = el.dataset.key === area, hit = el.querySelector(".gf-hit"), n = el.querySelector(".gf-meta").textContent;
    el.toggleAttribute("data-open", on); el.querySelector(".gf-files").toggleAttribute("inert", !on);
    hit.setAttribute("aria-expanded", on); hit.setAttribute("aria-label", `${on ? "Close" : "Open"} ${el.dataset.key}, ${n}`) });
}
document.addEventListener("pointerdown", e => { if (S.folder && !e.target.closest(".gf[data-open]")) gfSet("") });
document.addEventListener("keydown", e => { if (e.key === "Escape" && S.folder && !S.sheet) { const k = S.folder; gfSet(""); [...document.querySelectorAll(".gf")].find(el => el.dataset.key === k)?.querySelector(".gf-hit").focus() } });

function libList() {
  const q = S.q.toLowerCase().trim(), f = S.fid && fById(S.fid);
  if (S.lib === "folders" && !f && !q) { const fs = gfFolders();
    return fs.length ? `<div class="folders">${fs.map(gfFolder).join("")}</div>` : `<div class="card soft"><p class="mute">No folders yet. Tap ✏️ Folders to add your first one.</p></div>` }
  let l = S.lib === "latest" ? [...live()].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) : S.lib === "wisdom" ? live().filter(isWis) : S.lib === "inbox" ? S.items.filter(i => i.status === "inbox" && !i.lane) : S.lib === "let_go" ? S.items.filter(i => i.status === "let_go")
    : S.lib === "done" ? live().filter(i => i.done_at).sort((a, b) => new Date(b.done_at) - new Date(a.done_at)) : live();
  if (f) {
    l = inFolder(f, l);
    if (S.shelfTab === "todo") l = l.filter(i => !i.done_at);
    if (S.shelfTab === "done") l = l.filter(i => i.done_at).sort(byRating);
  }
  if (q) l = l.filter(i => [i.title, i.summary, i.note, i.done_note, i.source, i.kind, folderOf(i).name, ...(i.tags || []), ...(i.takeaways || []).map(t => t.text), ...(i.resources || []).map(r => r.title)].join(" ").toLowerCase().includes(q));
  const empty = q ? "Nothing matches. Try Ask for questions in your own words."
    : S.lib === "wisdom" ? "No wisdom yet. When you finish something, write what stuck with you and tap 💎 Also save the note to Wisdom."
    : f && S.shelfTab === "done" ? `Nothing in ${esc(f.done_label)} yet. Finish something from ${esc(f.name)} and rate it, and it lands here, best first.`
    : f && !inFolder(f).length ? "Nothing here yet. New saves that fit land here on their own, and you can move any save here from its page."
    : f && S.shelfTab === "todo" ? `Nothing open in ${esc(f.name)}. 🎉` : "Nothing here.";
  return l.length ? `<div class="grid">${l.map(tile).join("")}</div>` : `<p class="mute" style="padding:30px 0;text-align:center">${empty}</p>`;
}
function vLibrary() {
  const f = S.fid && fById(S.fid), all = f ? inFolder(f) : [], nDone = all.filter(i => i.done_at).length, nTodo = all.length - nDone;
  return `<div class="lib-hd"><h1>Library</h1><button class="chip" data-act="folders">✏️ Folders</button></div>
  <div class="sec"><input class="field search" id="q" type="search" placeholder="Search your saves" value="${esc(S.q)}" aria-label="Search your saves"></div>
  <div class="scroll" style="margin-top:12px">${[["folders", "📁 Folders"], ["all", "All"], ["latest", "🕒 Latest"], ["done", "✓ Done"], ["wisdom", "💎 Wisdom"], ["inbox", "📥 Inbox"], ["let_go", "Let go"]].map(([k, t]) => `<button class="chip ${S.lib === k && !f ? "on" : ""}" data-act="lib" data-id="${k}">${t}</button>`).join("")}</div>
  ${f ? `<div class="crumb sec"><button class="chip" data-act="lib" data-id="folders" aria-label="Back to folders">←</button><h2>${esc(fLabel(f))}</h2><span class="small mute">${all.length} save${all.length === 1 ? "" : "s"}</span>${f.id !== "none" ? `<button class="chip" data-act="fedit" data-id="${f.id}" aria-label="Edit ${esc(f.name)}" title="Edit folder">✏️</button>` : ""}</div>
    <div class="scroll" style="margin-top:12px" role="tablist" aria-label="Filter ${esc(f.name)}">${[["todo", `${esc(f.todo_label)} (${nTodo})`], ["done", `${/tested/i.test(f.done_label) ? "⭐" : "✓"} ${esc(f.done_label)} (${nDone})`], ["all", `All (${all.length})`]].map(([k, t]) => `<button role="tab" aria-selected="${S.shelfTab === k}" class="chip ${S.shelfTab === k ? "on" : ""}" data-act="shtab" data-id="${k}">${t}</button>`).join("")}</div>
    ${f.about ? `<p class="tiny" style="margin-top:8px">${esc(f.about)}</p>` : ""}` : ""}
  <div class="${f ? "" : "sec"}" id="libgrid" style="${f ? "margin-top:14px" : ""}">${libList()}</div>`;
}
function feed() {
  const ready = live().filter(i => i.stage === "ready" && !i.lane);
  if (S.mode === "learn") return ready.filter(i => S.cards.some(c => c.item_id === i.id)).slice(0, 10);
  if (S.mode === "go") return ready.filter(i => ["go", "cook", "move", "watch"].includes(shelfOf(i).key) && !i.done_at).slice(0, 10);
  const forgotten = [...ready].sort((a, b) => (a.opened_count - b.opened_count) || (new Date(a.last_surfaced_at || 0) - new Date(b.last_surfaced_at || 0)));
  const recent = ready.filter(i => Date.now() - new Date(i.created_at) < 7 * 864e5).slice(0, 2);
  const wild = [...ready].sort((a, b) => hash(iso() + a.id) - hash(iso() + b.id)).slice(0, 1);
  const out = []; for (const i of [...forgotten.slice(0, 4), ...recent, ...wild, ...forgotten.slice(4)]) if (!out.includes(i)) out.push(i);
  return out.slice(0, S.more ? 15 : 10);
}
function vExplore() {
  const modes = [["inspire", "✨ Inspiration"], ["go", "📍 Things to do"], ["learn", "🧠 Learning"]], l = feed();
  const body = l.length ? `<div class="feed">${l.map(it => {
      const c = S.cards.find(x => x.item_id === it.id), pl = it.entities?.place, sh = shelfOf(it);
      return `<article class="fcard" data-seen="${it.id}">${thumb(it, "thumb", badge(it))}<div class="in">
        <div class="tiny">${sh.em} ${esc(sh.name)} · ${esc(it.source || "")} · saved ${ago(it.created_at)}${it.opened_count ? "" : " · not opened since"}</div>
        ${S.mode === "learn" && c ? `<p class="ins" style="margin-top:8px">${esc(c.q)}</p><details style="margin-top:10px"><summary class="small mute">Show answer</summary><p style="margin-top:8px">${esc(c.a)}</p></details>`
          : `<p class="ins" style="margin-top:8px">${esc(it.insight || it.summary || it.title)}</p>`}
        <p class="small mute" style="margin-top:10px">${esc(it.title)}</p>
        <div class="row" style="margin-top:14px"><button class="btn sm" data-act="pull" data-id="${it.id}">⚡ Now</button><button class="btn sm ghost" data-act="tonext" data-id="${it.id}">⏭ Up next</button><button class="btn sm ghost" data-act="open" data-id="${it.id}">Open</button>
        ${S.mode === "go" && pl?.name ? `<a class="btn sm line" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([pl.name, pl.address, pl.city].filter(Boolean).join(" "))}">Maps</a>` : ""}</div>
      </div></article>`}).join("")}
      <div class="card soft" style="text-align:center"><h3>That's enough for now.</h3><p class="small mute" style="margin-top:4px">This feed ends on purpose. Put one thing in Now and go do it.</p>
      ${S.mode === "inspire" && !S.more && live().length > 10 ? `<button class="btn sm ghost" style="margin-top:10px" data-act="more">Five more</button>` : ""}</div></div>`
    : `<p class="mute">Nothing to show in this mode yet.</p>`;
  return `<h1>Explore <em>your own</em> saves</h1><p class="mute" style="margin-top:8px">A feed that ends, made only of things you chose.</p><div class="scroll sec">${modes.map(([k, n]) => `<button class="chip ${S.mode === k ? "on" : ""}" data-act="mode" data-id="${k}">${n}</button>`).join("")}</div><div class="sec">${body}</div>`;
}
// Eight weeks of finishing from Now, against the weekly goal, with the scrolling that went through passes.
function weeksChart() {
  const W = 8, g = goal(), data = Array.from({ length: W }, (_, k) => { const off = W - 1 - k; return { off, d: weekStart(off), done: weekDone(off), mins: weekScroll(off).minutes } });
  const max = Math.max(g, ...data.map(x => x.done), 1), bw = 26, gw = 14, H = 110, top = 16, base = top + H, w = W * bw + (W - 1) * gw, y = v => base - (v / max) * H;
  const bars = data.map((x, k) => { const xx = k * (bw + gw), hgt = x.done ? Math.max(6, base - y(x.done)) : 0;
    return `<rect x="${xx}" y="${base - Math.max(hgt, 3)}" width="${bw}" height="${Math.max(hgt, 3)}" rx="${hgt ? 7 : 1.5}" class="${x.done >= g ? "wk-hit" : x.done ? "wk-bar on" : "wk-bar"}"/>${x.done ? `<text x="${xx + bw / 2}" y="${base - hgt - 6}" class="wk-v">${x.done}</text>` : ""}
      <text x="${xx + bw / 2}" y="${base + 16}" class="wk-l">${x.off ? x.d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "This wk"}</text>
      <text x="${xx + bw / 2}" y="${base + 31}" class="wk-l">${x.mins ? `⏱ ${x.mins}` : "·"}</text>` }).join("");
  return `<figure class="wk"><svg viewBox="-6 0 ${w + 12} ${base + 38}" role="img" aria-label="Finished from Now per week, oldest first: ${data.map(x => x.done).join(", ")}. Goal: ${g} a week.">
    <line x1="-6" x2="${w + 6}" y1="${y(g)}" y2="${y(g)}" class="wk-goal"/><text x="${w + 6}" y="${y(g) - 5}" class="wk-gl">goal ${g}</text>${bars}</svg>
    <figcaption class="tiny">Bars: things finished from Now each week. ⏱ minutes of scrolling through GSD passes.</figcaption></figure>`;
}
function vProfile() {
  const p = S.profile, fin = finished(), md = median(fin.map(l => (new Date(l.ended_at) - new Date(l.started_at)) / 864e5)), ws = weekScroll();
  const parked = S.log.filter(l => l.outcome === "parked" || l.outcome === "dropped").length, timer = passTimer();
  return `<h1>You</h1>
  ${p.onboarded_at ? "" : `<div class="banner sec">Welcome. Pick what you care about and write a line about your goals; every suggestion GSD makes is fitted to this.</div>`}
  <div class="sec"><div class="hd"><h2>Your focus</h2><span class="small mute">last 8 weeks</span></div>
    ${weeksChart()}
    <div class="grid" style="margin-top:16px">
      <div class="stat"><b>${fin.length}</b><span class="small mute">finished from Now</span></div>
      <div class="stat"><b>${md == null ? "–" : md < 1 ? "<1" : Math.round(md)}</b><span class="small mute">days to finish, typically</span></div>
      <div class="stat"><b>${ws.minutes}</b><span class="small mute">min scrolled through GSD this week</span></div>
      <div class="stat"><b>${turnedBack()}</b><span class="small mute">times you turned back this week</span></div>
      <div class="stat"><b>${ws.slips}</b><span class="small mute">${ws.slips === 1 ? "slip" : "slips"} this week</span></div>
      <div class="stat"><b>${parked}</b><span class="small mute">parked or dropped</span></div></div>
    ${fin.length ? `<h3 style="margin-top:20px">Recently finished</h3><div class="stack" style="margin-top:10px;gap:8px">${fin.slice(0, 6).map(l => `<button class="frow" ${l.item_id && item(l.item_id) ? `data-act="open" data-id="${l.item_id}"` : "disabled"}><span aria-hidden="true">${KIND[l.kind] || RES[l.kind] || "✨"}</span><b>${esc(l.title || "Untitled")}</b><span class="tiny">${l.rating ? RATE[l.rating][0] + " " : ""}${ago(l.ended_at)}</span></button>`).join("")}</div>` : ""}</div>
  <div class="sec"><div class="hd"><h2>The rules</h2><button class="small mute" data-act="rules">How it works</button></div>
    <label class="l" for="wg" style="margin-top:0">Weekly goal: things finished from Now</label>
    <select class="field" id="wg" data-save="weekly_goal">${[1, 2, 3, 4, 5, 6, 7, 10, 14].map(n => `<option value="${n}" ${goal() == n ? "selected" : ""}>${n} a week</option>`).join("")}</select>
    <label class="l" for="pm">One scroll pass is</label>
    <select class="field" id="pm" data-save="pass_minutes">${[5, 10, 15, 20, 30, 45].map(n => `<option value="${n}" ${passMin() == n ? "selected" : ""}>${n} minutes</option>`).join("")}</select>
    <label class="l" for="pc">Passes you can bank</label>
    <select class="field" id="pc" data-save="pass_cap">${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${(p.pass_cap || 3) == n ? "selected" : ""}>${n}</option>`).join("")}</select>
    <label class="l" for="intention">What the gate says (optional)</label>
    <input class="field" id="intention" data-save="intention" placeholder="e.g. Do the thing, then scroll." value="${esc(p.intention)}">
    <div class="row" style="margin-top:12px"><button class="chip ${p.commitment !== "none" ? "on" : ""}" data-act="commit">${p.commitment !== "none" ? "✓ " : ""}Scroll gate on Instagram, YouTube and TikTok</button>
      <button class="chip ${timer ? "on" : ""}" data-act="passtimer">${timer ? "✓ " : ""}Ring when a pass ends (this phone)</button></div>
    <p class="tiny" style="margin-top:8px">The gate needs a one-time iPhone automation: <button class="tiny" style="text-decoration:underline" data-act="capsetup">set it up</button>. “Open anyway” always works, and counts as a slip.</p></div>
  <div class="sec"><div class="hd"><h2>What you care about</h2></div>
    <div class="chips">${S.folders.map(f => `<button class="chip ${p.interests?.includes(f.name) ? "on" : ""}" data-act="interest" data-id="${esc(f.name)}">${esc(fLabel(f))}</button>`).join("")}</div>
    <label class="l" for="goals">The life you're building, in a sentence or two</label>
    <textarea class="field" id="goals" data-save="goals" placeholder="e.g. Build small AI apps, draw more, try one new place a month">${esc(p.goals)}</textarea>
    <label class="l" for="mins">Time you usually have for one thing</label>
    <select class="field" id="mins" data-save="daily_minutes">${[5, 10, 15, 30, 45, 60].map(m => `<option value="${m}" ${p.daily_minutes == m ? "selected" : ""}>${m} minutes</option>`).join("")}</select>
    <label class="l" for="city">Your city (for places)</label>
    <input class="field" id="city" data-save="city" value="${esc(p.city)}" placeholder="e.g. Copenhagen">
    <label class="l" for="country">Your country (links go to its version of a site when there is one)</label>
    <input class="field" id="country" data-save="country" value="${esc(p.country ?? "Denmark")}" placeholder="e.g. Denmark">
    <label class="l" for="prefs">Standing instructions for the AI</label>
    <textarea class="field" id="prefs" data-save="preferences" placeholder="e.g. Prefer free sources. Skip crypto. Suggest things I can do with my girlfriend.">${esc(p.preferences ?? "")}</textarea></div>
  <div class="sec"><div class="hd"><h2>Reading and AI</h2></div>
    ${(() => { const sp = spend(); return `<div class="card soft"><div class="row" style="justify-content:space-between"><h3>≈ $${sp.total.toFixed(2)} this month</h3><span class="small mute">guide: $${BUDGET}</span></div>
      <div class="bar" style="margin:10px 0 6px"><i style="width:${Math.min(100, 100 * sp.total / BUDGET)}%"></i></div>
      <div class="tiny">${sp.saves} save${sp.saves === 1 ? "" : "s"} read${sp.saves ? ` · about $${(sp.total / sp.saves).toFixed(2)} each` : ""}. An estimate from token counts; your OpenAI bill is the real number. Nothing is blocked at $${BUDGET}. Transcripts use Supadata credits, counted below.</div></div>` })()}
    ${creditsCard()}
    <div class="row" style="margin-top:12px"><button class="chip ${p.full_read ? "on" : ""}" data-act="fullread">${p.full_read ? "✓ " : ""}🎧 Always read saves fully</button>
      <button class="chip ${p.watch_video !== false ? "on" : ""}" data-act="watch">${p.watch_video !== false ? "✓ " : ""}A full read watches short clips (on-screen text)</button>
      <button class="chip ${p.auto_remember ? "on" : ""}" data-act="autorem">${p.auto_remember ? "✓ " : ""}Help me remember what I learn</button></div>
    <p class="tiny" style="margin-top:8px">Saves get a quick read by default: the caption and any existing subtitles. That is 1 credit for YouTube and 2 for Instagram. A full read (🎧 when you save, or on a save later) also watches clips up to 3 minutes, 5 credits a minute, and only if it still heard nothing, transcribes the audio, 2 credits a minute. Full reads stop ${S.credits?.reserve ?? 10} credits before empty, so quick reads keep working.</p></div>
  <div class="sec"><div class="hd"><h2>Appearance</h2></div>
    <div class="chips">${[["auto", "Match my device"], ["light", "☀️ Light"], ["dark", "🌙 Dark"]].map(([k, n]) => `<button class="chip ${themePref() === k ? "on" : ""}" data-act="theme" data-id="${k}">${n}</button>`).join("")}</div></div>
  <div class="sec"><div class="hd"><h2>Save from anywhere</h2></div>
    <div class="row"><button class="btn ghost" data-act="capsetup">📱 Set up the iPhone share sheet and gate</button></div>
    <p class="small mute" style="margin-top:10px"><b>Computer:</b> add a bookmark with this address, then click it on any page:</p>
    <code class="small" style="word-break:break-all;display:block;margin-top:6px">javascript:location.href='${esc(location.origin + location.pathname)}?url='+encodeURIComponent(location.href)</code></div>
  <div class="sec row"><span class="small mute">${esc(S.user?.email || "")}</span><button class="btn sm ghost" data-act="signout">Sign out</button></div>`;
}

/* ---------- sheets ---------- */
function pickList() {
  const s = S.sheet, q = (s.q || "").toLowerCase().trim(), nx = s.lane === "now" ? nextItems() : [];
  const pool = q ? live().filter(i => !i.lane && i.stage === "ready" && [i.title, i.summary, i.kind, shelfOf(i).name, ...(i.tags || [])].join(" ").toLowerCase().includes(q)).slice(0, 20) : candidates().slice(0, 8);
  const row = it => nrow(it, `<button class="btn sm" data-act="pickit" data-id="${it.id}">${s.lane === "next" ? "⏭ Add" : "⚡ Now"}</button>`);
  return `${nx.length && !q ? `<div class="tiny" style="margin:16px 0 6px">Up next</div><div class="nlist">${nx.map(row).join("")}</div>` : ""}
    <div class="tiny" style="margin:16px 0 6px">${q ? "Matches" : "Good fits for today"}</div>${pool.length ? `<div class="nlist">${pool.map(row).join("")}</div>` : `<p class="small mute">${q ? "Nothing matches." : "Nothing waiting in your library. Save something first."}</p>`}`;
}
const gateRow = it => nrow(it, `<button class="btn sm keep" data-act="finish" data-id="${it.id}" aria-label="Mark ${esc(it.title || "it")} as done">✓</button>`);
function sheetHtml() {
  const s = S.sheet; if (!s) return "";
  if (s.type === "item") return itemView(item(s.id));
  let b = "";
  if (s.type === "save") { const free = 3 - nowItems().length, lane = s.lane || "library";
    b = `<h2>Save <em>anything</em></h2><p class="small mute" style="margin-top:4px">Paste a link, or write a note, an idea or something to do.</p>
    <label class="l" for="sv">Link or text</label><textarea class="field" id="sv" placeholder="https://www.instagram.com/reel/…">${esc(s.val || "")}</textarea>
    <label class="l" for="sn">Why are you saving it? (optional)</label><input class="field" id="sn" placeholder="e.g. try this at the weekend" value="${esc(s.note || "")}">
    <label class="l" for="sf">Folder</label><select class="field" id="sf"><option value="">✨ Let GSD pick</option>${S.folders.map(f => `<option value="${f.id}" ${s.folder === f.id ? "selected" : ""}>${esc(fLabel(f))}</option>`).join("")}</select>
    <button class="chip ${s.full && !fullBlocked() ? "on" : ""}" style="margin-top:12px" data-act="savefull" aria-pressed="${!!s.full && !fullBlocked()}" ${fullBlocked() ? "disabled" : ""}>${s.full && !fullBlocked() ? "✓ " : ""}🎧 Read it fully</button>
    <p class="tiny" style="margin-top:6px">${fullBlocked() ? `Only ${crWord(crLeft())} left, kept for quick reads until Supadata renews.` : s.full ? "Also watches clips up to 3 minutes and transcribes speech that has no subtitles: about 7 transcript credits for a reel under a minute, 12 up to two." : "Off: a quick read from the caption and existing subtitles, 1–2 transcript credits. You can read it fully later."}${crLeft() != null && !fullBlocked() ? ` ${crLeft()} left.` : ""}</p>
    <label class="l">Where does it go?</label>
    <div class="seg" role="radiogroup" aria-label="Where it goes">${[["now", `⚡ Now${free ? ` · ${free} free` : " · full"}`], ["next", "⏭ Up next"], ["library", "📚 Library"]].map(([k, n]) => `<button role="radio" aria-checked="${lane === k}" class="${lane === k ? "on" : ""}" data-act="savelane" data-id="${k}">${n}</button>`).join("")}</div>
    <p class="tiny" style="margin-top:8px">${lane === "now" ? (free ? "It becomes one of your three. Finishing it earns a scroll pass." : "Now is full, so it goes first in Up next. Swap it in when a slot frees up.") : lane === "next" ? "It waits in line for a free slot." : "It goes in its folder. Pull it into Now whenever you're ready."}</p>
    <div class="row" style="margin-top:16px"><button class="btn" data-act="dosave" ${S.busy ? "disabled" : ""}>${S.busy ? '<span class="spin"></span> Saving' : "Save"}</button>
    <label class="btn ghost" style="cursor:pointer">🖼️ Add image<input type="file" id="img" accept="image/*" hidden></label><button class="btn ghost" data-act="close">Cancel</button></div>` }
  if (s.type === "triage") { const it = inbox()[0], free = 3 - nowItems().length;
    b = it ? `<div class="tiny">${inbox().length} to sort</div>${thumb(it, "thumb hero")}<h2>${esc(it.title)}</h2><p class="mute" style="margin-top:8px">${esc(it.insight || it.summary || "")}</p>
      <div class="tri"><button class="btn" data-act="tlane" data-id="${it.id}|now">⚡ Now${free ? "" : " (swap)"}</button><button class="btn ghost" data-act="tlane" data-id="${it.id}|next">⏭ Up next</button>
        <button class="btn keep" data-act="tlane" data-id="${it.id}|lib">📚 Library</button><button class="btn drop" data-act="tlane" data-id="${it.id}|let">🍃 Let go</button></div>
      <p class="tiny" style="margin-top:10px;text-align:center">Letting go is good. A smaller library gets used.</p>`
      : `<h2>All sorted.</h2><p class="mute" style="margin-top:6px">Your library only holds things you chose to keep.</p><button class="btn" style="margin-top:16px" data-act="close">Done</button>` }
  if (s.type === "review") { const c = dueCards()[0];
    if (!c) b = `<h2>Nothing left to revisit.</h2><button class="btn" style="margin-top:16px" data-act="close">Done</button>`;
    else b = `<div class="tiny">${dueCards().length} to revisit · ${esc(item(c.item_id)?.title || "")}</div><h2 style="margin-top:10px">${esc(c.q)}</h2>
      ${s.show ? `<div class="card soft" style="margin-top:14px">${esc(c.a)}</div>
        <div class="row" style="margin-top:16px"><button class="btn keep" style="flex:1" data-act="rc" data-id="${c.id}|got">Got it</button><button class="btn ghost" style="flex:1" data-act="rc" data-id="${c.id}|almost">Almost</button><button class="btn ghost" style="flex:1" data-act="rc" data-id="${c.id}|forgot">Forgot</button></div>`
        : `<button class="btn" style="margin-top:16px" data-act="reveal">Show answer</button>`}` }
  if (s.type === "finish" && actOf(s.id)) { const a = actOf(s.id), it = item(a.item_id), inNow = a.lane === "now", room = banked().length < (S.profile.pass_cap || 3);
    b = `<h2>${inNow ? `Nice. <em>GSD.</em>` : "Done?"}</h2><p class="mute" style="margin-top:4px">${esc(a.title)}${it ? ` <span class="tiny">· from ${esc(it.title)}</span>` : ""}</p>
    <label class="l" for="rf">What did you take from it? (optional)</label>
    <textarea class="field" id="rf" placeholder="One line is plenty">${esc(s.text ?? "")}</textarea>
    <div class="row" style="margin-top:12px"><button class="chip ${s.wis ? "on" : ""}" data-act="tog" data-id="wis">${s.wis ? "✓ " : ""}💎 Also save the note to Wisdom</button></div>
    <button class="btn keep" style="margin-top:18px;width:100%" data-act="dofinish" data-id="${a.id}" ${S.busy ? "disabled" : ""}>${S.busy ? '<span class="spin"></span>' : "✓"} Done</button>
    <p class="tiny" style="margin-top:10px;text-align:center">${inNow ? (room ? `Earns a ${passMin()}-minute scroll pass.` : `Your pass bank is full (${S.profile.pass_cap || 3}). Spend one to earn more.`) : "Passes are earned by finishing things in Now."}</p>` }
  else if (s.type === "finish") { const it = item(s.id);
    if (!it) b = `<h2>This save is gone.</h2>`;
    else { const inNow = it.lane === "now", room = banked().length < (S.profile.pass_cap || 3), recipe = it.kind === "recipe";
      b = `<h2>${inNow ? `Nice. <em>GSD.</em>` : esc(markOf(it))}</h2><p class="mute" style="margin-top:4px">${esc(it.title)}</p>
      <div class="tiny" style="margin-top:18px">How was it?</div>
      <div class="rate">${Object.entries(RATE).map(([k, [e, n]]) => `<button class="${s.rating === k ? "on" : ""}" data-act="rate" data-id="${k}" aria-pressed="${s.rating === k}"><span aria-hidden="true">${e}</span>${n}</button>`).join("")}</div>
      <label class="l" for="rf">${recipe ? "Notes for next time (optional)" : "Anything worth remembering? (optional)"}</label>
      <textarea class="field" id="rf" placeholder="${recipe ? "More garlic. 25 minutes, not 20." : "One line is plenty"}">${esc(s.text ?? "")}</textarea>
      <div class="row" style="margin-top:12px"><button class="chip ${s.wis ? "on" : ""}" data-act="tog" data-id="wis">${s.wis ? "✓ " : ""}💎 Also save the note to Wisdom</button></div>
      <button class="btn keep" style="margin-top:18px;width:100%" data-act="dofinish" data-id="${it.id}" ${S.busy ? "disabled" : ""}>${S.busy ? '<span class="spin"></span>' : "✓"} ${inNow ? "Done" : esc(markOf(it))}</button>
      <p class="tiny" style="margin-top:10px;text-align:center">${inNow ? (room ? `Earns a ${passMin()}-minute scroll pass.` : `Your pass bank is full (${S.profile.pass_cap || 3}). Spend one to earn more.`) : "Logged in its folder. Passes are earned by finishing things in Now."}</p>` } }
  if (s.type === "earned") { const nw = nowItems(), bk = banked(), pool = [...nextItems(), ...candidates()].slice(0, 3 - nw.length);
    b = `<div class="big-em" aria-hidden="true">${s.got ? "🎟️" : "✅"}</div><h2 style="text-align:center">${s.got ? `+${s.got} minutes <em>earned</em>` : "Done."}</h2>
    <p class="mute" style="text-align:center;margin-top:6px">${[bk.length ? `${bk.length} pass${bk.length > 1 ? "es" : ""} banked · ${bk.reduce((a, x) => a + x.minutes, 0)} min` : "", !nw.length ? "Now is clear. All three done 🎉" : "", weekDone() >= goal() ? `Weekly goal hit (${weekDone()}/${goal()}).` : `${weekDone()} of ${goal()} this week.`].filter(Boolean).join(" · ")}</p>
    ${s.save && !item(s.save)?.done_at ? `<div class="gate-box" style="text-align:center"><p>That was the last one from <b>${esc(item(s.save).title)}</b>.</p><button class="btn ghost" data-act="finish" data-id="${s.save}">✓ Mark the whole save as done</button></div>` : ""}
    ${pool.length ? `<div class="tiny" style="margin:20px 0 6px">Fill the free slot</div><div class="nlist">${pool.map(it => nrow(it, `<button class="btn sm" data-act="pickit" data-id="${it.id}">⚡ Now</button>`)).join("")}</div>` : ""}
    <div class="row" style="margin-top:20px;justify-content:center">${s.back?.type === "gate" ? `<button class="btn" data-act="togate">Back to the gate</button>` : ""}<button class="btn${s.back?.type === "gate" ? " ghost" : ""}" data-act="close">Done</button></div>` }
  if (s.type === "swap") { const it = entry(s.id);
    b = `<h2>Now is <em>full</em></h2><p class="mute" style="margin-top:4px">Three is the point. Swap one out to make room for “${esc(it?.title || "this")}”.</p>
    <div class="nlist" style="margin-top:16px">${nowItems().map(o => nrow(o, `<button class="btn sm ghost" data-act="swapout" data-id="${o.id}">Swap out</button>`)).join("")}</div>
    <p class="tiny" style="margin-top:8px">The one you swap out goes first in Up next.</p>
    <div class="row" style="margin-top:16px"><button class="btn ghost" data-act="swapnext">Put it first in Up next instead</button></div>` }
  if (s.type === "folders") { const l = live();
    b = `<h2>Your <em>folders</em></h2><p class="small mute" style="margin-top:4px">Every save goes in one. GSD picks the folder for each new save, and you can move a save from its page. Drag ≡ to change the order.</p>
    <div class="nlist" data-sort="folders" style="margin-top:14px">${S.folders.map(f => { const n = inFolder(f, l).length; return `<div class="nrow" data-sid="${f.id}"><button class="grip ngrip" data-act="nudge" data-id="${f.id}" aria-label="Move ${esc(f.name)}: drag, or use the arrow keys" title="Drag to reorder"><i></i><i></i><i></i></button>
      <button class="nrow-t" data-act="fedit" data-id="${f.id}"><b>${esc(fLabel(f))}</b><span class="tiny">${esc(f.todo_label)} · ${esc(f.done_label)} · ${n} save${n === 1 ? "" : "s"}</span></button>
      <button class="ib" data-act="fedit" data-id="${f.id}" aria-label="Edit ${esc(f.name)}" title="Edit">✏️</button></div>` }).join("")}</div>
    <label class="l" for="fnew">New folder</label>
    <div class="row"><input class="field" id="fnew" placeholder="e.g. Travel, or 🎨 Art" maxlength="44" style="flex:1;min-width:0" enterkeyhint="done"><button class="btn" data-act="fadd">Add</button></div>
    <button class="btn ghost" style="margin-top:16px;width:100%" data-act="close">Done</button>` }
  if (s.type === "folder") { const f = S.folders.find(x => x.id === s.id), n = f ? inFolder(f).length : 0;
    b = !f ? `<h2>That folder is gone.</h2><button class="btn" style="margin-top:16px" data-act="fback">Back</button>` : `<h2>${esc(fLabel(f))}</h2>
    <div class="row" style="align-items:flex-end;flex-wrap:nowrap"><div style="width:72px;flex:none"><label class="l" for="fe">Emoji</label><input class="field" id="fe" value="${esc(f.emoji)}" maxlength="16" style="text-align:center;font-size:22px;padding-left:0;padding-right:0"></div>
      <div style="flex:1;min-width:0"><label class="l" for="fn">Name</label><input class="field" id="fn" value="${esc(f.name)}" maxlength="40"></div></div>
    <div class="row" style="flex-wrap:nowrap"><div style="flex:1;min-width:0"><label class="l" for="ft">Not done filter</label><input class="field" id="ft" value="${esc(f.todo_label)}" maxlength="30" placeholder="To do"></div>
      <div style="flex:1;min-width:0"><label class="l" for="fd">Done filter</label><input class="field" id="fd" value="${esc(f.done_label)}" maxlength="30" placeholder="Done"></div></div>
    <label class="l" for="fa">What goes here (helps GSD sort new saves)</label><input class="field" id="fa" value="${esc(f.about)}" maxlength="200" placeholder="e.g. Trips, hotels and places to see abroad">
    <div class="row" style="margin-top:16px"><button class="btn" data-act="fsave" data-id="${f.id}" ${S.busy ? "disabled" : ""}>Save</button><button class="btn ghost" data-act="fback">Cancel</button>
      <button class="btn ${s.del ? "drop" : "ghost"}" style="margin-left:auto" data-act="fdel" data-id="${f.id}">${s.del ? "Tap again to delete" : "🗑️ Delete"}</button></div>
    ${s.del ? `<p class="tiny" style="margin-top:8px">${n ? `Its ${n} save${n === 1 ? "" : "s"} will be Unsorted, not deleted.` : "It's empty."}</p>` : ""}` }
  if (s.type === "move") { const it = item(s.id), cur = it ? folderOf(it) : UNSORTED;
    b = !it ? `<h2>That save is gone.</h2><button class="btn" style="margin-top:16px" data-act="close">Close</button>` : `<h2>Move to a <em>folder</em></h2><p class="small mute" style="margin-top:4px">${esc(it.title || "This save")}</p>
    <div class="nlist" style="margin-top:14px">${S.folders.map(f => `<button class="frow${f.id === cur.id ? " on" : ""}" data-act="moveto" data-id="${f.id}" aria-pressed="${f.id === cur.id}"><span aria-hidden="true">${f.emoji}</span><b>${esc(f.name)}</b>${f.id === cur.id ? '<span aria-hidden="true">✓</span>' : ""}</button>`).join("")}</div>
    <label class="l" for="mnew">Or a new folder</label>
    <div class="row"><input class="field" id="mnew" placeholder="e.g. Travel" maxlength="44" style="flex:1;min-width:0" enterkeyhint="go"><button class="btn" data-act="movenew">Create and move</button></div>
    <div class="row" style="margin-top:16px">${cur.id !== "none" ? `<button class="btn ghost" data-act="showfolder" data-id="${cur.id}">Everything in ${esc(cur.name)}</button>` : ""}<button class="btn ghost" data-act="fback">Back</button></div>` }
  if (s.type === "pick") b = `<h2>${s.lane === "next" ? "Add to <em>Up next</em>" : "Fill a <em>slot</em>"}</h2>
    <input class="field search" id="pq" type="search" placeholder="Search your library" value="${esc(s.q || "")}" aria-label="Search your library" style="margin-top:14px"><div id="picklist">${pickList()}</div>`;
  if (s.type === "rules") { const m = passMin(), cap = S.profile.pass_cap || 3;
    b = `<h2>How <em>Now</em> works</h2><p class="mute" style="margin-top:4px">Fewer possibilities. More done.</p>
    <ol class="rules">
      <li><b>Three slots.</b> Only three things are active at a time. Everything else waits in Up next (five) or in your Library folders.</li>
      <li><b>Finish to earn.</b> Each thing you finish from Now earns a ${m}-minute scroll pass. You can bank ${cap}.</li>
      <li><b>Clear all three, then hunt.</b> When Now is empty, scrolling opens in ${m}-minute hunts to find what's next. Share finds straight into Now.</li>
      <li><b>The gate.</b> With the iPhone automation on, opening Instagram, YouTube or TikTok shows your Now first. “Open anyway” always works, and counts as a slip.</li>
      <li><b>The gauge.</b> It fills as you finish things this week. The goal is ${goal()} a week; hit it week after week for a streak.</li></ol>
    <div class="row" style="margin-top:18px"><button class="btn" data-act="close">Got it</button>${S.profile.commitment === "none" ? `<button class="btn ghost" data-act="capsetup">📵 Set up the gate</button>` : ""}</div>` }
  if (s.type === "done") b = "";
  if (s.type === "dismiss") b = `<h2>Not for you?</h2><p class="small mute" style="margin-top:4px">Optional: tell GSD why, so suggestions get better.</p>
    <div class="chips" style="margin-top:14px">${[["big", "Too big"], ["no", "Not interested"], ["did", "Did it already"]].map(([k, n]) => `<button class="chip" data-act="dismissed" data-id="${s.id}|${k}">${n}</button>`).join("")}</div>`;
  if (s.type === "ask") b = `<h2>Ask your library</h2><form data-form="ask" style="margin-top:12px"><input class="field" id="aq" placeholder="What could I try this weekend?" value="${esc(S.ask?.q || "")}" aria-label="Your question">
    <div class="scroll" style="margin-top:10px">${["What should go in my Now this weekend?", "What could we cook tonight?", "What themes keep coming up in my saves?"].map(x => `<button type="button" class="chip" data-act="askq" data-id="${esc(x)}">${x}</button>`).join("")}</div>
    <button class="btn" style="margin-top:14px" ${S.ask?.busy ? "disabled" : ""}>${S.ask?.busy ? '<span class="spin"></span> Thinking' : "Ask"}</button></form>
    ${S.ask?.answer ? `<div class="card soft" style="margin-top:16px;white-space:pre-wrap">${esc(S.ask.answer)}</div>${S.ask.sources?.length ? `<div class="stack" style="margin-top:12px;gap:8px">${S.ask.sources.map(x => `<button class="chip" style="white-space:normal;text-align:left" data-act="open" data-id="${x.item_id}">[${x.n}] ${esc(x.title)}</button>`).join("")}</div>` : ""}` : ""}
    ${S.ask?.error ? `<p class="small" style="color:var(--red);margin-top:12px">${esc(S.ask.error)}</p>` : ""}`;
  if (s.type === "ownact") b = `<h2>Your own plan</h2><p class="small mute" style="margin-top:4px">What will count as having done it?</p><label class="l" for="oa">The plan</label><input class="field" id="oa" placeholder="Start with a verb">
    <label class="l" for="om">Kind</label><select class="field" id="om">${Object.entries(MODE).map(([k, v]) => `<option value="${k}">${v[0]} ${v[1]}</option>`).join("")}</select>
    <button class="btn" style="margin-top:16px" data-act="addown" data-id="${s.item || ""}">Make it the plan</button>`;
  if (s.type === "gate") { const nw = nowItems(), bk = banked(), ap = activePass(), app = APPS[s.app] || cap1(s.app || "") || "scrolling", m = passMin();
    b = `<div class="tiny">A pause before ${esc(app)}</div><h2 class="gate-h">${esc(S.profile.intention || (nw.length ? "Earn it first." : "Now is clear."))}</h2>
    ${ap ? `<div class="gate-box"><p><b>⏱ ${minsLeft(ap)} minutes left on your pass.</b></p><button class="btn" data-act="gogo" data-id="${esc(s.app || "")}">Continue to ${esc(app)}</button></div>`
    : `${nw.length ? `<div class="tiny" style="margin:16px 0 6px">Your Now</div><div class="nlist">${nw.map(gateRow).join("")}</div>` : ""}
      <div class="gate-box">${nw.length && bk.length ? `<p><b>🎟️ You've earned ${bk.length} pass${bk.length > 1 ? "es" : ""}.</b> Spend one on ${bk[0].minutes} minutes of ${esc(app)}?</p><button class="btn" data-act="usepass" data-id="pass">Start a ${bk[0].minutes}-minute pass</button>`
        : nw.length ? `<p><b>Finish one of these to earn ${m} minutes.</b> Tap ✓ when it's done, then come back here.</p>`
        : `<p><b>You cleared all three.</b> Scroll with a purpose: find up to three things worth doing and share them to GSD → Now.</p><button class="btn" data-act="usepass" data-id="hunt">Start hunting · ${m} min</button>`}</div>
      <div class="stack" style="margin-top:14px;gap:10px;align-items:center"><button class="btn ghost" style="width:100%" data-act="close">Not now, stay here</button>
        <button class="small mute" style="text-decoration:underline;padding:6px" data-act="usepass" data-id="slip">Open ${esc(app)} anyway (counts as a slip)</button></div>`}` }
  if (s.type === "capsetup") { const fn = CFG.url + "/functions/v1/gsd", site = location.origin + location.pathname, copy = v => ` <button class="chip" data-act="copy" data-id="${esc(v)}">Copy</button>`;
    b = `<h2>Set up your iPhone</h2><p class="small mute" style="margin-top:4px">Two one-time Shortcuts: one saves from any app's share sheet, one puts your Now in front of Instagram, YouTube and TikTok.</p>
    ${S.newToken ? `<div class="card soft" style="margin-top:14px"><div class="tiny">Your capture token (shown once). Both shortcuts use it.</div><code style="word-break:break-all;display:block;margin:6px 0">${esc(S.newToken)}</code><button class="btn sm" data-act="copy" data-id="${esc(S.newToken)}">Copy token</button></div>`
      : `<button class="btn" style="margin-top:14px" data-act="newtoken">Create a capture token</button>`}
    <h3 class="sec">1 · Save from the share sheet</h3>
    <ol class="small steps">
      <li>Open <b>Shortcuts</b> → + → name it <b>Save to GSD</b>. Tap ⓘ → turn on <b>Show in Share Sheet</b> (URLs and Text).</li>
      <li>Add <b>List</b> with three items: <code>Now</code>, <code>Up next</code>, <code>Library</code>. Then add <b>Choose from List</b>.</li>
      <li>Add <b>Get Contents of URL</b>:<br><code style="word-break:break-all">${esc(fn)}/capture</code>${copy(fn + "/capture")}<br>Method <b>POST</b>. Header <code>Authorization</code> = <code>Bearer </code> + your token.</li>
      <li>Request Body <b>JSON</b>: <code>text</code> = Shortcut Input, <code>lane</code> = Chosen Item, <code>via</code> = <code>shortcut</code>.</li>
      <li>Add <b>Get Dictionary Value</b> for <code>message</code>, then <b>Show Notification</b> with it. It tells you where the save went: “Saved to Now (slot 2 of 3).”</li></ol>
    <p class="tiny" style="margin-top:8px">Don't want the menu? Skip step 2 and leave out <code>lane</code>. Saves then go to the Library, and writing <code>#now</code> or <code>#next</code> in the shared text still works.</p>
    <p class="tiny" style="margin-top:8px">Saves get a quick read to spare transcript credits. To read one fully (watch the clip, transcribe speech), add <code>read</code> = <code>Full</code> to the request, or write <code>#full</code> in the shared text.</p>
    <h3 class="sec">2 · The scroll gate</h3>
    <ol class="small steps">
      <li>Sign in to GSD once in <b>Safari</b> at <code style="word-break:break-all">${esc(site)}</code> (the gate opens there).</li>
      <li>Shortcuts → <b>Automation</b> → + → <b>App</b> → choose <b>Instagram</b> → <b>Is Opened</b> → <b>Run Immediately</b>.</li>
      <li>Add <b>Get Contents of URL</b>:<br><code style="word-break:break-all">${esc(fn)}/gate-check?app=instagram</code>${copy(fn + "/gate-check?app=instagram")}<br>Method <b>GET</b>, the same <code>Authorization</code> header.</li>
      <li>Add <b>Get Dictionary Value</b> for <code>open</code>. Add <b>If</b> Dictionary Value <b>is</b> <code>yes</code> → <b>Open URLs</b>:<br><code style="word-break:break-all">${esc(site)}?gate=instagram</code>${copy(site + "?gate=instagram")}</li>
      <li>Make the same automation for <b>YouTube</b> (<code>youtube</code> in both addresses) and <b>TikTok</b> (<code>tiktok</code>).</li>
      <li>Turn on <b>Scroll gate</b> under You → The rules.</li></ol>
    <p class="tiny" style="margin-top:8px">While a pass is running the check says <code>no</code> and the app opens as normal. YouTube can't tell Shorts from the rest, so the gate covers the whole app.</p>
    <h3 class="sec">3 · Optional: ring when a pass ends</h3>
    <ol class="small steps">
      <li>New shortcut named exactly <b>GSD Pass</b>. Add <b>Split Text</b>: Shortcut Input, separated by Spaces.</li>
      <li><b>Get Item from List</b> → First Item → <b>Start Timer</b> for that many minutes.</li>
      <li><b>Get Item from List</b> (from Split Text) → Last Item → <b>Open URLs</b>.</li>
      <li>Turn on <b>Ring when a pass ends</b> under You → The rules.</li></ol>
    ${S.tokens.length ? `<div class="sec"><h3>Tokens</h3><div class="stack" style="margin-top:8px;gap:8px">${S.tokens.map(t => `<div class="row small" style="justify-content:space-between"><span>${esc(t.name)} · created ${ago(t.created_at)}${t.last_used_at ? " · used " + ago(t.last_used_at) : ""}</span><button class="chip" data-act="revoke" data-id="${t.id}">Revoke</button></div>`).join("")}</div></div>` : ""}` }
  return `<div class="overlay" data-act="backdrop" data-type="${s.type}"><div class="sheet${s.type === "gate" ? " gate" : ""}" role="dialog" aria-modal="true"><div class="grab"></div><button class="x" data-act="close" aria-label="Close">✕</button>${b}</div></div>`;
}
/* ---------- item view: ambient colour, floating media card, liquid-glass sheet ---------- */
const IC = {
  back: '<svg class="ch" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  x: '<svg class="x-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4.8c0-.4.4-.8.8-.8h4.4c.4 0 .8.4.8.8V7M6 7l1 12.2c.1 1 .9 1.8 1.9 1.8h6.2c1 0 1.8-.8 1.9-1.8L18 7M10 11v6M14 11v6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.5-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 12.5h8M8 16h5"/></svg>',
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1.1" fill="#fff" stroke="none"/></svg>',
};
const SRC = { instagram: ["Instagram", IC.cam], youtube: ["YouTube", IC.play], tiktok: ["TikTok", "♪"], x: ["X", "𝕏"], facebook: ["Facebook", "f"], reddit: ["Reddit", "👽"],
  maps: ["Maps", "📍"], note: ["Your note", "📝"], image: ["Your image", "🖼️"], web: ["", "🌐"] };
const cap1 = s => s ? s[0].toUpperCase() + s.slice(1) : "";
const tagLabel = t => cap1(String(t).replace(/[-_]+/g, " "));
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, "") } catch { return "" } };

/* colour: sample the thumbnail once, keep a calm version of its dominant hue */
function rgbToHsl(r, g, b) { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn; if (!d) return [0, 0, l];
  const s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn), h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h * 60, s, l] }
function hslToRgb(h, s, l) { const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)))); return `${f(0)},${f(8)},${f(4)}` }
const TINT = (() => { try { return new Map(Object.entries(JSON.parse(localStorage.getItem("gsd_tints") || "{}"))) } catch { return new Map() } })();
function tintFor(it) {
  const key = it.thumb_path; if (!key) return Promise.resolve(null);
  if (TINT.has(key)) return Promise.resolve(TINT.get(key));
  return new Promise(res => {
    const im = new Image(); im.crossOrigin = "anonymous";
    im.onload = () => { try {
      const n = 24, c = document.createElement("canvas"); c.width = c.height = n;
      const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(im, 0, 0, n, n);
      const d = x.getImageData(0, 0, n, n).data; let r = 0, g = 0, b = 0, w = 0;
      for (let i = 0; i < d.length; i += 4) { // favour colourful mid-tones over greys, blacks and blown highlights
        const [, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]), k = .04 + s * s * Math.max(0, 1 - Math.abs(l - .5) * 1.7);
        r += d[i] * k; g += d[i + 1] * k; b += d[i + 2] * k; w += k }
      const [h, s, l] = rgbToHsl(r / w, g / w, b / w), t = hslToRgb(h, Math.min(s, .55), Math.min(Math.max(l, .32), .52));
      TINT.set(key, t); try { localStorage.setItem("gsd_tints", JSON.stringify(Object.fromEntries([...TINT].slice(-300)))) } catch {}
      res(t) } catch { res(null) } };
    im.onerror = () => res(null); im.src = thumbUrl(it);
  });
}
const fallbackTint = it => hslToRgb(Math.round(hash(it.id) * 360), .36, .44);
function setThemeColor() {
  const iv = $(".iv"), m = $("#themecolor"); if (!m) return;
  if (!iv) return m.setAttribute("content", document.documentElement.dataset.theme === "dark" ? "#000000" : "#f2f2f5");
  const dark = document.documentElement.dataset.theme === "dark", [r, g, b] = getComputedStyle(iv).getPropertyValue("--tint").split(",").map(Number);
  const mix = v => Math.round(dark ? v * .6 : (v + 255) / 2); // what the wash over the ambient ends up looking like at the very top
  m.setAttribute("content", `rgb(${mix(r)},${mix(g)},${mix(b)})`);
}
// Fill the frame when the picture's shape is close to it, otherwise show all of it over a blurred copy.
function fitPic(img) { const box = img.parentElement; if (!box || !img.naturalWidth || !box.clientHeight) return;
  box.classList.toggle("fit", Math.abs(Math.log((img.naturalWidth / img.naturalHeight) / (box.clientWidth / box.clientHeight))) > .6) }
addEventListener("resize", () => document.querySelectorAll(".iv-pic img").forEach(fitPic));

function ivMedia(it) {
  const u = safeUrl(it.url), img = thumbUrl(it), [sname, sico] = SRC[it.source] || SRC.web, host = hostOf(u);
  const who = it.author ? `${it.author}${sname ? " on " + sname : ""}` : sname || host || "Saved";
  const sub = host || (it.source === "note" ? "Written by you" : "Saved " + ago(it.created_at));
  const pic = img ? `<div class="iv-pic" style="--img:url('${esc(img)}')"><img src="${esc(img)}" alt="" onload="fitPic(this)" onerror="this.parentNode.classList.add('none');this.parentNode.insertAdjacentHTML('beforeend','<span class=big>${KIND[it.kind] || "✨"}</span>');this.remove()">
      ${it.kind === "video" && u ? `<span class="iv-play lg warp" aria-hidden="true">${IC.play}</span>` : ""}</div>`
    : `<div class="iv-pic txt"><span class="big" aria-hidden="true">${KIND[it.kind] || "✨"}</span><p>${esc(pending(it) ? (u || "Reading…") : it.insight || it.summary || it.title || "")}</p></div>`;
  const capt = img && !pending(it) ? it.insight : "";
  const inner = `${pic}<div class="iv-cap">${capt ? `<p class="iv-capt">${esc(capt)}</p>` : ""}
    <div class="iv-src"${capt ? "" : ' style="margin-top:0"'}><span class="iv-ico ${esc(it.source || "web")}" aria-hidden="true">${sico}</span><div><b>${esc(who)}</b><span>${esc(sub)}</span></div>${u ? `<span class="go" aria-hidden="true">↗</span>` : ""}</div></div>`;
  return u ? `<a class="iv-card" href="${esc(u)}" target="_blank" rel="noopener noreferrer" aria-label="Open the original${sname ? " on " + esc(sname) : ""}">${inner}</a>` : `<div class="iv-card">${inner}</div>`;
}
/* ---------- transcript credits ---------- */
// Mirrors the worker's ladder. Quick read: YouTube 1 credit (captions), Instagram 2 (metadata + captions).
// Full read adds watching clips up to 3 minutes (5 a started minute) and, when nothing was heard, transcribing (2 a minute).
// A full read never spends the last `reserve` credits; quick reads go on until the account is empty.
const crLeft = () => S.credits?.left ?? null; // null: not known (yet)
const fullBlocked = () => crLeft() != null && crLeft() <= (S.credits?.reserve ?? 10);
const crWord = n => `${n} credit${n === 1 ? "" : "s"}`;
// What reading this save fully would cost, step by step as the worker does it, and whether it would add anything.
// Watching usually hears the speech too, so transcribing is only counted when the clip won't be watched.
function fullCost(it) {
  const d = it.duration_seconds || 0, mins = Math.max(1, Math.ceil((d || 90) / 60));
  if (it.source === "web") return { cost: 1, adds: it.quality !== "full" };
  const quick = 2; // a full read starts with metadata + captions for YouTube and Instagram alike
  const watch = S.profile.watch_video !== false && (d ? d <= 180 : it.source !== "youtube") ? 5 * mins : 0;
  const hear = !watch && it.quality !== "full" && (d || it.source !== "youtube") && mins <= (S.profile.transcribe_minutes ?? 10) ? 2 * mins : 0;
  return { cost: quick + watch + hear, adds: watch + hear > 0 };
}
const costText = c => `about ${crWord(c.cost)}`;
// A save read the quick way can be read again fully (watching short clips, transcribing speech without captions) when that adds something.
const canReadFully = it => !it.deep_read && !S.profile.full_read && !["note", "image", "maps"].includes(it.source) && !pending(it) && fullCost(it).adds;
function creditsCard() {
  const c = S.credits;
  if (!c) return `<div class="card soft" style="margin-top:12px"><h3>Transcript credits</h3><p class="tiny" style="margin-top:6px"><span class="spin"></span> Checking with Supadata…</p></div>`;
  if (!c.configured) return `<div class="card soft" style="margin-top:12px"><h3>Transcript credits</h3><p class="tiny" style="margin-top:6px">No Supadata key is set, so videos are read from their caption only.</p></div>`;
  const known = c.max != null && c.max > 0, pct = known ? Math.min(100, 100 * c.used / c.max) : 0, low = known && c.left <= c.reserve;
  return `<div class="card soft" style="margin-top:12px"><div class="row" style="justify-content:space-between"><h3>${known ? `${c.left} transcript credits left` : "Transcript credits"}</h3><span class="small mute">${esc(c.plan || "Supadata")}</span></div>
    ${known ? `<div class="bar" style="margin:10px 0 6px"><i style="width:${pct}%${low ? ";background:var(--red)" : ""}"></i></div>` : ""}
    <div class="tiny">${known ? `${c.used} of ${c.max} used this period. ` : ""}This month GSD used ${crWord(c.month_spent)}${c.month_saves ? ` on ${c.month_saves} save${c.month_saves === 1 ? "" : "s"}, about ${(c.month_spent / c.month_saves).toFixed(1)} each` : ""}.</div>
    ${low ? `<div class="banner" style="margin:10px 0 0;background:var(--red-bg);color:var(--red)">${c.left ? `Only ${crWord(c.left)} left: full reads are paused so quick reads keep working.` : "Out of transcript credits: saves are read from their caption until Supadata renews."}</div>` : ""}</div>`;
}
function ivMenu(it) {
  const u = safeUrl(it.url);
  return `<div class="iv-catch" data-act="menuclose"></div><div class="iv-menu lg" role="menu">
    ${u ? `<a role="menuitem" href="${esc(u)}" target="_blank" rel="noopener noreferrer" data-act="menuclose"><span aria-hidden="true">↗</span>Open original</a>
      <button role="menuitem" data-act="copy" data-id="${esc(u)}"><span aria-hidden="true">🔗</span>Copy link</button>` : ""}
    ${S.cards.some(c => c.item_id === it.id) ? `<button role="menuitem" data-act="remember" data-id="${it.id}"><span aria-hidden="true">🧠</span>${it.remember ? "Stop remembering" : "Help me remember"}</button>` : ""}
    ${it.area === "Wisdom" && it.source === "note" ? "" : `<button role="menuitem" data-act="reprocess" data-id="${it.id}"><span aria-hidden="true">🔄</span>Re-read</button>`}
    ${canReadFully(it) && !fullBlocked() ? `<button role="menuitem" data-act="readfull" data-id="${it.id}"><span aria-hidden="true">🎧</span>Read it fully · ${costText(fullCost(it)).replace("about ", "~")}</button>` : ""}
    ${it.status !== "let_go" ? `<button role="menuitem" data-act="letgo" data-id="${it.id}"><span aria-hidden="true">🍃</span>Let go</button>` : ""}</div>`;
}
function ivHead(it) {
  const del = confirmDel === it.id;
  return `<div class="iv-head">
    <div class="iv-kind"><span aria-hidden="true">${KIND[it.kind] || "✨"}</span><span class="iv-kt">${pending(it) ? "Reading" : esc(cap1(it.kind) || "Save")}</span></div>
    ${!pending(it) ? `<button class="iv-area lgb" data-act="ivfolder" data-id="${it.id}" title="Move to another folder" aria-label="Folder: ${esc(folderOf(it).name)}. Move to another folder">${esc(fLabel(folderOf(it)))} <span aria-hidden="true" style="opacity:.6">▾</span></button>` : "<span></span>"}
    <div class="iv-tools">
      <button class="iv-ic lgb" data-act="ivmenu" aria-label="More options" aria-haspopup="menu" aria-expanded="${!!S.sheet.menu}">${IC.more}</button>
      <button class="iv-ic del lgb${del ? " on" : ""}" data-act="delete" data-id="${it.id}" aria-label="${del ? "Tap again to delete forever" : "Delete"}">${IC.trash}${del ? "<span>Delete?</span>" : ""}</button>
      ${S.sheet.menu ? ivMenu(it) : ""}</div></div>`;
}
function resCard(r, it) {
  const ru = safeUrl(r.url), finding = !ru && it.enrich_state === "pending";
  const href = ru || (finding ? "" : `https://www.google.com/search?q=${encodeURIComponent(r.search_hint || [r.title, r.creator].filter(Boolean).join(" "))}`);
  const inner = `<h4>${esc(r.title)}</h4>${r.about ? `<p>${esc(r.about)}</p>` : ""}
    <div class="iv-xcs"><span class="iv-xc hi">${RES[r.type] || "✨"} ${esc(cap1(r.type || "other"))}</span>${r.creator && r.creator !== r.title ? `<span class="iv-xc">${esc(r.creator)}</span>` : ""}</div>
    ${r.note ? `<p class="xn">${esc(r.note)}</p>` : ""}
    ${finding ? `<p class="xn"><span class="spin"></span> Finding the link…</p>` : `<span class="iv-go">${ru ? esc(RES_LABEL[r.type] || "Open it") : "Search for it"} ↗</span>`}`;
  return href ? `<a class="iv-x" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : `<div class="iv-x">${inner}</div>`;
}
function ivEntities(it) {
  const e = it.entities || {}, u = safeUrl(it.url), out = [], card = (h, body) => `<div class="iv-x"><h4>${h}</h4>${body}</div>`;
  if (e.place?.name) { const q = encodeURIComponent([e.place.name, e.place.address, e.place.city].filter(Boolean).join(" ")), site = safeUrl(e.place.website) || safeUrl((it.resources || []).find(r => r.type === "place" && r.url)?.url);
    out.push(card(`📍 ${esc(e.place.name)}`, `<p>${esc([e.place.category, e.place.address, e.place.city].filter(Boolean).join(" · "))}</p>${e.place.known_for ? `<p style="color:inherit">${esc(e.place.known_for)}</p>` : ""}
      <div class="row">${it.source === "maps" && u ? `<a class="btn sm" target="_blank" rel="noopener noreferrer" href="${esc(u)}">Open the map ↗</a>` : `<a class="btn sm" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${q}">Google Maps ↗</a>`}
      <a class="btn sm line" target="_blank" rel="noopener noreferrer" href="https://maps.apple.com/?q=${q}">Apple Maps ↗</a>${site ? `<a class="btn sm line" target="_blank" rel="noopener noreferrer" href="${esc(site)}">Website ↗</a>` : ""}</div>`)) }
  if (e.product?.name) out.push(card(`🛍️ ${esc(e.product.name)}`, `<div class="iv-xcs">${[e.product.brand, e.product.price].filter(Boolean).map(x => `<span class="iv-xc">${esc(x)}</span>`).join("")}</div>`));
  if (e.recipe?.ingredients?.length) out.push(card(`🍽️ Ingredients`, `<ul class="tk small">${e.recipe.ingredients.map(x => `<li>${esc(x)}</li>`).join("")}</ul>${e.recipe.steps?.length ? `<h4 style="margin-top:14px">Steps</h4><ol class="small" style="padding-left:20px;margin:6px 0 0">${e.recipe.steps.map(x => `<li style="margin:4px 0">${esc(x)}</li>`).join("")}</ol>` : ""}
    <div class="row"><button class="btn sm ghost" data-act="copy" data-id="${esc(e.recipe.ingredients.join("\n"))}">Copy the list</button></div>`));
  if (e.book?.title) out.push(card(`📖 ${esc(e.book.title)}`, e.book.author ? `<p>${esc(e.book.author)}</p>` : ""));
  if (e.film?.title) { const cc = JW[String(S.profile.country || "").toLowerCase().trim()] || "us";
    out.push(card(`${e.film.type === "show" ? "📺" : "🎬"} ${esc(e.film.title)}${e.film.year ? ` (${e.film.year})` : ""}`, `<p>${esc([e.film.creator, e.film.genre, e.film.runtime_minutes ? e.film.runtime_minutes + " min" : ""].filter(Boolean).join(" · "))}</p>${e.film.where_to_watch ? `<p style="color:inherit">On ${esc(e.film.where_to_watch)}</p>` : ""}
      <div class="row"><a class="btn sm" target="_blank" rel="noopener noreferrer" href="https://www.justwatch.com/${cc}/search?q=${encodeURIComponent(e.film.title)}">Where to watch ↗</a></div>`)) }
  if (e.tool?.name) out.push(card(`🛠️ ${esc(e.tool.name)}`, `${e.tool.what_for ? `<p>${esc(e.tool.what_for)}</p>` : ""}${safeUrl(e.tool.url) ? `<a class="iv-go" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(e.tool.url))}">Open it ↗</a>` : ""}`));
  if (e.workout?.exercises?.length) out.push(card(`🏃 Workout`, `<ul class="tk small">${e.workout.exercises.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`));
  if (e.event?.name) out.push(card(`🎟️ ${esc(e.event.name)}`, `<p>${esc([e.event.date, e.event.place].filter(Boolean).join(" · "))}</p>`));
  return out.length ? `<section class="iv-sec"><div class="iv-cols">${out.join("")}</div></section>` : "";
}
function ivLane(it) {
  const cur = it.lane || "", gone = it.status === "let_go";
  return `<div class="iv-lane" role="group" aria-label="Where this save lives">${[["now", "⚡ Now"], ["next", "⏭ Up next"], ["", "📚 Library"]].map(([k, n]) => `<button class="iv-seg${!gone && cur === k ? " on" : ""}" data-act="ivlane" data-id="${it.id}|${k}" aria-pressed="${!gone && cur === k}">${n}</button>`).join("")}</div>
    ${it.lane === "now" ? `<button class="iv-finish lgb" data-act="finish" data-id="${it.id}">✓ Done · earns ${passMin()} min</button>` : !pending(it) ? `<button class="iv-addnote lgb" style="margin-top:10px" data-act="finish" data-id="${it.id}">✓ ${esc(markOf(it))}${it.done_at ? " again" : ""}</button>` : ""}
    ${it.done_at ? `<div class="iv-done"><b>${it.rating ? RATE[it.rating][0] + " " + RATE[it.rating][1] : "✓ " + esc(doneVerb(it))}</b><span>${esc(doneVerb(it))} ${ago(it.done_at)}${it.done_count > 1 ? ` · ${it.done_count} times` : ""}</span>${it.done_note ? `<p>${esc(it.done_note)}</p>` : ""}</div>` : ""}`;
}
function ivBody(it) {
  const u = safeUrl(it.url), [sname] = SRC[it.source] || SRC.web;
  if (pending(it)) return `${ivHead(it)}<h2 class="iv-title"><span class="spin"></span> Reading it…</h2>
    <p class="iv-sum">Usually under a minute. GSD reads the caption and subtitles${it.deep_read || S.profile.full_read ? ", watches short clips" : ""} and then looks up what was mentioned. You can close this.</p>${ivLane(it)}`;
  const pid = planOf(it)?.id, acts = itemActs(it.id).sort((x, y) => (y.id === pid) - (x.id === pid) || (x.resource_idx ?? 99) - (y.resource_idx ?? 99)), rel = S.related[it.id];
  const ts = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`, d = daysIn(it), sh = shelfOf(it);
  const meta = [sname || hostOf(u), "saved " + ago(it.created_at), it.resaved_count ? `saved ${it.resaved_count + 1} times` : "",
    it.lane === "now" ? `⚡ In Now · ${d ? `${d} day${d > 1 ? "s" : ""}` : "since today"}` : it.lane === "next" ? "⏭ Up next" : it.status === "let_go" ? "🍃 Let go" : it.status === "inbox" ? "Unsorted" : `${sh.em} ${sh.name}`].filter(Boolean).join(" · ");
  const noteOpen = S.sheet.noteOpen || it.note;
  return `${ivHead(it)}
    ${(it.tags || []).length ? `<div class="iv-tags">${it.tags.map(x => `<button class="iv-tag lgb" data-act="ivtag" data-id="${esc(x)}">${esc(tagLabel(x))}</button>`).join("")}</div>` : ""}
    <h2 class="iv-title">${esc(it.title || "Untitled")}</h2>
    <p class="iv-meta">${esc(meta)}</p>
    ${ivLane(it)}
    ${it.stage === "failed" ? `<div class="banner" style="background:var(--red-bg);color:var(--red)">${esc(ERR[it.error_code] || "Something went wrong reading this.")}${it.diag ? `<br><span class="tiny" style="color:inherit;opacity:.8">Details: ${esc(it.diag)}</span>` : ""}
      <div class="row" style="margin-top:10px"><button class="btn sm" data-act="reprocess" data-id="${it.id}">Re-read</button></div></div>` : ""}
    ${it.summary ? `<p class="iv-sum">${esc(it.summary)}</p>` : ""}
    <hr class="iv-hr">
    ${noteOpen ? `<div class="iv-note"><label class="iv-lbl" for="note">${IC.doc.replace("<svg", '<svg width="18" height="18"')} Your note</label><textarea class="field" id="note" data-note="${it.id}" placeholder="Why it matters to you" rows="3">${esc(it.note || "")}</textarea></div>`
      : `<button class="iv-addnote lgb" data-act="ivnote">${IC.doc} Add a note</button>`}
    <section class="iv-sec"><h3 class="iv-h">How to do it <button data-act="ownact" data-id="${it.id}">+ Your own</button></h3>
      ${acts.length > 1 ? `<p class="small mute" style="margin:-6px 0 14px">Put the whole save in Now, or give any single one of these its own slot.</p>` : ""}
      ${acts.length ? `<div class="iv-cols">${acts.map(a => actRow(a, it)).join("")}</div>` : `<p class="small mute">No plan yet. Add your own, or just do it and tap ✓.</p>`}
      ${it.stage === "ready" ? `<form data-form="steer" data-id="${it.id}" class="row" style="margin-top:4px"><input class="field" id="steer" style="flex:1;min-width:160px" placeholder="Different ideas… (optional: “outdoors”, “shorter”)" aria-label="Steer new ideas"><button class="btn sm ghost" ${S.busy ? "disabled" : ""}>${S.busy ? '<span class="spin"></span>' : "Different ideas"}</button></form>` : ""}</section>
    ${it.takeaways?.length ? `<section class="iv-sec"><h3 class="iv-h">Key points</h3><ol class="iv-pts">${it.takeaways.map(k => `<li>${esc(k.text)}${k.t != null && it.source === "youtube" && u ? ` <a class="chip" style="padding:2px 8px" target="_blank" rel="noopener noreferrer" href="${esc(u + (u.includes("?") ? "&" : "?") + "t=" + k.t + "s")}">${ts(k.t)}</a>` : ""}</li>`).join("")}</ol></section>` : ""}
    ${(it.quotes || []).length ? `<section class="iv-sec"><div class="iv-cols">${it.quotes.map(q => `<blockquote class="iv-quote">${esc(q)}</blockquote>`).join("")}</div></section>` : ""}
    ${ivEntities(it)}
    ${(it.resources || []).length ? `<section class="iv-sec"><h3 class="iv-h">Mentioned <small>${it.enrich_state === "pending" ? '<span class="spin"></span> Finding the links…' : it.resources.length}</small></h3>
      <div class="iv-cols">${it.resources.map(r => resCard(r, it)).join("")}</div></section>` : ""}
    ${rel?.length ? `<section class="iv-sec"><h3 class="iv-h">Related saves</h3><div class="iv-rel">${rel.map(tile).join("")}</div></section>` : ""}
    <p class="iv-foot">${[it.opened_count ? `Opened ${it.opened_count} time${it.opened_count === 1 ? "" : "s"}` : "", it.quality === "caption_only" ? "Read from the caption only" : it.quality === "title_only" ? "Only the title was readable" : "", it.deep_read ? "Read fully" : "", it.supadata_credits ? `${crWord(it.supadata_credits)} used` : ""].filter(Boolean).join(" · ")}</p>
    ${canReadFully(it) && it.quality !== "full" ? `<div class="row" style="justify-content:center;margin-top:10px"><button class="btn sm ghost" data-act="readfull" data-id="${it.id}" ${fullBlocked() ? "disabled" : ""}>🎧 Read it fully</button></div><p class="tiny" style="text-align:center;margin-top:6px">${fullBlocked() ? `Only ${crWord(crLeft())} left, kept for quick reads.` : `Watches the clip and transcribes what is said: ${costText(fullCost(it))}.`}</p>` : ""}`;
}
let ivStatic = false;
function itemView(it) {
  if (!it) return `<div class="overlay" data-act="backdrop"><div class="sheet" role="dialog" aria-modal="true"><button class="x" data-act="close" aria-label="Close">✕</button><p>This save is gone.</p></div></div>`;
  const img = thumbUrl(it), h = Math.round(hash(it.id) * 360);
  const amb = img ? `url('${img}')` : `radial-gradient(circle at 18% 12%,hsl(${h} 72% 64%),transparent 58%),radial-gradient(circle at 85% 82%,hsl(${(h + 40) % 360} 62% 56%),transparent 60%),hsl(${h} 42% 44%)`;
  return `<div class="iv${ivStatic ? " static" : ""}" data-id="${it.id}" data-act="backdrop" style="--tint:${TINT.get(it.thumb_path) || fallbackTint(it)};--amb:${esc(amb)}" role="dialog" aria-modal="true" aria-label="${esc(it.title || "Save")}">
    <div class="iv-win"><div class="iv-amb" aria-hidden="true"><i></i></div>
      <button class="iv-back lg warp lgb" data-act="close" aria-label="Close">${IC.back}${IC.x}</button>
      <div class="iv-scroll" id="ivs"><div class="iv-grid">
        <section class="iv-media" aria-label="Original">${ivMedia(it)}</section>
        <section class="iv-sheet lg">${ivBody(it)}</section>
      </div></div></div></div>`;
}
function ivMount(same, top) {
  const iv = $(".iv"), sc = $("#ivs"); if (!iv || !sc) return;
  if (same) sc.scrollTop = top;
  let raf = 0;
  const upd = () => { raf = 0; const sh = $(".iv-sheet", iv); if (sh) iv.style.setProperty("--p", Math.min(1, Math.max(0, sc.scrollTop / Math.max(1, sh.offsetTop - 80))).toFixed(3)) };
  sc.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(upd) }, { passive: true }); upd();
  sc.addEventListener("touchend", () => { if (sc.scrollTop < -70) H.close() }, { passive: true }); // pull down past the top to close (iOS rubber band)
  if (!same) $(".iv-back", iv).focus({ preventScroll: true });
  const it = item(iv.dataset.id);
  if (it?.thumb_path && !TINT.has(it.thumb_path)) tintFor(it).then(t => { if (t && iv.isConnected) { iv.style.setProperty("--tint", t); setThemeColor() } });
}

/* back button / back gesture closes whatever sheet is open */
let histOn = false;
function syncHistory() {
  if (S.sheet && !histOn) { try { history.pushState({ gsdSheet: 1 }, ""); histOn = true } catch {} }
  else if (!S.sheet && histOn) { histOn = false; if (history.state?.gsdSheet) history.back() }
}
addEventListener("popstate", () => { if (!histOn) return; histOn = false; if (S.sheet) H.close() });
if (navigator.userAgentData && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.documentElement.classList.add("lg-warp"); // the SVG warp only renders right in Chromium

/* ---------- render ---------- */
const TABS = [["now", "⚡", "Now"], ["library", "🗂️", "Library"], ["explore", "✨", "Explore"], ["profile", "🙂", "You"]];
const tabBtn = ([k, e, n]) => `<button class="tab ${S.tab === k ? "on" : ""}" data-act="tab" data-id="${k}"><span aria-hidden="true">${e}</span>${n}</button>`;
function render() {
  const app = $("#app");
  if (S.screen === "boot") return;
  if (S.screen === "auth") { const up = S.authMode === "up"; app.innerHTML = `<div class="center"><form class="auth" data-form="auth"><div class="logo" style="justify-content:center;font-size:34px"><i style="width:18px;height:28px"></i>GSD</div>
    <h1 style="margin-top:18px">Actually <em>do</em> the stuff you save</h1>
    <label class="l" for="em" style="text-align:left">Email</label><input class="field" id="em" type="email" autocomplete="email" required>
    <label class="l" for="pw" style="text-align:left">Password</label><input class="field" id="pw" type="password" autocomplete="${up ? "new-password" : "current-password"}" minlength="8" required>
    ${S.authMsg ? `<p class="small" style="margin-top:10px;color:${S.authOk ? "var(--green)" : "var(--red)"}">${esc(S.authMsg)}</p>` : ""}
    <button class="btn" style="margin-top:16px;width:100%" ${S.busy ? "disabled" : ""}>${up ? "Create account" : "Sign in"}</button>
    <p class="small mute" style="margin-top:14px">${up ? "Already have an account?" : "First time here?"} <button type="button" data-act="authmode" style="text-decoration:underline">${up ? "Sign in" : "Create account"}</button></p></form></div>`; return }
  if (S.screen === "error") { app.innerHTML = `<div class="center"><div class="auth"><h2>Couldn't load your library</h2><p class="mute" style="margin-top:8px">${esc(S.error)}</p><div class="row" style="margin-top:16px;justify-content:center"><button class="btn" data-act="reload">Try again</button><button class="btn ghost" data-act="signout">Sign out</button></div></div></div>`; return }
  const view = { now: vNow, library: vLibrary, explore: vExplore, profile: vProfile }[S.tab]();
  app.innerHTML = `<div class="shell"><aside class="side"><div class="logo"><i></i>GSD</div>
    ${TABS.map(([k, e, n]) => `<button class="nav ${S.tab === k ? "on" : ""}" data-act="tab" data-id="${k}"><span aria-hidden="true">${e}</span>${n}</button>`).join("")}
    <button class="btn" data-act="save">+ Save something</button></aside>
    <main><div class="top"><div class="logo"><i></i>GSD</div><button class="chip" data-act="theme" data-id="flip" aria-label="Switch between light and dark mode" style="margin-left:auto">${document.documentElement.dataset.theme === "dark" ? "☀️ Light" : "🌙 Dark"}</button></div>${view}</main>
    <nav class="tabs" aria-label="Main">${TABS.slice(0, 2).map(tabBtn).join("")}<button class="plus" data-act="save" aria-label="Save something">+</button>${TABS.slice(2).map(tabBtn).join("")}</nav></div>`;
  if (S.tab === "explore") watchFeed();
  if (S.tab === "library") gfMount();
  if (S.tab !== lastTab) { lastTab = S.tab; $("main")?.classList.add("enter") } // only a change of tab animates in; re-renders stay put
}
let lastTab = "";
function renderSheet() {
  const host = $("#sheet"), prev = host.firstElementChild;
  // Re-rendering the same open save (polling, a toggle, related saves arriving) keeps its scroll, skips the entrance and keeps what you're typing.
  const same = S.sheet?.type === "item" && prev?.classList.contains("iv") && prev.dataset.id === S.sheet.id, top = same ? $("#ivs")?.scrollTop || 0 : 0;
  const ae = document.activeElement, keep = same && ae?.id && host.contains(ae) && /^(TEXTAREA|INPUT)$/.test(ae.tagName) ? { id: ae.id, v: ae.value, a: ae.selectionStart, b: ae.selectionEnd } : null;
  const sameSheet = prev?.classList.contains("overlay") && prev.dataset.type === S.sheet?.type; // a re-render of the same sheet must not slide in again
  ivStatic = same; host.innerHTML = sheetHtml(); ivStatic = false;
  if (sameSheet) host.firstElementChild?.classList.add("static");
  document.body.style.overflow = S.sheet ? "hidden" : "";
  if (S.sheet?.type === "item") ivMount(same, top);
  if (keep) { const el = document.getElementById(keep.id); if (el) { el.value = keep.v; el.focus({ preventScroll: true }); try { el.setSelectionRange(keep.a, keep.b) } catch {} } }
  setThemeColor(); syncHistory();
}
function openSheet(s) { S.sheet = s; confirmDel = null; renderSheet() }
function refresh() { render(); renderSheet() }
function watchFeed() {
  if (!("IntersectionObserver" in window)) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { const id = e.target.dataset.seen; if (!S.seen.has(id)) { S.seen.add(id); api.upd("items", id, { last_surfaced_at: now() }).catch(() => {}) } } }), { threshold: .6 });
  document.querySelectorAll("[data-seen]").forEach(el => io.observe(el));
}

/* ---------- saving and processing ---------- */
async function saveThing(body) {
  S.busy = true; renderSheet();
  const r = await api.fn("capture", { via: "app", ...body });
  S.busy = false;
  if (!r || r.error) { toast(r?.error === "daily_limit" ? "That's 100 saves today. More tomorrow." : "Couldn't save: " + (r?.message || r?.error || "no connection")); renderSheet(); return }
  await api.refreshItem(r.item_id);
  S.sheet = null; S.tab = "now"; refresh();
  toast(`${r.message || "Saved."}${r.duplicate ? "" : " Reading it now…"}`);
  poll();
}
let pollT = null;
function poll() {
  clearTimeout(pollT);
  const waiting = S.items.filter(busy);
  if (!waiting.length || S.screen !== "app") return;
  pollT = setTimeout(async () => {
    if (!document.hidden) {
      let changed = false;
      for (const it of waiting.slice(0, 6)) { const before = it.stage, eb = it.enrich_state; const n = await api.refreshItem(it.id); if (!n || n.stage !== before || n.enrich_state !== eb) changed = true; if (n && n.stage === "ready" && before !== "ready") toast("Ready: " + (n.title || "").slice(0, 40)) }
      if (changed) { refresh(); api.loadCredits().then(refresh).catch(() => {}) }
    }
    poll();
  }, 4000);
}
function fileToJpeg(file) {
  return new Promise((res, rej) => { const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); res(c.toDataURL("image/jpeg", .8).split(",")[1]) };
    img.onerror = rej; img.src = u });
}

/* ---------- actions ---------- */
const H = {
  tab(id) { S.tab = id; S.sheet = null; S.folder = ""; refresh(); scrollTo(0, 0) },
  save(id) { openSheet({ type: "save", lane: ["now", "next"].includes(id) ? id : "library", full: !!S.profile.full_read }); setTimeout(() => $("#sv")?.focus(), 50) },
  savelane(k) { const s = S.sheet; s.val = $("#sv").value; s.note = $("#sn").value; s.folder = $("#sf").value; s.lane = k; renderSheet() },
  savefull() { const s = S.sheet; s.val = $("#sv").value; s.note = $("#sn").value; s.folder = $("#sf").value; s.full = !s.full; renderSheet() },
  close() {
    const iv = $(".iv");
    if (iv && !iv.classList.contains("out") && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const was = S.sheet; iv.classList.add("out"); setTimeout(() => { if (S.sheet === was) { S.sheet = null; refresh() } }, 190); return }
    S.sheet = null; refresh() },
  backdrop(id, e) { if (e.target.classList.contains("overlay") || e.target.classList.contains("iv")) H.close() },
  ivmenu() { S.sheet.menu = !S.sheet.menu; renderSheet(); if (S.sheet.menu) $(".iv-menu [role=menuitem]")?.focus({ preventScroll: true }) },
  menuclose() {},
  ivnote() { S.sheet.noteOpen = true; renderSheet(); $("#note")?.focus() },
  ivfolder(id) { openSheet({ type: "move", id, back: { type: "item", id } }) },
  ivtag(id) { S.q = id; S.fid = ""; S.lib = "all"; H.tab("library") },
  showfolder(id) { S.fid = id; S.lib = "folders"; S.q = ""; S.shelfTab = "all"; H.tab("library") },
  folders() { openSheet({ type: "folders" }); },
  fedit(id) { openSheet({ type: "folder", id, back: S.sheet?.type === "folders" ? { type: "folders" } : null }) },
  fback() { S.sheet = S.sheet?.back || null; refresh() },
  async fadd() { const el = $("#fnew"), n = el?.value.trim(); if (!n) return el?.focus();
    const f = await api.addFolder(n); if (!f) return; refresh(); toast(`Added ${fLabel(f)}`); $("#fnew")?.focus() },
  async fsave(id) {
    const f = S.folders.find(x => x.id === id), v = k => $("#" + k).value.replace(/\s+/g, " ").trim(); if (!f) return;
    const patch = { emoji: v("fe") || "📁", name: v("fn").slice(0, 40), todo_label: v("ft") || "To do", done_label: v("fd") || "Done", about: v("fa").slice(0, 200) };
    if (!patch.name) return toast("Give it a name");
    if (S.folders.some(x => x.id !== id && x.name.toLowerCase() === patch.name.toLowerCase())) return toast("You already have a folder with that name");
    const old = f.name; S.busy = true; renderSheet();
    const { error } = await sb.from("folders").update(patch).eq("id", id); S.busy = false;
    if (error) { console.error(error); toast("Couldn't save the folder"); return renderSheet() }
    Object.assign(f, patch);
    const ints = S.profile.interests || []; if (old !== f.name && ints.includes(old)) api.profile({ interests: ints.map(x => x === old ? f.name : x) });
    H.fback(); toast("Saved") },
  async fdel(id) {
    const s = S.sheet; if (!s.del) { s.del = true; return renderSheet() }
    const f = S.folders.find(x => x.id === id); if (!f) return H.fback();
    const { error } = await sb.from("folders").delete().eq("id", id);
    if (error) { console.error(error); return toast("Couldn't delete the folder") }
    S.folders = S.folders.filter(x => x.id !== id); S.items.forEach(i => { if (i.folder_id === id) i.folder_id = null });
    if (S.fid === id) S.fid = "";
    S.sheet = s.back || null; refresh(); toast(`Deleted ${f.name}`) },
  async moveto(fid) {
    const s = S.sheet, it = item(s.id); if (!it) return;
    const f = fById(fid), was = it.folder_id; if (!f || (was || "none") === fid) return H.fback();
    try { await api.upd("items", it.id, { folder_id: fid === "none" ? null : fid, area_locked: true }) } catch { return }
    S.sheet = s.back || null; refresh();
    toast(`Moved to ${fLabel(f)}`, async () => { await api.upd("items", it.id, { folder_id: was }).catch(() => {}); refresh() }) },
  async movenew() { const n = $("#mnew")?.value.trim(); if (!n) return $("#mnew")?.focus(); const f = await api.addFolder(n); if (f) H.moveto(f.id) },
  reload() { location.reload() },
  undo() { const u = toast.undo; $("#toast").innerHTML = ""; toast.undo = null; if (u) u() },
  dosave() { const v = $("#sv").value.trim(); if (v) saveThing({ text: v, note: $("#sn").value.trim(), folder: $("#sf").value, lane: S.sheet.lane || "library", full: !!S.sheet.full && !fullBlocked() }) },
  async open(id) {
    const it = item(id); if (!it) return;
    openSheet({ type: "item", id });
    if (it.stage === "ready") {
      api.upd("items", id, { opened_count: (it.opened_count || 0) + 1, last_surfaced_at: now() }).catch(() => {});
      if (!S.related[id]) { const { data } = await sb.rpc("related_items", { p_item: id, p_count: 5 }); S.related[id] = (data || []).filter(r => r.similarity >= .5).map(r => item(r.item_id)).filter(Boolean).slice(0, 3); if (S.sheet?.id === id && S.related[id].length) renderSheet() }
    }
  },
  /* ---- Now, Up next and the library ---- */
  async toNow(id, plan) {
    const it = item(id); // a whole save gets its default plan recorded; a single action is its own plan
    if (it) plan = plan || (!it.plan_action_id || actOf(it.plan_action_id)?.lane ? planOf(it)?.id : null);
    const back = S.sheet, r = await api.move(id, "now", it && plan ? { plan_action_id: plan } : {});
    if (r === "now_full") { openSheet({ type: "swap", id, plan, back }); return false }
    if (r === "already_plan") { toast("That's already in Now, as the plan of its save"); return false }
    if (r !== "ok") return false;
    refresh(); toast(`⚡ In Now · slot ${entry(id)?.slot}`); return true;
  },
  async toNext(id, front) {
    const first = nextItems().find(i => i.id !== id), r = await api.move(id, "next", front && first ? { next_pos: first.next_pos - 1 } : {});
    if (r === "next_full") { toast("Up next holds five. Pull one into Now or send one back first."); return false }
    if (r !== "ok") return false;
    refresh(); return true;
  },
  async tolib(id) { const a = !!actOf(id); if (await api.move(id, null, a ? {} : { status: "kept" }) === "ok") { refresh(); toast(a ? "Back with its save" : "Back in its folder") } },
  pull(id) { return H.toNow(id) },
  async tonext(id) { if (await H.toNext(id)) toast("⏭ In Up next") },
  async park(id) {
    const first = nextItems()[0];
    const a = !!actOf(id);
    let r = await api.move(id, "next", first ? { next_pos: first.next_pos - 1 } : {}), where = "first in Up next";
    if (r === "next_full") { r = await api.move(id, null, a ? {} : { status: "kept" }); where = a ? "back with its save" : "back in its folder" }
    if (r !== "ok") return;
    refresh(); toast(`Parked: ${where}`, async () => { if (await api.move(id, "now") === "ok") refresh(); else toast("Its slot is taken now") });
  },
  nudge() {}, // the handle's click; dragging and arrow keys do the work
  // A new order for Now or Up next (ids of saves and actions). Shown straight away, then saved.
  async reorder(lane, ids) {
    if (lane === "folders") {
      ids.forEach((id, k) => { const f = S.folders.find(x => x.id === id); if (f) f.pos = k + 1 }); S.folders.sort((a, b) => a.pos - b.pos); refresh();
      const { error } = await sb.rpc("reorder_folders", { p_ids: ids });
      if (error) { console.error(error); toast("Couldn't save the order"); try { await api.load() } catch {} refresh() }
      return;
    }
    ids.forEach((id, k) => { const x = entry(id); if (x) { if (lane === "now") x.slot = k + 1; else x.next_pos = k + 1 } });
    render();
    const { error } = await sb.rpc("reorder_lane", { p_lane: lane, p_ids: ids });
    if (error) { console.error(error); toast("Couldn't save the order"); try { await api.load() } catch {} render() }
  },
  async nextup(id) { const l = nextItems(), k = l.findIndex(i => i.id === id); if (k < 1) return;
    await api.upd(actOf(id) ? "actions" : "items", id, { next_pos: k === 1 ? l[0].next_pos - 1 : (l[k - 2].next_pos + l[k - 1].next_pos) / 2 }); render() },
  async ivlane(v) { const [id, k] = v.split("|"), it = item(id); if (!it || (it.lane || "") === k && it.status !== "let_go") return;
    if (k === "now") return H.toNow(id);
    if (k === "next") { if (await H.toNext(id)) toast("⏭ In Up next"); return }
    if (it.status === "let_go") { await api.lane(id, null, { status: "kept", let_go_at: null }); refresh(); return toast("Back in its folder") }
    H.tolib(id) },
  // The plan is what finishing the whole save means. Choosing it doesn't move anything.
  async plan(aid) { const a = actOf(aid), it = a && item(a.item_id); if (!it) return;
    if (a.lane) return toast("It has its own place in Now or Up next already");
    if (await api.lane(it.id, it.lane || null, { plan_action_id: aid }) === "ok") { refresh(); toast("📌 That's the plan for this save") } },
  pick(id) { openSheet({ type: "pick", lane: id === "next" ? "next" : "now", q: "" }); setTimeout(() => $("#pq")?.focus(), 50) },
  async pickit(id) {
    if (S.sheet?.lane === "next") { if (await H.toNext(id)) { S.sheet = null; refresh(); toast("⏭ In Up next") } return }
    if (await H.toNow(id)) { S.sheet = null; refresh() } },
  async swapout(oldId) {
    const s = S.sheet, first = nextItems()[0];
    let r = await api.move(oldId, "next", first ? { next_pos: first.next_pos - 1 } : {});
    if (r === "next_full") r = await api.move(oldId, null, actOf(oldId) ? {} : { status: "kept" });
    if (r !== "ok") return;
    const r2 = await api.move(s.id, "now", item(s.id) && s.plan ? { plan_action_id: s.plan } : {});
    S.sheet = ["item", "triage"].includes(s.back?.type) ? s.back : null; refresh();
    if (r2 === "ok") toast(`⚡ Swapped in · slot ${entry(s.id)?.slot}`); else if (r2 === "already_plan") toast("That's already in Now, as the plan of its save") },
  async swapnext() { const s = S.sheet; if (await H.toNext(s.id, true)) { S.sheet = ["item", "triage"].includes(s.back?.type) ? s.back : null; refresh(); toast("⏭ First in Up next") } },
  async tlane(v) { const [id, k] = v.split("|");
    if (k === "now") { if (await H.toNow(id)) { S.sheet = { type: "triage" }; refresh() } }
    else if (k === "next") { if (await H.toNext(id)) { S.sheet = { type: "triage" }; refresh() } }
    else if (k === "lib") H.keep(id); else H.letgo(id) },
  /* ---- finishing ---- */
  finish(id) { openSheet({ type: "finish", id, back: S.sheet, rating: null }) },
  rate(k) { const s = S.sheet; s.text = $("#rf").value; s.rating = s.rating === k ? null : k; renderSheet() },
  tog(k) { const s = S.sheet; s.text = $("#rf")?.value ?? s.text; s[k] = !s[k]; renderSheet() },
  async dofinish(id) {
    if (actOf(id)) return H.finishAct(id);
    const it = item(id), s = S.sheet, text = $("#rf").value.trim(), inNow = it.lane === "now", before = banked().length, pl = planOf(it);
    S.busy = true; s.text = text; renderSheet();
    const r = await api.lane(id, null, { done_at: now(), done_count: (it.done_count || 0) + 1, rating: s.rating || null, done_note: text || it.done_note || "", status: "kept" });
    S.busy = false;
    if (r !== "ok") return renderSheet();
    if (pl && S.actions.find(x => x.id === pl.id)?.status !== "done") await api.upd("actions", pl.id, { status: "done", done_at: now() }).catch(() => {});
    let extra = "";
    if (s.wis && text && await api.saveWisdom(text, it.title)) extra = " · saved to Wisdom";
    await api.loadFocus();
    if (inNow) { const got = banked().length > before ? banked()[0].minutes : 0; render(); openSheet({ type: "earned", got, back: s.back }) }
    else { S.sheet = s.back?.type === "item" ? s.back : null; refresh(); toast(`✓ ${doneVerb(it)}${extra}`) }
  },
  // Finishing a single action. When it was the last open one of its save, offer to mark the save done too.
  async finishAct(id) {
    const a = actOf(id), s = S.sheet, text = $("#rf").value.trim(), inNow = a.lane === "now", before = banked().length, it = item(a.item_id);
    S.busy = true; s.text = text; renderSheet();
    const r = await api.move(id, null, { status: "done", done_at: now(), reflection: text || a.reflection || "" });
    S.busy = false;
    if (r !== "ok") return renderSheet();
    let extra = "";
    if (s.wis && text && await api.saveWisdom(text, a.title)) extra = " · saved to Wisdom";
    await api.loadFocus();
    const last = it && !it.done_at && !itemActs(it.id).some(x => x.status !== "done") ? it.id : null;
    if (inNow || last) { const got = inNow && banked().length > before ? banked()[0].minutes : 0; render(); openSheet({ type: "earned", got, save: last, back: s.back }) }
    else { S.sheet = s.back?.type === "item" ? s.back : null; refresh(); toast("✓ Done" + extra) }
  },
  togate() { openSheet(S.sheet.back) },
  /* ---- passes and the gate ---- */
  async usepass(mode) {
    const app = S.sheet?.app || "", { data, error } = await sb.rpc("use_pass", { p_mode: mode, p_app: app });
    if (error) return toast(/no_pass/.test(error.message) ? "No pass banked. Finish something in Now first." : /now_not_empty/.test(error.message) ? "Hunting is for when Now is clear." : "Couldn't start it");
    await api.loadFocus(); S.sheet = null; refresh();
    toast(mode === "slip" ? "Logged as a slip. Go easy on yourself." : mode === "hunt" ? `🔎 ${data.minutes} minutes. Find what's next.` : `⏱ ${data.minutes} minutes. Enjoy them.`);
    H.gogo(app, data.minutes);
  },
  gogo(app, mins) {
    app = typeof app === "string" ? app : S.sheet?.app || "";
    const links = { instagram: "instagram://", youtube: "youtube://", x: "twitter://", twitter: "twitter://", reddit: "reddit://", tiktok: "https://www.tiktok.com/", facebook: "fb://" }, url = links[app];
    if (S.sheet?.type === "gate") { S.sheet = null; refresh() }
    if (!url) return;
    const ap = activePass(), left = typeof mins === "number" ? mins : ap ? minsLeft(ap) : 0;
    location.href = passTimer() && left ? `shortcuts://run-shortcut?name=${encodeURIComponent("GSD Pass")}&input=text&text=${encodeURIComponent(left + " " + url)}` : url;
  },
  async endpass() { await sb.rpc("end_pass"); await api.loadFocus(); render(); toast("Pass ended. Back to it.") },
  passtimer() { const on = !passTimer(); try { localStorage.setItem("gsd_passtimer", on ? "1" : "0") } catch {} render(); if (on) toast("Make the GSD Pass shortcut once: You → Set up the iPhone") },
  rules() { openSheet({ type: "rules" }) },
  /* ---- library ---- */
  triage() { openSheet({ type: "triage" }) },
  async keep(id) { await api.upd("items", id, { status: "kept", let_go_at: null }); refresh() },
  async letgo(id) { const prev = item(id).status, lane = item(id).lane; await api.lane(id, null, { status: "let_go", let_go_at: now() }); if (S.sheet?.type === "item") S.sheet = null; refresh();
    toast("Let go", async () => { await api.lane(id, null, { status: prev, let_go_at: null }); if (lane) await api.lane(id, lane); refresh() }) },
  review() { openSheet({ type: "review" }) },
  reveal() { S.sheet.show = true; renderSheet() },
  async rc(v) { const [id, r] = v.split("|"), c = S.cards.find(x => x.id === id), st = c.step || 0;
    const patch = r === "got" ? (st >= LADDER.length - 1 ? { active: false, due: null } : { step: st + 1, due: addDays(LADDER[st + 1]) })
      : r === "almost" ? { due: addDays(Math.max(1, Math.round(LADDER[st] / 2))) } : { step: 0, due: addDays(1) };
    await api.upd("recall_cards", id, { ...patch, last_result: r, reviewed_at: now() }); S.sheet = { type: "review" }; refresh() },
  async remember(id) { const it = item(id), on = !it.remember; await api.upd("items", id, { remember: on });
    for (const c of S.cards.filter(x => x.item_id === id)) await api.upd("recall_cards", c.id, on ? { active: true, step: 0, due: addDays(1) } : { active: false, due: null });
    toast(on ? "It'll come back tomorrow, then less and less often" : "Stopped"); renderSheet() },
  async reprocess(id, how) { const it = item(id), full = how === "full"; it.stage = "queued"; if (full) it.deep_read = true; S.sheet && (S.sheet.menu = false); refresh(); const r = await api.fn("reprocess", { item_id: id, full }); if (r?.error) toast("Couldn't start: " + (r.message || r.error)); else if (full) toast("Reading it fully…"); poll() },
  readfull(id) { if (fullBlocked()) return toast(`Only ${crWord(crLeft())} left, kept for quick reads`); H.reprocess(id, "full") },
  async delete(id) { if (confirmDel !== id) { confirmDel = id; renderSheet(); return } await api.del("items", id); S.actions.forEach(a => { if (a.item_id === id) a.item_id = null }); S.sheet = null; await api.loadFocus(); refresh(); toast("Deleted") },
  ask() { S.ask = S.ask || {}; openSheet({ type: "ask" }); setTimeout(() => $("#aq")?.focus(), 50) },
  askq(id) { $("#aq").value = id; doAsk() },
  lib(id) { S.lib = id; S.fid = ""; S.folder = ""; render() },
  grp(id) { S.fid = id; S.lib = "folders"; S.shelfTab = "todo"; S.folder = ""; render(); scrollTo({ top: 0, behavior: "smooth" }) },
  shtab(id) { S.shelfTab = id; render() },
  gfopen(id) { gfSet(S.folder === id ? "" : id) },
  mode(id) { S.mode = id; render() }, more() { S.more = true; render() },
  dismiss(id) { openSheet({ type: "dismiss", id, back: S.sheet }) },
  async dismissed(v) { const [id, why] = v.split("|"); const back = S.sheet?.back;
    if (why === "did") await api.upd("actions", id, { status: "done", done_at: now() }); else await api.upd("actions", id, { status: "dismissed", reflection: why === "big" ? "dismissed: too big" : "dismissed: not interested" });
    S.sheet = back?.type === "item" ? back : null; refresh() },
  ownact(id) { openSheet({ type: "ownact", item: id || "" }); setTimeout(() => $("#oa")?.focus(), 50) },
  async addown(id) { const t = $("#oa").value.trim(), it = item(id); if (!t || !it) return;
    const a = await api.ins("actions", { item_id: id, title: t.slice(0, 160), mode: $("#om").value, status: "suggested", origin: "user", minutes: S.profile.daily_minutes || 15 });
    await api.lane(id, it.lane || null, { plan_action_id: a.id }); S.sheet = { type: "item", id }; refresh(); toast("📌 That's the plan") },
  /* ---- you ---- */
  async interest(id) { const cur = S.profile.interests || []; await api.profile({ interests: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id], onboarded_at: S.profile.onboarded_at || now() }); render() },
  async commit() { const on = S.profile.commitment === "none"; await api.profile({ commitment: on ? "action_first" : "none" }); render(); toast(on ? "Gate on. It works once the iPhone automation is set up." : "Gate off") },
  async watch() { await api.profile({ watch_video: S.profile.watch_video === false }); render() },
  async fullread() { await api.profile({ full_read: !S.profile.full_read }); render(); if (S.profile.full_read) toast("Every save now gets a full read: about 5–12 credits a reel") },
  async autorem() { await api.profile({ auto_remember: !S.profile.auto_remember }); render() },
  async capsetup() { S.newToken = ""; const { data } = await sb.from("capture_tokens").select("id,name,created_at,last_used_at").is("revoked_at", null).order("created_at", { ascending: false }); S.tokens = data || []; openSheet({ type: "capsetup" }) },
  async newtoken() {
    const raw = crypto.getRandomValues(new Uint8Array(32)), tok = "gsd_cap_" + btoa(String.fromCharCode(...raw)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tok)), hex = [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
    const { data, error } = await sb.from("capture_tokens").insert({ token_hash: hex }).select("id,name,created_at,last_used_at").single();
    if (error) return toast("Couldn't create a token"); S.tokens.unshift(data); S.newToken = tok; renderSheet();
  },
  async revoke(id) { await sb.from("capture_tokens").update({ revoked_at: now() }).eq("id", id); S.tokens = S.tokens.filter(t => t.id !== id); renderSheet(); toast("Revoked") },
  async copy(v) { try { await navigator.clipboard.writeText(v); toast("Copied") } catch { toast("Select and copy it by hand") } },
  theme(v) { if (v === "flip") v = document.documentElement.dataset.theme === "dark" ? "light" : "dark"; try { localStorage.setItem("gsd_theme", v) } catch {} applyTheme(); render() },
  authmode() { S.authMode = S.authMode === "up" ? "in" : "up"; S.authMsg = ""; render() },
  async signout() { await sb.auth.signOut(); S.screen = "auth"; S.sheet = null; refresh() },
};
async function doAsk() {
  const q = $("#aq").value.trim(); if (!q) return;
  S.ask = { q, busy: true }; renderSheet();
  const r = await api.fn("ask", { question: q });
  S.ask = { q, ...(r?.error ? { error: r.error === "ai_not_configured" ? ERR.ai_not_configured : (r.message || "Something went wrong.") } : r) }; if (S.sheet?.type === "ask") renderSheet();
}
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  if (S.sheet?.menu && el.dataset.act !== "ivmenu") { S.sheet.menu = false; setTimeout(() => { if (S.sheet?.type === "item") renderSheet() }) } // any tap closes the ⋯ menu
  const fn = H[el.dataset.act]; if (fn) Promise.resolve(fn(el.dataset.id, e)).catch(err => console.error(err));
});
/* ---------- drag to reorder Now and Up next ----------
   Pointer events, so it works with a mouse and with a finger. The handle has touch-action:none, so dragging it never scrolls the page.
   While dragging, the others slide over to show where it will land. */
let drag = null;
document.addEventListener("pointerdown", e => {
  const g = e.target.closest(".grip"); if (!g || e.button > 0) return;
  const el = g.closest("[data-sid]"), box = el?.parentElement; if (!box?.dataset.sort) return;
  const items = [...box.querySelectorAll(":scope > [data-sid]")]; if (items.length < 2) return;
  e.preventDefault();
  items.forEach(x => { x.style.animation = "none" });
  drag = { el, box, items, rects: items.map(x => x.getBoundingClientRect()), from: items.indexOf(el), to: items.indexOf(el), x0: e.clientX, y0: e.clientY, pid: e.pointerId, moved: false };
  try { g.setPointerCapture(e.pointerId) } catch {}
  el.classList.add("dragging"); box.classList.add("sorting");
});
document.addEventListener("pointermove", e => {
  if (!drag || e.pointerId !== drag.pid) return;
  const { el, items, rects, from } = drag, dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
  if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
  el.style.transform = `translate(${dx}px,${dy}px) scale(1.025)`;
  const r = rects[from], cx = r.left + r.width / 2 + dx, cy = r.top + r.height / 2 + dy;
  let to = from, best = Infinity;
  rects.forEach((q, k) => { const d = Math.hypot(q.left + q.width / 2 - cx, q.top + q.height / 2 - cy); if (d < best) { best = d; to = k } });
  drag.to = to;
  items.forEach((x, k) => { if (x === el) return;
    const t = from < to && k > from && k <= to ? k - 1 : from > to && k >= to && k < from ? k + 1 : k, q = rects[t], p = rects[k];
    x.style.transform = t === k ? "" : `translate(${q.left - p.left}px,${q.top - p.top}px)` });
});
function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.pid)) return;
  const { el, box, items, from, to } = drag; drag = null;
  items.forEach(x => { x.style.transform = "" }); el.classList.remove("dragging"); box.classList.remove("sorting");
  if (to === from) return;
  const ids = items.map(x => x.dataset.sid), [m] = ids.splice(from, 1); ids.splice(to, 0, m);
  H.reorder(box.dataset.sort, ids);
}
document.addEventListener("pointerup", endDrag);
document.addEventListener("pointercancel", endDrag);
document.addEventListener("keydown", e => {
  const g = e.target.closest?.(".grip"), d = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key]; if (!g || !d) return;
  const box = g.closest("[data-sort]"), id = g.closest("[data-sid]")?.dataset.sid; if (!box || !id) return;
  const ids = [...box.querySelectorAll(":scope > [data-sid]")].map(x => x.dataset.sid), k = ids.indexOf(id), j = k + d;
  e.preventDefault(); if (j < 0 || j >= ids.length) return;
  ids.splice(k, 1); ids.splice(j, 0, id);
  H.reorder(box.dataset.sort, ids).then(() => document.querySelector(`[data-sid="${id}"] .grip`)?.focus());
});
document.addEventListener("submit", async e => {
  e.preventDefault(); const f = e.target.dataset.form;
  if (f === "ask") return doAsk();
  if (f === "steer") { const id = e.target.dataset.id; S.busy = true; const steer = $("#steer").value.trim(); renderSheet();
    const r = await api.fn("suggest", { item_id: id, steer }); S.busy = false;
    if (r?.actions) S.actions = [...r.actions, ...S.actions]; else toast(r?.error === "ai_not_configured" ? "The AI key isn't set up yet." : "Couldn't get new ideas");
    return refresh() }
  if (f === "auth") { const email = $("#em").value.trim(), password = $("#pw").value; S.busy = true; S.authMsg = ""; render(); $("#em").value = email;
    const r = S.authMode === "up" ? await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } }) : await sb.auth.signInWithPassword({ email, password });
    S.busy = false;
    if (r.error) { S.authMsg = /invite-only|Database error/i.test(r.error.message) ? "GSD is invite-only for now." : r.error.message; S.authOk = false; render(); $("#em").value = email; return }
    if (!r.data.session) { S.authMsg = "Check your email to confirm your address, then sign in here."; S.authOk = true; S.authMode = "in"; render(); return }
    S.user = r.data.user; start() }
});
document.addEventListener("input", e => {
  if (e.target.id === "q") { S.q = e.target.value; $("#libgrid").innerHTML = libList(); gfMount() }
  if (e.target.id === "pq" && S.sheet?.type === "pick") { S.sheet.q = e.target.value; $("#picklist").innerHTML = pickList() }
});
document.addEventListener("change", async e => {
  const t = e.target;
  if (t.id === "img" && t.files[0]) { try { const b64 = await fileToJpeg(t.files[0]); saveThing({ image_base64: b64, note: $("#sn")?.value.trim() || "", folder: $("#sf")?.value || "", lane: S.sheet?.lane || "library" }) } catch { toast("Couldn't read that image") } }
  if (t.dataset.save) { const k = t.dataset.save, num = ["daily_minutes", "weekly_goal", "pass_minutes", "pass_cap"].includes(k);
    api.profile({ [k]: num ? Number(t.value) : t.value.trim(), onboarded_at: S.profile.onboarded_at || now() }).then(() => { toast("Saved"); if (num) render() }) }
  if (t.dataset.note) api.upd("items", t.dataset.note, { note: t.value.trim() }).then(() => toast("Note saved")).catch(() => {});
});
document.addEventListener("keydown", e => { if (e.key === "Enter" && !e.isComposing && ["fnew", "mnew"].includes(e.target.id)) { e.preventDefault(); e.target.id === "fnew" ? H.fadd() : H.movenew() } });
document.addEventListener("keydown", e => { if (e.key !== "Escape" || !S.sheet) return; if (S.sheet.menu) { S.sheet.menu = false; renderSheet(); $(".iv-tools .iv-ic")?.focus() } else H.close() });
// Coming back to the app after a while: reload quietly, so saves from the share sheet and passes spent at the gate show up.
let hiddenAt = 0;
document.addEventListener("visibilitychange", async () => {
  if (document.hidden) { hiddenAt = Date.now(); return }
  if (S.screen !== "app") return;
  if (hiddenAt && Date.now() - hiddenAt > 30000 && (!S.sheet || ["item", "gate", "earned", "rules"].includes(S.sheet.type))) { try { await api.load(); refresh() } catch {} }
  poll();
});

/* ---------- boot ---------- */
const params = new URLSearchParams(location.search);
const incoming = { save: [params.get("url"), params.get("text"), params.get("save")].filter(Boolean).join(" ") || (params.get("title") && !params.get("url") ? params.get("title") : ""), gate: params.get("gate") };
try { if (location.search || history.state?.gsdSheet) history.replaceState(null, "", location.pathname) } catch {} // a reload with a sheet open leaves its history entry behind
async function start() {
  try { await api.load() } catch (e) { S.screen = "error"; S.error = e.message || String(e); return render() }
  api.loadCredits().then(() => S.screen === "app" && refresh()).catch(() => {});
  if (!S.profile) { S.screen = "error"; S.error = "Your profile wasn't created. Sign out and try again."; return render() }
  S.screen = "app"; S.tab = !S.profile.onboarded_at && !S.items.length ? "profile" : "now";
  let seen = true; try { seen = localStorage.getItem("gsd_rules") === "1"; localStorage.setItem("gsd_rules", "1") } catch {}
  if (incoming.gate) S.sheet = { type: "gate", app: incoming.gate.toLowerCase() };
  else if (!seen) S.sheet = { type: "rules" };
  refresh(); poll();
  if (incoming.save) { const v = incoming.save; incoming.save = ""; saveThing({ text: v, via: "share_target" }) }
}
// The pass countdown on Now; when a pass runs out, the page catches up.
let hadPass = false;
setInterval(() => { if (S.screen !== "app") return; const ap = activePass(); document.querySelectorAll("[data-left]").forEach(el => { el.textContent = ap ? minsLeft(ap) : 0 }); if (hadPass && !ap) { render(); if (S.sheet?.type === "gate") renderSheet() } hadPass = !!ap }, 15000);
async function boot() {
  if (!window.supabase) { $("#app").innerHTML = `<div class="center"><div class="auth"><h2>Couldn't load</h2><p class="mute" style="margin-top:8px">Check your connection and reload.</p></div></div>`; return }
  sb = window.supabase.createClient(CFG.url, CFG.key);
  const { data } = await sb.auth.getSession();
  if (data.session) { S.user = data.session.user; return start() }
  S.screen = "auth"; render();
}
boot();
