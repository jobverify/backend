// Fail closed when a Node-only execution feature is accidentally enabled.
export function validateWorkerConfiguration(env) {
  for (const key of ['PIPELINE_LOCAL_ENABLED', 'JOB_VERIFICATION_ENABLED', 'AUTO_APPLY_ENABLED']) {
    if (env[key] !== 'false') throw new Error(`${key} must be false on the Cloudflare API.`);
  }
  for (const key of ['MONGO_URI', 'JWT_SECRET', 'CORS_ORIGIN', 'FRONTEND_ORIGIN', 'PUBLIC_API_ORIGIN', 'EMAIL_RELAY_URL', 'EMAIL_RELAY_SECRET', 'TURNSTILE_SECRET_KEY', 'TURNSTILE_ALLOWED_HOSTNAMES', 'TURNSTILE_EXPECTED_ACTION']) {
    if (!String(env[key] || '').trim()) throw new Error(`Missing required Worker configuration: ${key}`);
  }
  if (env.NODE_ENV !== 'production') throw new Error('The Cloudflare API requires NODE_ENV=production.');
  if (env.TRUST_PROXY !== '1') throw new Error('The Cloudflare API requires TRUST_PROXY=1.');
  if (String(env.JWT_SECRET).length < 32 || String(env.EMAIL_RELAY_SECRET).length < 32) throw new Error('Worker secrets must be at least 32 characters.');
  const relay = new URL(env.EMAIL_RELAY_URL);
  if (relay.protocol !== 'https:' || relay.username || relay.password || relay.search || relay.hash || relay.pathname !== '/') {
    throw new Error('EMAIL_RELAY_URL must be an HTTPS origin.');
  }
}

export function forwardClientRequest(request) {
  const headers = new Headers(request.headers);
  // Express sees one trusted internal hop, never the adapter's loopback IP or
  // a visitor-controlled forwarding chain.
  headers.delete('forwarded');
  headers.delete('x-real-ip');
  headers.delete('x-forwarded-host');
  headers.delete('x-forwarded-port');
  headers.set('x-forwarded-for', headers.get('cf-connecting-ip') || '0.0.0.0');
  headers.set('x-forwarded-proto', new URL(request.url).protocol.replace(':', ''));
  return new Request(request, { headers });
}
