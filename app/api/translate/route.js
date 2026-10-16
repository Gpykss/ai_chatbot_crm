import { NextResponse } from 'next/server';
import { langName } from '@/lib/data';
import { pickModel } from '@/lib/engine';

const clip = (v, n) => String(v ?? '').slice(0, n);

// Rewrites one mass message into each fan language, in the creator's own voice.
// Body: { text, from: 'EN', to: ['IT','EL'], creator: { name, tone } }
// Returns: { versions: { IT: '...', EL: '...' }, mock?: true }
export async function POST(req) {
  const body = await req.json();
  const text = clip(body.text, 1500).trim();
  const from = langName[body.from] ? body.from : 'EN';
  const to = (Array.isArray(body.to) ? body.to : []).filter((l) => langName[l] && l !== from);
  if (!text || !to.length) return NextResponse.json({ versions: {} });

  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return NextResponse.json({ mock: true, versions: Object.fromEntries(to.map((l) => [l, text])) });

  const name = clip(body.creator?.name, 80) || 'the creator';
  const tone = clip(body.creator?.tone, 400);
  const fallbacks = (process.env.MODEL_FALLBACKS || '').split(',').map((x) => x.trim()).filter(Boolean);

  const one = async (lang) => {
    const model = pickModel(lang);
    const payload = {
      ...(fallbacks.length ? { models: [model, ...fallbacks.filter((x) => x !== model)].slice(0, 3) } : { model }),
      temperature: 0.4, max_tokens: 300,
      messages: [
        { role: 'system', content: [
          `You rewrite chat messages from ${name}, an adult content creator, for her fans who speak ${langName[lang]}.`,
          tone ? `Her voice: ${tone}` : '',
          `Rewrite the message in natural, casual ${langName[lang]}, the way a native speaker would text. Keep the meaning, flirtiness, emojis and length.`,
          'Keep the placeholder {name} exactly as it is. Do not add anything new.',
          'Write only the rewritten message, with no notes or quotation marks.',
        ].filter(Boolean).join('\n') },
        { role: 'user', content: text },
      ],
    };
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Johns CRM' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        let out = data.choices?.[0]?.message?.content?.trim().replace(/^["“]|["”]$/g, '') || '';
        if (out) return out;
      }
      if (res.status !== 429 && res.status < 500 && !res.ok) break;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
    throw new Error(langName[lang]);
  };

  const results = await Promise.allSettled(to.map(one));
  const versions = {}; const failed = [];
  results.forEach((r, i) => (r.status === 'fulfilled' ? (versions[to[i]] = r.value) : failed.push(langName[to[i]])));
  if (failed.length && !Object.keys(versions).length) {
    return NextResponse.json({ error: `Could not translate into ${failed.join(', ')}. The AI may be busy, try again in a minute.` }, { status: 502 });
  }
  return NextResponse.json({ versions, failed });
}
