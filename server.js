/**
 * Process entry point. HTTP composition lives in src/app.js; this file owns the
 * database, listening socket, maintenance tasks, and termination signals.
 */
import "./loadEnv.js";
import mongoose from "mongoose";
import connectDB from "./db/db.js";
import { createApp } from "./src/app.js";
import { parsePort } from "./src/config/http.js";
import { createPeriodicTask, createShutdown } from "./src/runtime/lifecycle.js";
import { recoverQueuedJobAlerts } from "./src/services/jobAlertService.js";
import { downgradeExpiredPlans } from "./src/services/planService.js";
import { captureHiringObservation } from './src/services/hiringObservationService.js';
import { reconcileActivePipeline } from './src/pipeline/recovery.js';
import { tickScraperSchedule, scraperSchedulerEnabled } from './src/pipeline/scheduler.js';
import { recoverTailoredResumes } from './src/services/resumeTailoringService.js';
import { processAutoApplyQueue } from './src/services/autoApplyService.js';
import { recoverJobAlertOutbox } from './src/services/jobAlertOutboxService.js';
import { recoverTelegramChannelAlerts } from './src/services/telegramChannelService.js';
import { logOperationalError } from './src/utils/operationalLog.js';
import { initializeVerification } from './src/jobVerification/initialize.js';
import { verificationService } from './src/jobVerification/service.js';

async function main() {
  const port = parsePort(process.env.PORT);
  let stopping = false;
  const app = createApp({
    isReady: () => !stopping && mongoose.connection.readyState === 1,
  });
  await connectDB();
  await initializeVerification();
  let server;
  try {
    server = app.listen(port, "0.0.0.0");
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.once("listening", () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
  } catch (error) {
    await mongoose.disconnect();
    throw error;
  }
  console.log(`Server is running on 0.0.0.0:${port}`);

  const stopTasks = [
    (() => {
      const stopTick = createPeriodicTask(() => verificationService.tick(), { intervalMs: 1000, runImmediately: true,
        onError: () => console.error('[Job verification] Queue storage is unavailable.') });
      return async () => { await verificationService.stop(); await stopTick(); };
    })(),
    createPeriodicTask(recoverTelegramChannelAlerts, {
      intervalMs: 15_000, runImmediately: true,
      onError: error => logOperationalError('telegram_broadcast', error),
    }),
    ...(scraperSchedulerEnabled() ? [createPeriodicTask(tickScraperSchedule, {
      intervalMs: 60_000, runImmediately: true,
      onError: error => logOperationalError('scraper_scheduler', error),
    })] : []),
    createPeriodicTask(recoverJobAlertOutbox, {
      intervalMs: 5000, runImmediately: true,
      onError: error => logOperationalError('job_alert_outbox', error),
    }),
    createPeriodicTask(processAutoApplyQueue, {
      intervalMs: 5000, runImmediately: true,
      onError: error => logOperationalError('auto_apply_queue', error),
    }),
    createPeriodicTask(recoverTailoredResumes, {
      intervalMs: 5000, runImmediately: true,
      onError: error => logOperationalError('resume_tailoring_recovery', error),
    }),
    createPeriodicTask(reconcileActivePipeline, {
      intervalMs: 60_000, runImmediately: true,
      onError: error => logOperationalError('pipeline_recovery', error),
    }),
    createPeriodicTask(captureHiringObservation, {
      intervalMs: 60 * 60_000, runImmediately: true,
      onError: error => logOperationalError('hiring_observation', error),
    }),
    createPeriodicTask(recoverQueuedJobAlerts, {
      intervalMs: 60_000,
      runImmediately: true,
      onError: error => logOperationalError('job_alert_recovery', error),
    }),
    createPeriodicTask(downgradeExpiredPlans, {
      intervalMs: 60 * 60_000,
      onError: error => logOperationalError('expired_plan_sweep', error),
    }),
  ];
  const shutdown = createShutdown({
    server,
    stopTasks,
    disconnect: () => mongoose.disconnect(),
    onStart: () => { stopping = true; },
  });
  const onSignal = (signal) => {
    console.log(`Received ${signal}; draining requests and background work.`);
    shutdown().catch((error) => {
      console.error("[Shutdown]", error.message);
      process.exit(1);
    });
  };
  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);
}

main().catch((error) => {
  console.error("[Startup]", error.message);
  process.exit(1);
});
