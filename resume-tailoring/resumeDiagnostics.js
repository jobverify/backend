import { RESUME_LATEX_REASONS } from '../src/utils/resumeLatexValidation.js';

// Public Actions logs must never contain candidate data or raw exception text.
const failures = {
  processing_failed: 'Resume processing failed. Your previous successful version is unchanged. Please retry.',
  source_invalid: 'The resume contains unreadable text or unsupported characters. Please upload a readable source document.',
  model_timeout: 'The resume model reached its time limit. Please retry.',
  model_unavailable: 'The local resume model is unavailable. Please retry.',
  model_output_incomplete: 'The resume model returned an incomplete document after one repair. Please retry.',
  model_protocol_invalid: 'The resume model returned an invalid response. Please retry.',
  latex_invalid: 'The generated LaTeX failed validation after one repair. Please retry.',
  compiler_failed: 'The generated resume could not be compiled after one repair. Please retry.',
  compiler_dependency_missing: 'The PDF compiler is missing a required dependency. Please retry after the compiler setup is updated.',
  compiler_resource_limit: 'The PDF compiler reached its resource limit. Please retry.',
  pdf_invalid: 'The generated PDF failed readability validation after one repair. Please retry.',
  factual_validation_failed: 'The generated document could not preserve the source facts. Your previous successful version is unchanged. Please retry.',
  pagination_failed: 'The original content cannot fit into two readable pages without losing facts. Shorten the source resume and retry.',
  comparison_invalid: 'The factual comparison returned an invalid response after one repair. Please retry.',
  input_too_large: 'The complete resume and profile exceed the supported input limit. Use a shorter source document and retry; no content was truncated.',
  time_limit: 'The resume processing time limit was reached. Please retry.',
};
const stages = new Set(['worker', 'startup', 'formatting', 'rendering', 'generating', 'repairing', 'latex', 'compiling', 'validating', 'comparing', 'completed']);
const codes = new Set([...Object.keys(failures), 'started', 'passed']);

export function safeResumeDiagnostic(event = {}) {
  const result = { stage: stages.has(event.stage) ? event.stage : 'worker', code: codes.has(event.code) ? event.code : 'processing_failed' };
  if (result.stage === 'latex' && result.code === 'latex_invalid' && typeof event.reason === 'string' && Object.hasOwn(RESUME_LATEX_REASONS, event.reason)) result.reason = event.reason;
  for (const key of ['attempt', 'seconds', 'issueCount', 'inputTokens', 'outputTokens', 'pageCount']) {
    if (typeof event[key] === 'number' && Number.isFinite(event[key]) && event[key] >= 0 && event[key] <= 1000000) result[key] = Math.round(event[key] * 100) / 100;
  }
  return result;
}
export function resumeFailure(code, { statusCode = 502 } = {}) {
  const safeCode = Object.hasOwn(failures, code) ? code : 'processing_failed';
  return Object.assign(new Error(failures[safeCode]), { code: safeCode, statusCode });
}
export function reportResumeDiagnostic(event) {
  console.log(JSON.stringify({ resumeDiagnostic: safeResumeDiagnostic(event) }));
}
