import { createHash } from 'node:crypto'
import { decodeHTMLAttribute } from 'entities'
import { activeHead, extractActiveDescription, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { publicAtsInventoryError } from '../../scraper-support/utils/publishingGapAts.js'
import { createRuntimeVerifiedPublicAtsScraper } from '../../scraper-support/utils/publicAtsRuntimeInventory.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

export const CAREERS_URL = 'https://www.aplazocareers.mx/'
export const BOARD_URL = 'https://jobs.ashbyhq.com/aplazo'
export const API_URL = 'https://api.ashbyhq.com/posting-api/job-board/aplazo'
const SOURCE = 'aplazo'
const MAX_BODY_BYTES = 3000000
const MAX_TOTAL_BYTES = MAX_BODY_BYTES * 4
const PRODUCT_CAROUSEL_URL = 'https://static.parastorage.com/services/editor-elements-library/dist/siteAssets/media/Carousel.b605841e.html?compId=comp-mkg43zpd&deviceType=desktop&locale=es&viewMode=site&imageSizingStrategy=fit'
const PRODUCT_COMPONENT_MODEL_SHA256 = '1f920a2bec9bce195c00e201aabe89befc301ed6de425972dbd5b9927d8a5a46'
const PRODUCT_SECTION_PURPOSE_SHA256 = 'd9db94305527debbd89e482f999b04da56909a852bebc28658a9a43fcce0a660'
const unavailable = (message, status = null) => Object.assign(new Error(`[aplazo] ${message}`), {
  softFailure: true, abortRetries: true, failureKind: [401, 403, 429].includes(status) ? 'blocked_or_access_denied' : 'source_identity_unverified',
  ...(status == null ? {} : { status, httpStatus: status }),
})
const nativeText = async (url, { signal, budget }) => {
  signal?.throwIfAborted()
  const requestSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(20000)])
  try {
    const response = await fetch(url, { signal: requestSignal, redirect: 'manual', credentials: 'omit',
      headers: { Accept: url === API_URL ? 'application/json' : 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify careers check)' } })
    requestSignal.throwIfAborted()
    if (response.status !== 200 || response.url !== url) {
      await response.body?.cancel().catch(() => {})
      throw unavailable('Native response unavailable or redirected', response.status)
    }
    if (Number(response.headers.get('content-length')) > MAX_BODY_BYTES || !response.body) {
      await response.body?.cancel().catch(() => {})
      throw unavailable('Native response exceeds the source budget or has no body')
    }
    if (url === API_URL && !/^application\/(?:[\w.-]+\+)?json(?:;|$)/i.test(response.headers.get('content-type') || '')) {
      await response.body.cancel().catch(() => {})
      throw unavailable('Native posting response is not JSON')
    }
    const reader = response.body.getReader(), chunks = []
    let bytes = 0
    try {
      for (;;) {
        requestSignal.throwIfAborted()
        const part = await reader.read()
        requestSignal.throwIfAborted()
        if (part.done) break
        bytes += part.value.byteLength
        if (bytes > MAX_BODY_BYTES || budget.bytes + bytes > MAX_TOTAL_BYTES) throw unavailable('Native response exceeds the source budget')
        chunks.push(Buffer.from(part.value))
      }
    } catch (error) { await reader.cancel(error).catch(() => {}); throw error }
    finally { reader.releaseLock() }
    budget.bytes += bytes
    const body = new TextDecoder('utf8', { fatal: true }).decode(Buffer.concat(chunks))
    requestSignal.throwIfAborted()
    return body
  } catch (error) { signal?.throwIfAborted(); requestSignal.throwIfAborted(); throw error }
}
const checkHandoff = page => {
  if (page?.status !== 200 || page.url !== CAREERS_URL || typeof page.html !== 'string'
    || Buffer.byteLength(page.html, 'utf8') > MAX_BODY_BYTES) throw unavailable('Current native employer careers response is unavailable', page?.status)
  // The shared tree's whitespace grammar is wider than HTML's. Do not let a
  // non-HTML separator manufacture a required href/canonical attribute.
  const nonHTMLGap = [...page.html.matchAll(/<\/?[a-z][a-z0-9:_-]*\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi)]
    .some(match => /[^\S\t\n\f\r ]/u.test(match[0].replace(/"[^"]*"|'[^']*'/g, '')))
  if (nonHTMLGap) throw unavailable('Current employer HTML uses an unreviewed non-HTML attribute separator')
  const doc = readVisibleNativeDocument(page.html, { strict: true }), head = activeHead(page.html)
  const canonical = doc.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical')
  const board = doc.nodes(n => n.tag === 'a' && n.attrs.href === BOARD_URL && doc.text(n) === 'Conoce nuestras vacantes')
  const employer = doc.nodes(n => n.tag === 'p' && /\bEn APLAZO\b/.test(doc.text(n)))
  if (head.titles.length !== 1 || head.titles[0] !== 'Inicio | Misitio' || canonical.length !== 1
    || canonical[0].attrs.href !== CAREERS_URL.slice(0, -1) || !employer.length || board.length !== 1
    || !doc.nodes(n => n.tag === 'h2' && doc.text(n) === 'Careers').length) {
    throw unavailable('Current active employer identity or exact native Ashby handoff is unqualified')
  }
  const reasons = [], rawDocument = readNativeDocument(page.html, { excludeObjectFallback: false })
  const parents = new Map()
  const indexParents = node => { for (const child of node.children || []) if (typeof child !== 'string') { parents.set(child, node); indexParents(child) } }
  doc.nodes(n => n.tag === 'root').forEach(indexParents)
  const productSections = doc.nodes(n => n.tag === 'section' && n.attrs.id === 'comp-mhmjzecr')
  const productModels = rawDocument.nodes(n => n.tag === 'script' && n.attrs.id === 'wix-warmup-data')
  const productModelReviewed = productModels.length === 1 && productModels[0].attrs.type === 'application/json'
    && createHash('sha256').update(productModels[0].raw || '').digest('hex') === PRODUCT_COMPONENT_MODEL_SHA256
  const productFrame = frame => {
    const component = parents.get(frame)
    let section = component
    while (section && section.tag !== 'section') section = parents.get(section)
    return productModelReviewed && productSections.length === 1 && section === productSections[0]
      && createHash('sha256').update(doc.text(section)).digest('hex') === PRODUCT_SECTION_PURPOSE_SHA256
      && component?.tag === 'wix-iframe' && component.attrs.id === 'comp-mkg43zpd'
      && component.attrs['data-src'] === PRODUCT_CAROUSEL_URL
      && doc.nodes(n => n.tag === 'wix-iframe' && n.attrs.id === 'comp-mkg43zpd').length === 1
      && Object.keys(frame.attrs).length === 3 && frame.attrs.class === 'XEILsR'
      && frame.attrs['data-src'] === PRODUCT_CAROUSEL_URL && frame.attrs.scrolling === 'no'
  }
  // The one reviewed lazy Wix TPA3DCarousel belongs to the current explicitly
  // labelled products section, outside Careers. This purpose exclusion also
  // requires its exact current native component model and frame attributes.
  // Other active child documents/recruiting controls are unresolved scope.
  if (doc.frames().some(frame => !productFrame(frame)) || doc.nodes(n => n.tag === 'embed').length
    || rawDocument.nodes(n => n.tag === 'object').length) {
    reasons.push('unreviewed-active-child-document')
  }
  const recruiting = /\b(?:careers?|jobs?|openings?|positions?|roles?|vacantes?|vacancies|apply|aplicar|empleos?)\b/i
  if (doc.nodes(n => (['form', 'button', 'input'].includes(n.tag) || n.attrs.role === 'button')
    && (Boolean(n.attrs['aria-labelledby']) || recruiting.test([doc.text(n), ...Object.values(n.attrs)].join(' ')))).length) reasons.push('unreviewed-recruiting-control')
  const accessibleLabel = node => node.inert ? '' : [node.attrs['aria-label'], node.attrs.title, node.attrs.alt,
    ...node.children.filter(child => typeof child !== 'string').map(accessibleLabel)].filter(Boolean).join(' ')
  for (const anchor of doc.nodes(n => n.tag === 'a' && n.attrs.href)) {
    let url
    try { url = new URL(decodeHTMLAttribute(anchor.attrs.href), CAREERS_URL) } catch { continue }
    const nativeBoard = url.origin === 'https://jobs.ashbyhq.com' && !url.username && !url.password
      && (url.pathname === '/aplazo' || url.pathname.startsWith('/aplazo/'))
    const careersSelf = url.origin === new URL(CAREERS_URL).origin && url.pathname === '/' && !url.search
    const intent = recruiting.test(doc.text(anchor) + ' ' + accessibleLabel(anchor))
      || /\/(?:careers?|jobs?|roles?|positions?|apply)(?:\/|$)/i.test(url.pathname)
      || /^(?:careers?|jobs?)\./i.test(url.hostname)
    const unknownReferencedName = Boolean(anchor.attrs['aria-labelledby']) && !nativeBoard && !careersSelf
    if (unknownReferencedName || intent && (!nativeBoard && !careersSelf || Object.keys(anchor.attrs).some(key => /^on/i.test(key)))) {
      reasons.push('additional-recruiting-link-or-scripted-action')
    }
  }
  // Keep finite raw syntax aligned with the visible HTML parser. Browser
  // accepted alternate comment/script closings must not conceal later links.
  if (page.html.includes('--!>') || /<!--(?:>|->)/.test(page.html)
    || [...page.html.matchAll(/<\/script(?=[\s/>])([^>]*)>/gi)]
    .some(match => !/^[\t\n\f\r ]*$/.test(match[1]))) reasons.push('unreviewed-raw-html-boundary')
  return reasons
}
const countryIsIndia = country => typeof country === 'string' && /^(?:IN|IND|India)$/i.test(country.trim())
const nativeIndiaScope = row => [{ location: row.location, address: row.address }, ...(row.secondaryLocations || [])]
  .some(place => countryIsIndia((place.address?.postalAddress || place.address || {}).addressCountry)
    || typeof place.location === 'string' && /\bindia\b/i.test(place.location))
const qualifiesDescription = value => {
  const doc = readVisibleNativeDocument(value || '', { strict: true })
  const root = doc.nodes(n => n.tag === 'root')[0]
  return Boolean(root && extractActiveDescription(doc.text(root)))
}

const provider = {
  source: SOURCE, companyName: 'Aplazo', atsPlatform: 'ashby', boardToken: 'aplazo',
  companyCareerPage: CAREERS_URL, sourceScopeComplete: false,
  runtimeInventoryVerification: { mode: 'board-handoff', boardUrl: BOARD_URL },
}
const stable = value => Array.isArray(value) ? value.map(stable)
  : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value
const inventoryHash = payload => createHash('sha256').update(JSON.stringify(stable({ ...payload,
  jobs: [...payload.jobs].sort((a, b) => a.id.localeCompare(b.id)),
}))).digest('hex')
const envelopeReasons = payload => Object.keys(payload).filter(key => !['apiVersion', 'jobs'].includes(key))
  .map(key => `unreviewed-native-envelope:${key}`)
const mapCurrentInventory = async (page, payload, signal) => {
  if (!payload || Array.isArray(payload) || !Array.isArray(payload.jobs) || publicAtsInventoryError(payload)) {
    throw unavailable('Native posting inventory has an unavailable or malformed envelope')
  }
  // Only the reviewed single-response schema is eligible for completeness.
  // Other envelope fields stay in the retained native payload/hash and cause
  // a partial result; row validation may still recover valid positive roles.
  return createRuntimeVerifiedPublicAtsScraper(provider).run({ signal,
    fetchPage: async () => page,
    fetchJson: async () => ({ apiVersion: payload.apiVersion, jobs: payload.jobs }),
  })
}

export const runNativeAplazo = async ({ fetchPage, fetchJson, signal, now = () => new Date().toISOString() } = {}) => {
  signal?.throwIfAborted()
  const wholeSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(120000)])
  const budget = { requests: 0, bytes: 0 }
  const checkCancellation = () => { signal?.throwIfAborted(); wholeSignal.throwIfAborted() }
  const reserveRead = url => {
    checkCancellation()
    if (![CAREERS_URL, API_URL].includes(url) || ++budget.requests > 4) throw unavailable('Native source request budget exceeded')
  }
  const countHookBytes = body => {
    const bytes = Buffer.byteLength(body, 'utf8')
    if (bytes > MAX_BODY_BYTES || budget.bytes + bytes > MAX_TOTAL_BYTES) throw unavailable('Native response exceeds the source budget')
    budget.bytes += bytes
  }
  const readPage = async () => {
    reserveRead(CAREERS_URL)
    const page = fetchPage ? await fetchPage(CAREERS_URL, { signal: wholeSignal })
      : { status: 200, url: CAREERS_URL, html: await nativeText(CAREERS_URL, { signal: wholeSignal, budget }) }
    checkCancellation()
    if (fetchPage && typeof page?.html === 'string') countHookBytes(page.html)
    return page
  }
  const readJson = async () => {
    reserveRead(API_URL)
    const payload = fetchJson ? await fetchJson(API_URL, { signal: wholeSignal })
      : JSON.parse(await nativeText(API_URL, { signal: wholeSignal, budget }))
    checkCancellation()
    if (fetchJson) countHookBytes(JSON.stringify(payload) || '')
    return payload
  }
  try {
    const page = await readPage()
    const handoffReasons = checkHandoff(page)
    const payload = await readJson()
    const mapped = await mapCurrentInventory(page, payload, wholeSignal)
    checkCancellation()
    const openingEvidence = readInventoryEvidence(mapped)
    const reasons = [...handoffReasons, ...envelopeReasons(payload)]
    if (!openingEvidence?.listingComplete) reasons.push(openingEvidence?.reason || 'opening-native-inventory-incomplete')
    const nativeById = new Map(payload.jobs.map(row => [row.id, row]))
    const jobs = mapped.filter(job => nativeIndiaScope(nativeById.get(job.jobId))).map(job => {
      const native = nativeById.get(job.jobId)
      const html = typeof native.descriptionHtml === 'string' && native.descriptionHtml.trim() ? native.descriptionHtml : null
      const plain = typeof native.descriptionPlain === 'string' && native.descriptionPlain.trim() ? native.descriptionPlain : null
      const htmlComplete = qualifiesDescription(html)
      const plainComplete = qualifiesDescription(plain)
      const description = htmlComplete ? html : plainComplete ? plain : html || plain
      const complete = htmlComplete || plainComplete
      return { ...job, sourceDescription: description, jobDescription: description,
        ...(description === plain && html ? { nativeDescriptionHTML: html } : {}),
        sourceUrl: native.jobUrl, applyUrl: native.applyUrl, link: native.applyUrl,
        nativeSourceRecord: structuredClone(native),
        sourceDetailComplete: complete, ...(!complete ? { sourceDetailFailureKind: 'missing-content' } : {}),
        sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false }
    })
    if (jobs.some(job => !job.sourceDetailComplete)) reasons.push('selected-native-role-detail-incomplete')
    let verifiedAt = null
    try {
      const closingPayload = await readJson()
      const closingPage = await readPage()
      reasons.push(...checkHandoff(closingPage))
      const closingMapped = await mapCurrentInventory(closingPage, closingPayload, wholeSignal)
      checkCancellation()
      reasons.push(...envelopeReasons(closingPayload))
      if (!readInventoryEvidence(closingMapped)?.listingComplete) reasons.push('closing-current-employer-or-country-scope-incomplete')
      if (inventoryHash(payload) !== inventoryHash(closingPayload)) reasons.push('closing-native-records-changed')
      const clockValue = now(), clock = new Date(clockValue)
      if (clockValue == null || Number.isNaN(+clock) || +clock <= 0) reasons.push('invalid-proof-clock')
      else verifiedAt = clock.toISOString()
    } catch (error) {
      checkCancellation()
      reasons.push(`closing-inventory-unavailable:${error.failureKind || 'native-response-unavailable'}`)
    }
    checkCancellation()
    const listingComplete = reasons.length === 0
    for (const job of jobs) {
      job.sourceListingComplete = listingComplete
      job.sourceScopeComplete = listingComplete
      job.lifecycleCleanupAllowed = listingComplete
    }
    attachInventoryEvidence(jobs, { status: listingComplete ? payload.jobs.length ? 'complete-inventory' : 'verified-empty' : 'discovery-only',
      surface: API_URL, firstParty: true, listingComplete, pagesFetched: budget.requests,
      reportedTotal: null, indiaFacetCount: listingComplete ? openingEvidence.indiaFacetCount : null,
      verifiedAt: listingComplete ? verifiedAt : null,
      reason: listingComplete ? 'aplazo-current-employer-public-ashby-inventory;all-native-countries;full-selected-details;closing-records-and-handoff-reconciled'
        : `aplazo-public-inventory-incomplete:${[...new Set(reasons)].join(';')}` })
    // These counts remain observations, including when the current public
    // inventory is complete. They do not assert legal/whole-company totals.
    return attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: payload.jobs.every(row => row.isListed) ? 'vacancy-rows' : 'mixed',
      observedRecordCount: payload.jobs.length, observedVacancyCount: payload.jobs.filter(row => row.isListed).length,
      sourceScopeComplete: false })
  } catch (error) { checkCancellation(); throw error }
}
