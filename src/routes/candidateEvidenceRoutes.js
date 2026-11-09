import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { loadSiteSettings } from '../middleware/siteSettings.js';
import { createRateLimiter } from '../utils/rateLimit.js';
import { changeCandidateEvidence, readCandidateEvidence, readCandidateEvidenceMatches } from '../controllers/candidateEvidenceController.js';

const router = express.Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.use(protect);
const matchLimiter = createRateLimiter({ windowMs: 60_000, limit: 20, keyGenerator: req => String(req.user._id),
  standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Please wait a minute before finding more evidence matches.' } });
router.get('/', readCandidateEvidence);
router.get('/matches', matchLimiter, loadSiteSettings, readCandidateEvidenceMatches);
for (const collection of ['experiences', 'achievements']) {
  router.post(`/${collection}`, changeCandidateEvidence(collection, 'create'));
  router.put(`/${collection}/:id`, changeCandidateEvidence(collection, 'update'));
  router.delete(`/${collection}/:id`, changeCandidateEvidence(collection, 'delete'));
}
export default router;
