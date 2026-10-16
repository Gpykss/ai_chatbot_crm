import { NextResponse } from 'next/server';
import { pickModel } from '@/lib/engine';

// Live model list from OpenRouter (public, no key needed), cached for an hour.
// "suggested" = the newest model of each family that is strong in European languages,
// picked from the live list so the names are always real.
let cache = { at: 0, models: null };

const FAMILIES = [
  ['Mistral Large', /^mistralai\/mistral-large/i, 'Strong in Italian and Greek, light content rules'],
  ['Mistral Medium', /^mistralai\/mistral-medium/i, 'Cheaper Mistral, good European languages'],
  ['DeepSeek', /^deepseek\/deepseek-(chat|v\d)/i, 'Cheap, very multilingual'],
  ['Grok', /^x-ai\/grok-\d/i, 'Natural, loose tone; permissive'],
  ['Qwen', /^qwen\/qwen[\d.]*-(max|plus|\d+b)/i, 'Very multilingual'],
  ['Llama', /^meta-llama\/llama-[\d.]+-\d+b-instruct/i, 'Open model, many hosts'],
  ['Euryale', /euryale/i, 'Current model; roleplay, mostly English'],
];

async function loadModels() {
  if (cache.models && Date.now() - cache.at < 3600_000) return cache.models;
  const res = await fetch('https://openrouter.ai/api/v1/models', { headers: { 'X-Title': 'Johns CRM' } });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const data = await res.json();
  const models = (data.data || [])
    .filter((m) => m.id && !m.id.endsWith(':free') && (m.architecture?.output_modalities || ['text']).includes('text'))
    .map((m) => ({
      id: m.id, name: m.name || m.id, created: m.created || 0,
      in: Number(m.pricing?.prompt) * 1e6 || 0, out: Number(m.pricing?.completion) * 1e6 || 0,
    }));
  cache = { at: Date.now(), models };
  return models;
}

export async function GET() {
  const defaults = Object.fromEntries(['EN', 'IT', 'FI', 'EL'].map((l) => [l, pickModel(l)]));
  try {
    const models = await loadModels();
    const suggested = [];
    for (const [family, re, note] of FAMILIES) {
      const best = models.filter((m) => re.test(m.id) && !m.id.startsWith('~')).sort((a, b) => b.created - a.created)[0];
      if (best) suggested.push({ ...best, family, note });
    }
    return NextResponse.json({ models, suggested, defaults });
  } catch (e) {
    return NextResponse.json({ models: [], suggested: [], defaults, error: `Couldn't load the model list (${e.message}). You can still type a model ID.` });
  }
}
