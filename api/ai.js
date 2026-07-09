// Server-side Anthropic proxy — signed-in Supabase users don't need their own API key.
// Auth: Bearer <supabase access token>, verified against Supabase Auth before forwarding.

const SUPABASE_URL = 'https://bazjlrualnmbanmhiuau.supabase.co';
// Anon key is public by design (same value shipped in index.html)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhempscnVhbG5tYmFubWhpdWF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MTkyNDQsImV4cCI6MjA5MTA5NTI0NH0.R8f7yEhxVHIcjwSS3H1b3tLj5jpuRP1pR4jiyVFEbmE';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TOKENS_CAP = 4096;
const DEFAULT_MAX_TOKENS = 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return res.status(503).json({ error: 'AI proxy is not configured (ANTHROPIC_API_KEY missing)' });
  }

  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sign in required' });
  }

  try {
    const verifyRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: authHeader },
    });
    if (!verifyRes.ok) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
  } catch {
    return res.status(401).json({ error: 'Could not verify session' });
  }

  const { model, max_tokens, messages, system } = req.body || {};
  if (!model || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'model and messages are required' });
  }

  const payload = {
    model,
    max_tokens: Math.min(Number(max_tokens) || DEFAULT_MAX_TOKENS, MAX_TOKENS_CAP),
    messages,
  };
  if (system) payload.system = system;

  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });
    const data = await upstream.json().catch(() => ({ error: { message: 'Invalid response from Anthropic' } }));
    return res.status(upstream.status).json(data);
  } catch {
    return res.status(502).json({ error: 'Failed to reach Anthropic API' });
  }
}
