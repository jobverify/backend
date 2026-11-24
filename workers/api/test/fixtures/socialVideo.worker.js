import { restoreSocialAssetLength } from '../../adapters/socialAssets.js';
import { DurableObject } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import express from 'express';
import { validateReelCover } from '../../../../src/social/videoJpeg.js';
import { streamSocialAsset } from '../../../../src/social/assetStream.js';
const size = 4 * 1024 ** 2 + 97;
const asset = { key: 'social/runtime.mp4', hash: 'a'.repeat(64), size, type: 'video/mp4' };
export class SocialVideoRuntimeTest extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.env = env; }
  async fetch(request) {
    if (!this.ready) this.ready = this.initialize();
    await this.ready; return restoreSocialAssetLength(await this.handler.fetch(request), this.ctx);
  }
  async initialize() {
    const bytes = new Uint8Array(size); for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
    await this.env.MEDIA.put(asset.key, bytes);
    const app = express(); app.locals.socialAssetBridge = true;
    app.locals.socialAssets = { put: (...args) => this.env.MEDIA.put(...args), head: (...args) => this.env.MEDIA.head(...args), get: async (...args) => {
      const stored = await this.env.MEDIA.get(...args); if (!stored) return null;
      return { body: stored.body, size: stored.size, arrayBuffer() { throw new Error('Whole video buffering is forbidden'); } };
    } };
    app.put('/cover', express.raw({ type: 'image/jpeg', limit: '2mb' }), (req, res) => {
      try { res.json(validateReelCover(req.body, req.get('content-type'))); }
      catch { res.status(400).json({ invalid: true }); }
    });
    app.get('/movie', async (req, res, next) => { try { await streamSocialAsset(req, res, asset); } catch (error) { next(error); } });
    app.listen(3002); this.handler = httpServerHandler({ port: 3002 });
  }
}
export default { fetch(request, env) { return env.API.get(env.API.idFromName('test')).fetch(request); } };
