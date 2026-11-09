import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { loadSiteSettings } from '../middleware/siteSettings.js';
import { createRateLimiter } from '../utils/rateLimit.js';
import { createAutoApplyAttempt, getAutoApplyAttempt, approveAutoApplyAttempt, cancelAutoApplyAttempt } from '../services/autoApplyService.js';

const router = express.Router();
router.use(protect, loadSiteSettings);
router.use(createRateLimiter({ windowMs: 60000, limit: 30, message: 'Please wait before making more application requests.' }));
const route = action => async (req, res) => {
  try { return res.json({ success: true, data: await action(req) }); }
  catch (error) { return res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Could not update this automated application.' }); }
};
router.get('/job/:jobId', route(req => getAutoApplyAttempt(req.user._id, req.params.jobId)));
router.post('/job/:jobId', route(req => createAutoApplyAttempt(req.user, req.params.jobId, { settings: req.siteSettings })));
router.put('/:id/approve', route(req => approveAutoApplyAttempt(req.user, req.params.id, req.body || {}, { settings: req.siteSettings })));
router.delete('/:id', route(req => cancelAutoApplyAttempt(req.user._id, req.params.id)));
export default router;
