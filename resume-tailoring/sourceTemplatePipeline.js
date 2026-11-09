import { remainingBudget, withinResumeBudget } from './resumeBudget.js';
import { inspectResumePdf } from './latexCompiler.js';
import { safeResumeDiagnostic, resumeFailure } from './resumeDiagnostics.js';
import { validateResumeFidelity } from '../src/services/resumeLatexContent.js';
import { buildSourceTemplate, renderSourceTemplate, templateTextKey, SOURCE_TEMPLATE_VERSION, SOURCE_TEMPLATE_STYLE } from './sourceTemplate.js';

// Synthetic fixtures and template regression checks only. The application
// worker uses the model-backed resumePipeline.js and never falls back here.
export async function processSourceTemplateDocument(input, { deadline = Date.now() + 60000,
  onPhase = async () => {}, onDiagnostic = () => {}, render = renderSourceTemplate, inspect = inspectResumePdf } = {}) {
  const started = Date.now();
  let stage = 'formatting';
  const diagnose = (code, extra = {}) => onDiagnostic(safeResumeDiagnostic({ stage, code, seconds: (Date.now() - started) / 1000, ...extra }));
  const phase = () => withinResumeBudget(deadline, signal => onPhase(stage, { deadline, signal }));
  try {
    remainingBudget(deadline, 60000);
    await phase(); diagnose('started');
    const document = buildSourceTemplate(input);
    stage = 'rendering'; await phase(); diagnose('started');
    const pdf = await withinResumeBudget(deadline, signal => render(document, { deadline, signal }));
    remainingBudget(deadline, 60000);
    stage = 'validating'; await phase();
    const result = await withinResumeBudget(deadline, signal => inspect(pdf, { deadline, signal }));
    remainingBudget(deadline, 60000);
    if (input.mode === 'tailored' && result.pageCount > 2) throw resumeFailure('pagination_failed');
    // Exact text coverage complements the existing protected-fact checks. The
    // only new text is trusted section labels and original link destinations.
    // Once the extracted characters and their order match exactly, restore the
    // template's logical whitespace for fact checks. PDF wrapping may split an
    // email or a word even though every visible character is preserved.
    const textPreserved = templateTextKey(result.text) === templateTextKey(document.text);
    const fidelity = textPreserved ? validateResumeFidelity({ facts: document.facts, text: document.text, links: result.links, tailored: input.mode === 'tailored' }) : { valid: false, issues: [] };
    if (!fidelity.valid) {
      diagnose('factual_validation_failed', { issueCount: Math.max(1, fidelity.issues.length) });
      throw resumeFailure('factual_validation_failed');
    }
    stage = 'completed'; diagnose('passed', { pageCount: result.pageCount });
    return { latex: document.latex, pdf, pageCount: result.pageCount, facts: document.facts,
      modelVersion: SOURCE_TEMPLATE_VERSION, styleVersion: SOURCE_TEMPLATE_STYLE };
  } catch (error) {
    const code = safeResumeDiagnostic({ stage, code: error.code || (stage === 'validating' ? 'pdf_invalid' : 'processing_failed') }).code;
    diagnose(code);
    throw resumeFailure(code, { statusCode: error.statusCode || 502 });
  }
}
