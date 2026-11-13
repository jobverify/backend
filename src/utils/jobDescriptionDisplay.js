import { decodeHTML } from 'entities';
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js';
import { recoverDescriptionLayout } from './jobDescriptionLayout.js';
import { assessDescriptionSource } from './jobDescriptionSourceQuality.js';

const SKIP = new Set(['script', 'style', 'template', 'noscript', 'nav', 'footer', 'aside', 'form', 'button', 'input', 'select', 'textarea', 'svg', 'iframe', 'object', 'embed']);
const CONTAINERS = new Set(['root', 'div', 'section', 'article', 'main', 'header', 'table', 'tbody', 'thead', 'tr', 'td', 'blockquote']);
const htmlTags = [...SKIP, ...CONTAINERS, 'p', 'br', 'span', 'li', 'ul', 'ol', 'h[1-6]', 'b', 'strong', 'em', 'pre', 'code', 'dl', 'dt', 'dd'].join('|');
const HTML_BODY = new RegExp('<(?:' + htmlTags + ')\\b', 'i');
const ENCODED_BODY = new RegExp('^\\s*(?:&lt;|&#0*60;|&#x0*3c;)(?:' + htmlTags + ')\\b', 'i');
const normalize = text => text.replace(/\s+/g, ' ').trim();
const textNode = value => decodeHTML(value).replace(/\s+/g, ' ');

/** Prepare display text only; the original employer source remains immutable. */
export function buildSourceDescriptionDisplay(raw) {
  let source = String(raw ?? '');
  if (ENCODED_BODY.test(source)) source = decodeHTML(source);
  if (!HTML_BODY.test(source)) {
    const layout = recoverDescriptionLayout(source);
    return { description: layout.text, descriptionFormat: /^#{1,6}\s/m.test(layout.text) ? 'markdown' : 'plain' };
  }
  const document = readNativeDocument(source);
  const root = document.nodes(node => node.tag === 'root')[0];
  const inline = node => {
    if (typeof node === 'string') return textNode(node);
    if (!node || node.inert || SKIP.has(node.tag)) return '';
    if (node.tag === 'br') return '\n';
    const text = (node.children ?? []).map(inline).join('');
    if (node.tag === 'a') {
      const href = decodeHTML(String(node.attrs.href ?? '')).trim();
      if (/^(?:https?:\/\/|mailto:|tel:)/i.test(href) && !text.includes(href)) return `${text} (${href})`;
    }
    return /^(?:p|div|li)$/.test(node.tag) ? ` ${text} ` : text;
  };
  const listLines = (node, depth = 0) => {
    let number = /^\d+$/.test(node.attrs.start ?? '') ? Number(node.attrs.start) : 1;
    const lines = [], padding = '  '.repeat(depth);
    for (const item of node.children ?? []) {
      if (typeof item === 'string' || item.tag !== 'li' || item.inert) continue;
      if (/^\d+$/.test(item.attrs.value ?? '')) number = Number(item.attrs.value);
      const marker = node.tag === 'ol' ? `${number++}.` : '-';
      let pending = '', started = false;
      const flush = () => {
        const text = normalize(pending);
        pending = '';
        if (!text) return;
        lines.push(`${padding}${started ? '  ' : marker + ' '}${text}`);
        started = true;
      };
      const collect = child => {
        if (typeof child === 'string') { pending += textNode(child); return; }
        if (!child || child.inert || SKIP.has(child.tag)) return;
        if (child.tag === 'ul' || child.tag === 'ol') {
          flush();
          lines.push(...listLines(child, started ? depth + 1 : depth));
          return;
        }
        if (child.tag === 'br') { pending += '\n'; return; }
        if (child.tag === 'a') { pending += inline(child); return; }
        const block = CONTAINERS.has(child.tag) || child.tag === 'p';
        if (block) pending += ' ';
        for (const value of child.children ?? []) collect(value);
        if (block) pending += ' ';
      };
      for (const child of item.children ?? []) collect(child);
      flush();
    }
    return lines;
  };
  const blocks = [];
  const push = value => {
    for (const paragraph of value.split(/\n[ \t]*\n+/)) {
      const text = normalize(paragraph);
      if (text) blocks.push(text);
    }
  };
  const visit = node => {
    if (typeof node === 'string') { push(textNode(node)); return; }
    if (!node || node.inert || SKIP.has(node.tag)) return;
    if (/^h[1-6]$/.test(node.tag)) { push(`## ${inline(node)}`); return; }
    if (node.tag === 'ul' || node.tag === 'ol') {
      const lines = listLines(node);
      if (lines.length) blocks.push(lines.join('\n'));
      return;
    }
    if (CONTAINERS.has(node.tag)) {
      let pending = '';
      const flush = () => { push(pending); pending = ''; };
      for (const child of node.children ?? []) {
        if (typeof child === 'string') pending += textNode(child);
        else if (!child.inert && !SKIP.has(child.tag) && (CONTAINERS.has(child.tag) || /^(?:h[1-6]|p|ul|ol)$/.test(child.tag))) {
          flush(); visit(child);
        } else pending += inline(child);
      }
      flush();
      return;
    }
    if (node.tag !== 'br') push(inline(node));
  };
  visit(root);
  return { description: recoverDescriptionLayout(blocks.join('\n\n')).text || null, descriptionFormat: 'markdown' };
}

/** Recover legacy display layout on reads without changing accepted rewrites or stored data. */
export function publicDescriptionFields(job) {
  const published = job.descriptionFormat === 'markdown' || job.descriptionRewrite?.status === 'published';
  const display = published ? job.description : job.sourceDescription !== undefined ? job.sourceDescription : job.description;
  if (typeof display === 'string' && !assessDescriptionSource(display).ok) return { description: '', descriptionFormat: 'plain' };
  if (published) {
    if (typeof display !== 'string' || display.length > 120000) return {};
    const layout = recoverDescriptionLayout(display);
    return layout.changed ? { description: layout.text, descriptionFormat: job.descriptionFormat || (layout.structured ? 'markdown' : 'plain') } : {};
  }
  const source = job.sourceDescription !== undefined ? job.sourceDescription : job.description;
  if (source === null || source === '') return { description: '', descriptionFormat: 'plain' };
  if (typeof source !== 'string' || source.length > 120000) return {};
  try { return buildSourceDescriptionDisplay(source); } catch { return {}; }
}
