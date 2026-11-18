import { DurableObject } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import express from 'express';
import { pipeline } from 'node:stream/promises';
import { bindPipelineDownloads, createPipelineBundle, PIPELINE_FILE_PATH, pipelineFileResponse } from '../../adapters/pipelineDownload.js';

// Local-only upstream fixture: never contacts GitHub or the production DB.
const originalFetch = globalThis.fetch;
let upstreamOrigin;
let generatedBytes;
globalThis.fetch = async (url, options = {}) => {
  const parsed = new URL(url);
  if (parsed.hostname === 'api.github.com') {
    if (new Headers(options.headers).get('authorization') !== 'Bearer runtime-test-pat') throw new Error('Missing API authorization');
    return new Response(null, { status: 302, headers: { Location: 'https://storage.example/large.zip' } });
  }
  if (parsed.hostname === 'storage.example') {
    if (new Headers(options.headers).has('authorization')) throw new Error('Authorization forwarded to storage');
    if (upstreamOrigin === 'generated') {
      let remaining = generatedBytes;
      return new Response(new ReadableStream({ type: 'bytes', pull(controller) {
        if (!remaining) return controller.close();
        const size = Math.min(remaining, 65_536);
        remaining -= size;
        controller.enqueue(new Uint8Array(size).fill(120));
      } }));
    }
    try { return await originalFetch(upstreamOrigin, options); }
    catch (error) { console.error('Local download upstream error:', error.message); throw error; }
  }
  return originalFetch(url, options);
};

export class DownloadRuntimeTest extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    upstreamOrigin = env.DOWNLOAD_TEST_ORIGIN;
    generatedBytes = Number(env.DOWNLOAD_TEST_BYTES);
    bindPipelineDownloads(env.DOWNLOAD);
  }
  fetch(request) {
    const url = new URL(request.url);
    if (url.hostname === 'pipeline-download.internal' && url.pathname === PIPELINE_FILE_PATH) return pipelineFileResponse(request, { token: 'runtime-test-pat' });
    if (!this.handler) this.initialize();
    return this.handler.fetch(request);
  }
  initialize() {
    const app = express();
    app.get('/download', async (_req, res) => {
      let bundle;
      try {
        bundle = await createPipelineBundle({
          _id: '12345678-1234-1234-1234-123456789abc', target: 'github', repo: 'owner/repo', status: 'completed',
          stages: [{ key: 'rewrite', status: 'completed', githubRunId: 72 }],
        }, { token: 'runtime-test-pat', stage: 'rewrite', kind: 'logs' });
        res.attachment(bundle.filename).type('application/zip');
        await pipeline(bundle.stream, res);
      } catch {
        if (res.headersSent) res.destroy();
        else res.status(500).json({ error: 'Archive generation failed' });
      } finally { bundle?.stream.destroy(); await bundle?.cleanup(); }
    });
    app.listen(3001);
    this.handler = httpServerHandler({ port: 3001 });
  }
}

export default { fetch(request, env) {
  if (env.DOWNLOAD_TEST_KEY && request.headers.get('X-Jobverify-Test') !== env.DOWNLOAD_TEST_KEY) return new Response(null, { status: 404 });
  if (new URL(request.url).pathname === PIPELINE_FILE_PATH) return new Response(null, { status: 404 });
  return env.DOWNLOAD.get(env.DOWNLOAD.idFromName('test')).fetch(request);
} };
