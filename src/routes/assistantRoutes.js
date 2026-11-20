import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getSiteSettings } from '../services/siteSettingsService.js';
import { createAssistantService } from '../assistant/service.js';
import { createAssistantQuota } from '../assistant/quota.js';
import { AssistantError, modelFailure, validateAssistantInput } from '../assistant/contract.js';

export function createAssistantRouter({ model, service = createAssistantService({ model }),
  consumeQuota = createAssistantQuota() } = {}) {
  const router = express.Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(protect);
  router.get('/capabilities', (_req, res) => res.json({ success: true, data: service.capabilities() }));
  router.post('/messages', async (req, res) => {
    const controller = new AbortController();
    const abort = () => { if (!res.writableEnded) controller.abort(); };
    res.once('close', abort);
    try {
      if (!service.capabilities().enabled) throw new AssistantError(503, 'assistant_disabled', 'The assistant is not currently available.', 30);
      // Invalid requests never use an inference or an account turn.
      validateAssistantInput(req.body, req.assistantBodyBytes);
      const siteSettings = await getSiteSettings();
      await consumeQuota(req.user._id);
      const data = await service.ask(req.body, {
        user: req.user, siteSettings, signal: controller.signal, rawBytes: req.assistantBodyBytes,
      });
      if (!res.destroyed) res.json({ success: true, data });
    } catch (failure) {
      if (res.destroyed) return;
      const error = failure instanceof AssistantError ? failure : modelFailure(failure);
      if (error.retryAfterSeconds) res.set('Retry-After', String(error.retryAfterSeconds));
      res.status(error.status).json({ success: false, error: error.code,
        message: error.message, retryAfterSeconds: error.retryAfterSeconds });
    } finally {
      res.removeListener('close', abort);
    }
  });
  return router;
}
