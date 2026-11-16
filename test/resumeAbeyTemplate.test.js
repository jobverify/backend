import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPreparationPrompt, buildLatexTailoringPrompt, buildLatexRepairPrompt, validateLatexSource } from '../src/services/resumeLatexContent.js';
import { RESUME_LATEX_PREAMBLE, buildResumeLatexGrammar } from '../src/utils/resumeLatexFormat.js';
import { processResumeDocument } from '../resume-tailoring/resumePipeline.js';

const source = { text: 'Alex Example\nalex@example.test\nEXPERIENCE\nDeveloper | Cedar Labs | Jan 2022 - Present\nBuilt Python services and automated tests.\nEDUCATION\nBSc Computer Science | Valley University | 2018 - 2021', links: [] };
const body = String.raw`\begin{center}
{\Huge \scshape Alex Example} \\ \vspace{1pt}
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
const document = () => RESUME_LATEX_PREAMBLE + body;
const legacy = String.raw`\documentclass[11pt,a4paper]{article}
\usepackage{hyperref}
\begin{document}
Alex Example
\section*{EXPERIENCE}
Developer | Cedar Labs | Jan 2022 -- Present
\end{document}`;

test('preparation, tailoring and repair give the model actual Abey template code separately from candidate facts', () => {
  const preparation = buildPreparationPrompt({ source });
  const tailored = buildLatexTailoringPrompt({ source, baseLatex: legacy, jobSnapshot: { title: 'Developer' } });
  const repair = buildLatexRepairPrompt({ originalPrompt: tailored, latex: legacy, issues: ['Use the selected template.'] });
  for (const prompt of [preparation, tailored, repair]) {
    assert.match(prompt, /Abey/);
    assert.match(prompt, /\\newcommand\{\\resumeSubheading\}/);
    assert.match(prompt, /\\resumeSubheading\s*\{/);
    assert.match(prompt, /\\titleformat\{\\section\}/);
    assert.match(prompt, /sample.*(?:facts|candidate)|(?:facts|candidate).*sample/i);
    assert.match(prompt, /untrusted data/);
    assert.ok(prompt.includes('alex@example.test'));
    assert.doesNotMatch(prompt, /Your Name|\\section\{CERTIFICATIONS\}|\\section\{EXTRACURRICULAR\}/, 'template sample facts and unsupported sections must not contaminate generation');
    assert.doesNotMatch(prompt, /Avoid tables for the main reading flow|Do not use math mode or custom macros/);
  }
  assert.match(tailored, /(?:Abey|selected template).*(?:override|precedence)|(?:override|precedence).*(?:Abey|selected template)/i);
});

test('new worker documents require Abey formatting while legacy documents remain readable', () => {
  assert.equal(validateLatexSource(legacy), legacy);
  assert.throws(() => validateLatexSource(legacy, { requireTemplate: true }), error => error.reason === 'template_mismatch');
  assert.equal(validateLatexSource(document(), { requireTemplate: true }), document().trim());
});

test('a large name font cannot leak into the centered contact row', () => {
  const broken = document().replace('{\\Huge \\scshape Alex Example} \\\\ \\vspace{1pt}', '\\Huge \\scshape Alex Example\n\\vspace{4pt}');
  assert.throws(() => validateLatexSource(broken, { requireTemplate: true }), error => {
    assert.equal(error.reason, 'header_structure');
    assert.match(error.message, /group|brac/i);
    assert.doesNotMatch(error.message, /Alex|example\.test/);
    return true;
  });
  assert.equal(validateLatexSource(document(), { requireTemplate: true }), document().trim());
  const accented = document().replace('Alex Example', String.raw`Anne \& José`);
  assert.equal(validateLatexSource(accented, { requireTemplate: true }), accented.trim());
});

test('new Abey output cannot repeat centered name and contact blocks', () => {
  const firstHeader = body.slice(0, body.indexOf('\\section{EXPERIENCE}'));
  for (const extra of [firstHeader, '\\textbf{' + firstHeader + '}']) {
    const repeated = document().replace('\\section{EXPERIENCE}', extra + '\\section{EXPERIENCE}');
    assert.throws(() => validateLatexSource(repeated, { requireTemplate: true }), error => error.reason === 'header_structure');
  }
  const commented = document().replace('\\section{EXPERIENCE}', '% \\begin{center}\n\\section{EXPERIENCE}');
  assert.equal(validateLatexSource(commented, { requireTemplate: true }), commented.trim());
});

test('Abey lists must close before a new section, with actionable feedback that omits candidate text', () => {
  const missing = document().replace('\\resumeSubHeadingListEnd\n\\section{EDUCATION}', '\\section{EDUCATION}');
  assert.throws(() => validateLatexSource(missing, { requireTemplate: true }), error => {
    assert.equal(error.reason, 'environment_structure');
    assert.match(error.message, /Close \\resumeSubHeadingListEnd before \\section at line \d+/);
    assert.doesNotMatch(error.message, /Cedar Labs|Valley University|alex@/);
    return true;
  });
});

test('nested Abey and explicit environments reject missing, crossed and unmatched closures', () => {
  for (const broken of [
    body.replace('\\resumeItemListEnd\n\\resumeSubHeadingListEnd', '\\resumeSubHeadingListEnd\n\\resumeItemListEnd'),
    body.replace('\\resumeItemListEnd', ''),
    body.replace('\\resumeItemListEnd', '\\end{itemize}'),
    body.replace('\\end{center}', ''),
    body.replace('\\end{document}', '\\resumeItemListEnd\n\\end{document}'),
    body.replace('\\resumeSubHeadingListEnd\n\\end{document}', '\\end{document}'),
  ]) assert.throws(() => validateLatexSource(RESUME_LATEX_PREAMBLE + broken, { requireTemplate: true }), error => error.reason === 'environment_structure');
  assert.equal(validateLatexSource(document(), { requireTemplate: true }), document().trim());
});

test('commented and escaped closing commands cannot conceal an unclosed Abey list', () => {
  for (const fake of ['% \\resumeSubHeadingListEnd', '\\\\resumeSubHeadingListEnd']) {
    const broken = document().replace('\\resumeSubHeadingListEnd\n\\section{EDUCATION}', `${fake}\n\\section{EDUCATION}`);
    assert.throws(() => validateLatexSource(broken, { requireTemplate: true }), error => error.reason === 'environment_structure');
  }
  const commented = RESUME_LATEX_PREAMBLE + body.replace('\\resumeItemListEnd', '% A literal \\resumeSubHeadingListEnd is not a command\n\\resumeItemListEnd');
  assert.equal(validateLatexSource(commented, { requireTemplate: true }), commented.trim());
});

test('Abey entries and bullet commands require their corresponding list context', () => {
  for (const entry of [String.raw`\resumeSubheading{Private employer}{2020}{Developer}{}`,
    String.raw`\resumeProjectHeading{Private project}{2020}`, String.raw`\resumeSubSubheading{Private activity}{}`,
    String.raw`\resumeItem{Private achievement}`, String.raw`\resumeSubItem{Private achievement}`,
    String.raw`\classesList{a}{b}{c}{d}`, String.raw`\item Private achievement`]) {
    const broken = document().replace('\\end{document}', entry + '\n\\end{document}');
    assert.throws(() => validateLatexSource(broken, { requireTemplate: true }), error => {
      assert.equal(error.reason, 'environment_structure');
      assert.match(error.message, /inside.*list|list.*before/i);
      assert.doesNotMatch(error.message, /Private/);
      return true;
    });
  }
  const explicit = document().replace('\\end{document}', '\\begin{itemize}\\small \\item Supported statement\\end{itemize}\n\\end{document}');
  assert.equal(validateLatexSource(explicit, { requireTemplate: true }), explicit);
});

test('an Abey preamble cannot publish employer entries as generic prose', () => {
  const generic = RESUME_LATEX_PREAMBLE + String.raw`\begin{center}Alex Example\end{center}
\section{EXPERIENCE}
\textbf{Cedar Labs} | Developer | Jan 2022 -- Present\par
Built Python services and automated tests.
\end{document}`;
  assert.throws(() => validateLatexSource(generic, { requireTemplate: true }), error => error.reason === 'template_mismatch');
});

test('repair feedback reuses the supplied template without repeating an unchanged preamble', () => {
  const originalPrompt = buildPreparationPrompt({ source });
  const prompt = buildLatexRepairPrompt({ originalPrompt, latex: document(), issues: ['Preserve the original dates.'] });
  const feedback = JSON.parse(prompt.split('\n').at(-1));
  assert.equal(feedback.templatePreambleOmitted, true);
  assert.equal(feedback.failedLatex, body);
  assert.ok(prompt.includes(RESUME_LATEX_PREAMBLE), 'the original template code must remain available to repair');
  const legacyFeedback = JSON.parse(buildLatexRepairPrompt({ originalPrompt, latex: legacy, issues: ['Wrong template.'] }).split('\n').at(-1));
  assert.equal(legacyFeedback.templatePreambleOmitted, false);
  assert.equal(legacyFeedback.failedLatex, legacy, 'a mismatched preamble must remain visible for correction');
});

test('candidate output cannot redefine trusted template commands or add dependencies', () => {
  for (const injection of [String.raw`\renewcommand{\resumeSubheading}[4]{#1}`,
    String.raw`\newcommand{\replacement}{Plain layout}`, String.raw`\usepackage{geometry}`,
    String.raw`\input{private-file}`, String.raw`\csname input\endcsname`]) {
    assert.throws(() => validateLatexSource(document().replace('\\end{document}', `${injection}\n\\end{document}`), { requireTemplate: true }), /LaTeX/);
  }
  assert.throws(() => validateLatexSource(document().replace('-0.6in', '-0.1in'), { requireTemplate: true }), error => error.reason === 'template_mismatch');
});

test('decoding permits Abey entry macros, contact icons and its header size', () => {
  const grammar = buildResumeLatexGrammar(['mailto:alex@example.test']);
  assert.match(grammar, /letterpaper/);
  const commands = grammar.split('\n').find(line => line.startsWith('command ::='));
  for (const name of ['faPhone', 'faEnvelope']) {
    assert.ok(commands.includes(JSON.stringify(name)), `${name} must be available to generation`);
  }
  for (const name of ['Huge', 'huge', 'LARGE', 'Large', 'large', 'scshape']) assert.ok(!commands.includes(JSON.stringify(name)), `${name} must not leak into the contact row`);
  const nameStyle = grammar.split('\n').find(line => line.startsWith('name-style ::='));
  assert.ok(nameStyle?.includes(JSON.stringify(String.raw`{\Huge \scshape `)));
  assert.ok(nameStyle.includes(JSON.stringify(String.raw`\normalsize`)), 'contact text must return to normal size after the name');
  for (const name of ['resumeSubheading', 'resumeSubSubheading', 'resumeProjectHeading', 'resumeItem', 'resumeSubItem', 'classesList', 'item']) {
    assert.ok(!commands.includes(JSON.stringify(name)), `${name} must not emit an item outside its required list`);
    assert.ok(grammar.includes(JSON.stringify(name)), `${name} must remain available in a scoped list rule`);
  }
  for (const name of ['resumeSubHeadingListStart', 'resumeSubHeadingListEnd', 'resumeItemListStart', 'resumeItemListEnd']) {
    assert.ok(!commands.includes(JSON.stringify(name)), `${name} must be paired by the structural grammar instead of a free command`);
    assert.ok(grammar.includes(JSON.stringify('\\' + name)));
  }
  assert.ok(!commands.includes('"newcommand"'));
  assert.ok(!commands.includes('"href"'), 'links must still use the restricted destinations rule');
  assert.doesNotMatch(RESUME_LATEX_PREAMBLE, /\\obeylines|\\renewcommand\{\\\\\}/);
});

test('worker retries generic output and compiles the exact corrected Abey document', async () => {
  let generations = 0;
  const compiled = [];
  const output = await processResumeDocument({ source }, {
    generate: async (_prompt, options) => options.comparison
      ? JSON.stringify({ evidence: 'All original facts retained.', missingFacts: [], unsupportedClaims: [], supported: true })
      : ++generations === 1 ? legacy : document(),
    compile: async latex => { compiled.push(latex); return { pdf: Buffer.from('%PDF-1.7\nfixture'), pageCount: 1, text: source.text, links: ['mailto:alex@example.test'] }; },
  });
  assert.equal(generations, 2, 'a generic layout must be repaired before compilation');
  assert.deepEqual(compiled, [document().trim()]);
  assert.equal(output.latex, compiled[0], 'the downloadable source must be the actual compiled document');
  assert.equal(output.styleVersion, 'abey-resume-v1');
});

test('a missing Abey list closure is repaired before any compiler call', async () => {
  const broken = document().replace('\\resumeSubHeadingListEnd\n\\section{EDUCATION}', '\\section{EDUCATION}');
  const prompts = [], compiled = [], events = [];
  await processResumeDocument({ source }, {
    generate: async (prompt, options) => {
      if (options.comparison) return JSON.stringify({ evidence: 'All original facts retained.', missingFacts: [], unsupportedClaims: [], supported: true });
      prompts.push(prompt);
      return prompts.length === 1 ? broken : document();
    },
    compile: async latex => { compiled.push(latex); return { pdf: Buffer.from('%PDF-fixture'), pageCount: 1, text: source.text, links: ['mailto:alex@example.test'] }; },
    onDiagnostic: event => events.push(event),
  });
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /Close \\\\resumeSubHeadingListEnd before \\\\section at line \d+/);
  assert.deepEqual(compiled, [document().trim()]);
  assert.ok(events.some(event => event.reason === 'environment_structure'));
  assert.doesNotMatch(JSON.stringify(events), /Cedar Labs|Valley University|alex@/);
});
