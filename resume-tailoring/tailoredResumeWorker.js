import TailoredResume from '../src/models/TailoredResume.js';
import Resume from '../src/models/Resume.js';
import { reportResumeDiagnostic, resumeFailure } from './resumeDiagnostics.js';
import { RESUME_WORKER_BUDGET_MS } from './resumeBudget.js';
import { drainResumeDocuments, nextResumeDocumentTask } from '../src/services/resumeTailoringService.js';

const prepareResumeRuntime = async options => (await import('./resumePipeline.js')).prepareResumeRuntime(options);
const processResumeDocument = async (input, options) => (await import('./resumePipeline.js')).processResumeDocument(input, { ...options, onDiagnostic: reportResumeDiagnostic });

export async function runTailoredResumeWorker({ deadline = Date.now() + RESUME_WORKER_BUDGET_MS,
  prepareRuntime = prepareResumeRuntime, generate = processResumeDocument, drain = drainResumeDocuments, nextTask = nextResumeDocumentTask,
} = {}) {
  const task = await nextTask();
  if (!task) return { attempted: 0, completed: 0, failed: 0 };
  let runtime;
  try {
    runtime = await prepareRuntime({ deadline });
    if (deadline - Date.now() <= 15000) throw new Error('The resume worker startup exceeded its budget.');
    return await drain({ generate, maxTasks: 1, deadline, task });
  } catch (error) {
    reportResumeDiagnostic({ stage: 'startup', code: error.code });
    const message = error.code ? resumeFailure(error.code).message : 'The resume worker could not finish. Please retry preparation.';
    // Startup failures must be visible to the person waiting in the app. Never
    // overwrite another worker's lease, a retry revision, or previous output.
    const { row } = task;
    if (task.kind === 'base') {
      await Resume.updateOne({ _id: row._id, user: row.user, 'preparation.revision': row.preparation.revision,
        'preparation.status': 'queued', 'preparation.ready': true }, { $set: { 'preparation.status': 'failed', 'preparation.phase': 'failed',
        'preparation.ready': false, 'preparation.error': message } });
    } else {
      await TailoredResume.updateOne({ _id: row._id, user: row.user, revision: row.revision, status: 'queued', ready: true }, {
        $set: { status: 'failed', phase: 'failed', ready: false, error: error.code ? message : 'The resume worker could not finish. Please retry generation.' },
      });
    }
    throw error;
  } finally { await runtime?.stop(); }
}
