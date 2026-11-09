import { getSourceDescription } from '../utils/jobSourceContent.js';
import { buildRewriteInput } from './jobDescriptionPolicy.js';

/** Classification's input selection is separate from immutable employer provenance. */
export function selectClassificationDescription(job={}) {
  const rewrite=job.descriptionRewrite;
  if (rewrite?.status==='published' && job.sourceContentHash && rewrite.inputHash===job.sourceContentHash
    && typeof job.description==='string' && job.description.trim()
    && buildRewriteInput(job).inputHash===job.sourceContentHash) {
    return {text:job.description,origin:'rewrite',identity:{inputHash:rewrite.inputHash,policyVersion:rewrite.policyVersion,
      modelRevision:rewrite.modelRevision,publishedAt:rewrite.publishedAt}};
  }
  return {text:getSourceDescription(job),origin:'source',identity:null};
}
