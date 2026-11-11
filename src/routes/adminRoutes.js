/**
 * @file API routes for the admin dashboard, user/job management, and crawler control.
 * @module routes/adminRoutes
 */

import express from "express";
import { getPipelineSchedule, savePipelineSchedule } from '../controllers/pipelineController.js';
import { updateSiteSettings } from "../controllers/siteSettingsController.js";
import { getAdminTelegramAlerts, saveAdminTelegramAlerts, previewAdminTelegramAlert, getAdminTelegramAlertLogs } from '../controllers/adminTelegramAlertsController.js';
import { getPipelineStatus, savePipelineConfiguration, getPipelineCapabilities, triggerPipeline, getPipelineRuns, getPipelineRun, getPipelineLog, downloadPipeline, retiredPipelineControl, stopPipeline, stopAllPipelines } from '../controllers/pipelineController.js';
import { getUserSuggestions, resolveUserSuggestion, deleteUserSuggestion } from "../controllers/userSuggestionController.js";
import { purgeScraperJobs } from "../controllers/scraperMaintenanceController.js";
import {
  getDashboardStats,
  getClickTimeSeries,
  getClicksByLocation,
  getTopJobs,
  getUserGrowthTimeSeries,
  getUsersTable,
  getUserById,
  deleteUser,
  updateUserRole,
  updateUserAccess,
  updateUserTelegramAccess,
  getJobsTable,
  purgeAllJobs,
  updateJobStatus,
  getAuditLog,
  getScrapeStatus,
  toggleScraperActive,
  toggleUserStatus,
} from "../controllers/adminController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
  createRateLimiter,
  ipKeyGenerator,
} from "../utils/rateLimit.js";
import {
  adminJobsQueryValidation,
  adminSuggestionsQueryValidation,
  adminJobStatusValidation,
  adminRoleUpdateValidation,
  adminAccessUpdateValidation,
  adminScraperToggleValidation,
  adminUserStatusValidation,
  adminUsersQueryValidation,
  mongoIdParamValidation,
} from "../validation/requestValidators.js";

const router = express.Router();

const scrapeTriggerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) =>
    `${req.user?._id ?? "unknown"}:${ipKeyGenerator(req.ip)}`,
  message: {
    code: 429,
    success: false,
    message: "Too many scraper trigger attempts, please try again after an hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const descriptionTriggerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: (req) => `${req.user?._id ?? "unknown"}:${ipKeyGenerator(req.ip)}`,
  message: { success: false, message: "Too many description rewrite requests. Try again after an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply authentication and administrator role guard to all routes
router.use(protect);
router.use(authorize("admin"));
router.put("/site-settings", updateSiteSettings);
router.get('/telegram-alerts', getAdminTelegramAlerts);
router.get('/telegram-alerts/logs', getAdminTelegramAlertLogs);
router.post('/telegram-alerts/preview', previewAdminTelegramAlert);
router.put('/telegram-alerts/:destination', saveAdminTelegramAlerts);

// Dashboard Overview and Time-Series Analytics
router.get("/stats", getDashboardStats);
router.get("/analytics/clicks", getClickTimeSeries);
router.get("/analytics/clicks/locations", getClicksByLocation);
router.get("/analytics/top-jobs", getTopJobs);
router.get("/analytics/user-growth", getUserGrowthTimeSeries);

// User Account Management
router.get("/users", adminUsersQueryValidation, validateRequest, getUsersTable);
router.get("/users/:id", mongoIdParamValidation("id", "user ID"), validateRequest, getUserById);
router.delete("/users/:id", mongoIdParamValidation("id", "user ID"), validateRequest, deleteUser);
router.put(
  "/users/:id/role",
  adminRoleUpdateValidation,
  validateRequest,
  updateUserRole,
);
router.put(
  "/users/:id/telegram-access",
  mongoIdParamValidation("id", "user ID"),
  validateRequest,
  updateUserTelegramAccess,
);
router.put(
  "/users/:id/access",
  adminAccessUpdateValidation,
  validateRequest,
  updateUserAccess,
);
router.put(
  "/users/:id/status",
  adminUserStatusValidation,
  validateRequest,
  toggleUserStatus,
);

// User-submitted company and platform suggestions
router.get(
  "/suggestions",
  adminSuggestionsQueryValidation,
  validateRequest,
  getUserSuggestions,
);

router.put("/suggestions/:id/resolve", mongoIdParamValidation("id", "suggestion ID"), validateRequest, resolveUserSuggestion);
router.delete("/suggestions/:id", mongoIdParamValidation("id", "suggestion ID"), validateRequest, deleteUserSuggestion);

// Job Listing Management
router.get("/jobs", adminJobsQueryValidation, validateRequest, getJobsTable);
router.delete("/jobs", purgeAllJobs);
router.put("/jobs/:id/status", adminJobStatusValidation, validateRequest, updateJobStatus);

// Administrative Action Audit Logging
router.get("/audit", getAuditLog);

// Crawler Health Status and Pipeline Triggers
router.get("/scrape/status", getScrapeStatus);
router.get('/pipeline/status', getPipelineStatus);
router.get('/pipeline/schedule', getPipelineSchedule);
router.put('/pipeline/schedule', savePipelineSchedule);
router.get('/pipeline/capabilities', getPipelineCapabilities);
router.put('/pipeline/configuration', savePipelineConfiguration);
router.post('/pipeline/trigger', scrapeTriggerLimiter, triggerPipeline);
router.post('/pipeline/stop', stopAllPipelines);
router.post('/pipeline/runs/:id/stop', stopPipeline);
router.post('/pipeline/runs/:id/stages/:stage/stop', stopPipeline);
router.get('/pipeline/runs', getPipelineRuns);
router.get('/pipeline/runs/:id', getPipelineRun);
router.get('/pipeline/runs/:id/logs/:stage', getPipelineLog);
router.get('/pipeline/runs/:id/download', downloadPipeline);
router.get('/description-rewrite/status', retiredPipelineControl);
router.put('/description-rewrite/automation', retiredPipelineControl);
router.post('/description-rewrite/trigger', retiredPipelineControl);
router.post(
  "/scrape/trigger",
  scrapeTriggerLimiter,
  retiredPipelineControl,
);

// Crawler Pipeline Active State Control
router.delete('/scraper/:id/jobs', mongoIdParamValidation('id', 'scraper ID'), validateRequest, purgeScraperJobs);
router.put(
  "/scraper/:id/toggle",
  adminScraperToggleValidation,
  validateRequest,
  toggleScraperActive,
);

export default router;
