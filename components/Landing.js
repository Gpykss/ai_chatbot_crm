'use client';

import { useEffect, useState } from 'react';

const CHATS = {
  EN: { fan: 'Jake', initial: 'J', creator: 'Bella Rae', langName: 'English', msgs: ['hey gorgeous 😍 just got off shift', 'long night? you deserve a treat 💕', 'any new videos?', "just posted one this morning… you're going to love it"] },
  IT: { fan: 'Marco', initial: 'M', creator: 'Sofia Conti', langName: 'Italian', msgs: ['ciao bella 😍 ho appena finito di lavorare', 'giornata lunga? ti meriti un premio 💕', 'hai qualche video nuovo?', 'ne ho appena pubblicato uno stamattina… ti piacerà da morire'] },
  FI: { fan: 'Mikko', initial: 'M', creator: 'Aino Virta', langName: 'Finnish', msgs: ['moi kaunis 😍 pääsin just töistä', 'pitkä päivä? ansaitset palkinnon 💕', 'onko uusia videoita?', 'julkaisin yhden just tänä aamuna… tuut tykkäämään'] },
  EL: { fan: 'Nikos', initial: 'N', creator: 'Eleni Mavri', langName: 'Greek', msgs: ['γεια σου κούκλα 😍 μόλις σχόλασα', 'κουραστική μέρα; σου αξίζει μια ανταμοιβή 💕', 'έχεις κανένα καινούριο βίντεο;', 'μόλις ανέβασα ένα σήμερα το πρωί… θα σου αρέσει πολύ'] },
};
const COUNTS = [1, 1, 2, 3, 3, 4, 4, 4, 4];
const TYPING = [false, true, false, false, true, false, false, false, false];
const MEM_LINES = ["I'm from Austin btw", 'I play guitar in a band', 'my dog Max says hi'];
const MEM_FACTS = ['From Austin', 'Plays guitar in a band', 'Has a dog named Max'];
const WORDS = ['Human-like typing', 'English · Italian · Finnish · Greek', 'Fan memory', 'Vault-only PPVs', 'Per-creator mass messages', 'Welcome for new subs', 'Expired-fan aware', 'Auto-reconnect', 'One-click takeover', 'Safety flags'];
const DAY = [
  ['08:12', 'A new subscriber gets her welcome.', 'He subscribed overnight. Her welcome message is waiting before he opens the app.'],
  ['11:40', 'A custom request gets a price.', 'He asks what a custom costs. Her script answers with her real prices, in Finnish.'],
  ['15:05', 'A PPV sells from the vault.', 'He asks for something new. She offers the video she posted this morning, and he unlocks it.'],
  ['19:30', 'One message reaches every fan.', 'Your team writes one mass message. Every fan gets it in his own language.'],
  ['23:58', 'A refund dispute pauses for a human.', 'The chat stops and your team is flagged, with the reason.', true],
  ['03:20', 'The fans in Athens get answers too.', 'Your team is asleep. She is not.'],
];
const FAQ = [
  ['Can my chatters still take over?', 'Yes. Any chat can be taken over with one click, and handed back to autopilot the same way. Turning autopilot off for a creator, or for everyone, is always one switch.'],
  ['Which languages does it speak?', 'English, Italian, Finnish and Greek today. Each fan is answered in the language he writes in, in the creator’s own tone.'],
  ['What if a fan asks to meet?', 'She never agrees and never shares a location or contact. She turns it down warmly and keeps him close in the chat.'],
  ['Will it sell content that doesn’t exist?', 'No. The AI can only offer items that are in the creator’s vault, at her prices. Anything else is blocked before it is sent.'],
  ['How long does setup take?', '[Setup time]. Each creator signs in once; then you set her voice, prices and scripts.'],
];
const money = (v) => '$' + Math.round(v).toLocaleString('en-US');

export default function Landing() {
  const [lang, setLang] = useState('EN');
  const [step, setStep] = useState(0);
  const [autoOn, setAutoOn] = useState(true);
  const [mem, setMem] = useState(0);
  const [n, setN] = useState(20);
  const [open, setOpen] = useState(0);

  useEffect(() => {
    if (!autoOn) return undefined;
    const t = setInterval(() => setStep((s) => (s + 1) % COUNTS.length), 1500);
    return () => clearInterval(t);
  }, [autoOn]);

  const chat = CHATS[lang];
  const shown = chat.msgs.slice(0, COUNTS[step]);
  const typing = TYPING[step] && autoOn;

  const ofapi = n <= 5 ? 299 : 299 + (n - 5) * 29;
  const ai = n * 21.25;
  const railway = n <= 4 ? 10 : 20;
  const total = ofapi + ai + 25 + 20 + railway;

  return (
    <div className="l-root">
      <header className="l-head">
        <nav aria-label="Main" className="l-wrap l-nav">
          <a href="#top" className="l-brand"><span aria-hidden="true" className="l-logo">V</span><span>Velvet</span></a>
          <div className="l-links">
            <a href="#features">Features</a>
            <a href="#day">A day on autopilot</a>
            <a href="#cost">Cost</a>
            <a href="#faq">FAQ</a>
            <a href="/login" className="l-pill dark">Log in</a>
          </div>
        </nav>
      </header>

      <main id="top">
        <section className="l-wrap l-hero">
          <div aria-hidden="true" className="l-glow" style={{ top: 40, left: '50%', width: 720, height: 420, marginLeft: -360 }} />
          <p className="l-eyebrow l-in1">The AI chatter CRM for creator agencies</p>
          <h1 className="l-h1 l-in2">Your chatters never sleep.</h1>
          <p className="l-sub l-in3">Every fan gets a reply in the creator&apos;s voice, in his own language, around the clock. And she only ever sells what&apos;s really in her vault.</p>
          <div className="l-ctas l-in3">
            <a href="/login" className="l-pill blue">Try the live demo</a>
            <a href="#features" className="l-pill ghost">See what it does ›</a>
          </div>
        </section>

        <section aria-label="Live preview" className="l-wrap l-in4" style={{ paddingTop: 28, paddingBottom: 40 }}>
          <div className="l-win l-zoom">
            <div className="l-side">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '0 6px 12px' }}>
                <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Inbox</span>
                <button type="button" className="l-switch" aria-pressed={autoOn} onClick={() => setAutoOn((v) => !v)}>
                  <span className={`l-track ${autoOn ? 'on' : ''}`}><span className="l-knob" /></span>
                  <span>{autoOn ? 'Autopilot on' : 'Autopilot off'}</span>
                </button>
              </div>
              {Object.entries(CHATS).map(([code, c]) => (
                <div key={code} className={`l-row ${code === lang ? 'on' : ''}`}>
                  <span aria-hidden="true" className="l-av">{c.initial}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="l-row-name">{c.fan}</div>
                    <div className="l-row-prev">{code === lang && typing ? 'typing…' : c.msgs[2]}</div>
                  </div>
                  <span style={{ fontSize: 12, color: '#6e6e73' }}>{code}</span>
                </div>
              ))}
              <p style={{ margin: 'auto 6px 0', paddingTop: 14, fontSize: 12, color: '#6e6e73' }}>Try the switch: autopilot only stops when your team says so.</p>
            </div>
            <div className="l-main">
              <div className="l-chathead">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span aria-hidden="true" className="l-av" style={{ background: '#ececf0', border: 0 }}>{chat.initial}</span>
                  <div><div style={{ fontWeight: 600 }}>{chat.fan}</div><div style={{ fontSize: 13, color: '#6e6e73' }}>to {chat.creator} · {chat.langName}</div></div>
                </div>
                <div role="group" aria-label="Chat language" className="l-tabs">
                  {Object.keys(CHATS).map((code) => (
                    <button key={code} type="button" className="l-tab" aria-pressed={code === lang} onClick={() => { setLang(code); setStep(0); }}>{code}</button>
                  ))}
                </div>
              </div>
              <div className="l-msgs" aria-live="polite">
                {shown.map((text, i) => (i % 2 === 0
                  ? <div key={`${lang}${i}`} className="l-b fan l-pop">{text}</div>
                  : (
                    <div key={`${lang}${i}`} className="l-b her l-pop">
                      <span>{text}</span>
                      {i === 3 && <span className="l-ppv"><span>Shower set · Video · 4 min</span><span style={{ fontWeight: 600 }}>Locked · $25</span></span>}
                    </div>
                  )))}
                {typing && <div className="l-b her typing l-pop" aria-label="typing"><span className="l-dot" /><span className="l-dot" /><span className="l-dot" /></div>}
                {!autoOn && <div className="l-paused l-pop">Autopilot paused · your team is replying</div>}
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Highlights" className="l-marq">
          <div className="l-marq-track">
            {[...WORDS, ...WORDS].map((w, i) => <span key={i} className="l-chip" aria-hidden={i >= WORDS.length}>{w}</span>)}
          </div>
        </section>

        <section id="features" className="l-sec white">
          <div className="l-stack">
            <div className="l-center l-rv">
              <h2 className="l-h2">Everything a great chatter does. All night.</h2>
              <p className="l-lede">Built for agencies running many creators, in many languages, around the clock.</p>
            </div>
            <div className="l-grid">
              <article className="l-wide l-rv">
                <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#6cb4ff' }}>Human timing</p>
                  <h3>Types like a person.</h3>
                  <p>She reads, pauses, types and sends. Long answers arrive as two or three texts, the way people really chat. If he writes again mid-reply, she answers both.</p>
                </div>
                <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 8, fontSize: 15 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span className="l-tag">Seen · 2s</span><span className="l-tag">Typing · 3s</span><span className="l-tag">Split into 2</span>
                  </div>
                  <div className="l-darkb">heyy I was literally just thinking about you</div>
                  <div className="l-darkb">how did the gig go last night?</div>
                  <div className="l-darkb" aria-hidden="true" style={{ display: 'flex', gap: 5, padding: '14px 16px' }}><span className="l-dot" /><span className="l-dot" /><span className="l-dot" /></div>
                </div>
              </article>

              <article className="l-card l-rv l-lift">
                <h3>Remembers every fan.</h3>
                <p>His job, his city, his dog&apos;s name. Saved from the chat as he says it, so she never asks twice.</p>
                <div className="l-card-foot">
                  <div className="l-white" style={{ minHeight: 22 }}>
                    {mem > 0 ? <span key={mem} className="l-pop" style={{ display: 'block' }}><span style={{ color: '#6e6e73' }}>Jake: </span>{MEM_LINES[mem - 1]}</span> : <span style={{ color: '#6e6e73' }}>Send a message as Jake ↓</span>}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 40 }}>
                    {MEM_FACTS.slice(0, mem).map((f) => <span key={f} className="l-fact l-pop">✓ {f}</span>)}
                  </div>
                  <button type="button" className="l-btn" onClick={() => setMem((m) => (m >= 3 ? 0 : m + 1))}>{mem >= 3 ? 'Start over' : 'Send as Jake'}</button>
                </div>
              </article>

              <article className="l-card l-rv l-lift">
                <h3>Sells only what&apos;s real.</h3>
                <p>The AI offers PPVs straight from her vault, newest first, at her prices. No promises she can&apos;t keep, no refund requests.</p>
                <div className="l-card-foot">
                  <div className="l-vault"><span><span style={{ display: 'block', fontWeight: 600 }}>Shower set</span><span style={{ color: '#6e6e73', fontSize: 13 }}>Video · 4 min · posted today</span></span><span className="l-price">$25</span></div>
                  <div className="l-vault" style={{ opacity: 0.7 }}><span><span style={{ display: 'block', fontWeight: 600 }}>Gym set</span><span style={{ color: '#6e6e73', fontSize: 13 }}>Photos · 12 · last week</span></span><span className="l-price">$15</span></div>
                </div>
              </article>

              <article className="l-card l-rv l-lift">
                <h3>One message. Every fan.</h3>
                <p>Write it once in English. Each of her fans gets it in his own language, in her voice. Expired subscribers are left out of paid drops.</p>
                <div className="l-card-foot" style={{ gap: 8, fontSize: 14 }}>
                  <span className="l-white"><b>EN</b> · I just posted something new 👀</span>
                  <span className="l-white"><b>IT</b> · Ho appena pubblicato qualcosa di nuovo 👀</span>
                  <span className="l-white"><b>EL</b> · Μόλις ανέβασα κάτι καινούριο 👀</span>
                </div>
              </article>

              <article className="l-card l-rv l-lift"><h3>Greets every new sub first.</h3><p>The moment someone subscribes, she sends her welcome. Before he has even said hello.</p></article>
              <article className="l-card l-rv l-lift"><h3>Never stops.</h3><p>If the connection drops, autopilot waits and picks up again by itself. It only stops when your team turns it off.</p></article>
              <article className="l-card l-rv l-lift"><h3>Knows when to get a human.</h3><p>Refund disputes, a fan who may be underage or in distress: the chat pauses and your team is flagged.</p></article>
            </div>
          </div>
        </section>

        <section id="day" className="l-sec">
          <div className="l-stack" style={{ maxWidth: 880 }}>
            <div className="l-center l-rv">
              <h2 className="l-h2">A day on autopilot.</h2>
              <p className="l-lede">One creator, one day. Your team only steps in when it matters.</p>
            </div>
            <div className="l-day">
              <div aria-hidden="true" className="l-day-line l-draw" />
              <ol>
                {DAY.map(([time, title, body, warn]) => (
                  <li key={time} className="l-rv">
                    <span aria-hidden="true" className={`l-day-dot ${warn ? 'warn' : ''}`} />
                    <time>{time}</time>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="l-sec black">
          <div className="l-stack">
            <h2 className="l-h2 l-rv" style={{ textAlign: 'center', maxWidth: 'none' }}>Live in three steps.</h2>
            <ol className="l-steps">
              <li className="l-rv l-lift"><span className="num">1</span><h3>Connect her account.</h3><p>The creator signs in once. Her chats, fans and vault sync in.</p></li>
              <li className="l-rv l-lift"><span className="num">2</span><h3>Set her voice.</h3><p>Tone, limits, prices and scripts. A few example texts are enough.</p></li>
              <li className="l-rv l-lift"><span className="num">3</span><h3>Turn on autopilot.</h3><p>Watch every reply live, and take over any chat with one click.</p></li>
            </ol>
          </div>
        </section>

        <section id="cost" className="l-sec">
          <div className="l-calc-row">
            <div className="l-rv" style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p className="l-eyebrow">Running cost</p>
              <h2 className="l-h2">Know your bill before you start.</h2>
              <p style={{ margin: 0, fontSize: 19, lineHeight: 1.45, color: '#6e6e73' }}>Slide to your number of creators. The estimate covers the account connection, the AI, the database and hosting, at about 375 AI replies per creator per day.</p>
            </div>
            <div className="l-calc l-rv">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <label htmlFor="creators" style={{ fontSize: 17, fontWeight: 600 }}>Creators</label>
                <span className="l-num" style={{ fontSize: 40 }}>{n}</span>
              </div>
              <input id="creators" type="range" min="1" max="50" step="1" value={n} onChange={(e) => setN(Number(e.target.value) || 1)} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Account connection (OnlyFansAPI)', money(ofapi)],
                  ['AI replies, translation and memory', money(ai)],
                  ['Database (Supabase)', '$25'],
                  ['Dashboard hosting (Vercel)', '$20'],
                  ['Always-on worker (Railway)', money(railway)],
                ].map(([label, value]) => (
                  <div key={label} className="l-line"><span style={{ color: '#424245' }}>{label}</span><span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{value}</span></div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 17, fontWeight: 600 }}>Per month</span>
                <span className="l-num" style={{ fontSize: 44 }}>{money(total)}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#6e6e73' }}>About {money(total / n)} per creator. Estimate from public prices, October 2026. Paid directly to each provider.</p>
            </div>
          </div>
        </section>

        <section id="faq" className="l-sec white">
          <div className="l-faq">
            <h2 className="l-h2 l-rv" style={{ textAlign: 'center', maxWidth: 'none' }}>Questions.</h2>
            <div>
              {FAQ.map(([q, a], i) => (
                <div key={q} className="l-q l-rv">
                  <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                    <span>{q}</span><span aria-hidden="true" className="plus">+</span>
                  </button>
                  {open === i && <p className="l-pop">{a}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="demo" className="l-sec" style={{ position: 'relative', textAlign: 'center', overflow: 'hidden', paddingTop: 150, paddingBottom: 150 }}>
          <div aria-hidden="true" className="l-glow" style={{ top: '50%', left: '50%', width: 900, height: 520, margin: '-260px 0 0 -450px' }} />
          <div className="l-center l-rv" style={{ position: 'relative', gap: 22 }}>
            <h2 className="l-h2" style={{ fontSize: 'clamp(44px, 7vw, 88px)', maxWidth: '14ch' }}>See it run on your creators.</h2>
            <p className="l-lede" style={{ maxWidth: '36ch' }}>Log in to the live demo. Play the fan and watch the AI reply.</p>
            <div className="l-ctas">
              <a href="/login" className="l-pill blue">Try the live demo</a>
              <a href="mailto:[your email]" className="l-pill ghost">Book a call ›</a>
            </div>
          </div>
        </section>
      </main>

      <footer className="l-foot">
        <div><span>© 2026 Velvet. For verified 18+ creator agencies.</span><span>[your email] · [your X handle]</span></div>
      </footer>
    </div>
  );
}
