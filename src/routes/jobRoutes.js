/**
 * @file API routes for job listings search, clicks, and metadata.
 * @module routes/jobRoutes
 */

import express from "express";
import { getRelatedJobs } from "../controllers/relatedJobController.js";
import { loadSiteSettings } from "../middleware/siteSettings.js";
import { getJobSnapshot } from "../controllers/jobSnapshotController.js";
import {
  getAllJobs,
  getJobSearch,
  getJobById,
  getJobCompanySuggestions,
  trackJobClick,
  getJobMeta,
  getJobStats,
  getLiveHiringCompanies,
  getJobSeoFeed,
} from "../controllers/jobController.js";
import { optionalProtect, protect } from "../middleware/authMiddleware.js";
import { requireJsonMutation, validateRequest } from "../middleware/validateRequest.js";
import { createRateLimiter } from "../utils/rateLimit.js";
import {
  jobCompanyAutocompleteValidation,
  jobQueryValidation,
  mongoIdParamValidation,
} from "../validation/requestValidators.js";
import { createPublicJobAbuseGuard } from "../middleware/publicJobAbuseGuard.js";

const clickLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    code: 429,
    success: false,
    message: "Too many clicks, please try again after a minute",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();
const publicJobAbuseGuard = createPublicJobAbuseGuard();
router.use(loadSiteSettings);

router.get("/", publicJobAbuseGuard, jobQueryValidation, validateRequest, optionalProtect, getAllJobs);
router.get("/search", publicJobAbuseGuard, optionalProtect, getJobSearch);
router.post("/search", requireJsonMutation, publicJobAbuseGuard, optionalProtect, getJobSearch);
router.get(
  "/meta/companies",
  jobCompanyAutocompleteValidation,
  validateRequest,
  optionalProtect,
  getJobCompanySuggestions,
);
router.get("/meta", jobQueryValidation, validateRequest, optionalProtect, getJobMeta);   // must be before /:id
router.get("/stats", getJobStats); // public stats for landing page
router.get("/snapshot", getJobSnapshot);
router.get("/live-companies", getLiveHiringCompanies);
router.get("/seo-feed", getJobSeoFeed);
router.get("/:id/related", publicJobAbuseGuard, mongoIdParamValidation("id", "job ID"), validateRequest, getRelatedJobs);
router.get("/:id", publicJobAbuseGuard, mongoIdParamValidation("id", "job ID"), validateRequest, getJobById);
router.post(
  "/:id/click",
  protect,
  mongoIdParamValidation("id", "job ID"),
  validateRequest,
  clickLimiter,
  trackJobClick,
);

export default router;
