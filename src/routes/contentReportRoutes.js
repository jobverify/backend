import express from 'express';
import { contentReportHandlers } from '../controllers/contentReportController.js';
import { createRateLimiter } from '../utils/rateLimit.js';

const router = express.Router();
router.post('/', createRateLimiter({ storePrefix: 'content-notices', windowMs: 60 * 60 * 1000, limit: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many reports from this connection. Retry later or email jobverify.in@gmail.com.' },
}), contentReportHandlers.submit);
// No public report-reading, updating or attachment endpoints.
export default router;
