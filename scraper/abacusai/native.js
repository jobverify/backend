import { createHash } from 'node:crypto'
import { activeHead } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument, readNativeStatusLayout } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

export const SOURCE = 'abacusai'
export const COMPANY = 'Abacus.AI'
export const HOMEPAGE_URL = 'https://abacus.ai/'
export const CAREERS_URL = 'https://abacus.ai/jobs'
export const APPLICATION_URL = 'mailto:jobs@abacus.ai'
const MAXIMUM_BYTES = 2 * 1024 * 1024
const hasClass = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const sha = value => createHash('sha256').update(value).digest('hex')
const gap = (reason, pagesFetched = 0, verifiedAt = null, firstParty = false) => ({
  status: 'coverage-gap', surface: CAREERS_URL, firstParty, listingComplete: false,
  pagesFetched, verifiedAt, reportedTotal: null, indiaFacetCount: null, reason,
})
// Only module-created failures may receive source progress. Unknown transport
// errors and opaque cancellation reasons are never inspected or mutated.
const sourceFailures = new WeakMap()
const failure = (message, extra = {}) => {
  const error = Object.assign(new Error('[abacusai] ' + message), {
    name: 'AbacusNativeError', code: 'native_contract_unqualified', abortRetries: true,
    inventoryEvidence: gap(message), ...extra,
  })
  sourceFailures.set(error, { message, extra: { ...extra } })
  return error
}
const need = (condition, message) => { if (!condition) throw failure(message) }
const bestEffortCancel = body => {
  try { Promise.resolve(body?.cancel()).catch(() => {}) } catch {}
}

// The deadline includes headers and body consumption. Caller cancellation wins
// with its exact opaque reason, even if an injected HTTP/body reader ignores it.
export async function fetchNativeHTML(url, options = {}) {
  const { signal, fetchImpl = globalThis.fetch, requestTimeoutMs = 20000,
    maximumBytes = MAXIMUM_BYTES, now = () => new Date() } = options
  signal?.throwIfAborted()
  need([HOMEPAGE_URL, CAREERS_URL].includes(url), 'URL is outside the two primary surfaces')
  need(Number.isInteger(requestTimeoutMs) && requestTimeoutMs > 0 && requestTimeoutMs <= 30000,
    'request deadline is outside its bound')
  need(Number.isInteger(maximumBytes) && maximumBytes > 0 && maximumBytes <= MAXIMUM_BYTES,
    'response size is outside its bound')
  const controller = new AbortController()
  const startedAt = new Date(now()).toISOString()
  let response, reader, completed = false, timeout, abortListener
  const interrupted = new Promise((_, reject) => {
    abortListener = () => { controller.abort(signal.reason); reject(signal.reason) }
    signal?.addEventListener('abort', abortListener, { once: true })
    timeout = setTimeout(() => {
      const error = failure('native request deadline exceeded', { code: 'native_request_timed_out' })
      controller.abort(error)
      reject(error)
    }, requestTimeoutMs)
  })
  try {
    signal?.throwIfAborted()
    const operation = (async () => {
      response = await fetchImpl(url, { redirect: 'manual', signal: controller.signal,
        headers: { Accept: 'text/html' } })
      if (controller.signal.aborted) bestEffortCancel(response?.body)
      controller.signal.throwIfAborted()
      if (response.status !== 200) {
        bestEffortCancel(response.body)
        throw failure('native HTTP ' + response.status, {
          code: [401, 403].includes(response.status) ? 'access_denied'
            : response.status === 429 ? 'rate_limited' : 'native_unavailable',
          status: response.status,
          retryAfter: response.headers?.get('retry-after') ?? null,
        })
      }
      need(response.url === url, 'response URL changed')
      const contentType = response.headers.get('content-type') || ''
      need(/^text\/html(?:\s*;|$)/i.test(contentType), 'response is not HTML')
      const declaredLength = response.headers.get('content-length')
      need(declaredLength == null || /^\d+$/.test(declaredLength)
        && Number.isSafeInteger(Number(declaredLength)) && Number(declaredLength) <= maximumBytes,
      'declared response size is malformed or over limit')
      reader = response.body?.getReader()
      need(reader && typeof reader.read === 'function', 'native response body unavailable')
      const parts = []
      let length = 0
      while (true) {
        controller.signal.throwIfAborted()
        const part = await reader.read()
        controller.signal.throwIfAborted()
        if (part.done) break
        need(part.value instanceof Uint8Array, 'native body chunk is not bytes')
        length += part.value.byteLength
        need(length <= maximumBytes, 'native response body exceeds limit')
        parts.push(part.value)
      }
      const bytes = Buffer.concat(parts)
      let body
      try { body = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
      catch { throw failure('native HTML encoding is not qualified UTF-8') }
      completed = true
      return { url, status: 200, contentType, bytes: bytes.length, sha256: sha(bytes), body,
        startedAt, completedAt: new Date(now()).toISOString() }
    })()
    return await Promise.race([operation, interrupted])
  } catch (error) {
    if (signal?.aborted) throw signal.reason
    throw error
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abortListener)
    if (!completed) {
      controller.abort()
      bestEffortCancel(reader || response?.body)
    }
  }
}

// Dependency failures here arise while parsing our already received native
// HTML, not inside an injected transport. Keep their original cause untouched.
const nativeDOM = (read, message) => {
  try { return read() } catch (cause) { throw failure(message, { cause }) }
}
const nativeText = (document, node) => nativeDOM(() => document.text(node), 'native primary text is malformed')

const readPage = (html, jobsPage) => {
  need(typeof html === 'string' && Buffer.byteLength(html) <= MAXIMUM_BYTES, 'HTML is unavailable or over limit')
  const head = nativeDOM(() => activeHead(html), 'native primary head is malformed')
  need(head.titles.length === 1 && (jobsPage ? head.titles[0] === 'Abacus.AI - Careers & Jobs'
    : /^Abacus\.AI(?:\s|—|-)/u.test(head.titles[0])), 'primary brand/title changed')
  const brands = head.metas.filter(meta => meta.property === 'og:site_name')
  need(brands.length === 1 && brands[0].content === COMPANY, 'primary brand metadata changed')
  const canonical = head.metas.filter(meta => meta.property === 'og:url')
  need(canonical.length === 1 && ['https://abacus.ai', HOMEPAGE_URL].includes(canonical[0].content),
    'primary domain metadata changed')
  return nativeDOM(() => readVisibleNativeDocument(html, { strict: true, statusLayout: true }), 'native primary document is malformed')
}

export function inspectHomepage(html) {
  const document = readPage(html, false)
  const links = document.nodes(node => node.tag === 'a' && ['/jobs', CAREERS_URL].includes(node.attrs.href)
    && nativeText(document, node) === 'Jobs')
  need(links.length === 1, 'active primary jobs handoff is missing or ambiguous')
  return { careersURL: CAREERS_URL, handoffText: 'Jobs',
    layoutQualified: readNativeStatusLayout(links[0])?.qualified === true }
}

const descendants = (node, predicate) => node.inert ? [] : [
  ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => descendants(child, predicate)),
]

export function inspectRoleObservations(html) {
  const document = readPage(html, true)
  const headings = document.nodes(node => node.tag === 'h1' && hasClass(node, 'jobs-title'))
  need(headings.length === 1 && nativeText(document, headings[0]) === 'Jobs', 'native jobs heading changed')
  const cards = document.nodes(node => hasClass(node, 'jobs-job'))
  need(cards.length > 0 && cards.length <= 100, 'native role cards missing or over bound; empty inventory unproved')
  const seen = new Set()
  return cards.map((card, index) => {
    const headings = descendants(card, node => node.tag === 'h2' && hasClass(node, 'jobs-job-title'))
    need(headings.length === 1, 'native role heading missing or ambiguous')
    const title = nativeText(document, headings[0])
    need(title && title.length <= 300 && !seen.has(title), 'native role heading empty or duplicate without native IDs')
    seen.add(title)
    const applications = descendants(card, node => node.tag === 'a' && hasClass(node, 'jobs-apply-button'))
    need(applications.length === 1 && applications[0].attrs.href === APPLICATION_URL
      && nativeText(document, applications[0]) === 'Apply now', 'native email application changed')
    // The current first-party redesign keeps the role/apply classes but moves
    // authored criteria into one direct v2 body. Restrict extraction to that
    // body so headings, application actions and surrounding company copy do
    // not become role criteria. Retain the separately captured legacy layout.
    const bodies = card.children.filter(node => typeof node !== 'string' && !node.inert
      && node.tag === 'div' && hasClass(node, 'v2-job__body'))
    need(bodies.length <= 1, 'native role criteria body is ambiguous')
    const blocks = (bodies[0] || card).children.filter(node => typeof node !== 'string' && !node.inert
      && (bodies.length ? ['p', 'ul'].includes(node.tag)
        : node.tag === 'p' && (hasClass(node, 'jobs-job-description') || hasClass(node, 'jobs-job-requirements'))
          || node.tag === 'ul' && hasClass(node, 'jobs-job-list')))
      .map(node => ({ tag: node.tag, text: nativeText(document, node) }))
    const descriptionText = blocks.map(block => block.text).join('\n')
    need(blocks.length >= 2 && blocks.every(block => block.text) && descriptionText.length >= 100,
      'authored native role criteria missing; no public description is inferred')
    return { ordinal: index + 1, title, applicationHref: APPLICATION_URL, descriptionText, descriptionBlocks: blocks,
      layoutQualified: descendants(card, () => true).every(node => readNativeStatusLayout(node)?.qualified === true),
      qualifiedForPublicCriteria: false, nativeJobId: null, legalEmployer: null,
      location: null, country: null, publicationDate: null }
  })
}

const primaryEvidence = (packets, binding, options) => {
  const httpInterface = Object.hasOwn(options, 'fetchImpl') ? 'injected-http-interface' : 'default-http-interface'
  const clockInjected = Object.hasOwn(options, 'now')
  return Object.freeze({
    packets: Object.freeze(packets.map(({ url, status, contentType, bytes, sha256, startedAt, completedAt }) => Object.freeze({
      url, status, contentType, bytes, sha256, startedAt, completedAt, httpInterface, clockInjected,
    }))),
    binding: binding ? Object.freeze({ ...binding }) : null,
    httpInterface, clockInjected, rawObservationsOnly: true,
    currentRoleAvailabilityProven: false, companyScopeComplete: false,
  })
}

export async function collect(options = {}) {
  const { signal } = options
  signal?.throwIfAborted()
  const packets = []
  let binding = null
  const readPrimary = async url => {
    try { return await fetchNativeHTML(url, options) }
    catch (error) {
      if (signal?.aborted) throw signal.reason
      if (Object.hasOwn(options, 'fetchImpl') || sourceFailures.has(error)) throw error
      // A rejection on the default HTTP interface is native transport evidence.
      // Do not inspect its properties, mutate it, or change its retry disposition.
      throw failure('default native primary transport did not complete', {
        code: 'native_unavailable', cause: error, abortRetries: undefined,
      })
    }
  }
  try {
    const homepage = await readPrimary(HOMEPAGE_URL)
    packets.push(homepage)
    binding = inspectHomepage(homepage.body)
    signal?.throwIfAborted()
    const careers = await readPrimary(CAREERS_URL)
    packets.push(careers)
    const observations = inspectRoleObservations(careers.body)
    signal?.throwIfAborted()
    const evidence = primaryEvidence(packets, binding, options)
    const jobs = observations.map(observation => ({
      source: SOURCE, company: COMPANY, title: observation.title,
      jobId: null, requisitionId: null, nativeLegalEmployer: null,
      location: null, city: null, state: null, country: null,
      postingDate: null, postedAt: null, closingDate: null, employmentType: null,
      sourceUrl: CAREERS_URL, applyUrl: APPLICATION_URL, link: CAREERS_URL,
      jobDescription: null, sourceDescription: null,
      nativeRoleObservation: { ...observation, primaryPacketReferences: evidence.packets }, scrapedAt: careers.completedAt,
      sourceDetailComplete: false, sourceDetailFailureKind: 'unqualified-native-role-observation',
      sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    }))
    attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows',
      observedRecordCount: observations.length, observedVacancyCount: observations.length, sourceScopeComplete: false })
    Object.defineProperty(jobs, 'nativePrimaryReceipts', { value: evidence })
    return attachInventoryEvidence(jobs, gap('raw-native-cards-country-date-role-identity-and-layout-unqualified',
      packets.length, careers.completedAt, true))
  } catch (error) {
    if (signal?.aborted) throw signal.reason
    const details = sourceFailures.get(error)
    if (!details || packets.length === 0) throw error
    throw failure(details.message, { ...details.extra, cause: error,
      inventoryEvidence: gap(details.message, packets.length, packets.at(-1).completedAt, Boolean(binding)),
      nativePrimaryReceipts: primaryEvidence(packets, binding, options),
    })
  }
}
