import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { createRateLimiter } from '../utils/rateLimit.js';
import { MAX_RESUME_BYTES } from '../utils/resumeFile.js';
import { getResume, uploadResume, downloadResume, removeResume, prepareResume, baseResume } from '../controllers/resumeController.js';
import * as revisions from '../controllers/cvRevisionController.js';

const router = express.Router();
const uploadLimiter = createRateLimiter({ windowMs: 15 * 60_000, limit: 20,
  keyGenerator: req => String(req.user._id), standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many resume uploads. Please try again in 15 minutes.' },
});
const parseFile = express.raw({ type: 'application/octet-stream', limit: MAX_RESUME_BYTES, inflate: false });

router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.use(protect);
router.get('/', getResume);
router.get('/download', downloadResume);
router.get('/base', baseResume);
router.get('/base/download', baseResume);
router.get('/revisions', revisions.list);
router.get('/revisions/compare', revisions.compare);
router.get('/revisions/:revisionId/download', revisions.download);
router.post('/revisions/:revisionId/restore', uploadLimiter, revisions.restore);
router.post('/prepare', uploadLimiter, prepareResume);
router.delete('/', removeResume);
router.put('/', uploadLimiter, (req, res, next) => {
  if (!req.is('application/octet-stream')) return res.status(415).json({ success: false, message: 'Upload the resume as application/octet-stream.' });
  parseFile(req, res, error => {
    if (error) return res.status(error.status === 413 ? 413 : 400).json({ success: false, message: error.status === 413 ? 'Your resume must be 500 KB or smaller.' : 'Could not read the resume file.' });
    return next();
  });
}, uploadResume);

export default router;
