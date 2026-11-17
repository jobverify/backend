import test from 'node:test';
import assert from 'node:assert/strict';
import { resumePageBudget } from '../src/utils/resumePresentation.js';
import { buildPreparationPrompt, resumeSourceLayout } from '../src/services/resumeLatexContent.js';
import { processResumeDocument } from '../resume-tailoring/resumePipeline.js';
import { RESUME_LATEX_PREAMBLE, buildResumeLatexGrammar } from '../src/utils/resumeLatexFormat.js';

const source = { pageCount: 2, text: 'Alex Example\nalex@example.test\nPROJECTS\nUseful Tool\nBuilt Python tools.\nEDUCATION\nBSc Computer Science', links: [] };

test('two-page uploads use a ceiling and do not force a midpoint break or padding', () => {
  assert.deepEqual(resumePageBudget(source), { originalPageCount: 2, targetPages: 2, exact: false });
  const layout = resumeSourceLayout(source, undefined, { preserveOriginal: true });
  assert.equal(layout.pageBreakBefore, undefined);
  assert.equal(layout.preservationBreak, undefined);
  const prompt = buildPreparationPrompt({ source });
  assert.doesNotMatch(prompt, /Write exactly 2|Use one \\newpage|small positive spacing between blocks/);
  assert.match(prompt, /natural.*flow|flow.*natural/i);
  const grammar = buildResumeLatexGrammar([], resumePageBudget(source), { layout });
  const commands = grammar.split('\n').find(line => line.startsWith('command ::='));
  assert.doesNotMatch(commands, /"newpage"|"pagebreak"/);
  assert.doesNotMatch(grammar, /page-break ::=/);
});

test('a compact one-page result from a two-page upload is accepted without expansion', async () => {
  const latex = RESUME_LATEX_PREAMBLE + String.raw`\begin{center}Alex Example\end{center}
\section{PROJECTS}
\resumeSubHeadingListStart
\resumeProjectHeading{Useful Tool}{}
\resumeItemListStart
\resumeItem{Built Python tools.}
\resumeItemListEnd
\resumeSubHeadingListEnd
\section{EDUCATION}
\resumeItemListStart
\resumeItem{BSc Computer Science}
\resumeItemListEnd
\end{document}`;
  let generations = 0;
  const result = await processResumeDocument({ source }, {
    generate: async (_prompt, options) => {
      if (options.comparison) return JSON.stringify({ evidence: 'Source retained.', supported: true, missingFacts: [], unsupportedClaims: [] });
      generations++;
      return latex;
    },
    compile: async () => ({ pdf: Buffer.from('%PDF-fixture'), pageCount: 1, text: source.text, links: [] }),
  });
  assert.equal(result.pageCount, 1);
  assert.equal(generations, 1);
});
