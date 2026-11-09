import {buildRewriteInput} from '../src/services/jobDescriptionPolicy.js';

/** Candidate selection for the isolated recovery experiment, never the live scraper. */
export function publicSourceCandidate(original, enriched) {
  if (buildRewriteInput(original).sourceDescription.trim()) return {kind: 'already_present'};
  const description = String(enriched?.jobDescription || enriched?.description || '').trim();
  if (!description) return {kind: 'missing'};
  const job = {...original, sourceDescription: description, description, jobDescription: description};
  const input = buildRewriteInput(job);
  // Fetch success and word count cannot prove completeness or role identity.
  const kind = /(?:\.\.\.|\u2026)\s*$/.test(description) ? 'listing_excerpt'
    : input.sourceWords < 25 ? 'short_text' : 'candidate';
  return {kind, job, input, requiresEmployerPageReview: true};
}
