import { DOMParser } from '@xmldom/xmldom';
import { verificationRequestUrl, redactText } from './urls.js';

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
  const heading = document.getElementsByTagName('h1')[0]?.textContent?.trim();
  const genericHeading = /^(?:job (?:details|description|application)|apply(?: for (?:this )?job)?)$/i.test(heading || '');
  result.title ||= redactText((genericHeading ? '' : heading) || document.getElementsByTagName('title')[0]?.textContent, 200);
  const links = new Set();
  for (const anchor of Array.from(document.getElementsByTagName('a')).slice(0, 300)) {
    try { links.add(verificationRequestUrl(new URL(anchor.getAttribute('href'), url).href)); } catch { /* No executable/private links. */ }
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
    ['Up-front payment request', 'The posting asks for payment or a recruitment fee.', /\b(?:pay|send|transfer|deposit)\b[^.!?;\n]{0,65}\b(?:(?:processing|registration|activation|application|placement|training|background[- ]check) fee|security deposit)\b/gi],
    ['Cryptocurrency payment request', 'The posting asks for a cryptocurrency transfer as part of getting the job or interview.', /\b(?:pay|send|transfer|deposit)\b[^.!?;\n]{0,45}\b(?:USDT|USDC|BTC|Bitcoin|ETH|Ethereum|crypto(?:currency)?)\b[^.!?;\n]{0,100}\b(?:interview|(?:employment|job) offer|(?:secure|activate|start|unlock)(?:\s+\w+){0,3}\s+(?:job|employment|tasks?|earnings?))\b/gi],
    ['Equipment purchase request', 'The posting asks you to buy equipment through a specified vendor or reimbursement link.', /\b(?:buy|purchase)\b[^.!?;\n]{0,45}\b(?:equipment|laptop|computer)\b[^.!?;\n]{0,65}\b(?:our vendor|this link|reimburs)/gi],
    ['Cheque or overpayment request', 'The posting asks you to deposit a cheque and return money, a common overpayment tactic.', /\b(?:deposit|cash)\s+(?:(?:the|this|our|a)\s+)?(?:check|cheque)\b[^.!?\n]{0,160}\b(?:send\s+(?:back\s+)?(?:the\s+)?(?:difference|excess|balance)|send\s+back\b[^.!?\n]{0,30}\b(?:difference|excess|money)|return\s+(?:the\s+)?(?:difference|excess|balance|money)|(?:transfer|wire)\b[^.!?\n]{0,40}\b(?:difference|excess|balance|remaining money))\b/gi],
    ['Deposit to unlock earnings', 'The posting asks you to deposit money to unlock tasks or withdraw earnings.', /\b(?:recharge|deposit|pay|transfer)\b[^.!?;\n]{0,100}\b(?:unlock (?:tasks?|commissions?|earnings?)|withdraw (?:your )?(?:earnings|money|commission))\b/gi],
    ['Gift-card payment request', 'The posting asks you to purchase gift cards and provide their codes.', /\b(?:buy|purchase|send)\b[^.!?;\n]{0,35}\bgift cards?\b[^.!?;\n]{0,90}\b(?:codes?|pins?)\b/gi],
    ['Off-platform interview request', 'The posting directs the interview or recruitment conversation to WhatsApp or Telegram.', /\b(?:interview|contact|message|continue|reach)\b[^.!?;\n]{0,40}\b(?:telegram|whatsapp)\b/gi],
  ];
  return patterns.flatMap(([title, detail, pattern]) => {
    for (const match of String(text || '').matchAll(pattern)) {
      const before = text.slice(Math.max(0, match.index - 120), match.index).split(/[.!?;\n]|,\s+|\b(?:but|however|instead)\b/i).at(-1);
      if (/\b(?:never|do not|don't|does not|doesn't|will not|won't|no need to|not (?:asked|required) to|not ask|beware|avoid|scams? (?:that|which|may))\b/i.test(before)) continue;
      if (['Up-front payment request', 'Cryptocurrency payment request'].includes(title)
        && /\b(?:we|(?:the|our) (?:company|employer))\s+(?:(?:will|shall|can|may|also|always)\s+){0,3}$/i.test(before)) continue;
      if (title === 'Off-platform interview request' && /\b(?:not|never)\b[^.!?;\n]{0,25}\b(?:whatsapp|telegram)\b/i.test(match[0])) continue;
      return [{ title, detail, excerpt: redactText(`${before}${match[0]}`.trim(), 240) }];
    }
    return [];
  });
}
