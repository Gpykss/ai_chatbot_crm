// Demo login. If DEMO_PASSWORD is set (on Vercel), the CRM and its API need the login cookie.
// If it isn't set (on your own computer), everything stays open.
export const COOKIE = 'velvet_auth';

export async function tokenFor(password) {
  const data = new TextEncoder().encode(`velvet:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const authEnabled = () => !!process.env.DEMO_PASSWORD;
