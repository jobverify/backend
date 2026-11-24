import { appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function runPublisher({ apiUrl = 'https://api.jobverify.in/api/social-publisher/run', initialBatchId, env = process.env, fetcher = globalThis.fetch,
  now = Date.now, sleep = pause, maskToken = () => {} } = {}) {
  const endpoint = new URL(apiUrl);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/api/social-publisher/run') throw new Error('Configure the HTTPS social publisher endpoint.');
  const oidc = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL || 'https://invalid/');
  if (oidc.protocol !== 'https:' || !oidc.hostname.endsWith('.actions.githubusercontent.com') || !env.ACTIONS_ID_TOKEN_REQUEST_TOKEN) throw new Error('Run this command inside the authorized GitHub Actions workflow.');
  oidc.searchParams.set('audience', endpoint.href);
  const limit = now() + 11 * 60_000;
  let batchId = initialBatchId || undefined; let failures = 0;
  while (now() < limit) {
    let response;
    try {
      const identity = await fetcher(oidc, { headers: { Authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` }, redirect: 'error', signal: AbortSignal.timeout(15_000) });
      if (!identity.ok) throw new Error('GitHub identity request failed.');
      const token = (await identity.json()).value;
      if (typeof token !== 'string' || !token || token.length > 20000) throw new Error('GitHub identity request failed.');
      maskToken(token);
      response = await fetcher(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(batchId ? { batchId } : {}), redirect: 'error', signal: AbortSignal.timeout(40_000) });
    } catch {
      if (++failures > 3) throw new Error('Publisher connection failed; check the durable delivery records before recovery.');
      await sleep(Math.min(10_000, Math.max(0, limit - now()))); continue;
    }
    if ([429, 502, 503, 504].includes(response.status) && ++failures <= 3) {
      await response.body?.cancel(); await sleep(Math.min(10_000, Math.max(0, limit - now()))); continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Publisher API returned HTTP ${response.status}. Check its configuration and delivery records.`); }
    const payload = await response.json(); const result = payload.data;
    if (payload.success !== true || typeof result?.done !== 'boolean' || !Array.isArray(result.deliveries)) throw new Error('Publisher returned an invalid batch response.');
    failures = 0; batchId = result.batchId || batchId;
    if (result.done) return result;
    const deadline = Date.parse(result.deadline);
    if (!batchId || !Number.isFinite(deadline)) throw new Error('Publisher returned an invalid batch deadline.');
    if (now() >= Math.min(limit, deadline)) {
      // One final continuation lets the backend persist deadline failures.
      const error = new Error('Publishing batch exceeded its time budget. Check delivery records.'); error.result = result; throw error;
    }
    const pollAt = Date.parse(result.nextPollAt);
    await sleep(Math.min(60_000, Math.min(limit, deadline) - now(), Math.max(1000, (Number.isFinite(pollAt) ? pollAt : now() + 1000) - now())));
  }
  throw new Error('Publisher workflow time budget exhausted. Check the durable batch status.');
}

const clean = value => String(value ?? '').replace(/[^\w .:-]/g, '').slice(0, 100);
export function publisherSummary(result) {
  return `## Social publishing\n\nOutcome: ${clean(result.outcome)}\n\n| Platform | Status | Detail |\n| --- | --- | --- |\n${result.deliveries.map(row => `| ${clean(row.platform)} | ${clean(row.status)} | ${clean(row.reason)} |`).join('\n')}\n`;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await runPublisher({ apiUrl: process.env.SOCIAL_PUBLISHER_API_URL || undefined, initialBatchId: process.env.SOCIAL_BATCH_ID,
      maskToken: token => console.log(`::add-mask::${token}`) });
    const summary = publisherSummary(result); console.log(summary);
    if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
    if (['partial_failure', 'missed'].includes(result.outcome)) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
