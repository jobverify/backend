import PipelineRun from '../models/PipelineRun.js';

/** Intersect processing queues with jobs inserted by this pipeline's scraper. */
export function pipelineJobFilter(run, key) {
  const index = run.stages?.findIndex(stage => stage.key === key);
  const stage = run.stages?.[index];
  if (!['rewrite', 'classification'].includes(key) || !stage?.enabled) throw new Error('Invalid processing stage');
  // Already running pipelines predate this setting; retain their original scope.
  if (stage.runForAllExistingJobs === true || stage.runForAllExistingJobs === undefined) return {};
  const scraper = run.stages.slice(0, index).find(item => item.key === 'scraper');
  if (!scraper?.enabled || scraper.status !== 'completed') return { _id: { $in: [] } };
  if (typeof run._id !== 'string' || !run._id) throw new Error('Invalid scraper pipeline identity for job selection');
  // Only the inserting pipeline owns a job; refreshing it never changes ownership.
  return { firstSeenPipelineId: run._id };
}

export async function loadPipelineJobFilter(key, { pipelineId = process.env.PIPELINE_ID, model = PipelineRun } = {}) {
  // Standalone maintenance scripts retain their existing queue behavior.
  if (!pipelineId) return {};
  const run = await model.findById(pipelineId).lean();
  if (!run) throw new Error('Processing pipeline not found');
  return pipelineJobFilter(run, key);
}
