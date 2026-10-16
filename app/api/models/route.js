import { NextResponse } from 'next/server';
import { pickModel } from '@/lib/engine';

// Hand-picked models for adult chat: none of these are run behind a content filter on OpenRouter,
// and each is strong in European languages or built for roleplay. Researched October 2026.
// Each entry lists the exact ID to prefer, plus a pattern to find a newer version in the live list.
// Any model OpenRouter marks as moderated is dropped automatically.
const CURATED = [
  { family: 'DeepSeek V4.1 Flash', ids: ['deepseek/deepseek-v4.1-flash'], re: /^deepseek\/deepseek-v[\d.]+-flash$/i, note: 'Most-used roleplay model on OpenRouter, no content filter, very cheap' },
  { family: 'DeepSeek V4 Pro', ids: ['deepseek/deepseek-v4-pro-0813'], re: /^deepseek\/deepseek-v[\d.]+-pro/i, note: 'Smarter DeepSeek, better in other languages, still cheap' },
  { family: 'Mistral Large', ids: ['mistralai/mistral-large-4-0'], re: /^mistralai\/mistral-large/i, note: 'Built in Europe, strong in Italian, Greek and Finnish, light content rules' },
  { family: 'Grok', ids: ['x-ai/grok-4.7'], re: /^x-ai\/grok-\d/i, note: 'Least filtered of the big AI labs, very natural tone' },
  { family: 'GLM 5.3 Flash', ids: ['z-ai/glm-5.3-flash'], re: /^z-ai\/glm-[\d.]+-flash$/i, note: 'Popular for roleplay, no content filter, cheap' },
  { family: 'MiniMax', ids: [], re: /^minimax\/minimax-.*her/i, note: 'Made for companion chat' },
  { family: 'Euryale 70B', ids: ['sao10k/l3.3-euryale-70b'], re: /euryale/i, note: 'Current model. Made for adult roleplay, but mostly English' },
];

let cache = { at: 0, models: null };

async function loadModels() {
  if (cache.models && Date.now() - cache.at < 3600_000) return cache.models;
  const res = await fetch('https://openrouter.ai/api/v1/models', { headers: { 'X-Title': 'Johns CRM' } });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const data = await res.json();
  const models = (data.data || []).filter((m) => m.id && !m.id.endsWith(':free')).map((m) => ({
    id: m.id, name: m.name || m.id, created: m.created || 0, moderated: !!m.top_provider?.is_moderated,
    in: Number(m.pricing?.prompt) * 1e6 || 0, out: Number(m.pricing?.completion) * 1e6 || 0,
  }));
  cache = { at: Date.now(), models };
  return models;
}

function pickCurated(models) {
  const out = [];
  for (const c of CURATED) {
    let m = c.ids.map((id) => models.find((x) => x.id === id)).find(Boolean);
    if (!m) m = models.filter((x) => c.re.test(x.id) && !x.id.startsWith('~')).sort((a, b) => b.created - a.created)[0];
    if (m && !m.moderated) out.push({ ...m, family: c.family, note: c.note });
  }
  return out;
}

export async function GET() {
  const defaults = Object.fromEntries(['EN', 'IT', 'FI', 'EL'].map((l) => [l, pickModel(l)]));
  try {
    const models = await loadModels();
    return NextResponse.json({ suggested: pickCurated(models), defaults });
  } catch (e) {
    // Offline: still show the hand-picked IDs, without prices.
    const suggested = CURATED.filter((c) => c.ids.length).map((c) => ({ id: c.ids[0], family: c.family, note: c.note, in: 0, out: 0 }));
    return NextResponse.json({ suggested, defaults, error: `Couldn't check OpenRouter's live list (${e.message}), so prices are missing.` });
  }
}
