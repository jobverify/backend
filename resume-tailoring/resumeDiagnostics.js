import { RESUME_LATEX_REASONS } from '../src/utils/resumeLatexValidation.js';

export const RESUME_COMPILER_REASONS = Object.freeze({
  alignment_tab: 'Escape literal ampersands in resume text and macro arguments as \\&. Use alignment tabs only in table rows.',
  undefined_command: 'The document uses an undefined command. Use only commands and icons supported by the supplied Abey template.',
  math_delimiter: 'Repair unmatched math delimiters and escape literal dollar signs and underscores. Use \\textbar{} for separators.',
  unbalanced_group: 'Balance every brace and close every command argument. Keep all candidate content inside the complete document.',
  environment_mismatch: 'Match each environment opening with its closing command in the correct order, including the Abey list macros.',
  missing_item: 'Every list needs an item. Use Abey entry macros inside the heading list and \\resumeItem inside the item list; close both lists.',
});

// Public Actions logs must never contain candidate data or raw exception text.
const failures = {
  tailoring_plan_invalid: 'The tailored resume edit plan was invalid. Please retry generation.',
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
  pagination_failed: 'The resume did not fit its required one- or two-page layout after revision. Please retry.',
  pagination_repair_invalid: 'The resume layout correction was invalid. Your previous successful version is unchanged. Please retry.',
  repair_budget_insufficient: 'There was not enough processing time for a complete repair and factual audit. Your previous successful version is unchanged. Please retry.',
  comparison_invalid: 'The factual comparison returned an invalid response after one repair. Please retry.',
  input_too_large: 'The complete resume and profile exceed the supported input limit. Use a shorter source document and retry; no content was truncated.',
  time_limit: 'The resume processing time limit was reached. Please retry.',
};
const stages = new Set(['worker', 'startup', 'formatting', 'rendering', 'generating', 'repairing', 'latex', 'compiling', 'validating', 'comparing', 'completed']);
const codes = new Set([...Object.keys(failures), 'started', 'progress', 'passed']);
const fidelityIssuePatterns = {
  identity: /^Missing or changed candidate name\./,
  contact: /^(?:Missing original visible (?:email|phone number)|Unsupported or changed (?:email|phone number)|(?:Email|Phone) link target does not match)/,
  link: /^(?:Invalid or unsafe generated link destination|Missing or changed original link|Unsupported portfolio or profile link)/,
  employment: /^(?:Missing or changed employment|Duplicated employment entry):/,
  education: /^(?:Missing or changed education|Duplicated education entry):/,
  date: /^(?:Date no longer associated with |Missing or changed original date:|Unsupported date:)/,
  metric: /^(?:Unsupported number or metric|Missing original metric):/,
  skill: /^Unsupported candidate skill:/,
  title: /^Unsupported candidate title:/,
};
const fidelityIssueTypes = [...Object.keys(fidelityIssuePatterns), 'other'];

// Discard private validation feedback; only fixed categories and counts may be
// written to Actions logs. Unrecognised feedback is counted without its text.
export function summarizeResumeFidelityIssues(issues = []) {
  const counts = {};
  for (const issue of Array.isArray(issues) ? issues : []) {
    const type = Object.keys(fidelityIssuePatterns).find(key => typeof issue === 'string' && fidelityIssuePatterns[key].test(issue)) || 'other';
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

export function safeResumeDiagnostic(event = {}) {
  const result = { stage: stages.has(event.stage) ? event.stage : 'worker', code: codes.has(event.code) ? event.code : 'processing_failed' };
  if (result.stage === 'latex' && result.code === 'latex_invalid' && typeof event.reason === 'string' && Object.hasOwn(RESUME_LATEX_REASONS, event.reason)) result.reason = event.reason;
  if (result.stage === 'compiling' && result.code === 'compiler_failed' && typeof event.reason === 'string' && Object.hasOwn(RESUME_COMPILER_REASONS, event.reason)) result.reason = event.reason;
  for (const key of ['attempt', 'seconds', 'issueCount', 'inputTokens', 'processedTokens', 'outputTokens', 'pageCount', 'targetPages', 'sourceBlockCount', 'editSlotCount', 'estimatedSeconds', 'remainingSeconds']) {
    if (typeof event[key] === 'number' && Number.isFinite(event[key]) && event[key] >= 0 && event[key] <= 1000000) result[key] = Math.round(event[key] * 100) / 100;
  }
  if (event.policyVersion === 'abey-pagination-v2') result.policyVersion = event.policyVersion;
  if (['base', 'tailored'].includes(event.mode)) result.mode = event.mode;
  if (['pagination', 'document', 'edits'].includes(event.repairKind)) result.repairKind = event.repairKind;
  if (result.stage === 'validating' && result.code === 'factual_validation_failed' && event.issueCounts && typeof event.issueCounts === 'object') {
    const counts = {};
    for (const key of fidelityIssueTypes) {
      const count = event.issueCounts[key];
      if (Number.isInteger(count) && count > 0 && count <= 1000000) counts[key] = count;
    }
    if (Object.keys(counts).length) result.issueCounts = counts;
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
