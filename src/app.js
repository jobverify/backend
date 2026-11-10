import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import helmet from "helmet";
import jobRoutes from "./routes/jobRoutes.js";
import publishingRoutes from './routes/publishingRoutes.js';
import companyRoutes from "./routes/companyRoutes.js";
import jobVerificationRoutes from './routes/jobVerificationRoutes.js';
import userRoutes from "./routes/userRoutes.js";
import telegramRoutes from "./routes/telegramRoutes.js";
import scrapeRoutes from "./routes/scrapeRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import billingRoutes from "./routes/billingRoutes.js";
import { createCsrfProtection } from "./middleware/csrfProtection.js";
import { errorHandler } from "./middleware/errorHandler.js";
import {
  createApiRateLimitHandler,
  createRateLimiter,
  createPublishingRateLimiter,
  createPublishingBuildRateLimiter,
  createIngressRateLimiter,
  createPublishingRenderRateLimiter,
  createPublishingBudgetRateLimiter,
  getApiRateLimitProfile,
} from "./utils/rateLimit.js";
import {
  requireEnv,
  requireOneOf,
  resolvePublicApiOrigin,
} from "./utils/runtimeConfig.js";
import { requireJsonMutation } from "./middleware/validateRequest.js";
import { isJwtSecretStrong } from "./utils/authSecurity.js";
import { createOriginAllowlist } from "./utils/originAllowlist.js";

import mongoose from "mongoose";
import { readSiteSettings } from "./controllers/siteSettingsController.js";
import { parseTrustProxy, parseOriginList } from "./config/http.js";
import { validateTurnstileConfiguration } from './middleware/turnstileCaptcha.js';
import { createCanaryHandler, createCrawlerPolicyGuard } from './security/scraperDefense.js';
import { createSeoToolsRouter } from './seo/seoToolsRoutes.js';
import { requestDiagnostics } from './middleware/requestDiagnostics.js';

export function createApp({ isReady = () => mongoose.connection.readyState === 1, ingressLimit = 1200 } = {}) {
  const env = process.env;
  const app = express();
  app.set("trust proxy", parseTrustProxy(env.TRUST_PROXY));
  app.disable("x-powered-by");
  app.use(requestDiagnostics);

  const nodeEnv = String(env.NODE_ENV || "").trim().toLowerCase();
  const jwtSecret = requireEnv("JWT_SECRET", env);
  const allowedOrigins = parseOriginList(requireEnv("CORS_ORIGIN", env));
  const originAllowlist = createOriginAllowlist(allowedOrigins, {
    allowDevLoopback: nodeEnv !== "production",
  });

  if (nodeEnv === "production" && !isJwtSecretStrong(jwtSecret)) {
    throw new Error("JWT_SECRET must be at least 32 characters long in production.");
  }

  if (nodeEnv === "production") {
    validateTurnstileConfiguration(env);
    requireOneOf(["FRONTEND_ORIGIN", "CORS_ORIGIN"], env);
    resolvePublicApiOrigin(env);
  }

  // Middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'none'"],
          baseUri: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
        },
      },
      crossOriginResourcePolicy: false,
      referrerPolicy: { policy: "no-referrer" },
      hsts: nodeEnv === "production"
        ? {
            maxAge: 15552000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
    }),
  );

  app.use(createIngressRateLimiter(env, { limit: ingressLimit }));

  // Dynamic CORS configuration supporting multiple origins (e.g. localhost, 127.0.0.1, or prod URLs)
  app.use(
    cors({
      // Validates if the request origin is allowed by CORS.
      origin: (origin, callback) => {
        if (!origin || originAllowlist.has(origin)) {
          callback(null, true);
        } else {
          callback(null, false); // Return false instead of throwing to avoid crashing the server
        }
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
      exposedHeaders: ["Content-Disposition"],
    }),
  );

  // Telegram authenticates the webhook before its route-local JSON parser runs.
  app.use("/api/integrations/telegram", telegramRoutes);

  app.use('/api/_canary', createCanaryHandler());
  // Keep account actions, integrations and publishing independent of bot hints.
  app.use(['/api/jobs', '/api/companies'], createCrawlerPolicyGuard());
  // Dedicated bearer credential only: this router does not accept session
  // cookies. Keep existing cookie/CSRF protection for every other API route.
  app.use('/api/seo', createSeoToolsRouter());

  app.use(express.json({
    limit: "32kb",
    verify: (req, _res, buffer) => {
      if (req.path === "/api/billing/webhook") {
        req.rawBody = buffer.toString("utf8");
      }
    },
  }));
  app.use(express.urlencoded({ extended: true, limit: "32kb" }));

  app.use('/api', (req, res, next) => {
    // Only this authenticated file endpoint accepts binary mutations. CSRF and
    // API rate limits below still run before its bounded, route-local parser.
    if (req.method === 'PUT' && req.path === '/user/resume' && req.is('application/octet-stream')) return next();
    return requireJsonMutation(req, res, next);
  });
  app.use(
    "/api",
    createCsrfProtection({
      allowedOrigins,
      allowDevLoopback: nodeEnv !== "production",
      exemptPaths: [
        "/api/billing/webhook",
        "/api/integrations/telegram/webhook",
        "/api/publishing/rate-limit",
      ],
    }),
  );

  const mutationLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    skip: (req) => getApiRateLimitProfile(req) !== "mutation",
    standardHeaders: true,
    legacyHeaders: false,
    handler: createApiRateLimitHandler({
      message: "Too many write requests from this IP, please try again after 15 minutes",
      retryAfterSeconds: 15 * 60,
    }),
  });

  const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    skip: (req) => getApiRateLimitProfile(req) !== "auth",
    standardHeaders: true,
    legacyHeaders: false,
    handler: createApiRateLimitHandler({
      message: "Too many authentication requests from this IP, please try again after 15 minutes",
      retryAfterSeconds: 15 * 60,
    }),
  });

  const cheapReadLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    skip: (req) => getApiRateLimitProfile(req) !== "cheap-read",
    standardHeaders: true,
    legacyHeaders: false,
    handler: createApiRateLimitHandler({
      message: "Too many read requests from this IP, please try again after 15 minutes",
      retryAfterSeconds: 15 * 60,
    }),
  });

  const expensiveSearchLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 120,
    skip: (req) => getApiRateLimitProfile(req) !== "expensive-search",
    standardHeaders: true,
    legacyHeaders: false,
    handler: createApiRateLimitHandler({
      message: "Too many job search requests from this IP, please try again after 15 minutes",
      retryAfterSeconds: 15 * 60,
    }),
  });

  app.use("/api", mutationLimiter);
  app.use("/api", authLimiter);
  app.use("/api", cheapReadLimiter);
  app.use("/api", expensiveSearchLimiter);
  app.use("/api", createPublishingRateLimiter());
  app.use("/api", createPublishingBuildRateLimiter());
  app.use("/api", createPublishingRenderRateLimiter());
  app.use("/api", createPublishingBudgetRateLimiter());

  const noStore = (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  };

  // Routes
  app.get("/api/site-settings", noStore, readSiteSettings);
  app.use("/api/auth", noStore, authRoutes);
  app.use("/api/jobs", jobRoutes);
  app.use('/api/publishing', publishingRoutes);
  app.use("/api/companies", companyRoutes);
  app.use("/api/user", noStore, userRoutes);
  app.use('/api/job-verifications', noStore, jobVerificationRoutes);
  app.use("/api/billing", noStore, billingRoutes);
  app.use("/api/scrape", noStore, scrapeRoutes);
  app.use("/api/admin", noStore, adminRoutes);
  app.get("/", (req, res) => {
    res.send("Hello from the Jobverify Backend!");
  });
  app.get("/health", (_req, res) => {
    const deploymentCommit = env.RENDER_GIT_COMMIT;
    res.set("Cache-Control", "no-store");
    res.status(200).json({
      status: "ok",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      ...(typeof deploymentCommit === "string" && deploymentCommit.length === 40 && /^[a-f0-9]{40}$/i.test(deploymentCommit)
        ? { deploymentCommit }
        : {}),
    });
  });

  app.get("/ready", (_req, res) => {
    const ready = isReady();
    res.set("Cache-Control", "no-store");
    res.status(ready ? 200 : 503).json({ status: ready ? "ok" : "unavailable" });
  });

  app.use("/api", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.status(404).json({ success: false, message: "API route not found." });
  });
  app.use(errorHandler);
  return app;
}
