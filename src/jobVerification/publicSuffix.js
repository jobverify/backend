import { domainToASCII } from 'node:url';

// The data comes from publicsuffix.org (ICANN and PRIVATE sections). Unknown
// suffixes fail closed; there is deliberately no last-two-label fallback.
let rules = null;

export function loadPublicSuffixRules(text) {
  if (typeof text !== 'string' || !text.includes('===BEGIN ICANN DOMAINS===') || !text.includes('===BEGIN PRIVATE DOMAINS===')) throw new Error('Invalid Public Suffix List.');
  const exact = new Set(), wildcard = new Set(), exceptions = new Set();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('//')) continue;
    const prefix = line.startsWith('!') ? '!' : line.startsWith('*.') ? '*.' : '';
    const name = domainToASCII(line.slice(prefix.length)).toLowerCase();
    if (!name || !/^[a-z0-9.-]+$/.test(name)) continue;
    (prefix === '!' ? exceptions : prefix === '*.' ? wildcard : exact).add(name);
  }
  if (!exact.size) throw new Error('Empty Public Suffix List.');
  rules = { exact, wildcard, exceptions };
}

export function domainFromPublicSuffix(hostname) {
  if (!rules) return null;
  const labels = domainToASCII(hostname).toLowerCase().replace(/\.$/, '').split('.');
  let suffixLength = 0;
  for (let i = 0; i < labels.length; i++) {
    const suffix = labels.slice(i).join('.');
    if (rules.exceptions.has(suffix)) { suffixLength = labels.length - i - 1; break; }
    if (rules.exact.has(suffix)) suffixLength = Math.max(suffixLength, labels.length - i);
    if (i > 0 && rules.wildcard.has(suffix)) suffixLength = Math.max(suffixLength, labels.length - i + 1);
  }
  return suffixLength > 0 && labels.length > suffixLength ? labels.slice(-suffixLength - 1).join('.') : null;
}
