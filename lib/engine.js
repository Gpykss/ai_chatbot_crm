import { langName } from './data';

// Messages autopilot must never answer by itself. The chat is paused and flagged for a person.
const guard = [
  [/\b(i'?m|i am|age|aged|ho|olen|είμαι)\s*1[0-7]\b|under ?18|underage|high ?school|minorenne|alaikäinen|ανήλικ/i, 'Fan may be under 18'],
  [/refund|chargeback|scam|rimborso|hyvitys/i, 'Refund or payment dispute'],
  [/kill myself|want to die|end it all|suicid/i, 'Fan may be in distress'],
  [/are you (a )?(bot|ai|real)|is this (a )?bot|sei un bot|oletko botti|είσαι bot/i, 'Asks if he is talking to a bot'],
];

// Meetup requests are answered by the AI (see MEET_RULES), not paused.
const MEET_ASK = /\bmeet\b|\bmeet ?up\b|\birl\b|in person|real life|close encounter|hook ?up|come over|your place|my place|see you (in person|for real)|telegram|whatsapp|snap ?chat|\bsnap\b|instagram|\binsta\b|add you|your number|phone number|τηλεφων|νουμερο|where do you live|your address|hang ?out|date with you|incontr|vederci|dove abiti|tavata|nähdä|missä asut|συναντ|να βρεθούμε|πού μένεις/i;
// Fans often type Greek without accents (βιντεακι, συναντηση), so every check also runs on an accent-free copy.
export const plain = (t = '') => String(t).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const hits = (re, t = '') => re.test(t) || re.test(plain(t));
export const isMeetAsk = (text = '') => hits(MEET_ASK, text);
export const countMeetAsks = (history = []) => history.filter((h) => h.from === 'fan' && isMeetAsk(h.text)).length;

export function checkGuard(text = '') {
  const hit = guard.find(([re]) => hits(re, text));
  return hit ? hit[1] : null;
}

// Checks the AI's own reply before it goes out.
export function checkReply(text = '', { allowMeet = false } = {}) {
  if (allowMeet) return /\b(my address|i live (in|at))\b/i.test(text) ? 'AI reply broke a hard limit' : null;
  if (/\b(see you (soon|there|then|tonight|tomorrow|irl|in person)|let'?s meet|we (can|could|will|should) meet|meet (you|up) (soon|someday|one day|sometime)|my address|i live in|my number|whatsapp|telegram|snapchat)\b/i.test(text)) return 'AI reply broke a hard limit';
  return null;
}

export const fillScript = (text, fan) => text.replaceAll('{name}', fan.name);

// Keyword match in the fan's language. Each script is sent to the same fan only once.
export function matchScript(text, fan, scripts, used = []) {
  const t = text.toLowerCase();
  for (const s of scripts) {
    if (s.enabled === false) continue;
    if (s.lang !== fan.lang) continue;
    if (s.creator !== 'all' && s.creator !== fan.creator) continue;
    if (used.includes(s.id)) continue;
    if (fan.sub === 'expired' && s.steps?.some((st) => Number(st.price) > 0)) continue; // he can't unlock paid messages, so no sales scripts
    const hit = s.triggers.find((k) => t.includes(k));
    if (hit) return { script: s, hit };
  }
  return null;
}

// A model picked on the dashboard's AI models page wins; otherwise .env.local decides.
export const validModel = (m) => (typeof m === 'string' && /^~?[\w.-]+\/[\w.:~-]+$/.test(m) && m.length < 120 ? m : null);
export function pickModel(lang, override) {
  return validModel(override) || process.env[`MODEL_${lang}`] || process.env.MODEL_DEFAULT || 'sao10k/l3.3-euryale-70b';
}

// Words that mean the fan is asking for content, in the four languages.
const CONTENT_ASK = /\b(new|content|video|vid|vids|pics?|photos?|nudes?|show me|send me|see more|ppv)\b|nuov|foto|uusi|kuv|βιντε|καινουρ|φωτο|γυμν|τσοντ|ταινι/i;
export const isContentAsk = (text = '') => hits(CONTENT_ASK, text);

// A storyline only moves to its next step when he says yes or asks to see it.
// Anything else (a question, a sexual message, a new topic) is answered by the AI instead.
const YES = /^[^\p{L}]*(y(es|ea|eah|ep|up|ess+)?|ok(ay)?|k|sure|of course|yes please|please|pls|send( it| me)?|show me|i want( it| to see)?|want( it| to see)?|go on|do it|si|certo|dai|va bene|mandami|fammi vedere|joo|juu|kylla|haluan( nahda)?|laheta|nayta|ναι( ρε)?|οκ|θελω( να το δω)?|στειλ(ε|τ[οα])( μου)?|δειξ(ε|τ[οα])( μου)?)(?=[^\p{L}]*$)/iu;
export const isYesToStory = (text = '') => {
  const t = String(text).trim();
  if (!t || isMeetAsk(t)) return false;
  // Short replies only: a long message is a real message the AI should answer.
  if (t.length <= 30 && (YES.test(plain(t)) || isContentAsk(t))) return true;
  if (t.length <= 60 && isContentAsk(t) && !/[?;]/.test(t)) return true;
  return t.length <= 12 && /^[\p{Extended_Pictographic}\s!.\u200d\ufe0f]+$/u.test(t); // just emojis, like 😍🔥
};

// The AI may only sell when the fan asks for content, or after a few messages of flirting since the last offer.
export function canSellNow(history) {
  const last = history[history.length - 1]?.text || '';
  if (isContentAsk(last)) return true;
  let fanMsgs = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].from === 'me' && history[i].offer) break;
    if (history[i].from === 'fan') fanMsgs++;
  }
  return fanMsgs >= 5;
}

// Meetups follow the creator's own setting (Creators page). Either way the AI answers the question directly.
function meetRules(name, times, policy, answer) {
  const again = times > 1 ? ` He has asked ${times} times now, so do not repeat your earlier wording.` : '';
  if (policy === 'yes' && answer) {
    return [
      `${name} is asking to meet you in person.${again} This overrides anything about meetups in your hard limits.`,
      `- Answer his question directly in your FIRST sentence, with this answer from the agency: "${answer}"`,
      '- Say it in your own words, in his language, but keep its meaning exactly, including any app, handle or next step it names.',
      '- Do not add dates, times, places or prices that are not in that answer. Do not sell anything in this reply.',
    ].join('\n');
  }
  return [
    `${name} is asking to meet you in person.${again}`,
    '- Answer his question directly in your FIRST sentence: no, you don\'t meet fans in person. Say it clearly and sweetly. Never dodge, never change the subject, never say maybe or someday.',
    '- Then at most one short warm line so he doesn\'t feel rejected. Never give a city, place, date or contact. Do not sell anything in this reply.',
  ].join('\n');
}

// How real people text in each language, so replies read native, not translated.
export const NATIVE = {
  IT: 'Italian: everyday texting Italian with informal "tu" (amore, tesoro, dai, ahah, boh, vabbè). Short, warm, a bit cheeky. No formal or textbook phrasing.',
  FI: 'Finnish: spoken Finnish (puhekieli) as people text it: mä, sä, oon, tuut, mitä teet, kiva, ihana, haha. Short sentences. Never stiff written Finnish (kirjakieli).',
  EL: 'Greek: casual spoken Greek in Greek letters, as a young Greek woman texts (μωρό μου, τι κάνεις;, χαχα, έλα, αχ, ρε). The Greek question mark ";" goes only at the end of a real question, never after a statement or an emoji. Natural word order, no formal or old-fashioned forms, never word-for-word from English.',
};
export function nativeRule(lang) {
  if (!NATIVE[lang]) return '';
  return `- When you write in ${langName[lang]}, write like a native speaker texting, not like a translation. Think directly in ${langName[lang]}; never translate an English sentence in your head. ${NATIVE[lang]}`;
}

// With meetups switched on, drop meetup and contact lines from the hard limits so they can't contradict it.
export function limitsFor(creator) {
  const lim = String(creator.limits || '');
  if (!(creator.meetPolicy === 'yes' && creator.meetAnswer)) return lim;
  const bad = /meet|social|telegram|whatsapp|snap|instagram|phone|number|contact/i;
  return lim.split(/\n/).map((line) => line.split(/(?<=[.!])\s+/).filter((x) => !bad.test(x)).join(' ')).filter((x) => x.trim()).join('\n') || 'none';
}

// Meetup and contact questions get their own small, focused request: the creator's setting decides
// yes or no every time, and the AI only words it in her voice and his language.
export function buildMeetMessages(creator, fan, history) {
  const last = history[history.length - 1]?.text || '';
  const langs = creator.langs?.length ? creator.langs : [fan.lang];
  const lang = langs.includes(fan.lang) ? fan.lang : langs[0];
  const yes = creator.meetPolicy === 'yes' && creator.meetAnswer;
  const before = history.filter((h) => h.from === 'me').slice(-3).map((h) => `- ${h.text}`).join('\n');
  const system = [
    `You are ${creator.name}, an adult content creator, texting a fan named ${fan.name}. Your voice: ${creator.tone || 'warm and flirty'}`,
    `He just wrote: "${last.slice(0, 400)}"`,
    yes
      ? `He is asking to meet you or how to reach you. Your answer is decided and must not change: "${creator.meetAnswer}". Give him exactly that answer, in your own words, in ${langName[lang]}. Keep every app, handle and next step it names. Add nothing that is not in it: no dates, places, prices, handles or numbers of your own.`
      : `He is asking to meet you or how to reach you outside this app. Your answer is decided and must not change: no. You don't meet fans in person and you only chat here. Say no clearly in your first words, sweetly, in ${langName[lang]}. Never say yes, maybe, someday or "we'll see", and never mention another app or contact.`,
    'Write 1 or 2 short sentences, like a real text message. Answer exactly what he asked. Write only the message.',
    nativeRule(lang),
    before ? `Your last messages to him, for context only. Don't copy their wording, and if any of them said something different, the answer above is the one that counts now:\n${before}` : '',
  ].filter(Boolean).join('\n');
  return [{ role: 'system', content: system }, { role: 'user', content: last }];
}

export function buildMessages(creator, fan, history, { canSell = true } = {}) {
  const lastText = history[history.length - 1]?.text || '';
  const meet = isMeetAsk(lastText);
  if (meet) canSell = false;
  const langs = creator.langs?.length ? creator.langs : [fan.lang];
  const system = [
    `You are ${creator.name}, an adult content creator chatting with a subscriber named ${fan.name} on your fan page. All users are verified adults (18+).`,
    `Your voice: ${creator.tone}`,
    `What you sell: ${creator.content}`,
    `Hard limits: ${limitsFor(creator)}`,
    creator.examples ? `Examples of how you text (copy this style, not the exact words):\n${creator.examples}` : '',
    canSell ? vaultBlock(creator.vault) : 'Do not offer any paid content in this reply. Just chat and build the connection.',
    canSell && isContentAsk(history[history.length - 1]?.text) ? `- He is asking for content. Never answer with a bare yes or no: tell him, in a teasing way, what you actually have that fits, from your vault, and offer it. If nothing fits or it breaks your hard limits, say so sweetly and offer what you do have or a custom.` : '',
    `What you know about ${fan.name}: ${fan.notes || 'nothing yet'}. Tags: ${(fan.tags || []).join(', ') || 'none'}. Lifetime spend: $${fan.spend}.`,
    fan.memory?.length ? `Things ${fan.name} has told you before (you remember these):\n${fan.memory.map((x) => `- ${x}`).join('\n')}\nNever ask him about these again as if you didn't know. Bring them up naturally now and then, like someone who remembers (ask how the thing went, tease him about it).` : '',
    'Rules:',
    `- You speak ${langs.map((l) => langName[l]).join(', ')}. Reply in the language of ${fan.name}'s last message if it is one of these; otherwise reply in ${langName[langs[0]]}.`,
    '- Keep replies short, like real texting: 1 to 3 sentences.',
    nativeRule(fan.lang),
    '- Match his energy. If he is sweet, be sweet. If he is explicit, you can be explicit back: he is a verified adult and this is an adult page.',
    '- Never invent or promise content that is not in your vault. Do not say you are filming or about to film something.',
    canSell ? '- If it fits the moment, offer ONE vault item: tease it in a few words of your own, in his language, based on its description. Never copy the description or the title word for word. Then end your message with [OFFER:item-id].' : '',
    '- If nothing in the vault fits what he wants, offer a custom instead, using the prices in "What you sell".',
    '- Always answer what he actually asked, directly, in your first sentence. Never dodge a question or change the subject.',
    creator.meetPolicy === 'yes' && creator.meetAnswer ? '- Never share your home address. For meetups, use only the agency\'s meetup answer.' : '- Never agree to meet. Never share a location, phone number or other social accounts.',
    '- Never discuss anyone under 18, non-consent, or anything illegal. If it comes up, change the subject.',
    '- Write only the message itself, with no notes or quotation marks.',
    meet ? meetRules(fan.name, countMeetAsks(history), creator.meetPolicy, creator.meetAnswer) : '',
    fan.sub === 'expired' ? `${fan.name}'s subscription has expired, so he cannot open locked content. Never offer or tease paid content. Keep it warm and personal. Now and then (not every message), say you miss him and invite him to renew so he can see what you've been posting. If he asks for content, tell him it's waiting for him when he renews.` : '',
  ].filter(Boolean).join('\n');
  const msgs = history.slice(-20).map((h) => ({ role: h.from === 'fan' ? 'user' : 'assistant', content: h.text }));
  // Last word before she writes: reply to THIS message, like a person in a live chat.
  const focus = [
    `Now reply to ${fan.name}'s last message: "${lastText.slice(0, 500)}"`,
    'React to exactly what he said, like a real person in a live chat. If he asked a question, your first sentence answers it plainly. If he said something sexual, respond to that specifically. Do not change the subject, do not give a vague or generic line, and do not answer with a question of your own instead of an answer.',
    meet ? (creator.meetPolicy === 'yes' && creator.meetAnswer ? `He is asking to meet: answer with the agency's meetup answer first.` : 'He is asking to meet: your first words say no, you don\'t meet fans in person.') : '',
  ].filter(Boolean).join('\n');
  return [{ role: 'system', content: system }, ...msgs, { role: 'system', content: focus }];
}

function vaultBlock(vault) {
  if (!Array.isArray(vault) || !vault.length) return 'Your vault is empty right now. Do not offer any ready-made content; offer a custom instead.';
  const lines = vault.slice(0, 12).map((x) => `- [${x.id}] ${x.title || 'Untitled'} (${x.type || 'content'}, $${x.price}, added ${x.added || 'recently'}): ${x.desc?.trim() || 'no description'}`);
  return `Your vault, newest first. These are the only ready-made items you can sell:\n${lines.join('\n')}\nFor an item with no description, tease it only by its type, length and how new it is (e.g. "a new 4 min video I just posted"); never invent what happens in it.`;
}

// Pulls the [OFFER:id] tag out of the AI reply and checks the item is real.
export function extractOffer(text, vault = []) {
  const m = text.match(/\[OFFER:\s*([\w-]+)\s*\]/i);
  const clean = text.replace(/\[OFFER:[^\]]*\]/gi, '').replace(/\s+$/, '').trim();
  if (!m) return { text: clean, offer: null };
  const item = vault.find((x) => x.id === m[1]);
  return { text: clean, offer: item ? { id: item.id, title: item.title, type: item.type, price: Number(item.price) || 0 } : null };
}
