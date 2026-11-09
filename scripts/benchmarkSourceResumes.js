// Synthetic fixtures only. No database, credentials, external API or live
// workflow dispatch is used by this local document-processing benchmark.
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import PDFDocument from 'pdfkit';
import JSZip from 'jszip';
import { extractResumeSource } from '../src/services/resumeSource.js';
import { processSourceTemplateDocument as processResumeDocument } from '../resume-tailoring/sourceTemplatePipeline.js';
import { buildSourceTemplate } from '../resume-tailoring/sourceTemplate.js';

const text = [
  'Alex Morgan', 'alex@example.test | +91 98765 43210',
  'SUMMARY', 'Software engineer building reliable APIs and internal tools.',
  'EXPERIENCE', 'Example Systems', 'Software Engineer | Jan 2022 - Present',
  '- Built SQL reporting for operational teams.',
  '- Developed Python services and Redis caching, reducing latency by 25%.',
  '- Automated integration tests and release checks.',
  '', 'Previous Software', 'Junior Engineer | Jul 2020 - Dec 2021',
  '- Maintained Java applications and improved error handling.',
  '- Delivered reporting tools for 12 internal teams.',
  'PROJECTS', 'Service Monitor | 2023', '- Built a Python monitoring tool with Redis.',
  'EDUCATION', 'Example University', 'BSc Computer Science | 2016 - 2020',
  'SKILLS', 'Python, Java, SQL, Redis, Git',
].join('\n');
const jobSnapshot = { title: 'Python Software Engineer', requiredSkills: ['Python', 'Redis', 'SQL'] };
const outputIndex = process.argv.indexOf('--output');
if (outputIndex >= 0 && !process.argv[outputIndex + 1]) throw new Error('--output requires a directory');
const outputRoot = outputIndex >= 0 ? path.resolve(process.argv[outputIndex + 1]) : null;

async function sourceBytes(format, original) {
  if (format === 'pdf') return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ margin: 42, size: 'A4' });
    const chunks = [];
    pdf.on('data', chunk => chunks.push(chunk));
    pdf.once('error', reject);
    pdf.once('end', () => resolve(Buffer.concat(chunks)));
    pdf.font('Helvetica').fontSize(11).text(original);
    pdf.end();
  });
  if (format === 'tex') return Buffer.from(buildSourceTemplate({ mode: 'base', source: { text: original, links: [] } }).latex);
  const escapeXml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${original.split('\n').map(line => `<w:p><w:r><w:t>${escapeXml(line)}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

const cases = [];
for (const [label, extension, mode, original] of [
  ['standard-pdf', 'pdf', 'tailored', text],
  ['standard-docx', 'docx', 'tailored', text],
  ['standard-tex', 'tex', 'tailored', text],
  ['long-base-pdf', 'pdf', 'base', text.replace('EDUCATION', `${'- Built reliable services and automated internal reporting.\n'.repeat(150)}EDUCATION`)],
]) {
  const data = await sourceBytes(extension, original);
  const started = performance.now();
  const source = await extractResumeSource({ extension, data });
  const extracted = performance.now();
  const output = await processResumeDocument({ mode, source, jobSnapshot });
  const finished = performance.now();
  cases.push({ label, inputBytes: data.length, sourceCharacters: source.text.length, pages: output.pageCount,
    extractionSeconds: Number(((extracted - started) / 1000).toFixed(3)),
    renderAndValidationSeconds: Number(((finished - extracted) / 1000).toFixed(3)),
    totalSeconds: Number(((finished - started) / 1000).toFixed(3)) });
  if (outputRoot) {
    await fs.mkdir(outputRoot, { recursive: true });
    await fs.writeFile(path.join(outputRoot, `${label}.pdf`), output.pdf);
    await fs.writeFile(path.join(outputRoot, `${label}.tex`), output.latex);
  }
}
const report = { scope: 'Synthetic source extraction, native PDF/TeX generation and actual PDF validation; excludes MongoDB and GitHub queue/setup time.',
  node: process.version, generationMethod: 'source-template:v1', cases, freshProcessSeconds: Number(process.uptime().toFixed(3)) };
if (outputRoot) await fs.writeFile(path.join(outputRoot, 'benchmark.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
