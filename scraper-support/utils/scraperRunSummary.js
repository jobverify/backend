import { isCompleteScraperAttempt, isFreshCompleteInventoryEvidence } from './inventoryEvidence.js';
import { scraperTaskOutcome } from './scraperOutcome.js';
import { summarizeJobYield } from './jobYield.js';

/** Task completion, listing evidence and complete extraction are independent measurements. */
export const summarizeScraperRun = (rows = [], { interrupted = false, persistencePending = false } = {}) => {
  const taskOutcomes = { succeeded: 0, skipped: 0, softFailed: 0, hardFailed: 0 };
  let complete = 0, completeExtractions = 0, partialSuccessfulTasks = 0;
  for (const row of rows) {
    taskOutcomes[scraperTaskOutcome(row)]++;
    if (isFreshCompleteInventoryEvidence(row.inventoryEvidence, { now: row.completedAt || new Date() })) complete++;
    if (isCompleteScraperAttempt(row)) completeExtractions++;
    else if (scraperTaskOutcome(row) === 'succeeded') partialSuccessfulTasks++;
  }
  return {
    scanned: rows.length, completed: taskOutcomes.succeeded + taskOutcomes.skipped,
    skipped: taskOutcomes.skipped, failed: taskOutcomes.hardFailed,
    warnings: taskOutcomes.softFailed + taskOutcomes.hardFailed,
    taskOutcomes, inventoryChecks: { complete, withoutCompleteEvidence: rows.length - complete },
    extractionChecks: { complete: completeExtractions, incomplete: rows.length - completeExtractions },
    partialSuccessfulTasks,
    failedTasks: taskOutcomes.softFailed + taskOutcomes.hardFailed,
    coverageComplete: rows.length > 0 && completeExtractions === rows.length,
    health: !rows.length ? 'unknown' : completeExtractions === rows.length ? 'healthy' : 'degraded',
    jobYield: summarizeJobYield(rows),
    inserted: rows.reduce((sum, row) => sum + (row.inserted || 0), 0),
    updated: rows.reduce((sum, row) => sum + (row.updated || 0), 0),
    interrupted, pendingEstimate: rows.filter(row => row.classificationPending || row.persistencePending).length + Number(Boolean(persistencePending)),
  };
};
