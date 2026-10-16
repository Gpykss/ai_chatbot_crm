import { NextResponse } from 'next/server';
import { COOKIE, tokenFor, authEnabled } from '@/lib/auth';

export async function POST(req) {
  const { email = '', password = '' } = await req.json().catch(() => ({}));
  if (authEnabled()) {
    const wantEmail = (process.env.DEMO_EMAIL || '').trim().toLowerCase();
    const emailOk = !wantEmail || String(email).trim().toLowerCase() === wantEmail;
    if (!emailOk || password !== process.env.DEMO_PASSWORD) {
      await new Promise((r) => setTimeout(r, 600)); // slow down guessing
      return NextResponse.json({ error: 'That email or password isn’t right.' }, { status: 401 });
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await tokenFor(process.env.DEMO_PASSWORD || 'open'), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
