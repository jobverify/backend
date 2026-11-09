import { Router } from 'express'
import { protect, authorize } from '../middleware/authMiddleware.js'
import { scrapeStatus } from '../controllers/scrapeController.js'
import { createRateLimiter } from "../utils/rateLimit.js";

const scrappeLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: {
        code: 429,
        success: false,
        message: 'Too many requests, please try again after 1 hour',
    },
});
const router = Router()

// GET /api/scrape/status — any authenticated admin can check status
router.get('/status', scrappeLimiter, protect, authorize('admin'), scrapeStatus)

export default router
