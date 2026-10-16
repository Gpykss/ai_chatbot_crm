import { NextResponse } from 'next/server';

const clip = (v, n) => String(v ?? '').slice(0, n);
const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').trim();

// Reads the fan's latest messages and pulls out new facts worth remembering
// (hobbies, job, city, pets, schedule, what he likes), so the AI never asks him twice.
// Body: { fan: { name }, known: ['...'], recent: [{ from, text }] }  →  { facts: ['...'] }
export async function POST(req) {
  const body = await req.json();
  const name = clip(body.fan?.name, 60) || 'the fan';
  const known = (Array.isArray(body.known) ? body.known : []).slice(0, 60).map((x) => clip(x, 120));
  const recent = (Array.isArray(body.recent) ? body.recent : []).slice(-10).map((m) => ({ from: m.from === 'fan' ? 'fan' : 'creator', text: clip(m.text, 600) }));
  if (!recent.some((m) => m.from === 'fan')) return NextResponse.json({ facts: [] });

  const key = process.env.OPENROUTER_API_KEY;
  let facts = key ? await askModel(key, name, known, recent).catch(() => null) : null;
  const mock = !key;
  if (!facts) facts = quickFacts(recent.filter((m) => m.from === 'fan').map((m) => m.text).join('. '));

  // Drop anything already known.
  const seen = new Set(known.map(norm));
  facts = facts.map((f) => clip(f, 120).trim()).filter((f) => f && !seen.has(norm(f)) && seen.add(norm(f)));
  return NextResponse.json({ facts: facts.slice(0, 5), mock });
}

async function askModel(key, name, known, recent) {
  const model = process.env.MODEL_MEMORY || process.env.MODEL_DEFAULT || 'sao10k/l3.3-euryale-70b';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Johns CRM' },
    body: JSON.stringify({
      model, temperature: 0.1, max_tokens: 200,
      messages: [
        { role: 'system', content: [
          `You keep notes on a subscriber named ${name} for a creator's chat team.`,
          'From the chat below, list NEW facts about him worth remembering in future chats: hobbies, job, city, pets, family, schedule, plans, important dates, favorite things, what content he likes.',
          'Only facts he said about himself. Skip greetings, small talk and anything already known.',
          'Write each fact in English, max 8 words, like "Plays guitar" or "Has a dog named Max".',
          'Answer with a JSON array of strings only, or [] if nothing new.',
          `Already known: ${known.length ? known.join('; ') : 'nothing'}`,
        ].join('\n') },
        { role: 'user', content: recent.map((m) => `${m.from === 'fan' ? name : 'Creator'}: ${m.text}`).join('\n') },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return [];
  const arr = JSON.parse(m[0]);
  return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
}

// Simple pattern matching, used when no OpenRouter key is set (demo mode) or the model fails.
function quickFacts(text) {
  const out = [];
  const cap = (s) => s.trim().replace(/\s+/g, ' ').replace(/^./, (c) => c.toUpperCase());
  const rules = [
    [/\bmy hobb(?:y|ies) (?:is|are)\s+([^.!?\n]{3,40})/gi, (x) => `Hobbies: ${x}`],
    [/\bi (?:really )?(?:love|like|enjoy)\s+((?:playing|watching|going|reading|cooking|fishing|hiking|gaming|working out|lifting|riding|traveling|travelling)[^.!?,\n]{0,30})/gi, (x) => `Likes ${x}`],
    [/\bi(?:'m| am) (?:really )?into\s+([^.!?,\n]{3,30})/gi, (x) => `Into ${x}`],
    [/\bi play\s+([^.!?,\n]{3,30})/gi, (x) => `Plays ${x}`],
    [/\bi(?:'m| am) from\s+([^.!?,\n]{2,30})/gi, (x) => `From ${x}`],
    [/\bi live in\s+([^.!?,\n]{2,30})/gi, (x) => `Lives in ${x}`],
    [/\bi work (as|at|in|for)\s+([^.!?,\n]{2,40})/gi, (a, x) => `Works ${a} ${x}`],
    [/\bi(?:'m| am) an? (nurse|teacher|engineer|driver|trucker|developer|programmer|student|doctor|cop|firefighter|mechanic|chef|electrician|plumber|soldier|pilot|lawyer|accountant)\b/gi, (x) => `Is a ${x}`],
    [/\bi have (?:a|an|two|three|2|3) ((?:dog|cat|puppy|kitten|son|daughter|kid|kids|boat|truck|bike|motorcycle)[^.!?,\n]{0,25})/gi, (x) => `Has a ${x}`],
    [/\bmy birthday is\s+([^.!?,\n]{2,25})/gi, (x) => `Birthday: ${x}`],
  ];
  for (const [re, fmt] of rules) for (const m of text.matchAll(re)) out.push(cap(fmt(...m.slice(1).map((s) => s.split(/\s+(?:and|but|so|because|too|lol|haha)\b/i)[0].trim()))));
  return out;
}
