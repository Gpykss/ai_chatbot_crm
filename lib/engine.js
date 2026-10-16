import { langName } from './data';

// Messages autopilot must never answer by itself. The chat is paused and flagged for a person.
const guard = [
  [/\b(i'?m|i am|age|aged|ho|olen|είμαι)\s*1[0-7]\b|under ?18|underage|high ?school|minorenne|alaikäinen|ανήλικ/i, 'Fan may be under 18'],
  [/refund|chargeback|scam|rimborso|hyvitys/i, 'Refund or payment dispute'],
  [/kill myself|want to die|end it all|suicid/i, 'Fan may be in distress'],
  [/are you (a )?(bot|ai|real)|is this (a )?bot|sei un bot|oletko botti|είσαι bot/i, 'Asks if he is talking to a bot'],
];

// Meetup requests are answered by the AI (see MEET_RULES), not paused.
const MEET_ASK = /\bmeet\b|\bmeet ?up\b|\birl\b|in person|real life|where do you live|your address|hang ?out|date with you|incontr|vederci|dove abiti|tavata|nähdä|missä asut|συναντ|να βρεθούμε|πού μένεις/i;
export const isMeetAsk = (text = '') => MEET_ASK.test(text);
export const countMeetAsks = (history = []) => history.filter((h) => h.from === 'fan' && isMeetAsk(h.text)).length;

export function checkGuard(text = '') {
  const hit = guard.find(([re]) => re.test(text));
  return hit ? hit[1] : null;
}

// Checks the AI's own reply before it goes out.
export function checkReply(text = '') {
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
const CONTENT_ASK = /\b(new|content|video|vid|pics?|photos?|show me|send me|see more|ppv)\b|nuov|foto|uusi|kuv|βίντεο|καινούρ|φωτογραφ/i;

// The AI may only sell when the fan asks for content, or after a few messages of flirting since the last offer.
export function canSellNow(history) {
  const last = history[history.length - 1]?.text || '';
  if (CONTENT_ASK.test(last)) return true;
  let fanMsgs = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].from === 'me' && history[i].offer) break;
    if (history[i].from === 'fan') fanMsgs++;
  }
  return fanMsgs >= 5;
}

function meetRules(name, times) {
  return [
    `${name} is asking to meet you in person.${times > 1 ? ` He has asked ${times} times now, so do not repeat what you said before.` : ''} You never meet fans.`,
    '- Do not say yes, maybe, someday, or "if you keep supporting me". Do not suggest a meeting could happen later, and never give a city, place, date or contact.',
    '- Do not make him feel rejected either. Be warm and playful: take it as a compliment, say this chat is where you get to be most yourself with him, then pull him closer here with a personal question or a tease.',
    times > 1 ? '- He clearly wants more closeness. Give him more of it in the chat: be more personal and affectionate than before, and make him feel like one of your favorite people to talk to.' : '',
    '- Do not sell anything in this reply.',
  ].filter(Boolean).join('\n');
}

// How real people text in each language, so replies read native, not translated.
export const NATIVE = {
  IT: 'Italian: everyday texting Italian with informal "tu" (amore, tesoro, dai, ahah, boh, vabbè). Short, warm, a bit cheeky. No formal or textbook phrasing.',
  FI: 'Finnish: spoken Finnish (puhekieli) as people text it: mä, sä, oon, tuut, mitä teet, kiva, ihana, haha. Short sentences. Never stiff written Finnish (kirjakieli).',
  EL: 'Greek: casual spoken Greek in Greek letters, as a young Greek woman texts (μωρό μου, τι κάνεις;, χαχα, έλα, αχ, ρε). Use ";" for questions. Natural word order, no formal or old-fashioned forms, never word-for-word from English.',
};
export function nativeRule(lang) {
  if (!NATIVE[lang]) return '';
  return `- When you write in ${langName[lang]}, write like a native speaker texting, not like a translation. Think directly in ${langName[lang]}; never translate an English sentence in your head. ${NATIVE[lang]}`;
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
    `Hard limits: ${creator.limits}`,
    creator.examples ? `Examples of how you text (copy this style, not the exact words):\n${creator.examples}` : '',
    canSell ? vaultBlock(creator.vault) : 'Do not sell or mention any content in this reply. Just chat and build the connection.',
    `What you know about ${fan.name}: ${fan.notes || 'nothing yet'}. Tags: ${(fan.tags || []).join(', ') || 'none'}. Lifetime spend: $${fan.spend}.`,
    fan.memory?.length ? `Things ${fan.name} has told you before (you remember these):\n${fan.memory.map((x) => `- ${x}`).join('\n')}\nNever ask him about these again as if you didn't know. Bring them up naturally now and then, like someone who remembers (ask how the thing went, tease him about it).` : '',
    'Rules:',
    `- You speak ${langs.map((l) => langName[l]).join(', ')}. Reply in the language of ${fan.name}'s last message if it is one of these; otherwise reply in ${langName[langs[0]]}.`,
    '- Keep replies short, like real texting: 1 to 3 sentences.',
    nativeRule(fan.lang),
    '- Match his energy. Never start explicit talk with a new or quiet fan; build up first.',
    '- Never invent or promise content that is not in your vault. Do not say you are filming or about to film something.',
    canSell ? '- If it fits the moment, offer ONE vault item: tease it in a few words of your own, in his language, based on its description. Never copy the description or the title word for word. Then end your message with [OFFER:item-id].' : '',
    '- If nothing in the vault fits what he wants, offer a custom instead, using the prices in "What you sell".',
    '- Never agree to meet. Never share a location, phone number or other social accounts.',
    '- Never discuss anyone under 18, non-consent, or anything illegal. If it comes up, change the subject.',
    '- Write only the message itself, with no notes or quotation marks.',
    meet ? meetRules(fan.name, countMeetAsks(history)) : '',
    fan.sub === 'expired' ? `${fan.name}'s subscription has expired, so he cannot open locked content. Never offer or tease paid content. Keep it warm and personal. Now and then (not every message), say you miss him and invite him to renew so he can see what you've been posting. If he asks for content, tell him it's waiting for him when he renews.` : '',
  ].filter(Boolean).join('\n');
  const msgs = history.slice(-20).map((h) => ({ role: h.from === 'fan' ? 'user' : 'assistant', content: h.text }));
  return [{ role: 'system', content: system }, ...msgs];
}

function vaultBlock(vault) {
  if (!Array.isArray(vault) || !vault.length) return 'Your vault is empty right now. Do not offer any ready-made content; offer a custom instead.';
  const lines = vault.slice(0, 12).map((x) => `- [${x.id}] ${x.title} (${x.type}, $${x.price}, added ${x.added}): ${x.desc}`);
  return `Your vault, newest first. These are the only ready-made items you can sell:\n${lines.join('\n')}`;
}

// Pulls the [OFFER:id] tag out of the AI reply and checks the item is real.
export function extractOffer(text, vault = []) {
  const m = text.match(/\[OFFER:\s*([\w-]+)\s*\]/i);
  const clean = text.replace(/\[OFFER:[^\]]*\]/gi, '').replace(/\s+$/, '').trim();
  if (!m) return { text: clean, offer: null };
  const item = vault.find((x) => x.id === m[1]);
  return { text: clean, offer: item ? { id: item.id, title: item.title, type: item.type, price: Number(item.price) || 0 } : null };
}
