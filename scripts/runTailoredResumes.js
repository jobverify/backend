import 'dotenv/config';
import mongoose from 'mongoose';
import { runTailoredResumeWorker } from '../resume-tailoring/tailoredResumeWorker.js';
import { reportResumeDiagnostic } from '../resume-tailoring/resumeDiagnostics.js';
import { remainingBudget, resumeWorkerDeadline, RESUME_WORKER_BUDGET_MS } from '../resume-tailoring/resumeBudget.js';

try {
  if (!process.env.MONGO_URI) throw new Error('Missing worker configuration.');
  const start = Date.parse(process.env.TAILORED_RESUME_WORKFLOW_STARTED_AT || '');
  const deadline = resumeWorkerDeadline(process.env.TAILORED_RESUME_WORKFLOW_STARTED_AT);
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: remainingBudget(deadline, 10000), autoIndex: false });
  const counts = await runTailoredResumeWorker({ deadline });
  // Only allowlisted stage codes and aggregate counts; no candidate content.
  console.log(JSON.stringify(counts));
  reportResumeDiagnostic({ stage: 'worker', code: counts.failed ? 'processing_failed' : 'passed',
    seconds: (Date.now() - (Number.isFinite(start) ? start : deadline - RESUME_WORKER_BUDGET_MS)) / 1000 });
  if (counts.failed) process.exitCode = 1;
} catch (error) {
  reportResumeDiagnostic({ stage: 'worker', code: error.code });
  console.error('The tailored resume worker could not finish. Retry generation in the app.');
  process.exitCode = 1;
} finally { await mongoose.disconnect(); }
