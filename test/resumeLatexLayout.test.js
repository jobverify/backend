import test from 'node:test';
import assert from 'node:assert/strict';
import { RESUME_LATEX_PREAMBLE, resumeLatexLinkTarget } from '../src/utils/resumeLatexFormat.js';
import { prepareResumeCompiler, compileResumeLatex } from '../resume-tailoring/latexCompiler.js';

test('compiled resume lines keep employment headings together and achievements on their own rows',
  { skip: process.env.RESUME_COMPILER_INTEGRATION !== 'true' }, async () => {
    const deadline = Date.now() + 90000;
    await prepareResumeCompiler({ deadline });
    const latex = RESUME_LATEX_PREAMBLE + String.raw`
\textbf{Alex Example}
alex@example.test
\section*{EXPERIENCE}
\textbf{Cedar Labs} \hfill \textsc{Software Developer} \hfill \textit{Jul 2019 -- Dec 2021}
Created Python scripts to validate imported CSV files before loading records into SQL tables. Reported missing fields and duplicate records for manual review.
Built reusable SQL queries for support reports and checked report totals against source records. Documented query assumptions and known data limitations.
\begin{itemize}
\item Developed Python services and automated tests.
\end{itemize}
\end{document}`;
    const output = await compileResumeLatex(latex, { deadline });
    const lines = output.text.split('\n').map(line => line.trim());
    assert.ok(lines.some(line => /Cedar Labs/.test(line) && /Software Developer/.test(line) && /Jul 2019/.test(line)),
      'the employer, actual title and dates must share a header row');
    assert.ok(lines.some(line => /^Created Python/.test(line)), 'the achievement must start on a separate row');
    assert.match(output.text, /Developed Python services and automated tests\./);
    assert.equal(output.pageCount, 1);
  });

test('explicit LaTeX breaks and source newlines do not add duplicate empty rows',
  { skip: process.env.RESUME_COMPILER_INTEGRATION !== 'true' }, async () => {
    const deadline = Date.now() + 90000;
    await prepareResumeCompiler({ deadline });
    const paragraph = 'Built Python services and automated tests for internal teams. Documented API behavior and reviewed application logs with support colleagues.';
    const body = Array(20).fill(paragraph + String.raw` \\`).join('\n');
    const output = await compileResumeLatex(RESUME_LATEX_PREAMBLE + body + '\n\\end{document}', { deadline });
    assert.equal(output.pageCount, 1, 'line terminators must not insert an extra empty row after each paragraph');
  });

test('long original URL identifiers wrap inside readable page boundaries without changing their targets',
  { skip: process.env.RESUME_COMPILER_INTEGRATION !== 'true' }, async () => {
    const deadline = Date.now() + 90000;
    await prepareResumeCompiler({ deadline });
    const link = 'https://example.test/certificates/' + 'AbCdEf1234567890'.repeat(12);
    const latex = RESUME_LATEX_PREAMBLE + '\\url{' + resumeLatexLinkTarget(link) + '}\n\\end{document}';
    const output = await compileResumeLatex(latex, { deadline });
    assert.equal(output.pageCount, 1);
    assert.deepEqual(output.links, [link]);
  });

test('ordinary section commands do not introduce unsupported candidate numbers',
  { skip: process.env.RESUME_COMPILER_INTEGRATION !== 'true' }, async () => {
    const deadline = Date.now() + 90000;
    await prepareResumeCompiler({ deadline });
    const output = await compileResumeLatex(RESUME_LATEX_PREAMBLE + String.raw`
\section{EXPERIENCE}
Developed software and automated tests.
\subsection{Selected work}
Maintained support documentation.
\end{document}`, { deadline });
    assert.match(output.text, /EXPERIENCE/);
    assert.doesNotMatch(output.text, /\d/);
  });

test('technical skill names remain whole when a long skill list wraps',
  { skip: process.env.RESUME_COMPILER_INTEGRATION !== 'true' }, async () => {
    const deadline = Date.now() + 90000;
    await prepareResumeCompiler({ deadline });
    const output = await compileResumeLatex(RESUME_LATEX_PREAMBLE + String.raw`
\section{TECHNICAL SKILLS}
\textbf{QA \& Test Automation:} API Testing, Karate Framework, Selenium, Cucumber, BDD, Test Automation, Functional Testing, Acceptance Testing, E2E Testing, Performance Testing
\end{document}`, { deadline });
    assert.match(output.text, /BDD,\s+Test\s+Automation,/);
    assert.doesNotMatch(output.text, /Automa-\s+tion/);
  });
