import { setTimeout as wait } from 'node:timers/promises'
import { runApiPortalScraper } from '../../scraper-support/apiPortal/engine.js'
import { expandApiPortalProviderTemplate } from '../../scraper-support/providers/apiPortalTemplates.js'
import { readNativeDocument, extractActiveDescription, decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { toPlainText } from '../../scraper-support/detailExtractors/shared.js'
import { declaresCurrentOpenPositions, verifyCurrentPublisher } from './currentPublisher.js'

export const SOURCE = 'gcore'
export const COMPANY = 'Gcore'
export const CAREERS_URL = 'https://gcore.com/careers'
export const BOARD_URL = 'https://careers.smartrecruiters.com/Gcore'
export const API_URL = 'https://api.smartrecruiters.com/v1/companies/Gcore/postings'
const observations = new WeakMap()
export const readGcoreEvidence = jobs => observations.get(jobs) || null
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const failure = message => Object.assign(new Error('Gcore ' + message), { incompleteScope: true, abortRetries: true })
const children = node => node.children.filter(child => typeof child !== 'string')
const descendants = (node, test) => [...(test(node) ? [node] : []), ...children(node).flatMap(child => descendants(child, test))]
const hasClass = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name)
const publicReference = (value, id) => {
  try {
    const url = new URL(value), parts = url.pathname.split('/').filter(Boolean)
    return url.origin === 'https://jobs.smartrecruiters.com' && !url.username && !url.password
      && parts.length === 2 && parts[0] === COMPANY && (parts[1] === id || parts[1].startsWith(id + '-'))
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

// Only this observed Gcore header's ordinary Toggle-menu/About control can
// explain a collapsed handoff. Inert/template/explicitly hidden markup remains
// excluded by the active reader; this is not a global hidden-link fallback.
const officialControls = (document, target = BOARD_URL) => {
  const toggle = document.nodes(node => node.tag === 'button' && node.attrs['aria-label'] === 'Toggle menu'
    && !Object.hasOwn(node.attrs, 'disabled'))
  const menus = document.nodes(node => node.tag === 'gcore-mobile-menu')
  const candidates = []
  for (const menu of menus) for (const row of descendants(menu, node => hasClass(node, 'gc-mobile-menu__row--expandable'))) {
    const about = descendants(row, node => node.tag === 'button' && hasClass(node, 'gc-mobile-menu__toggle')
      && norm(document.text(node)) === 'About' && !Object.hasOwn(node.attrs, 'disabled'))
    const links = descendants(row, node => node.tag === 'a' && node.attrs.href === target
      && hasClass(node, 'gc-menu-link-item') && node.attrs.role === 'listitem'
      && descendants(node, item => item.tag === 'h3' && norm(document.text(item)) === 'Open positions').length === 1)
    if (about.length === 1) candidates.push(...links)
  }
  if (toggle.length !== 1 || candidates.length !== 1) throw failure('official active navigation handoff identity is unavailable')
  const menu = menus.find(node => descendants(node, child => child === candidates[0]).length === 1)
  const roots = descendants(menu, node => node.tag === 'div' && hasClass(node, 'gc-mobile-menu'))
  const buttons = document.nodes(node => node.tag === 'gcore-mobile-menu-button'
    && descendants(node, child => child === toggle[0]).length === 1)
  if (roots.length !== 1 || buttons.length !== 1) throw failure('official native menu control binding is unavailable')
  return { menu, root: roots[0], button: buttons[0] }
}

// The ordinary browser interaction recorded for this exact control activates
// three native closed/responsive display declarations. Project only those
// declarations; all other author CSS, attributes and ancestors remain intact.
const projectClosedMenuDisplay = (html, { menu, root, button }) => {
  const componentAttrs = node => Object.keys(node.attrs).filter(key => /^_ngcontent-[\w-]+$/.test(key))
  const hostAttrs = componentAttrs(menu), ownAttrs = componentAttrs(root)
  if (hostAttrs.length !== 1 || ownAttrs.length !== 1 || !Object.hasOwn(button.attrs, hostAttrs[0])) return html
  const selectors = ['gcore-mobile-menu[' + hostAttrs[0] + ']', 'gcore-mobile-menu-button[' + hostAttrs[0] + ']',
    '.gc-mobile-menu[' + ownAttrs[0] + ']']
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)]
  const rules = styles.flatMap((style, index) => {
    const css = style[1], depthAt = at => {
      let depth = 0, quote = ''
      for (let cursor = 0; cursor < at; cursor++) {
        const char = css[cursor]
        if (char === '\\') { cursor++; continue }
        if (quote) { if (char === quote) quote = ''; continue }
        if (char === '"' || char === "'") quote = char
        else if (char === '/' && css[cursor + 1] === '*') { const end = css.indexOf('*/', cursor + 2); cursor = end < 0 ? at : end + 1 }
        else if (char === '{') depth++
        else if (char === '}') depth--
      }
      return depth
    }
    return [...css.matchAll(/([^{}]+)\{([^{}]+)\}/g)].map(match => ({ style: index, offset: match.index,
      selector: match[1].trim(), declarations: match[2], depth: depthAt(match.index) }))
  })
  const eligible = new Map()
  for (const [index, selector] of selectors.entries()) {
    const hiding = rules.filter(rule => rule.selector === selector && /\bdisplay\s*:\s*none\b/i.test(rule.declarations))
    if (hiding.length !== 1 || hiding[0].depth !== 0) continue
    const rule = hiding[0]
    if (index < 2) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // The captured native breakpoint supplies the corresponding visible
      // mobile host. An arbitrary conditional hiding declaration is not one.
      const paired = new RegExp('@media\\s*\\(\\s*max-width\\s*:\\s*1175px\\s*\\)\\s*\\{\\s*' + escaped
        + '\\s*\\{\\s*display\\s*:\\s*block\\s*;?\\s*\\}\\s*\\}', 'g')
      if (!/^\s*display\s*:\s*none\s*;?\s*$/i.test(rule.declarations)
        || styles.flatMap(style => [...style[1].matchAll(paired)]).length !== 1) continue
    } else if (!/(?:^|;)\s*display\s*:\s*none\s*(?:;|$)/i.test(rule.declarations)
      || !/(?:^|;)\s*flex-direction\s*:\s*column\s*(?:;|$)/i.test(rule.declarations)
      || !/(?:^|;)\s*position\s*:\s*fixed\s*(?:;|$)/i.test(rule.declarations)) continue
    eligible.set(rule.style + ':' + rule.offset, true)
  }
  let styleIndex = 0
  return html.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (whole, css) => {
    const index = styleIndex++, rewritten = css.replace(/([^{}]+)\{([^{}]+)\}/g, (rule, selector, declarations, offset) =>
      eligible.has(index + ':' + offset) ? selector + '{' + declarations.replace(/(?:^|;)\s*display\s*:\s*none\s*(;|$)/i, '$1') + '}' : rule)
    const start = whole.indexOf('>') + 1
    return whole.slice(0, start) + rewritten + whole.slice(start + css.length)
  })
}

const verifyNavigation = (html, target) => {
  const binding = officialControls(readNativeDocument(html), target)
  officialControls(readVisibleNativeDocument(projectClosedMenuDisplay(html, binding), { strict: true }), target)
  return target
}
export const verifyOfficialHandoff = html => verifyNavigation(html, BOARD_URL)

const verifyBoard = html => {
  const document = readVisibleNativeDocument(html, { strict: true })
  const brand = document.nodes(node => /^h[1-3]$/.test(node.tag) && norm(document.text(node)) === COMPANY)
  const jobs = document.nodes(node => /^h[1-3]$/.test(node.tag) && norm(document.text(node)) === 'Jobs at Gcore')
  const reciprocal = document.nodes(node => node.tag === 'a' && node.attrs.href === CAREERS_URL)
  if (!brand.length || !jobs.length || !reciprocal.length) throw failure('board company/reciprocal handoff identity is unavailable')
  const ids = new Set()
  for (const link of document.nodes(node => node.tag === 'a' && typeof node.attrs.href === 'string')) {
    let url
    try { url = new URL(link.attrs.href) } catch { continue }
    if (url.origin !== 'https://jobs.smartrecruiters.com') continue
    const match = url.pathname.match(/^\/([^/]+)\/(\d+)(?:-[^/]*)?\/?$/)
    if (!match) continue // A talent-community form is not a numeric vacancy.
    if (match[1] !== COMPANY) throw failure('board native URL tenant identity mismatch')
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
  for (const field of ['fullLocation', 'address']) {
    const value = record.location?.[field]
    if (value == null) continue
    if (typeof value !== 'string') return null
    const components = value.split(',').map(norm)
    for (let index = 0; index < components.length; index++) {
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
  return { complete: Boolean(extractActiveDescription(visible)),
    normalized: typeof value !== 'string' ? null : norm(decodeNativeEntities(toPlainText(value))) === visible ? value : visible }
}

const provider = () => {
  const result = expandApiPortalProviderTemplate({ source: SOURCE, companyName: COMPANY, atsPlatform: 'smartrecruiters',
    companyCareerPage: CAREERS_URL, countryFilter: null, scraperTimeoutMs: 120000,
    template: 'smartrecruiters', templateOptions: { companySlug: COMPANY, limit: 100 },
    config: { mapping: { country: 'location.country', jobDescription: 'jobAd.sections.jobDescription.text' },
      pagination: { traversalMode: 'staged-snapshot', maxPages: 20 }, detail: { concurrency: 2 },
      inventoryValidation: { requiredFields: ['id', 'name', 'refNumber', 'company.identifier', 'ref'], uniqueField: 'id' } } })
  // Preserve a received empty JD and its genuine URLs/qualifications. The
  // existing post-map check marks missing descriptions incomplete.
  delete result.config.detail.mapping.jobDescription
  return result
}

export const createGcoreScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText, fetchJson, fetchPage, signal, onAudit } = {}) {
    signal?.throwIfAborted()
    if (maxJobs != null && (!Number.isSafeInteger(maxJobs) || maxJobs < 0)) throw failure('invalid output cap')
    const stop = new AbortController(), deadline = AbortSignal.timeout(120000)
    const lifecycle = AbortSignal.any([stop.signal, deadline, ...(signal ? [signal] : [])])
    let lastStart = 0, queue = Promise.resolve()
    const defaultRead = async (url, options = {}, json, metadata = false) => {
      const requestSignal = options.signal ? AbortSignal.any([lifecycle, options.signal]) : lifecycle
      const slot = queue.then(async () => {
        requestSignal.throwIfAborted()
        const pause = 1000 - (Date.now() - lastStart)
        if (pause > 0) await wait(pause, undefined, { signal: requestSignal })
        requestSignal.throwIfAborted(); lastStart = Date.now()
      })
      queue = slot.catch(() => {})
      await slot
      const attemptSignal = AbortSignal.any([requestSignal, AbortSignal.timeout(15000)])
      const checkAbort = () => {
        lifecycle.throwIfAborted()
        requestSignal.throwIfAborted()
        attemptSignal.throwIfAborted()
      }
      try {
        const response = await fetch(url, { method: 'GET', redirect: 'manual',
          headers: { 'User-Agent': 'Mozilla/5.0', Accept: json ? 'application/json' : 'text/html' }, signal: attemptSignal })
        checkAbort()
        const text = await response.text()
        checkAbort()
        if (response.status !== 200 || /<title[^>]*>\s*(?:Just a moment|Access Denied|Forbidden|Attention Required)/i.test(text)) {
          throw Object.assign(failure('public native access unavailable HTTP ' + response.status), { status: response.status })
        }
        if (text.length > 4000000) throw failure('native response body limit exceeded')
        const value = metadata ? {status:response.status,url:response.url,contentType:response.headers.get('content-type'),body:text}
          : json ? JSON.parse(text) : text
        checkAbort()
        return value
      } catch (error) { checkAbort(); throw error }
    }
    const textReader = fetchText || ((url, options) => defaultRead(url, options, false))
    const jsonReader = fetchJson || ((url, options) => defaultRead(url, options, true))
    const pageReader = fetchPage || ((url, options) => defaultRead(url, options, false, true))
    const guarded = async operation => {
      lifecycle.throwIfAborted()
      try { const value = await operation(); lifecycle.throwIfAborted(); return value }
      catch (error) { if (lifecycle.aborted) throw lifecycle.reason; stop.abort(error); throw error }
    }
    const official = await guarded(() => textReader(CAREERS_URL, { signal: lifecycle }))
    const currentPublisher = declaresCurrentOpenPositions(official)
    const currentPublisherProof = currentPublisher ? {opening:await guarded(() => verifyCurrentPublisher({official,
      readPage:url=>guarded(()=>pageReader(url,{signal:lifecycle})),verifyNavigation})),closing:null} : null
    if (!currentPublisher) verifyOfficialHandoff(official)
    const board = await guarded(() => textReader(BOARD_URL, { signal: lifecycle }))
    const boardIds = verifyBoard(board), opening = new Map(), nativeDetails = new Map(), closingRecords = new Map()
    let listingPhase = 'opening', firstListing = true
    const fetchNativeJson = (url, options = {}) => guarded(async () => {
      const payload = await jsonReader(url, { ...options, signal: options.signal ? AbortSignal.any([lifecycle, options.signal]) : lifecycle })
      if (!payload || typeof payload !== 'object' || payload.error || payload.success === false
        || Array.isArray(payload.errors) && payload.errors.length) throw failure('native upstream contract failed')
      const address = new URL(url)
      if (address.origin !== 'https://api.smartrecruiters.com') throw failure('native API URL identity mismatch')
      if (address.pathname === '/v1/companies/Gcore/postings') {
        if (!Array.isArray(payload.content)) throw failure('native listing array malformed')
        const offset = Number(address.searchParams.get('offset') || 0)
        if (!firstListing && offset === 0) listingPhase = 'closing'
        firstListing = false
        for (const record of payload.content) {
          if (!record || typeof record !== 'object' || !/^\d+$/.test(record.id || '') || record.company?.identifier !== COMPANY
            || record.company?.name !== COMPANY || !norm(record.name) || !norm(record.refNumber)
            || !boardIds.has(record.id)) throw failure('native listing company/role identity disagrees with the bound board')
          assertUrls(record)
          if (listingPhase === 'opening') {
            if (opening.has(record.id)) throw failure('native listing repeated role identity')
            opening.set(record.id, structuredClone(record))
          } else closingRecords.set(record.id, structuredClone(record))
        }
      } else {
        const id = address.pathname.match(/^\/v1\/companies\/Gcore\/postings\/(\d+)$/)?.[1], record = opening.get(id)
        if (!record || payload.id !== id || payload.company?.identifier !== COMPANY || payload.company?.name !== COMPANY
          || norm(payload.name) !== norm(record.name) || payload.refNumber !== record.refNumber) throw failure('native detail company/role identity mismatch')
        assertUrls(payload)
        if (!publicReference(payload.postingUrl, id) || !publicReference(payload.applyUrl, id)) throw failure('native detail public URL identity unavailable')
        for (const field of ['country', 'city', 'region', 'fullLocation', 'address', 'remote', 'hybrid']) {
          if (record.location?.[field] != null && payload.location?.[field] != null
            && norm(String(record.location[field])) !== norm(String(payload.location[field]))) throw failure('native detail country/location identity mismatch')
        }
        nativeDetails.set(id, structuredClone(payload))
      }
      return payload
    })
    const jobs = await runApiPortalScraper({ provider: provider(), fetchJson: fetchNativeJson, signal: lifecycle })
    if (currentPublisher) {
      const closingOfficial = await guarded(() => textReader(CAREERS_URL,{signal:lifecycle}))
      currentPublisherProof.closing = await guarded(() => verifyCurrentPublisher({official:closingOfficial,
        readPage:url=>guarded(()=>pageReader(url,{signal:lifecycle})),verifyNavigation}))
      const closingBoard = await guarded(() => textReader(BOARD_URL,{signal:lifecycle}))
      const closingBoardIds = verifyBoard(closingBoard)
      if (closingBoardIds.size!==boardIds.size || [...boardIds].some(id=>!closingBoardIds.has(id))) throw failure('closing board role identity changed')
    }
    const inventory = readInventoryEvidence(jobs), candidates = [], unknownCountry = [], missingCriteria = [], unpublished = []
    let indiaRecords = 0, publicRecords = 0
    for (const job of jobs) {
      const record = opening.get(String(job.jobId)), detail = nativeDetails.get(String(job.jobId))
      if (!record || !detail) throw failure('mapped native role identity lost')
      const publication = record.visibility === 'PUBLIC' && (detail.visibility == null || detail.visibility === 'PUBLIC')
      if (!publication) unpublished.push(record.id); else publicRecords++
      const listingCountry = nativeCountry(record), detailCountry = nativeCountry(detail)
      const country = listingCountry && detailCountry === listingCountry ? detailCountry : null
      if (!country) unknownCountry.push(record.id)
      if (country === 'IN') indiaRecords++
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
    const reasons = ['gcore-native-board-observation-not-company-completeness',
      ...(inventory?.listingComplete === false ? [inventory.reason] : []),
      ...(!boardMatches ? ['board-listing-scope-unresolved'] : []),
      ...(unknownCountry.length ? ['native-country-unresolved'] : []),
      ...(missingCriteria.length ? ['native-description-unavailable'] : []), ...(capped ? ['output-cap'] : [])]
    attachInventoryEvidence(output, { ...inventory, status: 'discovery-only', surface: API_URL, firstParty: true,
      listingComplete: false, indiaFacetCount: unknownCountry.length ? null : indiaRecords,
      verifiedAt: null, reason: reasons.join(';') })
    const evidence = Object.freeze({ observedNativeRecords: opening.size, observedPublicRecords: publicRecords,
      explicitIndiaRecords: indiaRecords, unknownCountryRecords: unknownCountry.length, missingCriteriaRecords: missingCriteria.length,
      unpublishedRecords: unpublished.length, nativeEnumerationComplete: inventory?.listingComplete === true,
      boardIdsMatchApi: boardMatches, outputCapped: capped, sourceScopeComplete: false,
      companyGlobalTotal: null, companyIndiaTotal: null,
      ...(currentPublisher ? {currentPublisherProof,rawNativeListingRecords:[...opening.values()],
        rawNativeDetailRecords:[...nativeDetails.values()],rawClosingNativeListingRecords:[...closingRecords.values()]} : {}) })
    observations.set(output, evidence)
    if (onAudit) { await guarded(() => onAudit(evidence)) }
    attachSourceObservationEvidence(output, { source: SOURCE, recordKind: publicRecords === opening.size ? 'vacancy-rows' : 'mixed',
      observedRecordCount: opening.size, observedVacancyCount: publicRecords, sourceScopeComplete: false,
      companyGlobalTotal: null, companyIndiaTotal: null })
    return output
  },
})
