import test from 'node:test';
import assert from 'node:assert/strict';
import { processResumeDocument } from '../resume-tailoring/resumePipeline.js';
import { generateResumeText } from '../resume-tailoring/resumeRuntime.js';
import { buildResumeTailoringPlan } from '../resume-tailoring/resumeTailoringPlan.js';
import { RESUME_LATEX_PREAMBLE } from '../src/utils/resumeLatexFormat.js';
import { validateLatexSource, buildResumeJobSnapshot, buildResumeJobPromptSnapshot, resumeJobHash } from '../src/services/resumeLatexContent.js';

const source = { pageCount: 1, links: ['mailto:alex@example.test', 'https://example.test/project'], text: [
  'Alex Example', 'alex@example.test', 'SUMMARY', 'Software engineer building Java services and automated tests.',
  'EXPERIENCE', 'Cedar Systems | Jan 2022 - Present', 'Software Engineer',
  'Developed Java services.', 'Automated tests, reducing defects by 25%.',
  'PROJECTS', 'Service tools', 'Project details: https://example.test/project',
  'SKILLS', 'Java, SQL, Git.', 'EDUCATION', 'Valley University | 2016 - 2020', 'BSc Computer Science',
].join('\n') };
const latex = RESUME_LATEX_PREAMBLE + String.raw`\begin{center}
{\Huge \scshape Alex Example} \\
\normalsize
\href{mailto:alex@example.test}{alex@example.test}
\end{center}
\section{SUMMARY}
\resumeItemListStart
\resumeItem{Software engineer building Java services and automated tests.}
\resumeItemListEnd
\section{EXPERIENCE}
\resumeSubHeadingListStart
\resumeSubheading{Cedar Systems}{Jan 2022 - Present}{Software Engineer}{}
\resumeItemListStart
\resumeItem{Developed Java services.}
% \resumeItem{This comment is not an editable bullet.}
\resumeItem{Automated tests, reducing defects by 25\%.}
\resumeItemListEnd
\resumeSubHeadingListEnd
\section{PROJECTS}
\resumeSubHeadingListStart
\resumeProjectHeading{Service tools}{}
\resumeItemListStart
\resumeItem{\href{https://example.test/project}{Project details}}
\resumeItemListEnd
\resumeSubHeadingListEnd
\section{SKILLS}
\resumeItemListStart
\resumeItem{Java, SQL, Git.}
\resumeItemListEnd
\section{EDUCATION}
\resumeSubHeadingListStart
\resumeSubheading{Valley University}{2016 - 2020}{BSc Computer Science}{}
\resumeSubHeadingListEnd
\end{document}`;
const supported = JSON.stringify({ evidence: 'All claims match the complete source.', supported: true, missingFacts: [], unsupportedClaims: [] });
const description = 'Build reliable Java services and automated tests. '.repeat(80) + 'Final requirement: SQL.';
const jobSnapshot = { title: 'Software Engineer', description, sourceDescription: description, jobDescription: description };

async function capturePlan(input = {}) {
  const calls = [];
  await processResumeDocument({ mode: 'tailored', source, baseLatex: latex, jobSnapshot, ...input }, {
    generate: async (prompt, options) => { calls.push({ prompt, options }); return options.comparison ? supported : latex; },
    compile: async () => ({ pdf: Buffer.from('%PDF-test'), text: source.text, links: source.links, pageCount: 1 }),
  });
  return { plan: calls[0].options.tailoringPlan, calls };
}

test('tailoring uses a bounded edit plan and still independently audits the entire source and PDF', async () => {
  const { plan, calls } = await capturePlan();
  assert.ok(plan, 'a prepared Abey resume must not require full-document token decoding');
  assert.ok(plan.maxTokens <= 1024);
  assert.ok(plan.prompt.length < calls[0].prompt.length / 2, 'editing must avoid full template and repeated job descriptions');
  const data = JSON.parse(plan.prompt.split('\n').at(-1));
  assert.equal(data.originalResume.text, source.text);
  assert.deepEqual(data.originalResume.links, source.links);
  assert.equal(plan.baseLatex, latex, 'the complete fixed document remains in trusted code');
  assert.ok(data.preparedResume.every(part => Number.isInteger(part.id) && typeof part.text === 'string'));
  assert.equal(data.job.description, description);
  assert.deepEqual(data.job.duplicateFields, { sourceDescription: 'description', jobDescription: 'description' });
  assert.equal(plan.prompt.split(description).length - 1, 1);
  assert.equal(buildResumeJobSnapshot(jobSnapshot).sourceDescription, description, 'stored snapshot and hashing evidence stay complete');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.comparison, true);
  assert.ok(calls[1].prompt.includes(JSON.stringify(source.text)));
  assert.match(plan.prompt, /untrusted/i);
});

test('Windows line endings and a leading BOM do not disable bounded tailoring', () => {
  const plan = buildResumeTailoringPlan({ source, baseLatex: '\uFEFF' + latex.replace(/\n/g, '\r\n'), jobSnapshot });
  assert.ok(plan, 'a saved Windows document must not fall back to full generation');
  assert.equal(plan.baseKind, 'normalized');
  assert.ok(plan.maxTokens <= 1024);
});

test('starred source headings retain editable summary and experience items', () => {
  const plan = buildResumeTailoringPlan({ source, baseLatex: latex.replaceAll('\\section{', '\\section*{'), jobSnapshot });
  assert.ok(plan, 'valid starred sections must remain on the bounded path');
  const data = JSON.parse(plan.prompt.split('\n').at(-1));
  assert.ok(data.preparedResume.some(part => part.text === 'Developed Java services.'));
});

test('ordinary itemize bullets can be tailored without regenerating the document', () => {
  const baseLatex = RESUME_LATEX_PREAMBLE + latex.slice(RESUME_LATEX_PREAMBLE.length).replaceAll('\\resumeItemListStart', '\\begin{itemize}')
    .replaceAll('\\resumeItemListEnd', '\\end{itemize}')
    .replace('\\resumeItem{Developed Java services.}', '\\item Developed Java services.')
    .replace('\\resumeItem{Automated tests, reducing defects by 25\\%.}', '\\item Automated tests, reducing defects by 25\\%.')
    .replace('\\resumeItem{Software engineer building Java services and automated tests.}', '\\item Software engineer building Java services and automated tests.')
    .replace('\\resumeItem{Java, SQL, Git.}', '\\item Java, SQL, Git.');
  assert.equal(validateLatexSource(baseLatex, { requireTemplate: true }), baseLatex);
  const plan = buildResumeTailoringPlan({ source, baseLatex, jobSnapshot });
  assert.ok(plan, 'valid explicit item lists must remain on the bounded path');
  const data = JSON.parse(plan.prompt.split('\n').at(-1));
  const item = data.preparedResume.find(part => part.text === 'Developed Java services.');
  assert.ok(item);
  assert.ok(data.preparedResume.some(part => part.text === 'Automated tests, reducing defects by 25%.'), 'escaped percentages are candidate text, not trailing comments');
  const result = plan.apply(JSON.stringify({ edits: [{ id: item.id, text: 'Developed Java services with automated testing.' }], leadItems: [] }));
  assert.ok(result.includes('\\item Developed Java services with automated testing.'));
  assert.ok(result.includes('25\\%'));
  assert.equal(validateLatexSource(result, { requireTemplate: true }), result);
});

test('the edit prompt retains the complete source and contextual passages without repeating fixed LaTeX', () => {
  const plan = buildResumeTailoringPlan({ source, baseLatex: latex, jobSnapshot });
  const data = JSON.parse(plan.prompt.split('\n').at(-1));
  assert.equal(data.originalResume.text, source.text);
  assert.equal(data.job.description, description);
  assert.ok(data.preparedResume.every(part => Number.isInteger(part.id) && typeof part.text === 'string' && typeof part.section === 'string'));
  assert.doesNotMatch(JSON.stringify(data.preparedResume), /\\\\resumeSubheading|\\\\begin|\\\\end|\\\\href/);
  const developer = data.preparedResume.find(part => part.text === 'Developed Java services.');
  assert.ok(developer.entry.includes('Cedar Systems'));
});

test('raw employment headers introducing nested lists stay fixed and identify their own entry', () => {
  const headers = ['Cedar Systems | Jan 2022 - Present | Software Engineer', 'Pine Services | 2020 - 2021 | Developer'];
  const body = String.raw`\section{EXPERIENCE}
\begin{itemize}
\item \textbf{${headers[0]}}
% Keep the original employer, dates and role above its bullets.
\begin{itemize}
\item Developed Java services.
\end{itemize}
\item \textbf{${headers[1]}}
\resumeItemListStart
\item Automated service tests.
\resumeItemListEnd
\end{itemize}
\end{document}`;
  const baseLatex = latex.slice(0, latex.indexOf('\\section{EXPERIENCE}')) + body;
  assert.equal(validateLatexSource(baseLatex, { requireTemplate: true }), baseLatex);
  const plan = buildResumeTailoringPlan({ source, baseLatex, jobSnapshot });
  const data = JSON.parse(plan.prompt.split('\n').at(-1));
  assert.ok(data.preparedResume.every(part => !headers.includes(part.text)), 'employer, title and dates are fixed fields');
  const first = data.preparedResume.find(part => part.text === 'Developed Java services.');
  const second = data.preparedResume.find(part => part.text === 'Automated service tests.');
  assert.equal(first.entry, headers[0]);
  assert.equal(second.entry, headers[1]);
  const result = plan.apply(JSON.stringify({ edits: [{ id: first.id, text: 'Developed reliable Java services.' }], leadItems: [second.id] }));
  for (const header of headers) assert.ok(result.includes(`\\textbf{${header}}`));
  assert.ok(result.indexOf('Developed reliable Java services.') < result.indexOf(headers[1]));
  assert.ok(result.indexOf('Automated service tests.') > result.indexOf(headers[1]));
  assert.equal(validateLatexSource(result, { requireTemplate: true }), result);
});

test('list options are opaque and cannot create editable item slots', () => {
  for (const start of ['\\begin{itemize}', '\\resumeItemListStart']) {
    const end = start === '\\begin{itemize}' ? '\\end{itemize}' : '\\resumeItemListEnd';
    const options = String.raw`[label={\textbf{[fixed]}}, before=\item Existing fixed label]`;
    const baseLatex = latex.slice(0, latex.indexOf('\\section{EXPERIENCE}'))
      + `\\section{EXPERIENCE}\n${start}${options}\n\\resumeItem{Developed Java services.}\n${end}\n\\end{document}`;
    assert.equal(validateLatexSource(baseLatex, { requireTemplate: true }), baseLatex);
    const plan = buildResumeTailoringPlan({ source, baseLatex, jobSnapshot });
    const data = JSON.parse(plan.prompt.split('\n').at(-1));
    assert.ok(data.preparedResume.every(part => !part.text.includes('Existing fixed label')));
    const item = data.preparedResume.find(part => part.text === 'Developed Java services.');
    const result = plan.apply(JSON.stringify({ edits: [{ id: item.id, text: 'Developed reliable Java services.' }], leadItems: [] }));
    assert.ok(result.includes(start + options), 'list options remain byte-for-byte fixed');
    assert.equal(validateLatexSource(result, { requireTemplate: true }), result);
  }
});

test('flat raw employment headers are fixed entry barriers and ambiguous unmarked lists require preparation', () => {
  const headers = ['Cedar Systems | Jan 2022 - Present | Software Engineer', 'Pine Services | 2020 - 2021 | Developer'];
  for (const marking of ['marked', 'unmarked', 'mixed', 'mixed-undated']) {
    const marked = marking === 'marked';
    const firstHeader = marking === 'unmarked' ? headers[0] : `\\textbf{${headers[0]}}`;
    const secondHeader = marked ? `\\textbf{${headers[1]}}` : marking === 'mixed-undated' ? 'Pine Services' : headers[1];
    const baseLatex = latex.slice(0, latex.indexOf('\\section{EXPERIENCE}'))
      + '\\section{EXPERIENCE}\n\\begin{itemize}\n'
      + `\\item ${firstHeader}\n\\item Developed Java services.\n`
      + `\\item ${secondHeader}\n\\item Automated service tests.\n`
      + '\\end{itemize}\n\\end{document}';
    assert.equal(validateLatexSource(baseLatex, { requireTemplate: true }), baseLatex);
    const matchingSource = { ...source, text: source.text.replace('PROJECTS',
      'Pine Services | 2020 - 2021\nDeveloper\nAutomated service tests.\nPROJECTS') };
    const plan = buildResumeTailoringPlan({ source: matchingSource, baseLatex, jobSnapshot });
    if (!marked) {
      assert.equal(plan, null, 'ambiguous raw entries must use complete source reconstruction, never unsafe shared slots');
      continue;
    }
    assert.ok(plan);
    const data = JSON.parse(plan.prompt.split('\n').at(-1));
    assert.ok(data.preparedResume.every(part => !headers.includes(part.text)));
    const first = data.preparedResume.find(part => part.text === 'Developed Java services.');
    const second = data.preparedResume.find(part => part.text === 'Automated service tests.');
    assert.equal(first.entry, headers[0]);
    assert.equal(second.entry, headers[1]);
    const result = plan.apply(JSON.stringify({ edits: [{ id: first.id, text: 'Developed reliable Java services.' }], leadItems: [second.id] }));
    assert.ok(result.indexOf('Developed reliable Java services.') < result.indexOf(headers[1]));
    assert.ok(result.indexOf('Automated service tests.') > result.indexOf(headers[1]));
    for (const header of headers) assert.ok(result.includes(`\\textbf{${header}}`));
    assert.equal(validateLatexSource(result, { requireTemplate: true }), result);
  }
});

test('trusted tailoring edits preserve the template, factual headers, links and all unedited content', async () => {
  const { plan } = await capturePlan();
  assert.ok(plan);
  const data = JSON.parse(plan.prompt.split('\n').at(-1));
  const summary = data.preparedResume.find(part => part.text === 'Software engineer building Java services and automated tests.');
  const tests = data.preparedResume.find(part => part.text === 'Automated tests, reducing defects by 25%.');
  assert.ok(summary && tests);
  const result = plan.apply(JSON.stringify({ edits: [{ id: summary.id, text: 'Software engineer focused on automated tests and Java services.' }], leadItems: [tests.id] }));
  assert.ok(result.startsWith(RESUME_LATEX_PREAMBLE));
  assert.match(result, /Software engineer focused on automated tests and Java services\./);
  assert.ok(result.indexOf('Automated tests, reducing defects') < result.indexOf('Developed Java services.'));
  for (const fixed of [String.raw`\resumeSubheading{Cedar Systems}{Jan 2022 - Present}{Software Engineer}{}`,
    String.raw`\resumeSubheading{Valley University}{2016 - 2020}{BSc Computer Science}{}`,
    String.raw`\href{https://example.test/project}{Project details}`, '25\\%', 'This comment is not an editable bullet.']) assert.ok(result.includes(fixed), fixed);
  assert.equal(validateLatexSource(result, { requireTemplate: true, pagination: { exact: true, targetPages: 1 } }), result);
});

test('tailoring output cannot edit fixed fields, reuse IDs, add unknown properties or execute LaTeX', async () => {
  const { plan } = await capturePlan();
  assert.ok(plan);
  const data = JSON.parse(plan.prompt.split('\n').at(-1));
  const id = data.preparedResume.find(part => part.text)?.id;
  for (const choice of [null, [], { edits: [], leadItems: [] },
    { edits: [{ id: 999999, text: 'changed' }], leadItems: [] },
    { edits: [{ id, text: 'one' }, { id, text: 'two' }], leadItems: [] },
    { edits: [{ id, text: 'x'.repeat(385) }], leadItems: [] },
    { edits: [{ id, text: 'changed', latex: 'extra' }], leadItems: [] },
    { edits: [{ id, text: 'changed' }], leadItems: [999999] },
    { edits: [{ id, text: 'changed' }], leadItems: [id, id] },
    { edits: [{ id, text: 'changed' }], leadItems: [], latex: 'replacement document' }]) {
    assert.throws(() => plan.apply(JSON.stringify(choice)), { code: 'tailoring_plan_invalid' });
  }
  const result = plan.apply(JSON.stringify({ edits: [{ id, text: String.raw`Java & SQL 25% \input{private}` }], leadItems: [] }));
  assert.ok(result.includes(String.raw`Java \& SQL 25\% \textbackslash{}input\{private\}`));
});

test('tailoring edit inference uses bounded JSON output and rejects truncated plans', async () => {
  const { plan } = await capturePlan();
  assert.ok(plan);
  const data = JSON.parse(plan.prompt.split('\n').at(-1));
  const id = data.preparedResume.find(part => part.text)?.id;
  const choice = JSON.stringify({ edits: [{ id, text: 'Software engineer focused on Java services and automated testing.' }], leadItems: [] });
  for (const finish_reason of ['stop', 'length']) {
    const requests = [];
    const fetchImpl = async (url, options) => {
      const body = JSON.parse(options.body);
      requests.push({ url, body });
      return { ok: true, json: async () => url.endsWith('/apply-template') ? { prompt: body.messages[0].content }
        : url.endsWith('/tokenize') ? { tokens: [1, 2, 3] }
          : { choices: [{ finish_reason, message: { content: choice } }] } };
    };
    const pending = generateResumeText('unused full-document instructions', { tailoringPlan: plan, fetchImpl });
    if (finish_reason === 'length') await assert.rejects(pending, { code: 'model_output_incomplete' });
    else assert.match(await pending, /Software engineer focused on Java services and automated testing/);
    const request = requests.at(-1);
    assert.ok(request.url.endsWith('/v1/chat/completions'));
    assert.ok(request.body.max_tokens <= 1024);
    assert.equal(request.body.response_format.type, 'json_schema');
    assert.doesNotMatch(JSON.stringify(requests), /documentclass|unused full-document instructions/);
  }
});

test('missing and legacy bases with ambiguous source require preparation instead of full regeneration', async () => {
  for (const baseLatex of ['', String.raw`\documentclass{article}\begin{document}Legacy\end{document}`]) {
    await assert.rejects(capturePlan({ baseLatex }), { code: 'prepared_resume_incompatible', statusCode: 409 });
  }
  assert.equal((await capturePlan({ mode: 'base' })).plan, undefined);
});

const preservableSource = { pageCount: 1, links: ['mailto:alex@example.test'], text: [
  'Alex Example', 'alex@example.test', 'EXPERIENCE', 'Cedar Systems | Jan 2022 - Present', 'Software Engineer',
  '• Developed Java services.', '• Automated tests, reducing defects by 25%.',
  'SKILLS', '• Java, SQL, Git.', 'EDUCATION', 'Valley University | 2016 - 2020', 'BSc Computer Science',
].join('\n') };

test('a legacy prepared base is rebuilt from complete source blocks and tailored using bounded edits', async () => {
  const calls = [], diagnostics = [];
  const result = await processResumeDocument({ mode: 'tailored', source: preservableSource,
    baseLatex: '\\documentclass{article}\\begin{document}Legacy content\\end{document}', jobSnapshot }, {
    generate: async (_prompt, options) => {
      calls.push(options);
      if (options.comparison) return supported;
      if (!options.tailoringPlan) return latex;
      const passage = JSON.parse(options.tailoringPlan.prompt.split('\n').at(-1)).preparedResume[0];
      return options.tailoringPlan.apply(JSON.stringify({ edits: [{ id: passage.id, text: passage.text }], leadItems: [] }));
    },
    compile: async document => {
      assert.ok(document.startsWith(RESUME_LATEX_PREAMBLE));
      assert.doesNotMatch(document, /Legacy content/);
      return { pdf: Buffer.from('%PDF-test'), text: preservableSource.text, links: preservableSource.links, pageCount: 1 };
    },
    onDiagnostic: event => diagnostics.push(event),
  });
  assert.ok(calls[0].tailoringPlan, 'a legacy base must not silently trigger another full-document generation');
  assert.ok(calls[0].tailoringPlan.maxTokens <= 1024);
  assert.equal(calls.at(-1).comparison, true);
  assert.equal(result.pageCount, 1);
  assert.ok(diagnostics.some(event => event.baseKind === 'source' && event.tailoringReason === 'template_mismatch'));
});

test('an incompatible base with ambiguous source fails before inference with an actionable preparation error', async () => {
  let generations = 0;
  const diagnostics = [];
  const ambiguous = { text: 'Alex Example\nalex@example.test\nAn unstructured collection of paragraphs with no identifiable source entries or confident sections to reconstruct.' };
  await assert.rejects(processResumeDocument({ mode: 'tailored', source: ambiguous,
    baseLatex: 'private invalid legacy document', jobSnapshot }, {
    generate: async () => { generations++; return latex; },
    compile: async () => assert.fail('an incompatible base must be prepared before compilation'),
    onDiagnostic: event => diagnostics.push(event),
  }), { code: 'prepared_resume_incompatible', statusCode: 409 });
  assert.equal(generations, 0);
  assert.ok(diagnostics.some(event => event.tailoringReason === 'template_mismatch' && event.baseKind === 'unavailable'));
  assert.doesNotMatch(JSON.stringify(diagnostics), /private invalid|alex@/);
});

test('a reconstructed two-page base remains the bounded repair source after failed factual validation', async () => {
  const plans = [], diagnostics = [];
  let compilations = 0;
  const original = { ...preservableSource, pageCount: 2 };
  const result = await processResumeDocument({ mode: 'tailored', source: original, baseLatex: 'legacy private document', jobSnapshot }, {
    generate: async (_prompt, options) => {
      if (options.comparison) return supported;
      assert.ok(options.tailoringPlan);
      plans.push(options.tailoringPlan);
      const passage = JSON.parse(options.tailoringPlan.prompt.split('\n').at(-1)).preparedResume[0];
      return options.tailoringPlan.apply(JSON.stringify({ edits: [{ id: passage.id, text: passage.text }], leadItems: [] }));
    },
    compile: async document => {
      assert.equal(validateLatexSource(document, { requireTemplate: true, pagination: { exact: false, targetPages: 2 } }), document);
      return { pdf: Buffer.from('%PDF-test'), links: original.links, pageCount: 2,
        text: ++compilations === 1 ? original.text.replace('alex@example.test', '') : original.text };
    },
    onDiagnostic: event => diagnostics.push(event),
  });
  assert.equal(plans.length, 2);
  assert.equal(plans[1].baseLatex, plans[0].baseLatex);
  assert.ok(plans.every(plan => plan.maxTokens <= 1024));
  assert.equal(result.pageCount, 2);
  assert.ok(diagnostics.some(event => event.policyVersion === 'abey-tailoring-v3' && event.generationKind === 'edits' && event.baseKind === 'source'));
});

test('large tailoring requests use the edit endpoint with a bounded output allowance', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.endsWith('/apply-template')) return { ok: true, json: async () => ({ prompt: body.messages[0].content }) };
    if (url.endsWith('/tokenize')) return { ok: true, json: async () => ({ tokens: Array(12373).fill(1) }) };
    assert.ok(url.endsWith('/v1/chat/completions'), 'full-document completion caused the logged timeout');
    calls.push(body);
    const comparison = body.response_format.json_schema.name === 'resume_source_comparison';
    const data = JSON.parse(body.messages[0].content.split('\n').at(-1));
    const content = comparison ? supported : JSON.stringify({ edits: [{ id: data.preparedResume[0].id, text: data.preparedResume[0].text }], leadItems: [] });
    return { ok: true, json: async () => ({ choices: [{ finish_reason: 'stop', message: { content } }] }) };
  };
  await processResumeDocument({ mode: 'tailored', source, baseLatex: '\uFEFF' + latex.replace(/\n/g, '\r\n'), jobSnapshot }, {
    generate: (prompt, options) => generateResumeText(prompt, { ...options, fetchImpl }),
    compile: async () => ({ pdf: Buffer.from('%PDF-test'), text: source.text, links: source.links, pageCount: 1 }),
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].response_format.json_schema.name, 'resume_tailoring_edits');
  assert.ok(calls[0].max_tokens <= 1024);
  assert.doesNotMatch(calls[0].messages[0].content, /documentclass|\\resumeSubheading/);
  assert.ok(calls[0].messages[0].content.includes(JSON.stringify(source.text)));
});

test('bullet priorities cannot move text across an existing physical page break', async () => {
  const withBreak = latex.replace('\\resumeItem{Automated tests', '\\newpage\n\\vspace*{24pt}\n\\resumeItem{Automated tests');
  const { plan } = await capturePlan({ source: { ...source, pageCount: undefined }, baseLatex: withBreak });
  assert.ok(plan);
  const data = JSON.parse(plan.prompt.split('\n').at(-1));
  const summary = data.preparedResume.find(part => part.text?.startsWith('Software engineer'));
  const tests = data.preparedResume.find(part => part.text?.startsWith('Automated tests'));
  const result = plan.apply(JSON.stringify({ edits: [{ id: summary.id, text: 'Software engineer focused on Java services and automated tests.' }], leadItems: [tests.id] }));
  assert.ok(result.indexOf('Developed Java services.') < result.indexOf('\\newpage'));
  assert.ok(result.indexOf('Automated tests, reducing defects') > result.indexOf('\\newpage'));
});

test('bullet priorities cannot move text between outer and nested explicit lists', async () => {
  for (const environment of ['itemize', 'enumerate', 'description']) {
    const nested = latex.replace('% \\resumeItem{This comment is not an editable bullet.}',
      `\\begin{${environment}}\n\\resumeItem{Wrote service-level automated tests.}\n\\end{${environment}}`);
    assert.equal(validateLatexSource(nested, { requireTemplate: true }), nested);
    const { plan } = await capturePlan({ baseLatex: nested });
    assert.ok(plan);
    const data = JSON.parse(plan.prompt.split('\n').at(-1));
    const summary = data.preparedResume.find(part => part.text?.startsWith('Software engineer'));
    const child = data.preparedResume.find(part => part.text === 'Wrote service-level automated tests.');
    assert.ok(child);
    const result = plan.apply(JSON.stringify({ edits: [{ id: summary.id, text: 'Software engineer focused on Java services and automated tests.' }], leadItems: [child.id] }));
    const body = result.slice(RESUME_LATEX_PREAMBLE.length);
    assert.ok(body.indexOf('Developed Java services.') < body.indexOf(`\\begin{${environment}}`));
    assert.ok(body.indexOf('Wrote service-level automated tests.') > body.indexOf(`\\begin{${environment}}`));
    assert.ok(body.indexOf('Wrote service-level automated tests.') < body.indexOf(`\\end{${environment}}`));
    assert.ok(body.indexOf('Automated tests, reducing defects') > body.indexOf(`\\end{${environment}}`));
  }
});

test('a factual repair stays within bounded edit inference instead of regenerating the full document', async () => {
  const plans = [];
  let comparisons = 0;
  await processResumeDocument({ mode: 'tailored', source, baseLatex: latex, jobSnapshot }, {
    generate: async (prompt, options) => {
      if (options.comparison) return ++comparisons === 1
        ? JSON.stringify({ evidence: 'A claim is unsupported.', supported: false, missingFacts: [], unsupportedClaims: ['Invented leadership'] }) : supported;
      plans.push(options.tailoringPlan);
      return latex;
    },
    compile: async () => ({ pdf: Buffer.from('%PDF-test'), text: source.text, links: source.links, pageCount: 1 }),
  });
  assert.equal(plans.length, 2);
  assert.ok(plans.every(plan => plan?.maxTokens <= 1024), 'the single repair must also avoid full-document generation');
  assert.match(plans[1].prompt, /Invented leadership/);
  assert.equal(comparisons, 2);
});

test('the real pipeline applies model edits before compilation and independently audits their result', async () => {
  const updatedSummary = 'Software engineer focused on Java services and automated tests.';
  const requests = [];
  let compilations = 0;
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ url, body });
    let payload;
    if (url.endsWith('/apply-template')) payload = { prompt: body.messages[0].content };
    else if (url.endsWith('/tokenize')) payload = { tokens: [1, 2, 3] };
    else {
      assert.ok(url.endsWith('/v1/chat/completions'));
      let content = supported;
      if (body.response_format.json_schema.name === 'resume_tailoring_edits') {
        const data = JSON.parse(body.messages[0].content.split('\n').at(-1));
        const summary = data.preparedResume.find(part => part.text?.startsWith('Software engineer'));
        content = JSON.stringify({ edits: [{ id: summary.id, text: updatedSummary }], leadItems: [] });
      } else {
        assert.equal(compilations, 1);
        assert.ok(body.messages[0].content.includes(updatedSummary));
        assert.ok(body.messages[0].content.includes(JSON.stringify(source.text)));
      }
      payload = { choices: [{ finish_reason: 'stop', message: { content } }] };
    }
    return { ok: true, json: async () => payload };
  };
  const result = await processResumeDocument({ mode: 'tailored', source, baseLatex: latex, jobSnapshot }, {
    generate: (prompt, options) => generateResumeText(prompt, { ...options, fetchImpl }),
    compile: async document => {
      compilations++;
      assert.ok(document.includes(updatedSummary));
      return { pdf: Buffer.from('%PDF-test'), text: source.text.replace('Software engineer building Java services and automated tests.', updatedSummary), links: source.links, pageCount: 1 };
    },
  });
  assert.ok(result.latex.includes(updatedSummary));
  assert.equal(requests.filter(request => request.url.endsWith('/v1/chat/completions')).length, 2);
});

test('prompt-only job aliases preserve distinct requirements and reconstruct the complete stored snapshot', () => {
  const job = { ...jobSnapshot, jobDescription: description + 'Unique final requirement: weekend support.',
    requirements: ['Java', 'SQL'], responsibilities: ['Java', 'SQL'], qualifications: ['BSc'],
    experienceRequired: '2 years', sourceExperienceRequired: '2 years ', sourceDescription: '<p>' + description + '</p>' };
  const original = structuredClone(job);
  const hash = resumeJobHash(job);
  const compact = buildResumeJobPromptSnapshot(job);
  assert.equal(compact.jobDescription, job.jobDescription);
  assert.equal(compact.sourceDescription, job.sourceDescription);
  assert.equal(compact.sourceExperienceRequired, '2 years ');
  assert.deepEqual(compact.duplicateFields, { responsibilities: 'requirements' });
  const restored = { ...compact };
  delete restored.duplicateFields;
  for (const [field, reference] of Object.entries(compact.duplicateFields)) restored[field] = compact[reference];
  assert.deepEqual(restored, buildResumeJobSnapshot(job));
  assert.deepEqual(job, original);
  assert.equal(resumeJobHash(job), hash);
});

test('edit planning preserves its complete JSON allowance and rejects insufficient context before inference', async () => {
  const { plan } = await capturePlan();
  for (const inputTokens of [15328, 15329]) {
    let inferred = false;
    const fetchImpl = async (url, options) => {
      const body = JSON.parse(options.body);
      let payload;
      if (url.endsWith('/apply-template')) payload = { prompt: body.messages[0].content };
      else if (url.endsWith('/tokenize')) payload = { tokens: Array(inputTokens).fill(1) };
      else {
        inferred = true;
        assert.equal(body.max_tokens, 1024);
        const data = JSON.parse(body.messages[0].content.split('\n').at(-1));
        const id = data.preparedResume.find(part => part.text)?.id;
        payload = { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ edits: [{ id, text: 'Software engineer focused on Java services and automated tests.' }], leadItems: [] }) } }] };
      }
      return { ok: true, json: async () => payload };
    };
    const pending = generateResumeText('', { tailoringPlan: plan, fetchImpl });
    if (inputTokens === 15329) await assert.rejects(pending, { code: 'input_too_large', statusCode: 422 });
    else assert.match(await pending, /Software engineer focused on Java services and automated tests/);
    assert.equal(inferred, inputTokens === 15328);
  }
});
