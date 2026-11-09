import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareResumeRuntime, processResumeDocument } from '../resume-tailoring/resumePipeline.js';
import { preparationMetadata, requirePreparedResume } from '../src/services/resumePreparationService.js';

const source = { text: 'Alex Example\nalex@example.com\nEXPERIENCE\nExample Corp\nSoftware Engineer | Jan 2022 - Present\nDeveloped Java services and automated tests.\nEDUCATION\nExample University\nBSc Computer Science | 2018 - 2022', links: ['mailto:alex@example.com'] };
const latex = '\\documentclass[11pt]{article}\n\\begin{document}\nAlex Example\\end{document}';
const compiled = { pdf: Buffer.from('%PDF-test'), text: source.text, links: source.links, pageCount: 2 };
const supported = JSON.stringify({ evidence: 'All generated claims match the original source facts.', supported: true, missingFacts: [], unsupportedClaims: [] });

test('pipeline separately compares source claims and returns only validated documents', async () => {
  const calls = [];
  const result = await processResumeDocument({ mode: 'base', source }, {
    generate: async (prompt, options) => { calls.push(options.comparison); return options.comparison ? supported : latex; },
    compile: async () => compiled,
  });
  assert.deepEqual(calls, [undefined, true]);
  assert.equal(result.pageCount, 2);
  assert.equal(result.latex, latex);
  assert.ok(result.facts);
});

test('generation and its one repair receive source-supported contact destinations', async () => {
  let generations = 0;
  const original = { ...source, text: source.text + '\n+1 202 555 0123', links: [...source.links, 'https://example.test/alex'] };
  await processResumeDocument({ mode: 'base', source: original }, {
    generate: async (_prompt, options) => {
      if (options.comparison) return supported;
      assert.deepEqual(options.allowedLinks, ['mailto:alex@example.com', 'https://example.test/alex', 'tel:12025550123', 'tel:+12025550123']);
      if (++generations === 1) return latex.replace('11pt', '9pt');
      return latex;
    },
    compile: async () => ({ ...compiled, text: original.text, links: original.links }),
  });
  assert.equal(generations, 2);
});

test('generation reserves time for PDF compilation and the independent audit within the shared worker deadline', async () => {
  const deadline = Date.now() + 20 * 60000;
  let generationDeadline, auditDeadline, compilationDeadline;
  await processResumeDocument({ mode: 'base', source }, {
    deadline,
    generate: async (_prompt, options) => {
      if (options.comparison) { auditDeadline = options.deadline; return supported; }
      generationDeadline = options.deadline;
      return latex;
    },
    compile: async (_latex, options) => { compilationDeadline = options.deadline; return compiled; },
  });
  assert.ok(generationDeadline <= deadline - 3 * 60000, 'inference must leave three minutes for validation on a warm worker');
  assert.ok(generationDeadline > deadline - 4 * 60000);
  assert.equal(compilationDeadline, deadline);
  assert.equal(auditDeadline, deadline);
});

test('the actual generation and independent audit consume confirmed candidate evidence and exclude unconfirmed inference', async () => {
  const candidateEvidence = { version: 3, hash: 'test', experiences: [{ id: 'e1', kind: 'project', company: 'Personal', role: 'Latency monitor', summary: 'Built a service monitor', skills: ['Redis'] }],
    achievements: [{ id: 'a1', experienceId: 'e1', claim: 'Reduced response latency by 25%', context: 'Redis cache', metrics: '25%', skills: ['Redis'], provenance: 'manual', confirmed: true },
      { id: 'a2', claim: 'Invented quantum skill', skills: ['Quantum'], provenance: 'agent_inferred', confirmed: false }], skills: ['Redis', 'Quantum'] };
  const evidenceText = `${source.text}\nPROJECTS\nLatency monitor | Personal\nBuilt a service monitor\nReduced response latency by 25%\nRedis cache\nSkills: Redis`;
  const prompts = [];
  const result = await processResumeDocument({ mode: 'base', source, candidateEvidence }, {
    generate: async (prompt, options) => { prompts.push(prompt); return options.comparison ? supported : latex; },
    compile: async () => ({ ...compiled, text: evidenceText }),
  });
  for (const prompt of prompts) {
    assert.match(prompt, /Reduced response latency by 25%/);
    assert.match(prompt, /Redis/);
    assert.doesNotMatch(prompt, /Invented quantum skill|Quantum/);
  }
  assert.ok(result.facts.metrics.includes('25%'), 'evidence numbers participate in actual fidelity validation');
  assert.ok(result.facts.skills.includes('Redis'));
});

test('one repair can fix pagination, with no unbounded model loop', async () => {
  let generations = 0, compilations = 0;
  const result = await processResumeDocument({ mode: 'tailored', source, baseLatex: latex, jobSnapshot: { title: 'Engineer' } }, {
    generate: async (_prompt, options) => options.comparison ? supported : (generations++, latex),
    compile: async () => ({ ...compiled, pageCount: ++compilations === 1 ? 3 : 2 }),
  });
  assert.equal(generations, 2);
  assert.equal(result.pageCount, 2);
});

test('a failed comparison never publishes a document and permits only one repair', async () => {
  let generations = 0;
  await assert.rejects(processResumeDocument({ mode: 'base', source }, {
    generate: async (_prompt, options) => options.comparison
      ? JSON.stringify({ evidence: 'Original employment dates are absent from the generated document.', supported: false, missingFacts: ['employment dates'], unsupportedClaims: [] }) : (generations++, latex),
    compile: async () => compiled,
  }), { code: 'factual_validation_failed' });
  assert.equal(generations, 2);
});

test('base preserves long resumes while tailoring enforces two pages', async () => {
  const result = await processResumeDocument({ mode: 'base', source }, {
    generate: async (_prompt, options) => options.comparison ? supported : latex,
    compile: async () => ({ ...compiled, pageCount: 4 }),
  });
  assert.equal(result.pageCount, 4);
});

test('an incomplete generation uses the same single bounded repair and emits content-free diagnostics', async () => {
  let generations = 0;
  const events = [];
  const result = await processResumeDocument({ mode: 'base', source }, {
    onDiagnostic: event => events.push(event),
    generate: async (_prompt, options) => {
      if (options.comparison) return supported;
      if (++generations === 1) throw Object.assign(new Error('private incomplete resume'), { code: 'model_output_incomplete' });
      return latex;
    },
    compile: async () => compiled,
  });
  assert.equal(generations, 2);
  assert.equal(result.pageCount, 2);
  assert.ok(events.some(event => event.code === 'model_output_incomplete' && event.stage === 'generating'));
  assert.doesNotMatch(JSON.stringify(events), /alex@|Example Corp|private|documentclass/);
});

test('failed repair retains a useful safe failure code without leaking compiler text', async () => {
  const events = [];
  await assert.rejects(processResumeDocument({ mode: 'base', source }, {
    onDiagnostic: event => events.push(event),
    generate: async () => latex,
    compile: async () => { throw Object.assign(new Error('private document line with alex@example.com'), { code: 'compiler_dependency_missing' }); },
  }), error => {
    assert.equal(error.code, 'compiler_dependency_missing');
    assert.match(error.message, /compiler.*dependenc/i);
    assert.doesNotMatch(error.message, /alex@|private document/);
    return true;
  });
  assert.equal(events.filter(event => event.code === 'compiler_dependency_missing').length, 1);
});

test('oversized full input is rejected once without spending a repair generation', async () => {
  let calls = 0;
  await assert.rejects(processResumeDocument({ mode: 'base', source }, {
    generate: async () => { calls++; throw Object.assign(new Error('Input too large; nothing truncated.'), { statusCode: 422, code: 'input_too_large' }); },
    compile: async () => assert.fail('oversized input must not compile'),
  }), { statusCode: 422 });
  assert.equal(calls, 1);
});

test('a comparison without source evidence cannot publish a resume', async () => {
  await assert.rejects(processResumeDocument({ mode: 'base', source }, {
    generate: async (_prompt, options) => options.comparison ? JSON.stringify({ supported: true, missingFacts: [], unsupportedClaims: [] }) : latex,
    compile: async () => compiled,
  }), error => error.code === 'comparison_invalid');
});

test('a fenced model response reaches compilation and factual validation without a repair', async () => {
  let generations = 0;
  const result = await processResumeDocument({ mode: 'base', source }, {
    generate: async (_prompt, options) => options.comparison ? supported : (generations++, `\`\`\`latex\n${latex}\n\`\`\``),
    compile: async document => { assert.equal(document, latex); return compiled; },
  });
  assert.equal(generations, 1);
  assert.equal(result.latex, latex);
  assert.equal(result.pageCount, 2);
});

test('LaTeX rejection gives the repair specific guidance and public logs only a safe reason', async () => {
  let generations = 0;
  const events = [];
  const result = await processResumeDocument({ mode: 'base', source }, {
    onDiagnostic: event => events.push(event),
    generate: async (prompt, options) => {
      if (options.comparison) return supported;
      if (++generations === 1) return latex.replace('\\begin{document}', '\\usepackage{private-package}\n\\begin{document}');
      const feedback = JSON.parse(prompt.split('\n').at(-1));
      assert.match(feedback.issues[0], /Remove.*packages.*geometry.*hyperref/i);
      return latex;
    },
    compile: async document => { assert.equal(document, latex); return compiled; },
  });
  assert.equal(result.pageCount, 2);
  assert.equal(generations, 2);
  assert.ok(events.some(event => event.stage === 'latex' && event.code === 'latex_invalid' && event.reason === 'unsupported_package'));
  assert.doesNotMatch(JSON.stringify(events), /alex@|private-package|documentclass/);
});

test('two invalid LaTeX outputs fail with safe reasons and never reach the compiler', async () => {
  const events = [];
  let generations = 0;
  await assert.rejects(processResumeDocument({ mode: 'base', source }, {
    onDiagnostic: event => events.push(event),
    generate: async () => { generations++; return latex.replace('11pt', '9pt'); },
    compile: async () => assert.fail('unreadable LaTeX must not compile'),
  }), { code: 'latex_invalid' });
  assert.equal(generations, 2);
  assert.equal(events.filter(event => event.reason === 'font_size').length, 2);
});

test('runtime preparation installs the compiler and local model with one shared deadline', async () => {
  const deadline = Date.now() + 60000;
  const calls = [];
  const runtime = { stop() {} };
  assert.equal(await prepareResumeRuntime({ deadline,
    prepareCompiler: async options => { calls.push('compiler'); assert.equal(options.deadline, deadline); },
    prepareModel: async options => { calls.push('model'); assert.equal(options.deadline, deadline); return runtime; },
  }), runtime);
  assert.deepEqual(calls, ['compiler', 'model']);
});

test('the original source protects facts even if historic artifact metadata omits them', async () => {
  let generations = 0;
  await assert.rejects(processResumeDocument({ mode: 'base', source, facts: { sourceText: 'forged historic facts' } }, {
    generate: async (_prompt, options) => options.comparison ? assert.fail('missing facts must fail before comparison') : (generations++, latex),
    compile: async () => ({ ...compiled, text: source.text.replace('Example Corp', 'Different Corp') }),
  }), { code: 'factual_validation_failed' });
  assert.equal(generations, 2);
});

test('invalid comparison field types cannot approve model output', async () => {
  for (const comparison of [{ evidence: 'Supported', supported: true, missingFacts: [null], unsupportedClaims: [] },
    { evidence: 'Supported', supported: 'true', missingFacts: [], unsupportedClaims: [] }]) {
    await assert.rejects(processResumeDocument({ mode: 'base', source }, {
      generate: async (_prompt, options) => options.comparison ? JSON.stringify(comparison) : latex,
      compile: async () => compiled,
    }), { code: 'comparison_invalid' });
  }
});

test('the absolute deadline cancels generation, compilation, audit, and progress callbacks', async () => {
  for (const slowStage of ['generation', 'compilation', 'audit', 'phase']) {
    let observedSignal;
    const wait = signal => {
      observedSignal = signal;
      return new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }));
    };
    const started = Date.now();
    await assert.rejects(processResumeDocument({ mode: 'base', source }, {
      deadline: started + 100,
      generate: async (_prompt, options) => {
        if (slowStage === 'generation' || (slowStage === 'audit' && options.comparison)) await wait(options.signal);
        return options.comparison ? supported : latex;
      },
      compile: async (_latex, { signal }) => { if (slowStage === 'compilation') await wait(signal); return compiled; },
      onPhase: async (_phase, { signal }) => { if (slowStage === 'phase') await wait(signal); },
    }), { code: 'time_limit' });
    assert.ok(Date.now() - started < 500, `${slowStage} exceeded the shared deadline`);
    assert.equal(observedSignal.aborted, true);
  }
});

test('retired template-only base documents require AI preparation while retaining their artifacts', () => {
  const record = { sha256: 'source', preparation: { status: 'completed', generationId: 'old-generation',
    outputResumeSha: 'source', modelVersion: 'source-template:v1' } };
  assert.equal(preparationMetadata(record).stale, true);
  assert.equal(preparationMetadata(record).hasPdf, true, 'the previous document remains in history');
  assert.throws(() => requirePreparedResume(record), { statusCode: 409 });
  record.preparation.modelVersion = 'unsloth/Qwen3-4B-Instruct-2507-GGUF@pinned';
  assert.equal(preparationMetadata(record).stale, false);
  assert.equal(requirePreparedResume(record), record.preparation);
});
