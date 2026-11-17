import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPreservedPreparationPlan } from '../resume-tailoring/resumePaginationRepair.js';
import { generateResumeText } from '../resume-tailoring/resumeRuntime.js';
import { RESUME_LATEX_PREAMBLE } from '../src/utils/resumeLatexFormat.js';
import { validateLatexSource } from '../src/services/resumeLatexContent.js';
import { processResumeDocument } from '../resume-tailoring/resumePipeline.js';

const layout = {
  contactHeader: String.raw`\begin{center}
{\Huge \scshape Alex Example} \\
\href{mailto:alex@example.test}{alex@example.test}
\end{center}`,
  preservationBlocks: [{ latex: String.raw`\section{EXPERIENCE}
\resumeSubHeadingListStart
\resumeSubheading{Example Corp}{2022 -- Present}{Engineer}{}
\resumeItemListStart
\resumeItem{Reduced latency by 25\% using C\# and Java.}
\resumeItemListEnd
\resumeSubHeadingListEnd` }, { latex: String.raw`\section{EDUCATION}
\resumeSubHeadingListStart
\resumeSubheading{Example University}{2018 -- 2022}{BSc}{Grade: 8.1}
\resumeSubHeadingListEnd` }],
};

test('source preservation uses bounded layout inference and retains exact source content and template', async () => {
  const pagination = { exact: true, targetPages: 2 };
  const preparationPlan = buildPreservedPreparationPlan(layout, pagination);
  const boundary = preparationPlan.candidates.find(candidate => candidate.kind === 'section');
  const requests = [];
  const fetchImpl = async (url, options) => {
    const body = JSON.parse(options.body);
    requests.push({ url, body });
    return { ok: true, json: async () => url.endsWith('/apply-template') ? { prompt: 'rendered layout instructions' }
      : url.endsWith('/tokenize') ? { tokens: [1, 2, 3] }
        : { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ spacing: 'compact', breakBefore: boundary.id }) } }] } };
  };
  const result = await generateResumeText('unused full document prompt', { preparationPlan, pagination, fetchImpl });
  assert.equal(requests.length, 3);
  assert.equal(requests.at(-1).body.max_tokens, 128);
  assert.ok(requests.at(-1).url.endsWith('/v1/chat/completions'));
  assert.doesNotMatch(JSON.stringify(requests), /Alex Example|Example Corp|alex@|documentclass|unused full document/);
  assert.ok(result.startsWith(RESUME_LATEX_PREAMBLE + layout.contactHeader));
  for (const value of ['Reduced latency by 25\\% using C\\# and Java.', 'Grade: 8.1', 'Example Corp']) assert.ok(result.includes(value));
  assert.equal((result.match(/\\newpage\b/g) || []).length, 1);
  assert.equal(validateLatexSource(result, { requireTemplate: true, pagination }), result);
});

test('ambiguous or condensation-required sources retain full document generation', () => {
  const pagination = { targetPages: 2, exact: true };
  for (const value of [undefined, {}, { ...layout, contactHeader: '' }, { ...layout, condenseOriginal: true },
    { ...layout, preservationBlocks: [{ parts: ['fixed', { narrative: true }] }] }]) {
    assert.equal(buildPreservedPreparationPlan(value, pagination), null);
  }
});

test('invalid planner output cannot replace the trusted source document', async () => {
  const pagination = { targetPages: 1, exact: true };
  const preparationPlan = buildPreservedPreparationPlan(layout, pagination);
  const fetchImpl = async url => ({ ok: true, json: async () => url.endsWith('/apply-template') ? { prompt: 'layout' }
    : url.endsWith('/tokenize') ? { tokens: [1] }
      : { choices: [{ finish_reason: 'stop', message: { content: '{"spacing":"compact","breakBefore":null,"latex":"invented"}' } }] } });
  await assert.rejects(generateResumeText('', { preparationPlan, pagination, fetchImpl }), { code: 'pagination_repair_invalid' });
});

test('the actual pipeline enables planning only for base preservation and still audits the complete PDF', async () => {
  const source = { pageCount: 1, links: [], text: 'Alex Example\nEXPERIENCE\nCedar Labs Jan 2022 - Present\nDeveloper\n\u2022 Built reliable Java services.\nSKILLS\n\u2022 Java' };
  let preparedLatex;
  for (const mode of ['base', 'tailored']) {
    const calls = [];
    await processResumeDocument({ mode, source, baseLatex: '', jobSnapshot: {} }, {
      generate: async (prompt, options) => {
        calls.push(options);
        if (options.comparison) {
          assert.ok(prompt.includes('Built reliable Java services.'));
          return JSON.stringify({ evidence: 'Source and PDF match.', missingFacts: [], unsupportedClaims: [], supported: true });
        }
        assert.equal(Boolean(options.preparationPlan), mode === 'base');
        if (options.preparationPlan) return preparedLatex = await generateResumeText(prompt, { ...options,
          fetchImpl: async url => ({ ok: true, json: async () => url.endsWith('/apply-template') ? { prompt: 'layout' }
            : url.endsWith('/tokenize') ? { tokens: [1] }
              : { choices: [{ finish_reason: 'stop', message: { content: '{"spacing":"compact","breakBefore":null}' } }] } }) });
        return preparedLatex;
      },
      compile: async () => ({ pdf: Buffer.from('%PDF-mock'), text: source.text, links: [], pageCount: 1 }),
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].comparison, true);
  }
});
