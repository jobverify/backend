import { Readable } from 'node:stream';
import { ZipWriter } from '@zip.js/zip.js/index-native.js';
import { STAGES, isTerminal } from '../../../src/pipeline/policy.js';
import { unavailable } from './unavailable.js';

const failure = (message, status) => Object.assign(new Error(message), { status });
const safeName = value => String(value || 'artifact').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100);
let downloadNamespace;
export const bindPipelineDownloads = namespace => { downloadNamespace = namespace; };
export const PIPELINE_FILE_PATH = '/__jobverify_pipeline_file';
const githubHeaders = token => ({ Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Jobverify' });
const checkResponse = async response => {
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw failure(`GitHub returned ${response.status}; the file may be unavailable, expired or still being generated.`, 502);
  }
  return response;
};

// Called through a private Durable Object fetch once per file. Each file has its
// own invocation's subrequest allowance, so large sharded runs stay on Free.
export async function fetchGithubPipelineFile(repo, endpoint, { token, signal = new AbortController().signal } = {}) {
  if (!token || !/^[-\w.]+\/[-\w.]+$/.test(repo || '')) throw failure('GitHub access is not configured.', 503);
  if (!/^\/actions\/(?:runs\/\d+\/logs|artifacts\/\d+\/zip)$/.test(endpoint)) throw failure('Invalid pipeline download resource.', 400);
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(300_000)]);
  let response = await fetch(`https://api.github.com/repos/${repo}${endpoint}`, {
    headers: githubHeaders(token), redirect: 'manual', signal: requestSignal,
  });
  if (response.status === 302) {
    let location;
    try { location = new URL(response.headers.get('location')); } catch { /* reject a missing/invalid URL below */ }
    await response.body?.cancel();
    if (!location || location.protocol !== 'https:' || location.username || location.password) throw failure('Invalid GitHub download redirect.', 502);
    // Never send the PAT to the signed storage URL or follow further redirects.
    response = await fetch(location.href, { signal: requestSignal, redirect: 'manual' });
  }
  await checkResponse(response);
  return response.body;
}

export async function pipelineFileResponse(request, { token } = {}) {
  try {
    const url = new URL(request.url);
    const body = await fetchGithubPipelineFile(url.searchParams.get('repo'), url.searchParams.get('endpoint'), { token, signal: request.signal });
    return new Response(body, { headers: { 'Content-Type': 'application/zip', 'Cache-Control': 'no-store' } });
  } catch (error) {
    return Response.json({ message: error.status ? error.message : 'The GitHub file could not be downloaded.' }, { status: error.status || 502 });
  }
}
const redact = text => {
  let clean = String(text).replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, '[database redacted]')
    .replace(/https?:\/\/[^\s/@]+:[^\s/@]+@/gi, 'https://[credentials redacted]@')
    .replace(/(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)/g, '[token redacted]');
  for (const [key, value] of Object.entries(process.env)) {
    if (/TOKEN|SECRET|PASSWORD|MONGO_URI|GITHUB_PAT/.test(key) && value?.length > 5) clean = clean.split(value).join('[redacted]');
  }
  return clean;
};

// Stream nested GitHub ZIPs without temporary files or whole-archive buffers.
// Each lazy input starts only when the ZIP writer reaches it, keeping one download open
// and obtaining short-lived signed URLs immediately before they are consumed.
export async function createPipelineBundle(run, {
  token = process.env.GITHUB_PAT, signal = new AbortController().signal, kind = 'all', stage: requestedStage,
} = {}) {
  if (!['all', 'logs', 'artifacts'].includes(kind)) throw failure('Choose logs or artifacts for the download.', 400);
  if (requestedStage !== undefined && !STAGES.includes(requestedStage)) throw failure('Choose a valid pipeline stage for the download.', 400);
  if (run.target !== 'github') throw unavailable('Local pipeline archive downloads');
  if (!token || !/^[-\w.]+\/[-\w.]+$/.test(run.repo || '')) throw failure('GitHub access is not configured.', 503);
  signal.throwIfAborted();

  const controller = new AbortController();
  const activeSignal = AbortSignal.any([signal, controller.signal]);
  const files = [];
  const iterators = new Set();
  let remainingBytes = 2 * 1024 ** 3;
  // Leave headroom under the Free plan's per-request subrequest allowance.
  let remainingRequests = 45;
  let remainingFiles = 900;
  const request = async (url, options = {}) => {
    activeSignal.throwIfAborted();
    if (remainingRequests-- <= 0) throw failure('Archive metadata request limit reached. Download remaining files from GitHub Actions.', 413);
    return fetch(url, { ...options, signal: AbortSignal.any([activeSignal, AbortSignal.timeout(300_000)]) });
  };
  const github = endpoint => request(`https://api.github.com/repos/${run.repo}${endpoint}`, {
    redirect: 'manual', headers: githubHeaders(token),
  });
  const manifest = { pipelineId: run._id, kind, target: run.target, repo: run.repo, status: run.status,
    createdAt: new Date().toISOString(), snapshot: !isTerminal(run.status), stages: [] };
  let stream;
  const cleanup = () => {
    signal.removeEventListener('abort', disconnect);
    controller.abort();
    for (const iterator of iterators) void iterator.return?.().catch(() => {});
  };
  const disconnect = () => { stream.destroy(signal.reason); cleanup(); };
  const addFile = (name, generate) => files.push({ name, generate });
  const addDownload = (entry, name, endpoint) => addFile(name, async function* () {
    try {
      if (remainingFiles-- <= 0) throw failure('Archive file limit reached. Download remaining files from GitHub Actions.', 413);
      if (remainingBytes < 0) throw failure('Archive exceeds the 2 GiB download limit.', 413);
      activeSignal.throwIfAborted();
      let body;
      if (downloadNamespace) {
        const stub = downloadNamespace.get(downloadNamespace.idFromName('jobverify-pipeline-downloads'));
        const url = new URL(`https://pipeline-download.internal${PIPELINE_FILE_PATH}`);
        url.searchParams.set('repo', run.repo);
        url.searchParams.set('endpoint', endpoint);
        const result = await stub.fetch(new Request(url, { signal: activeSignal }));
        if (!result.ok) throw failure((await result.json()).message, result.status);
        body = result.body;
      } else body = await fetchGithubPipelineFile(run.repo, endpoint, { token, signal: activeSignal });
      const reader = body.getReader();
      try {
        while (true) {
          activeSignal.throwIfAborted();
          const { done, value } = await reader.read();
          if (done) break;
          remainingBytes -= value.byteLength;
          if (remainingBytes < 0) throw failure('Archive exceeds the 2 GiB download limit.', 413);
          yield Buffer.from(value);
        }
        activeSignal.throwIfAborted();
        entry.files.push(name);
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    } catch (error) {
      activeSignal.throwIfAborted();
      entry.unavailable.push({ file: name, reason: error.status ? error.message : 'File unavailable, expired, still being generated, or download failed.' });
    }
  });

  try {
    for (const key of requestedStage === undefined ? STAGES : [requestedStage]) {
      const stage = run.stages.find(value => value.key === key) || { key, status: 'unavailable' };
      const entry = { key, status: stage.status, githubRunId: stage.githubRunId, files: [], unavailable: [] };
      manifest.stages.push(entry);
      if (stage.githubRunId && /^\d+$/.test(String(stage.githubRunId))) {
        if (kind !== 'artifacts') addDownload(entry, `${key}/logs.zip`, `/actions/runs/${stage.githubRunId}/logs`);
        if (kind !== 'logs') try {
          for (let page = 1; ; page++) {
            const response = await checkResponse(await github(`/actions/runs/${stage.githubRunId}/artifacts?per_page=100&page=${page}`));
            const data = await response.json();
            for (const artifact of data.artifacts || []) {
              if (!/^\d+$/.test(String(artifact.id))) continue;
              const name = `${key}/artifacts/${artifact.id}-${safeName(artifact.name)}.zip`;
              if (artifact.expired) entry.unavailable.push({ file: name, reason: 'Artifact expired in GitHub.' });
              else addDownload(entry, name, `/actions/artifacts/${artifact.id}/zip`);
            }
            if ((data.artifacts || []).length < 100) break;
          }
        } catch (error) {
          activeSignal.throwIfAborted();
          entry.unavailable.push({ file: `${key}/artifacts`, reason: error.status ? error.message : 'Could not list GitHub artifacts.' });
        }
      } else entry.unavailable.push({ reason: 'No GitHub workflow run has been recorded for this stage.' });
      if (kind !== 'logs' && stage.summary) addFile(`${key}/stage-summary.json`, async function* () {
        yield Buffer.from(redact(JSON.stringify(stage.summary, null, 2)));
      });
    }
    // Serialize last, after every lazy file has updated its delivery status.
    addFile('manifest.json', async function* () { yield Buffer.from(JSON.stringify(manifest, null, 2)); });
    addFile('README.txt', async function* () {
      yield Buffer.from('Pipeline logs and artifacts\n\nSee manifest.json for included files and unavailable resources. Only files listed in a stage\'s files array completed successfully; failed downloads may leave empty or partial entries. GitHub downloads remain ZIPs inside each stage folder. Active runs are snapshots. Expired/deleted resources cannot be recovered. The archive has a 2 GiB and per-request download limit; additional files remain available in GitHub Actions.\n');
    });
    stream = Readable.from((async function* () {
      const output = new TransformStream();
      const reader = output.readable.getReader();
      const zip = new ZipWriter(output.writable, {
        level: 0, bufferedWrite: false, useWebWorkers: false, zip64: false,
        extendedTimestamp: false, dataDescriptorSignature: true,
      });
      const writing = (async () => {
        for (const file of files) {
          activeSignal.throwIfAborted();
          const iterator = file.generate();
          iterators.add(iterator);
          try {
            await zip.add(file.name, new ReadableStream({
              async pull(controller) {
                try {
                  const { value, done } = await iterator.next();
                  if (done) controller.close();
                  else controller.enqueue(value);
                } catch (error) { controller.error(error); }
              },
              async cancel() { await iterator.return?.(); },
            }, { highWaterMark: 0 }), { signal: activeSignal });
          } finally { iterators.delete(iterator); }
        }
        await zip.close();
      })().catch(async error => { await reader.cancel(error).catch(() => {}); throw error; });
      // Attach immediately; the reader below will rethrow any producer failure.
      void writing.catch(() => {});
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          yield Buffer.from(value);
        }
        await writing;
      } finally {
        controller.abort();
        await reader.cancel().catch(() => {});
        reader.releaseLock();
        await writing.catch(() => {});
      }
    })(), { objectMode: false, highWaterMark: 64 * 1024 });
    stream.once('close', cleanup);
    signal.addEventListener('abort', disconnect, { once: true });
    signal.throwIfAborted();
    return { filename: `${requestedStage === 'classification' ? 'classify' : requestedStage || 'pipeline'}${kind === 'all' ? '' : `-${kind}`}-${manifest.createdAt.replace(/[:.]/g, '-')}.zip`, stream, cleanup };
  } catch (error) { cleanup(); throw error; }
}
