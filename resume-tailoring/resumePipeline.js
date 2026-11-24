import { prepareResumeModel, generateResumeText, RESUME_MODEL } from './resumeRuntime.js';
import { prepareResumeCompiler, compileResumeLatex } from './latexCompiler.js';
import { remainingBudget, withinResumeBudget, RESUME_WORKER_BUDGET_MS, estimateResumeRepairMs } from './resumeBudget.js';
import { safeResumeDiagnostic, resumeFailure, summarizeResumeFidelityIssues } from './resumeDiagnostics.js';
import { applyPaginationRepair, buildPaginationRepairPlan, buildPreservedPreparationPlan, PAGINATION_REPAIR_MAX_TOKENS, RESUME_PIPELINE_POLICY } from './resumePaginationRepair.js';
import { RESUME_LATEX_PREAMBLE } from '../src/utils/resumeLatexFormat.js';
import { buildResumeTailoringPlan } from './resumeTailoringPlan.js';
import { resumePageBudget } from '../src/utils/resumePresentation.js';
import { buildSourceFacts, sourceWithCandidateEvidence, buildPreparationPrompt, buildLatexTailoringPrompt,
  buildLatexRepairPrompt, buildComparisonPrompt, validateLatexSource, validateResumeFidelity, resumeLinkDestinations, resumeSectionTitles, resumeSourceLayout, resumeSubheadingChoices } from '../src/services/resumeLatexContent.js';

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

function resolveTailoringInput({ source, facts, pagination, baseLatex, jobSnapshot }) {
  let reason;
  const options = { source, jobSnapshot, onIncompatible: value => { reason = value; } };
  let plan = buildResumeTailoringPlan({ ...options, baseLatex });
  if (plan) return { plan, baseKind: plan.baseKind };
  const originalReason = reason;
  // Never regenerate a whole tailored document just because a historic saved
  // base is incompatible. Reuse the complete source-preservation path instead.
  const layout = resumeSourceLayout(source, facts, { preserveOriginal: true });
  const preserved = buildPreservedPreparationPlan(layout, pagination);
  if (preserved) {
    const middle = preserved.candidates.reduce((best, candidate) => !best
      || Math.abs(candidate.token.index - preserved.body.length / 2) < Math.abs(best.token.index - preserved.body.length / 2) ? candidate : best, null);
    const rebuilt = applyPaginationRepair(preserved, JSON.stringify({ spacing: 'compact',
      breakBefore: pagination.exact && pagination.targetPages === 2 ? middle?.id : null }));
    plan = buildResumeTailoringPlan({ ...options, baseLatex: rebuilt });
    if (plan) return { plan, layout, baseKind: 'source', reason: originalReason };
  }
  return { baseKind: 'unavailable', reason: reason || originalReason };
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
  const sectionTitles = resumeSectionTitles(source, facts);
  let layout = resumeSourceLayout(source, facts, { preserveOriginal: !tailored });
  const preparationPlan = tailored ? null : buildPreservedPreparationPlan(layout, pagination);
  const resolvedTailoring = tailored ? resolveTailoringInput({ source, facts, pagination, baseLatex: input.baseLatex, jobSnapshot: input.jobSnapshot }) : null;
  let tailoringPlan = resolvedTailoring?.plan;
  if (resolvedTailoring?.layout) layout = resolvedTailoring.layout;
  if (tailored && !tailoringPlan) {
    onDiagnostic(safeResumeDiagnostic({ stage: 'generating', code: 'prepared_resume_incompatible', policyVersion: RESUME_PIPELINE_POLICY,
      mode: 'tailored', generationKind: 'edits', baseKind: 'unavailable', tailoringReason: resolvedTailoring.reason, editSlotCount: 0 }));
    throw resumeFailure('prepared_resume_incompatible', { statusCode: 409 });
  }
  // The bounded planner chooses a safe boundary rather than the word-count
  // estimate. Physical pagination and full factual checks remain mandatory.
  if (preparationPlan || tailoringPlan) layout = { ...layout, pageBreakBefore: undefined, preservationBreak: undefined };
  const headerChoices = resumeSubheadingChoices(facts);
  let originalPrompt = tailored ? buildLatexTailoringPrompt({ ...input, source, facts }) : buildPreparationPrompt({ ...input, source, facts });
  let prompt = originalPrompt;
  let failureCode = 'processing_failed';
  let stage = 'generating';
  let repairPlan, generationUsage = {};
  const started = Date.now();
  // Long CPU generations may exceed eight minutes. Keep them inside the worker
  // deadline while reserving time to compile, inspect and independently audit.
  const generationDeadline = deadline - Math.min(5 * 60000, Math.floor((deadline - started) / 4));
  const phase = async next => {
    stage = next;
    await withinResumeBudget(deadline, signal => onPhase(stage, { deadline, signal }));
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    const diagnose = (code, extra = {}) => onDiagnostic(safeResumeDiagnostic({ stage, code, attempt,
      seconds: (Date.now() - started) / 1000, ...extra }));
    let latex = '', result, issueCounts;
    let paginationOnly = false;
    const issues = [];
    try {
      await phase(attempt === 1 ? 'generating' : 'repairing');
      diagnose('started', { policyVersion: RESUME_PIPELINE_POLICY, mode: tailored ? 'tailored' : 'base',
        targetPages: pagination.targetPages, sourceBlockCount: layout.preservationBlocks?.length || 0,
        generationKind: repairPlan || (attempt === 1 && preparationPlan) ? 'layout' : tailoringPlan ? 'edits' : 'document',
        ...(tailored ? { editSlotCount: tailoringPlan.slotCount, baseKind: resolvedTailoring.baseKind, tailoringReason: resolvedTailoring.reason } : {}),
        ...(attempt === 2 ? { repairKind: repairPlan ? 'pagination' : tailoringPlan ? 'edits' : 'document' } : {}) });
      const generated = await withinResumeBudget(generationDeadline, signal => generate(prompt, { deadline: generationDeadline, signal,
        allowedLinks, pagination, sectionTitles, layout, headerChoices, onDiagnostic,
        ...(attempt === 1 && preparationPlan ? { preparationPlan } : {}),
        ...(tailoringPlan && !repairPlan ? { tailoringPlan } : {}),
        ...(repairPlan ? { paginationRepair: true, paginationBreakIds: repairPlan.candidates.map(candidate => candidate.id) } : {}),
        onUsage: usage => { generationUsage = usage; } }));
      latex = repairPlan ? applyPaginationRepair(repairPlan, generated) : generated;
      await phase('latex');
      latex = validateLatexSource(latex, { requireTemplate: true, pagination, sectionTitles, layout });
      await phase('compiling');
      // Compile the validated model document exactly as generated. Useful links
      // belong inline; never append a generated reference appendix.
      // Generation and compilation failures never publish a different layout.
      result = await withinResumeBudget(deadline, signal => compile(latex, { deadline, signal }));
      await phase('validating');
      if (result.pageCount > pagination.targetPages || (pagination.exact && result.pageCount !== pagination.targetPages)) {
        paginationOnly = true;
        failureCode = 'pagination_failed';
        const target = `${pagination.targetPages} ${pagination.targetPages === 1 ? 'page' : 'pages'}`;
        issues.push(`The compiled PDF has ${result.pageCount} pages; ${pagination.exact ? 'the required layout is exactly' : 'the maximum is'} ${target}. `
          + (result.pageCount < pagination.targetPages
            ? 'Increase the spacing between sections and entries and distribute the existing content over the required pages, using a page break at a natural section boundary if needed. Do not add filler or blank pages. '
            : 'Condense repeated wording, combine related bullets, and reduce excess spacing to fit the page budget. ')
          + 'Preserve the Abey template, protected candidate facts and readable text of at least 10pt.');
        if (layout.pageBreakBefore || layout.preservationBreak) {
          layout = { ...layout, pageBreakBefore: undefined, preservationBreak: undefined };
          issues.push('The estimated section boundary did not fit. Choose a new page break between closed entry lists within a long section if needed.');
        }
      }
      const fidelity = validateResumeFidelity({ facts, text: result.text, links: result.links, tailored });
      if (!fidelity.valid) {
        paginationOnly = false;
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
      paginationOnly = false;
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
    if (attempt === 1) {
      repairPlan = paginationOnly ? buildPaginationRepairPlan(latex, pagination, { pageCount: result.pageCount }) : null;
      if (!repairPlan && !tailored && result?.pageCount > pagination.targetPages && layout.preservationBlocks) {
        layout = { ...layout, condenseOriginal: true };
        originalPrompt = buildPreparationPrompt({ ...input, source, facts, condenseOriginal: true });
        issues.push('Condense the narrative bullet text within its original finite entry and item slots. Preserve fixed headers, grades, dates, skill categories, useful links, and all substantive facts.');
      }
      if (tailoringPlan && !repairPlan) {
        tailoringPlan = buildResumeTailoringPlan({ source, baseLatex: tailoringPlan.baseLatex, jobSnapshot: input.jobSnapshot, issues });
        if (!tailoringPlan) throw resumeFailure('prepared_resume_incompatible', { statusCode: 409 });
      }
      prompt = repairPlan ? repairPlan.prompt : tailoringPlan ? tailoringPlan.prompt : buildLatexRepairPrompt({ originalPrompt, latex, issues });
      const estimatedMs = estimateResumeRepairMs({
        inputCharacters: prompt.length + (repairPlan || tailoringPlan ? 0 : RESUME_LATEX_PREAMBLE.length + (layout.contactHeader?.length || 0)),
        outputTokens: repairPlan ? PAGINATION_REPAIR_MAX_TOKENS : tailoringPlan ? tailoringPlan.maxTokens : generationUsage.outputTokens
          || Math.max(latex ? 512 : 2048, Math.ceil(Math.max(0, latex.length - RESUME_LATEX_PREAMBLE.length) / 3)),
        usage: generationUsage,
      });
      const remainingMs = generationDeadline - Date.now();
      if (estimatedMs > remainingMs) {
        stage = 'repairing';
        diagnose('repair_budget_insufficient', { attempt: 2, repairKind: repairPlan ? 'pagination' : tailoringPlan ? 'edits' : 'document',
          estimatedSeconds: estimatedMs / 1000, remainingSeconds: Math.max(0, remainingMs) / 1000 });
        throw resumeFailure('repair_budget_insufficient');
      }
    }
  }
  throw resumeFailure(failureCode);
}
