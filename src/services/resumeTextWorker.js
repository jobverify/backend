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
    return { text, links: normalizeResumeLinks([...links, ...resumeLinksFromText(text)]) };
  }
  if (workerData.extension === 'pdf') {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = getDocument({ data: new Uint8Array(data), isEvalSupported: false, useSystemFonts: false, disableFontFace: true, verbosity: 0, stopAtErrors: true });
    try {
      const document = await task.promise;
      if (document.numPages > 30) throw new Error('Too many pages');
      const pages = [], links = [];
      for (let index = 1; index <= document.numPages; index++) {
        const page = await document.getPage(index);
        const content = await page.getTextContent();
        pages.push(resumePdfText(content.items));
        for (const annotation of await page.getAnnotations()) if (annotation.subtype === 'Link') links.push(annotation.url || annotation.unsafeUrl || '');
      }
      const text = pages.join('\n\n');
      return { text, links: normalizeResumeLinks([...links, ...resumeLinksFromText(text)]) };
    } finally { await task.destroy(); }
  }
  if (workerData.extension === 'docx') {
    inspectResumeArchive(data);
    const { default: mammoth } = await import('mammoth');
    const [raw, html] = await Promise.all([mammoth.extractRawText({ buffer: data }), mammoth.convertToHtml({ buffer: data }, { externalFileAccess: false, convertImage: mammoth.images.imgElement(() => ({ src: '' })) })]);
    const links = [...html.value.matchAll(/\bhref="([^"]*)"/gi)].map(match => decodeHtml(match[1]));
    return { text: raw.value, links: normalizeResumeLinks([...links, ...resumeLinksFromText(raw.value)]) };
  }
  const { default: WordExtractor } = await import('word-extractor');
  const document = await new WordExtractor().extract(data);
  const text = [document.getHeaders({ includeFooters: false }), document.getBody(), document.getTextboxes(), document.getFooters()].filter(Boolean).join('\n');
  // Legacy Word stores field destinations separately from their visible labels.
  const fields = [data.toString('latin1'), data.toString('utf16le')].flatMap(raw => [...raw.matchAll(/HYPERLINK\s+"([^"\u0000]+)"/gi)].map(match => match[1]));
  return { text, links: normalizeResumeLinks([...fields, ...resumeLinksFromText(text)]) };
}

read().then(result => parentPort.postMessage(result), () => parentPort.postMessage({ error: true }));
