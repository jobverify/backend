import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Agent, request as httpRequest } from 'undici';
import { isPublicAddress, normalizeJobUrl } from './urls.js';

export const verificationError = (code, message, status = 422) => Object.assign(new Error(message), { code, status });
const unsafe = () => verificationError('unsafe_destination', 'This link does not lead to a permitted public website.');

async function boundedBody(body, maxBytes, signal) {
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    if (Buffer.byteLength(body) > maxBytes) throw verificationError('response_too_large', 'The source response exceeds the size limit.');
    return String(body);
  }
  let size = 0;
  const chunks = [];
  try {
    for await (const chunk of body) {
      signal.throwIfAborted();
      const buffer = Buffer.from(chunk);
      size += buffer.length;
      if (size > maxBytes) throw verificationError('response_too_large', 'The source response exceeds the size limit.');
      chunks.push(buffer);
    }
    return Buffer.concat(chunks).toString('utf8');
  } finally { body?.destroy?.(); }
}

async function transport(url, { address, family, signal, maxBytes, accept }) {
  // Keep the original hostname for TLS validation; only the connection lookup is pinned.
  const dispatcher = new Agent({ connect: {
    timeout: 8000,
    lookup: (_host, options, callback) => options.all
      ? callback(null, [{ address, family }]) : callback(null, address, family),
  } });
  try {
    const response = await httpRequest(url, {
      dispatcher, signal, maxRedirections: 0, headersTimeout: 10_000, bodyTimeout: 10_000,
      headers: { 'user-agent': 'Jobverify-LinkVerification/1.0 (+https://www.jobverify.in)', accept, 'accept-encoding': 'identity' },
    });
    if (Number(response.headers['content-length']) > maxBytes) {
      response.body.destroy();
      throw verificationError('response_too_large', 'The source response exceeds the size limit.');
    }
    return { status: response.statusCode, headers: response.headers, body: await boundedBody(response.body, maxBytes, signal) };
  } finally { await dispatcher.destroy(); }
}

function abortable(promise, signal) {
  signal.throwIfAborted();
  let listener;
  return Promise.race([promise, new Promise((_, reject) => {
    listener = () => reject(signal.reason);
    signal.addEventListener('abort', listener, { once: true });
  })]).finally(() => signal.removeEventListener('abort', listener));
}

export function createGuardedFetcher({ lookup = dnsLookup, request = transport } = {}) {
  return async function fetchPublic(input, { signal: parentSignal, timeoutMs = 12_000, maxBytes = 1_000_000, maxRedirects = 5, accept = 'text/html,application/json,text/plain;q=0.8' } = {}) {
    const signal = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(parentSignal ? [parentSignal] : [])]);
    let url = normalizeJobUrl(input);
    const redirects = [];
    try {
      for (let hop = 0; hop <= maxRedirects; hop++) {
        signal.throwIfAborted();
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^\[|\]$/g, '');
        if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || !host.includes('.') && !isIP(host)) throw unsafe();
        const answers = isIP(host) ? [{ address: host, family: isIP(host) }]
          : await abortable(lookup(host, { all: true, verbatim: true }), signal);
        if (!answers.length || answers.some(({ address }) => !isPublicAddress(address))) throw unsafe();
        const { address, family } = answers[0];
        const response = await request(url, { address, family, signal, maxBytes, accept });
        const body = await boundedBody(response.body, maxBytes, signal);
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          if (!response.headers?.location || hop === maxRedirects) throw verificationError('redirect_limit', 'The link has an incomplete or excessive redirect chain.');
          const next = normalizeJobUrl(new URL(response.headers.location, url).href);
          redirects.push({ from: url, to: next, status: response.status });
          url = next;
          continue;
        }
        return { ...response, body, url, redirects, observedAt: new Date().toISOString() };
      }
    } catch (error) {
      if (error.code && ['unsafe_destination', 'response_too_large', 'redirect_limit', 'invalid_url'].includes(error.code)) throw error;
      if (signal.aborted) throw verificationError('source_timeout', 'The source did not respond within the check deadline.');
      throw verificationError('source_unavailable', 'This source could not be reached securely.');
    }
  };
}

export const fetchPublic = createGuardedFetcher();
