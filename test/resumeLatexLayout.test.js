import test from 'node:test';
import assert from 'node:assert/strict';
import { RESUME_LATEX_PREAMBLE, resumeLatexLinkTarget } from '../src/utils/resumeLatexFormat.js';
import { prepareResumeCompiler, compileResumeLatex } from '../resume-tailoring/latexCompiler.js';

test('compiled Abey entries align the employer with dates and keep achievements on their own rows',
  { skip: process.env.RESUME_COMPILER_INTEGRATION !== 'true' }, async () => {
    const deadline = Date.now() + 90000;
    await prepareResumeCompiler({ deadline });
    const latex = RESUME_LATEX_PREAMBLE + String.raw`
\textbf{Alex Example}
alex@example.test
\section*{EXPERIENCE}
\resumeSubHeadingListStart
\resumeSubheading{Cedar Labs}{Jul 2019 -- Dec 2021}{Software Developer}{Pune, India}
\resumeItemListStart
\resumeItem{Created Python scripts to validate imported CSV files before loading records into SQL tables. Reported missing fields and duplicate records for manual review.}
\resumeItem{Built reusable SQL queries for support reports and checked report totals against source records. Documented query assumptions and known data limitations.}
\resumeItem{Developed Python services and automated tests.}
\resumeItemListEnd
\resumeSubHeadingListEnd
\end{document}`;
    const output = await compileResumeLatex(latex, { deadline });
    const lines = output.text.split('\n').map(line => line.trim());
    assert.ok(lines.some(line => /Cedar Labs/.test(line) && /Jul 2019/.test(line)),
      'the employer and dates must share the first entry row');
    assert.ok(lines.some(line => /Software Developer/.test(line) && /Pune, India/.test(line)),
      'the actual role and location must share the second entry row');
    assert.ok(lines.some(line => /^(?:\u2022\s*)?Created Python/.test(line)), 'the achievement must start on a separate row');
    assert.match(output.text, /Developed Python services and automated tests\./);
    assert.equal(output.pageCount, 1);
  });

test('standard LaTeX paragraphs fit without duplicate empty rows',
  { skip: process.env.RESUME_COMPILER_INTEGRATION !== 'true' }, async () => {
    const deadline = Date.now() + 90000;
    await prepareResumeCompiler({ deadline });
    const paragraph = 'Built Python services and automated tests for internal teams. Documented API behavior and reviewed application logs with support colleagues.';
    const body = Array(20).fill(paragraph + String.raw`\par`).join('\n');
    const output = await compileResumeLatex(RESUME_LATEX_PREAMBLE + body + '\n\\end{document}', { deadline });
    assert.equal(output.pageCount, 1, 'line terminators must not insert an extra empty row after each paragraph');
  });

test('Abey header, icons and long entry titles compile offline on letter pages',
  { skip: process.env.RESUME_COMPILER_INTEGRATION !== 'true' }, async () => {
    const deadline = Date.now() + 90000;
    await prepareResumeCompiler({ deadline });
    const latex = RESUME_LATEX_PREAMBLE + String.raw`\begin{center}
{\Huge \scshape Alex Example} \\ \vspace{1pt}
\small \faEnvelope{} \href{mailto:alex@example.test}{alex@example.test}
\end{center}
\section{PROJECTS}
\resumeSubHeadingListStart
\resumeProjectHeading{\textbf{\large A deliberately long source-supported project title demonstrating that candidate project names wrap within the available entry width}}{Jan 2024 -- Present}
\resumeItemListStart
\resumeItem{Developed Python services and automated tests.}
\resumeItemListEnd
\resumeSubHeadingListEnd
\end{document}`;
    const output = await compileResumeLatex(latex, { deadline });
    assert.equal(output.pageCount, 1);
    assert.match(output.text, /project names\s+wrap within/);
    assert.deepEqual(output.links, ['mailto:alex@example.test']);
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = getDocument({ data: new Uint8Array(output.pdf), isEvalSupported: false, verbosity: 0 });
    try {
      const document = await task.promise;
      const page = await document.getPage(1);
      assert.deepEqual(page.view, [0, 0, 612, 792]);
      const content = await page.getTextContent();
      const name = content.items.find(item => item.str.includes('Alex Example'));
      assert.ok(Math.abs(name.transform[3]) > 20, 'the Abey name must use its large header font');
      assert.ok(Math.abs(name.transform[4] + name.width / 2 - 306) < 3, 'the name must be centered');
    } finally { await task.destroy(); }
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
