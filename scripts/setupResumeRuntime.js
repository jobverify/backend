import { prepareResumeRuntime } from '../resume-tailoring/resumePipeline.js';
import { reportResumeDiagnostic } from '../resume-tailoring/resumeDiagnostics.js';

// Install and verify pinned assets without database credentials or a live queue.
let runtime;
try {
  reportResumeDiagnostic({ stage: 'startup', code: 'started' });
  runtime = await prepareResumeRuntime();
  reportResumeDiagnostic({ stage: 'startup', code: 'passed', seconds: process.uptime() });
} catch (error) {
  reportResumeDiagnostic({ stage: 'startup', code: error.code || 'processing_failed' });
  process.exitCode = 1;
} finally { await runtime?.stop(); }
