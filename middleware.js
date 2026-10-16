import { NextResponse } from 'next/server';

// Optional password for a hosted demo. Set DEMO_PASSWORD in the host's settings (any username works).
// Without DEMO_PASSWORD the app is open, which is fine on your own computer.
export function middleware(req) {
  const pass = process.env.DEMO_PASSWORD;
  if (!pass) return NextResponse.next();
  const [scheme, b64] = (req.headers.get('authorization') || '').split(' ');
  if (scheme === 'Basic' && b64) {
    try { if (atob(b64).split(':').slice(1).join(':') === pass) return NextResponse.next(); } catch {}
  }
  return new NextResponse('Password required', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="CRM demo"' } });
}

export const config = { matcher: '/((?!_next/static|_next/image|favicon.ico).*)' };
