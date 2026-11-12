import { githubRequest } from '../pipeline/github.js';
import { tailoringError } from './resumeTailoringContent.js';

export const TAILORED_RESUME_WORKFLOW = 'tailored-resumes.yml';
export const RESUME_WORKFLOW_STOPPED = 'resume_workflow_stopped';
const waitingStatuses = new Set(['queued', 'waiting', 'pending', 'requested']);
const dispatches = new Map();

// Resume workers can live separately from the scraper workflows.
const resumeRepository = () => process.env.TAILORED_RESUME_GITHUB_REPO ?? process.env.GITHUB_REPO;

export function tailoredResumeActionsConfigured() {
  return process.env.TAILORED_RESUME_ACTIONS_ENABLED !== 'false' && Boolean(process.env.GITHUB_PAT)
    && /^[-\w.]+\/[-\w.]+$/.test(resumeRepository() || '');
}

export function requireTailoredResumeActions() {
  if (!tailoredResumeActionsConfigured()) throw tailoringError('Resume generation is not available yet. Please try again later.', 503);
}

async function dispatch(repo, request, reuseRunning, recovery) {
  try {
    const data = await request(repo, `/actions/workflows/${TAILORED_RESUME_WORKFLOW}/runs?event=workflow_dispatch&per_page=100`);
    if (!Array.isArray(data?.workflow_runs)) throw tailoringError('GitHub returned an invalid resume workflow status.', 502);
    // A running worker may already have consumed its last queue item. Schedule a
    // follow-up unless a waiting run will pick up the newly persisted requests.
    // Recovery retries existing durable work. Runtime setup leaves that work
    // queued, so an active worker must also cover recovery dispatches.
    if (data.workflow_runs.some(run => waitingStatuses.has(run.status) || (reuseRunning && run.status === 'in_progress'))) return { reused: true };
    const latest = data.workflow_runs[0];
    if (recovery && latest?.status === 'completed' && latest.conclusion && latest.conclusion !== 'success') {
      // A worker can crash before connecting to MongoDB or claiming a request.
      // Recovery must finalize that queued work, not launch the same crash again.
      throw Object.assign(tailoringError('Resume processing stopped before this request finished. Please retry.', 503),
        { code: RESUME_WORKFLOW_STOPPED });
    }
    const repository = await request(repo, '');
    if (typeof repository?.default_branch !== 'string' || !repository.default_branch) throw tailoringError('The resume workflow default branch is unavailable.', 502);
    // Candidate data, account IDs and job IDs never enter the GitHub event.
    await request(repo, `/actions/workflows/${TAILORED_RESUME_WORKFLOW}/dispatches`, { method: 'POST', body: { ref: repository.default_branch } });
    return { reused: false };
  } catch (error) {
    if (error.statusCode) throw error;
    throw tailoringError('The resume workflow could not be started. Please retry.', 503);
  }
}

export async function dispatchTailoredResumes({ request = githubRequest, reuseRunning = false, recovery = false } = {}) {
  requireTailoredResumeActions();
  const repo = resumeRepository();
  // Coalesce clicks while GitHub has not made the accepted run visible yet.
  if (dispatches.has(repo)) {
    try { return await dispatches.get(repo); }
    catch (error) {
      // A deliberate retry must not inherit an in-flight recovery's stop result.
      if (!recovery && error.code === RESUME_WORKFLOW_STOPPED) return dispatchTailoredResumes({ request, reuseRunning, recovery });
      throw error;
    }
  }
  const pending = dispatch(repo, request, reuseRunning, recovery);
  dispatches.set(repo, pending);
  try { return await pending; }
  finally { if (dispatches.get(repo) === pending) dispatches.delete(repo); }
}
