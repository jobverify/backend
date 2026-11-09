import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSourceFacts } from '../src/services/resumeLatexContent.js';
import { createRequire } from 'node:module';
import { extractResumeSource, normalizeResumeLinks } from '../src/services/resumeSource.js';
import { extractResumeText } from '../src/services/resumeText.js';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');

function pdfWithContactLink() {
  const content = 'BT /F1 12 Tf 50 750 Td (Asha Rao) Tj 0 -18 Td (Software Engineer at Cedar Systems, 2021-2024.) Tj ET';
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R /Annots [6 0 R] >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`, '<< /Type /Annot /Subtype /Link /Rect [50 700 200 720] /A << /S /URI /URI (mailto:asha@example.test) >> >>'];
  let pdf = '%PDF-1.7\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const start = Buffer.byteLength(pdf);
  pdf += `xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return Buffer.from(pdf);
}

test('PDF source retains visible lines and contact annotations', async () => {
  const source = await extractResumeSource({ extension: 'pdf', data: pdfWithContactLink() });
  assert.match(source.text, /Asha Rao\nSoftware Engineer at Cedar Systems/);
  assert.ok(source.links.includes('mailto:asha@example.test'));
});

test('source extraction respects an expired worker deadline', async () => {
  await assert.rejects(extractResumeSource({ extension: 'pdf', data: pdfWithContactLink(), deadline: Date.now() - 1 }),
    { code: 'time_limit', statusCode: 504 });
});

test('encoded email punctuation remains safe without allowing mail header injection', () => {
  assert.deepEqual(normalizeResumeLinks(['mailto:al%3Fex@example.com', 'mailto:al%23ex@example.com']),
    ['mailto:al%3Fex@example.com', 'mailto:al%23ex@example.com']);
  for (const unsafe of ['mailto:alex@example.com?bcc=other@example.com', 'mailto:alex@example.com?attach=file.txt',
    'mailto:al%0D%0ABcc%3Aother@example.com', 'mailto:alex@invalid%3Fdomain.com']) assert.deepEqual(normalizeResumeLinks([unsafe]), []);
});

test('Word source retains paragraph boundaries and hyperlink relationships', async () => {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:t>Asha Rao</w:t></w:r></w:p><w:p><w:r><w:t>Software Engineer at Cedar Systems, 2021-2024.</w:t></w:r></w:p><w:p><w:hyperlink r:id="rId1"><w:r><w:t>Portfolio</w:t></w:r></w:hyperlink></w:p></w:body></w:document>');
  zip.file('word/_rels/document.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.test/asha?view=work&amp;lang=en" TargetMode="External"/></Relationships>');
  const source = await extractResumeSource({ extension: 'docx', data: await zip.generateAsync({ type: 'nodebuffer' }) });
  assert.match(source.text, /Asha Rao\n\nSoftware Engineer/);
  assert.deepEqual(source.links, ['https://example.test/asha?view=work&lang=en']);
});

test('TeX source preserves line breaks and hyperlink targets without executing TeX', async () => {
  const data = Buffer.from(String.raw`\documentclass{article}
\begin{document}
\textbf{Asha Rao}\\
\href{mailto:asha@example.test}{Email} \href{tel:+919876543210}{Call}
\section{Experience}
Software Engineer | Cedar Systems | 2021--2024
Built React tools with JavaScript. \href{https://example.test/asha}{Portfolio}
\input{/private/file}\write18{echo secret}
\end{document}`);
  const source = await extractResumeSource({ extension: 'tex', data });
  assert.match(source.text, /Asha Rao\n/);
  assert.match(source.text, /Cedar Systems/);
  assert.doesNotMatch(source.text, /private\/file|echo secret|documentclass/);
  assert.deepEqual(source.links, ['mailto:asha@example.test', 'tel:+919876543210', 'https://example.test/asha']);
  assert.equal(await extractResumeText({ extension: 'tex', data }), source.text);
});

test('inline TeX section headings retain separate source lines', async () => {
  const source = await extractResumeSource({ extension: 'tex', data: Buffer.from(String.raw`\documentclass{article}\begin{document}Asha Rao\section{Experience}Software Engineer | Cedar Systems | 2021--2024\section{Education}BSc | Valley University | 2020\end{document}`) });
  assert.match(source.text, /Asha Rao\nExperience\nSoftware Engineer/);
  assert.match(source.text, /2024\nEducation\nBSc/);
});

test('common resume macros retain separate employer, title, location and date facts', async () => {
  const document = String.raw`\documentclass{article}\begin{document}
Asha Rao\\
asha@example.test
\section{Experience}
\resumeSubheading{Cedar Systems}{Pune}{Software Engineer}{Jan 2022 -- Present}
\section{Education}
\resumeSubheading{Valley University}{Pune}{BSc Computer Science}{2016 -- 2020}
\end{document}`;
  const source = await extractResumeSource({ extension: 'tex', data: Buffer.from(document) });
  const facts = buildSourceFacts(source);
  assert.ok(facts.employment[0].anchors.includes('Cedar Systems'));
  assert.ok(facts.employment[0].anchors.includes('Software Engineer'));
  assert.ok(facts.education[0].anchors.includes('Valley University'));
});

test('source extraction rejects unsupported formats and oversized text without truncating it', async () => {
  await assert.rejects(extractResumeSource({ extension: 'txt', data: Buffer.from('Asha Rao '.repeat(10)) }), /readable|PDF|Word|LaTeX/);
  await assert.rejects(extractResumeSource({ extension: 'tex', data: Buffer.from(`\\begin{document}${'candidate '.repeat(1600)}\\end{document}`) }), /shorter|context/);
});
