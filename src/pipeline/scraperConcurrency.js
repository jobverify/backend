import PipelineConfiguration from '../models/PipelineConfiguration.js';
import PipelineRun from '../models/PipelineRun.js';
import { defaultScraperConcurrency, validateScraperConcurrency } from './policy.js';

// Resolve once per run. A persisted admin setting takes precedence over host env.
export async function configuredScraperConcurrency(fallback=defaultScraperConcurrency()) {
  const saved=await PipelineConfiguration.findById('global').select('scraperConcurrency').lean();
  return validateScraperConcurrency(saved?.scraperConcurrency??fallback);
}

export async function scraperRunEnvironment(run) {
  return {SCRAPER_CONCURRENCY:String(validateScraperConcurrency(run.scraperConcurrency??await configuredScraperConcurrency()))};
}

export async function standaloneScraperEnvironment(pipelineId) {
  if(!pipelineId)return scraperRunEnvironment({});
  const run=await PipelineRun.findById(pipelineId).lean();
  if(!run)throw new Error('Scraper pipeline not found.');
  return scraperRunEnvironment(run);
}
