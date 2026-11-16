import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPaginationRepairPlan, applyPaginationRepair } from '../resume-tailoring/resumePaginationRepair.js';
import { RESUME_LATEX_PREAMBLE } from '../src/utils/resumeLatexFormat.js';
import { resumeLatexStructureIssue } from '../src/utils/resumeLatexStructure.js';

const header = String.raw`\begin{center}
{\Huge \scshape Private Candidate} \\
\href{mailto:private@example.test}{private@example.test}
\end{center}`;
const body = String.raw`
\section{EXPERIENCE}
\resumeSubHeadingListStart
\resumeSubheading{Private Employer}{2022 -- Present}{Engineer}{}
\resumeItemListStart[itemsep=2pt,topsep=3pt]
\resumeItem{Built private services with \href{https://example.test/work}{project details}.}
\resumeItem{Preserved 25\% improvement and all original facts.}
\resumeItemListEnd
\resumeSubheading{Second Employer}{2020 -- 2022}{Developer}{}
\resumeItemListStart
\resumeItem{Other original evidence.}
\resumeItemListEnd
\resumeSubHeadingListEnd
\vspace{4pt}
\newpage
\vspace*{24pt}
\section{EDUCATION}
\resumeSubHeadingListStart
\resumeSubheading{Original University}{2016 -- 2020}{BSc}{Grade: 8.1}
\resumeSubHeadingListEnd
\end{document}`;
const document = RESUME_LATEX_PREAMBLE + header + body;
const planFor = (pagination = { exact: true, targetPages: 2 }, latex = document) => buildPaginationRepairPlan(latex, pagination, { pageCount: 3 });
const repairAt = (plan, kind) => applyPaginationRepair(plan, JSON.stringify({ spacing: 'compact', breakBefore: plan.candidates.find(candidate => candidate.kind === kind).id }));

test('pagination prompts contain bounded layout measurements instead of the source or failed LaTeX', () => {
  const plan = planFor();
  assert.ok(plan.candidates.length > 2);
  assert.ok(plan.prompt.length < 6000);
  assert.doesNotMatch(plan.prompt, /Private Candidate|Private Employer|private@|example\.test|25|documentclass/);
  assert.match(plan.prompt, /exactly 2 pages/);
});

for (const kind of ['section', 'entry', 'item']) test(`layout repair at a ${kind} preserves the immutable template, header and candidate content`, () => {
  const plan = planFor();
  const repaired = repairAt(plan, kind);
  assert.ok(repaired.startsWith(RESUME_LATEX_PREAMBLE + header));
  assert.equal(resumeLatexStructureIssue(repaired.slice(RESUME_LATEX_PREAMBLE.length)), null);
  for (const value of ['Private Employer', '2022 -- Present', '25\\%', 'Grade: 8.1', 'https://example.test/work', 'Other original evidence.']) assert.ok(repaired.includes(value));
  assert.equal((repaired.match(/\\newpage\b/g) || []).length, 1);
  assert.equal((repaired.match(/\\resumeSubheading\{/g) || []).length, 3);
  assert.ok(repaired.includes('itemsep=0pt'));
  // A real break must be outside all list environments, including a continued entry.
  const beforeBreak = repaired.slice(RESUME_LATEX_PREAMBLE.length, repaired.indexOf('\\newpage', RESUME_LATEX_PREAMBLE.length));
  assert.equal(resumeLatexStructureIssue(beforeBreak), null);
});

test('one-page repair removes physical breaks and never shrinks fonts or margins', () => {
  const plan = planFor({ exact: true, targetPages: 1 });
  const repaired = applyPaginationRepair(plan, '{"spacing":"compact","breakBefore":null}');
  assert.doesNotMatch(repaired.slice(RESUME_LATEX_PREAMBLE.length), /\\newpage|\\vspace\*\{24pt\}/);
  assert.ok(repaired.startsWith(RESUME_LATEX_PREAMBLE));
});

test('layout choices cannot inject content or use unlisted breaks', () => {
  const plan = planFor();
  for (const value of ['{}', '{"spacing":"tiny","breakBefore":0}', '{"spacing":"compact","breakBefore":999}',
    '{"spacing":"compact","breakBefore":null}', '{"spacing":"compact","breakBefore":0,"latex":"private replacement"}']) {
    assert.throws(() => applyPaginationRepair(plan, value), { code: 'pagination_repair_invalid' });
  }
  assert.throws(() => applyPaginationRepair(planFor({ exact: true, targetPages: 1 }), '{"spacing":"compact","breakBefore":0}'), { code: 'pagination_repair_invalid' });
});

test('comments and commands inside candidate arguments are never layout edit targets', () => {
  const literal = String.raw`\resumeItem{Evidence {\newpage} and \textbf{\vspace{4pt} protected argument}.}`;
  const commented = '% \\newpage and \\resumeItem{comment only}\n';
  const original = document.replace('\\resumeItem{Other original evidence.}', commented + literal);
  const plan = planFor({ exact: true, targetPages: 1 }, original);
  const repaired = applyPaginationRepair(plan, '{"spacing":"compact","breakBefore":null}');
  assert.ok(repaired.includes(literal));
  assert.ok(repaired.includes(commented));
});

test('large documents still offer at most 128 measured break choices', () => {
  const many = document.replace('\\resumeItem{Other original evidence.}', Array.from({ length: 250 }, (_, i) => `\\resumeItem{Private unique fact ${i}.}`).join('\n'));
  const plan = planFor(undefined, many);
  assert.ok(plan.candidates.length <= 128);
  assert.ok(plan.prompt.length < 12000);
  assert.doesNotMatch(plan.prompt, /Private unique fact/);
});

for (const gap of ['\n', '% retained layout comment\n', '\n% another comment\n\t']) {
  test(`list spacing options separated by ${JSON.stringify(gap)} are replaced once`, () => {
    const original = document.replace('\\resumeItemListStart[itemsep=2pt,topsep=3pt]', `\\resumeItemListStart${gap}[itemsep=2pt,topsep=3pt]`);
    const plan = planFor({ exact: true, targetPages: 1 }, original);
    const repaired = applyPaginationRepair(plan, '{"spacing":"compact","breakBefore":null}');
    assert.ok(repaired.includes(`\\resumeItemListStart${gap}[itemsep=2pt,topsep=3pt,itemsep=0pt,parsep=0pt,topsep=0pt,partopsep=0pt]`));
    assert.ok(!repaired.includes('[itemsep=2pt,topsep=3pt]'));
  });
}

for (const options of [String.raw`label={[\textbullet]},itemsep=2pt`, 'label={x,itemsep=42pt,y},itemsep=2pt']) {
  test(`spacing edits preserve complete bracketed label content: ${options}`, () => {
    const original = document.replace('itemsep=2pt,topsep=3pt', options);
    const repaired = applyPaginationRepair(planFor({ exact: true, targetPages: 1 }, original), '{"spacing":"compact","breakBefore":null}');
    assert.ok(repaired.includes(`[${options},itemsep=0pt,parsep=0pt,topsep=0pt,partopsep=0pt]`));
    assert.equal(resumeLatexStructureIssue(repaired.slice(RESUME_LATEX_PREAMBLE.length)), null);
  });
}

test('a standalone continued item list remains an eligible closed-list break', () => {
  const original = RESUME_LATEX_PREAMBLE + header + String.raw`
\section{EXPERIENCE}
\resumeSubHeadingListStart
\resumeSubheading{Private Employer}{2022 -- Present}{Engineer}{}
\resumeItemListStart
\resumeItem{First part of the original long entry.}
\resumeItemListEnd
\resumeSubHeadingListEnd
\newpage\vspace*{24pt}
\resumeItemListStart
\resumeItem{Continued original evidence.}
\resumeItemListEnd
\end{document}`;
  const plan = planFor(undefined, original);
  assert.ok(plan, 'a continued entry must not fall back to full document regeneration');
  const repaired = repairAt(plan, 'item-list');
  assert.equal(resumeLatexStructureIssue(repaired.slice(RESUME_LATEX_PREAMBLE.length)), null);
  assert.ok(repaired.includes('Continued original evidence.'));
});

test('a commented end-center command cannot expose protected header spacing to edits', () => {
  const protectedHeader = header.replace('\\begin{center}', '\\begin{center}\n% \\end{center} is only a comment\n\\vspace{4pt}');
  const original = document.replace(header, protectedHeader);
  const repaired = applyPaginationRepair(planFor({ exact: true, targetPages: 1 }, original), '{"spacing":"compact","breakBefore":null}');
  assert.ok(repaired.startsWith(RESUME_LATEX_PREAMBLE + protectedHeader));
});
