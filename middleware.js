import { NextResponse } from 'next/server';
import { COOKIE, tokenFor } from '@/lib/auth';

// The landing page and login page are public. The CRM (/dashboard) and its AI endpoints need the demo login,
// but only when DEMO_PASSWORD is set, so local development stays open.
export async function middleware(req) {
  const pass = process.env.DEMO_PASSWORD;
  if (!pass) return NextResponse.next();
  const ok = req.cookies.get(COOKIE)?.value === (await tokenFor(pass));
  if (ok) return NextResponse.next();
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith('/api/')) return NextResponse.json({ type: 'error', error: 'Please log in again.' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/dashboard/:path*', '/api/reply', '/api/translate', '/api/memory', '/api/models'] };
