import { NextResponse } from 'next/server';
import { creators as defaultCreators, scripts as defaultScripts, mockReplies, normalizeScript } from '@/lib/data';
import { canSellNow, isYesToStory, isContentAsk, isMeetAsk, countMeetAsks, checkGuard, checkReply, matchScript, fillScript, pickModel, buildMessages, extractOffer } from '@/lib/engine';

const clip = (v, n) => String(v ?? '').slice(0, n);

// One autopilot step: safety check → script → AI.
// The dashboard sends the current persona and scripts, because the admin can edit them.
// In the full build these are read from the database instead.
export async function POST(req) {
  const body = await req.json();
  const { fan, history = [], usedScripts = [], mockIndex = 0, story = null, offered = [] } = body;
  if (fan) fan.memory = (Array.isArray(fan.memory) ? fan.memory : []).slice(-40).map((x) => clip(x, 120));

  const sent = body.creator;
  const base = defaultCreators.find((c) => c.id === fan?.creator);
  const creator = sent
    ? { meetPolicy: sent.meetPolicy === 'yes' ? 'yes' : 'no', meetAnswer: clip(sent.meetAnswer, 300).trim(), name: clip(sent.name, 80), langs: Array.isArray(sent.langs) ? sent.langs.filter((l) => ['EN', 'IT', 'FI', 'EL'].includes(l)) : [], tone: clip(sent.tone, 600), content: clip(sent.content, 600), limits: clip(sent.limits, 600), examples: clip(sent.examples, 2000),
        vault: (Array.isArray(sent.vault) ? sent.vault : []).slice(0, 30).map((x) => ({ id: clip(x.id, 40), title: clip(x.title, 80), type: clip(x.type, 40), price: Number(x.price) || 0, added: clip(x.added, 20), desc: clip(x.desc, 300) })) }
    : base;
  if (!creator) return NextResponse.json({ type: 'error', error: 'Unknown creator' }, { status: 400 });

  const scripts = (Array.isArray(body.scripts) ? body.scripts.slice(0, 500) : defaultScripts).map(normalizeScript);
  const last = history[history.length - 1]?.text || '';

  const flag = checkGuard(last);
  if (flag) return NextResponse.json({ type: 'flag', flag });

  // If the fan's message matches another script (for example he asks a price), answer that first.
  // That replaces any storyline in progress.
  // "compare" runs come from the AI models page: always the AI, never a script.
  const compare = body.compare === true;
  const match = compare || isMeetAsk(last) ? null : matchScript(last, fan, scripts, usedScripts);
  if (match) return stepReply(match.script, 0, fan, match.hit);

  // Otherwise a storyline in progress sends its next step.
  // A storyline goes on only if he says yes to it; otherwise the AI answers what he actually said
  // and the storyline ends (storyEnded tells the dashboard).
  let storyEnded = false;
  if (!compare && story?.scriptId) {
    const s = scripts.find((x) => x.id === story.scriptId && x.enabled !== false);
    const next = (Number(story.step) || 0) + 1;
    if (s && s.steps[next] && isYesToStory(last) && !(fan.sub === 'expired' && Number(s.steps[next].price) > 0)) return stepReply(s, next, fan);
    storyEnded = true;
  }

  // Items this fan already got offered or bought are left out, so he is not pitched the same thing twice.
  const fresh = (creator.vault || []).filter((x) => !offered.includes(x.id));
  const persona = { ...creator, vault: fresh };

  const expired = fan.sub === 'expired';
  const allowMeet = creator.meetPolicy === 'yes' && !!creator.meetAnswer;
  const canSell = !expired && canSellNow(history) && !isMeetAsk(last);
  const model = pickModel(fan.lang, body.model);
  const key = process.env.OPENROUTER_API_KEY;

  if (!key) {
    const pool = mockReplies[fan.lang] || mockReplies.EN;
    if (isMeetAsk(last) && allowMeet) {
      return NextResponse.json({ type: 'ai', storyEnded, mock: true, model, text: creator.meetAnswer, offer: null, tokensIn: 0, tokensOut: 0, cost: 0 });
    }
    if (isMeetAsk(last)) {
      const meetPool = mockMeet[fan.lang] || mockMeet.EN;
      return NextResponse.json({ type: 'ai', storyEnded, mock: true, model, text: fillScript(meetPool[(countMeetAsks(history) - 1) % meetPool.length], fan), offer: null, tokensIn: 0, tokensOut: 0, cost: 0 });
    }
    if (expired && isContentAsk(last)) {
      return NextResponse.json({ type: 'ai', storyEnded, mock: true, model, text: fillScript("I've been posting so much lately {name} 🙈 it's all waiting for you, renew and come see? I miss you here 💕", fan), offer: null, tokensIn: 0, tokensOut: 0, cost: 0 });
    }
    const wantsContent = isContentAsk(last);
    const item = wantsContent && canSell ? fresh[0] : null;
    const text = item ? `I just put up something you'll love {name}… ${item.title.toLowerCase()} 🙈` : pool[mockIndex % pool.length];
    return NextResponse.json({ type: 'ai', storyEnded, mock: true, model, text: fillScript(text, fan), offer: item ? { id: item.id, title: item.title, type: item.type, price: Number(item.price) || 0 } : null, tokensIn: 0, tokensOut: 0, cost: 0 });
  }

  // Backup models (MODEL_FALLBACKS in .env.local) are tried by OpenRouter if the main one is busy or down.
  const fallbacks = (process.env.MODEL_FALLBACKS || '').split(',').map((x) => x.trim()).filter(Boolean);
  const payload = {
    ...(fallbacks.length ? { models: [model, ...fallbacks.filter((x) => x !== model)].slice(0, 3) } : { model }),
    messages: buildMessages(persona, fan, history, { canSell }), max_tokens: 200, temperature: 0.9,
    usage: { include: true },
  };

  // Busy models answer 429. Wait and try again twice before giving up.
  // A reply that breaks a hard limit (agrees to meet, shares contact) is thrown away and written again.
  let data, text, offer, tokensIn = 0, tokensOut = 0, reportedCost = 0;
  for (let gen = 0; gen < 3; gen++) {
    let res;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Johns CRM' },
        body: JSON.stringify(payload),
      });
      if (res.status !== 429 && res.status < 500) break;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      const busy = res.status === 429 || res.status >= 500;
      const error = busy ? `AI model ${model} is busy` : `OpenRouter error ${res.status}: ${detail}`;
      return NextResponse.json({ type: 'error', busy, error }, { status: 502 });
    }

    data = await res.json();
    tokensIn += data.usage?.prompt_tokens || 0;
    tokensOut += data.usage?.completion_tokens || 0;
    reportedCost += Number(data.usage?.cost) || 0;
    const raw = data.choices?.[0]?.message?.content?.trim() || '';
    ({ text, offer } = extractOffer(raw, canSell ? fresh : []));
    if (text && !checkReply(text, { allowMeet: allowMeet && isMeetAsk(last) })) break;
    text = '';
  }
  if (!text) return NextResponse.json({ type: 'error', error: 'The AI could not write a safe reply' }, { status: 502 });

  const cost = reportedCost || (tokensIn * Number(process.env.PRICE_IN || 0.65) + tokensOut * Number(process.env.PRICE_OUT || 0.75)) / 1e6;

  return NextResponse.json({ type: 'ai', storyEnded, model: data.model || model, text, offer, tokensIn, tokensOut, cost });
}

// Demo replies to "can we meet?" when no OpenRouter key is set.
const mockMeet = {
  EN: ["Aww no babe, I don't meet fans in person 🙈 but I love that you want to… you get the real me right here 💕", "Still no meeting in person {name}, I promise it's not you 😘 nobody gets more of me than you do in here"],
  IT: ['No amore, non incontro i fan di persona 🙈 ma qui hai la vera me, sempre 💕'],
  FI: ['En valitettavasti tapaa faneja livenä {name} 🙈 mut täällä saat aidon mut 💕'],
  EL: ['Όχι μωρό μου, δεν συναντάω fans από κοντά 🙈 αλλά εδώ με έχεις όλη δική σου 💕'],
};

function stepReply(s, i, fan, hit) {
  const st = s.steps[i];
  return NextResponse.json({
    type: 'script', scriptId: s.id, name: s.name, hit, step: i, total: s.steps.length,
    label: st.label, price: Number(st.price) || 0, text: fillScript(st.text, fan),
  });
}
