import { FALLBACK_PARALLEL_SCRAPER_CONCURRENCY } from '../../scraper-support/utils/parallelConcurrency.js';

export const STAGES = ['scraper', 'rewrite', 'classification'];
export const WORKFLOWS = { scraper: 'scraper.yml', rewrite: 'rewrite-descriptions.yml', classification: 'classify-jobs.yml' };
export const WORKFLOW_NAMES = { 'Jobverify Scraper Cron': 'scraper', 'Jobverify Description Rewrite': 'rewrite', 'Jobverify Post-scrape Classification': 'classification' };
export const JOB_SCOPES = ['all', 'pending_and_new', 'new'];
// The old all-jobs toggle included the backlog but still reused completed work.
export const configuredJobScope = stage => stage?.jobScope ?? (stage?.runForAllExistingJobs === true ? 'pending_and_new' : 'new');
export function validateScraperConcurrency(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw Object.assign(new Error('Scraper concurrency must be a positive whole number.'),{status:400});
  }
  return value;
}
export const defaultScraperConcurrency = () => {
  const value=Number(process.env.SCRAPER_CONCURRENCY);
  return Number.isSafeInteger(value)&&value>0?value:FALLBACK_PARALLEL_SCRAPER_CONCURRENCY;
};
export const defaultConfiguration = () => ({ stages: STAGES.map(key => ({ key, enabled: true,
  ...(key !== 'scraper' ? { jobScope: 'new' } : {}),
})), scraperConcurrency:defaultScraperConcurrency() });
export function validateConfiguration(value) {
  const stages=value?.stages;
  if (!Array.isArray(stages) || stages.length!==3 || new Set(stages.map(s=>s?.key)).size!==3
    || stages.some(s=>!STAGES.includes(s?.key)||typeof s.enabled!=='boolean') || !stages.some(s=>s.enabled)) {
    throw Object.assign(new Error('Provide all three unique pipeline stages and enable at least one.'),{status:400});
  }
  if (stages.some(stage => stage.key !== 'scraper' && stage.runForAllExistingJobs !== undefined
    && typeof stage.runForAllExistingJobs !== 'boolean')) {
    throw Object.assign(new Error('Run for all existing jobs must be on or off.'), {status:400});
  }
  if (stages.some(stage => stage.key !== 'scraper' && stage.jobScope !== undefined && !JOB_SCOPES.includes(stage.jobScope))) {
    throw Object.assign(new Error('Choose all existing jobs, pending/queued jobs and new jobs, or new jobs only.'), {status:400});
  }
  return {stages:stages.map(stage=>({key:stage.key,enabled:stage.enabled,
    ...(stage.key !== 'scraper' ? {jobScope:configuredJobScope(stage)} : {}),
  })),scraperConcurrency:validateScraperConcurrency(value.scraperConcurrency===undefined?defaultScraperConcurrency():value.scraperConcurrency)};
}
export const directConfiguration = (start, configuration = defaultConfiguration()) => {
  if (!STAGES.includes(start)) throw new Error('Unknown stage');
  return {stages:STAGES.map((key,i)=>({key,enabled:i>=STAGES.indexOf(start),
    ...(key !== 'scraper' ? {jobScope:configuredJobScope(configuration.stages.find(stage=>stage.key===key))} : {}),
  }))};
};
export const createStages = config => config.stages.map(s=>({...s,status:s.enabled?'waiting':'disabled'}));
export function stageOutcome(key, summary={}, code=0) {
  // Worker execution and database failures take precedence over work counters
  // and normal budget/quality stops, for every kind of stage.
  const fatalReasons = ['worker_error','disabled','runner_error','database_unavailable','run_lease_held'];
  if (code!==0 || summary.errorType || summary.persistencePending>0
    || fatalReasons.includes(summary.reason) || fatalReasons.includes(summary.stopReason)
    || summary.missingShards?.length || summary.failedShards?.length) return 'failed';
  if (summary.cancelled || summary.stopReason==='cancelled' || summary.incompleteShards?.length) return 'incomplete';
  const normalStop = summary.budgetExhausted || summary.stopReason==='budget_exhausted'
    || summary.reason==='workflow_budget_exhausted'
    || (summary.qualityStopped && summary.reason==='model_quality_unavailable');
  if (!normalStop && (summary.interrupted || summary.reason==='interrupted')) return 'incomplete';
  // Rejected items, changed sources, leases and pending business work are
  // diagnostic. Saved work can always hand off to the next enabled stage.
  return 'completed';
}
export const isTerminal = status => ['completed','failed','incomplete','cancelled','interrupted'].includes(status);

/** A successful handoff may still leave queue work and rejected items. */
export const describeStageCompletion = (key, summary = {}, outcome) => {
 const processingComplete = outcome === 'completed' && !summary.interrupted && !summary.budgetExhausted && !summary.qualityStopped
    && summary.stopReason !== 'budget_exhausted' && summary.reason !== 'workflow_budget_exhausted'
    && !['failed','warnings','stale','staleSources','concurrentChanges','pendingEstimate','leased'].some(field=>summary[field]>0)
    && !['failed','stale','pending','leased'].some(field=>summary.batchEligibility?.[field]>0)
    && !summary.batchEligibility?.budgetExhausted && !(summary.extractionChecks?.incomplete>0)
    && summary.coverageComplete!==false && summary.health!=='degraded';
 return {
  ...summary,
  handoffReady: outcome === 'completed',
  processingComplete,
  processingStatus: outcome === 'failed' ? 'failed'
    : outcome === 'cancelled' || summary.cancelled || summary.stopReason === 'cancelled' ? 'cancelled' : processingComplete ? 'complete' : 'partial',
  ...(key === 'rewrite' && Number.isFinite(summary.queued) ? {
    unpublishedEstimate: Math.max(0, summary.queued - (summary.published || 0)),
  } : {}),
 };
};
