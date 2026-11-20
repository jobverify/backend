import { normalizeJobListResponseJob } from '../controllers/jobController.js';
import { searchJobs, PremiumJobFiltersError } from '../services/jobSearchService.js';
import { ASSISTANT_LIMITS, AssistantError, modelFailure, validateAssistantInput } from './contract.js';
import { ASSISTANT_SYSTEM_PROMPT, ASSISTANT_TOOLS, readToolCall } from './tools.js';
import { lookupHelp } from './helpContent.js';

const clarification = () => ({ reply: 'Try a Jobverify help question, or describe the role and location you want to find.',
  jobs: [], sources: [], actions: [{ label: 'Contact support', href: '/contact' }] });
const disabled = () => new AssistantError(503, 'assistant_disabled', 'The assistant is not currently available.', 30);

function jobCard(row) {
  const job = normalizeJobListResponseJob(row);
  const id = String(job?._id ?? '');
  if (!/^[a-f\d]{24}$/i.test(id) || typeof job.title !== 'string' || typeof job.company !== 'string') return null;
  return { id, title: job.title.slice(0, 240), company: job.company.slice(0, 200),
    location: typeof job.location === 'string' ? job.location.slice(0, 240) : '',
    jobType: job.jobType, href: '/jobs/' + id };
}

export function createAssistantService({
  model, search = searchJobs,
  enabled = () => process.env.ASSISTANT_ENABLED === 'true',
  verificationEnabled = () => process.env.JOB_VERIFICATION_ENABLED === 'true',
  deadlineMs = ASSISTANT_LIMITS.deadlineMs, now = Date.now,
} = {}) {
  const capabilities = () => ({ enabled: Boolean(enabled() && typeof model === 'function'),
    verificationEnabled: Boolean(verificationEnabled()) });
  async function ask(body, context = {}) {
    if (!capabilities().enabled) throw disabled();
    const input = validateAssistantInput(body, context.rawBytes);
    const controller = new AbortController();
    let timer;
    let abortListener;
    const expired = new Promise((_, reject) => {
      const abort = () => {
        controller.abort();
        reject(new AssistantError(504, 'assistant_timeout', 'The assistant took too long. Please try again.', 5));
      };
      timer = setTimeout(abort, deadlineMs);
      abortListener = abort;
      if (context.signal?.aborted) abort();
      else context.signal?.addEventListener('abort', abortListener, { once: true });
    });
    const run = async () => {
      if (controller.signal.aborted) throw new AssistantError(504, 'assistant_timeout', 'The request was interrupted.', 5);
      let output;
      try {
        output = await model({ messages: [{ role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
          ...input.history, { role: 'user', content: input.message }],
        tools: ASSISTANT_TOOLS, maxTokens: ASSISTANT_LIMITS.outputTokens, signal: controller.signal });
      } catch (error) { throw modelFailure(error, now()); }
      if (controller.signal.aborted) throw new AssistantError(504, 'assistant_timeout', 'The request was interrupted.', 5);
      const call = readToolCall(output);
      if (!call) return clarification();
      if (call.name === 'lookup_help') return lookupHelp(call.args.topic, { ...context, verificationEnabled: verificationEnabled() });
      try {
        const result = await search({ ...call.args, limit: 5 }, { user: context.user, siteSettings: context.siteSettings });
        const jobs = result.data.slice(0, 5).map(jobCard).filter(Boolean);
        return { reply: jobs.length ? 'Here ' + (jobs.length === 1 ? 'is 1 matching job.' : 'are ' + jobs.length + ' matching jobs.')
          : 'No current jobs matched those filters. Try another role or location.',
        jobs, sources: [{ label: 'Current job listings', href: '/jobs' }],
        actions: [{ label: 'Browse jobs', href: '/jobs' }] };
      } catch (error) {
        if (error instanceof PremiumJobFiltersError) return { reply: 'These job filters require Premium access. View the current plans to use them.',
          jobs: [], sources: [], actions: [{ label: 'View plans', href: '/jobs?plans=1' }] };
        throw new AssistantError(503, 'assistant_search_unavailable', 'Job search is temporarily unavailable. Try again or browse the job board.', 5);
      }
    };
    try { return await Promise.race([expired, run()]); }
    finally {
      clearTimeout(timer);
      context.signal?.removeEventListener('abort', abortListener);
    }
  }
  return { capabilities, ask };
}
