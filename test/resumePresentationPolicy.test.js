import test from 'node:test';
import assert from 'node:assert/strict';
import { processResumeDocument } from '../resume-tailoring/resumePipeline.js';
import { buildPreparationPrompt, buildLatexTailoringPrompt, validateLatexSource, resumeSectionTitles, buildSourceFacts } from '../src/services/resumeLatexContent.js';
import * as resumeContent from '../src/services/resumeLatexContent.js';
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
      const pagePlans = [];
      const result = await processResumeDocument({ mode, source: { ...source, pageCount: originalPages }, baseLatex: latex }, {
        generate: async (prompt, options) => {
          if (options.comparison) { comparisons++; return supported; }
          pagePlans.push(options.layout.pageBreakBefore || null);
          assert.deepEqual(options.pagination, { originalPageCount: originalPages, targetPages: expectedPages, exact: true });
          if (++generations === 2) {
            assert.equal(options.paginationRepair, true);
            assert.ok(prompt.includes(`currently has ${firstPages} pages`));
            assert.match(prompt, /spacing/i);
            assert.doesNotMatch(prompt, /Alex Example|Cedar Labs|documentclass/);
            return JSON.stringify({ spacing: firstPages > expectedPages ? 'compact' : 'original', breakBefore: expectedPages === 2 ? 0 : null });
          }
          return expectedPages === 2 ? latex.replace('\\section{EDUCATION}', '\\newpage\n\\section{EDUCATION}') : latex;
        },
        compile: async () => ({ ...compiled, pageCount: ++compilations === 1 ? firstPages : expectedPages }),
      });
      assert.equal(generations, 2);
      assert.deepEqual(pagePlans, expectedPages === 2 ? ['EDUCATION', null] : [null, null], 'a failed physical page count releases the estimated break for repair');
      assert.equal(result.pageCount, expectedPages);
      assert.equal(comparisons, 1, 'audit only the document with the required page count');
    });
  }

  test(`${mode}: a second page-count mismatch never publishes a document`, async () => {
    let generations = 0, comparisons = 0;
    await assert.rejects(processResumeDocument({ mode, source: { ...source, pageCount: 1 }, baseLatex: latex }, {
      generate: async (_prompt, options) => {
        if (options.comparison) { comparisons++; return supported; }
        generations++;
        return options.paginationRepair ? '{"spacing":"compact","breakBefore":null}' : latex;
      },
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

test('final generation instructions require a page break for two pages and preserve academic grades', () => {
  const graded = { ...source, pageCount: 2, text: source.text + '\nCGPA: 7.49' };
  for (const prompt of [buildPreparationPrompt({ source: graded }), buildLatexTailoringPrompt({ source: graded, baseLatex: latex })]) {
    const finalRules = prompt.slice(prompt.indexOf('\nFINAL DOCUMENT REQUIREMENTS:'));
    assert.match(finalRules, /exactly two nonempty pages/);
    assert.match(finalRules, /exactly one \\newpage/);
    assert.match(finalRules, /CGPA: 7\.49/);
    assert.match(finalRules, /unknown.*\{\}/i);
    assert.match(finalRules, /source section order/);
  }
  assert.match(buildPreparationPrompt({ source: { ...source, pageCount: 1 } }), /FINAL DOCUMENT REQUIREMENTS:.*exactly one page/);
  assert.doesNotMatch(buildPreparationPrompt({ source }), /exactly one \\newpage/);
});

test('two-page preflight rejects a trailing page break before spending a compiler call', () => {
  const pagination = { exact: true, targetPages: 2 };
  const trailing = latex.replace('\\end{document}', '\\newpage\n\\end{document}');
  assert.throws(() => validateLatexSource(trailing, { requireTemplate: true, pagination }), { reason: 'pagination_structure' });
  const distributed = latex.replace('\\section{EDUCATION}', '\\newpage\n\\section{EDUCATION}');
  assert.equal(validateLatexSource(distributed, { requireTemplate: true, pagination }), distributed);
});

test('unsupported template sections fail before compilation while unfamiliar source headings remain valid', () => {
  const sectionTitles = resumeSectionTitles({ ...source, text: source.text + '\nResearch & Development' });
  const unsupported = latex.replace('\\end{document}', '\\section{CERTIFICATIONS}\n\\resumeItemListStart\n\\resumeItem{No certifications listed}\n\\resumeItemListEnd\n\\end{document}');
  assert.throws(() => validateLatexSource(unsupported, { requireTemplate: true, sectionTitles }), { reason: 'section_source' });
  const unfamiliar = latex.replace('\\section{EDUCATION}', '\\section{Research \\& Development}');
  assert.equal(validateLatexSource(unfamiliar, { requireTemplate: true, sectionTitles }), unfamiliar);
});

test('source section choices preserve unfamiliar headings and exclude template-only sections', () => {
  const titles = resumeSectionTitles({ ...source, text: source.text + '\nVolunteer Experience\nResearch & Development\nHelped with peer code reviews.' });
  assert.ok(titles.includes('EXPERIENCE') && titles.includes('EDUCATION'));
  assert.ok(titles.includes('Volunteer Experience'));
  assert.ok(titles.includes('Research & Development'));
  assert.ok(!titles.includes('CERTIFICATIONS'));
  assert.ok(!titles.includes('EXTRACURRICULAR'));
});

test('source layout orders actual sections once while retaining unfamiliar heading choices', () => {
  const { resumeSourceLayout } = resumeContent;
  assert.equal(typeof resumeSourceLayout, 'function');
  const original = { ...source, text: source.text + '\nVolunteer Experience\nHelped with peer reviews.\nEXPERIENCE\nDeveloper | Maple Labs | 2016 - 2017' };
  const layout = resumeSourceLayout(original);
  assert.deepEqual(layout.sections, ['EXPERIENCE', 'EDUCATION']);
  assert.ok(layout.extraSectionTitles.includes('Volunteer Experience'));
  assert.equal(layout.suggestedBreakBefore, 'EDUCATION');
  assert.deepEqual(resumeSourceLayout({ text: 'Alex Example develops reliable Python services for internal engineering teams.' }).sections, []);
});

test('unheaded employment before an education section retains flexible pagination', () => {
  for (const contact of ['', 'CONTACT\nalex@example.test\n', 'Contact information: alex@example.test\n']) {
    const original = { text: 'Alex Example\n' + contact + 'Example Corp | Software Engineer | Jan 2022 - Present\nBuilt reliable internal Python services.\nEDUCATION\nValley University | 2018 - 2022\nBSc Computer Science', pageCount: 2 };
    const layout = resumeContent.resumeSourceLayout(original);
    assert.deepEqual(layout.sections, []);
    assert.ok(layout.extraSectionTitles.includes('EDUCATION'));
  }
});

test('balanced two-page sections plan the break while a dominant section retains internal pagination', () => {
  const layout = resumeContent.resumeSourceLayout({ ...source, pageCount: 2 });
  assert.equal(layout.pageBreakBefore, 'EDUCATION');
  const long = { ...source, pageCount: 2, text: source.text.replace('Built Python services and automated tests.', 'Built Python services and automated tests. '.repeat(50)) };
  const longLayout = resumeContent.resumeSourceLayout(long);
  assert.equal(longLayout.pageBreakBefore, undefined);
  assert.equal(longLayout.longSection, 'EXPERIENCE');
  assert.match(buildPreparationPrompt({ source: long }), /Split the long source section "EXPERIENCE" across both pages/);
  assert.equal(resumeContent.resumeSourceLayout({ ...source, pageCount: 1 }).pageBreakBefore, undefined);
});

test('a planned break cannot consume the next education entry as continued employment', () => {
  const layout = { sections: ['EXPERIENCE', 'EDUCATION'], pageBreakBefore: 'EDUCATION' };
  const pagination = { exact: true, targetPages: 2 };
  const valid = latex.replace('\\section{EDUCATION}', '\\newpage\n\\section{EDUCATION}');
  assert.equal(validateLatexSource(valid, { requireTemplate: true, pagination, layout }), valid);
  const emptyGroupBoundary = valid.replace('\\newpage\n', '\\newpage{}');
  assert.equal(validateLatexSource(emptyGroupBoundary, { requireTemplate: true, pagination, layout }), emptyGroupBoundary);
  const padded = valid.replace('\\newpage\n', '\\newpage\n\\vspace*{24pt}\n');
  assert.equal(validateLatexSource(padded, { requireTemplate: true, pagination, layout }), padded, 'top padding must not conceal the planned source section');
  const wrong = latex.replace('\\section{EDUCATION}', '\\newpage\n\\resumeItemListStart\n\\resumeItem{Continued wrong section}\n\\resumeItemListEnd\n\\section{EDUCATION}');
  assert.throws(() => validateLatexSource(wrong, { requireTemplate: true, pagination, layout }), { reason: 'pagination_structure' });
});

test('confident source tuples constrain the actual Abey header argument order and preserve grades', () => {
  const { resumeSubheadingChoices } = resumeContent;
  assert.equal(typeof resumeSubheadingChoices, 'function');
  const graded = { ...source, text: source.text + '\nCGPA: 7.49' };
  const headers = resumeSubheadingChoices(buildSourceFacts(graded));
  assert.ok(headers.includes(String.raw`\resumeSubheading{Cedar Labs}{Jan 2022 - Present}{Developer}{}`));
  assert.ok(headers.some(header => header.startsWith(String.raw`\resumeSubheading{Valley University}{2018 - 2021}{BSc Computer Science`) && header.includes('CGPA: 7.49')));
  const ambiguous = buildSourceFacts({ text: 'Alex Example\nEXPERIENCE\nCedar Labs\nDeveloper\nMaple Labs\nEngineer\nBuilt reliable internal Python services.' });
  assert.deepEqual(resumeSubheadingChoices(ambiguous), []);
});

test('confident entry headers stay associated with their actual source sections', () => {
  const original = { ...source, text: source.text + '\nACTIVITIES\nCommunity Engineering Group\nSupported peer code reviews and shared technical documentation.' };
  const layout = resumeContent.resumeSourceLayout(original);
  assert.deepEqual(layout.sectionHeaderChoices, {
    EXPERIENCE: [String.raw`\resumeSubheading{Cedar Labs}{Jan 2022 - Present}{Developer}{}`],
    EDUCATION: [String.raw`\resumeSubheading{Valley University}{2018 - 2021}{BSc Computer Science}{}`],
    ACTIVITIES: [],
  });
});

test('preflight rejects repeated or reversed original sections before compiling', () => {
  const layout = { sections: ['EXPERIENCE', 'EDUCATION'] };
  const repeated = latex.replace('\\end{document}', '\\section{EXPERIENCE}\n\\resumeItemListStart\n\\resumeItem{Repeated content}\n\\resumeItemListEnd\n\\end{document}');
  assert.throws(() => validateLatexSource(repeated, { requireTemplate: true, layout }), { reason: 'section_structure' });
  // Make the two labels unambiguously reversed without changing their contents.
  const swapped = latex.replace('\\section{EXPERIENCE}', '\\section{TEMP}').replace('\\section{EDUCATION}', '\\section{EXPERIENCE}').replace('\\section{TEMP}', '\\section{EDUCATION}');
  assert.throws(() => validateLatexSource(swapped, { requireTemplate: true, layout }), { reason: 'section_structure' });
  assert.equal(validateLatexSource(latex, { requireTemplate: true, layout }), latex);
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
