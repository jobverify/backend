import { MongoRateLimitStore } from '../utils/mongoRateLimitStore.js';
import { AssistantError } from './contract.js';

export function createAssistantQuota({
  minute = new MongoRateLimitStore({ prefix: 'assistant-minute', windowMs: 60_000 }),
  day = new MongoRateLimitStore({ prefix: 'assistant-day', windowMs: 86_400_000 }),
  now = Date.now,
} = {}) {
  return async owner => {
    try {
      for (const [store, limit, code] of [[minute, 5, 'assistant_minute_limit'], [day, 30, 'assistant_daily_limit']]) {
        const usage = await store.increment(String(owner));
        if (usage.totalHits > limit) {
          const seconds = Math.max(1, Math.ceil((usage.resetTime.getTime() - now()) / 1000));
          throw new AssistantError(429, code, code === 'assistant_daily_limit'
            ? 'You have used today’s thirty assistant turns. Please try again after the daily reset.'
            : 'Please wait before sending another question.', seconds);
        }
      }
    } catch (error) {
      if (error instanceof AssistantError) throw error;
      throw new AssistantError(503, 'assistant_quota_unavailable', 'The assistant is temporarily unavailable. Please try again shortly.', 30);
    }
  };
}
