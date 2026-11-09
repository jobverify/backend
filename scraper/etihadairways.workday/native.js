import { setTimeout as wait } from 'node:timers/promises'
import { runApiPortalScraper } from '../../scraper-support/apiPortal/engine.js'
import { expandApiPortalProviderTemplate } from '../../scraper-support/providers/apiPortalTemplates.js'
import { extractActiveDescription, decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { toPlainText } from '../../scraper-support/detailExtractors/shared.js'

export const SOURCE = 'etihadairways'
export const TENANT = 'EtihadAirways5'
export const COMPANY = 'Etihad Airways'
const selectedNativeCountry = Symbol('etihad-native-selected-country')
export const CAREERS_URL = 'https://careers.etihad.com/'
export const BOARD_URL = 'https://careers.smartrecruiters.com/EtihadAirways5'
export const API_URL = 'https://api.smartrecruiters.com/v1/companies/EtihadAirways5/postings'
const observations = new WeakMap()
export const readEtihadEvidence = jobs => observations.get(jobs) || null
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const failure = message => Object.assign(new Error('EtihadAirways5 ' + message), { incompleteScope: true, abortRetries: true })
const publicReference = (value, id) => {
  try {
    const url = new URL(value), parts = url.pathname.split('/').filter(Boolean)
    return url.origin === 'https://jobs.smartrecruiters.com' && !url.username && !url.password
      && parts.length === 2 && parts[0] === TENANT && (parts[1] === id || parts[1].startsWith(id + '-'))
  } catch { return false }
}
const apiReference = (value, id) => value === API_URL + '/' + id
const assertUrls = record => {
  for (const field of ['postingUrl', 'applyUrl', 'sourceUrl', 'url', 'ref']) {
    if (record[field] == null) continue
    if (!(field === 'ref' ? apiReference(record[field], record.id) : publicReference(record[field], record.id))) {
      throw failure('native URL identity/tenant mismatch in ' + field)
    }
  }
}

export const verifyOfficialHandoff = html => {
  const document = readVisibleNativeDocument(html, { strict: true })
  const links = document.nodes(node => node.tag === 'a' && node.attrs.href === BOARD_URL
    && ['Find Jobs', 'All Jobs', 'Jobs', 'Explore opportunities'].includes(norm(document.text(node)))
    && !['disabled', 'aria-disabled'].some(key => Object.hasOwn(node.attrs, key) && node.attrs[key] !== 'false'))
  if (!links.length) throw failure('official visible enabled handoff is unavailable')
  return BOARD_URL
}

const verifyBoard = html => {
  const document = readVisibleNativeDocument(html, { strict: true })
  const brand = document.nodes(node => /^h[1-3]$/.test(node.tag) && norm(document.text(node)) === COMPANY)
  const jobs = document.nodes(node => /^h[1-3]$/.test(node.tag) && norm(document.text(node)) === 'Jobs at Etihad')
  const reciprocal = document.nodes(node => node.tag === 'a' && node.attrs.href === CAREERS_URL && norm(document.text(node)) === 'Home Page')
  if (!brand.length || !jobs.length || !reciprocal.length) throw failure('board company/reciprocal handoff identity is unavailable')
  const ids = new Set()
  for (const link of document.nodes(node => node.tag === 'a' && typeof node.attrs.href === 'string')) {
    let url
    try { url = new URL(link.attrs.href) } catch { continue }
    if (url.origin !== 'https://jobs.smartrecruiters.com') continue
    const match = url.pathname.match(/^\/([^/]+)\/(\d+)(?:-[^/]*)?\/?$/)
    if (!match) continue
    if (match[1] !== TENANT || url.username || url.password) throw failure('board native URL tenant identity mismatch')
    ids.add(match[2])
  }
  return ids
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const countryNames = new Map()
for (let first = 65; first <= 90; first++) for (let second = 65; second <= 90; second++) {
  const code = String.fromCharCode(first, second), name = regionNames.of(code)
  if (name !== code) countryNames.set(norm(name).toLowerCase(), new Intl.Locale('und-' + code).region)
}
const countryCode = value => {
  if (typeof value !== 'string' || !/^[a-z]{2}$/i.test(value.trim())) return null
  const code = value.trim().toUpperCase()
  return !['ZZ', 'EU', 'EZ', 'UN', 'XA', 'XB', 'QO'].includes(code) && regionNames.of(code) !== code
    ? new Intl.Locale('und-' + code).region : null
}
const nativeCountry = record => {
  const code = countryCode(record.location?.country)
  if (!code) return null
  if (record.customField != null && !Array.isArray(record.customField)) return null
  for (const field of record.customField || []) if (field.fieldId === 'COUNTRY') {
    if (countryCode(field.valueId) !== code || typeof field.valueLabel !== 'string'
      || norm(field.valueLabel) !== regionNames.of(code)) return null
  }
  // A native country code cannot override another explicitly named country
  // in the same role's worksite. Bare cities remain literal, never inferred.
  for (const field of ['fullLocation', 'address']) {
    const value = record.location?.[field]
    if (value == null) continue
    if (typeof value !== 'string') return null
    const components = value.split(',').map(norm)
    for (let index = 0; index < components.length; index++) {
      // A native city named Georgia or Singapore remains a city, without
      // supplying an inferred country. Other explicit country components
      // cannot disappear merely because a later suffix says India.
      if (index === 0 && components[index].toLowerCase() === norm(record.location.city).toLowerCase()) continue
      const explicit = countryNames.get(components[index].toLowerCase())
      if (explicit && explicit !== code) return null
    }
  }
  return code
}
const descriptionProjection = value => {
  const document = readVisibleNativeDocument(typeof value === 'string' ? value : '', { strict: true })
  const root = document.nodes(node => node.tag === 'root')[0]
  const visible = norm(root ? document.text(root) : '')
  return {
    complete: Boolean(extractActiveDescription(visible)),
    normalized: typeof value !== 'string' ? null : norm(decodeNativeEntities(toPlainText(value))) === visible ? value : visible,
  }
}

const readBoundedBody = async (response, signal, checkAbort) => {
  if (!response.body?.getReader) throw failure('native response body unavailable')
  const reader = response.body.getReader(), chunks = []
  let bytes = 0, aborted
  const cancellation = new Promise((_, reject) => {
    aborted = () => reject(signal.reason)
    if (signal.aborted) aborted()
    else signal.addEventListener('abort', aborted, { once: true })
  })
  try {
    while (true) {
      const chunk = await Promise.race([reader.read(), cancellation])
      checkAbort()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > 2 * 1024 * 1024) throw failure('native response body limit exceeded')
      chunks.push(Buffer.from(chunk.value))
    }
    return Buffer.concat(chunks).toString('utf8')
  } catch (error) {
    void reader.cancel(signal.aborted ? signal.reason : error).catch(() => {})
    checkAbort()
    throw error
  } finally {
    signal.removeEventListener('abort', aborted)
    reader.releaseLock()
  }
}

const provider = () => {
  const result = expandApiPortalProviderTemplate({ source: SOURCE, companyName: COMPANY, atsPlatform: 'smartrecruiters',
    companyCareerPage: CAREERS_URL, countryFilter: null, scraperTimeoutMs: 120000,
    template: 'smartrecruiters', templateOptions: { companySlug: TENANT, limit: 100 },
    config: { recordFilter: { include: [{ field: 'visibility', pattern: '^PUBLIC$' }, { field: selectedNativeCountry, pattern: '^IN$' }] }, mapping: { country: 'location.country', jobDescription: 'jobAd.sections.jobDescription.text' },
      pagination: { traversalMode: 'staged-snapshot', maxPages: 20 }, detail: { concurrency: 2 },
      inventoryValidation: { requiredFields: ['id', 'name', 'refNumber', 'company.identifier', 'ref'], uniqueField: 'id' } } })
  // Preserve a received empty JD and its genuine URLs/qualifications. The
  // existing post-map check marks missing descriptions incomplete.
  delete result.config.detail.mapping.jobDescription
  return result
}

export const createEtihadScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText, fetchJson, signal } = {}) {
    signal?.throwIfAborted()
    if (maxJobs != null && (!Number.isSafeInteger(maxJobs) || maxJobs < 0)) throw failure('invalid output cap')
    const stop = new AbortController(), deadline = AbortSignal.timeout(120000)
    const lifecycle = AbortSignal.any([stop.signal, deadline, ...(signal ? [signal] : [])])
    let lastStart = 0, queue = Promise.resolve()
    const defaultRead = async (url, options = {}, json) => {
      const requestSignal = options.signal ? AbortSignal.any([lifecycle, options.signal]) : lifecycle
      const slot = queue.then(async () => {
        requestSignal.throwIfAborted()
        const pause = 1000 - (Date.now() - lastStart)
        if (pause > 0) await wait(pause, undefined, { signal: requestSignal })
        requestSignal.throwIfAborted(); lastStart = Date.now()
      })
      queue = slot.catch(() => {})
      try { await slot } catch (error) { lifecycle.throwIfAborted(); requestSignal.throwIfAborted(); throw error }
      const attemptSignal = AbortSignal.any([requestSignal, AbortSignal.timeout(15000)])
      const checkAbort = () => {
        lifecycle.throwIfAborted()
        requestSignal.throwIfAborted()
        attemptSignal.throwIfAborted()
      }
      let response
      try {
        response = await fetch(url, { method: 'GET', redirect: 'manual',
          headers: { 'User-Agent': 'Mozilla/5.0', Accept: json ? 'application/json' : 'text/html' }, signal: attemptSignal })
        checkAbort()
        if (response.status !== 200) {
          throw Object.assign(failure('public native access unavailable HTTP ' + response.status), { status: response.status })
        }
        if (response.url !== url) throw failure('native response URL mismatch')
        const contentType = response.headers?.get?.('content-type') || ''
        if (!(json ? /^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i : /^(?:text\/html|application\/xhtml\+xml)(?:\s*;|$)/i).test(contentType)) {
          throw failure('native response content type is not expected ' + (json ? 'JSON' : 'HTML'))
        }
        const text = await readBoundedBody(response, attemptSignal, checkAbort)
        checkAbort()
        if (/<title[^>]*>\s*(?:Just a moment|Access Denied|Forbidden|Attention Required)/i.test(text)) throw failure('native access challenge is unavailable')
        const value = json ? JSON.parse(text) : text
        checkAbort()
        return value
      } catch (error) {
        if (response?.body && !response.body.locked) void response.body.cancel().catch(() => {})
        checkAbort()
        throw error
      }
    }
    const textReader = fetchText || ((url, options) => defaultRead(url, options, false))
    const jsonReader = fetchJson || ((url, options) => defaultRead(url, options, true))
    const guarded = async operation => {
      lifecycle.throwIfAborted()
      try { const value = await operation(); lifecycle.throwIfAborted(); return value }
      catch (error) { if (lifecycle.aborted) throw lifecycle.reason; stop.abort(error); throw error }
    }
    const official = await guarded(() => textReader(CAREERS_URL, { signal: lifecycle }))
    verifyOfficialHandoff(official)
    const board = await guarded(() => textReader(BOARD_URL, { signal: lifecycle }))
    const boardIds = verifyBoard(board), opening = new Map(), nativeDetails = new Map()
    let listingPhase = 'opening', firstListing = true
    const fetchNativeJson = (url, options = {}) => guarded(async () => {
      const payload = await jsonReader(url, { ...options, signal: options.signal ? AbortSignal.any([lifecycle, options.signal]) : lifecycle })
      if (!payload || typeof payload !== 'object' || payload.error || payload.success === false
        || Array.isArray(payload.errors) && payload.errors.length) throw failure('native upstream contract failed')
      const address = new URL(url)
      if (address.origin !== 'https://api.smartrecruiters.com') throw failure('native API URL identity mismatch')
      if (address.pathname === '/v1/companies/EtihadAirways5/postings') {
        if (!Array.isArray(payload.content)) throw failure('native listing array malformed')
        const offset = Number(address.searchParams.get('offset') || 0)
        if (!firstListing && offset === 0) listingPhase = 'closing'
        firstListing = false
        for (const record of payload.content) {
          if (!record || typeof record !== 'object' || !/^\d+$/.test(record.id || '') || record.company?.identifier !== TENANT
            || record.company?.name !== COMPANY || !norm(record.name) || !norm(record.refNumber)) throw failure('native listing company/role identity disagrees with the bound board')
          assertUrls(record)
          if (listingPhase === 'opening') {
            if (opening.has(record.id)) throw failure('native listing repeated role identity')
            opening.set(record.id, structuredClone(record))
          }
        }
      } else {
        const id = address.pathname.match(/^\/v1\/companies\/EtihadAirways5\/postings\/(\d+)$/)?.[1], record = opening.get(id)
        if (!record || payload.id !== id || payload.company?.identifier !== TENANT || payload.company?.name !== COMPANY
          || norm(payload.name) !== norm(record.name) || payload.refNumber !== record.refNumber) throw failure('native detail company/role identity mismatch')
        assertUrls(payload)
        if (!publicReference(payload.postingUrl, id) || !publicReference(payload.applyUrl, id)) throw failure('native detail public URL identity unavailable')
        for (const field of ['country', 'city', 'region', 'fullLocation', 'address', 'remote', 'hybrid']) {
          if (record.location?.[field] != null && payload.location?.[field] != null
            && norm(String(record.location[field])) !== norm(String(payload.location[field]))) throw failure('native detail country/location identity mismatch')
        }
        nativeDetails.set(id, structuredClone(payload))
      }
      return address.pathname === '/v1/companies/EtihadAirways5/postings'
        ? { ...payload, content: payload.content.map(record => ({ ...record, [selectedNativeCountry]: nativeCountry(record) })) }
        : payload
    })
    const jobs = await runApiPortalScraper({ provider: provider(), fetchJson: fetchNativeJson, signal: lifecycle })
    const inventory = readInventoryEvidence(jobs), candidates = [], unknownCountry = [], missingCriteria = [], unpublished = []
    let indiaRecords = 0, publicRecords = 0
    for (const record of opening.values()) {
      if (record.visibility === 'PUBLIC') publicRecords++
      else unpublished.push(record.id)
      const code = nativeCountry(record)
      if (!code) unknownCountry.push(record.id)
      if (code === 'IN' && record.visibility === 'PUBLIC') indiaRecords++
    }
    for (const job of jobs) {
      const record = opening.get(String(job.jobId)), detail = nativeDetails.get(String(job.jobId))
      if (!record || !detail) throw failure('mapped native role identity lost')
      const publication = record.visibility === 'PUBLIC' && (detail.visibility == null || detail.visibility === 'PUBLIC')
      if (!publication && !unpublished.includes(record.id)) unpublished.push(record.id)
      const listingCountry = nativeCountry(record), detailCountry = nativeCountry(detail)
      const country = listingCountry && detailCountry === listingCountry ? detailCountry : null
      if (!country && !unknownCountry.includes(record.id)) unknownCountry.push(record.id)
      const rawDescription = detail.jobAd?.sections?.jobDescription?.text
      const description = descriptionProjection(rawDescription), complete = description.complete
      if (!complete) missingCriteria.push(record.id)
      if (publication && country === 'IN') candidates.push({ ...job,
        jobDescription: description.normalized,
        minimumQualification: descriptionProjection(job.minimumQualification).normalized,
        preferredQualification: descriptionProjection(job.preferredQualification).normalized,
        sourceDetailComplete: complete, publicExperienceChecked: complete,
        sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
        sourceNativeListingRecord: structuredClone(record), sourceNativeDetailRecord: structuredClone(detail),
        ...(!complete ? { sourceDetailFailureKind: 'missing-content' } : {}) })
    }
    const output = maxJobs == null ? candidates : candidates.slice(0, maxJobs)
    const capped = output.length < candidates.length
    const boardMatches = boardIds.size === opening.size && [...opening.keys()].every(id => boardIds.has(id))
    const reasons = ['etihad-native-board-observation-not-company-completeness',
      ...(inventory?.listingComplete === false ? [inventory.reason] : []),
      ...(!boardMatches ? ['native-board-visible-subset-not-whole-company'] : []),
      ...(unknownCountry.length ? ['native-country-unresolved'] : []),
      ...(missingCriteria.length ? ['native-description-unavailable'] : []), ...(capped ? ['output-cap'] : [])]
    attachInventoryEvidence(output, { ...inventory, status: 'discovery-only', surface: API_URL, firstParty: true,
      listingComplete: false, indiaFacetCount: unknownCountry.length ? null : indiaRecords,
      verifiedAt: null, reason: reasons.join(';') })
    const evidence = Object.freeze({ observedNativeRecords: opening.size, observedPublicRecords: publicRecords,
      explicitIndiaRecords: indiaRecords, unknownCountryRecords: unknownCountry.length, missingCriteriaRecords: missingCriteria.length,
      unpublishedRecords: unpublished.length, nativeEnumerationComplete: inventory?.listingComplete === true,
      boardIdsMatchApi: boardMatches, outputCapped: capped, sourceScopeComplete: false,
      companyGlobalTotal: null, companyIndiaTotal: null })
    observations.set(output, evidence)
    attachSourceObservationEvidence(output, { source: SOURCE, recordKind: publicRecords === opening.size ? 'vacancy-rows' : 'mixed',
      observedRecordCount: opening.size, observedVacancyCount: publicRecords, sourceScopeComplete: false,
      companyGlobalTotal: null, companyIndiaTotal: null })
    return output
  },
})
