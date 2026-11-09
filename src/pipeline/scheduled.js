import { createHash } from 'node:crypto';
import PipelineRun from '../models/PipelineRun.js';
import { createDirectGithubPipeline } from './github.js';
import { intervalSlot } from './schedule.js';

// Store the due slot on the pipeline itself: claiming the slot and the shared
// execution lock is one atomic insert, so failed/busy attempts consume nothing.
export async function startScheduledPipeline(schedule, options, { token, now = Date.now() } = {}) {
  if (schedule.mode !== 'interval') return createDirectGithubPipeline(options, { token });
  const slot = intervalSlot(schedule, now);
  if (slot === null) return null;
  const scheduleSlot = createHash('sha256').update(JSON.stringify([options.repo, schedule.startAt, schedule.hours, slot])).digest('hex');
  if (await PipelineRun.exists({ scheduleSlot })) return null;
  try { return await createDirectGithubPipeline({ ...options, scheduleSlot }, { token }); }
  catch (error) {
    if (error.scheduleAlreadyClaimed || error.activeRun) return null;
    throw error;
  }
}
