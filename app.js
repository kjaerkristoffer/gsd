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
const KIND = { video: "🎬", article: "📚", place: "📍", recipe: "🍽️", book: "📖", quote: "💬", idea: "💡", tool: "🛠️", workout: "🏃", product: "🛍️", event: "🎟️", music: "🎵", note: "📝", other: "✨" };
const MODE = { learn: ["📚", "Learn"], create: ["🎨", "Create"], build: ["🛠️", "Build"], grow: ["🌱", "Grow"], experience: ["📍", "Experience"] };
const LADDER = [1, 3, 7, 14, 30, 60, 120];
const ITEM_COLS = "id,url,canonical_url,source,kind,title,author,thumb_path,start_seconds,summary,insight,takeaways,quotes,entities,area,tags,note,status,stage,error_code,quality,resaved_count,remember,last_surfaced_at,opened_count,created_at,diag";
const ERR = {
  private_or_missing: "This post is private or was removed. GSD can only read public links.",
  unreadable: "GSD couldn't read this page. You can still add your own note.",
  unsupported_type: "This kind of file isn't supported yet.",
  provider_down: "Reading it took too long. Tap Re-read to try again.",
  ai_error: "Something went wrong understanding this. Tap Re-read.",
  no_content: "The reader couldn't get anything from this post. It may be private, or the reader service refused it. Tap Re-read to try again.",
  reader_not_configured: "The transcript key isn't working (Supabase → Edge Functions → Secrets → SUPADATA_API_KEY). Then tap Re-read.",
  reader_limit: "The transcript service has run out of credits for now. Top up at supadata.ai, then tap Re-read.",
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
  $("#themecolor")?.setAttribute("content", dark ? "#000000" : "#ffffff");
  return dark;
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { applyTheme(); if (S.screen === "app") render() });

/* ---------- state ---------- */
const S = { screen: "boot", user: null, profile: null, items: [], actions: [], cards: [], challenges: [], focus: null, tokens: [],
  tab: "home", sheet: null, q: "", area: "", lib: "all", actTab: "doing", mode: "inspire", seen: new Set(), swapped: [], ask: null,
  authMode: "in", authMsg: "", busy: false, related: {}, more: false, newToken: "" };
let sb = null, confirmDel = null;

/* ---------- data ---------- */
const must = r => { if (r.error) throw r.error; return r.data };
const api = {
  async load() {
    const [p, i, a, c, ch, f] = await Promise.all([
      sb.from("profiles").select("*").eq("user_id", S.user.id).maybeSingle(),
      sb.from("items").select(ITEM_COLS).order("created_at", { ascending: false }).limit(1000),
      sb.from("actions").select("*").order("created_at", { ascending: false }).limit(3000),
      sb.from("recall_cards").select("id,item_id,q,a,active,step,due").limit(5000),
      sb.from("challenges").select("*").eq("active", true).order("created_at", { ascending: false }),
      sb.from("daily_focus").select("*").eq("day", iso()).maybeSingle(),
    ]);
    S.profile = must(p); S.items = must(i); S.actions = must(a); S.cards = must(c); S.challenges = must(ch); S.focus = must(f);
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
  async setFocus(patch) {
    S.focus = { user_id: S.user.id, day: iso(), action_id: null, state: "offered", swaps: 0, ...(S.focus || {}), ...patch };
    const { error } = await sb.from("daily_focus").upsert(S.focus, { onConflict: "user_id,day" });
    if (error) console.error(error);
  },
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
};

/* ---------- derived ---------- */
const item = id => S.items.find(i => i.id === id);
const pending = i => !["ready", "failed"].includes(i.stage);
const live = () => S.items.filter(i => i.status !== "let_go");
const inbox = () => S.items.filter(i => i.status === "inbox" && !pending(i));
const doneActs = () => S.actions.filter(a => a.status === "done");
const openActs = () => S.actions.filter(a => (a.status === "suggested" || a.status === "doing") && (!a.item_id || (item(a.item_id) && item(a.item_id).status !== "let_go")));
const dueCards = () => S.cards.filter(c => c.active && c.due && c.due <= iso() && item(c.item_id) && item(c.item_id).status !== "let_go").sort((a, b) => a.due < b.due ? -1 : 1).slice(0, 5);
const thumbUrl = it => it.thumb_path ? `${CFG.url}/storage/v1/object/public/thumbs/${it.thumb_path}` : "";
function ratio() { const kept = S.items.filter(i => i.status === "kept"); if (!kept.length) return 0; const used = new Set(doneActs().map(a => a.item_id)); return Math.round(100 * kept.filter(i => used.has(i.id)).length / kept.length) }
function periodStart(p) { const d = new Date(); d.setHours(0, 0, 0, 0); if (p === "month") d.setDate(1); else d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d }
const chProgress = c => doneActs().filter(a => new Date(a.done_at) >= periodStart(c.period) && (!c.mode || a.mode === c.mode)).length;

function score(a) {
  const it = item(a.item_id), p = S.profile, mins = p.daily_minutes || 15, dow = new Date().getDay(), weekend = dow === 0 || dow === 6;
  let s = 0;
  if (a.status === "doing") s += 40;
  if (a.planned_for === iso()) s += 25;
  if (a.minutes <= mins) s += 20; else if (a.minutes > 2 * mins) s -= 15;
  if (it) {
    if ((p.interests || []).includes(it.area)) s += 15;
    const age = (Date.now() - new Date(it.created_at)) / 864e5;
    if (age <= 7) s += 12;
    if (age > 30 && !S.actions.some(x => x.item_id === it.id && x.status === "done")) s += 8;
    if (it.resaved_count > 0) s += 8;
    if (it.note) s += 10;
  }
  if (S.challenges.some(c => c.mode === a.mode && chProgress(c) < c.target)) s += 10;
  if (weekend && (a.mode === "experience" || a.context === "out")) s += 15;
  if (!weekend && a.effort === "tiny") s += 5;
  return s + hash(S.user.id + iso() + a.id);
}
const rank = exclude => openActs().filter(a => !exclude.includes(a.id)).sort((x, y) => score(y) - score(x));
function focusAction() {
  const f = S.focus;
  if (f && f.state === "skipped") return null;
  if (f && f.action_id) { const a = S.actions.find(x => x.id === f.action_id); if (a && a.status !== "dismissed") return a }
  return rank([])[0] || null;
}

/* ---------- pieces ---------- */
const thumb = (it, cls = "thumb") => `<div class="${cls}">${KIND[it.kind] || "✨"}${thumbUrl(it) ? `<img src="${esc(thumbUrl(it))}" alt="" loading="lazy" onerror="this.remove()">` : ""}</div>`;
const tile = it => `<button class="tile" data-act="open" data-id="${it.id}">${thumb(it)}<div class="tx"><div class="t">${pending(it) ? '<span class="spin"></span> Reading…' : esc(it.title || it.url || "Untitled")}</div><div class="tiny">${esc(it.source || "")} · ${ago(it.created_at)}</div></div></button>`;
function actRow(a, extra = "") {
  const it = item(a.item_id), m = MODE[a.mode] || MODE.grow;
  return `<div class="card"><div class="act"><div class="em" aria-hidden="true">${m[0]}</div><div class="bd">
    <h3>${esc(a.title)}</h3><div class="small mute">${a.minutes} min · ${m[1]}${it ? ` · from “${esc((it.title || "").slice(0, 40))}”` : ""}</div>
    ${a.why && a.status !== "done" ? `<p class="small" style="margin-top:8px">${esc(a.why)}</p>` : ""}
    ${a.status !== "done" && a.first_step ? `<p class="small" style="margin-top:8px"><b>Start:</b> ${esc(a.first_step)}</p>` : ""}
    ${a.status === "doing" && a.steps?.length ? `<ul class="tk small">${a.steps.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
    ${a.status === "done" ? `<div class="tiny" style="margin-top:6px">Done ${ago(a.done_at)}</div>${a.reflection ? `<blockquote class="small">${esc(a.reflection)}</blockquote>` : ""}` : ""}
    <div class="row" style="margin-top:12px">${extra || (a.status === "suggested" ? `<button class="btn sm" data-act="start" data-id="${a.id}">Do this</button><button class="btn sm ghost" data-act="dismiss" data-id="${a.id}">Not for me</button>`
      : a.status === "doing" ? `<button class="btn sm keep" data-act="done" data-id="${a.id}">✅ GSD</button><button class="btn sm ghost" data-act="later" data-id="${a.id}">Later</button>` : "")}
      ${it ? `<button class="btn sm line" data-act="open" data-id="${it.id}">Source</button>` : ""}</div>
  </div></div></div>`;
}
function gauge(pct) {
  const len = Math.PI * 100, off = len * (1 - pct / 100);
  return `<div class="gauge" role="img" aria-label="${pct} percent of the saves you kept have been acted on"><svg viewBox="0 0 240 132"><defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#0284c7"/></linearGradient></defs>
  <path d="M20 122 A100 100 0 0 1 220 122" fill="none" stroke="var(--soft)" stroke-width="18" stroke-linecap="round"/>
  ${pct > 0 ? `<path d="M20 122 A100 100 0 0 1 220 122" fill="none" stroke="url(#gg)" stroke-width="18" stroke-linecap="round" stroke-dasharray="${len}" stroke-dashoffset="${off}"/>` : ""}</svg>
  <div class="n"><b>${pct}<span style="font-size:22px">%</span></b><small>GSD RATIO</small></div></div>`;
}

/* ---------- views ---------- */
function vHome() {
  const f = focusAction(), ib = inbox(), du = dueCards(), dn = doneActs(), p = S.profile;
  const doneToday = dn.some(a => iso(new Date(a.done_at)) === iso());
  const h = new Date().getHours(), hi = h < 5 ? "Still up" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const recent = live().slice(0, 6), skipped = S.focus?.state === "skipped", swaps = S.focus?.swaps || 0;
  return `<h1>${hi}. Actually <em>do</em><br>the stuff you save.</h1>
  <div class="sec">${gauge(ratio())}<p class="small mute" style="text-align:center;margin-top:6px">${dn.length} done · ${S.items.filter(i => i.status === "kept").length} kept</p></div>
  ${p.intention ? `<div class="sec"><span class="chip ${doneToday ? "g" : ""}">${doneToday ? "✅" : "🎯"} ${esc(p.intention)}${doneToday ? " — done today" : ""}</span></div>` : ""}
  <div class="sec"><div class="hd"><h2>Today's focus</h2>${f && f.status !== "done" ? (swaps < 3 ? `<button class="small mute" data-act="swap">Swap</button>` : `<span class="tiny">That's all I have today</span>`) : ""}</div>
    ${f ? (f.status === "done" ? `<div class="card soft"><h3>✅ ${esc(f.title)}</h3><p class="small mute" style="margin-top:4px">Done. That's today's thing.</p></div>`
        : actRow(f, f.status === "doing" ? "" : `<button class="btn sm" data-act="start" data-id="${f.id}">Do this</button><button class="btn sm ghost" data-act="nottoday">Not today</button>`))
      : `<div class="card soft"><p class="mute">${skipped ? "Nothing planned today. That's fine." : "Save something and a small thing to try will show up here."}</p></div>`}</div>
  ${ib.length || du.length ? `<div class="sec"><div class="row">
    ${ib.length ? `<button class="btn ghost" data-act="triage">🗂️ Sort ${ib.length} new save${ib.length > 1 ? "s" : ""}</button>` : ""}
    ${du.length ? `<button class="btn ghost" data-act="review">🧠 Revisit ${du.length} idea${du.length > 1 ? "s" : ""}</button>` : ""}</div></div>` : ""}
  <div class="sec"><button class="field mute" style="text-align:left" data-act="ask">🔎 Ask your library anything…</button></div>
  <div class="sec"><div class="hd"><h2>Recently saved</h2><button class="small mute" data-act="tab" data-id="library">All</button></div>
    ${recent.length ? `<div class="grid">${recent.map(tile).join("")}</div>` : `<div class="card soft"><p class="mute">Nothing saved yet. Tap + and paste a link from Instagram, YouTube, TikTok or anywhere.</p></div>`}</div>`;
}
function libList() {
  const q = S.q.toLowerCase().trim();
  let l = S.lib === "inbox" ? S.items.filter(i => i.status === "inbox") : S.lib === "let_go" ? S.items.filter(i => i.status === "let_go") : live();
  if (S.area) l = l.filter(i => i.area === S.area);
  if (q) l = l.filter(i => [i.title, i.summary, i.note, i.source, i.area, ...(i.tags || []), ...(i.takeaways || []).map(t => t.text)].join(" ").toLowerCase().includes(q));
  return l.length ? `<div class="grid">${l.map(tile).join("")}</div>` : `<p class="mute" style="padding:30px 0;text-align:center">${q ? "Nothing matches. Try Ask for questions in your own words." : "Nothing here."}</p>`;
}
function vLibrary() {
  const areas = [...new Set(live().map(i => i.area))].sort();
  return `<h1>Library</h1>
  <div class="sec"><input class="field" id="q" type="search" placeholder="Search your saves" value="${esc(S.q)}" aria-label="Search your saves"></div>
  <div class="scroll" style="margin-top:12px">${[["all", "All"], ["inbox", "Unsorted"], ["let_go", "Let go"]].map(([k, n]) => `<button class="chip ${S.lib === k && !S.area ? "on" : ""}" data-act="lib" data-id="${k}">${n}</button>`).join("")}
    ${areas.map(t => `<button class="chip ${S.area === t ? "on" : ""}" data-act="area" data-id="${esc(t)}">${esc(t)}</button>`).join("")}</div>
  <div class="sec" id="libgrid">${libList()}</div>`;
}
function feed() {
  const ready = live().filter(i => i.stage === "ready");
  if (S.mode === "learn") return ready.filter(i => S.cards.some(c => c.item_id === i.id)).slice(0, 10);
  if (S.mode === "experience") return ready.filter(i => ["place", "recipe", "event", "workout", "product"].includes(i.kind) || S.actions.some(a => a.item_id === i.id && a.mode === "experience" && a.status !== "done")).slice(0, 10);
  const forgotten = [...ready].sort((a, b) => (a.opened_count - b.opened_count) || (new Date(a.last_surfaced_at || 0) - new Date(b.last_surfaced_at || 0)));
  const recent = ready.filter(i => Date.now() - new Date(i.created_at) < 7 * 864e5).slice(0, 2);
  const wild = [...ready].sort((a, b) => hash(iso() + a.id) - hash(iso() + b.id)).slice(0, 1);
  const out = []; for (const i of [...forgotten.slice(0, 4), ...recent, ...wild, ...forgotten.slice(4)]) if (!out.includes(i)) out.push(i);
  return out.slice(0, S.more ? 15 : 10);
}
function vExplore() {
  const modes = [["inspire", "✨ Inspiration"], ["do", "⚡ Action"], ["learn", "🧠 Learning"], ["experience", "📍 Experience"]];
  let body;
  if (S.mode === "do") { const o = rank([]).slice(0, 8); body = o.length ? `<div class="stack">${o.map(a => actRow(a)).join("")}</div>` : `<p class="mute">No open ideas right now.</p>` }
  else {
    const l = feed();
    body = l.length ? `<div class="feed">${l.map(it => {
      const c = S.cards.find(x => x.item_id === it.id), pl = it.entities?.place;
      return `<article class="fcard" data-seen="${it.id}">${thumb(it)}<div class="in">
        <div class="tiny">${KIND[it.kind] || ""} ${esc(it.source || "")} · saved ${ago(it.created_at)}${it.opened_count ? "" : " · not opened since"}</div>
        ${S.mode === "learn" && c ? `<p class="ins" style="margin-top:8px">${esc(c.q)}</p><details style="margin-top:10px"><summary class="small mute">Show answer</summary><p style="margin-top:8px">${esc(c.a)}</p></details>`
          : `<p class="ins" style="margin-top:8px">${esc(it.insight || it.summary || it.title)}</p>`}
        <p class="small mute" style="margin-top:10px">${esc(it.title)}</p>
        <div class="row" style="margin-top:14px"><button class="btn sm" data-act="makeact" data-id="${it.id}">⚡ Do something with it</button><button class="btn sm ghost" data-act="open" data-id="${it.id}">Open</button>
        ${S.mode === "experience" && pl?.name ? `<a class="btn sm line" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([pl.name, pl.address, pl.city].filter(Boolean).join(" "))}">Maps</a>` : ""}</div>
      </div></article>`}).join("")}
      <div class="card soft" style="text-align:center"><h3>That's enough for now.</h3><p class="small mute" style="margin-top:4px">This feed ends on purpose. Pick one thing and go do it.</p>
      ${S.mode === "inspire" && !S.more && live().length > 10 ? `<button class="btn sm ghost" style="margin-top:10px" data-act="more">Five more</button>` : ""}</div></div>`
      : `<p class="mute">Nothing to show in this mode yet.</p>`;
  }
  return `<h1>Explore <em>your own</em> saves</h1><div class="scroll sec">${modes.map(([k, n]) => `<button class="chip ${S.mode === k ? "on" : ""}" data-act="mode" data-id="${k}">${n}</button>`).join("")}</div><div class="sec">${body}</div>`;
}
function vActions() {
  const doing = S.actions.filter(a => a.status === "doing"), ideas = rank([]).filter(a => a.status === "suggested"), dn = doneActs().sort((a, b) => new Date(b.done_at) - new Date(a.done_at));
  const list = S.actTab === "doing" ? doing : S.actTab === "ideas" ? ideas.slice(0, 30) : dn;
  return `<h1>Actions</h1>
  <div class="sec"><div class="hd"><h2>Challenges</h2><button class="small mute" data-act="newch">+ New</button></div>
    ${S.challenges.length ? `<div class="stack">${S.challenges.map(c => { const p = chProgress(c); return `<div class="card"><div class="row" style="justify-content:space-between"><h3>${esc(c.title)}</h3><button class="tiny" data-act="delch" data-id="${c.id}" aria-label="Remove challenge">✕</button></div>
      <div class="bar" style="margin:10px 0 6px"><i style="width:${Math.min(100, 100 * p / c.target)}%"></i></div><div class="tiny">${Math.min(p, c.target)} of ${c.target} this ${c.period}${p >= c.target ? " · done 🎉" : ""}</div></div>` }).join("")}</div>`
      : `<p class="small mute">Optional. A light goal like “three creative experiments this week”.</p>`}</div>
  <div class="scroll sec">${[["doing", `Doing (${doing.length})`], ["ideas", `Ideas (${ideas.length})`], ["done", `Done (${dn.length})`]].map(([k, n]) => `<button class="chip ${S.actTab === k ? "on" : ""}" data-act="acttab" data-id="${k}">${n}</button>`).join("")}
    <button class="chip" data-act="ownact">+ Your own</button></div>
  <div class="sec stack">${list.length ? list.map(a => actRow(a)).join("") : `<p class="mute">${S.actTab === "doing" ? "Nothing in progress. Pick an idea when you feel like it." : S.actTab === "ideas" ? "Ideas appear when you save things." : "Things you've done will collect here."}</p>`}</div>`;
}
function vProfile() {
  const p = S.profile, dn = doneActs(), by = m => dn.filter(a => a.mode === m).length, l = live(), rev = l.filter(i => i.opened_count > 0).length;
  return `<h1>You</h1>
  ${p.onboarded_at ? "" : `<div class="banner sec">Welcome. Pick what you care about and write a line about your goals; every suggestion GSD makes is fitted to this.</div>`}
  <div class="sec"><div class="hd"><h2>What you've actually done</h2></div><div class="grid">
    <div class="stat"><b>${by("grow")}</b><span class="small mute">ideas applied</span></div>
    <div class="stat"><b>${by("experience")}</b><span class="small mute">experiences tried</span></div>
    <div class="stat"><b>${by("create") + by("build")}</b><span class="small mute">things made</span></div>
    <div class="stat"><b>${by("learn")}</b><span class="small mute">things learned</span></div>
    <div class="stat"><b>${l.length ? Math.round(100 * rev / l.length) : 0}%</b><span class="small mute">of saves revisited</span></div>
    <div class="stat"><b>${S.items.filter(i => i.status === "let_go").length}</b><span class="small mute">let go</span></div></div></div>
  <div class="sec"><div class="hd"><h2>What you care about</h2></div>
    <div class="chips">${(p.areas || []).map(a => `<button class="chip ${p.interests?.includes(a) ? "on" : ""}" data-act="interest" data-id="${esc(a)}">${esc(a)}</button>`).join("")}</div>
    <label class="l" for="goals">The life you're building, in a sentence or two</label>
    <textarea class="field" id="goals" data-save="goals" placeholder="e.g. Build small AI apps, draw more, try one new place a month">${esc(p.goals)}</textarea>
    <label class="l" for="mins">Time you usually have for one thing</label>
    <select class="field" id="mins" data-save="daily_minutes">${[5, 10, 15, 30, 45, 60].map(m => `<option value="${m}" ${p.daily_minutes == m ? "selected" : ""}>${m} minutes</option>`).join("")}</select>
    <label class="l" for="city">Your city (for places)</label>
    <input class="field" id="city" data-save="city" value="${esc(p.city)}" placeholder="e.g. Copenhagen"></div>
  <div class="sec"><div class="hd"><h2>Intentional scrolling</h2></div>
    <label class="l" for="intention" style="margin-top:0">Your intention (optional)</label>
    <input class="field" id="intention" data-save="intention" placeholder="e.g. One small action before I scroll" value="${esc(p.intention)}">
    <div class="row" style="margin-top:12px"><button class="chip ${p.commitment === "action_first" ? "on" : ""}" data-act="commit">${p.commitment === "action_first" ? "✓ " : ""}Pause before social apps (gate)</button>
    <button class="chip ${p.auto_remember ? "on" : ""}" data-act="autorem">${p.auto_remember ? "✓ " : ""}Help me remember what I learn, automatically</button></div>
    <p class="tiny" style="margin-top:8px">Never enforced, never counted against you.</p></div>
  <div class="sec"><div class="hd"><h2>Appearance</h2></div>
    <div class="chips">${[["auto", "Match my device"], ["light", "☀️ Light"], ["dark", "🌙 Dark"]].map(([k, n]) => `<button class="chip ${themePref() === k ? "on" : ""}" data-act="theme" data-id="${k}">${n}</button>`).join("")}</div></div>
  <div class="sec"><div class="hd"><h2>Save from anywhere</h2></div>
    <div class="row"><button class="btn ghost" data-act="capsetup">📱 Set up iPhone share sheet</button></div>
    <p class="small mute" style="margin-top:10px"><b>Computer:</b> add a bookmark with this address, then click it on any page:</p>
    <code class="small" style="word-break:break-all;display:block;margin-top:6px">javascript:location.href='${esc(location.origin + location.pathname)}?url='+encodeURIComponent(location.href)</code></div>
  <div class="sec row"><span class="small mute">${esc(S.user?.email || "")}</span><button class="btn sm ghost" data-act="signout">Sign out</button></div>`;
}

/* ---------- sheets ---------- */
function sheetHtml() {
  const s = S.sheet; if (!s) return "";
  let b = "";
  if (s.type === "save") b = `<h2>Save <em>anything</em></h2><p class="small mute" style="margin-top:4px">Paste a link, or write a note, quote or idea.</p>
    <label class="l" for="sv">Link or text</label><textarea class="field" id="sv" placeholder="https://www.instagram.com/reel/…">${esc(s.val || "")}</textarea>
    <label class="l" for="sn">Why are you saving it? (optional)</label><input class="field" id="sn" placeholder="e.g. try this at the weekend">
    <div class="row" style="margin-top:16px"><button class="btn" data-act="dosave" ${S.busy ? "disabled" : ""}>Save</button>
    <label class="btn ghost" style="cursor:pointer">🖼️ Add image<input type="file" id="img" accept="image/*" hidden></label><button class="btn ghost" data-act="close">Cancel</button></div>`;
  if (s.type === "item") b = itemSheet(item(s.id));
  if (s.type === "triage") { const it = inbox()[0];
    b = it ? `<div class="tiny">${inbox().length} to sort</div>${thumb(it, "thumb hero")}<h2>${esc(it.title)}</h2><p class="mute" style="margin-top:8px">${esc(it.insight || it.summary || "")}</p>
      <div class="row" style="margin-top:18px"><button class="btn keep" style="flex:1" data-act="keep" data-id="${it.id}">💚 Keep</button><button class="btn drop" style="flex:1" data-act="letgo" data-id="${it.id}">🗑️ Let go</button></div>
      <p class="tiny" style="margin-top:10px;text-align:center">Letting go is good. A smaller library gets used.</p>`
      : `<h2>All sorted.</h2><p class="mute" style="margin-top:6px">Your library only holds things you chose to keep.</p><button class="btn" style="margin-top:16px" data-act="close">Done</button>` }
  if (s.type === "review") { const c = dueCards()[0];
    if (!c) b = `<h2>Nothing left to revisit.</h2><button class="btn" style="margin-top:16px" data-act="close">Done</button>`;
    else b = `<div class="tiny">${dueCards().length} to revisit · ${esc(item(c.item_id)?.title || "")}</div><h2 style="margin-top:10px">${esc(c.q)}</h2>
      ${s.show ? `<div class="card soft" style="margin-top:14px">${esc(c.a)}</div>
        <div class="row" style="margin-top:16px"><button class="btn keep" style="flex:1" data-act="rc" data-id="${c.id}|got">Got it</button><button class="btn ghost" style="flex:1" data-act="rc" data-id="${c.id}|almost">Almost</button><button class="btn ghost" style="flex:1" data-act="rc" data-id="${c.id}|forgot">Forgot</button></div>`
        : `<button class="btn" style="margin-top:16px" data-act="reveal">Show answer</button>`}` }
  if (s.type === "done") { const a = S.actions.find(x => x.id === s.id);
    b = `<h2>Nice. <em>GSD.</em></h2><p class="mute" style="margin-top:4px">${esc(a.title)}</p><label class="l" for="rf">How did it go? (optional)</label><textarea class="field" id="rf" placeholder="One line is plenty"></textarea>
    <label class="row small" style="margin-top:12px"><input type="checkbox" id="again"> Would do again</label>
    <div class="row" style="margin-top:16px"><button class="btn" data-act="finish" data-id="${a.id}">Mark as done</button></div>` }
  if (s.type === "dismiss") b = `<h2>Not for you?</h2><p class="small mute" style="margin-top:4px">Optional: tell GSD why, so suggestions get better.</p>
    <div class="chips" style="margin-top:14px">${[["big", "Too big"], ["no", "Not interested"], ["did", "Did it already"]].map(([k, n]) => `<button class="chip" data-act="dismissed" data-id="${s.id}|${k}">${n}</button>`).join("")}</div>`;
  if (s.type === "ask") b = `<h2>Ask your library</h2><form data-form="ask" style="margin-top:12px"><input class="field" id="aq" placeholder="What could I try this weekend?" value="${esc(S.ask?.q || "")}" aria-label="Your question">
    <div class="scroll" style="margin-top:10px">${["Give me three things I could try this weekend", "What themes keep coming up in my saves?", "Which saved ideas could improve my daily routine?"].map(x => `<button type="button" class="chip" data-act="askq" data-id="${esc(x)}">${x}</button>`).join("")}</div>
    <button class="btn" style="margin-top:14px" ${S.ask?.busy ? "disabled" : ""}>${S.ask?.busy ? '<span class="spin"></span> Thinking' : "Ask"}</button></form>
    ${S.ask?.answer ? `<div class="card soft" style="margin-top:16px;white-space:pre-wrap">${esc(S.ask.answer)}</div>${S.ask.sources?.length ? `<div class="stack" style="margin-top:12px;gap:8px">${S.ask.sources.map(x => `<button class="chip" style="white-space:normal;text-align:left" data-act="open" data-id="${x.item_id}">[${x.n}] ${esc(x.title)}</button>`).join("")}</div>` : ""}` : ""}
    ${S.ask?.error ? `<p class="small" style="color:var(--red);margin-top:12px">${esc(S.ask.error)}</p>` : ""}`;
  if (s.type === "newch") b = `<h2>New challenge</h2><p class="small mute">Flexible and yours. Missing it costs nothing.</p>
    <div class="chips" style="margin-top:12px">${[["Three creative experiments this week", 3, "week", "create"], ["One new experience every week", 1, "week", "experience"], ["Apply one idea a week", 1, "week", "grow"], ["Build one small thing this month", 1, "month", "build"], ["Learn four new things this month", 4, "month", "learn"]].map(c => `<button class="chip" style="white-space:normal;text-align:left" data-act="addch" data-id="${esc(JSON.stringify(c))}">${c[0]}</button>`).join("")}</div>`;
  if (s.type === "ownact") b = `<h2>Your own action</h2><label class="l" for="oa">What will you do?</label><input class="field" id="oa" placeholder="Start with a verb">
    <label class="l" for="om">Kind</label><select class="field" id="om">${Object.entries(MODE).map(([k, v]) => `<option value="${k}">${v[0]} ${v[1]}</option>`).join("")}</select>
    <button class="btn" style="margin-top:16px" data-act="addown" data-id="${s.item || ""}">Add</button>`;
  if (s.type === "gate") { const f = focusAction(), doneToday = doneActs().some(a => iso(new Date(a.done_at)) === iso());
    b = `<div class="tiny">A pause before ${esc(s.app || "scrolling")}</div><h2 style="margin-top:6px">${esc(S.profile.intention || "One small thing first?")}</h2>
    ${doneToday ? `<p class="mute" style="margin-top:10px">You've done your thing today. Enjoy.</p>` : f ? `<div style="margin-top:14px">${actRow(f, " ")}</div>` : `<p class="mute" style="margin-top:10px">Nothing planned today.</p>`}
    <div class="stack" style="margin-top:16px;gap:10px">${!doneToday && f ? `<button class="btn" data-act="gate" data-id="do_now">Do it now (${f.minutes} min)</button><button class="btn keep" data-act="gate" data-id="did_it">Did it already</button>` : ""}
    <button class="btn ghost" data-act="gate" data-id="skipped">${doneToday ? "Continue" : "Not now, continue"}</button></div>` }
  if (s.type === "capsetup") { const fnUrl = CFG.url + "/functions/v1/gsd/capture";
    b = `<h2>Save from the iPhone share sheet</h2><p class="small mute" style="margin-top:4px">A one-time Apple Shortcut lets you share a reel or video straight to GSD without opening it.</p>
    ${S.newToken ? `<div class="card soft" style="margin-top:14px"><div class="tiny">Your capture token (shown once)</div><code style="word-break:break-all;display:block;margin:6px 0">${esc(S.newToken)}</code><button class="btn sm" data-act="copy" data-id="${esc(S.newToken)}">Copy token</button></div>`
      : `<button class="btn" style="margin-top:14px" data-act="newtoken">Create a capture token</button>`}
    <ol class="small" style="padding-left:20px;margin:16px 0 0;line-height:1.7">
      <li>Open the <b>Shortcuts</b> app → + → name it <b>Save to GSD</b>.</li>
      <li>Tap ⓘ → turn on <b>Show in Share Sheet</b>. Accept URLs and Text.</li>
      <li>Add action <b>Get Contents of URL</b>. URL:<br><code style="word-break:break-all">${esc(fnUrl)}</code> <button class="chip" data-act="copy" data-id="${esc(fnUrl)}">Copy</button></li>
      <li>Method <b>POST</b>. Header <code>Authorization</code> = <code>Bearer </code> + your token.</li>
      <li>Request Body <b>JSON</b>: <code>text</code> = Shortcut Input, <code>via</code> = <code>shortcut</code>.</li>
      <li>Add <b>Show Notification</b>: “Saved to GSD”.</li></ol>
    ${S.tokens.length ? `<div class="sec"><h3>Tokens</h3><div class="stack" style="margin-top:8px;gap:8px">${S.tokens.map(t => `<div class="row small" style="justify-content:space-between"><span>${esc(t.name)} · created ${ago(t.created_at)}${t.last_used_at ? " · used " + ago(t.last_used_at) : ""}</span><button class="chip" data-act="revoke" data-id="${t.id}">Revoke</button></div>`).join("")}</div></div>` : ""}` }
  return `<div class="overlay" data-act="backdrop"><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div><button class="x" data-act="close" aria-label="Close">✕</button>${b}</div></div>`;
}
function itemSheet(it) {
  if (!it) return "<p>This save is gone.</p>";
  const acts = S.actions.filter(a => a.item_id === it.id && a.status !== "dismissed"), e = it.entities || {}, u = safeUrl(it.url), rel = S.related[it.id];
  if (pending(it)) return `${thumb(it, "thumb hero")}<h2><span class="spin"></span> Reading it…</h2><p class="mute" style="margin-top:6px;word-break:break-all">${esc(it.url || it.title || "")}</p><p class="small mute" style="margin-top:10px">Usually 10–60 seconds; long videos take a little longer. You can close this.</p>`;
  const t = s => { const m = Math.floor(s / 60), x = String(s % 60).padStart(2, "0"); return `${m}:${x}` };
  return `${thumb(it, "thumb hero")}
    <div class="tiny">${KIND[it.kind] || ""} ${esc(it.kind)} · ${esc(it.source || "")}${it.author ? " · " + esc(it.author) : ""} · saved ${ago(it.created_at)}${it.resaved_count ? ` · saved ${it.resaved_count + 1} times` : ""}</div>
    <h2 style="margin-top:6px">${esc(it.title || "Untitled")}</h2>
    <div class="chips" style="margin-top:10px"><span class="chip b">${esc(it.area)}</span>${(it.tags || []).map(x => `<span class="chip">${esc(x)}</span>`).join("")}</div>
    ${it.stage === "failed" ? `<div class="banner" style="margin-top:14px;background:var(--red-bg);color:var(--red)">${esc(ERR[it.error_code] || "Something went wrong reading this.")}${it.diag ? `<br><span class="tiny" style="color:inherit;opacity:.8">Details: ${esc(it.diag)}</span>` : ""}</div>`
      : it.quality === "caption_only" ? `<p class="tiny" style="margin-top:10px">Read from the caption only.</p>` : it.quality === "title_only" ? `<p class="tiny" style="margin-top:10px">Only the title was readable.</p>` : ""}
    ${it.summary ? `<p style="margin-top:14px">${esc(it.summary)}</p>` : ""}
    ${it.takeaways?.length ? `<ul class="tk">${it.takeaways.map(k => `<li>${esc(k.text)}${k.t != null && it.source === "youtube" && u ? ` <a class="chip" style="padding:2px 8px" target="_blank" rel="noopener noreferrer" href="${esc(u + (u.includes("?") ? "&" : "?") + "t=" + k.t + "s")}">${t(k.t)}</a>` : ""}</li>`).join("")}</ul>` : ""}
    ${(it.quotes || []).map(q => `<blockquote>${esc(q)}</blockquote>`).join("")}
    ${e.place?.name ? `<div class="card soft" style="margin-top:14px"><h3>📍 ${esc(e.place.name)}</h3><p class="small mute">${esc([e.place.category, e.place.address, e.place.city].filter(Boolean).join(" · "))}</p><a class="btn sm line" style="margin-top:10px" target="_blank" rel="noopener noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([e.place.name, e.place.address, e.place.city].filter(Boolean).join(" "))}">Open in Maps</a></div>` : ""}
    ${e.recipe?.ingredients?.length ? `<div class="card soft" style="margin-top:14px"><div class="row" style="justify-content:space-between"><h3>🍽️ Ingredients</h3><button class="chip" data-act="copy" data-id="${esc(e.recipe.ingredients.join("\n"))}">Copy list</button></div><ul class="tk small">${e.recipe.ingredients.map(x => `<li>${esc(x)}</li>`).join("")}</ul>${e.recipe.steps?.length ? `<h3 style="margin-top:12px">Steps</h3><ol class="small" style="padding-left:20px;margin:6px 0 0">${e.recipe.steps.map(x => `<li style="margin:4px 0">${esc(x)}</li>`).join("")}</ol>` : ""}</div>` : ""}
    ${e.book?.title ? `<div class="card soft" style="margin-top:14px"><h3>📖 ${esc(e.book.title)}</h3><p class="small mute">${esc(e.book.author || "")}</p></div>` : ""}
    ${e.tool?.name ? `<div class="card soft" style="margin-top:14px"><h3>🛠️ ${esc(e.tool.name)}</h3><p class="small mute">${esc(e.tool.what_for || "")}</p>${safeUrl(e.tool.url) ? `<a class="btn sm line" style="margin-top:10px" target="_blank" rel="noopener noreferrer" href="${esc(safeUrl(e.tool.url))}">Open</a>` : ""}</div>` : ""}
    ${e.workout?.exercises?.length ? `<div class="card soft" style="margin-top:14px"><h3>🏃 Workout</h3><ul class="tk small">${e.workout.exercises.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
    ${e.event?.name ? `<div class="card soft" style="margin-top:14px"><h3>🎟️ ${esc(e.event.name)}</h3><p class="small mute">${esc([e.event.date, e.event.place].filter(Boolean).join(" · "))}</p></div>` : ""}
    <div class="sec"><div class="hd"><h2>Do something with it</h2><button class="small mute" data-act="ownact" data-id="${it.id}">+ Your own</button></div>
      <div class="stack">${acts.length ? acts.map(a => actRow(a)).join("") : `<p class="small mute">No actions yet.</p>`}</div>
      ${it.stage === "ready" ? `<form data-form="steer" data-id="${it.id}" class="row" style="margin-top:12px"><input class="field" id="steer" style="flex:1;min-width:160px" placeholder="Different ideas… (optional: “outdoors”, “shorter”)" aria-label="Steer new ideas"><button class="btn sm ghost" ${S.busy ? "disabled" : ""}>${S.busy ? '<span class="spin"></span>' : "Different ideas"}</button></form>` : ""}</div>
    ${rel?.length ? `<div class="sec"><div class="hd"><h2>Related saves</h2></div><div class="grid">${rel.map(tile).join("")}</div></div>` : ""}
    <div class="sec"><label class="l" for="note" style="margin-top:0">Your note</label><textarea class="field" id="note" data-note="${it.id}" placeholder="Why it matters to you">${esc(it.note || "")}</textarea></div>
    <div class="sec row">
      ${u ? `<a class="btn sm line" href="${esc(u)}" target="_blank" rel="noopener noreferrer">Open original ↗</a>` : ""}
      ${S.cards.some(c => c.item_id === it.id) ? `<button class="btn sm ${it.remember ? "" : "ghost"}" data-act="remember" data-id="${it.id}">🧠 ${it.remember ? "Remembering" : "Help me remember"}</button>` : ""}
      ${it.status !== "kept" ? `<button class="btn sm keep" data-act="keep" data-id="${it.id}">💚 Keep</button>` : ""}
      ${it.status !== "let_go" ? `<button class="btn sm drop" data-act="letgo" data-id="${it.id}">Let go</button>` : ""}
      <button class="btn sm ghost" data-act="reprocess" data-id="${it.id}">Re-read</button>
      <button class="btn sm ghost" data-act="delete" data-id="${it.id}">${confirmDel === it.id ? "Tap again to delete forever" : "Delete"}</button></div>`;
}

/* ---------- render ---------- */
const TABS = [["home", "🏠", "Home"], ["library", "🗂️", "Library"], ["explore", "✨", "Explore"], ["actions", "⚡", "Actions"], ["profile", "🙂", "You"]];
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
  const view = { home: vHome, library: vLibrary, explore: vExplore, actions: vActions, profile: vProfile }[S.tab]();
  app.innerHTML = `<div class="shell"><aside class="side"><div class="logo"><i></i>GSD</div>
    ${TABS.map(([k, e, n]) => `<button class="nav ${S.tab === k ? "on" : ""}" data-act="tab" data-id="${k}"><span aria-hidden="true">${e}</span>${n}</button>`).join("")}
    <button class="btn" data-act="save">+ Save something</button></aside>
    <main><div class="top"><div class="logo"><i></i>GSD</div><button class="chip" data-act="theme" data-id="flip" aria-label="Switch between light and dark mode" style="margin-left:auto">${document.documentElement.dataset.theme === "dark" ? "☀️ Light" : "🌙 Dark"}</button></div>${view}</main>
    <nav class="tabs" aria-label="Main">${TABS.slice(0, 2).map(tabBtn).join("")}<button class="plus" data-act="save" aria-label="Save something">+</button>${TABS.slice(2).map(tabBtn).join("")}</nav></div>`;
  if (S.tab === "explore") watchFeed();
}
function renderSheet() { $("#sheet").innerHTML = sheetHtml(); document.body.style.overflow = S.sheet ? "hidden" : "" }
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
  S.sheet = null; S.tab = "home"; refresh();
  toast(r.duplicate ? "You saved this before. Moved it to the top." : "Saved. Reading it now…");
  poll();
}
let pollT = null;
function poll() {
  clearTimeout(pollT);
  const waiting = S.items.filter(pending);
  if (!waiting.length || S.screen !== "app") return;
  pollT = setTimeout(async () => {
    if (!document.hidden) {
      let changed = false;
      for (const it of waiting.slice(0, 6)) { const before = it.stage; const n = await api.refreshItem(it.id); if (!n || n.stage !== before) changed = true; if (n && n.stage === "ready" && before !== "ready") toast("Ready: " + (n.title || "").slice(0, 40)) }
      if (changed) refresh();
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
  tab(id) { S.tab = id; S.sheet = null; refresh(); scrollTo(0, 0) },
  save() { openSheet({ type: "save" }); setTimeout(() => $("#sv")?.focus(), 50) },
  close() { S.sheet = null; refresh() },
  backdrop(id, e) { if (e.target.classList.contains("overlay")) H.close() },
  reload() { location.reload() },
  undo() { const u = toast.undo; $("#toast").innerHTML = ""; toast.undo = null; if (u) u() },
  dosave() { const v = $("#sv").value.trim(); if (v) saveThing({ text: v, note: $("#sn").value.trim() }) },
  async open(id) {
    const it = item(id); if (!it) return;
    openSheet({ type: "item", id });
    if (it.stage === "ready") {
      api.upd("items", id, { opened_count: (it.opened_count || 0) + 1, last_surfaced_at: now() }).catch(() => {});
      if (!S.related[id]) { const { data } = await sb.rpc("related_items", { p_item: id, p_count: 5 }); S.related[id] = (data || []).filter(r => r.similarity >= .5).map(r => item(r.item_id)).filter(Boolean).slice(0, 3); if (S.sheet?.id === id && S.related[id].length) renderSheet() }
    }
  },
  async start(id) {
    if (S.actions.filter(a => a.status === "doing").length >= 7) return toast("Seven things in progress is plenty. Finish or park one first.");
    await api.upd("actions", id, { status: "doing", started_at: now() });
    if (focusAction()?.id === id || !S.focus?.action_id) await api.setFocus({ action_id: id, state: "accepted" });
    toast("On your list. Start small."); refresh();
  },
  async later(id) { await api.upd("actions", id, { status: "suggested" }); refresh() },
  dismiss(id) { openSheet({ type: "dismiss", id, back: S.sheet }); },
  async dismissed(v) { const [id, why] = v.split("|"); const back = S.sheet?.back;
    if (why === "did") await api.upd("actions", id, { status: "done", done_at: now() }); else await api.upd("actions", id, { status: "dismissed", reflection: why === "big" ? "dismissed: too big" : "dismissed: not interested" });
    S.sheet = back?.type === "item" ? back : null; refresh() },
  done(id) { openSheet({ type: "done", id, back: S.sheet }) },
  async finish(id) {
    const a = S.actions.find(x => x.id === id), back = S.sheet?.back;
    await api.upd("actions", id, { status: "done", done_at: now(), reflection: $("#rf").value.trim(), again: $("#again").checked || null });
    if (a?.item_id && item(a.item_id)?.status === "inbox") await api.upd("items", a.item_id, { status: "kept" });
    if (S.focus?.action_id === id) await api.setFocus({ state: "done" });
    S.sheet = back?.type === "item" ? back : null; refresh(); toast("✅ GSD");
  },
  async swap() { const f = focusAction(); if (f) S.swapped.push(f.id); const n = rank(S.swapped)[0];
    if (n) { await api.setFocus({ action_id: n.id, state: "offered", swaps: (S.focus?.swaps || 0) + 1 }); render() } else toast("That's the only idea right now") },
  async nottoday() { await api.setFocus({ state: "skipped" }); render() },
  triage() { openSheet({ type: "triage" }) },
  async keep(id) { await api.upd("items", id, { status: "kept", let_go_at: null }); refresh() },
  async letgo(id) { const prev = item(id).status; await api.upd("items", id, { status: "let_go", let_go_at: now() }); if (S.sheet?.type === "item") S.sheet = null; refresh();
    toast("Let go", async () => { await api.upd("items", id, { status: prev, let_go_at: null }); refresh() }) },
  review() { openSheet({ type: "review" }) },
  reveal() { S.sheet.show = true; renderSheet() },
  async rc(v) { const [id, r] = v.split("|"), c = S.cards.find(x => x.id === id), st = c.step || 0;
    const patch = r === "got" ? (st >= LADDER.length - 1 ? { active: false, due: null } : { step: st + 1, due: addDays(LADDER[st + 1]) })
      : r === "almost" ? { due: addDays(Math.max(1, Math.round(LADDER[st] / 2))) } : { step: 0, due: addDays(1) };
    await api.upd("recall_cards", id, { ...patch, last_result: r, reviewed_at: now() }); S.sheet = { type: "review" }; refresh() },
  async remember(id) { const it = item(id), on = !it.remember; await api.upd("items", id, { remember: on });
    for (const c of S.cards.filter(x => x.item_id === id)) await api.upd("recall_cards", c.id, on ? { active: true, step: 0, due: addDays(1) } : { active: false, due: null });
    toast(on ? "It'll come back tomorrow, then less and less often" : "Stopped"); renderSheet() },
  async reprocess(id) { const it = item(id); it.stage = "queued"; refresh(); const r = await api.fn("reprocess", { item_id: id }); if (r?.error) toast("Couldn't start: " + (r.message || r.error)); poll() },
  async delete(id) { if (confirmDel !== id) { confirmDel = id; renderSheet(); return } await api.del("items", id); S.actions.forEach(a => { if (a.item_id === id) a.item_id = null }); S.sheet = null; refresh(); toast("Deleted") },
  ask() { S.ask = S.ask || {}; openSheet({ type: "ask" }); setTimeout(() => $("#aq")?.focus(), 50) },
  askq(id) { $("#aq").value = id; doAsk() },
  lib(id) { S.lib = id; S.area = ""; render() }, area(id) { S.area = S.area === id ? "" : id; S.lib = "all"; render() },
  mode(id) { S.mode = id; render() }, acttab(id) { S.actTab = id; render() }, more() { S.more = true; render() },
  async makeact(id) { const a = S.actions.find(x => x.item_id === id && x.status === "suggested"); if (a) H.start(a.id); else H.open(id) },
  newch() { openSheet({ type: "newch" }) },
  async addch(id) { const [title, target, period, mode] = JSON.parse(id); await api.ins("challenges", { title, target, period, mode }); S.sheet = null; refresh() },
  async delch(id) { await api.del("challenges", id); render() },
  ownact(id) { openSheet({ type: "ownact", item: id || "" }); setTimeout(() => $("#oa")?.focus(), 50) },
  async addown(id) { const t = $("#oa").value.trim(); if (!t) return; await api.ins("actions", { item_id: id || null, title: t, mode: $("#om").value, status: "doing", origin: "user", minutes: S.profile.daily_minutes || 15, started_at: now() }); S.sheet = id ? { type: "item", id } : null; S.actTab = "doing"; refresh() },
  async interest(id) { const cur = S.profile.interests || []; await api.profile({ interests: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id], onboarded_at: S.profile.onboarded_at || now() }); render() },
  async commit() { await api.profile({ commitment: S.profile.commitment === "action_first" ? "none" : "action_first" }); render() },
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
  async gate(choice) {
    const f = focusAction(), app = S.sheet.app;
    sb.from("gate_events").insert({ app: app || "", choice }).then(() => {});
    if (choice === "do_now" && f) { S.sheet = null; await H.start(f.id); S.tab = "actions"; S.actTab = "doing"; return refresh() }
    if (choice === "did_it" && f) return H.done(f.id);
    const links = { instagram: "instagram://", youtube: "youtube://", x: "twitter://", twitter: "twitter://", reddit: "reddit://", tiktok: "https://www.tiktok.com/", facebook: "fb://" };
    S.sheet = null; refresh(); if (links[app]) location.href = links[app];
  },
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
  const fn = H[el.dataset.act]; if (fn) Promise.resolve(fn(el.dataset.id, e)).catch(err => console.error(err));
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
document.addEventListener("input", e => { if (e.target.id === "q") { S.q = e.target.value; $("#libgrid").innerHTML = libList() } });
document.addEventListener("change", async e => {
  const t = e.target;
  if (t.id === "img" && t.files[0]) { try { const b64 = await fileToJpeg(t.files[0]); saveThing({ image_base64: b64, note: $("#sn")?.value.trim() || "" }) } catch { toast("Couldn't read that image") } }
  if (t.dataset.save) api.profile({ [t.dataset.save]: t.dataset.save === "daily_minutes" ? Number(t.value) : t.value.trim(), onboarded_at: S.profile.onboarded_at || now() }).then(() => toast("Saved"));
  if (t.dataset.note) api.upd("items", t.dataset.note, { note: t.value.trim() }).then(() => toast("Note saved")).catch(() => {});
});
document.addEventListener("keydown", e => { if (e.key === "Escape" && S.sheet) H.close() });
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.screen === "app") poll() });

/* ---------- boot ---------- */
const params = new URLSearchParams(location.search);
const incoming = { save: [params.get("url"), params.get("text"), params.get("save")].filter(Boolean).join(" ") || (params.get("title") && !params.get("url") ? params.get("title") : ""), gate: params.get("gate") };
try { if (location.search) history.replaceState(null, "", location.pathname) } catch {}
async function start() {
  try { await api.load() } catch (e) { S.screen = "error"; S.error = e.message || String(e); return render() }
  if (!S.profile) { S.screen = "error"; S.error = "Your profile wasn't created. Sign out and try again."; return render() }
  if (S.focus && S.focus.action_id && !S.actions.some(a => a.id === S.focus.action_id)) S.focus.action_id = null;
  if (!S.focus || (!S.focus.action_id && S.focus.state === "offered")) { const f = rank([])[0]; if (f) await api.setFocus({ action_id: f.id, state: f.status === "doing" ? "accepted" : "offered" }) }
  S.screen = "app"; S.tab = !S.profile.onboarded_at && !S.items.length ? "profile" : "home";
  if (incoming.gate) S.sheet = { type: "gate", app: incoming.gate.toLowerCase() };
  refresh(); poll();
  if (incoming.save) { const v = incoming.save; incoming.save = ""; saveThing({ text: v, via: "share_target" }) }
}
async function boot() {
  if (!window.supabase) { $("#app").innerHTML = `<div class="center"><div class="auth"><h2>Couldn't load</h2><p class="mute" style="margin-top:8px">Check your connection and reload.</p></div></div>`; return }
  sb = window.supabase.createClient(CFG.url, CFG.key);
  const { data } = await sb.auth.getSession();
  if (data.session) { S.user = data.session.user; return start() }
  S.screen = "auth"; render();
}
boot();
