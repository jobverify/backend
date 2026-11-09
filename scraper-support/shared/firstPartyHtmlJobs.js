import crypto from 'node:crypto';
import { attachInventoryEvidence } from '../utils/inventoryEvidence.js';
import { nativePostingJobs, requireNative } from './nativeJobPosting.js';
import { mapWithConcurrency } from '../utils/mapWithConcurrency.js';
export const MAX_HTML_BYTES = 2 * 1024 * 1024;
export const HTML_REQUEST_TIMEOUT_MS = 20000;
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const data = (value, name) => { for (let n = 0; value && typeof value === 'object' && n < 5; n++) { try { const field = Object.getOwnPropertyDescriptor(value, name); if (field) return field.value; value = Object.getPrototypeOf(value); } catch { return undefined; } } };
const clean = value => typeof value === 'string' ? value.slice(0, 4096).replace(/https?:\/\/[^\s<>]+/gi, '[url]').replace(/\b(?:Bearer|Basic)\s+\S+/gi, '[redacted]').replace(/(["']?)\b(?:authorization|cookie|set-cookie|password|secret|api[-_]?key|(?:(?:access|refresh|id)[-_]?)?token)\1\s*[:=]\s*(?:"(?:\\.|[^"\\])*(?:"|$)|'(?:\\.|[^'\\])*(?:'|$)|[^\s,;}]+)/gi, '[redacted]').replace(/<[^>]*>[\s\S]*?(?:<\/[^>]*>|$)/g, '[markup]').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 320) : null;
function reason(error, depth = 0, seen = new Set()) {
  if (!error || typeof error !== 'object' || depth > 2 || seen.has(error)) return null;
  seen.add(error); const name = data(error, 'name'), code = data(error, 'code');
  return { name: typeof name === 'string' && /^[A-Za-z][A-Za-z0-9_.]{0,79}$/.test(name) ? name : null, message: clean(data(error, 'message')), code: typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(code) ? code : null, cause: depth < 2 ? reason(data(error, 'cause'), depth + 1, seen) : null };
}

export function createHTMLTransport(config, { fetchImpl = globalThis.fetch, signal, timeoutMs = HTML_REQUEST_TIMEOUT_MS } = {}) {
  requireNative(Number.isInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= HTML_REQUEST_TIMEOUT_MS, 'Invalid request timeout');
  return async url => {
    config.validateURL(url);
    const requestedAt = new Date().toISOString();
    const controller = new AbortController(), abort = () => controller.abort(signal.reason);
    signal?.throwIfAborted(); signal?.addEventListener('abort', abort, { once: true });
    let timer, reader, interrupted;
    const deadline = new Promise((_, reject) => {
      interrupted = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', interrupted, { once: true });
      timer = setTimeout(() => controller.abort(Object.assign(Error('Native HTML GET stream timeout'), { name: 'TimeoutError', code: 'ETIMEDOUT' })), timeoutMs);
    });
    const task = (async () => {
      const accept = config.expectedContentType ? config.expectedContentType(url) : 'text/html';
      const response = await fetchImpl(url, { method: 'GET', redirect: 'manual', credentials: 'omit', headers: { Accept: accept }, signal: controller.signal });
      controller.signal.throwIfAborted();
      requireNative(response.url === url && Number.isInteger(response.status) && typeof response.headers?.entries === 'function', 'Invalid manual response identity');
      const headers = Object.fromEntries(response.headers.entries()), length = headers['content-length'];
      requireNative(length === undefined || /^\d+$/.test(length) && Number(length) <= MAX_HTML_BYTES, 'Advertised body limit');
      const encoding = headers['content-encoding']?.trim().toLowerCase();
      requireNative(!encoding || ['identity', 'gzip', 'br', 'deflate'].includes(encoding), 'Unsupported response encoding');
      if (response.body === null) { requireNative(length === undefined || Number(length) === 0, 'Incomplete empty body'); return { url, status: response.status, headers, body: Buffer.alloc(0), bodyComplete: true, requestedAt, completedAt: new Date().toISOString() }; }
      requireNative(typeof response.body?.getReader === 'function', 'Missing native stream');
      reader = response.body.getReader(); const chunks = []; let bytes = 0;
      for (;;) {
        controller.signal.throwIfAborted(); const part = await reader.read(); controller.signal.throwIfAborted(); if (part.done) break;
        requireNative(part.value instanceof Uint8Array, 'Invalid stream chunk'); bytes += part.value.byteLength;
        requireNative(bytes <= MAX_HTML_BYTES, 'Native HTML 2MiB body limit'); chunks.push(Buffer.from(part.value));
      }
      // fetch exposes decoded bytes but preserves compressed wire headers. Only
      // compare an identity response to Content-Length; always bound read bytes.
      if (!encoding || encoding === 'identity') requireNative(length === undefined || Number(length) === bytes, 'Truncated or mismatched native body length');
      reader.releaseLock(); reader = null;
      return { url, status: response.status, headers, body: Buffer.concat(chunks, bytes), bodyComplete: true, requestedAt, completedAt: new Date().toISOString() };
    })();
    try { return await Promise.race([task, deadline]); }
    catch (error) { controller.abort(error); try { Promise.resolve(reader?.cancel(error)).catch(() => {}); } catch {} throw error; }
    finally { clearTimeout(timer); controller.signal.removeEventListener('abort', interrupted); signal?.removeEventListener('abort', abort); }
  };
}

export function createFirstPartyHTMLScraper(config) {
  async function collect(options = {}) {
    const maxRequests = config.maxRequests === undefined ? 512 : config.maxRequests;
    const detailConcurrency = config.detailConcurrency === undefined ? 1 : config.detailConcurrency;
    const maxAggregateBytes = config.maxAggregateBytes === undefined ? 64 * 1024 * 1024 : config.maxAggregateBytes;
    requireNative(Number.isSafeInteger(maxRequests) && maxRequests > 0 && maxRequests <= 2048, 'Invalid native request budget');
    requireNative(Number.isSafeInteger(detailConcurrency) && detailConcurrency > 0 && detailConcurrency <= 8, 'Invalid native detail concurrency');
    requireNative(Number.isSafeInteger(maxAggregateBytes) && maxAggregateBytes > 0 && maxAggregateBytes <= 256 * 1024 * 1024, 'Invalid native aggregate byte budget');
    const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(540000)]) : AbortSignal.timeout(540000);
    const transport = options.transport || createHTMLTransport(config, { ...options, signal });
    const result = { source: config.source, status: 'unknown', jobs: [], exclusions: [], failures: [], unknownRawFailures: [], retainedResponses: [], listingRecords: [], observedListingCount: 0, nativeReportedTotal: null, pagesFetched: 0, listingPaginationComplete: false, rawJobs: null, indiaJobs: null, eligibleJobs: null, savedJobs: null, visibleJobs: null, cleanupAllowed: false, verifiedZeroInventory: false, sourceScopeComplete: false, wholeCompanyScope: false };
    if (config.maxRequests !== undefined || config.detailConcurrency !== undefined) result.collectionLimits = { maxRequests, detailConcurrency };
    if (config.maxAggregateBytes !== undefined) result.collectionLimits = { ...result.collectionLimits, maxRequests, detailConcurrency, maxAggregateBytes };
    const failure = (stage, error, candidate = null) => { result.failures.push({ stage, ...reason(error) }); if (candidate) result.unknownRawFailures.push({ stage, candidate }); };
    let requestCount = 0, totalBytes = 0;
    const read = async url => {
      let current = url; const seen = new Set();
      for (let hop = 0; hop <= 3; hop++) {
        config.validateURL(current); signal.throwIfAborted();
        requireNative(++requestCount <= maxRequests && !seen.has(current), 'Native request/redirect bound'); seen.add(current);
        const response = await transport(current, { method: 'GET', redirect: 'manual', credentials: 'omit', signal });
        requireNative(response && response.url === current && response.bodyComplete === true && Number.isInteger(response.status) && response.headers && !Array.isArray(response.headers) && response.body instanceof Uint8Array, 'Incomplete native transport response');
        const body = Buffer.from(response.body); totalBytes += body.length;
        requireNative(body.length <= MAX_HTML_BYTES && totalBytes <= maxAggregateBytes, 'Native HTML aggregate/body bound');
        const headers = Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key.toLowerCase(), value]));
        requireNative(Object.keys(headers).length === Object.keys(response.headers).length, 'Duplicate response header casing');
        result.retainedResponses.push({ url: current, status: response.status, headers, bodyBytes: body.length, bodySHA256: sha(body), rawBodyBase64: body.toString('base64'), bodyRepresentation: 'complete decoded HTTP response body; not compressed wire bytes', requestedAt: response.requestedAt || null, completedAt: response.completedAt || null, provenance: response.provenance || null });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          requireNative(hop < 3 && typeof headers.location === 'string' && headers.location === headers.location.trim() && !/[\\\r\n\t]/.test(headers.location), 'Invalid native redirect');
          const target = new URL(headers.location, current).href; config.validateURL(target);
          requireNative(config.sameReadIdentity(current, target), 'Native redirect changes source/scope/role'); current = target; continue;
        }
        requireNative(response.status === 200, 'HTTP ' + response.status + ' native upstream response');
        const expectedContentType = config.expectedContentType ? config.expectedContentType(current) : 'text/html';
        requireNative(['text/html', 'application/json', 'text/markdown', 'text/javascript', 'application/javascript'].includes(expectedContentType)
          && typeof headers['content-type'] === 'string' && headers['content-type'].split(';')[0].trim().toLowerCase() === expectedContentType, 'Unexpected native content type');
        const html = new TextDecoder('utf-8', { fatal: true }).decode(body); requireNative(html.trim(), 'Empty native HTML');
        const frame = config.resolveReadFrame?.(html, current);
        if (frame) {
          requireNative(hop < 3 && config.sameReadIdentity(current, frame), 'Native frame changes source/scope/role or exceeds bound');
          config.validateURL(frame); current = frame; continue;
        }
        return html;
      }
      throw Error('Incomplete native redirects');
    };
    const handoffs = [];
    try {
      for (const step of config.handoffs) { const html = await read(step.url); step.verify(html); handoffs.push(step.url); }
      result.handoffVerified = true;
    } catch (error) { failure('native-handoff', error); return result; }
    let next = config.boardURL, pageNumber = 1, firstPage = null;
    const seenPages = new Set(), ids = new Set(), urls = new Set();
    while (next) {
      try {
        requireNative(!seenPages.has(next) && pageNumber <= 1000, 'Native pagination cycle/bound'); seenPages.add(next);
        const page = config.parseListing(await read(next), next);
        requireNative(page.pageNumber === pageNumber, 'Non-contiguous native pagination');
        if (firstPage === null) { firstPage = page; result.nativeReportedTotal = page.reportedTotal; }
        else requireNative(page.reportedTotal === result.nativeReportedTotal && page.lastPage === firstPage.lastPage, 'Native pagination total/scope changed');
        result.pagesFetched++; result.observedListingCount += page.observedRows;
        for (const item of page.errors || []) { failure('native-listing-row', Object.assign(Error(item.message), { code: 'NATIVE_ROW_UNKNOWN' }), item.rawCandidate); }
        for (const row of page.records) {
          if (ids.has(row.id) || urls.has(row.url)) { failure('native-listing-duplicate', Error('Duplicate native job identity'), row); continue; }
          ids.add(row.id); urls.add(row.url); result.listingRecords.push(row);
        }
        next = page.nextURL;
        if (!next) { requireNative(pageNumber === page.lastPage && page.terminationKnown, 'Native pagination ended without proof'); result.listingPaginationComplete = !result.failures.length; }
        pageNumber++;
      } catch (error) { failure('native-pagination', error, { url: next, expectedPage: pageNumber }); break; }
    }
    if (result.listingPaginationComplete && result.nativeReportedTotal !== null && result.observedListingCount !== result.nativeReportedTotal) {
      result.listingPaginationComplete = false; failure('native-pagination', Error('Native total does not reconcile'));
    }
    const candidates = result.listingRecords.filter(config.candidateForIndia);
    result.candidateDetails = candidates.length;
    const details = await mapWithConcurrency(candidates, detailConcurrency, async row => {
      let html;
      try {
        html = await read(row.url); const fact = await config.parseDetail(html, row);
        return { fact };
      } catch (error) { return { error, row, html }; }
    });
    // Emit details and failures in listing order even when reads finish out of
    // order. Retained bytes keep their real request and completion timestamps.
    for (const detail of details) {
      if (detail.error) failure('native-detail', detail.error, { ...detail.row, rawDetailHTML: detail.html || null });
      else if (detail.fact.excluded) result.exclusions.push(detail.fact);
      else result.jobs.push(detail.fact);
    }
    if (firstPage) {
      try {
        const closing = config.parseListing(await read(config.boardURL), config.boardURL);
        requireNative(config.pageFingerprint(closing) === config.pageFingerprint(firstPage), 'Native inventory changed during check'); result.closingInventoryMatches = true;
      } catch (error) { result.closingInventoryMatches = false; failure('closing-inventory', error); }
    }
    if (detailConcurrency > 1) {
      result.retainedResponses.sort((a, b) => a.url.localeCompare(b.url));
      result.retainedResponseOrder = 'URL; repeated resources retain capture order; timestamps retain actual HTTP timing';
    }
    result.status = result.failures.length ? 'partial' : 'native-listed-scope-read';
    return result;
  }
  async function run(options = {}) {
    const result = await collect(options);
    if (!result.jobs.length && result.failures.length) throw Object.assign(Error(config.companyName + ' native collection incomplete; cleanup forbidden'), { name: 'NativeHTMLIncompleteError', code: 'NATIVE_HTML_INCOMPLETE', nativeEvidence: result });
    const jobs = attachInventoryEvidence((config.projectJobs || nativePostingJobs)(result, config), {
      status: 'coverage-gap', surface: config.boardURL, firstParty: Boolean(result.handoffVerified), listingComplete: false,
      pagesFetched: result.pagesFetched, reportedTotal: result.nativeReportedTotal,
      indiaFacetCount: null, verifiedAt: null,
      reason: 'first-party-native-public-HTML;whole-company/legal-inventory-unknown;cleanup-forbidden;state=' + result.status + ';pagination-complete=' + result.listingPaginationComplete + ';rejected=' + result.exclusions.length,
    });
    Object.defineProperty(jobs, Symbol.for('jobverify.native-html-evidence'), { value: result });
    return jobs;
  }
  return { collect, run };
}
