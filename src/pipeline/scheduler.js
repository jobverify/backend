import { createHash, randomUUID } from 'node:crypto';
import ScraperSchedule from '../models/ScraperSchedule.js';
import PipelineRun from '../models/PipelineRun.js';
import { getScraperSchedule, nextScheduleRun } from './schedule.js';
import { createPipeline, dispatchNext, failPipeline, pipelineError } from './execution.js';
import { githubRequest, dispatchGithubStage } from './github.js';
import { directConfiguration, WORKFLOWS } from './policy.js';

export const scraperSchedulerEnabled = (env = process.env) => env.SCRAPER_SCHEDULER_ENABLED === 'true'
  || (env.SCRAPER_SCHEDULER_ENABLED !== 'false' && env.NODE_ENV === 'production');

// Lease protects settings while preparing a start. The pipeline's unique slot
// is the durable deduplication boundary, including after a process crash.
export async function tickScraperSchedule({ now = Date.now(), repo = process.env.GITHUB_REPO, token = process.env.GITHUB_PAT,
  request = githubRequest, dispatch = (run, stage) => dispatchGithubStage(run, stage, token),
} = {}) {
  const started = Date.now();
  const currentTime = () => now + (Date.now() - started);
  const schedule = await getScraperSchedule({ now });
  if (Date.parse(schedule.nextRunAt) > now) return null;
  const leaseToken = randomUUID();
  const leased = await ScraperSchedule.findOneAndUpdate({ _id: 'global', revision: schedule.revision,
    nextRunAt: { $lte: new Date(now) }, leaseUntil: { $lte: new Date(now) },
  }, { $set: { leaseToken, leaseUntil: new Date(now + 120000), lastCheckedAt: new Date(now) } }, { new: true }).lean();
  if (!leased) return null;
  const filter = { _id: 'global', revision: schedule.revision, leaseToken };
  const period = schedule.mode === 'daily' ? 86400000 : schedule.hours * 3600000;
  const nextRunAt = nextScheduleRun(schedule, now);
  const occurrence = Date.parse(nextRunAt) - period;
  const scheduleSlot = createHash('sha256').update(JSON.stringify(['backend-scraper', repo, occurrence])).digest('hex');
  let run;
  try {
    if (!token || !/^[-\w.]+\/[-\w.]+$/.test(repo || '')) throw pipelineError('Configure GITHUB_REPO and GITHUB_PAT with Actions access.', 503);
    // Already persisted means the occurrence was consumed, even if a crash
    // prevented the schedule checkpoint. Pipeline recovery handles unfinished work.
    const existing = await PipelineRun.findOne({ scheduleSlot }).lean();
    if (existing) {
      await ScraperSchedule.updateOne(filter, { $set: { nextRunAt: new Date(nextRunAt), lastRunId: existing._id, lastRunAt: existing.startedAt } });
      return null;
    }
    if (await PipelineRun.exists({ activeKey: 'database' })) return null;
    const repository = await request(repo, '', { token });
    const ref = repository.default_branch;
    const configuration = directConfiguration('scraper');
    const [commit] = await Promise.all([
      request(repo, `/commits/${encodeURIComponent(ref)}`, { token }),
      ...configuration.stages.filter(stage => stage.enabled).map(async stage => {
        const workflow = await request(repo, `/actions/workflows/${WORKFLOWS[stage.key]}`, { token });
        if (workflow.state !== 'active') throw pipelineError(`Enable the ${stage.key} workflow in GitHub Actions.`, 503);
      }),
    ]);
    if (!ref || !/^[a-f0-9]{40,64}$/.test(commit.sha || '')) throw pipelineError('GitHub did not return the default branch revision.', 502);
    // Preflight may have outlived the lease. Renew only an unexpired owner and
    // matching revision, so changed settings cannot be dispatched by an old tick.
    const renew = () => ScraperSchedule.findOneAndUpdate({ ...filter, leaseUntil: { $gt: new Date(currentTime()) } },
      { $set: { leaseUntil: new Date(currentTime() + 120000) } }, { new: true }).lean();
    if (!await renew()) return null;
    try {
      run = await createPipeline({ configuration, target: 'github', origin: 'scheduler', repo, ref, sha: commit.sha, scheduleSlot });
    } catch (error) {
      if (error.activeRun || error.scheduleAlreadyClaimed) return null;
      throw error;
    }
    if (!await renew()) {
      await failPipeline(run._id, 'cancelled', 'Schedule changed before dispatch.');
      return null;
    }
    await dispatchNext(run._id, dispatch);
    await ScraperSchedule.updateOne(filter, { $set: { nextRunAt: new Date(nextRunAt), lastRunAt: new Date(now), lastRunId: run._id, lastError: null } });
    return run;
  } catch (error) {
    // Once a pipeline exists, never redispatch an ambiguous GitHub response.
    await ScraperSchedule.updateOne(filter, { $set: { lastError: String(error.message).slice(0, 500),
      ...(run ? { nextRunAt: new Date(nextRunAt), lastRunAt: new Date(now), lastRunId: run._id } : {}),
    } });
    throw error;
  } finally {
    await ScraperSchedule.updateOne(filter, { $set: { leaseUntil: new Date(0) }, $unset: { leaseToken: 1 } });
  }
}
