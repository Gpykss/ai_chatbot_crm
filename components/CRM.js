'use client';

import { useEffect, useRef, useState } from 'react';
import {
  creators as defaultCreators, initialFans, scripts as defaultScripts, normalizeScript, incoming,
  langName, langsOf, personaTemplate, workspaces, availableAccounts,
} from '@/lib/data';

const needsReply = (f) => f.msgs[f.msgs.length - 1]?.from === 'fan';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Human-like timing: random pause, typing time scaled to message length, long replies split into bubbles.
const rand = (a, b) => a + Math.random() * (b - a);
const typeMs = (t) => Math.min(7000, Math.max(1300, t.length * rand(38, 58)));
function splitReply(text) {
  const t = (text || '').trim();
  if (t.length < 90) return [t];
  const sents = t.split(/\n+|(?<=[.!?…])\s+(?=\S)/).map((s) => s.trim()).filter(Boolean);
  if (sents.length < 2) return [t];
  const n = Math.min(3, sents.length, Math.ceil(t.length / 90));
  const target = t.length / n; const out = [];
  let cur = '';
  for (const s of sents) {
    if (cur && cur.length + s.length / 2 > target && out.length < n - 1) { out.push(cur); cur = s; }
    else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  return out;
}
const now = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const srcLabel = { script: 'Auto · script', ai: 'Auto · AI', manual: 'You', mass: 'Mass message' };
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const money = (n) => `$${(Number(n) || 0).toLocaleString()}`;
const STORE = 'johnscrm.admin.v2';
const blankPer = () => ({ script: 0, ai: 0, ppvSent: 0, revenue: 0 });
const STEP_LABELS = ['Tease', 'Build', 'Sell', 'Message', 'Follow-up'];

// Smart lists: saved filters over the fans. In the full build the numbers come from OnlyFansAPI.
const LISTS = [
  { id: 'all', name: 'All', test: () => true },
  { id: 'reply', name: 'Needs reply', test: (f) => needsReply(f) },
  { id: 'big', name: 'Big spenders', hint: '$400+ lifetime', test: (f) => f.spend >= 400 },
  { id: 'new', name: 'New subs', hint: 'Joined this month', test: (f) => f.tags.includes('New sub') },
  { id: 'expired', name: 'Expired subs', hint: 'Subscription ran out', test: (f) => f.sub === 'expired' },
  { id: 'quiet', name: 'Quiet 7+ days', hint: 'No message for a week', test: (f) => (f.quietDays || 0) >= 7 },
  { id: 'human', name: 'Needs human', test: (f, d) => !!d.flagged[f.id] },
];

const Icon = ({ d }) => <svg viewBox="0 0 24 24" aria-hidden="true">{d}</svg>;
const icons = {
  inbox: <Icon d={<><path d="M4 13h4l2 3h4l2-3h4" /><path d="M5.5 5h13L21 13v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z" /></>} />,
  analytics: <Icon d={<path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />} />,
  scripts: <Icon d={<><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v4h4M10 12h6M10 16h6" /></>} />,
  creators: <Icon d={<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>} />,
};
icons.demo = <Icon d={<><rect x="6" y="2.5" width="12" height="19" rx="3" /><path d="M10 18.5h4" /></>} />;
icons.models = <Icon d={<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 9h6v6H9zM9 1.5v2.5M15 1.5v2.5M9 20v2.5M15 20v2.5M1.5 9H4M1.5 15H4M20 9h2.5M20 15h2.5" /></>} />;
const navLabel = { inbox: 'Inbox', demo: 'Live demo', analytics: 'Analytics', scripts: 'Scripts', creators: 'Creators', models: 'AI models' };

export default function CRM() {
  const [, setTick] = useState(0);
  const rerender = () => setTick((t) => t + 1);
  const D = useRef(null);
  if (!D.current) {
    D.current = {
      creators: structuredClone(defaultCreators), scripts: structuredClone(defaultScripts).map(normalizeScript),
      fans: structuredClone(initialFans).map((f) => ({ sub: 'active', memory: [], ...f })), autopilot: true, paused: {}, flagged: {}, typing: {}, typingShow: {}, retry: {}, learned: {}, used: {}, story: {},
      inIdx: {}, mockIdx: {}, sStats: {}, vStats: {},
      stats: { script: 0, ai: 0, mass: 0, flags: 0, tokensIn: 0, tokensOut: 0, cost: 0, ppvSent: 0, revenue: 0, sold: 0 },
      per: Object.fromEntries(defaultCreators.map((c) => [c.id, blankPer()])), mock: false, error: '',
    };
  }
  const d = D.current;
  // Fill in anything added in a newer version, so a live code update never crashes an open page.
  d.models ||= { EN: '', IT: '', FI: '', EL: '' };
  for (const k of ['paused', 'flagged', 'typing', 'typingShow', 'retry', 'learned', 'used', 'story', 'inIdx', 'mockIdx', 'sStats', 'vStats']) d[k] ||= {};
  d.fans.forEach((f) => { f.sub ||= 'active'; f.memory ||= []; });
  const cr = (id) => d.creators.find((c) => c.id === id);
  const sStat = (id) => (d.sStats[id] ||= { sent: 0, bought: 0, revenue: 0 });

  const [view, setView] = useState('inbox');
  const [ws, setWs] = useState('all');
  const [crFilter, setCrFilter] = useState('all');
  const [list, setList] = useState('all');
  const [fanId, setFanId] = useState('f1');
  const [pane, setPane] = useState('list');
  const [prof, setProf] = useState(false);
  const [draft, setDraft] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [sheet, setSheet] = useState(null);
  const toastTimer = useRef(null);
  const msgEnd = useRef(null);

  const toast = (t) => { setToastMsg(t); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToastMsg(''), 2200); };
  function save() { try { localStorage.setItem(STORE, JSON.stringify({ creators: d.creators, scripts: d.scripts, models: d.models })); } catch {} }

  // Records a PPV/script send in the stats.
  function recordSend(f, scriptId, price) {
    const p = (d.per[f.creator] ||= blankPer());
    if (scriptId) sStat(scriptId).sent++;
    if (price) { d.stats.ppvSent++; p.ppvSent++; }
  }

  async function autoReply(f, delay = 1200) {
    const c = cr(f.creator);
    if (!c || !d.autopilot || c.autopilot === false || d.paused[f.id] || !needsReply(f) || d.typing[f.id]) return;
    d.typing[f.id] = true; d.typingShow[f.id] = false; rerender();
    const startLen = f.msgs.length;
    const newFanMsg = () => f.msgs.slice(startLen).some((m) => m.from === 'fan');
    const live = () => d.autopilot && !d.paused[f.id] && d.typing[f.id] && !newFanMsg();
    const stop = () => { d.typing[f.id] = false; d.typingShow[f.id] = false; rerender(); };
    // If he sends another message while she's typing, she starts over and answers everything he said.
    const bail = () => { const again = newFanMsg(); stop(); if (again) autoReply(f, 300); };
    try {
      // The request runs while she "reads" the message, so the wait isn't added on top.
      const req = fetch('/api/reply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fan: { id: f.id, name: f.name, lang: f.lang, creator: f.creator, notes: f.notes, tags: f.tags, spend: f.spend, sub: f.sub, memory: (f.memory || []).map((x) => x.text) },
          creator: { name: c.name, langs: langsOf(c), tone: c.tone, content: c.content, limits: c.limits, examples: c.examples || '', vault: c.vault || [] },
          scripts: d.scripts, story: d.story[f.id] || null, offered: f.msgs.filter((m) => m.vaultId).map((m) => m.vaultId),
          history: f.msgs.map((m) => ({ from: m.from, text: m.text, offer: !!m.price })),
          usedScripts: d.used[f.id] || [], mockIndex: d.mockIdx[f.id] || 0, model: d.models[f.lang] || undefined,
        }),
      }).then(async (res) => ({ res, r: await res.json() }));
      req.catch(() => {});
      // "Seen" pause before typing starts.
      await sleep(delay + rand(800, 2600));
      if (!live()) { bail(); return; }
      d.typingShow[f.id] = true; const t0 = Date.now(); rerender();
      const { res, r } = await req;
      if (res.status === 401) { window.location.href = '/login?next=/dashboard'; return; }
      if (!res.ok || r.type === 'error') { stop(); scheduleRetry(f, r.busy ? 'AI is busy' : r.error || 'The reply failed'); return; }
      clearRetry(f);
      if (!live() || (!needsReply(f) && !newFanMsg())) { bail(); return; }
      if (r.type === 'flag') { stop(); d.flagged[f.id] = r.flag; d.paused[f.id] = true; delete d.story[f.id]; d.stats.flags++; toast(`Flagged for a human: ${r.flag}`); rerender(); return; }

      // Type each bubble out. Scripts stay one bubble; AI replies may split into 2–3.
      const parts = r.type === 'script' ? [r.text] : splitReply(r.text);
      for (let i = 0; i < parts.length - 1; i++) {
        const wait = typeMs(parts[i]) - (i === 0 ? Date.now() - t0 : 0);
        if (wait > 0) await sleep(wait);
        if (!live()) { bail(); return; }
        f.msgs.push({ from: 'me', text: parts[i], time: now(), src: r.type === 'script' ? 'script' : 'ai' });
        d.typingShow[f.id] = false; rerender();
        await sleep(rand(500, 1300));
        if (!live()) { bail(); return; }
        d.typingShow[f.id] = true; rerender();
      }
      const last = parts[parts.length - 1];
      const wait = typeMs(last) - (parts.length === 1 ? Date.now() - t0 : 0);
      if (wait > 0) await sleep(wait);
      if (!live()) { bail(); return; }
      d.typing[f.id] = false; d.typingShow[f.id] = false;
      r.text = last;

      const p = (d.per[f.creator] ||= blankPer());
      if (r.type === 'script') {
        f.msgs.push({ from: 'me', text: r.text, time: now(), src: 'script', price: r.price, scriptId: r.scriptId, stepLabel: r.total > 1 ? `${r.label} ${r.step + 1}/${r.total}` : '' });
        d.stats.script++; p.script++;
        if (r.step === 0) (d.used[f.id] ||= []).push(r.scriptId);
        if (r.step + 1 < r.total) d.story[f.id] = { scriptId: r.scriptId, step: r.step }; else delete d.story[f.id];
        recordSend(f, r.step === 0 ? r.scriptId : null, r.price);
      } else {
        f.msgs.push({ from: 'me', text: r.text, time: now(), src: 'ai', cost: r.cost, ...(r.offer ? { price: r.offer.price, vaultId: r.offer.id, vaultTitle: `${r.offer.title} · ${r.offer.type}` } : {}) });
        if (r.offer) recordSend(f, null, r.offer.price);
        d.stats.ai++; p.ai++; d.stats.tokensIn += r.tokensIn || 0; d.stats.tokensOut += r.tokensOut || 0; d.stats.cost += r.cost || 0;
        d.mockIdx[f.id] = (d.mockIdx[f.id] || 0) + 1; d.mock = !!r.mock;
      }
      rerender();
      learn(f);
    } catch {
      d.typing[f.id] = false; d.typingShow[f.id] = false; scheduleRetry(f, 'Connection lost');
    }
  }

  // New subscriber: she greets him first, before he says anything.
  // Uses the creator's welcome script (in his language if there is one, otherwise translated).
  // In the full build this runs on OnlyFansAPI's new-subscriber event.
  const NEW_NAMES = ['Alex', 'Ben', 'Jordan', 'Kevin', 'Mike', 'Nate', 'Ollie', 'Pete', 'Ricky', 'Steve', 'Theo', 'Zach'];
  async function newSubscriber(creatorId) {
    const c = cr(creatorId); if (!c) return null;
    const langs = langsOf(c);
    const lang = langs.includes('EN') ? 'EN' : langs[0];
    const taken = new Set(d.fans.map((f) => f.name));
    const name = NEW_NAMES.find((n) => !taken.has(n)) || `Fan ${d.fans.length + 1}`;
    const f = { id: `n${Date.now()}`, name, creator: c.id, lang, spend: 0, last: 'Today', since: 'Oct 2026', tags: ['New sub'], notes: '', sub: 'active', memory: [], msgs: [] };
    d.fans.unshift(f); rerender();
    toast(`${name} just subscribed to ${c.name}`);
    welcome(f);
    return f.id;
  }
  async function welcome(f) {
    const c = cr(f.creator);
    const ok = (x) => x.enabled !== false && (x.welcome || /welcome/i.test(x.name)) && (x.creator === 'all' || x.creator === f.creator);
    const s = d.scripts.find((x) => ok(x) && x.lang === f.lang) || d.scripts.find(ok);
    if (!s || !d.autopilot || c.autopilot === false) return;
    let text = s.steps[0].text;
    if (s.lang !== f.lang) {
      try {
        const r = await (await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, from: s.lang, to: [f.lang], creator: { name: c.name, tone: c.tone }, models: d.models }) })).json();
        text = r.versions?.[f.lang] || text;
      } catch {}
    }
    text = text.replaceAll('{name}', f.name);
    await sleep(rand(1500, 3000));
    if (!d.autopilot || d.paused[f.id] || f.msgs.length) return; // he wrote first, so autopilot answers normally
    d.typing[f.id] = true; d.typingShow[f.id] = true; rerender();
    await sleep(typeMs(text));
    d.typing[f.id] = false; d.typingShow[f.id] = false;
    if (f.msgs.some((m) => m.from === 'fan')) { rerender(); autoReply(f, 300); return; }
    const price = Number(s.steps[0].price) || 0;
    f.msgs.push({ from: 'me', text, time: now(), src: 'script', price, scriptId: s.id, stepLabel: 'Welcome' });
    (d.used[f.id] ||= []).push(s.id);
    recordSend(f, s.id, price);
    const p = (d.per[f.creator] ||= blankPer()); d.stats.script++; p.script++;
    rerender();
  }

  // Memory: after each reply, pull new facts he shared (hobbies, job, pets…) into his profile.
  // The AI gets them with every reply, so it never asks him the same thing twice.
  async function learn(f) {
    const from = d.learned[f.id] || 0;
    const fresh = f.msgs.slice(from);
    if (!fresh.some((m) => m.from === 'fan')) return;
    d.learned[f.id] = f.msgs.length;
    try {
      const res = await fetch('/api/memory', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fan: { name: f.name }, known: (f.memory || []).map((x) => x.text), recent: f.msgs.slice(Math.max(0, from - 2)).map((m) => ({ from: m.from, text: m.text })) }) });
      const r = await res.json();
      if (!r.facts?.length) return;
      f.memory = [...(f.memory || []), ...r.facts.map((text) => ({ text, at: now(), auto: true }))];
      toast(`Remembered about ${f.name}: ${r.facts.join(', ')}`);
      rerender();
    } catch {}
  }

  // Errors never pause autopilot. The chat waits (5s, 10s, 20s, 40s, then every 60s) and tries again
  // on its own. Only a person turning autopilot off, or a safety flag, stops it.
  function scheduleRetry(f, why) {
    const prev = d.retry[f.id];
    const n = (prev?.n || 0) + 1;
    const wait = Math.min(60000, 5000 * 2 ** (n - 1));
    clearTimeout(prev?.timer);
    const timer = setTimeout(() => { if (d.retry[f.id]) d.retry[f.id].timer = null; autoReply(f, 0); }, wait);
    d.retry[f.id] = { n, at: Date.now() + wait, why, timer };
    d.error = `${why}. Autopilot will keep retrying on its own.`;
    rerender();
  }
  function clearRetry(f) {
    if (!d.retry[f.id]) return;
    clearTimeout(d.retry[f.id].timer); delete d.retry[f.id];
    if (!Object.keys(d.retry).length) d.error = '';
  }
  const runAll = () => d.fans.filter(needsReply).forEach((f, i) => autoReply(f, 1000 + i * 1800));

  // Safety net: every 20 seconds, pick up any chat still waiting for a reply.
  // When the internet comes back, retry waiting chats right away.
  useEffect(() => {
    const sweep = () => d.fans.filter((f) => needsReply(f) && !d.typing[f.id] && !d.retry[f.id]?.timer).forEach((f, i) => autoReply(f, i * 1500));
    const back = () => d.fans.forEach((f) => { const x = d.retry[f.id]; if (x?.timer) { clearTimeout(x.timer); x.timer = null; autoReply(f, 0); } });
    const id = setInterval(sweep, 20000);
    const tick = setInterval(() => { if (Object.keys(d.retry).length) rerender(); }, 1000); // keeps the "retrying in Xs" countdown live
    window.addEventListener('online', back);
    return () => { clearInterval(id); clearInterval(tick); window.removeEventListener('online', back); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (saved?.creators?.length) d.creators = saved.creators.map((c) => (c.vault ? c : { ...c, vault: defaultCreators.find((x) => x.id === c.id)?.vault || [] }));
      if (Array.isArray(saved?.scripts)) d.scripts = saved.scripts.map(normalizeScript);
      if (saved?.models && typeof saved.models === 'object') d.models = { ...d.models, ...saved.models };
    } catch {}
    rerender();
    runAll();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { msgEnd.current?.scrollIntoView({ block: 'end' }); });

  const inScope = d.fans.filter((f) => { const c = cr(f.creator); return c && (ws === 'all' || c.ws === ws) && (crFilter === 'all' || f.creator === crFilter); });
  const activeList = LISTS.find((l) => l.id === list) || LISTS[0];
  const visible = inScope.filter((f) => activeList.test(f, d));
  const fan = inScope.find((f) => f.id === fanId);
  const unread = d.fans.filter((f) => cr(f.creator) && needsReply(f)).length;

  function sendManual() {
    const v = draft.trim();
    if (!v) { toast('Type a message first'); return; }
    fan.msgs.push({ from: 'me', text: v, time: now(), src: 'manual' });
    setDraft(''); toast('Message sent'); rerender();
  }
  function simulate() {
    const q = incoming[fan.lang] || incoming.EN; const i = (d.inIdx[fan.id] || 0) % q.length; d.inIdx[fan.id] = i + 1;
    fan.msgs.push({ from: 'fan', text: q[i], time: now() }); fan.quietDays = 0; rerender(); autoReply(fan, 1500);
  }
  // Demo stand-in for OnlyFansAPI's purchase webhook.
  function buy(f, m) {
    if (m.bought) return;
    m.bought = true; f.spend += m.price;
    d.stats.sold++; d.stats.revenue += m.price;
    (d.per[f.creator] ||= blankPer()).revenue += m.price;
    if (m.scriptId) { const s = sStat(m.scriptId); s.bought++; s.revenue += m.price; }
    if (m.vaultId) { const vs = (d.vStats[m.vaultId] ||= { sold: 0, revenue: 0 }); vs.sold++; vs.revenue += m.price; }
    toast(`${f.name} unlocked the PPV · ${money(m.price)}`); rerender();
  }
  function sendMass({ creator, recipients, mode, scriptId, versions, srcLang, price }) {
    const s = d.scripts.find((x) => x.id === scriptId);
    recipients = recipients.filter((f) => f.creator === creator); // never cross creators
    recipients.forEach((f) => {
      const body = (versions[f.lang] ?? versions[srcLang]).replaceAll('{name}', f.name);
      if (mode === 'script' && s) {
        const st = s.steps[0];
        f.msgs.push({ from: 'me', text: body, time: now(), src: 'mass', price, scriptId: s.id, stepLabel: s.steps.length > 1 ? `${st.label} 1/${s.steps.length}` : '' });
        // Later storyline steps are written in the script's language, so only same-language fans continue it.
        if (s.steps.length > 1 && f.lang === s.lang) d.story[f.id] = { scriptId: s.id, step: 0 };
        (d.used[f.id] ||= []).push(s.id);
        recordSend(f, s.id, price);
      } else {
        f.msgs.push({ from: 'me', text: body, time: now(), src: 'mass', price });
        recordSend(f, null, price);
      }
      d.stats.mass++;
    });
    setSheet(null); toast(`Sent from ${cr(creator)?.name} to ${recipients.length} ${recipients.length === 1 ? 'fan' : 'fans'}`); rerender();
  }
  function toggleTheme() {
    const r = document.documentElement;
    const dark = r.dataset.theme ? r.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    r.dataset.theme = dark ? 'light' : 'dark';
  }

  // ---- admin ----
  function saveScript(s) {
    const i = d.scripts.findIndex((x) => x.id === s.id);
    if (i >= 0) d.scripts[i] = s; else d.scripts.unshift(s);
    save(); setSheet(null); toast(i >= 0 ? 'Script saved' : 'Script added'); rerender();
  }
  function deleteScript(id) { d.scripts = d.scripts.filter((s) => s.id !== id); save(); setSheet(null); toast('Script deleted'); rerender(); }
  function toggleScript(s) { s.enabled = s.enabled === false; save(); rerender(); }
  function saveCreator(c) {
    const i = d.creators.findIndex((x) => x.id === c.id);
    if (i >= 0) d.creators[i] = c; else { d.creators.push(c); d.per[c.id] = blankPer(); }
    save(); setSheet(null); toast(i >= 0 ? 'Persona saved' : `${c.name} connected`); rerender();
  }
  function removeCreator(id) {
    d.creators = d.creators.filter((c) => c.id !== id);
    d.scripts = d.scripts.filter((s) => s.creator !== id);
    if (crFilter === id) setCrFilter('all');
    save(); setSheet(null); toast('Creator removed'); rerender();
  }
  function resetDemo() { try { localStorage.removeItem(STORE); } catch {} location.reload(); }

  const navBtn = (v) => (
    <button key={v} aria-label={navLabel[v]} aria-current={view === v} onClick={() => { setView(v); setPane('list'); setProf(false); }}>
      {icons[v]}<span>{navLabel[v]}</span>
      {v === 'inbox' && unread > 0 && <span className="badge">{unread}</span>}
    </button>
  );
  const nav = (
    <nav className="nav" aria-label="Main">
      <div className="logo" aria-hidden="true">V</div>
      {navBtn('inbox')}{navBtn('demo')}{navBtn('analytics')}
      <span className="navgroup">Admin</span>
      {navBtn('scripts')}{navBtn('creators')}{navBtn('models')}
      <div className="spacer" />
      <button aria-label="Switch theme" onClick={toggleTheme}><Icon d={<><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" /></>} /><span>Theme</span></button>
      <button aria-label="Log out" onClick={async () => { try { await fetch('/api/logout', { method: 'POST' }); } catch {} window.location.href = '/login'; }}><Icon d={<><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 17l-5-5 5-5M5 12h11" /></>} /><span>Log out</span></button>
    </nav>
  );
  const sheets = sheet && (
    <div className="scrim" onClick={(e) => { if (e.target === e.currentTarget) setSheet(null); }}>
      {sheet.kind === 'script' && <ScriptSheet item={sheet.item} creators={d.creators} onSave={saveScript} onDelete={deleteScript} onClose={() => setSheet(null)} />}
      {sheet.kind === 'creator' && <CreatorSheet item={sheet.item} onSave={saveCreator} onRemove={removeCreator} onClose={() => setSheet(null)} />}
      {sheet.kind === 'connect' && <ConnectSheet taken={d.creators.map((c) => c.handle)} onNext={(c) => setSheet({ kind: 'creator', item: c })} onClose={() => setSheet(null)} />}
      {sheet.kind === 'mass' && <MassSheet d={d} cr={cr} start={sheet.start} onSend={sendMass} onClose={() => setSheet(null)} />}
    </div>
  );
  const toastEl = <div className={`toast ${toastMsg ? 'on' : ''}`} role="status">{toastMsg}</div>;

  if (view !== 'inbox') {
    return (
      <div className="app pages">
        {nav}
        <section className="page">
          {view === 'scripts' && <Scripts d={d} cr={cr} sStat={sStat} onAdd={() => setSheet({ kind: 'script', item: null })} onEdit={(s) => setSheet({ kind: 'script', item: s })} onToggle={toggleScript} />}
          {view === 'creators' && <Creators d={d} onConnect={() => setSheet({ kind: 'connect' })} onEdit={(c) => setSheet({ kind: 'creator', item: c })}
            onToggle={(c) => { c.autopilot = c.autopilot === false; save(); rerender(); if (c.autopilot) runAll(); }} onReset={resetDemo} />}
          {view === 'analytics' && <Analytics d={d} sStat={sStat} />}
          {view === 'models' && <ModelsPage d={d} save={save} rerender={rerender} toast={toast} />}
          {view === 'demo' && <LiveDemo d={d} cr={cr} autoReply={autoReply} buy={buy} rerender={rerender} newSubscriber={newSubscriber} />}
        </section>
        {sheets}{toastEl}
      </div>
    );
  }

  const crOpts = d.creators.filter((c) => ws === 'all' || c.ws === ws);
  const sorted = [...visible].sort((a, b) => needsReply(b) - needsReply(a));
  const fanCreator = fan && cr(fan.creator);

  return (
    <div className={`app ${prof ? 'prof' : ''}`} data-pane={pane}>
      {nav}
      <section className="col list">
        <div className="head">
          <div className="row between"><h1 className="h1">Inbox</h1>
            <button className="btn sm primary" onClick={() => setSheet({ kind: 'mass', start: { list, creator: crFilter, ws } })}>Mass message</button></div>
          <button className="iconbtn" style={{ justifyContent: 'space-between', width: '100%' }} aria-pressed={d.autopilot}
            onClick={() => { d.autopilot = !d.autopilot; toast(d.autopilot ? 'Autopilot on' : 'Autopilot paused'); rerender(); if (d.autopilot) runAll(); }}>
            <span className="row"><span className="dot" style={{ background: d.autopilot ? 'var(--ok)' : 'var(--faint)' }} />{d.autopilot ? 'Autopilot on' : 'Autopilot paused'}</span>
            <span className="sub">{d.autopilot ? 'Pause all' : 'Resume'}</span>
          </button>
          <div className="seg" role="group" aria-label="Account">
            {['all', 'owner', 'partner'].map((w) => (
              <button key={w} aria-pressed={ws === w} onClick={() => { setWs(w); setCrFilter('all'); }}>{w === 'all' ? 'All accounts' : workspaces[w]}</button>
            ))}
          </div>
          <select id="crSel" aria-label="Creator" value={crFilter} onChange={(e) => setCrFilter(e.target.value)}>
            <option value="all">All creators ({crOpts.length})</option>
            {crOpts.map((c) => <option key={c.id} value={c.id}>{c.name} · {langsOf(c).join('/')}</option>)}
          </select>
          <div className="chips" role="group" aria-label="Smart lists">
            {LISTS.map((l) => (
              <button key={l.id} className="chipbtn" title={l.hint || l.name} aria-pressed={list === l.id} onClick={() => setList(l.id)}>
                {l.name}<b>{inScope.filter((f) => l.test(f, d)).length}</b>
              </button>
            ))}
          </div>
          {d.mock && <div className="notice">No OpenRouter key yet, so AI replies are samples. Add your key to .env.local for real replies.</div>}
          {d.error && <div className="notice">{d.error}</div>}
        </div>
        <div className="scroll">
          {sorted.length === 0 && <div className="empty">No fans in this list.</div>}
          <div className="convs">
            {sorted.map((f) => {
              const m = f.msgs[f.msgs.length - 1];
              return (
                <button key={f.id} className="conv" aria-current={fanId === f.id} onClick={() => { setFanId(f.id); setPane('chat'); setProf(false); setDraft(''); }}>
                  <span className={`av ${needsReply(f) ? 'on' : ''}`}>{f.name[0]}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="row"><span className="name">{f.name}</span><span className="tag">{f.lang}</span>{f.sub === 'expired' && <span className="tag">Expired</span>}{d.flagged[f.id] && <span className="tag fill">Needs human</span>}</span>
                    <span className="prev">{d.typing[f.id] && d.typingShow[f.id] ? 'typing…' : (m.from === 'me' ? 'Bot: ' : '') + m.text}</span>
                    <span className="sub">{cr(f.creator).name}{(f.quietDays || 0) >= 7 ? ` · quiet ${f.quietDays}d` : ''}</span>
                  </span>
                  <span className="meta"><span>{m.time}</span><span className="spend">{money(f.spend)}</span></span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {!fan ? <section className="col chat"><div className="empty">Pick a conversation.</div></section> : (
        <>
          <section className="col chat">
            <div className="chathead">
              <button className="iconbtn back" onClick={() => setPane('list')}>‹ Inbox</button>
              <span className="av">{fan.name[0]}</span>
              <div className="grow"><div className="name">{fan.name}</div><span className="sub">to {fanCreator.name} · {langName[fan.lang]}</span></div>
              <button className="iconbtn" onClick={() => setProf(true)}>Profile</button>
            </div>
            <div className="scroll">
              <div className="msgs">
                {fan.msgs.map((m, i) => {
                  const day = /\d:\d/.test(m.time) ? 'Today' : m.time;
                  const prevDay = i > 0 ? (/\d:\d/.test(fan.msgs[i - 1].time) ? 'Today' : fan.msgs[i - 1].time) : null;
                  return (
                    <div key={i} style={{ display: 'contents' }}>
                      {day !== prevDay && <div className="day">{day}</div>}
                      <div className={`b ${m.from}`}>
                        {m.text}
                        {m.price > 0 && (
                          <div className="ppv">
                            <span>{m.vaultTitle || 'PPV'} · {m.bought ? 'unlocked' : 'locked'} · <span className="mono">{money(m.price)}</span></span>
                            {!m.bought && <button onClick={() => buy(fan, m)} title="Demo: stands in for a real purchase">Simulate purchase</button>}
                          </div>
                        )}
                        <div className="bmeta">{/\d:\d/.test(m.time) ? m.time : ''}{m.src ? ` · ${srcLabel[m.src]}` : ''}{m.stepLabel ? ` · ${m.stepLabel}` : ''}{m.src === 'ai' && m.cost ? ` · $${m.cost.toFixed(4)}` : ''}</div>
                      </div>
                    </div>
                  );
                })}
                {d.typing[fan.id] && d.typingShow[fan.id] && <div className="b me typingb" aria-label={`${fanCreator.name} is typing`}><span /><span /><span /></div>}
                <div ref={msgEnd} />
              </div>
            </div>
            <div className="dock">
              <Dock d={d} fan={fan} creator={fanCreator} draft={draft} setDraft={setDraft} sendManual={sendManual} rerender={rerender} autoReply={autoReply} clearRetry={clearRetry} />
              <div className="row between"><button className="iconbtn" onClick={simulate}>Simulate fan message</button><span className="demo hide-sm">Replies go out automatically</span></div>
            </div>
          </section>
          <aside className="col profile">
            <div className="row between" style={{ padding: '12px 16px 0' }}><span className="label">Fan profile</span><button className="iconbtn closeprof" onClick={() => setProf(false)}>Close</button></div>
            <div className="scroll">
              <div className="pcard"><span className="av">{fan.name[0]}</span><div className="name" style={{ fontSize: 18 }}>{fan.name}</div><span className="sub">{fan.sub === 'expired' ? `Subscription expired${fan.expired ? ` ${fan.expired}` : ''} · joined ${fan.since}` : `Subscribed since ${fan.since}`}</span>
                <button className="iconbtn" style={{ marginTop: 8 }} title="Demo: in the full build this comes from OnlyFansAPI" onClick={() => { fan.sub = fan.sub === 'expired' ? 'active' : 'expired'; if (fan.sub === 'expired') fan.expired = 'Today'; toast(fan.sub === 'expired' ? `${fan.name} marked as expired` : `${fan.name} marked as subscribed`); rerender(); }}>{fan.sub === 'expired' ? 'Demo: mark as subscribed' : 'Demo: mark as expired'}</button></div>
              <div className="sect"><span className="label">Lifetime spend</span><span className="big">{money(fan.spend)}</span>
                <dl className="kv"><dt>Language</dt><dd>{langName[fan.lang]}</dd><dt>Last purchase</dt><dd>{fan.last}</dd><dt>Creator</dt><dd>{fanCreator.name}</dd>
                  {d.story[fan.id] && <><dt>Storyline</dt><dd>{d.scripts.find((s) => s.id === d.story[fan.id].scriptId)?.name} · step {d.story[fan.id].step + 1}</dd></>}</dl></div>
              <div className="sect"><span className="label">Smart lists</span><div className="tags">{LISTS.filter((l) => l.id !== 'all' && l.test(fan, d)).map((l) => <span key={l.id} className="tag fill">{l.name}</span>)}{fan.tags.filter((t) => !LISTS.some((l) => l.name.toLowerCase().startsWith(t.toLowerCase()))).map((t) => <span key={t} className="tag">{t}</span>)}</div></div>
              <FanMemory fan={fan} d={d} rerender={rerender} />
              <div className="sect"><label className="label" htmlFor="notes">Notes</label>
                <textarea id="notes" className="notes" placeholder="Add what you learn about this fan…" value={fan.notes} onChange={(e) => { fan.notes = e.target.value; rerender(); }} />
                <span className="small">The AI reads these notes before every reply.</span></div>
              <div className="sect"><div className="row between"><span className="label">Creator persona</span><button className="btn sm" onClick={() => setSheet({ kind: 'creator', item: fanCreator })}>Edit</button></div><span className="small" style={{ whiteSpace: 'pre-line' }}>{fanCreator.tone}</span></div>
            </div>
          </aside>
        </>
      )}
      {sheets}{toastEl}
    </div>
  );
}

function Dock({ d, fan, creator, draft, setDraft, sendManual, rerender, autoReply, clearRetry }) {
  const compose = (ph) => (
    <div className="compose">
      <textarea id="draft" rows={2} aria-label="Message" placeholder={ph} value={draft} onChange={(e) => setDraft(e.target.value)} />
      <button className="btn primary" onClick={sendManual}>Send</button>
    </div>
  );
  const resume = () => { delete d.paused[fan.id]; delete d.flagged[fan.id]; d.error = ''; rerender(); autoReply(fan); };
  const story = d.story[fan.id] && d.scripts.find((s) => s.id === d.story[fan.id].scriptId);

  if (d.flagged[fan.id]) {
    return (
      <div className="card">
        <div className="src"><span className="tag fill">Needs human</span><span>{d.flagged[fan.id]}. Autopilot stopped on this chat so a person can answer.</span></div>
        {compose('Write the reply yourself…')}
        <div className="actions"><button className="btn" onClick={resume}>Resolve and resume autopilot</button></div>
      </div>
    );
  }
  const creatorOff = creator.autopilot === false;
  if (d.autopilot && !creatorOff && !d.paused[fan.id]) {
    const next = story ? `next: ${story.name}, step ${d.story[fan.id].step + 2} of ${story.steps.length} when he replies` : `waiting for ${fan.name}`;
    return (
      <div className="card">
        <div className="src"><span className="dot" style={{ background: 'var(--ok)' }} /><span><b style={{ color: 'var(--fg)', fontWeight: 600 }}>Autopilot is handling this chat</b> · {d.typing[fan.id] ? 'replying now' : d.retry[fan.id] ? `${d.retry[fan.id].why.toLowerCase()}, retrying in ${Math.max(1, Math.round((d.retry[fan.id].at - Date.now()) / 1000))}s` : needsReply(fan) ? 'queued' : next}</span></div>
        <div className="actions"><button className="btn sm" onClick={() => { d.paused[fan.id] = true; d.typing[fan.id] = false; clearRetry(fan); rerender(); }}>Take over</button></div>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="src"><span className="dot" style={{ background: 'var(--faint)' }} /><span>{!d.autopilot ? 'Autopilot is paused for all chats' : creatorOff ? `Autopilot is off for ${creator.name}` : 'You took over this chat'}</span></div>
      {compose('Write a message…')}
      {d.autopilot && !creatorOff && <div className="actions"><button className="btn sm" onClick={resume}>Hand back to autopilot</button></div>}
    </div>
  );
}

/* ---------------- Mass message ---------------- */
function MassSheet({ d, cr, start, onSend, onClose }) {
  const [listId, setListId] = useState(start?.list && !['all', 'reply', 'human'].includes(start.list) ? start.list : 'quiet');
  // Mass messages always go out from one creator to her own fans.
  const [creator, setCreator] = useState(() => (start?.creator && start.creator !== 'all' && cr(start.creator) ? start.creator : (d.creators.find((c) => !start?.ws || start.ws === 'all' || c.ws === start.ws) || d.creators[0])?.id || ''));
  const scriptsFor = d.scripts.filter((x) => x.enabled !== false && (x.creator === 'all' || x.creator === creator));
  const [mode, setMode] = useState('script');
  const [scriptId, setScriptId] = useState(() => scriptsFor.find((s) => s.id === 's7')?.id || scriptsFor[0]?.id || '');
  const [text, setText] = useState('');
  const [price, setPrice] = useState('');
  const [writeLang, setWriteLang] = useState('EN');
  const [err, setErr] = useState('');
  const [versions, setVersions] = useState(null); // { EN: '...', IT: '...' } once translated
  const [busy, setBusy] = useState(false);
  const [mockNote, setMockNote] = useState(false);
  const l = LISTS.find((x) => x.id === listId);
  const s = scriptsFor.find((x) => x.id === scriptId);
  const c = cr(creator);
  const cName = c?.name || '';
  const srcLang = mode === 'script' && s ? s.lang : writeLang;
  const srcText = mode === 'script' && s ? s.steps[0].text : text.trim();
  const srcPrice = mode === 'script' && s ? Number(s.steps[0].price) || 0 : Number(price) || 0;
  const pool = d.fans.filter((f) => f.creator === creator && l.test(f, d) && !d.flagged[f.id]);
  // Expired subscribers can't unlock paid messages, so they're left out of anything with a price.
  const recipients = srcPrice > 0 ? pool.filter((f) => f.sub !== 'expired') : pool;
  const expiredSkipped = pool.length - recipients.length;
  const langs = [...new Set(recipients.map((f) => f.lang))];
  const needs = langs.filter((x) => x !== srcLang);
  const count = (lang) => recipients.filter((f) => f.lang === lang).length;
  const reset = () => { setVersions(null); setErr(''); setMockNote(false); };

  function pickCreator(id) {
    setCreator(id); reset();
    const ok = d.scripts.filter((x) => x.enabled !== false && (x.creator === 'all' || x.creator === id));
    if (!ok.some((x) => x.id === scriptId)) setScriptId(ok[0]?.id || '');
  }

  async function submit(e) {
    e.preventDefault();
    if (!creator) return setErr('Pick the creator sending this.');
    if (mode === 'script' && !s) return setErr('Pick a script to send.');
    if (mode === 'custom' && !text.trim()) return setErr('Write the message to send.');
    if (!recipients.length) return setErr(`None of ${cName}'s fans match. Pick another list.`);
    if (versions) {
      if (langs.some((x) => !versions[x]?.trim())) return setErr('Every language needs a message.');
      return onSend({ creator, recipients, mode, scriptId, versions, srcLang, price: srcPrice });
    }
    // First click: get each language version ready for review.
    if (!needs.length) return onSend({ creator, recipients, mode, scriptId, versions: { [srcLang]: srcText }, srcLang, price: srcPrice });
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: srcText, from: srcLang, to: needs, creator: { name: c.name, tone: c.tone }, models: d.models }) });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error || 'Translation failed');
      const v = { [srcLang]: srcText, ...r.versions };
      needs.forEach((x) => { if (!v[x]) v[x] = ''; });
      setVersions(v); setMockNote(!!r.mock);
      if (r.failed?.length) setErr(`Couldn't translate into ${r.failed.join(', ')}. Write that version below or try again.`);
    } catch (ex) { setErr(ex.message || 'Translation failed'); }
    setBusy(false);
  }

  return (
    <form className="sheet" onSubmit={submit}>
      <div className="sheethead"><h2>Mass message{cName ? ` from ${cName}` : ''}</h2><button type="button" className="btn sm" onClick={onClose}>Close</button></div>
      <div className="form">
        <div className="two">
          <div className="field"><label className="label" htmlFor="m-cr">From</label>
            <select id="m-cr" value={creator} onChange={(e) => pickCreator(e.target.value)}>{d.creators.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
          <div className="field"><label className="label" htmlFor="m-list">To her fans</label>
            <select id="m-list" value={listId} onChange={(e) => { setListId(e.target.value); reset(); }}>{LISTS.filter((x) => x.id !== 'human').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        </div>
        <span className="hint">Only {cName}&apos;s own fans get this. Other creators&apos; fans are never included.</span>
        <div className="field"><span className="label">Message</span>
          <div className="seg" role="group" aria-label="Message type">
            <button type="button" aria-pressed={mode === 'script'} onClick={() => { setMode('script'); reset(); }}>Use a script</button>
            <button type="button" aria-pressed={mode === 'custom'} onClick={() => { setMode('custom'); reset(); }}>Write one</button>
          </div></div>
        {mode === 'script' ? (
          <div className="field"><label className="label" htmlFor="m-s">Script</label>
            <select id="m-s" value={scriptId} onChange={(e) => { setScriptId(e.target.value); reset(); }}>
              {!scriptsFor.length && <option value="">No scripts for {cName}</option>}
              {scriptsFor.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.lang}{x.steps.length > 1 ? ` · ${x.steps.length}-step storyline` : ''}</option>)}
            </select>
            {s && !versions && <div className="quote">{s.steps[0].text}{Number(s.steps[0].price) > 0 && <span className="price">{money(s.steps[0].price)}</span>}</div>}
            {s?.steps.length > 1 && <span className="hint">Step 1 goes to everyone now. {langName[s.lang]} fans who reply get the next steps; fans in other languages are picked up by the AI.</span>}
          </div>
        ) : (
          <>
            <div className="field"><div className="row between"><label className="label" htmlFor="m-text">Text</label>
              <select aria-label="Language you're writing in" value={writeLang} onChange={(e) => { setWriteLang(e.target.value); reset(); }} style={{ width: 'auto' }}>{Object.entries(langName).map(([k, v]) => <option key={k} value={k}>Written in {v}</option>)}</select></div><textarea id="m-text" rows={4} value={text} onChange={(e) => { setText(e.target.value); if (versions) reset(); }} placeholder="Hey {name}, I made something new today 👀" />
              <span className="hint">{'{name}'} inserts each fan&apos;s name. Fans who speak another language get it rewritten in their language, in her voice.</span></div>
            <div className="field"><label className="label" htmlFor="m-price">PPV price (optional)</label><input id="m-price" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" /></div>
          </>
        )}
        <div className="field"><span className="label">Recipients · {recipients.length}</span>
          <div className="recips">{recipients.length ? recipients.map((f) => <span key={f.id} className="tag">{f.name} · {f.lang}</span>) : <span className="small">Nobody matches yet.</span>}</div>
          {needs.length > 0 && !versions && <span className="hint">Her fans speak {langs.map((x) => langName[x]).join(', ')}. You&apos;ll see each version before it goes out.</span>}
          {expiredSkipped > 0 && <span className="hint">{expiredSkipped} expired {expiredSkipped === 1 ? 'fan is' : 'fans are'} left out because they can&apos;t unlock a paid message. Send them a free win-back message instead.</span>}
          <span className="hint">Fans flagged for a human are never included.</span></div>
        {versions && (
          <div className="field"><span className="label">Check each version</span>
            {langs.map((x) => (
              <div key={x} className="field" style={{ marginTop: 8 }}>
                <label className="label" htmlFor={`v-${x}`}>{langName[x]} · {count(x)} {count(x) === 1 ? 'fan' : 'fans'}{x === srcLang ? ' · original' : ''}</label>
                <textarea id={`v-${x}`} rows={3} value={versions[x] || ''} onChange={(e) => setVersions({ ...versions, [x]: e.target.value })} />
              </div>
            ))}
            {mockNote && <span className="hint">Demo mode: no OpenRouter key is set, so these weren&apos;t translated. With the key, each one comes back in its language.</span>}
            {srcPrice > 0 && <span className="hint">Every version carries the same PPV · {money(srcPrice)}</span>}
          </div>
        )}
        {err && <div className="notice">{err}</div>}
      </div>
      <div className="sheetfoot"><span className="small">Demo: in the full build this sends through OnlyFansAPI.</span>
        <div className="row" style={{ gap: 8 }}>
          {versions && <button type="button" className="btn" onClick={reset}>Back</button>}
          <button type="submit" className="btn primary" disabled={!recipients.length || busy}>
            {busy ? 'Translating…' : versions || !needs.length ? `Send to ${recipients.length} ${recipients.length === 1 ? 'fan' : 'fans'}` : `Preview ${langs.length} languages`}
          </button>
        </div></div>
    </form>
  );
}

/* ---------------- Admin: scripts ---------------- */
function Scripts({ d, cr, sStat, onAdd, onEdit, onToggle }) {
  const [lang, setLang] = useState('all');
  const items = d.scripts.filter((s) => lang === 'all' || s.lang === lang);
  return (
    <div className="pagein">
      <div className="pagehead">
        <div><p className="eyebrow">Admin</p><h1 className="ptitle">Scripts</h1>
          <p className="lede">Saved messages sent exactly as written. A storyline sends step 1 when a trigger word matches, then the next step each time the fan replies, usually tease, build, then sell.</p></div>
        <div className="row"><select aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value)}><option value="all">All languages</option>{Object.entries(langName).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <button className="btn primary" onClick={onAdd}>Add script</button></div>
      </div>
      {items.length === 0 && <div className="card"><span>No scripts yet.</span><span className="small">Add one with a few trigger words, such as “custom” or “how much”.</span></div>}
      <div className="grid">
        {items.map((s) => {
          const st = sStat(s.id); const conv = st.sent ? Math.round((st.bought / st.sent) * 100) : 0;
          return (
            <article key={s.id} className={`card ${s.enabled === false ? 'off' : ''}`}>
              <div className="row between"><h3>{s.name}</h3><span className="row"><span className="tag">{s.lang}</span>{s.steps.length > 1 && <span className="tag fill">{s.steps.length} steps</span>}</span></div>
              <div className="steps">
                {s.steps.map((x, i) => (
                  <div key={i} className="stepline"><span className="stepno">{s.steps.length > 1 ? x.label : ''}</span>
                    <div className="quote">{x.text}{Number(x.price) > 0 && <span className="price">{money(x.price)}</span>}</div></div>
                ))}
              </div>
              <div className="tags">{s.triggers.length ? s.triggers.map((t) => <span key={t} className="tag">{t}</span>) : <span className="small">No triggers. Used for mass messages only.</span>}</div>
              <div className="small">{s.creator === 'all' ? 'All creators' : cr(s.creator)?.name || 'Removed creator'}</div>
              <div className="statrow">
                <div className="stat"><b>{st.sent}</b><span>Sent</span></div>
                <div className="stat"><b>{st.bought}</b><span>Bought</span></div>
                <div className="stat"><b>{conv}%</b><span>Converted</span></div>
                <div className="stat"><b>{money(st.revenue)}</b><span>Revenue</span></div>
              </div>
              <div className="actions row between">
                <label className="switch"><input type="checkbox" checked={s.enabled !== false} onChange={() => onToggle(s)} />{s.enabled === false ? 'Off' : 'On'}</label>
                <button className="btn sm" onClick={() => onEdit(s)}>Edit</button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ScriptSheet({ item, creators, onSave, onDelete, onClose }) {
  const [f, setF] = useState(() => item
    ? { ...item, triggers: item.triggers.join(', '), steps: item.steps.map((x) => ({ ...x, price: x.price || '' })) }
    : { id: uid('s'), name: '', lang: 'EN', creator: 'all', triggers: '', enabled: true, steps: [{ label: 'Message', text: '', price: '' }] });
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setStep = (i, k, v) => setF({ ...f, steps: f.steps.map((x, j) => (j === i ? { ...x, [k]: v } : x)) });
  const addStep = () => setF({ ...f, steps: [...f.steps, { label: STEP_LABELS[Math.min(f.steps.length, 2)], text: '', price: '' }] });
  const removeStep = (i) => setF({ ...f, steps: f.steps.filter((_, j) => j !== i) });
  const useStoryline = () => setF({ ...f, steps: [
    { label: 'Tease', text: 'Funny you ask {name}… I just made something 🫣 want a peek?', price: '' },
    { label: 'Build', text: "It's [describe it without giving it away] 🙈 only for my favourites", price: '' },
    { label: 'Sell', text: 'Okay, here it is just for you 💕', price: '25' },
  ] });
  function submit(e) {
    e.preventDefault();
    if (!f.name.trim()) return setErr('Give the script a name.');
    if (f.steps.some((x) => !x.text.trim())) return setErr('Every step needs a message.');
    if (f.steps.some((x) => /\[[^\]]+\]/.test(x.text))) return setErr('Replace the parts in [brackets] first.');
    const triggers = f.triggers.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
    onSave({ ...f, name: f.name.trim(), triggers, steps: f.steps.map((x) => ({ label: x.label, text: x.text.trim(), price: Number(x.price) || 0 })) });
  }
  return (
    <form className="sheet" onSubmit={submit}>
      <div className="sheethead"><h2>{item ? 'Edit script' : 'Add script'}</h2><button type="button" className="btn sm" onClick={onClose}>Close</button></div>
      <div className="form">
        <div className="field"><label className="label" htmlFor="s-name">Name</label><input id="s-name" value={f.name} onChange={set('name')} placeholder="Shower video storyline" /></div>
        <div className="two">
          <div className="field"><label className="label" htmlFor="s-lang">Language</label>
            <select id="s-lang" value={f.lang} onChange={set('lang')}>{Object.entries(langName).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="field"><label className="label" htmlFor="s-cr">Creator</label>
            <select id="s-cr" value={f.creator} onChange={set('creator')}><option value="all">All creators</option>{creators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        </div>
        <div className="field"><label className="label" htmlFor="s-trig">Trigger words</label><input id="s-trig" value={f.triggers} onChange={set('triggers')} placeholder="video, shower, new content" />
          <span className="hint">Separate with commas, in the fan&apos;s language. Leave empty for a script you only send as a mass message.</span></div>
        <div className="row between"><span className="label">Steps · {f.steps.length}</span>{f.steps.length === 1 && !f.steps[0].text && <button type="button" className="btn sm" onClick={useStoryline}>Use tease → build → sell</button>}</div>
        {f.steps.map((x, i) => (
          <div key={i} className="stepedit">
            <div className="row between">
              <select aria-label={`Step ${i + 1} type`} value={x.label} onChange={(e) => setStep(i, 'label', e.target.value)}>{STEP_LABELS.map((lb) => <option key={lb} value={lb}>{i + 1}. {lb}</option>)}</select>
              {f.steps.length > 1 && <button type="button" className="btn sm danger" onClick={() => removeStep(i)}>Remove</button>}
            </div>
            <textarea aria-label={`Step ${i + 1} message`} rows={3} value={x.text} onChange={(e) => setStep(i, 'text', e.target.value)} placeholder="Message… use {name} for the fan's name" />
            <div className="row"><label className="small" htmlFor={`price-${i}`} style={{ whiteSpace: 'nowrap' }}>PPV price</label>
              <input id={`price-${i}`} type="number" min="0" value={x.price} onChange={(e) => setStep(i, 'price', e.target.value)} placeholder="0, no PPV" style={{ maxWidth: 140 }} /></div>
          </div>
        ))}
        <button type="button" className="btn" onClick={addStep}>Add step</button>
        <span className="hint">Step 1 goes out when a trigger matches. Each next step goes out when the fan replies.</span>
        <label className="switch"><input type="checkbox" checked={f.enabled !== false} onChange={(e) => setF({ ...f, enabled: e.target.checked })} />Script is on</label>
        {err && <div className="notice">{err}</div>}
      </div>
      <div className="sheetfoot">
        {item ? (confirmDel
          ? <span className="row"><button type="button" className="btn danger" onClick={() => onDelete(item.id)}>Confirm delete</button><button type="button" className="btn" onClick={() => setConfirmDel(false)}>Keep</button></span>
          : <button type="button" className="btn danger" onClick={() => setConfirmDel(true)}>Delete</button>) : <span />}
        <button type="submit" className="btn primary">{item ? 'Save script' : 'Add script'}</button>
      </div>
    </form>
  );
}

/* ---------------- Admin: creators ---------------- */
function Creators({ d, onConnect, onEdit, onToggle, onReset }) {
  return (
    <div className="pagein">
      <div className="pagehead">
        <div><p className="eyebrow">Admin</p><h1 className="ptitle">Creators</h1>
          <p className="lede">The persona is what the AI reads before every reply: her languages, voice, what she sells and her limits. Edit it any time and autopilot uses the new version on the next message.</p></div>
        <button className="btn primary" onClick={onConnect}>Connect creator</button>
      </div>
      <div className="grid">
        {d.creators.map((c) => (
          <article key={c.id} className={`card ${c.autopilot === false ? 'off' : ''}`}>
            <div className="row"><span className="av">{c.name[0]}</span><div style={{ minWidth: 0 }}><h3>{c.name}</h3><span className="sub">{c.handle} · {workspaces[c.ws]}&apos;s account</span></div></div>
            <dl className="kv"><dt>Speaks</dt><dd>{langsOf(c).map((l) => langName[l]).join(', ')}</dd><dt>Subscribers</dt><dd className="mono">{(c.subs || 0).toLocaleString()}</dd><dt>Chats</dt><dd className="mono">{d.fans.filter((f) => f.creator === c.id).length}</dd></dl>
            <div><div className="label">Voice</div><div className="small" style={{ whiteSpace: 'pre-line' }}>{c.tone || 'Not set'}</div></div>
            <div><div className="label">Sells</div><div className="small" style={{ whiteSpace: 'pre-line' }}>{c.content || 'Not set'}</div></div>
            <div><div className="label">Hard limits</div><div className="small" style={{ whiteSpace: 'pre-line' }}>{c.limits || 'Not set'}</div></div>
            <div><div className="label">Vault · {(c.vault || []).length} items</div>
              {(c.vault || []).length ? <div className="steps">{c.vault.slice(0, 3).map((x) => <div key={x.id} className="quote row between"><span style={{ minWidth: 0 }}>{x.title}<span className="sub">{x.type} · {x.added}{d.vStats[x.id] ? ` · ${d.vStats[x.id].sold} sold` : ''}</span></span><span className="mono">{money(x.price)}</span></div>)}</div>
                : <div className="small">Empty. The AI will only offer customs.</div>}</div>
            <div className="actions row between">
              <label className="switch"><input type="checkbox" checked={c.autopilot !== false} onChange={() => onToggle(c)} />Autopilot</label>
              <button className="btn sm" onClick={() => onEdit(c)}>Edit persona</button>
            </div>
          </article>
        ))}
      </div>
      <p className="small">Changes are saved in this browser for the demo. In the full build they are saved to the database and shared with your partner. <button className="btn sm" onClick={onReset}>Reset demo data</button></p>
    </div>
  );
}

function ConnectSheet({ taken, onNext, onClose }) {
  const [pick, setPick] = useState(null);
  const [wsel, setWsel] = useState('owner');
  const free = availableAccounts.filter((a) => !taken.includes(a.handle));
  return (
    <div className="sheet">
      <div className="sheethead"><h2>Connect creator</h2><button className="btn sm" onClick={onClose}>Close</button></div>
      <div className="form">
        <span className="small">Pick the OnlyFans account to connect. In the full build this list comes from OnlyFansAPI after the creator signs in once.</span>
        <div className="pick">
          {free.length === 0 && <span className="small">All sample accounts are connected.</span>}
          {free.map((a) => (
            <button key={a.handle} type="button" aria-pressed={pick?.handle === a.handle} onClick={() => setPick(a)}>
              <span className="av">{a.name[0]}</span><span className="grow"><span className="name">{a.name}</span><span className="sub">{a.handle} · {a.subs.toLocaleString()} subscribers</span></span>
            </button>
          ))}
        </div>
        <div className="field"><span className="label">Account</span>
          <div className="seg" role="group" aria-label="Account">{['owner', 'partner'].map((w) => <button key={w} type="button" aria-pressed={wsel === w} onClick={() => setWsel(w)}>{workspaces[w]}</button>)}</div></div>
      </div>
      <div className="sheetfoot"><span /><button className="btn primary" disabled={!pick}
        onClick={() => pick && onNext({ id: uid('c'), name: pick.name, handle: pick.handle, subs: pick.subs, ws: wsel, langs: ['EN'], tone: '', content: '', limits: '', examples: '', vault: [], autopilot: true })}>Next: write persona</button></div>
    </div>
  );
}

function CreatorSheet({ item, onSave, onRemove, onClose }) {
  const [f, setF] = useState(() => ({ examples: '', ...item, langs: langsOf(item), vault: (item.vault || []).map((x) => ({ ...x })) }));
  const setItem = (i, k, val) => setF({ ...f, vault: f.vault.map((x, j) => (j === i ? { ...x, [k]: val } : x)) });
  const addItem = () => setF({ ...f, vault: [{ id: uid('v'), title: '', type: 'Video', price: '', added: 'Today', desc: '' }, ...f.vault] });
  const removeItem = (i) => setF({ ...f, vault: f.vault.filter((_, j) => j !== i) });
  const [err, setErr] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const isEmpty = !f.tone && !f.content;
  function submit(e) {
    e.preventDefault();
    if (!f.name.trim()) return setErr('The creator needs a display name.');
    if (!f.langs.length) return setErr('Tick at least one language she speaks.');
    if (/\[[^\]]+\]/.test(`${f.tone}${f.content}${f.limits}${f.examples}`)) return setErr('Some template parts in [brackets] are still unfilled. Replace or delete them.');
    if (!f.tone.trim()) return setErr('Describe her voice so the AI knows how to talk.');
    if (!f.content.trim()) return setErr('List what she sells, so the AI never offers content she doesn’t have.');
    if (f.vault.some((x) => !x.title.trim() || !x.desc.trim())) return setErr('Every vault item needs a title and a description, or remove it.');
    onSave({ ...f, name: f.name.trim(), vault: f.vault.map((x) => ({ ...x, title: x.title.trim(), desc: x.desc.trim(), price: Number(x.price) || 0 })) });
  }
  return (
    <form className="sheet" onSubmit={submit}>
      <div className="sheethead"><h2>{item.name} · persona</h2><button type="button" className="btn sm" onClick={onClose}>Close</button></div>
      <div className="form">
        <div className="field"><label className="label" htmlFor="c-name">Display name</label><input id="c-name" value={f.name} onChange={set('name')} /></div>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}><legend className="label" style={{ marginBottom: 8 }}>Languages she speaks</legend>
          <div className="row" style={{ flexWrap: 'wrap', gap: 14 }}>
            {Object.entries(langName).map(([k, v]) => (
              <label key={k} className="switch"><input type="checkbox" checked={f.langs.includes(k)} onChange={(e) => setF({ ...f, langs: e.target.checked ? [...f.langs, k] : f.langs.filter((x) => x !== k) })} />{v}{f.langs[0] === k ? ' (main)' : ''}</label>
            ))}
          </div>
          <span className="hint">The AI answers each fan in his language if she speaks it, and in her main language if not.</span></fieldset>
        {isEmpty && <div className="notice row between" style={{ flexWrap: 'wrap' }}><span>Start from the persona template and replace the parts in [brackets].</span><button type="button" className="btn sm" onClick={() => setF({ ...f, ...personaTemplate })}>Use template</button></div>}
        <div className="field"><label className="label" htmlFor="c-tone">Voice and personality</label><textarea id="c-tone" rows={4} value={f.tone} onChange={set('tone')} placeholder="Playful, teasing, sweet. Calls fans babe. Uses 🙈 and 💕." />
          <span className="hint">How she talks: mood, slang, pet names, emojis, how long her messages are.</span></div>
        <div className="field"><label className="label" htmlFor="c-sells">What she sells</label><textarea id="c-sells" rows={4} value={f.content} onChange={set('content')} placeholder="Shower and gym sets, lingerie, customs from $60" />
          <span className="hint">The AI only offers what&apos;s listed here, at these prices.</span></div>
        <div className="field"><label className="label" htmlFor="c-lim">Hard limits</label><textarea id="c-lim" rows={3} value={f.limits} onChange={set('limits')} placeholder="No face in customs. No meetups." />
          <span className="hint">Things she never does or says. Meetups, under-18 talk and sharing location are always blocked, on top of these.</span></div>
        <div className="field"><div className="row between"><span className="label">Content vault · {f.vault.length}</span><button type="button" className="btn sm" onClick={addItem}>Add item</button></div>
          <span className="hint">Her ready-made content, newest first. The AI only sells what&apos;s here and describes it from your description, since it can&apos;t see the media. In the full build this syncs from her OnlyFans vault.</span>
          {f.vault.map((x, i) => (
            <div key={x.id} className="stepedit">
              <div className="two">
                <input aria-label="Title" value={x.title} onChange={(e) => setItem(i, 'title', e.target.value)} placeholder="Morning shower video" />
                <div className="row"><input aria-label="Type" value={x.type} onChange={(e) => setItem(i, 'type', e.target.value)} placeholder="Video · 4 min" />
                  <input aria-label="Price" type="number" min="0" value={x.price} onChange={(e) => setItem(i, 'price', e.target.value)} placeholder="$" style={{ maxWidth: 80 }} /></div>
              </div>
              <textarea aria-label="Description" rows={2} value={x.desc} onChange={(e) => setItem(i, 'desc', e.target.value)} placeholder="What's in it, so the AI can tease it accurately" />
              <div className="row between"><span className="small">Added {x.added}</span><button type="button" className="btn sm danger" onClick={() => removeItem(i)}>Remove</button></div>
            </div>
          ))}
        </div>
        <div className="field"><label className="label" htmlFor="c-ex">Example messages (optional)</label><textarea id="c-ex" rows={5} value={f.examples} onChange={set('examples')} placeholder={'heyy babe 🙈 just got out the shower lol\nyou always know what to say 💕'} />
          <span className="hint">Paste a few real messages from her best chats, one per line. The AI copies the style.</span></div>
        <label className="switch"><input type="checkbox" checked={f.autopilot !== false} onChange={(e) => setF({ ...f, autopilot: e.target.checked })} />Autopilot on for this creator</label>
        {err && <div className="notice">{err}</div>}
      </div>
      <div className="sheetfoot">
        {confirmDel
          ? <span className="row"><button type="button" className="btn danger" onClick={() => onRemove(item.id)}>Confirm remove</button><button type="button" className="btn" onClick={() => setConfirmDel(false)}>Keep</button></span>
          : <button type="button" className="btn danger" onClick={() => setConfirmDel(true)}>Remove creator</button>}
        <button type="submit" className="btn primary">Save persona</button>
      </div>
    </form>
  );
}

/* ---------------- Analytics ---------------- */
function Analytics({ d, sStat }) {
  const s = d.stats; const tot = s.script + s.ai; const pct = tot ? Math.round((s.script / tot) * 100) : 0;
  const conv = s.ppvSent ? Math.round((s.sold / s.ppvSent) * 100) : 0;
  return (
    <div className="pagein">
      <div><p className="eyebrow">This session · both accounts</p><h1 className="ptitle">Analytics</h1>
        <p className="lede">Script replies cost nothing to send. AI cost comes from the real token count of each reply. Purchases come from OnlyFans in the full build; here, use “Simulate purchase” on a PPV.</p></div>
      <div className="tiles">
        <div className="tile"><span className="label">Auto replies</span><span className="big">{tot}</span><span className="small">{s.mass} mass · {s.flags} flagged</span></div>
        <div className="tile"><span className="label">Script share</span><span className="big">{pct}%</span><div className="split"><i style={{ width: `${pct}%` }} /><i style={{ width: `${tot ? 100 - pct : 0}%` }} /></div></div>
        <div className="tile"><span className="label">PPV revenue</span><span className="big">{money(s.revenue)}</span><span className="small">{s.sold} of {s.ppvSent} sold · {conv}%</span></div>
        <div className="tile"><span className="label">AI cost</span><span className="big">${s.cost.toFixed(4)}</span><span className="small">{(s.tokensIn + s.tokensOut).toLocaleString()} tokens</span></div>
      </div>
      <h2 className="sectiontitle">By creator</h2>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Creator</th><th className="hide-sm">Languages</th><th style={{ width: '34%' }}>Script vs AI</th><th className="n">Replies</th><th className="n">PPV sent</th><th className="n">Revenue</th></tr></thead>
          <tbody>
            {d.creators.map((c) => {
              const p = d.per[c.id] || blankPer(); const t = p.script + p.ai; const sp = t ? Math.round((p.script / t) * 100) : 0;
              return (
                <tr key={c.id}><td>{c.name}</td><td className="hide-sm">{langsOf(c).join(', ')}</td>
                  <td><div className="split"><i style={{ width: `${sp}%` }} /><i style={{ width: `${t ? 100 - sp : 0}%` }} /></div></td>
                  <td className="n mono">{t}</td><td className="n mono">{p.ppvSent}</td><td className="n mono">{money(p.revenue)}</td></tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <h2 className="sectiontitle">By script</h2>
      <div className="tablewrap">
        <table>
          <thead><tr><th>Script</th><th className="hide-sm">Steps</th><th className="n">Sent</th><th className="n">Bought</th><th className="n">Converted</th><th className="n">Revenue</th></tr></thead>
          <tbody>
            {d.scripts.map((x) => {
              const st = sStat(x.id); const cv = st.sent ? Math.round((st.bought / st.sent) * 100) : 0;
              return <tr key={x.id}><td>{x.name}</td><td className="hide-sm mono">{x.steps.length}</td><td className="n mono">{st.sent}</td><td className="n mono">{st.bought}</td><td className="n mono">{cv}%</td><td className="n mono">{money(st.revenue)}</td></tr>;
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Live demo: you play the fan ---------------- */
function LiveDemo({ d, cr, autoReply, buy, rerender, newSubscriber }) {
  const fans = d.fans.filter((f) => cr(f.creator));
  const pickDefault = (skipCreator) => (fans.find((f) => f.creator !== skipCreator && f.sub !== 'expired') || fans[0])?.id;
  const [left, setLeft] = useState(() => fans.find((f) => f.id === 'f1')?.id || pickDefault());
  const [subCreator, setSubCreator] = useState(d.creators[0]?.id || '');
  const [right, setRight] = useState(() => fans.find((f) => f.id === 'f3')?.id || pickDefault(fans.find((f) => f.id === left)?.creator));
  return (
    <div className="pagein">
      <div className="pagehead">
        <div><p className="eyebrow">Demo</p><h1 className="ptitle">Live demo</h1>
          <p className="lede">You&apos;re the fan. Type in either phone and watch the AI answer as the creator, with typing, PPVs and everything. Both chats run at the same time, and every message also shows up in the Inbox.</p></div>
        <div className="row" style={{ gap: 8 }}>
          <select aria-label="Creator they subscribe to" value={subCreator} onChange={(e) => setSubCreator(e.target.value)} style={{ width: 'auto' }}>{d.creators.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <button className="btn primary" onClick={async () => { const id = await newSubscriber(subCreator); if (id) setLeft(id); }}>Simulate new subscriber</button>
        </div>
        {!d.autopilot && <div className="notice">Autopilot is paused. Turn it on in the Inbox to see replies.</div>}
      </div>
      <div className="phones">
        <FanPhone d={d} cr={cr} fans={fans} fanId={left} setFanId={setLeft} autoReply={autoReply} buy={buy} rerender={rerender} />
        <FanPhone d={d} cr={cr} fans={fans} fanId={right} setFanId={setRight} autoReply={autoReply} buy={buy} rerender={rerender} />
      </div>
    </div>
  );
}

function FanPhone({ d, cr, fans, fanId, setFanId, autoReply, buy, rerender }) {
  const [text, setText] = useState('');
  const box = useRef(null);
  const f = d.fans.find((x) => x.id === fanId) || fans[0];
  const c = f && cr(f.creator);
  useEffect(() => { if (box.current) box.current.scrollTop = box.current.scrollHeight; });
  if (!f || !c) return null;
  const typing = d.typing[f.id] && d.typingShow[f.id];
  const expired = f.sub === 'expired';
  function send(e) {
    e.preventDefault();
    const v = text.trim(); if (!v) return;
    f.msgs.push({ from: 'fan', text: v, time: now() }); f.quietDays = 0;
    setText(''); rerender(); autoReply(f, 300);
  }
  const status = d.flagged[f.id] ? `Flagged for a human: ${d.flagged[f.id]}` : d.paused[f.id] ? 'A chatter took over this chat in the Inbox' : c.autopilot === false ? `Autopilot is off for ${c.name}` : '';
  return (
    <div className="phonewrap">
      <label className="label" htmlFor={`pf-${fanId}`}>Playing as</label>
      <select id={`pf-${fanId}`} value={f.id} onChange={(e) => setFanId(e.target.value)}>
        {d.creators.map((cc) => {
          const list = fans.filter((x) => x.creator === cc.id);
          return list.length ? <optgroup key={cc.id} label={`Fans of ${cc.name}`}>{list.map((x) => <option key={x.id} value={x.id}>{x.name} · {langName[x.lang]}{x.sub === 'expired' ? ' · expired' : ''}</option>)}</optgroup> : null;
        })}
      </select>
      <div className="phone">
        <div className="phead"><span className="av">{c.name[0]}</span><div><div className="name">{c.name}</div><span className="sub">{typing ? 'typing…' : 'online'}</span></div></div>
        {expired && (
          <div className="pexpired"><span>Your subscription expired</span>
            <button type="button" onClick={() => { f.sub = 'active'; rerender(); }} title="Demo: stands in for a real renewal">Renew</button></div>
        )}
        <div className="pmsgs" ref={box}>
          {f.msgs.map((m, i) => (
            <div key={i} className={`pb ${m.from === 'fan' ? 'mine' : 'hers'}`}>
              {m.text}
              {m.price > 0 && (
                <div className="plock">
                  <span>{m.bought ? '🔓' : '🔒'} {m.vaultTitle || 'Locked message'}</span>
                  {m.bought ? <span className="small">Unlocked</span> : <button type="button" onClick={() => buy(f, m)} disabled={expired}>Unlock {money(m.price)}</button>}
                </div>
              )}
            </div>
          ))}
          {typing && <div className="pb hers typingb"><span /><span /><span /></div>}
        </div>
        {status && <div className="pstatus">{status}</div>}
        <form className="pcompose" onSubmit={send}>
          <input aria-label={`Message ${c.name} as ${f.name}`} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Message ${c.name.split(' ')[0]}…`} />
          <button type="submit" className="btn primary sm" disabled={!text.trim()}>Send</button>
        </form>
      </div>
    </div>
  );
}

/* ---------------- Fan memory ---------------- */
function FanMemory({ fan, d, rerender }) {
  const [add, setAdd] = useState('');
  const mem = fan.memory || [];
  function save(e) {
    e.preventDefault();
    const v = add.trim(); if (!v) return;
    fan.memory = [...mem, { text: v, at: now() }]; setAdd(''); rerender();
  }
  return (
    <div className="sect">
      <span className="label">What the AI remembers · {mem.length}</span>
      {mem.length ? (
        <ul className="memlist">
          {mem.map((m, i) => (
            <li key={i}><span>{m.text}</span>
              <button className="iconbtn" aria-label={`Forget: ${m.text}`} title="Forget this" onClick={() => { fan.memory = mem.filter((_, j) => j !== i); rerender(); }}>×</button></li>
          ))}
        </ul>
      ) : <span className="small">Nothing yet. When {fan.name} mentions his hobbies, job, pets or plans, it shows up here.</span>}
      <form className="memadd" onSubmit={save}>
        <input aria-label="Add a fact" value={add} onChange={(e) => setAdd(e.target.value)} placeholder="Add a fact…" />
        <button className="btn sm" type="submit" disabled={!add.trim()}>Add</button>
      </form>
      <span className="small">Saved from the chat automatically. The AI won&apos;t ask about these again and brings them up naturally.</span>
    </div>
  );
}

/* ---------------- AI models: pick and compare ---------------- */
const SAMPLE_MSG = {
  EN: 'hey gorgeous, what are you up to tonight? 😍',
  IT: 'ciao bella, cosa fai stasera? 😍',
  FI: 'moi kaunis, mitä teet tänä iltana? 😍',
  EL: 'γεια σου κούκλα, τι κάνεις απόψε; 😍',
};
// Rough cost per 1,000 replies: ~2,700 tokens in and ~120 out per reply.
const per1k = (m) => (m && (m.in || m.out) ? `$${(m.in * 2.7 + m.out * 0.12).toFixed(2)} / 1k replies` : '');

function ModelsPage({ d, save, rerender, toast }) {
  const [list, setList] = useState({ suggested: [], defaults: {}, error: '' });
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState('EL');
  const [msg, setMsg] = useState(SAMPLE_MSG.EL);
  const [picked, setPicked] = useState([]);
  const [runs, setRuns] = useState([]);

  useEffect(() => {
    fetch('/api/models').then((r) => r.json()).then((r) => {
      setList({ suggested: r.suggested || [], defaults: r.defaults || {}, error: r.error || '' });
      setPicked((r.suggested || []).slice(0, 4).map((m) => m.id));
    }).catch(() => setList((l) => ({ ...l, error: "Couldn't load the model list. You can still type a model ID." }))).finally(() => setLoading(false));
  }, []);

  const byId = (id) => list.suggested.find((m) => m.id === id);
  const creatorFor = (l) => d.creators.find((c) => langsOf(c).includes(l)) || d.creators[0];
  const setModel = (l, id) => { d.models[l] = id; save(); rerender(); toast(id ? `${langName[l]} now uses ${id}` : `${langName[l]} uses the default model`); };
  const options = list.suggested;

  async function run() {
    const ids = [...new Set(picked)].slice(0, 4);
    if (!ids.length || !msg.trim()) return;
    const c = creatorFor(lang);
    const fanName = { EN: 'Jake', IT: 'Marco', FI: 'Mikko', EL: 'Nikos' }[lang];
    setRuns(ids.map((id) => ({ id, busy: true })));
    await Promise.all(ids.map(async (id, i) => {
      const t0 = Date.now();
      let out;
      try {
        const res = await fetch('/api/reply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          compare: true, model: id,
          fan: { id: 'compare', name: fanName, lang, creator: c.id, notes: '', tags: [], spend: 120, sub: 'active', memory: [] },
          creator: { name: c.name, langs: langsOf(c).includes(lang) ? langsOf(c) : [lang, ...langsOf(c)], tone: c.tone, content: c.content, limits: c.limits, examples: c.examples || '', vault: [] },
          scripts: [], history: [{ from: 'fan', text: msg.trim(), offer: false }],
        }) });
        const r = await res.json();
        out = r.type === 'ai' ? { id, text: r.text, cost: r.cost, ms: Date.now() - t0, mock: r.mock, used: r.model }
          : { id, error: r.type === 'flag' ? `Blocked by a safety check: ${r.flag}` : r.error || 'No reply' };
      } catch { out = { id, error: 'Could not reach the server' }; }
      setRuns((prev) => prev.map((x, j) => (j === i ? out : x)));
    }));
  }

  const langs = ['EN', 'IT', 'FI', 'EL'];
  return (
    <div className="pagein">
      <div className="pagehead">
        <div><p className="eyebrow">Admin</p><h1 className="ptitle">AI models</h1>
          <p className="lede">Pick which AI writes each language, and test models side by side on the same message before switching. Only hand-picked models that allow adult chat are listed. Changes apply to the next reply.</p></div>
      </div>
      {list.error && <div className="notice">{list.error}</div>}

      <div className="card">
        <h3>Model per language</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {langs.map((l) => {
            const cur = d.models[l] || '';
            const inList = !cur || options.some((m) => m.id === cur);
            return (
              <div key={l} className="field">
                <label className="label" htmlFor={`m-${l}`}>{langName[l]}</label>
                <select id={`m-${l}`} value={cur} onChange={(e) => setModel(l, e.target.value)}>
                  <option value="">Default · {list.defaults[l] || 'from .env.local'}</option>
                  {options.map((m) => <option key={m.id} value={m.id}>{m.family} · {m.id}</option>)}
                  {!inList && <option value={cur}>{cur}</option>}
                </select>
                <span className="hint">{[byId(cur)?.note, per1k(byId(cur || list.defaults[l]))].filter(Boolean).join(' · ')}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h3>Compare models</h3>
        <span className="small">Send the same fan message to up to 4 models at once and read the replies side by side. Each test uses a little AI credit.</span>
        <div className="seg" role="group" aria-label="Language to test" style={{ maxWidth: 420 }}>
          {langs.map((l) => <button key={l} aria-pressed={lang === l} onClick={() => { setLang(l); setMsg(SAMPLE_MSG[l]); setRuns([]); }}>{langName[l]}</button>)}
        </div>
        <div className="field"><label className="label" htmlFor="cmp-msg">Fan message · to {creatorFor(lang)?.name}</label>
          <textarea id="cmp-msg" rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} /></div>
        <div className="field"><span className="label">Models to test · {picked.length}/4</span>
          <div className="tags">
            {loading && <span className="small">Loading models…</span>}
            {options.map((m) => {
              const on = picked.includes(m.id);
              return <button key={m.id} className={`tag ${on ? 'fill' : ''}`} aria-pressed={on} title={m.note} style={{ cursor: 'pointer' }}
                onClick={() => setPicked(on ? picked.filter((x) => x !== m.id) : picked.length < 4 ? [...picked, m.id] : picked)}>{m.family}</button>;
            })}
          </div>
          <span className="hint">Tip: also test an explicit fan message. A model that refuses is not the one.</span>
        </div>
        <div><button className="btn primary" disabled={!picked.length || !msg.trim() || runs.some((r) => r.busy)} onClick={run}>{runs.some((r) => r.busy) ? 'Asking the models…' : 'Compare replies'}</button></div>
        {runs.length > 0 && (
          <div className="grid">
            {runs.map((r) => (
              <div key={r.id} className="card" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
                <span className="label" style={{ textTransform: 'none', letterSpacing: 0 }}>{byId(r.id)?.family || r.id}</span>
                {r.busy && <span className="small">Writing…</span>}
                {r.text && <div className="b me" style={{ maxWidth: '100%', alignSelf: 'stretch', whiteSpace: 'pre-wrap' }}>{r.text}</div>}
                {r.error && <div className="notice">{r.error}</div>}
                {r.text && <span className="small">{(r.ms / 1000).toFixed(1)}s{r.cost ? ` · $${r.cost.toFixed(4)}` : ''}{r.mock ? ' · sample reply (no API key)' : ''}</span>}
                {r.text && <div><button className="btn sm" onClick={() => setModel(lang, r.id)}>{d.models[lang] === r.id ? `In use for ${langName[lang]}` : `Use for ${langName[lang]}`}</button></div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
