import { DOMParser } from '@xmldom/xmldom';
import { normalizeJobUrl, redactText } from './urls.js';

const empty = () => ({ title: '', company: '', roleIds: [], links: [], text: '', validThrough: null, structured: false, blocked: false });
const values = value => Array.isArray(value) ? value : [value];

export function readJobPage(body, url) {
  if (!body || /<!ENTITY\s/i.test(body)) return empty();
  const document = new DOMParser({ errorHandler: () => {} }).parseFromString(`<html><body>${body.replace(/<!doctype[^>]*>/gi, '')}</body></html>`, 'text/html');
  const result = empty();
  const scripts = Array.from(document.getElementsByTagName('script')).slice(0, 30);
  const postings = [];
  for (const script of scripts) {
    if (!(script.getAttribute('type') || '').toLowerCase().includes('ld+json') || script.textContent.length > 100_000) continue;
    try {
      const queue = values(JSON.parse(script.textContent));
      for (let index = 0; index < queue.length && index < 100; index++) {
        const item = queue[index];
        if (!item || typeof item !== 'object') continue;
        if (values(item['@type']).includes('JobPosting')) postings.push(item);
        if (item['@graph']) queue.push(...values(item['@graph']));
      }
    } catch { /* Invalid embedded data is not a job identity. */ }
  }
  // Multiple unrelated listings on an aggregate page do not establish one role.
  const posting = postings.length === 1 ? postings[0] : null;
  if (posting) {
    result.structured = true;
    result.title = redactText(posting.title, 200);
    result.company = redactText(posting.hiringOrganization?.name, 200);
    result.roleIds = values(posting.identifier).map(item => typeof item === 'object' ? item?.value : item).filter(value => typeof value === 'string' || typeof value === 'number').map(String).slice(0, 5);
    result.validThrough = posting.validThrough || null;
  }
  result.title ||= redactText(document.getElementsByTagName('h1')[0]?.textContent || document.getElementsByTagName('title')[0]?.textContent, 200);
  const links = new Set();
  for (const anchor of Array.from(document.getElementsByTagName('a')).slice(0, 300)) {
    try { links.add(normalizeJobUrl(new URL(anchor.getAttribute('href'), url).href)); } catch { /* No executable/private links. */ }
  }
  result.links = [...links].slice(0, 120);
  const stack = [document.documentElement];
  const parts = [];
  let count = 0, length = 0;
  while (stack.length && count++ < 40_000 && length < 200_000) {
    const node = stack.pop();
    if (node.nodeType === 3) { parts.push(node.nodeValue); length += node.nodeValue.length; continue; }
    if (['script', 'style', 'svg', 'template', 'noscript', 'form', 'iframe'].includes(node.nodeName?.toLowerCase())) continue;
    for (let child = node.lastChild; child; child = child.previousSibling) stack.push(child);
  }
  result.text = parts.join(' ').replace(/\s+/g, ' ').trim();
  result.blocked = /(?:verify you are human|checking your browser|access denied|enable javascript and cookies|just a moment|captcha)/i.test(result.title + ' ' + result.text.slice(0, 600));
  return result;
}

export function suspiciousRequests(text) {
  const patterns = [
    ['Up-front payment request', /\b(?:pay|send|transfer|deposit)\b.{0,55}\b(?:processing fee|registration fee|activation fee|security deposit|crypto|bitcoin|usdt)\b/i],
    ['Equipment purchase request', /\b(?:buy|purchase)\b.{0,45}\b(?:equipment|laptop|gift cards?)\b.{0,65}\b(?:our vendor|this link|reimburs)/i],
    ['Off-platform interview request', /\b(?:interview|contact|message|continue|reach)\b.{0,40}\b(?:telegram|whatsapp)\b/i],
  ];
  return patterns.flatMap(([title, pattern]) => {
    const match = pattern.exec(text || '');
    if (!match || /\b(?:never|do not|don't|will not|won't|no need to)\b/i.test(text.slice(Math.max(0, match.index - 80), match.index))) return [];
    return [{ title, excerpt: redactText(match[0], 240) }];
  });
}
