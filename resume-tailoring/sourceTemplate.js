import fs from 'node:fs/promises';
import PDFDocument from 'pdfkit';
import { create as createFont } from 'fontkit';
import { buildSourceFacts, sourceWithCandidateEvidence, validateLatexSource } from '../src/services/resumeLatexContent.js';
import { MAX_RESUME_TEXT_BYTES } from '../src/services/resumeTailoringContent.js';
import { normalizeResumeLinks } from '../src/services/resumeSource.js';
import { remainingBudget } from './resumeBudget.js';
import { resumeFailure } from './resumeDiagnostics.js';

export const SOURCE_TEMPLATE_VERSION = 'source-template:v1';
export const SOURCE_TEMPLATE_STYLE = 'source-ats-v1';
const heading = /^(summary|professional summary|profile|objective|experience|work experience|professional experience|employment|education|qualifications|academic background|skills|technical skills|core skills|projects|personal projects|selected projects|certifications?|achievements?|awards|publications?|languages|interests|volunteering|references)(?::\s*(.*))?$/i;
const bullet = /^[-*•]\s+(?:built|developed|designed|implemented|created|led|managed|worked|delivered|improved|reduced|increased|maintained|collaborated|supported|achieved|optimized|automated|conducted|deployed|contributed)\b/iu;
const dated = /\b(?:19|20)\d{2}\b/u;
const clean = value => String(value || '').replace(/\r\n?/g, '\n').trim();
const supportedScripts = /^[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Common}\p{Script=Inherited}]*$/u;
const tokens = value => clean(value).normalize('NFKD').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}.+#-]*/gu) || [];
const ignoredTerms = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'is', 'it', 'of', 'on', 'or', 'our', 'the', 'to', 'we', 'with', 'you', 'your', 'job', 'role', 'team', 'work', 'experience', 'required']);
const graphemes = new Intl.Segmenter('und', { granularity: 'grapheme' });
const escapeTex = value => value.replace(/[\\{}$&#%_^~]/g, character => ({
  '\\': '\\textbackslash{}', '{': '\\{', '}': '\\}', '$': '\\$', '&': '\\&', '#': '\\#', '%': '\\%',
  '_': '\\_', '^': '\\textasciicircum{}', '~': '\\textasciitilde{}',
})[character]);
const escapeTexHref = value => value.replace(/[\\{}^~]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
  .replace(/[%_&#$]/g, character => `\\${character}`);
export const templateTextKey = value => String(value).normalize('NFC').replace(/\s+/gu, '');

function linkRanges(text, links) {
  const matches = [];
  for (const href of links) {
    const url = new URL(href);
    let pattern;
    if (url.protocol === 'mailto:') pattern = /[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d.-]+\.[a-z]{2,}/gi;
    else if (url.protocol === 'tel:') pattern = /\+?\d[\d ().-]{6,}\d/g;
    if (pattern) {
      for (const match of text.matchAll(pattern)) {
        const target = decodeURIComponent(url.pathname);
        const equal = url.protocol === 'tel:' ? match[0].replace(/\D/g, '') === target.replace(/\D/g, '') : match[0].toLowerCase() === target.toLowerCase();
        if (equal) matches.push({ start: match.index, end: match.index + match[0].length, href });
      }
    } else {
      let start = text.indexOf(href);
      while (start >= 0) {
        matches.push({ start, end: start + href.length, href });
        start = text.indexOf(href, start + href.length);
      }
    }
  }
  // A whole URL wins over an email-like substring inside that URL.
  return matches.sort((a, b) => a.start - b.start || b.end - a.end).filter((match, index, all) =>
    !all.slice(0, index).some(previous => previous.start <= match.start && previous.end > match.start));
}

function prioritize(rows, job) {
  const keywords = new Set(tokens([job?.title, job?.requiredSkills, job?.preferredSkills, job?.skills,
    String(job?.sourceDescription || job?.description || '').replace(/<[^>]*>/g, ' ')].flat().join(' ')).filter(term => !ignoredTerms.has(term)).slice(0, 1000));
  const score = text => tokens(text).reduce((sum, word) => sum + Number(keywords.has(word)), 0);
  // Only reorder an unambiguous achievement list immediately after a dated
  // record header. Ambiguous bullets and paragraph boundaries retain order.
  for (let index = 0; index < rows.length; index++) {
    if (!bullet.test(rows[index].text) || dated.test(rows[index].text) || !index ||
      rows[index - 1].group !== rows[index].group || !dated.test(rows[index - 1].text)) continue;
    let end = index + 1;
    while (end < rows.length && rows[end].group === rows[index].group && bullet.test(rows[end].text) && !dated.test(rows[end].text)) end++;
    rows.splice(index, end - index, ...rows.slice(index, end).map((row, order) => ({ row, order, score: score(row.text) }))
      .sort((a, b) => b.score - a.score || a.order - b.order).map(entry => entry.row));
    index = end - 1;
  }
}

function latexDocument(rows) {
  const line = row => {
    let start = 0;
    let result = '';
    for (const range of row.links) {
      result += escapeTex(row.text.slice(start, range.start));
      result += `\\href{${escapeTexHref(range.href)}}{${escapeTex(row.text.slice(range.start, range.end))}}`;
      start = range.end;
    }
    result += escapeTex(row.text.slice(start));
    if (row.kind === 'title') return `\\noindent{\\Large\\textbf{${result}}}\\par\\medskip`;
    if (row.kind === 'heading') return `\\medskip\\noindent\\textbf{${result}}\\par\\smallskip`;
    return `\\noindent ${result}\\par`;
  };
  return validateLatexSource(['\\documentclass[11pt]{article}', '\\usepackage[margin=0.6in]{geometry}',
    '\\usepackage[T1]{fontenc}', '\\usepackage{hyperref}', '\\hypersetup{hidelinks}', '\\pagestyle{empty}',
    '\\setlength{\\parindent}{0pt}', '\\setlength{\\parskip}{2pt}', '\\begin{document}',
    ...rows.map(line), '\\end{document}'].join('\n'));
}

export function buildSourceTemplate(input) {
  const source = sourceWithCandidateEvidence(input.source, input.candidateEvidence);
  const text = clean(source?.text);
  if (text.length < 40 || !supportedScripts.test(text) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) throw resumeFailure('source_invalid', { statusCode: 422 });
  if (Buffer.byteLength(text) > MAX_RESUME_TEXT_BYTES) throw resumeFailure('input_too_large', { statusCode: 422 });
  // Rebuild facts from the current source; historic artifact metadata is not an
  // authority that can weaken validation of this generation.
  const facts = buildSourceFacts(source);
  const rows = [];
  let group = 0;
  for (const line of text.split('\n').map(value => value.trim().replace(/\t/g, ' '))) {
    if (!line) { group++; continue; }
    const match = line.match(heading);
    if (match) {
      rows.push({ text: match[1], kind: 'heading', group });
      if (match[2]) rows.push({ text: match[2], kind: 'body', group });
    } else rows.push({ text: line, kind: 'body', group });
  }
  const title = rows.slice(0, 5).find(row => facts.name && row.text.startsWith(facts.name)) || rows[0];
  if (title.kind !== 'heading') title.kind = 'title';
  if (input.mode === 'tailored') prioritize(rows, input.jobSnapshot);
  const originalEmails = new Set(facts.links.filter(link => /^mailto:/i.test(link)).map(link => decodeURIComponent(new URL(link).pathname).toLowerCase()));
  const originalPhones = new Set(facts.links.filter(link => /^tel:/i.test(link)).map(link => new URL(link).pathname.replace(/\D/g, '')));
  const links = normalizeResumeLinks([...facts.links,
    ...facts.emails.filter(email => !originalEmails.has(email)).map(email => `mailto:${encodeURIComponent(email).replace(/%40/gi, '@')}`),
    ...facts.phones.filter(phone => !originalPhones.has(phone)).map(phone => `tel:${phone}`)]);
  const covered = new Set();
  for (const row of rows) {
    row.links = linkRanges(row.text, links);
    for (const range of row.links) covered.add(range.href);
  }
  const missing = links.filter(href => !covered.has(href));
  if (missing.length) {
    rows.push({ text: 'LINKS', kind: 'heading', links: [] });
    for (const href of missing) {
      const url = new URL(href);
      const label = ['mailto:', 'tel:'].includes(url.protocol) ? decodeURIComponent(url.pathname) : 'Website';
      // A matching contact may have several authorized URI spellings. Keep one
      // visible contact while retaining every original destination.
      if (rows.some(row => row.links.some(range => range.href === href))) continue;
      rows.push({ text: label, kind: 'body', links: [{ start: 0, end: label.length, href }] });
    }
  }
  return { rows, facts, links, text: rows.map(row => row.text).join('\n'), latex: latexDocument(rows) };
}

let fontsPromise;
async function loadFonts() {
  fontsPromise ||= (async () => {
    const directory = new URL('./fonts/', import.meta.url);
    const manifest = JSON.parse(await fs.readFile(new URL('manifest.json', directory), 'utf8'));
    return Promise.all(manifest.map(async (entry, index) => {
      const data = await fs.readFile(new URL(entry.file, directory));
      return { ...entry, data, name: `source-font-${index}`, font: createFont(data) };
    }));
  })();
  return fontsPromise;
}

function fontSegments(row, fonts) {
  const weight = row.kind === 'body' ? 400 : 700;
  // Prefer the requested face, then any bundled face that covers the glyph.
  // Contact icons and some styled letters have no matching bold face.
  const choices = [...fonts.filter(font => font.weight === weight), ...fonts.filter(font => font.weight !== weight)];
  const result = [];
  // Keep combining marks, variation selectors and joined emoji in the same
  // font run so shaping and the PDF's selectable text preserve the cluster.
  for (const { segment, index: offset } of graphemes.segment(row.text)) {
    const codePoints = [...segment].map(character => character.codePointAt(0));
    const previous = result.at(-1);
    // Return to the preferred face after a fallback symbol, including for
    // spaces and digits that the symbol font may also cover.
    const font = choices.find(choice => codePoints.every(codePoint => choice.font.hasGlyphForCodePoint(codePoint)));
    if (!font) throw resumeFailure('source_invalid', { statusCode: 422 });
    const href = row.links.find(range => offset >= range.start && offset < range.end)?.href || null;
    if (previous && previous.font === font && previous.href === href) previous.text += segment;
    else result.push({ text: segment, font, href });
  }
  return result;
}

export async function renderSourceTemplate(document, { deadline = Date.now() + 60000, signal } = {}) {
  remainingBudget(deadline, 60000);
  const fonts = await loadFonts();
  signal?.throwIfAborted();
  remainingBudget(deadline, 60000);
  // Preflight before producing any bytes: unsupported characters must never
  // turn into missing glyphs or an apparently successful incomplete PDF.
  const paragraphs = document.rows.map(row => ({ row, segments: fontSegments(row, fonts) }));
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margin: 42, autoFirstPage: false, compress: true,
      info: { Title: 'Resume', Producer: 'Jobverify source template' } });
    const chunks = [];
    let size = 0;
    let pageCount = 0;
    pdf.on('data', chunk => {
      size += chunk.length;
      if (size > 5 * 1024 * 1024) pdf.destroy(resumeFailure('pdf_invalid'));
      else chunks.push(chunk);
    });
    const cancel = () => pdf.destroy(resumeFailure('time_limit', { statusCode: 504 }));
    const cleanup = () => signal?.removeEventListener('abort', cancel);
    pdf.once('error', error => { cleanup(); reject(error); });
    pdf.once('end', () => { cleanup(); resolve(Buffer.concat(chunks)); });
    signal?.addEventListener('abort', cancel, { once: true });
    pdf.on('pageAdded', () => { if (++pageCount > 30) throw resumeFailure('input_too_large', { statusCode: 422 }); });
    try {
      signal?.throwIfAborted();
      for (const font of fonts) pdf.registerFont(font.name, font.data);
      pdf.addPage();
      for (const { row, segments } of paragraphs) {
        remainingBudget(deadline, 60000);
        const fontSize = row.kind === 'title' ? 18 : 11;
        if (row.kind === 'heading') {
          if (pdf.y + 48 > pdf.page.height - pdf.page.margins.bottom) pdf.addPage();
          pdf.y += 8;
        }
        pdf.fontSize(fontSize).fillColor(row.kind === 'body' ? '#171717' : '#17334f');
        for (let index = 0; index < segments.length; index++) {
          const segment = segments[index];
          pdf.font(segment.font.name).text(segment.text, { continued: index < segments.length - 1,
            link: segment.href, lineGap: 1.5, paragraphGap: 0, features: { liga: false } });
        }
        pdf.y += row.kind === 'title' ? 5 : 2;
      }
      pdf.end();
    } catch (error) { cleanup(); pdf.destroy(); reject(error); }
  });
}
