import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { createRateLimiter } from '../utils/rateLimit.js';
import { listApplicationEvents, updateApplicationStage } from '../controllers/applicationStageController.js';

const router = express.Router();
const writes = createRateLimiter({ windowMs: 60000, limit: 30, message: 'Please wait before making more stage updates.' });
router.get('/applications/:applicationId/events', protect, listApplicationEvents);
router.put('/applications/:applicationId/stage', protect, writes, updateApplicationStage);
router.put('/applications/job/:jobId/stage', protect, writes, updateApplicationStage);
export default router;
