import { prepareResumeModel, generateResumeText, RESUME_MODEL } from './resumeRuntime.js';
import { prepareResumeCompiler, compileResumeLatex } from './latexCompiler.js';
import { remainingBudget, withinResumeBudget, RESUME_WORKER_BUDGET_MS } from './resumeBudget.js';
import { safeResumeDiagnostic, resumeFailure, summarizeResumeFidelityIssues } from './resumeDiagnostics.js';
import { resumePageBudget } from '../src/utils/resumePresentation.js';
import { buildSourceFacts, sourceWithCandidateEvidence, buildPreparationPrompt, buildLatexTailoringPrompt,
  buildLatexRepairPrompt, buildComparisonPrompt, validateLatexSource, validateResumeFidelity, resumeLinkDestinations } from '../src/services/resumeLatexContent.js';

export async function prepareResumeRuntime({ deadline = Date.now() + RESUME_WORKER_BUDGET_MS,
  prepareCompiler = prepareResumeCompiler, prepareModel = prepareResumeModel, ...options } = {}) {
  remainingBudget(deadline, RESUME_WORKER_BUDGET_MS);
  try { await prepareCompiler({ deadline }); }
  catch (error) { throw resumeFailure(error.code || 'compiler_failed', { statusCode: error.statusCode || 502 }); }
  try { return await prepareModel({ ...options, deadline }); }
  catch (error) { throw resumeFailure(error.code || 'model_unavailable', { statusCode: error.statusCode || 502 }); }
}

function readComparison(value) {
  let result;
  try { result = JSON.parse(value); } catch { throw resumeFailure('comparison_invalid'); }
  if (!result || typeof result.evidence !== 'string' || !result.evidence.trim() || typeof result.supported !== 'boolean'
    || !['missingFacts', 'unsupportedClaims'].every(key => Array.isArray(result[key]) && result[key].every(item => typeof item === 'string'))) {
    throw resumeFailure('comparison_invalid');
  }
  return result;
}

export async function processResumeDocument(input, { deadline = Date.now() + RESUME_WORKER_BUDGET_MS,
  onPhase = async () => {}, onDiagnostic = () => {}, generate = generateResumeText, compile = compileResumeLatex } = {}) {
  remainingBudget(deadline, RESUME_WORKER_BUDGET_MS);
  const tailored = input.mode === 'tailored';
  const source = sourceWithCandidateEvidence(input.source, input.candidateEvidence);
  const pagination = resumePageBudget(source);
  // Always derive protections from this request's source, including new profile
  // evidence. Historic artifact metadata cannot weaken factual validation.
  const facts = buildSourceFacts(source);
  const allowedLinks = resumeLinkDestinations(facts);
  const originalPrompt = tailored ? buildLatexTailoringPrompt({ ...input, source, facts }) : buildPreparationPrompt({ ...input, source, facts });
  let prompt = originalPrompt;
  let failureCode = 'processing_failed';
  let stage = 'generating';
  const started = Date.now();
  // Long CPU generations may exceed eight minutes. Keep them inside the worker
  // deadline while reserving time to compile, inspect and independently audit.
  const generationDeadline = deadline - Math.min(3 * 60000, Math.floor((deadline - started) / 5));
  const phase = async next => {
    stage = next;
    await withinResumeBudget(deadline, signal => onPhase(stage, { deadline, signal }));
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    const diagnose = (code, extra = {}) => onDiagnostic(safeResumeDiagnostic({ stage, code, attempt,
      seconds: (Date.now() - started) / 1000, ...extra }));
    let latex = '', result, issueCounts;
    const issues = [];
    try {
      await phase(attempt === 1 ? 'generating' : 'repairing');
      diagnose('started');
      latex = await withinResumeBudget(generationDeadline, signal => generate(prompt, { deadline: generationDeadline, signal, allowedLinks, onDiagnostic }));
      await phase('latex');
      latex = validateLatexSource(latex, { requireTemplate: true });
      await phase('compiling');
      // Compile the validated model document exactly as generated. Useful links
      // belong inline; never append a generated reference appendix.
      // Generation and compilation failures never publish a different layout.
      result = await withinResumeBudget(deadline, signal => compile(latex, { deadline, signal }));
      await phase('validating');
      if (result.pageCount > pagination.targetPages || (pagination.exact && result.pageCount !== pagination.targetPages)) {
        failureCode = 'pagination_failed';
        const target = `${pagination.targetPages} ${pagination.targetPages === 1 ? 'page' : 'pages'}`;
        issues.push(`The compiled PDF has ${result.pageCount} pages; ${pagination.exact ? 'the required layout is exactly' : 'the maximum is'} ${target}. `
          + (result.pageCount < pagination.targetPages
            ? 'Increase the spacing between sections and entries and distribute the existing content over the required pages, using a page break at a natural section boundary if needed. Do not add filler or blank pages. '
            : 'Condense repeated wording, combine related bullets, and reduce excess spacing to fit the page budget. ')
          + 'Preserve the Abey template, protected candidate facts and readable text of at least 10pt.');
      }
      const fidelity = validateResumeFidelity({ facts, text: result.text, links: result.links, tailored });
      if (!fidelity.valid) {
        failureCode = 'factual_validation_failed';
        issues.push(...fidelity.issues);
        issueCounts = summarizeResumeFidelityIssues(fidelity.issues);
      }
      // Avoid spending a comparison call on a document that already needs repair.
      if (!issues.length) {
        await phase('comparing');
        const comparison = readComparison(await withinResumeBudget(deadline, signal => generate(
          buildComparisonPrompt({ source, facts, latexText: result.text, links: result.links, tailored }),
          { deadline, signal, comparison: true, onDiagnostic })));
        if (!comparison.supported || comparison.missingFacts.length || comparison.unsupportedClaims.length) {
          failureCode = 'factual_validation_failed';
          issues.push('The independent factual comparison did not confirm the document.',
            ...comparison.missingFacts.map(fact => `Missing source fact: ${fact}`),
            ...comparison.unsupportedClaims.map(claim => `Unsupported claim: ${claim}`));
        }
      }
      if (issues.length) diagnose(failureCode, { issueCount: issues.length, pageCount: result.pageCount, issueCounts });
    } catch (error) {
      failureCode = safeResumeDiagnostic({ stage, code: error.code || ({ latex: 'latex_invalid', compiling: 'compiler_failed',
        validating: 'pdf_invalid', comparing: 'comparison_invalid' }[stage]) }).code;
      diagnose(failureCode, { reason: error.reason });
      if (error.statusCode === 422 || ['time_limit', 'compiler_dependency_missing', 'compiler_resource_limit', 'model_unavailable'].includes(failureCode)) {
        throw resumeFailure(failureCode, { statusCode: error.statusCode || 502 });
      }
      // Raw compiler diagnostics never leave the compiler. Inspection and
      // factual feedback stay in the private model request, never public logs.
      issues.push(error.message);
    }
    if (!issues.length && result) {
      remainingBudget(deadline, RESUME_WORKER_BUDGET_MS);
      stage = 'completed'; diagnose('passed', { pageCount: result.pageCount });
      return { latex, pdf: result.pdf, pageCount: result.pageCount, facts,
        modelVersion: `${RESUME_MODEL.modelId}@${RESUME_MODEL.revision}:${RESUME_MODEL.sha256}`, styleVersion: RESUME_MODEL.styleVersion };
    }
    if (attempt === 1) prompt = buildLatexRepairPrompt({ originalPrompt, latex, issues });
  }
  throw resumeFailure(failureCode);
}
