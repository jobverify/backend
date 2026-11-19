import test from 'node:test';
import assert from 'node:assert/strict';
import { processResumeDocument } from '../resume-tailoring/resumePipeline.js';
import { generateResumeText } from '../resume-tailoring/resumeRuntime.js';
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
  assert.equal(data.preparedResume.map(part => part.latex ?? part.fixed ?? part.text).join(''), latex.slice(RESUME_LATEX_PREAMBLE.length));
  assert.equal(data.job.description, description);
  assert.deepEqual(data.job.duplicateFields, { sourceDescription: 'description', jobDescription: 'description' });
  assert.equal(plan.prompt.split(description).length - 1, 1);
  assert.equal(buildResumeJobSnapshot(jobSnapshot).sourceDescription, description, 'stored snapshot and hashing evidence stay complete');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.comparison, true);
  assert.ok(calls[1].prompt.includes(JSON.stringify(source.text)));
  assert.match(plan.prompt, /untrusted/i);
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

test('missing and legacy prepared documents retain the existing full-document path', async () => {
  for (const baseLatex of ['', String.raw`\documentclass{article}\begin{document}Legacy\end{document}`]) {
    assert.equal((await capturePlan({ baseLatex })).plan, undefined);
  }
  assert.equal((await capturePlan({ mode: 'base' })).plan, undefined);
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
