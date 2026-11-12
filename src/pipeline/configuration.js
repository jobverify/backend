import PipelineConfiguration from '../models/PipelineConfiguration.js';
import { defaultConfiguration, validateConfiguration } from './policy.js';

export async function savedPipelineConfiguration() {
  const saved = await PipelineConfiguration.findById('global').lean();
  const defaults = defaultConfiguration();
  // Older concurrency-only documents have no stage configuration yet.
  return validateConfiguration({ ...defaults, ...saved, stages: saved?.stages?.length ? saved.stages : defaults.stages });
}
