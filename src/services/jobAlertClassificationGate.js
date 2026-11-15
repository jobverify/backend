import PipelineRun from '../models/PipelineRun.js';

export async function canProcessClassifiedJobAlerts() {
  const run = await PipelineRun.findOne().sort({ createdAt: -1, _id: -1 }).select('stages').lean();
  // Preserve standalone installations that have never used the pipeline.
  // Once a pipeline exists, only its completed classification stage releases
  // alerts. Shard reports, failures and disabled stages do not release them.
  return !run || run.stages?.some(stage => stage.key === 'classification' && stage.status === 'completed') === true;
}
