import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { verificationService } from '../jobVerification/service.js';

export function createVerificationRouter({ service = verificationService } = {}) {
  const router = express.Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(protect);
  const handle = action => async (req, res, next) => {
    try { await action(req, res); }
    catch (error) {
      if ([400, 403, 404, 409, 422, 429, 503].includes(error.status)) {
        if (error.status === 429) res.set('Retry-After', String(Math.max(1, Math.ceil((86_400_000 - Date.now() % 86_400_000) / 1000))));
        return res.status(error.status).json({ success: false, error: error.code || 'verification_unavailable', message: error.message });
      }
      // Driver diagnostics can include private report filters. Do not forward them.
      next(Object.assign(new Error('Job verification is temporarily unavailable.'), { status: 503 }));
    }
  };
  router.post('/', handle(async (req, res) => res.status(202).json({ success: true, data: await service.submit(req.user._id, req.body) })));
  router.get('/', handle(async (req, res) => res.json({ success: true, data: await service.list(req.user._id, req.query) })));
  router.get('/:id', handle(async (req, res) => res.json({ success: true, data: await service.get(req.user._id, req.params.id) })));
  router.delete('/:id', handle(async (req, res) => { await service.remove(req.user._id, req.params.id); res.json({ success: true }); }));
  return router;
}
export default createVerificationRouter();
