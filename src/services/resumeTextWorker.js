import { parentPort, workerData } from 'node:worker_threads';
import { inspectResumeArchive } from './resumeText.js';
import { normalizeResumeLinks, resumeLinksFromText } from './resumeSource.js';
import { resumePdfText } from './resumePdfText.js';

const unescapeTex = value => value.replace(/\\([&%_$#{}])/g, '$1').replace(/\\textasciitilde\s*\{?\}?/g, '~');
const decodeHtml = value => value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[\da-f]+);/gi, entity => {
  const named = { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' };
  if (named[entity]) return named[entity];
  const code = entity.slice(2, -1);
  return String.fromCodePoint(code.startsWith('x') ? Number.parseInt(code.slice(1), 16) : Number(code));
});

// Read nested formatting as data; never expand or execute source TeX.
function texArgument(raw, start) {
  while (/\s/.test(raw[start] || '') && start < raw.length) start++;
  if (raw[start] !== '{') return null;
  let depth = 1;
  for (let index = start + 1; index < Math.min(raw.length, start + 16384); index++) {
    if (raw[index] === '\\') { index++; continue; }
    if (raw[index] === '{' && ++depth > 64) return null;
    if (raw[index] === '}' && --depth === 0) return { value: raw.slice(start + 1, index), end: index + 1 };
  }
  return null;
}

function texLinkLabels(raw) {
  const labels = [];
  const href = /\\href\b/g;
  while (href.exec(raw)) {
    const target = texArgument(raw, href.lastIndex);
    const label = target && texArgument(raw, target.end);
    if (!label) continue;
    labels.push({ url: unescapeTex(target.value), label: unescapeTex(label.value.replace(/\\[a-zA-Z@]+(?:\[[^\]]*\])?/g, '')).replace(/[{}]/g, ' ') });
    href.lastIndex = label.end;
  }
  return labels;
}

function pdfLinkLabel(content, rect) {
  if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite)) return '';
  const [left, bottom, right, top] = [Math.min(rect[0], rect[2]), Math.min(rect[1], rect[3]), Math.max(rect[0], rect[2]), Math.max(rect[1], rect[3])];
  return content.items.filter(item => {
    if (!item.str?.trim() || !item.transform) return false;
    const [a, b, c, d, x, y] = item.transform;
    const horizontal = Math.hypot(a, b), vertical = Math.hypot(c, d);
    if (!horizontal || !vertical || !item.width || !item.height) return false;
    const style = content.styles[item.fontName] || {};
    const ascent = Number.isFinite(style.ascent) ? style.ascent : 0.8;
    const descent = Number.isFinite(style.descent) ? style.descent : -0.2;
    const corners = [0, item.width].flatMap(width => [descent, ascent].map(height => [x + a / horizontal * width + c / vertical * item.height * height, y + b / horizontal * width + d / vertical * item.height * height]));
    const x1 = Math.min(...corners.map(point => point[0])), x2 = Math.max(...corners.map(point => point[0]));
    const y1 = Math.min(...corners.map(point => point[1])), y2 = Math.max(...corners.map(point => point[1]));
    const overlap = Math.max(0, Math.min(right, x2) - Math.max(left, x1)) * Math.max(0, Math.min(top, y2) - Math.max(bottom, y1));
    return overlap > 0 && overlap >= Math.min((right - left) * (top - bottom), (x2 - x1) * (y2 - y1)) * 0.4;
  }).map(item => item.str).join(' ');
}

async function read() {
  const data = Buffer.from(workerData.data);
  if (workerData.extension === 'tex') {
    let raw = new TextDecoder('utf-8', { fatal: true }).decode(data).replace(/(?<!\\)%[^\n]*/g, '');
    // Preamble macro definitions describe formatting, not candidate facts.
    if (raw.includes('\\begin{document}')) raw = raw.split('\\begin{document}').slice(1).join('\\begin{document}').split('\\end{document}')[0];
    // Preserve argument boundaries in common resume layout macros without
    // executing definitions. Boundaries let factual headers be reformatted.
    const macroArgument = String.raw`\s*\{((?:\\.|[^{}]|\{[^{}]*\})*)\}`;
    raw = raw.replace(new RegExp(String.raw`\\resumeSubheading` + macroArgument.repeat(4), 'g'), '\n$1 | $2 | $3 | $4\n')
      .replace(new RegExp(String.raw`\\(?:resumeProjectHeading|resumeSubSubheading)` + macroArgument.repeat(2), 'g'), '\n$1 | $2\n');
    const links = [...raw.matchAll(/\\(?:href|url)\s*\{((?:\\.|[^}])*)\}/g)].map(match => unescapeTex(match[1]));
    const linkLabels = texLinkLabels(raw);
    const text = raw
      .replace(/\\(?:documentclass|usepackage|input|include|includegraphics|write18|bibliography|label|ref)(?:\[[^\]]*\])?\s*\{[^}]*\}/g, '')
      .replace(/\\href\s*\{(?:\\.|[^}])*\}\s*\{([^}]*)\}/g, '$1')
      .replace(/\\url\s*\{((?:\\.|[^}])*)\}/g, (_, url) => unescapeTex(url))
      .replace(/\\(?:begin|end)\{[^}]*\}/g, '\n')
      .replace(/\\(?:section|subsection)\*?(?:\[[^\]]*\])?\s*\{([^}]*)\}/g, '\n$1\n')
      .replace(/\\(?:item|resumeSubheading|resumeProjectHeading)\*?(?:\[[^\]]*\])?/g, '\n')
      .replace(/\\\\(?:\[[^\]]*\])?/g, '\n')
      .replace(/\\(?:hfill|hspace|vspace)(?:\*?\{[^}]*\})?/g, ' ')
      .replace(/\\[a-zA-Z@]+(?:\[[^\]]*\])?/g, '')
      .replace(/\\[&%_$#{}]/g, match => match.slice(1))
      .replace(/[{}]/g, ' ').replace(/--+/g, '–').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n\s*\n+/g, '\n');
    return { text, links: normalizeResumeLinks([...links, ...resumeLinksFromText(text)]), linkLabels };
  }
  if (workerData.extension === 'pdf') {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = getDocument({ data: new Uint8Array(data), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0, stopAtErrors: true });
    try {
      const document = await task.promise;
      if (document.numPages > 30) throw new Error('Too many pages');
      const pages = [], links = [], linkLabels = [];
      for (let index = 1; index <= document.numPages; index++) {
        const page = await document.getPage(index);
        const content = await page.getTextContent();
        pages.push(resumePdfText(content.items));
        for (const annotation of await page.getAnnotations()) if (annotation.subtype === 'Link') {
          const url = annotation.url || annotation.unsafeUrl || '';
          links.push(url);
          linkLabels.push({ url, label: pdfLinkLabel(content, annotation.rect) });
        }
      }
      const text = pages.join('\n\n');
      return { text, links: normalizeResumeLinks([...links, ...resumeLinksFromText(text)]), linkLabels, pageCount: document.numPages };
    } finally { await task.destroy(); }
  }
  if (workerData.extension === 'docx') {
    inspectResumeArchive(data);
    const { default: mammoth } = await import('mammoth');
    const [raw, html] = await Promise.all([mammoth.extractRawText({ buffer: data }), mammoth.convertToHtml({ buffer: data }, { externalFileAccess: false, convertImage: mammoth.images.imgElement(() => ({ src: '' })) })]);
    const links = [...html.value.matchAll(/\bhref="([^"]*)"/gi)].map(match => decodeHtml(match[1]));
    const linkLabels = [...html.value.matchAll(/<a\b[^>]*\bhref="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)].map(match => ({ url: decodeHtml(match[1]), label: decodeHtml(match[2].replace(/<[^>]*>/g, ' ')) }));
    const { default: JSZip } = await import('jszip');
    const properties = (await JSZip.loadAsync(data)).file('docProps/app.xml');
    const pageCount = properties ? Number((await properties.async('string')).match(/<(?:[\w.-]+:)?Pages\b[^>]*>\s*(\d+)\s*<\/(?:[\w.-]+:)?Pages>/i)?.[1]) : undefined;
    return { text: raw.value, links: normalizeResumeLinks([...links, ...resumeLinksFromText(raw.value)]), linkLabels, pageCount };
  }
  const { default: WordExtractor } = await import('word-extractor');
  const document = await new WordExtractor().extract(data);
  const text = [document.getHeaders({ includeFooters: false }), document.getBody(), document.getTextboxes(), document.getFooters()].filter(Boolean).join('\n');
  // Legacy Word stores field destinations separately from their visible labels.
  const fields = [data.toString('latin1'), data.toString('utf16le')].flatMap(raw => [...raw.matchAll(/HYPERLINK\s+"([^"\u0000]+)"/gi)].map(match => match[1]));
  return { text, links: normalizeResumeLinks([...fields, ...resumeLinksFromText(text)]) };
}

read().then(result => parentPort.postMessage(result), () => parentPort.postMessage({ error: true }));
