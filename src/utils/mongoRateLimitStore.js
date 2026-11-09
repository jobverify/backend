import { createHash } from 'node:crypto';
import RateLimitBucket from '../models/RateLimitBucket.js';

export class MongoRateLimitStore {
  localKeys = false;

  constructor({ prefix, windowMs = 60_000, model = RateLimitBucket, now = Date.now } = {}) {
    this.prefix = `jobverify:${prefix}:`;
    this.windowMs = windowMs;
    this.model = model;
    this.now = now;
  }

  init({ windowMs }) { this.windowMs = windowMs; }

  bucket(key) {
    const window = Math.floor(this.now() / this.windowMs);
    const id = createHash('sha256').update(`${this.prefix}${key}:${window}`).digest('hex');
    return { id, resetTime: new Date((window + 1) * this.windowMs) };
  }

  async increment(key) {
    const { id, resetTime } = this.bucket(key);
    const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt: resetTime } };
    try {
      let document;
      try {
        document = await this.model.findOneAndUpdate({ _id: id }, update, { upsert: true, new: true });
      } catch (error) {
        // Two replicas may create the first bucket concurrently. The unique _id
        // wins once; the other increment must still be counted atomically.
        if (error?.code !== 11000) throw error;
        document = await this.model.findOneAndUpdate({ _id: id }, update, { new: true });
      }
      if (!document || !Number.isSafeInteger(document.count)) throw new Error();
      return { totalHits: document.count, resetTime };
    } catch {
      throw Object.assign(new Error('Rate limit storage is temporarily unavailable.'), { status: 503 });
    }
  }

  async decrement(key) {
    const { id } = this.bucket(key);
    await this.model.updateOne({ _id: id, count: { $gt: 0 } }, { $inc: { count: -1 } });
  }

  async resetKey(key) {
    const { id } = this.bucket(key);
    await this.model.deleteOne({ _id: id });
  }
}
