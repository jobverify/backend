/** Scraper checkpoints contain resolved names; provider metadata can use source instead of name. */
export function capturedSourceNames(checkpoint) {
  const sources=checkpoint?.catalogSources;
  if(checkpoint?.mode!=='dry-run'||checkpoint.status!=='complete'||checkpoint.completedCount!==checkpoint.totalSources||!Array.isArray(sources)||sources.length!==checkpoint.totalSources||sources.some(s=>typeof s!=='string'||!s.trim())||new Set(sources).size!==sources.length)throw new Error('A complete dry-run checkpoint with unique resolved source names is required');
  return sources;
}
