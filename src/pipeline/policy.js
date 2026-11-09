export const STAGES = ['scraper', 'rewrite', 'classification'];
export const WORKFLOWS = { scraper: 'scraper.yml', rewrite: 'rewrite-descriptions.yml', classification: 'classify-jobs.yml' };
export const WORKFLOW_NAMES = { 'Jobverify Scraper Cron': 'scraper', 'Jobverify Description Rewrite': 'rewrite', 'Jobverify Post-scrape Classification': 'classification' };
export const defaultConfiguration = () => ({ stages: STAGES.map(key => ({ key, enabled: true })) });
export function validateConfiguration(value) {
  const stages=value?.stages;
  if (!Array.isArray(stages) || stages.length!==3 || new Set(stages.map(s=>s?.key)).size!==3
    || stages.some(s=>!STAGES.includes(s?.key)||typeof s.enabled!=='boolean') || !stages.some(s=>s.enabled)) {
    throw Object.assign(new Error('Provide all three unique pipeline stages and enable at least one.'),{status:400});
  }
  return {stages:stages.map(({key,enabled})=>({key,enabled}))};
}
export const directConfiguration = start => {
  if (!STAGES.includes(start)) throw new Error('Unknown stage');
  return {stages:STAGES.map((key,i)=>({key,enabled:i>=STAGES.indexOf(start)}))};
};
export const createStages = config => config.stages.map(s=>({...s,status:s.enabled?'waiting':'disabled'}));
export function stageOutcome(key, summary={}, code=0) {
  if (['worker_error','disabled'].includes(summary.reason)) return 'failed';
  if (key === 'scraper' && code !== 0) return 'failed';
  if (key==='rewrite') {
    // A normal budget stop leaves durable work for a later run. It must not
    // block classification, and it must never conceal an execution failure.
    if (code!==0 || summary.errorType || summary.stale>0 || summary.missingShards?.length || summary.failedShards?.length) return 'failed';
    // One runner's normal budget/quality handoff cannot hide unfinished peers.
    if (summary.incompleteShards?.length) return 'incomplete';
    if (summary.cancelled || summary.stopReason==='cancelled') return 'incomplete';
    if (summary.qualityStopped && summary.reason==='model_quality_unavailable') return 'completed';
    if (summary.stopReason==='budget_exhausted' || summary.budgetExhausted || summary.reason==='workflow_budget_exhausted') return 'completed';
  }
  if (summary.interrupted || summary.budgetExhausted || summary.pendingEstimate>0 || summary.leased>0 || ['interrupted','workflow_budget_exhausted'].includes(summary.reason)) return 'incomplete';
  // Individual rewrite failures retain employer content; only execution errors block handoff.
  if (code!==0 || summary.stale>0 || (key!=='rewrite' && ((key!=='scraper'&&summary.failed>0) || summary.staleSources>0 || summary.concurrentChanges>0))) return 'failed';
  return 'completed';
}
export const isTerminal = status => ['completed','failed','incomplete','cancelled','interrupted'].includes(status);

/** A successful handoff may still leave queue work and rejected items. */
export const describeStageCompletion = (key, summary = {}, outcome) => ({
  ...summary,
  handoffReady: outcome === 'completed',
  processingComplete: outcome === 'completed' && !summary.interrupted && !summary.budgetExhausted && !summary.qualityStopped
    && summary.stopReason !== 'budget_exhausted' && summary.reason !== 'workflow_budget_exhausted'
    && !(summary.pendingEstimate > 0) && !(summary.leased > 0),
  ...(key === 'rewrite' && Number.isFinite(summary.queued) ? {
    unpublishedEstimate: Math.max(0, summary.queued - (summary.published || 0)),
  } : {}),
});
