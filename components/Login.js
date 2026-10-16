'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function Login() {
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const r = await res.json();
      if (!res.ok) { setErr(r.error || 'Could not log in.'); setBusy(false); return; }
      const next = params.get('next');
      window.location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
    } catch {
      setErr('Could not reach the server. Try again.'); setBusy(false);
    }
  }

  return (
    <div className="lg-root">
      <div className="lg-top">
        <a href="/" className="l-brand"><span aria-hidden="true" className="l-logo">V</span><span>Velvet</span></a>
      </div>
      <main className="lg-center">
        <div aria-hidden="true" className="l-glow" style={{ top: '50%', left: '50%', width: 760, height: 520, margin: '-260px 0 0 -380px' }} />
        <form className="lg-card l-in2" onSubmit={submit}>
          <h1>Log in to the demo.</h1>
          <p className="hint">See the AI chatter run on four sample creators.</p>
          <div className="lg-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@agency.com" />
          </div>
          <div className="lg-field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {err && <p className="lg-err" role="alert">{err}</p>}
          <button type="submit" className="l-pill blue lg-submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
          <p className="lg-small">No login yet? <a href="mailto:[your email]">Ask for demo access</a></p>
        </form>
        <p className="lg-small" style={{ position: 'relative', marginTop: 24 }}><a href="/">‹ Back to the home page</a></p>
      </main>
    </div>
  );
}
