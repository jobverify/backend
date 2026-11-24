import { appendFile, mkdtemp, readFile, realpath, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const SHA256 = /^[a-f0-9]{64}$/;
const reasons = new Set(['narration_failed', 'render_failed', 'upload_failed', 'invalid_media', 'timeout', 'runner_failed']);
const artifacts = { video: ['video/mp4', 16 * 1024 * 1024], cover: ['image/jpeg', 2 * 1024 * 1024], subtitles: ['application/x-subrip', 64 * 1024] };
const failure = (reason, message) => Object.assign(new Error(message), { reason });

function checkedClaim(claim) {
  if (!claim || !/^[a-f0-9]{24}$/i.test(claim.postId) || !Number.isSafeInteger(claim.revision) || claim.revision < 0
    || !SHA256.test(claim.factsHash) || !SHA256.test(claim.planHash)
    || !['renderId', 'leaseToken'].every(key => typeof claim[key] === 'string' && /^[\w-]{1,512}$/.test(claim[key]))
    || !claim.facts || typeof claim.facts.title !== 'string' || typeof claim.facts.company !== 'string'
    || claim.plan?.templateVersion !== 'jobverify-reel-v6' || claim.plan.voice !== 'en-IN-NeerjaNeural'
    || typeof claim.plan.companyDomain !== 'string' || claim.plan.companyDomain.length > 253
    || !/^[a-f0-9]{24}$/i.test(claim.facts.id || '') || claim.plan.jobUrl !== `https://www.jobverify.in/jobs/${claim.facts.id}`
    || typeof claim.plan.script !== 'string' || !claim.plan.script.trim() || claim.plan.script.length > 450
    || !claim.plan.script.endsWith('Follow JobVerify.in for more jobs.')
    || claim.plan.width !== 1080 || claim.plan.height !== 1920 || claim.plan.fps !== 30
    || claim.plan.minDuration !== 15 || claim.plan.maxDuration !== 15 || claim.plan.ctaHold !== 3) {
    throw failure('invalid_media', 'Renderer API returned an invalid claim.');
  }
  return claim;
}

export async function renderWithPython(claim, directory, { signal, env = process.env } = {}) {
  const { writeFile } = await import('node:fs/promises');
  const claimFile = join(directory, 'claim.json');
  await writeFile(claimFile, JSON.stringify(claim), { mode: 0o600 });
  // No shell; source strings enter only the JSON file, never command or filter expressions.
  await new Promise((resolvePromise, reject) => {
    const child = spawn(env.SOCIAL_VIDEO_PYTHON || 'python', [join(scriptDirectory, 'social-video/render.py'), '--claim', claimFile, '--output', directory], {
      shell: false, stdio: ['ignore', 'ignore', 'pipe'], signal, timeout: 6 * 60_000, windowsHide: true, env,
    });
    let stderr = '';
    child.stderr.on('data', bytes => { stderr = (stderr + bytes.toString()).slice(-2000); });
    child.once('error', () => reject(failure(signal?.aborted ? 'timeout' : 'runner_failed', 'Video subprocess could not finish.')));
    child.once('exit', code => {
      if (code === 0) return resolvePromise();
      // Python emits only this bounded code; do not forward provider or subprocess text.
      const reason = /RENDER_FAILURE:(\w+)/.exec(stderr)?.[1];
      reject(failure(reasons.has(reason) ? reason : 'render_failed', 'Video subprocess failed.'));
    });
  });
  return JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8'));
}

async function artifactBytes(directory, artifact, kind) {
  if (!artifact || typeof artifact.path !== 'string' || isAbsolute(artifact.path) || !SHA256.test(artifact.hash)) throw failure('invalid_media', 'Invalid render manifest.');
  const path = await realpath(resolve(directory, artifact.path));
  const rel = relative(await realpath(directory), path);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) throw failure('invalid_media', 'Artifact is outside its render directory.');
  const info = await stat(path);
  if (!info.isFile() || info.size < 1 || info.size > artifacts[kind][1] || info.size !== artifact.size) throw failure('invalid_media', 'Artifact size is invalid.');
  const bytes = await readFile(path);
  if (createHash('sha256').update(bytes).digest('hex') !== artifact.hash) throw failure('invalid_media', 'Artifact hash changed.');
  return bytes;
}

export async function runVideoDrafts({ apiUrl = 'https://api.jobverify.in/api/social-video-drafts', env = process.env, fetcher = globalThis.fetch,
  render = renderWithPython, workRoot = tmpdir(), heartbeatMs = 45_000, maskToken = () => {}, now = Date.now } = {}) {
  const endpoint = new URL(apiUrl);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/api/social-video-drafts') throw new Error('Configure the HTTPS social video drafts endpoint.');
  const oidc = new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL || 'https://invalid/');
  if (oidc.protocol !== 'https:' || !oidc.hostname.endsWith('.actions.githubusercontent.com') || !env.ACTIONS_ID_TOKEN_REQUEST_TOKEN) throw new Error('Run inside the authorized GitHub Actions workflow.');
  oidc.searchParams.set('audience', endpoint.href);
  const deadline = now() + 18 * 60_000;
  const request = async (path, { method = 'POST', body = {}, headers = {}, signal } = {}) => {
    const identity = await fetcher(oidc, { headers: { Authorization: `Bearer ${env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}` }, redirect: 'error', signal: AbortSignal.timeout(15_000) });
    if (!identity.ok) throw new Error('GitHub renderer identity request failed.');
    const token = (await identity.json()).value;
    if (typeof token !== 'string' || !token || token.length > 20000 || /[\r\n]/.test(token)) throw new Error('Invalid GitHub renderer identity.');
    maskToken(token);
    const binary = Buffer.isBuffer(body);
    const response = await fetcher(new URL(endpoint.href + path), { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': binary ? headers['Content-Type'] : 'application/json', ...headers },
      body: binary ? body : JSON.stringify(body), redirect: 'error', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(binary ? 90_000 : 40_000)]) : AbortSignal.timeout(binary ? 90_000 : 40_000) });
    if (!response.ok) { await response.body?.cancel(); throw Object.assign(new Error(`Renderer API returned HTTP ${response.status}.`), { status: response.status }); }
    const payload = await response.json();
    if (payload?.success !== true || !payload.data || typeof payload.data !== 'object') throw new Error('Invalid renderer API response.');
    return payload.data;
  };
  const result = { rendered: 0, failed: 0, outcome: 'run_limit' };
  for (let index = 0; index < 2 && now() < deadline - 7 * 60_000; index++) {
    const next = await request('/claim');
    if (typeof next.done !== 'boolean') throw new Error('Invalid renderer claim response.');
    if (next.done) { result.outcome = /^[a-z_]{1,40}$/.test(next.reason) ? next.reason : 'no_work'; break; }
    const claim = checkedClaim(next.claim); maskToken(claim.leaseToken);
    const identity = { postId: claim.postId, renderId: claim.renderId, leaseToken: claim.leaseToken };
    const directory = await mkdtemp(join(workRoot, 'jobverify-reel-'));
    const controller = new AbortController(); let heartbeatPending = Promise.resolve(); let leaseLost = false;
    const heartbeat = setInterval(() => {
      heartbeatPending = heartbeatPending.then(async () => {
        if (controller.signal.aborted) return;
        try { await request('/heartbeat', { body: identity, signal: controller.signal }); }
        catch { leaseLost = true; controller.abort(failure('runner_failed', 'Render lease lost.')); }
      });
    }, heartbeatMs);
    const timeout = setTimeout(() => controller.abort(failure('timeout', 'Render time budget exceeded.')), 7 * 60_000);
    try {
      const manifest = await render(claim, directory, { signal: controller.signal, env });
      controller.signal.throwIfAborted(); const hashes = {};
      for (const kind of Object.keys(artifacts)) {
        const bytes = await artifactBytes(directory, manifest.artifacts?.[kind], kind);
        const stored = await request(`/${claim.postId}/assets/${kind}`, { method: 'PUT', body: bytes, signal: controller.signal,
          headers: { 'Content-Type': artifacts[kind][0], 'X-Social-Render-Id': claim.renderId, 'X-Social-Lease': claim.leaseToken, 'X-Social-Revision': String(claim.revision) } });
        if (stored.hash !== manifest.artifacts[kind].hash) throw failure('upload_failed', 'Uploaded artifact hash mismatch.');
        hashes[kind] = stored.hash;
      }
      controller.signal.throwIfAborted();
      await request('/complete', { body: { ...identity, revision: claim.revision, factsHash: claim.factsHash, planHash: claim.planHash, artifacts: hashes, versions: manifest.versions }, signal: controller.signal });
      result.rendered++;
    } catch (error) {
      result.failed++;
      if (!leaseLost) {
        const reason = reasons.has(error.reason) ? error.reason : controller.signal.aborted ? 'timeout' : 'runner_failed';
        try { await request('/fail', { body: { ...identity, reason, retryable: reason !== 'invalid_media' } }); } catch { /* Expired/fenced leases cannot change state; API owns recovery. */ }
      }
    } finally {
      clearInterval(heartbeat); clearTimeout(timeout); controller.abort(); await heartbeatPending;
      await rm(directory, { recursive: true, force: true });
    }
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await runVideoDrafts({ apiUrl: process.env.SOCIAL_VIDEO_DRAFTS_API_URL || undefined, maskToken: token => console.log(`::add-mask::${token}`) });
    const summary = `## Instagram video drafts\n\nPrepared: ${result.rendered}. Failed: ${result.failed}. Outcome: ${result.outcome}.\n\nEach prepared draft requires administrator approval.\n`;
    console.log(summary); if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
    if (result.failed) process.exitCode = 1;
  } catch { console.error('Instagram draft runner failed. Check draft generation records and workflow configuration.'); process.exitCode = 1; }
}
