import test from 'node:test';
import assert from 'node:assert/strict';
import { processResumeDocument } from '../resume-tailoring/resumePipeline.js';
import { buildPreparationPrompt, buildLatexTailoringPrompt, validateLatexSource } from '../src/services/resumeLatexContent.js';
import { RESUME_LATEX_PREAMBLE } from '../src/utils/resumeLatexFormat.js';

const source = { text: 'Alex Example\nalex@example.test\nEXPERIENCE\nDeveloper | Cedar Labs | Jan 2022 - Present\nBuilt Python services and automated tests.\nEDUCATION\nBSc Computer Science | Valley University | 2018 - 2021', links: ['mailto:alex@example.test'] };
const latex = RESUME_LATEX_PREAMBLE + String.raw`\begin{center}
{\Huge \scshape Alex Example} \\
\href{mailto:alex@example.test}{alex@example.test}
\end{center}
\section{EXPERIENCE}
\resumeSubHeadingListStart
\resumeSubheading{Cedar Labs}{Jan 2022 -- Present}{Developer}{}
\resumeItemListStart
\resumeItem{Built Python services and automated tests.}
\resumeItemListEnd
\resumeSubHeadingListEnd
\section{EDUCATION}
\resumeSubHeadingListStart
\resumeSubheading{Valley University}{2018 -- 2021}{BSc Computer Science}{}
\resumeSubHeadingListEnd
\end{document}`;
const supported = JSON.stringify({ evidence: 'Original facts retained.', supported: true, missingFacts: [], unsupportedClaims: [] });
const compiled = { pdf: Buffer.from('%PDF-fixture'), text: source.text, links: source.links };

for (const mode of ['base', 'tailored']) {
  for (const [originalPages, firstPages, expectedPages] of [[1, 2, 1], [2, 1, 2], [3, 3, 2]]) {
    test(`${mode}: ${originalPages}-page input is revised to exactly ${expectedPages} pages`, async () => {
      let generations = 0, compilations = 0, comparisons = 0;
      const result = await processResumeDocument({ mode, source: { ...source, pageCount: originalPages }, baseLatex: latex }, {
        generate: async (prompt, options) => {
          if (options.comparison) { comparisons++; return supported; }
          if (++generations === 2) {
            const feedback = JSON.parse(prompt.split('\n').at(-1));
            assert.ok(feedback.issues.some(issue => issue.includes(String(firstPages)) && /page/i.test(issue)));
            assert.match(prompt, /spacing/i);
          }
          return latex;
        },
        compile: async () => ({ ...compiled, pageCount: ++compilations === 1 ? firstPages : expectedPages }),
      });
      assert.equal(generations, 2);
      assert.equal(result.pageCount, expectedPages);
      assert.equal(comparisons, 1, 'audit only the document with the required page count');
    });
  }

  test(`${mode}: a second page-count mismatch never publishes a document`, async () => {
    let generations = 0, comparisons = 0;
    await assert.rejects(processResumeDocument({ mode, source: { ...source, pageCount: 1 }, baseLatex: latex }, {
      generate: async (_prompt, options) => { if (options.comparison) { comparisons++; return supported; } generations++; return latex; },
      compile: async () => ({ ...compiled, pageCount: 2 }),
    }), { code: 'pagination_failed' });
    assert.equal(generations, 2);
    assert.equal(comparisons, 0);
  });
}

test('generation receives the original page count, exact target and spacing guidance', () => {
  for (const [inputPages, targetPages] of [[1, 1], [2, 2], [3, 2]]) {
    for (const prompt of [buildPreparationPrompt({ source: { ...source, pageCount: inputPages } }),
      buildLatexTailoringPrompt({ source: { ...source, pageCount: inputPages }, baseLatex: latex })]) {
      const payload = JSON.parse(prompt.split('\n').find(line => line.startsWith('{"originalResume":')));
      assert.deepEqual(payload.pagination, { originalPageCount: inputPages, targetPages, exact: true });
      assert.match(prompt, /spacing/i);
      assert.match(prompt, /10\s*pt/i);
      assert.doesNotMatch(prompt, /Use the pages needed/);
    }
  }
});

test('unpaginated source formats allow a readable one-page result without padding', async () => {
  const prompt = buildPreparationPrompt({ source });
  const payload = JSON.parse(prompt.split('\n').find(line => line.startsWith('{"originalResume":')));
  assert.deepEqual(payload.pagination, { originalPageCount: null, targetPages: 2, exact: false });
  const result = await processResumeDocument({ source }, {
    generate: async (_prompt, options) => options.comparison ? supported : latex,
    compile: async () => ({ ...compiled, pageCount: 1 }),
  });
  assert.equal(result.pageCount, 1);
});

test('omitted unused reference annotations never become an appended Links section', async () => {
  const original = { ...source, links: [...source.links, 'https://example.test/unused-certificate-reference', 'mailto:yourname@example.test'] };
  let generations = 0;
  const result = await processResumeDocument({ source: original }, {
    generate: async (_prompt, options) => options.comparison ? supported : (generations++, latex),
    compile: async document => { assert.equal(document, latex); return { ...compiled, pageCount: 2 }; },
  });
  assert.equal(generations, 1);
  assert.equal(result.latex, latex);
});

test('a missing visible profile link is repaired inline without an appendix', async () => {
  const link = 'https://github.com/alex-example';
  const original = { ...source, text: source.text + '\nGitHub: alex-example', links: [...source.links, link] };
  let generations = 0;
  const linked = latex.replace('\\end{center}', `\\href{${link}}{alex-example}\n\\end{center}`);
  const result = await processResumeDocument({ source: original }, {
    generate: async (_prompt, options) => options.comparison ? supported : ++generations === 1 ? latex : linked,
    compile: async document => ({ ...compiled, text: original.text, pageCount: 2,
      links: document.includes(`\\href{${link}}`) ? original.links : source.links }),
  });
  assert.equal(generations, 2);
  assert.equal(result.latex, linked);
  assert.doesNotMatch(result.latex, /\\section\*?\{Links\}|Original link/);
});

test('new output cannot add a standalone Links section or generic Original link labels', () => {
  for (const extra of [String.raw`\section{Links}\href{https://example.test}{Website}`,
    String.raw`\section*{Additional Links}\href{https://example.test}{Website}`,
    String.raw`\paragraph{Links}\href{https://example.test}{Website}`,
    String.raw`\href{https://example.test}{Original link}`]) {
    assert.throws(() => validateLatexSource(latex.replace('\\end{document}', `${extra}\n\\end{document}`), { requireTemplate: true }),
      error => error.reason === 'link_placement');
  }
});
