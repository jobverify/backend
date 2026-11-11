import { createHash } from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {publishedIndiaLocationFacets,currentWorkdayRoleSnapshot,currentWorkdayListingSnapshot,reviewedWorkdayEmployerDeclaration} from './recruitmentWorkdayContext.js'
import {extractWorkdayJobDetail} from '../detailExtractors/workday.js'
import { readNativeDocument, activeIframeDeclarations, extractActiveDescription, decodeNativeEntities } from './activeNativeHtml.js'
import { normalizeNativeAttributeBoundaries } from './nativeHtmlAttributes.js'
import { identifyPublicAtsBoard } from './publicAtsIdentity.js'
import { createPublishingGapAtsScraper, publicAtsInventoryError } from './publishingGapAts.js'
import { attachInventoryEvidence, readInventoryEvidence } from './inventoryEvidence.js'
import { nativeCountryName } from '../shared/nativeJobPosting.js'
import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { readOracleRecruitment } from './recruitmentOracle.js'
import { recruitmentMicrodataPostings } from './recruitmentMicrodata.js'
import { readKekaRecruitment, readDeclaredKekaWebflowFeed } from './recruitmentKeka.js'
import { literalRecruitmentPageData, phenomRecruitmentLinks, phenomRecruitmentRole, phenomRecruitmentSearch, phenomPublicRole } from './recruitmentPageData.js'
import { recruitmentSuccessFactorsPostings } from './recruitmentSuccessFactors.js'
import { successFactorsUnifiedSearch, readSuccessFactorsUnifiedSearch, successFactorsUnifiedPostings } from './recruitmentSuccessFactorsUnified.js'
import { declaredJibeSearch, readJibeRecruitment } from './recruitmentJibe.js'
import { classifyScraperError } from './failureClassification.js'
import { createRecruitmentObservationAccounting, isRecruitmentIntakeTitle } from './recruitmentObservationAccounting.js'
import { isGreenhouseProspectPost } from './greenhouseProspects.js'
import { readSourceObservationEvidence } from './sourceObservationEvidence.js'
import { readBreezyEmptyState } from './recruitmentBreezyEmptyState.js'
import { activeLeverCareersFeeds } from './activeLeverCareersFeed.js'
import { activeAshbyCareersFeeds } from './activeAshbyCareersFeed.js'
import { declaredRipplingRecruitment, readRipplingRecruitment } from './recruitmentRippling.js'
import { declaredPyjamaRecruitment, readPyjamaRecruitment } from './recruitmentPyjama.js'
import { declaredEightfoldRecruitment, readEightfoldRecruitment } from './recruitmentEightfold.js'
import { declaredEightfoldPcsxRecruitment, readEightfoldPcsxRecruitment } from './recruitmentEightfoldPcsx.js'
import { declaredEightfoldPcsxTwilioRecruitment, readEightfoldPcsxTwilioRecruitment } from './recruitmentEightfoldPcsxTwilio.js'

export const RECRUITMENT_OBSERVATIONS = Symbol.for('jobverify.verified-recruitment-observations')
const sha = value => createHash('sha256').update(value).digest('hex')
const text = value => typeof value === 'string' ? value.trim() : ''
const companyKey = value => text(value).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const career = /careers?|jobs?|vacanc|openings?|open[-_ /]?(?:roles?|positions?)|join[-_ /]?(?:us|(?:our|the)[-_ ]?team)|work[-_ /]?(?:with|for)[-_ /]?us|opportunit/i
const recruitmentNavigation = /recruit|recrut|karrier|stellen|carri[eè]r|empleo|trabaj|trabalh|lavora|採用|求人|채용|招聘|招募|職位|加入我们/i
const asset = /\.(?:avif|webp|png|jpe?g|gif|svg|ico|css|m?js|woff2?|ttf|otf|mp[34]|webm|pdf|zip)$/i
const vendor = /(?:^|\.)(?:myworkdayjobs\.com|myworkdaysite\.com|greenhouse\.io|ashbyhq\.com|lever\.co|smartrecruiters\.com|workable\.com|breezy\.hr|recruitee\.com|teamtailor\.com|bamboohr\.com|applytojob\.com|jobvite\.com|icims\.com|successfactors\.com|successfactors\.eu|jobs2web\.com|oraclecloud\.com|comeet\.com|keka\.com|darwinbox\.in)$/i
// Retain the native references before any caller-supplied fetch hook runs.
const nativeDOMExceptionPrototype = typeof DOMException === 'undefined' ? null : DOMException.prototype
const nativeDOMExceptionName = nativeDOMExceptionPrototype && Object.getOwnPropertyDescriptor(nativeDOMExceptionPrototype, 'name')?.get
const nativeDOMExceptionMessage = nativeDOMExceptionPrototype && Object.getOwnPropertyDescriptor(nativeDOMExceptionPrototype, 'message')?.get
const fail = message => { throw new Error(message) }
const requireValue = (value, message) => { if (!value) fail(message) }
const cleanupRead = operation => { try { void Promise.resolve(operation()).catch(() => {}) } catch {} }
// Abort signals also bound transports and streams which do not implement abort.
// Always observe late settlement, and dispose a late response without waiting
// for cancellation itself to settle.
const waitForRead = (operation, signal, disposeLate) => new Promise((resolve, reject) => {
  let settled = false
  const detach = () => signal.removeEventListener('abort', aborted)
  const aborted = () => {
    if (settled) return
    settled = true; detach(); reject(signal.reason)
  }
  signal.addEventListener('abort', aborted, { once: true })
  if (signal.aborted) { aborted(); return }
  Promise.resolve().then(() => { signal.throwIfAborted(); return operation() }).then(value => {
    if (settled || signal.aborted) {
      aborted()
      if (disposeLate) cleanupRead(() => disposeLate(value, signal.reason))
      return
    }
    settled = true; detach(); resolve(value)
  }, error => {
    if (settled) return
    if (signal.aborted) { aborted(); return }
    settled = true; detach(); reject(error)
  })
})
const diagnosticValue = (value, key) => {
  const original = value
  try {
    for (let depth = 0; value && typeof value === 'object' && depth < 4; depth++, value = Object.getPrototypeOf(value)) {
      const getter = key === 'name' ? nativeDOMExceptionName : key === 'message' ? nativeDOMExceptionMessage : null
      if (value === nativeDOMExceptionPrototype && getter) return getter.call(original)
      const property = Object.getOwnPropertyDescriptor(value, key)
      if (property) return property.value
    }
  } catch {}
}
const diagnosticUrl = value => {
  if (typeof value !== 'string') return null
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? (url.origin + url.pathname).slice(0, 200) : null } catch { return null }
}
const diagnosticMessage = value => {
  if (typeof value !== 'string') return 'Unknown source failure'
  const message = value.slice(0, 4096)
  if (/<[a-z!/]/i.test(message) || /(?:\{|\[)\s*(?:"|\{|\[)/.test(message)) return 'Source failure details omitted'
  return message.replace(/https?:\/\/[^\s"'<>]+/gi, url => diagnosticUrl(url) || '[url]')
    .replace(/\b(?:Bearer|Basic)\s+\S+/gi, '[redacted]')
    .replace(/(["']?)\b(?:authorization|cookie|set-cookie|password|secret|api[-_]?key|(?:(?:access|refresh|id)[-_]?)?token)\1\s*[:=]\s*(?:"(?:\\.|[^"\\])*(?:"|$)|'(?:\\.|[^'\\])*(?:'|$)|[^\s,;}]+)/gi, '[redacted]')
    .replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180) || 'Unknown source failure'
}
const diagnosticError = (original, depth = 0, seen = new Set()) => {
  if (depth >= 4 || seen.has(original)) return undefined
  seen.add(original)
  const error = new Error(diagnosticMessage(typeof original === 'string' ? original : diagnosticValue(original, 'message')))
  const name = diagnosticValue(original, 'name'), code = diagnosticValue(original, 'code')
  if (typeof name === 'string' && /^[A-Za-z][A-Za-z0-9_.]{0,63}$/.test(name)) error.name = name
  if (typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code)) error.code = code
  const status = diagnosticValue(original, 'status') ?? diagnosticValue(original, 'statusCode')
    ?? diagnosticValue(diagnosticValue(original, 'response'), 'status')
  if (['number', 'string'].includes(typeof status) && /^[1-5]\d\d$/.test(String(status))) error.status = Number(status)
  const requestUrl = diagnosticUrl(diagnosticValue(original, 'requestUrl'))
  if (requestUrl) error.requestUrl = requestUrl
  const cause = diagnosticValue(original, 'cause')
  if (cause != null) error.cause = diagnosticError(cause, depth + 1, seen)
  return error
}
const diagnosticChain = error => {
  const chain = []
  for (let current = error; current && chain.length < 4; current = current.cause) chain.push(current)
  return chain
}
const diagnosticSignal = error => {
  const chain = diagnosticChain(error)
  return { status: chain.find(item => item.status != null)?.status, code: chain.find(item => item.code)?.code }
}
const failureDiagnostic = (stage, error) => {
  const chain = diagnosticChain(error), { status, code } = diagnosticSignal(error)
  return { stage, message: error.message, name: error.name,
    ...(error.requestUrl ? { requestUrl: error.requestUrl } : {}),
    ...(status != null ? { status } : {}), ...(code ? { code } : {}),
    ...(chain.length > 1 ? { causes: chain.slice(1).map(item => ({
      name: item.name, message: item.message, ...(item.status != null ? { status: item.status } : {}), ...(item.code ? { code: item.code } : {}),
    })) } : {}) }
}
const failureSummary = failures => failures.slice(0, 3).map(failure => [
  failure.stage, failure.status != null ? 'HTTP ' + failure.status : null, failure.code,
  failure.requestUrl, failure.message,
  ...(failure.causes || []).map(cause => [cause.code, cause.status != null ? 'HTTP ' + cause.status : null, cause.message].filter(Boolean).join(' ')),
].filter(Boolean).join(' ')).join(' | ')
const addFailureDiagnostics = (error, causes, failures, receipts) => {
  if (causes.length) error.cause = causes[0]
  // A successful response can still leave scope unknown. Optional failures and
  // ambiguous failure classes must not turn that semantic gap into an outage.
  const classifications = causes.map(classifyScraperError), first = classifications[0]
  if (!receipts.some(receipt => receipt.status === 200) && first
    && ['blocked_or_access_denied', 'network_or_timeout'].includes(first.failureKind)
    && classifications.every(item => item.failureKind === first.failureKind)) {
    Object.assign(error, first)
    const signals = causes.map(diagnosticSignal)
    for (const key of ['status', 'code']) if (signals[0][key] != null && signals.every(item => item[key] === signals[0][key])) error[key] = signals[0][key]
  }
  const summary = failureSummary(failures)
  if (summary) error.message = (error.message + '; failures=' + failures.length + ': ' + summary).slice(0, 1600)
}
const https = value => {
  let url
  try { url = new URL(value) } catch { return null }
  return url.protocol === 'https:' && !url.username && !url.password && !url.port
    && !/^localhost$|\.localhost$|\.local$|^\[|^\d+(?:\.\d+){3}$/i.test(url.hostname) ? url : null
}
const pathKey = url => url.pathname.replace(/\/+$/, '') || '/'
const samePage = (a, b) => a.origin === b.origin && pathKey(a) === pathKey(b) && a.search === b.search
const country = value => {
  if (Array.isArray(value)) return value.length === 1 ? country(value[0]) : null
  const labels = typeof value === 'object' ? [value?.name, value?.descriptor, value?.alpha2Code] : [value]
  const countries = [...new Set(labels.map(label => nativeCountryName(label)
    || (typeof label === 'string' && /^(?:United States of America|USA)$/i.test(label.trim()) ? 'United States' : null)
    || (typeof label === 'string' && /^IND$/i.test(label.trim()) ? 'India' : null)).filter(Boolean))]
  requireValue(countries.length <= 1, 'Contradictory native country labels')
  return countries[0] || null
}
const asArray = value => value == null ? [] : Array.isArray(value) ? value : [value]
const workdayListingHasRequisition = (row, id, allowBulletMatch = true) => {
  if (!text(id)) return false
  if (allowBulletMatch && asArray(row.bulletFields).some(value => value === id)) return true
  let pathname
  try { pathname = decodeURIComponent(row.externalPath) } catch { return false }
  if (pathname.split('/').at(-1) === id) return true
  const suffix = '_' + id, index = pathname.lastIndexOf(suffix)
  // Workday keeps numbered URL copies when the same requisition is reposted.
  return index >= 0 && /^(?:-\d+)?$/.test(pathname.slice(index + suffix.length))
}
const legalName = value => text(value).replace(/^\d{1,8}\s+/, '').replace(/^the\s+/i, '')
  .replace(/(?:[\s,.]+(?:private\s+limited|pvt\.?\s+ltd\.?|p\.?\s?ltd\.?|incorporated|corporation|limited|company|ltd\.?|inc\.?|corp\.?|llc|llp|plc|gmbh|s\.?a\.?s\.?|s\.?a\.?|a\.?g\.?|s\.?e\.?))+\s*$/i, '').trim()

export function recruitmentEmployerMatches(config, value) {
  if (typeof value !== 'string' || !value.trim()) return false
  const expected = [config.companyName, ...(config.nativeEmployerNames || [])].filter(Boolean)
  if (expected.some(name => companyKey(name) === companyKey(value))) return true
  if (config.requireNativeEmployerName) return false
  const native = companyKey(legalName(value).replace(/\s+India$/i, ''))
  if (native.length < 3) return false
  if (expected.some(name => companyKey(legalName(name).replace(/\s+India$/i, '')) === native)) return true
  const domain = text(config.companyDomain).replace(/^www\./, '').toLowerCase()
  return Boolean(domain && value.trim().toLowerCase() === domain)
}

export function recruitmentJobPostings(document) {
  const postings = []
  const visit = (item, depth = 0) => {
    if (!item || depth > 12) return
    if (Array.isArray(item)) { for (const row of item.slice(0, 2000)) visit(row, depth + 1); return }
    if (typeof item !== 'object') return
    if (asArray(item['@type']).some(type => type === 'JobPosting' || type === 'https://schema.org/JobPosting')) postings.push(item)
    for (const field of ['@graph', 'itemListElement', 'item', 'mainEntity']) visit(item[field], depth + 1)
  }
  for (const node of document.nodes(node => node.tag === 'script' && !node.attrs.src && node.attrs.type === 'application/ld+json')) {
    try { visit(JSON.parse(node.raw || '')) } catch { /* Invalid schema is not evidence of an empty inventory. */ }
  }
  return postings
}

export function recruitmentBoard(value) {
  const url = https(value)
  if (!url) return null
  const publicBoard = identifyPublicAtsBoard(url.href)
  if (publicBoard) return { kind: publicBoard.atsPlatform, token: publicBoard.boardToken,
    region: publicBoard.region || 'global', url: url.href }
  const parts = url.pathname.split('/').filter(Boolean)
  const workday = url.hostname.match(/^([a-z\d-]+)\.wd\d+\.myworkdayjobs\.com$/i)
  if (workday) {
    if (/^[a-z]{2}-[a-z]{2}$/i.test(parts[0] || '')) parts.shift()
    if (parts[0] && /^[a-z\d_-]{1,120}$/i.test(parts[0])) return {
      kind: 'workday', tenant: workday[1], site: parts[0], origin: url.origin,
      url: `${url.origin}/${encodeURIComponent(parts[0])}`,
    }
  }
  if (/^wd\d+\.myworkdaysite\.com$/i.test(url.hostname)) {
    if (/^[a-z]{2}-[a-z]{2}$/i.test(parts[0] || '')) parts.shift()
    if (parts[0]?.toLowerCase() === 'recruiting' && /^[a-z\d_-]{1,120}$/i.test(parts[1] || '')
      && /^[a-z\d_-]{1,120}$/i.test(parts[2] || '')) {
      return { kind: 'workday', tenant: parts[1], site: parts[2], origin: url.origin,
        url: `${url.origin}/recruiting/${parts[1]}/${parts[2]}` }
    }
  }
  if (['careers.smartrecruiters.com', 'jobs.smartrecruiters.com'].includes(url.hostname)
    && /^[a-z\d_.-]{1,120}$/i.test(parts[0] || '')) return { kind: 'smartrecruiters', token: parts[0], url: url.href }
  if (url.hostname === 'apply.workable.com' && /^[a-z\d_-]{1,120}$/i.test(parts[0] || '')
    && !['api', 'j'].includes(parts[0].toLowerCase())) {
    return { kind: 'workable', token: parts[0], url: `${url.origin}/${parts[0]}/` }
  }
  if (/^\/hcmUI\/CandidateExperience\//i.test(url.pathname)) {
    const match = url.pathname.match(/^\/hcmUI\/CandidateExperience\/([a-z-]{2,12})\/sites\/([a-z\d_-]{1,120})(?:\/|$)/i)
    if (match) return { kind: 'oracle', siteAlias: match[2], url: `${url.origin}/hcmUI/CandidateExperience/${match[1]}/sites/${match[2]}` }
  }
  if (/^[a-z\d-]+\.keka\.com$/i.test(url.hostname)) {
    const embedded = url.pathname.match(/^\/careers\/api\/embedjobs\/(js\/)?([a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})\/?$/i)
    if (embedded && !url.search) return { kind: 'keka', url: url.href, identifier: embedded[2], mode: embedded[1] ? 'script' : 'iframe' }
    if (/^\/careers\/?$/.test(url.pathname) && !url.search) return { kind: 'keka', url: url.href, mode: 'portal' }
  }
  return null
}

export function recruitmentIndiaFacet(payload, { allowPublishedCountryFacets = false } = {}) {
  const matches = new Map()
  const visit = (node, depth = 0) => {
    if (!node || depth > 8 || typeof node !== 'object') return
    const parameter = text(node.facetParameter)
    const isCountryFacet = parameter === 'locationCountry' || allowPublishedCountryFacets
      && (/^(?:country|country_and_jurisdiction)$/i.test(parameter)
        || /^(?:location country|country|country and jurisdiction)$/i.test(text(node.descriptor)))
    if (isCountryFacet && /^[a-z\d_-]{1,128}$/i.test(parameter) && Array.isArray(node.values)) {
      for (const value of node.values) if (value?.descriptor === 'India') {
        requireValue(typeof value.id === 'string' && /^[a-z\d_-]{1,128}$/i.test(value.id)
          && Number.isSafeInteger(value.count) && value.count >= 0, 'Invalid native India country facet')
        const key = parameter + ':' + value.id
        if (matches.has(key)) requireValue(matches.get(key).count === value.count, 'Contradictory native India country facet')
        matches.set(key, { id: value.id, descriptor: value.descriptor, count: value.count, facetParameter: parameter })
      }
    }
    for (const child of asArray(node.values).slice(0, 2000)) if (child?.facetParameter) visit(child, depth + 1)
  }
  for (const facet of asArray(payload?.facets).slice(0, 100)) visit(facet)
  requireValue(matches.size <= 1, 'Ambiguous native India country facet')
  return [...matches.values()][0] || null
}

const closed = (value, now) => {
  if (!text(value)) return false
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value < now.slice(0, 10)
  const time = Date.parse(value)
  return Number.isFinite(time) && time < Date.parse(now)
}
const sourceDescription = value => {
  const description = extractActiveDescription(value)
  return description && description.length >= 100 ? value : null
}

// A reviewed employer declaration in this role's own native description can
// supply an organization name when the native structured name is blank.
// Quoted, sample, hidden and inert text never supplies that declaration.
const roleEmployerStatement = (description, contract) => {
  const name = text(contract?.name), prefix = text(contract?.prefix).replace(/\s+/g, ' ')
  if (!name || !prefix.toLowerCase().startsWith(name.toLowerCase() + ' ')) return null
  let document
  try { document = readNativeDocument(normalizeNativeAttributeBoundaries(description)) } catch { return null }
  const blocked = new Set(['blockquote', 'q', 'pre', 'code', 'script', 'style', 'template', 'aside', 'object', 'iframe', 'noscript'])
  const ownText = node => node.inert || blocked.has(node.tag) ? '' : node.children.map(child => typeof child === 'string' ? child : ownText(child)).join(' ')
  let matched = null
  const visit = node => {
    if (node.inert || blocked.has(node.tag)) return
    if (['p', 'div', 'li'].includes(node.tag) || node.tag === 'root' && node.children.every(child => typeof child === 'string')) {
      const content = decodeNativeEntities(ownText(node)).replace(/\s+/g, ' ').trim()
      if (content.toLowerCase().startsWith(prefix.toLowerCase())) matched = { name: content.slice(0, name.length), statement: content.slice(0, prefix.length) }
    }
    for (const child of node.children) if (typeof child !== 'string') visit(child)
  }
  visit(document.nodes(node => node.tag === 'root')[0])
  return matched
}

function project(config, native, observedAt) {
  const location = native.location || 'India'
  const city = !native.city && /^India$/i.test(location.trim()) ? null : getValidIndiaCityForJob({ country: 'India', location, city: native.city || null })
  return {
    source: config.source, company: config.companyName, jobId: String(native.id), title: native.title,
    location, country: 'India', city, applyUrl: native.applyURL || native.url, sourceUrl: native.url, link: native.url,
    sourceDescription: native.description, jobDescription: native.description,
    postingDate: native.posted || null, postedAt: native.posted || null,
    closingDate: native.closing || null, employmentType: native.employmentType || null,
    ...(Object.hasOwn(native, 'remoteStatus') ? { remoteStatus: native.remoteStatus } : {}),
    ...(native.sourceRemoteStatusUnresolved === true ? { sourceRemoteStatusUnresolved: true } : {}),
    ...(native.sourcePublicationDateUnavailable === true ? { sourcePublicationDateUnavailable: true } : {}),
    nativeHiringOrganization: native.employer || null, nativeSourceRecord: native.record,
    ...(native.employerRecord ? {nativeHiringOrganizationRecord:native.employerRecord} : {}),
    ...(native.legalEmployer === null ? {nativeLegalEmployer:null} : {}),
    ...(native.employerBinding ? { nativeEmployerBinding: native.employerBinding } : {}),
    nativePostingDate: native.posted || null, scrapedAt: observedAt,
    sourceDetailComplete: true, sourceScopeComplete: false, sourceListingComplete: false,
    lifecycleCleanupAllowed: false, applicationVisited: false,
  }
}

export function createVerifiedRecruitmentScraper(config) {
  return { async run(options = {}) {
    const root = https(config.companyCareerPage)
    const homepage = https(config.officialHomepageUrl || (config.companyDomain ? `https://${config.companyDomain}/` : ''))
    requireValue(text(config.source) && text(config.companyName) && (root || homepage), 'A registered source and official HTTPS surface are required')
    const maxRequests = options.maxRequests ?? 48, maxPages = options.maxPages ?? 8, maxDetails = options.maxDetails ?? 20
    const sourceTimeoutMs = options.sourceTimeoutMs ?? 90000
    const requestIntervalMs=options.requestIntervalMs??config.nativeRequestIntervalMs??0,lastRequest=new Map()
    requireValue(Number.isSafeInteger(requestIntervalMs)&&requestIntervalMs>=0&&requestIntervalMs<=60000
      &&(!(config.nativeRequestIntervalMs>0)||requestIntervalMs>=config.nativeRequestIntervalMs||options.fetchImpl||options.fetchPage||options.fetchJson),
    'Invalid native public request pacing')
    for (const [name, value, maximum] of [['maxRequests', maxRequests, 128], ['maxPages', maxPages, 24], ['maxDetails', maxDetails, 80], ['sourceTimeoutMs', sourceTimeoutMs, 180000]]) {
      requireValue(Number.isSafeInteger(value) && value > 0 && value <= maximum, 'Invalid recruitment limit: ' + name)
    }
    options.signal?.throwIfAborted()
    const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(sourceTimeoutMs)])
    const now = options.now ? options.now() : new Date().toISOString()
    requireValue(Number.isFinite(Date.parse(now)), 'Invalid observation time')
    const hosts = [...new Set([root, homepage].filter(url => url && !vendor.test(url.hostname)).map(url => url.hostname.replace(/^www\./, '')))]
    const official = url => hosts.some(host => url.hostname === host || url.hostname.endsWith('.' + host))
    const grants = [], receipts = [], failures = [], failureCauses = [], jobs = [], seenJobs = new Set(), boards = new Map(), queue = []
    const identifiedCompanyHosts = new Set()
    const phenomSearches = new Map()
    const unifiedSearchOrigins = new Set(), nativeSearchCandidates = new Map()
    const jibeSearchOrigins = new Set()
    const ripplingFeeds = new Set()
    const pyjamaBoards = new Set()
    const eightfoldPages = new Map(), eightfoldBindings = new Map()
    const currentBreezyBindings = new Map()
    const declaredCompanyRolePages = new Set()
    const observed = { source: config.source, observedAt: now, requestCount: 0, nativeRecords: 0, returnedIndiaJobs: 0,
      unresolved: [], exclusions: [], nativeInventoryReads: [], sourceScopeComplete: false, lifecycleCleanupAllowed: false, receipts, failures }
    const observationAccounting = createRecruitmentObservationAccounting(config.source)
    const nativeBoards = []
    const observeNative = row => {
      if (!observationAccounting.observe(row)) observed.unresolved.push('native-observation-identity-unavailable')
    }
    const observePhenom = (row, surface, refNum) => observeNative({ scope: 'phenom:' + new URL(surface).origin + ':' + refNum,
      id: row.jobId, title: row.title, url: row.applyUrl })
    const observeWorkday = (row, prefix, board) => {
      const path = typeof row?.externalPath === 'string' && /^\/job\/[^?#]+$/.test(row.externalPath) ? row.externalPath : null
      const requisitions = path ? asArray(row.bulletFields).filter(id => text(id) && workdayListingHasRequisition(row, id, false)) : []
      observeNative({ scope: 'workday:' + prefix, id: requisitions.length === 1 ? requisitions[0] : path,
        title: row?.title, url: path ? board.url + path : null })
    }
    const matchingEmployer = name => recruitmentEmployerMatches(config, name)
    const matchingPublisher = name => [config.companyName, ...(config.publisherNames || [])].some(value => {
      const key = companyKey(legalName(value))
      return key.length >= 3 && companyKey(name).includes(key)
    })
    const matchingRedirectPublisher = name => {
      const expected = [config.companyName, ...(config.publisherNames || [])].map(value => companyKey(legalName(value))).filter(value => value.length >= 3)
      return text(name).split(/\s*\|\s*|\s+[-–—]\s+/).some(part => {
        const key = companyKey(legalName(part.replace(/^(?:home|careers? at|jobs? at|welcome to)\s*:?\s+/i, '').replace(/\s+(?:careers?|jobs?)$/i, '')))
        return expected.includes(key)
      })
    }
    let aggregateBytes = 0
    const cache = new Map()
    const permit = (value, methods = ['GET']) => {
      const url = https(value); requireValue(url, 'Invalid delegated recruitment URL')
      const prefix = pathKey(url)
      grants.push({ origin: url.origin, prefix, methods })
      return url
    }
    const allowed = (url, method = 'GET') => official(url) && method === 'GET'
      || grants.some(grant => url.origin === grant.origin && (grant.prefix === '/' && (config.prioritizeRecruitmentSearch || vendor.test(url.hostname))
        || pathKey(url) === grant.prefix || url.pathname.startsWith(grant.prefix + '/')) && grant.methods.includes(method))
    const read = async (value, init = {}, format = 'page') => {
      signal.throwIfAborted()
      const url = https(value), method = init.method || 'GET'
      const jsonFormat = format === 'json' || format === 'json-text'
      requireValue(url && allowed(url, method), 'Unbound recruitment request refused')
      const key = method + ':' + url.href + ':' + (init.body || '')
      if (method === 'GET' && init.cache !== 'no-store' && cache.has(key)) return cache.get(key)
      const task = (async () => {
        requireValue(++observed.requestCount <= maxRequests, 'Recruitment request budget reached')
        requireValue(format !== 'json-text' || !options.fetchJson || options.fetchImpl,
          'Original native JSON requires raw response text; a parsed JSON hook cannot supply it')
        const wait=requestIntervalMs-(Date.now()-(lastRequest.get(url.origin)||0))
        if(wait>0)await delay(wait,undefined,{signal})
        lastRequest.set(url.origin,Date.now())
        let response
        if (!jsonFormat && options.fetchPage) {
          const page = await waitForRead(() => options.fetchPage(url.href, { signal }), signal)
          response = { ...page, contentType: page.contentType || 'text/html', body: page.html }
        } else if (format === 'json' && options.fetchJson) {
          const payload = await waitForRead(() => options.fetchJson(url.href, { ...init, signal }), signal)
          response = { status: 200, url: url.href, contentType: 'application/json', body: JSON.stringify(payload) }
        } else {
          const timeout = AbortSignal.any([signal, AbortSignal.timeout(15000)])
          const raw = await waitForRead(() => (options.fetchImpl || globalThis.fetch)(url.href, { ...init, method,
            redirect: jsonFormat ? 'error' : 'follow', credentials: 'omit', signal: timeout,
            headers: { Accept: jsonFormat ? 'application/json' : 'text/html', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify careers inventory check)', ...init.headers } }),
          timeout, (late, reason) => late?.body?.cancel(reason))
          let reader
          const chunks = []; let bytes = 0
          try {
            requireValue(Number(raw.headers.get('content-length')) <= 4e6, 'Recruitment response body exceeds its limit')
            reader = raw.body?.getReader()
            requireValue(reader, 'Missing recruitment response body')
            for (;;) { const item = await waitForRead(() => reader.read(), timeout); timeout.throwIfAborted(); if (item.done) break
              bytes += item.value.byteLength; requireValue(bytes <= 4e6, 'Recruitment response body exceeds its limit'); chunks.push(Buffer.from(item.value)) }
          } finally {
            if (reader) {
              cleanupRead(() => reader.cancel(timeout.aborted ? timeout.reason : undefined))
              cleanupRead(() => reader.releaseLock())
            } else cleanupRead(() => raw.body?.cancel(timeout.aborted ? timeout.reason : undefined))
          }
          response = { status: raw.status, url: raw.url, contentType: raw.headers.get('content-type') || '', body: Buffer.concat(chunks).toString('utf8') }
        }
        signal.throwIfAborted()
        const final = https(response.url)
        const body = response.body
        requireValue(typeof body === 'string' && Buffer.byteLength(body) <= 4e6, 'Missing or oversized recruitment body')
        if (final && !allowed(final, method) && config.allowVerifiedCorporateRedirects && format === 'page' && method === 'GET'
          && official(url) && ([root, homepage].some(entry => entry && samePage(entry, url))
            || declaredCompanyRolePages.has(url.href) && career.test(url.pathname))
          && response.status === 200 && /(?:text\/html|application\/xhtml\+xml)/i.test(response.contentType)) {
          const board = recruitmentBoard(final.href)
          let publisher
          if (!board) {
            const document = readNativeDocument(normalizeNativeAttributeBoundaries(body))
            publisher = document.nodes(node => ['title', 'h1'].includes(node.tag)).map(node => node.tag === 'title'
              ? decodeNativeEntities(node.raw || '') : document.text(node)).find(matchingRedirectPublisher)
          }
          if (board || publisher) {
            permit(final.href)
            if (board) bind(final.href, url.href, true)
            else hosts.push(final.hostname.replace(/^www\./, ''))
            observed.verifiedCorporateRedirects ||= []
            observed.verifiedCorporateRedirects.push({ requestedURL: url.href, finalURL: final.href,
              method: board ? 'registered-corporate-surface-native-account-redirect' : 'current-same-publisher-corporate-redirect',
              ...(publisher ? { publisher } : {}) })
          }
        }
        // Oracle can retire a site alias while the current corporate careers
        // link still advertises it. Only that live handoff, the same tenant,
        // an exact current publisher and a self-consistent native base can
        // qualify the redirect. No alternate site or endpoint is guessed.
        if (final && !allowed(final, method) && config.allowVerifiedCorporateRedirects
          && format === 'page' && method === 'GET' && response.status === 200
          && /(?:text\/html|application\/xhtml\+xml)/i.test(response.contentType)) {
          const bound = [...boards.values()].find(board => board.kind === 'oracle'
            && board.bindingEvidence?.verified === true
            && ['runtime-current-careers-link', 'runtime-current-native-candidate-site',
              'registered-corporate-surface-native-account-redirect'].includes(board.bindingEvidence.bindingMethod)
            && samePage(new URL(board.url), url))
          const redirected = recruitmentBoard(final.href)
          if (bound && redirected?.kind === 'oracle' && final.origin === url.origin
            && /^[a-z\d-]+\.fa\.[a-z\d-]+\.oraclecloud\.com$/i.test(final.hostname)
            && samePage(new URL(redirected.url), final) && !final.hash) {
            const document = readNativeDocument(normalizeNativeAttributeBoundaries(body))
            const bases = document.nodes(node => node.tag === 'base')
            const publisher = document.nodes(node => ['title', 'h1'].includes(node.tag)).map(node => node.tag === 'title'
              ? decodeNativeEntities(node.raw || '') : document.text(node)).find(matchingRedirectPublisher)
            if (bases.length === 1 && publisher) {
              let nativeBase
              try { nativeBase = https(new URL(bases[0].attrs.href, final).href) } catch {}
              const api = https(bases[0].attrs['data-apibaseurl'])
              if (nativeBase && samePage(nativeBase, final) && !nativeBase.hash
                && bases[0].attrs['data-sitenumber'] === redirected.siteAlias
                && api?.origin === final.origin && pathKey(api) === '/' && !api.search && !api.hash) {
                permit(final.href)
                bound.nativeSiteRedirect = { requestedURL: url.href, finalURL: final.href, publisher,
                  method: 'current-corporate-handoff-and-native-oracle-site-alias', bodySHA256: sha(body) }
                observed.nativeCandidateSiteRedirects ||= []
                observed.nativeCandidateSiteRedirects.push(bound.nativeSiteRedirect)
              }
            }
          }
        }
        requireValue(final && allowed(final, method), 'Recruitment redirect changed authority')
        requireValue(!jsonFormat || final.href === url.href, 'Native API changed response identity')
        aggregateBytes += Buffer.byteLength(body); requireValue(aggregateBytes <= 24e6, 'Recruitment aggregate byte budget reached')
        receipts.push({ requestedURL: url.href, finalURL: final.href, status: response.status, format,
          bodyBytes: Buffer.byteLength(body), bodySHA256: sha(body) })
        if (response.status !== 200) throw Object.assign(new Error('Recruitment HTTP ' + response.status), {
          status: response.status, code: 'RECRUITMENT_HTTP_ERROR',
        })
        const publisherHTML = typeof config.readCurrentPublisherDeclaration === 'function'
          && (format === 'publisher-page' || format === 'page' && root && url.href === root.href)
        requireValue(publisherHTML ? ['text/html', 'application/xhtml+xml']
          .includes((response.contentType || '').split(';')[0].trim().toLowerCase())
          : jsonFormat ? /(?:application|text)\/(?:[a-z.+-]*\+)?json\b/i.test(response.contentType)
          : format === 'publisher-script' ? ['application/javascript', 'text/javascript', 'application/ecmascript', 'text/ecmascript']
            .includes((response.contentType || '').split(';')[0].trim().toLowerCase())
            : format === 'renderer' ? /(?:text\/(?:html|js)\b|application\/xhtml\+xml|(?:application|text)\/(?:java|ecma)script)/i.test(response.contentType)
            : /(?:text\/html|application\/xhtml\+xml)/i.test(response.contentType), 'Unexpected recruitment response type')
        if (!jsonFormat && /<title\b[^>]*>\s*Forbidden Access\s*<\/title>/i.test(body)) {
          const denied = readNativeDocument(normalizeNativeAttributeBoundaries(body))
          requireValue(!denied.nodes(node => (node.attrs.class || '').split(/\s+/).includes('status-code')
            && /^FORBIDDEN ACCESS$/i.test(denied.text(node))).length, 'Recruitment access denied by the public publisher')
        }
        return format === 'json' ? JSON.parse(body) : format === 'json-text'
          ? { url: final.href, status: 200, text: body } : { url: final.href, status: 200, html: body }
      })().catch(error => {
        signal.throwIfAborted()
        const bounded = diagnosticError(error)
        bounded.requestUrl = diagnosticUrl(url.href)
        throw bounded
      })
      if (method === 'GET' && init.cache !== 'no-store') cache.set(key, task)
      return task
    }
    const readJson = (url, init) => read(url, init, 'json')
    const readNativeJson = (url, init = {}) => {
      requireValue(!init.method || init.method === 'GET', 'Native Eightfold models require a public GET')
      return read(url, { ...init, cache: 'no-store' }, 'json-text')
    }
    const problem = (stage, error) => {
      signal.throwIfAborted()
      const bounded = diagnosticError(error)
      failureCauses.push(bounded)
      failures.push(failureDiagnostic(stage, bounded))
    }
    const phenomNativeIdentities = new Map()
    const excludeNativeIntake = (title, url, record) => {
      if (!isRecruitmentIntakeTitle(title)) return false
      observed.exclusions.push({ reason: 'native-generic-intake', url, nativeSourceRecord: record })
      return true
    }
    const addJob = native => {
      if (config.nativeOracleCandidateSite && native.record?.publicRoleRoute !== config.nativeOracleCandidateSite) {
        observed.unresolved.push('native-role-outside-reviewed-Oracle-site'); return
      }
      if (native.heldStatuses?.length) {
        observed.exclusions.push({reason:'native-role-on-hold',url:native.url,nativeStatuses:native.heldStatuses}); return
      }
      const blankEmployer = native.employer == null || typeof native.employer === 'object' && !Array.isArray(native.employer)
        && Object.keys(native.employer).every(key => ['name', 'url'].includes(key))
        && [native.employer.name, native.employer.url].every(value => value == null || typeof value === 'string' && !value.trim())
      if (blankEmployer && matchingEmployer(config.nativeEmployerStatement?.name) && sourceDescription(native.description)) {
        const statement = roleEmployerStatement(native.description, config.nativeEmployerStatement)
        if (statement) native = { ...native, employer: { name: statement.name },
          employerBinding: { method: 'explicit-native-role-employer-statement', field: 'description',
            statement: statement.statement, surface: native.url, legalEmployer: null } }
      }
      if (!matchingEmployer(native.employer?.name) && !(native.employerBinding && !config.requireNativeEmployerName)) { observed.unresolved.push('native-employer-mismatch'); return }
      if (!sourceDescription(native.description)) { observed.unresolved.push('native-full-description-unavailable'); return }
      if (closed(native.closing, now)) return
      const url = https(native.url)
      if (!url || !allowed(url)) { observed.unresolved.push('native-role-url-unbound'); return }
      if (excludeNativeIntake(native.title, url.href, native.record)) return
      if(config.deduplicatePhenomNativeIds===true&&native.record?.uniqueValue?.refNum&&native.record.uniqueValue.jobId===native.id){
        const key=native.record.uniqueValue.refNum+':'+native.id
        const signature=JSON.stringify({title:native.title,employer:native.employer?.name,descriptionSHA256:sha(native.description),
          country:native.record.country,location:native.location,posted:native.posted,closing:native.closing})
        if(phenomNativeIdentities.has(key)){
          if(phenomNativeIdentities.get(key)!==signature)observed.unresolved.push('native-phenom-repeated-role-content-changed')
          return
        }
        phenomNativeIdentities.set(key,signature)
      }
      const identity = String(native.id) + ':' + url.href
      if (seenJobs.has(identity)) return
      seenJobs.add(identity); jobs.push(project(config, native, now))
    }
    const bind = (value, officialURL, declaredExternal = false, bindingMethod = 'runtime-current-careers-link', publisherDeclaration = null) => {
      const url = https(value); if (!url) return
      const bindingPage = https(officialURL)
      if (declaredExternal && bindingMethod === 'runtime-current-careers-link'
        && /^[a-z\d-]+\.breezy\.hr$/i.test(url.hostname) && url.pathname === '/' && !url.search && !url.hash
        && bindingPage && official(bindingPage)) currentBreezyBindings.set(url.origin, {
          verified: true, checkedAt: now, officialURL, matchedLinks: [url.href], bindingMethod,
        })
      const board = recruitmentBoard(url.href)
      const key = board ? board.kind + ':' + (board.token || board.url) : url.origin + ':' + pathKey(url)
      if (board && !boards.has(key)) boards.set(key, { ...board, bindingEvidence: {
        verified: true, checkedAt: now, officialURL, matchedLinks: [url.href], bindingMethod,
        ...(publisherDeclaration ? { publisherDeclaration: { context: publisherDeclaration.context, evidence: publisherDeclaration.evidence } } : {}),
      } })
      if (board?.kind === 'oracle' && /\/sites\/[^/]+\/jobs?\/[^/]+/i.test(url.pathname)) { permit(url); queue.push(url.href) }
      if (!board && (vendor.test(url.hostname) || config.allowDeclaredExternalCareersPages && declaredExternal)) { permit(url); queue.push(url.href) }
    }
    const declaredWorkdayBoard = value => {
      const url = https(value), board = url && recruitmentBoard(url.href)
      requireValue(board?.kind === 'workday' && url.href === board.url && !url.search && !url.hash
        && board.origin === config.nativeWorkdayOrigin && board.tenant === config.nativeWorkdayTenant
        && board.site === config.nativeWorkdaySiteId, 'Current publisher declared an unreviewed native Workday board')
      return board
    }
    const declaredPublisherBoard = value => {
      if (!config.nativeOracleCandidateSite) return declaredWorkdayBoard(value)
      const url = https(value), expected = https(config.nativeOracleCandidateSite), board = url && recruitmentBoard(url.href)
      requireValue(expected && board?.kind === 'oracle' && url.href === expected.href && url.href === board.url
        && !url.search && !url.hash, 'Current publisher declared an unreviewed native Oracle candidate site')
      return board
    }
    const readPublisherDeclaration = async (page, phase) => {
      requireValue(typeof config.readCurrentPublisherDeclaration === 'function' && config.requireCorporateIdentityMatch === true
        && identifiedCompanyHosts.has(new URL(page.url).hostname.replace(/^www\./, '')) && root && page.url === root.href
        && official(new URL(page.url)), 'Current publisher declaration requires the identified official careers root')
      const uncached = phase === 'closing' ? { cache: 'no-store' } : {}
      const declaration = await config.readCurrentPublisherDeclaration({ page, now, phase,
        readPage: (value, init = {}) => read(value, { ...init, ...uncached }, 'publisher-page'),
        readRenderer: (value, init = {}) => read(value, { ...init, ...uncached }, 'publisher-script'),
        readJson: (value, init = {}) => readJson(value, { ...init, ...uncached }),
        readDeclaredBoardPage: value => {
          const board = declaredPublisherBoard(value)
          permit(board.url)
          return read(board.url, uncached, 'publisher-page')
        },
      })
      declaredPublisherBoard(declaration?.url)
      requireValue(declaration.context && typeof declaration.context === 'object' && !Array.isArray(declaration.context)
        && declaration.evidence && typeof declaration.evidence === 'object', 'Current publisher declaration context is missing')
      observed.publisherDeclarations ||= []
      observed.publisherDeclarations.push({ phase, ...declaration })
      return declaration
    }
    if (config.requireCorporateIdentityMatch && homepage && !vendor.test(homepage.hostname)) queue.push(homepage.href)
    if (root && !vendor.test(root.hostname)) queue.push(root.href)
    if (homepage && homepage.href !== root?.href && !vendor.test(homepage.hostname)) queue.push(homepage.href)
    const seenPages = new Set(), schemaSeen = new Set()
    while (queue.length && seenPages.size < maxPages && observed.requestCount < maxRequests) {
      const value = queue.shift(); if (seenPages.has(value)) continue; seenPages.add(value)
      let page, doc
      try { page = await read(value); doc = readNativeDocument(normalizeNativeAttributeBoundaries(page.html)) }
      catch (error) { problem('official-page', error); continue }
      const pageURL = new URL(page.url)
      const corporatePage = official(pageURL)
      const delegatedPublisherPage = !corporatePage && config.prioritizeRecruitmentSearch && config.allowDeclaredExternalCareersPages && allowed(pageURL)
      let companyIdentified = !config.requireCorporateIdentityMatch || identifiedCompanyHosts.has(pageURL.hostname.replace(/^www\./, ''))
      if ((corporatePage || delegatedPublisherPage) && !companyIdentified) {
        const publisherNames = doc.nodes(node => ['title', 'h1'].includes(node.tag)).map(node => node.tag === 'title'
          ? decodeNativeEntities(node.raw || '') : doc.text(node))
        publisherNames.push(...doc.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:site_name').map(node => node.attrs.content || ''))
        const expected = [config.companyName, ...(config.publisherNames || [])].map(companyKey).filter(value => value.length >= 2)
        companyIdentified = publisherNames.some(name => expected.some(value => companyKey(name).includes(value)) || matchingPublisher(name))
        if (companyIdentified) {
          identifiedCompanyHosts.add(pageURL.hostname.replace(/^www\./, ''))
          observed.corporateIdentityEvidence ||= []
          observed.corporateIdentityEvidence.push({ url: page.url, publisherNames })
        }
      }
      const canDelegate = companyIdentified && (corporatePage || delegatedPublisherPage)
      if (canDelegate && corporatePage && root && page.url === root.href && typeof config.readCurrentPublisherDeclaration === 'function') {
        try {
          const declaration = await readPublisherDeclaration(page, 'opening')
          bind(declaration.url, page.url, true, 'runtime-current-careers-publisher-declaration', declaration)
        } catch (error) { problem('current-publisher-declaration', error) }
      }
      if (canDelegate && config.discoverLiteralRecruitmentData === true) {
        for (const feed of [...activeLeverCareersFeeds(doc), ...activeAshbyCareersFeeds(doc)]) {
          bind(feed, page.url, true, 'runtime-current-careers-active-native-fetch')
        }
      }
      if (!corporatePage && allowed(pageURL)) {
        const empty = readBreezyEmptyState(doc, page.url, {
          companyName: config.companyName, publisherNames: config.publisherNames,
          officialHomepageUrl: homepage?.href, bindingEvidence: currentBreezyBindings.get(pageURL.origin),
        })
        if (empty) {
          observed.nativeInventoryReads.push(empty)
          observed.unresolved.push('native-breezy-listing-scope-unverified')
        }
      }
      const nativeCandidateBoard = recruitmentBoard(page.url)
      if (canDelegate && nativeCandidateBoard?.kind === 'oracle'
        && doc.nodes(node => node.tag === 'base' && node.attrs['data-sitenumber'] && node.attrs['data-apibaseurl']).length) {
        bind(nativeCandidateBoard.url, page.url, true, 'runtime-current-native-candidate-site')
      }
      const declaredPageDataLinks = []
      let nativeRoleOnHold = false
      if (canDelegate && config.discoverLiteralRecruitmentData === true) {
        try {
          const phenom = phenomRecruitmentLinks(doc, page.url)
          if (phenom) {
            const search = phenomRecruitmentSearch(doc, page.url)
            if (search) phenomSearches.set(search.url + ':' + search.refNum, search)
            for (const target of phenom.links) if (allowed(new URL(target)) && !seenPages.has(target)) declaredPageDataLinks.push(target)
            if (phenom.reportedTotal !== null) {
              observed.nativeInventoryReads.push({ kind: 'phenom', surface: page.url, refNum: phenom.refNum, reportedTotal: phenom.reportedTotal })
              observed.nativeRecords += phenom.observedRecords
              for (const row of literalRecruitmentPageData(doc, 'phApp').ddo.eagerLoadRefineSearch.data.jobs) observePhenom(row, page.url, phenom.refNum)
              observed.unresolved.push('native-phenom-listing-scope-unverified')
            }
            for (const role of phenom.nativeRoles) {
              const target = new URL(role)
              if (recruitmentBoard(role)) bind(role, page.url, true)
              else if (official(target) && !seenPages.has(role)) queue.unshift(role)
            }
            for (const target of phenom.roleLinks) if (allowed(new URL(target)) && !seenPages.has(target)) declaredPageDataLinks.push(target)
            const role = phenomRecruitmentRole(doc, page.url, {postings:recruitmentJobPostings(doc),
              brandEmployerBindings:config.nativePhenomBrandEmployerBindings})
            if (role) {
              observed.nativeRecords++; nativeRoleOnHold = Boolean(role.heldStatuses.length)
              observeNative({ scope: 'phenom:' + pageURL.origin + ':' + role.record.uniqueValue.refNum,
                id: role.id, title: role.title, url: role.url })
              if (role.country === 'India') addJob(role)
            }
          }
        } catch (error) { problem('native-phenom-page-data', error) }
      }
      if (corporatePage && !companyIdentified) observed.unresolved.push('current-corporate-publisher-identity-unqualified')
      if (canDelegate && config.nativeJsonFeed && career.test(pageURL.pathname)) {
        try { await readDeclaredKekaWebflowFeed(config, doc, page, { permit, readJson, matchingEmployer, addJob,
          inventoryRead: value => observed.nativeInventoryReads.push(value), recordRead: row => {
            observed.nativeRecords++; observeNative({ scope: 'keka-feed:' + config.nativeJsonFeed.url, id: row.id, title: row.name, url: row.url })
          },
          unresolved: value => observed.unresolved.push(value) }) }
        catch (error) { problem('native-first-party-json-feed', error) }
      }
      if (canDelegate && config.discoverLiteralRecruitmentData === true) {
        try {
          const descriptor = declaredRipplingRecruitment(doc, page.url, config)
          if (descriptor && !ripplingFeeds.has(descriptor.endpointURL)) {
            ripplingFeeds.add(descriptor.endpointURL)
            await readRipplingRecruitment(descriptor, { readPage: read,
              readRenderer: (url, init) => read(url, init, 'renderer'), readJson, permit, matchingEmployer, addJob, maxDetails,
              canRead: () => observed.requestCount < maxRequests,
              inventoryRead: value => observed.nativeInventoryReads.push(value),
              recordRead: (row, account) => {
                observed.nativeRecords++
                observeNative({ scope: 'rippling:' + account.token, id: row.id, title: row.name, url: row.url })
              },
              unresolved: value => observed.unresolved.push(value) })
          }
        } catch (error) { problem('native-rippling', error) }
      }
      if (canDelegate && config.discoverLiteralRecruitmentData === true) {
        try {
          const descriptor = declaredPyjamaRecruitment(page, config)
          if (descriptor && !pyjamaBoards.has(descriptor.boardURL)) {
            pyjamaBoards.add(descriptor.boardURL)
            await readPyjamaRecruitment(descriptor, { readPage: read,
              readRenderer: (url, init) => read(url, init, 'renderer'), readJson, permit, matchingEmployer, addJob,
              maxPages, maxDetails, now, canRead: () => observed.requestCount < maxRequests,
              remainingRequests: () => maxRequests - observed.requestCount,
              inventoryRead: value => observed.nativeInventoryReads.push(value),
              recordRead: (row, account) => {
                observed.nativeRecords++
                observeNative({ scope: 'pyjama:' + account.companyUUID, id: row.id, title: row.title, url: row.url })
              },
              unresolved: value => observed.unresolved.push(value), exclude: value => observed.exclusions.push(value) })
          }
        } catch (error) { problem('native-pyjama', error) }
      }
      if (canDelegate && config.discoverLiteralRecruitmentData === true) {
        try {
          const descriptor = declaredEightfoldRecruitment(page, config) || declaredEightfoldPcsxRecruitment(page, config)
            || declaredEightfoldPcsxTwilioRecruitment(page, config)
          if (descriptor) {
            eightfoldPages.set(descriptor.boardURL, { descriptor, requestedURL: value })
            // The selected program supplies its own full role criteria and
            // date semantics. Do not fall through to its generated SEO dates.
            if (eightfoldBindings.has(value) || eightfoldBindings.has(page.url)) break
            continue
          }
        } catch (error) { problem('native-eightfold', error); continue }
      }
      const declaredNativeSearchLinks = []
      if (canDelegate && config.discoverJibeRecruitmentData === true && !jibeSearchOrigins.has(pageURL.origin)) {
        try {
          const search = declaredJibeSearch(doc, page.url)
          if (search?.clientURL) {
            jibeSearchOrigins.add(pageURL.origin)
            await readJibeRecruitment(search, { readRenderer: value => read(value, {}, 'renderer'), readJson, permit, addJob, maxPages, maxDetails,
              canRead: () => observed.requestCount < maxRequests, inventoryRead: value => observed.nativeInventoryReads.push(value),
              recordRead: row => {
                observed.nativeRecords++
                const language = row.language == null ? search.locale : /^[a-z]{2}-[a-z]{2}$/i.test(row.language) ? row.language : null
                const role = new URL(search.rolePrefix + encodeURIComponent(row.slug), search.origin)
                if (language) role.searchParams.set('lang', language)
                observeNative({ scope: 'jibe:' + search.origin + ':' + search.cid,
                  id: row.req_id, title: row.title, url: language ? role.href : null })
              },
              unresolved: value => observed.unresolved.push(value), problem })
          } else if (search && search.searchPageURL !== page.url && !seenPages.has(search.searchPageURL)) {
            permit(search.searchPageURL); declaredNativeSearchLinks.push(search.searchPageURL)
          }
        } catch (error) { problem('native-jibe-public-search', error) }
      }
      if (canDelegate && config.prioritizeRecruitmentSearch && !unifiedSearchOrigins.has(pageURL.origin)) {
        try {
          const search = successFactorsUnifiedSearch(doc, page.url)
          if (search) {
            unifiedSearchOrigins.add(pageURL.origin)
            const candidates = await readSuccessFactorsUnifiedSearch(search, { readRenderer: value => read(value, {}, 'renderer'), readJson, permit,
              inventoryRead: value => observed.nativeInventoryReads.push(value) })
            for (const candidate of candidates) {
              observeNative({ scope: 'successfactors-unified:' + search.origin + ':' + search.companyId,
                id: candidate.id, title: candidate.title, url: candidate.url })
              nativeSearchCandidates.set(candidate.url, candidate)
              if (!seenPages.has(candidate.url)) declaredNativeSearchLinks.push(candidate.url)
            }
          }
        } catch (error) { problem('native-successfactors-unified-search', error) }
      }
      const nativeCandidate = nativeSearchCandidates.get(value) || nativeSearchCandidates.get(page.url)
      const microdata = new Set(recruitmentMicrodataPostings(doc, page.url,{html:normalizeNativeAttributeBoundaries(page.html)}))
      const visibleRoles = new Set(config.prioritizeRecruitmentSearch
        ? [...recruitmentSuccessFactorsPostings(doc, page.url), ...successFactorsUnifiedPostings(doc, page.url,{listing:nativeCandidate?.record})] : [])
      const schemas = [...recruitmentJobPostings(doc), ...microdata, ...visibleRoles]
      for (const posting of schemas) {
        if (corporatePage && !companyIdentified && !declaredCompanyRolePages.has(value) && !declaredCompanyRolePages.has(page.url)) continue
        const nativeURL = https(posting.url || posting['@id'] || page.url)
        if (!nativeURL || !allowed(nativeURL)) continue
        if (!samePage(nativeURL, pageURL)) {
          if (companyIdentified || !corporatePage) {
            if (corporatePage && official(nativeURL)) declaredCompanyRolePages.add(nativeURL.href)
            queue.unshift(nativeURL.href)
          }
          continue
        }
        if (nativeRoleOnHold) continue
        if (nativeCandidate && (String(posting.identifier?.value) !== nativeCandidate.id
          || companyKey(posting.title) !== companyKey(nativeCandidate.title))) {
          observed.unresolved.push('native-listing-detail-identity-mismatch'); continue
        }
        const identity = nativeURL.href + ':' + (posting.identifier?.value || posting.title)
        if (schemaSeen.has(identity)) continue; schemaSeen.add(identity); observed.nativeRecords++
        observeNative({ scope: 'native-page:' + pageURL.origin,
          id: posting.identifier?.value ?? (typeof posting.identifier === 'string' ? posting.identifier : null),
          title: posting.title, url: posting.url || posting['@id'] })
        if ((microdata.has(posting) || visibleRoles.has(posting)) && posting.nativeMicrodataIssues.length) {
          observed.unresolved.push(...posting.nativeMicrodataIssues); continue
        }
        const title = text(posting.title), primaryHeadings = doc.nodes(node => node.tag === 'h1')
        const headings = (primaryHeadings.length ? primaryHeadings : schemas.length === 1
          ? doc.nodes(node => ['h2', 'h3'].includes(node.tag) || node.attrs.role === 'heading'
            || node.attrs.itemprop === 'title' || /(?:^|\s)(?:job[-_]?title|position[-_]?title)(?:\s|$)/i.test(node.attrs.class || '')) : []).map(node => doc.text(node))
        const description = sourceDescription(posting.description)
        const visibleText = doc.nodes(node => node.tag === 'root').map(node => doc.text(node)).join(' ')
        const visibleTitle = headings.some(value => companyKey(value) === companyKey(title))
          || (microdata.has(posting) || visibleRoles.has(posting)) && posting.nativeVisibleTitleConfirmed
        if (!title || !visibleTitle || !description
          || !companyKey(visibleText).includes(companyKey(extractActiveDescription(description).slice(0, 160)))) {
          observed.unresolved.push('native-visible-role-content-mismatch'); continue
        }
        if (/\b(?:this (?:job|position|requisition) is no longer (?:available|active)|(?:this )?position (?:has been|is) filled)\b/i.test(visibleText)) continue
        const locations = asArray(posting.jobLocation).map(location => location?.address).filter(Boolean)
        const remote = posting.jobLocationType === 'TELECOMMUTE' ? asArray(posting.applicantLocationRequirements).map(item => ({ addressCountry: item.name })) : []
        const india = [...locations, ...remote].filter(address => country(address.addressCountry) === 'India')
        if (!india.length) { if (![...locations, ...remote].length || ![...locations, ...remote].every(address => country(address.addressCountry))) observed.unresolved.push('native-location-scope-unresolved'); continue }
        const address = india[0]
        addJob({ id: posting.identifier?.value || posting['@id'] || nativeURL.href, title, url: nativeURL.href,
          description, employer: posting.hiringOrganization, location: [address.addressLocality, address.addressRegion, 'India'].filter(Boolean).join(', '),
          posted: posting.datePosted, closing: posting.validThrough, employmentType: posting.employmentType,
          record: nativeCandidate ? {...posting,nativeListingRecord:nativeCandidate.record} : posting,
          ...(visibleRoles.has(posting) && !posting.hiringOrganization && canDelegate && !config.requireNativeEmployerName
            ? { employerBinding: { method: 'current-native-visible-role-publisher', surface: page.url, legalEmployer: null } } : {}) })
      }
      if (config.stopAfterNativeIndiaLimit === true && jobs.length >= maxDetails && jibeSearchOrigins.has(pageURL.origin)) {
        observed.unresolved.push('native-detail-budget-reached'); break
      }
      const next = []
      const links = doc.nodes(node => node.tag === 'a' && node.attrs.href).map(node => ({ href: node.attrs.href, label: doc.text(node), carrier: 'anchor' }))
      links.push(...activeIframeDeclarations(page.html))
      links.push(...doc.nodes(node => node.tag === 'script' && node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
        && /^(?:|module|(?:text|application)\/javascript)$/i.test(node.attrs.type || '')).map(node => ({ href: node.attrs.src, label: /\/embed/.test(node.attrs.src) ? 'careers embed' : '' })))
      for (const link of links) {
        let target; try { target = https(new URL(link.href, pageURL).href) } catch { continue }
        if (!target) continue
        const context = link.label + ' ' + target.pathname + (config.allowDeclaredExternalCareersPages ? ' ' + target.hostname : '')
        const languageView = config.discoverRecruitmentLinks && corporatePage && !companyIdentified && official(target) && /^(?:English|EN(?:-[A-Z]{2})?)$/i.test(link.label.trim())
        const nativeRole = !corporatePage && allowed(target) && /^\/(?:p\/[^/]+|jobs\/\d+|job\/[^/]+)/i.test(target.pathname)
        if (!career.test(context) && !(config.discoverRecruitmentLinks && recruitmentNavigation.test(context)) && !languageView && !vendor.test(target.hostname) && !nativeRole) continue
        if (/\/(?:login|sign-in|signin|cookie-policy|privacy-policy|my-profile)(?:\/|$)/i.test(target.pathname)
          && !/\/(?:jobs?|requisitions?)\/[^/]+/i.test(target.pathname) && !recruitmentBoard(target.href)) continue
        const originalDeclaredURL = target.href
        target.hash = ''
        // Retain only an actual active declaration on a registered corporate
        // surface. A registered native root cannot manufacture its own handoff.
        const registeredPublisher = [root, homepage].some(surface => surface
          && surface.hostname.replace(/^www\./, '') === pageURL.hostname.replace(/^www\./, ''))
        if (canDelegate && corporatePage && registeredPublisher && link.carrier === 'anchor' && target.origin !== pageURL.origin
          && /^\/careers\/?$/.test(target.pathname) && !eightfoldBindings.has(target.href)) {
          eightfoldBindings.set(target.href, { officialURL: page.url, declaredURL: originalDeclaredURL,
            linkLabel: link.label, page })
        }
        if (allowed(target) && !asset.test(target.pathname) && !seenPages.has(target.href)) {
          if (corporatePage && companyIdentified && official(target)) declaredCompanyRolePages.add(target.href)
          next.push(target.href)
        }
        else if (canDelegate && (vendor.test(target.hostname)
          || config.allowDeclaredExternalCareersPages && !asset.test(target.pathname))) bind(target.href, page.url, true)
      }
      for (const form of config.prioritizeRecruitmentSearch ? doc.nodes(node => node.tag === 'form' && (!node.attrs.method || /^get$/i.test(node.attrs.method))) : []) {
        let action; try { action = https(new URL(form.attrs.action || pageURL.href, pageURL).href) } catch { continue }
        const nativeCareerSearch = config.prioritizeRecruitmentRoleDetails === true && action && canDelegate && career.test(pageURL.hostname)
          && action.origin === pageURL.origin && /^\/search\/?$/i.test(action.pathname)
        if (!action || !allowed(action) || !nativeCareerSearch && !career.test(pageURL.pathname + ' ' + (form.attrs.id || '') + ' ' + (form.attrs.class || ''))) continue
        const descendants = node => [node, ...node.children.filter(child => typeof child !== 'string').flatMap(descendants)]
        const inputs = descendants(form).filter(node => node.tag === 'input' && node.attrs.name)
        const fields = inputs.filter(node => /^(?:q|keyword|keywords|searchText|locationsearch)$/i.test(node.attrs.name))
        if (!fields.length) continue
        if (!fields.some(node => /^locationsearch$/i.test(node.attrs.name)) && !nativeCareerSearch && !/job|career|vacanc/i.test(action.pathname + ' ' + (form.attrs.id || '') + ' ' + (form.attrs.class || ''))) continue
        for (const input of inputs.filter(node => node.attrs.type === 'hidden' && !/token|auth|csrf|session/i.test(node.attrs.name))) {
          action.searchParams.set(input.attrs.name, input.attrs.value || '')
        }
        const field = fields.find(node => /^locationsearch$/i.test(node.attrs.name)) || fields[0]
        action.searchParams.set(field.attrs.name, 'India'); next.unshift(action.href)
      }
      const priority = value => {
        const url = new URL(value)
        // After reaching an India candidate listing, inspect its role links
        // before additional search, sort or paging views consume discovery.
        // The candidate selector supplies no country evidence for the role.
        const indiaListing = config.prioritizeRecruitmentRoleDetails === true
          && /\bindia\b/i.test(pageURL.pathname + pageURL.search)
        const parameters = target => JSON.stringify([...target.searchParams].filter(([name]) => name !== 'locale')
          .sort((a,b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1])))
        const translatedCurrentPage = companyIdentified && url.origin === pageURL.origin && pathKey(url) === pathKey(pageURL)
          && url.searchParams.getAll('locale').length === 1 && url.searchParams.get('locale') !== pageURL.searchParams.get('locale')
          && parameters(url) === parameters(pageURL)
        return (/\bindia\b/i.test(url.pathname + url.search) ? -200 : 0)
          + (translatedCurrentPage ? 400 : 0)
          + (/\/(?:search|jobs|requisitions)(?:\/|$)/i.test(url.pathname) ? -80 : 0)
          + (/\/job\/[^/]+/i.test(url.pathname) ? indiaListing ? -400 : -120 : 0)
          + (value === root?.href ? -50 : 0)
          + (/culture|benefits|life-at|faq|privacy|\/images?\//i.test(value) ? 100 : 0)
          + url.pathname.split('/').filter(Boolean).length
      }
      if (config.prioritizeRecruitmentSearch) next.sort((a, b) => priority(a) - priority(b))
      else next.sort((a, b) => Number(/culture|benefits|life-at|\/images?\//i.test(a)) - Number(/culture|benefits|life-at|\/images?\//i.test(b))
        || Number(Boolean(new URL(a).search)) - Number(Boolean(new URL(b).search)))
      const navigation = [...new Set(next)].filter(value => !config.prioritizeRecruitmentSearch || !seenPages.has(value))
      if (nativeSearchCandidates.has(value) || nativeSearchCandidates.has(page.url)) queue.push(...navigation)
      else queue.unshift(...navigation)
      queue.unshift(...declaredPageDataLinks)
      queue.unshift(...declaredNativeSearchLinks)
      if (boards.size && seenPages.size >= 2) break
    }
    for (const { descriptor, requestedURL } of eightfoldPages.values()) {
      const binding = eightfoldBindings.get(requestedURL) || eightfoldBindings.get(descriptor.boardURL)
      if (!binding) { observed.unresolved.push('native-eightfold-current-corporate-binding-unavailable'); continue }
      try {
        const readNativeProgram = descriptor.kind === 'eightfold-pcsx-twilio' ? readEightfoldPcsxTwilioRecruitment
          : descriptor.kind === 'eightfold-pcsx' ? readEightfoldPcsxRecruitment : readEightfoldRecruitment
        await readNativeProgram(descriptor, { readPage: read,
          readRenderer: (url, init) => read(url, init, 'renderer'), readNativeJson, permit, matchingEmployer, addJob,
          maxPages, maxDetails, remainingRequests: () => maxRequests - observed.requestCount, now,
          officialBinding: binding,
          recheckOfficialBinding: value => read(value.officialURL, { cache: 'no-store' }),
          inventoryRead: value => observed.nativeInventoryReads.push(value),
          recordRead: (row, account) => {
            observed.nativeRecords++
            observeNative({ scope: 'eightfold:' + descriptor.origin + ':' + (account?.domain || descriptor.domain),
              id: row.id, title: row.name || row.title, url: row.canonicalPositionUrl || row.url })
          },
          unresolved: value => observed.unresolved.push(value) })
      } catch (error) { problem('native-eightfold', error) }
    }
    for (const search of phenomSearches.values()) {
      try {
        permit(search.url, ['POST'])
        const seen = new Map(); let offset = 0, total = null, inspected = 0
        for (let page = 0; page < maxPages && observed.requestCount < maxRequests; page++) {
          const reply = await readJson(search.url, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...search.body,from:offset})})
          const inventory = reply?.refineSearch, rows = inventory?.data?.jobs
          requireValue(inventory?.status === 200 && Array.isArray(rows) && rows.length <= search.body.size
            && Number.isSafeInteger(inventory.totalHits) && inventory.totalHits >= 0, 'Phenom native India inventory changed')
          if (total === null) total = inventory.totalHits
          requireValue(inventory.totalHits === total && offset + rows.length <= total, 'Phenom native India pagination changed')
          observed.nativeInventoryReads.push({kind:'phenom-india',surface:search.url,refNum:search.refNum,reportedTotal:total,offset})
          let repeated = false
          for (const row of rows) {
            requireValue(row && typeof row.jobId === 'string' && row.jobId && text(row.title), 'Phenom native candidate identity changed')
            const identity = JSON.stringify({title:row.title,country:row.country,siteType:row.siteType,visibilityType:row.visibilityType})
            if (seen.has(row.jobId)) {
              requireValue(seen.get(row.jobId) === identity, 'Phenom native candidate identity conflict')
              observed.unresolved.push('native-phenom-pagination-repeated-role'); repeated = true; continue
            }
            seen.set(row.jobId,identity); observed.nativeRecords++
            observePhenom(row, search.baseURL, search.refNum)
            if (country(row.country) !== 'India') { observed.unresolved.push('native-phenom-filter-country-unverified'); continue }
            if (!phenomPublicRole(row)) continue
            if (inspected >= maxDetails || observed.requestCount >= maxRequests) { observed.unresolved.push('native-detail-budget-reached'); break }
            inspected++
            try {
              const url = new URL(search.route.replace(':jobId',encodeURIComponent(row.jobId)).replace(':title',encodeURIComponent(row.title)),search.baseURL.replace(/\/?$/, '/')).href
              permit(url)
              const detail = await read(url), document = readNativeDocument(normalizeNativeAttributeBoundaries(detail.html))
              const native = phenomRecruitmentRole(document,detail.url,{postings:recruitmentJobPostings(document),
                brandEmployerBindings:config.nativePhenomBrandEmployerBindings})
              requireValue(native && native.id === row.jobId && native.title === row.title
                && native.record.uniqueValue.refNum === search.refNum, 'Phenom listing/detail identity changed')
              if (native.country !== 'India') { observed.unresolved.push('native-location-conflict'); continue }
              addJob(native)
            } catch (error) { problem('native-phenom-role',error) }
          }
          offset += rows.length
          if (repeated || inspected >= maxDetails || offset === total) break
          requireValue(rows.length > 0, 'Phenom native India pagination made no progress')
        }
        observed.unresolved.push('native-phenom-listing-scope-unverified')
      } catch (error) { problem('native-phenom-india-search',error) }
    }

    for (const board of boards.values()) {
      if (config.nativeOracleCandidateSite && (board.kind !== 'oracle' || board.url !== config.nativeOracleCandidateSite
        || board.bindingEvidence?.bindingMethod !== 'runtime-current-careers-publisher-declaration')) continue
      if (config.stopAfterNativeIndiaLimit === true && jobs.length >= maxDetails) {
        observed.unresolved.push('native-detail-budget-reached'); break
      }
      signal.throwIfAborted()
      if (observed.requestCount >= maxRequests) break
      const jobsBeforeBoard=jobs.length
      try {
        if (['ashby', 'greenhouse', 'lever'].includes(board.kind)) {
          if (board.kind === 'greenhouse' && new URL(board.url).hostname.includes('.eu.')) throw Error('European Greenhouse requires its regional extractor')
          const token = encodeURIComponent(board.token)
          const api = board.kind === 'ashby' ? `https://api.ashbyhq.com/posting-api/job-board/${token}`
            : board.kind === 'greenhouse' ? `https://boards-api.greenhouse.io/v1/boards/${token}`
              : `https://api.${board.region === 'eu' ? 'eu.' : ''}lever.co/v0/postings/${token}`
          permit(api); permit(board.url)
          const nativeIntakes = new Map()
          const native = await createPublishingGapAtsScraper({ source: config.source, companyName: config.companyName,
            companyCareerPage: root?.href || homepage.href, atsPlatform: board.kind, boardToken: board.token,
            leverRegion: board.region, sourceScopeComplete: false }).run({ signal, fetchJson: async (url, init) => {
            const payload = await readJson(url, init)
            if (board.kind === 'greenhouse') requireValue(payload?.jobs?.every(row => matchingEmployer(row.company_name)), 'Native employer does not match the configured source')
            if (config.requireNativeEmployerName && board.kind !== 'greenhouse') {
              const records = Array.isArray(payload) ? payload : payload.jobs
              requireValue(Array.isArray(records) && records.every(row => matchingEmployer(row.hiringOrganization?.name)), 'Native exact employer scope remains unqualified for this brand')
            }
            const rows = Array.isArray(payload) ? payload : payload?.jobs || []
            observed.nativeRecords += rows.length
            if (!publicAtsInventoryError(payload) && Array.isArray(rows)) for (const row of rows) {
              const roleURL = row?.jobUrl || row?.hostedUrl || row?.absolute_url
              const roleBoard = recruitmentBoard(roleURL)
              if (roleBoard && (roleBoard.kind !== board.kind || roleBoard.token !== board.token
                || (roleBoard.region || 'global') !== (board.region || 'global'))) {
                observed.unresolved.push('native-observation-foreign-account'); continue
              }
              if (isRecruitmentIntakeTitle(row?.title || row?.text)) nativeIntakes.set(String(row?.id), row)
              observeNative({ scope: board.kind + ':' + (board.region || 'global') + ':' + board.token,
                id: row?.id, title: row?.title || row?.text,
                url: roleURL,
                nonVacancy: board.kind === 'greenhouse' && isGreenhouseProspectPost(row) })
            }
            return payload
          } })
          const nativeAudit = Object.getOwnPropertyDescriptor(native, 'nativeCollectionEvidence')?.value
          if (nativeAudit) nativeBoards.push({ kind: board.kind, surface: board.url,
            boardToken: board.token, region: board.region || 'global', ...nativeAudit })
          const nativeEvidence = readInventoryEvidence(native)
          observed.nativeInventoryReads.push({ kind: board.kind, surface: board.url, reportedTotal: nativeEvidence?.reportedTotal ?? null })
          if (/native-location|inner-source-listing|selected-role-description/.test(nativeEvidence?.reason || '')) {
            observed.unresolved.push(nativeEvidence.reason)
          }
          for (const job of native) {
            if (excludeNativeIntake(job.title, job.sourceUrl || job.applyUrl,
              nativeIntakes.get(String(job.jobId || job.id)) || job.nativeSourceRecord || job)) continue
            if (!sourceDescription(job.sourceDescription || job.jobDescription)) {
              observed.unresolved.push('native-full-description-unavailable'); continue
            }
            const key = String(job.jobId || job.id || job.applyUrl) + ':' + job.applyUrl
            if (!seenJobs.has(key)) { seenJobs.add(key); jobs.push({ ...job, officialAtsBinding: board.bindingEvidence,
              sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false }) }
          }
        } else if (board.kind === 'smartrecruiters') {
          const prefix = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(board.token)}/postings`
          permit(prefix); permit(`https://jobs.smartrecruiters.com/${encodeURIComponent(board.token)}`)
          let offset = 0, total = null; const ids = new Set()
          for (let index = 0; index < maxPages && observed.requestCount < maxRequests; index++) {
            const payload = await readJson(prefix + `?offset=${offset}&limit=100`)
            requireValue(Array.isArray(payload.content) && Number.isSafeInteger(payload.totalFound) && payload.totalFound >= 0, 'Invalid SmartRecruiters inventory')
            if (total === null) total = payload.totalFound
            requireValue(total === payload.totalFound, 'SmartRecruiters inventory changed during pagination')
            observed.nativeInventoryReads.push({ kind: board.kind, surface: board.url, reportedTotal: total })
            for (const row of payload.content) {
              requireValue(text(row.id) && !ids.has(row.id), 'Invalid or duplicate SmartRecruiters identity'); ids.add(row.id); observed.nativeRecords++
              observeNative({ scope: 'smartrecruiters:' + board.token, id: row.id, title: row.name })
              if (country(row.location?.country) !== 'India' || observed.requestCount >= maxRequests) continue
              const detail = await readJson(prefix + '/' + encodeURIComponent(row.id))
              requireValue(detail.id === row.id && detail.name === row.name, 'SmartRecruiters listing/detail identity changed')
              if (country(detail.location?.country) !== 'India') { observed.unresolved.push('native-location-conflict'); continue }
              const description = Object.values(detail.jobAd?.sections || {}).map(section => section?.text).filter(value => typeof value === 'string').join('\n')
              const roleURL = detail.applyUrl || detail.postingUrl
              const role = https(roleURL)
              if (!role || !['jobs.smartrecruiters.com', 'careers.smartrecruiters.com'].includes(role.hostname)) {
                observed.unresolved.push('native-public-role-url-unavailable'); continue
              }
              permit(roleURL)
              addJob({ id: detail.id, title: detail.name, url: roleURL, employer: detail.company,
                description, location: [detail.location?.city, detail.location?.region, 'India'].filter(Boolean).join(', '),
                posted: detail.releasedDate, employmentType: detail.typeOfEmployment?.label, record: detail })
            }
            offset += payload.content.length
            if (offset === total) break
            requireValue(payload.content.length > 0 && offset < total, 'SmartRecruiters pagination is incomplete or inconsistent')
          }
        } else if (board.kind === 'workable') {
          const token = encodeURIComponent(board.token)
          const accountURL = `https://apply.workable.com/api/v1/accounts/${token}`
          const collectionURL = `https://apply.workable.com/api/v1/widget/accounts/${token}`
          const detailsURL = `https://apply.workable.com/api/v2/accounts/${token}/jobs`
          permit(accountURL); permit(collectionURL); permit(detailsURL)
          const account = await readJson(accountURL)
          let owner
          try { owner = new URL(account.url) } catch { /* Missing reciprocal publisher identity. */ }
          requireValue(account && matchingEmployer(account.name) && text(account.uid)
            && Number.isSafeInteger(account.id) && account.id > 0
            && text(account.subdomain).toLowerCase() === board.token.toLowerCase()
            && !account.error && account.success !== false && account.ok !== false
            && owner && ['http:', 'https:'].includes(owner.protocol) && !owner.username && !owner.password && !owner.port
            && official(owner), 'Workable reciprocal account/employer identity changed')
          const collection = await readJson(collectionURL)
          requireValue(collection?.name === account.name && Array.isArray(collection.jobs)
            && !collection.error && collection.success !== false && collection.ok !== false, 'Invalid Workable public collection')
          observed.nativeInventoryReads.push({ kind: board.kind, surface: board.url, reportedTotal: collection.jobs.length })
          const ids = new Map(); let inspected = 0
          for (const row of collection.jobs) {
            requireValue(row && /^[A-Z0-9]{6,32}$/.test(row.shortcode || '') && text(row.title), 'Invalid Workable posting identity')
            if (ids.has(row.shortcode)) {
              requireValue(ids.get(row.shortcode) === row.title, 'Contradictory Workable posting identity'); continue
            }
            ids.set(row.shortcode, row.title); observed.nativeRecords++
            observeNative({ scope: 'workable:' + board.token, id: row.shortcode, title: row.title, url: row.url })
            const declaredCountries = asArray(row.locations).map(location => country(location?.countryCode || location?.country)).filter(Boolean)
            if (!declaredCountries.length && country(row.country)) declaredCountries.push(country(row.country))
            if (declaredCountries.length && !declaredCountries.includes('India')) continue
            if (inspected >= maxDetails || observed.requestCount >= maxRequests) { observed.unresolved.push('native-detail-budget-reached'); continue }
            inspected++
            const detail = await readJson(detailsURL + '/' + row.shortcode)
            requireValue(detail && detail.accountUid === account.uid && detail.shortcode === row.shortcode
              && detail.title === row.title && Number.isSafeInteger(detail.id) && detail.id > 0
              && !detail.error && detail.ok !== false && detail.success !== false, 'Workable listing/detail identity changed')
            if (typeof detail.state !== 'string' || typeof detail.isInternal !== 'boolean' || typeof detail.approvalStatus !== 'string') {
              observed.unresolved.push('native-publication-scope-unresolved'); continue
            }
            if (detail.state !== 'published' || detail.isInternal !== false || detail.approvalStatus !== 'approved') continue
            const locations = asArray(detail.locations)
            const india = locations.filter(location => location?.hidden === false
              && country(location.countryCode) === 'India'
              && (!text(location.country) || country(location.country) === 'India'))
            if (!india.length) { if (!locations.length || locations.some(location => location?.hidden !== false || !country(location?.countryCode))) observed.unresolved.push('native-location-scope-unresolved'); continue }
            const role = https(row.url)
            requireValue(role && role.hostname === 'apply.workable.com'
              && [new RegExp('^/j/' + row.shortcode + '/?$'), new RegExp('^/' + board.token + '/j/' + row.shortcode + '/?$')].some(pattern => pattern.test(role.pathname)),
            'Workable public role identity changed')
            permit(role.href)
            const description = [detail.description, detail.requirements, detail.benefits].filter(value => typeof value === 'string' && value.trim()).join('\n')
            addJob({ id: String(detail.id), title: detail.title, url: role.href, description,
              employer: { name: account.name, url: account.url },
              location: [india[0].city, india[0].region, 'India'].filter(Boolean).join(', '),
              posted: text(detail.published) || null, employmentType: detail.type || null,
              record: { ...detail, nativeAccount: { id: account.id, uid: account.uid, name: account.name, url: account.url } } })
          }
        } else if (board.kind === 'workday') {
          let prefix = `${board.origin}/wday/cxs/${encodeURIComponent(board.tenant)}/${encodeURIComponent(board.site)}`
          permit(prefix); permit(prefix + '/jobs', ['POST']); permit(board.url)
          let offset = 0, total = null, inspected = 0; const paths = new Map(),pageSnapshots=[],nativeUids=new Set(),nativeRequisitions=new Set()
          let appliedFacets = {}, searchText = ''
          const inventory = () => readJson(prefix + '/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ appliedFacets, limit: 20, offset, searchText }) })
          let firstPage
          try { firstPage = await inventory() }
          catch (error) {
            if (!/\bHTTP 422\b/.test(error.message)) throw error
            const page = await read(board.url)
            const declared = literalRecruitmentPageData(readNativeDocument(normalizeNativeAttributeBoundaries(page.html)), 'workday')?.config
            requireValue(declared && /^[a-z\d_-]{1,120}$/i.test(declared.tenant || '') && declared.siteId === board.site
              && declared.tenant.replace(/[-_]/g, '').toLowerCase() === board.tenant.replace(/[-_]/g, '').toLowerCase()
              && declared.tenant !== board.tenant, 'Workday declared native account changed')
            prefix = `${board.origin}/wday/cxs/${encodeURIComponent(declared.tenant)}/${encodeURIComponent(declared.siteId)}`
            permit(prefix); permit(prefix + '/jobs', ['POST'])
            observed.nativeAccountConfiguration = { tenant: declared.tenant, site: declared.siteId, surface: page.url }
            firstPage = await inventory()
          }
          requireValue(Array.isArray(firstPage.jobPostings) && Number.isSafeInteger(firstPage.total) && firstPage.total >= 0, 'Invalid Workday inventory')
          for (const row of firstPage.jobPostings) observeWorkday(row, prefix, board)
          observed.nativeInventoryReads.push({ kind: board.kind, surface: board.url, reportedTotal: firstPage.total })
          if ((options.preferIndiaInventory ?? config.preferIndiaInventory) === true) {
            const indiaFacet = recruitmentIndiaFacet(firstPage, { allowPublishedCountryFacets: config.prioritizeRecruitmentSearch === true })
            if (indiaFacet) {
              observed.nativeCountryFacet = indiaFacet
              appliedFacets = { [indiaFacet.facetParameter]: [indiaFacet.id] }
              firstPage = await inventory()
            } else if (config.preferPublishedIndiaLocationFacets===true&&publishedIndiaLocationFacets(firstPage).length) {
              const locations=publishedIndiaLocationFacets(firstPage)
              observed.nativeIndiaLocationFacets=locations
              appliedFacets={locations:locations.map(value=>value.id)}
              firstPage=await inventory()
            } else if (config.searchIndiaWithoutFacet === true) {
              // A search is only a bounded candidate selector. Every returned
              // detail still needs its own explicit native India country.
              searchText = 'India'
              observed.nativeSearch = { searchText, countryProof: false }
              firstPage = await inventory()
            }
          }
          for (let index = 0; index < maxPages && observed.requestCount < maxRequests; index++) {
            const payload = index === 0 ? firstPage : await inventory()
            requireValue(Array.isArray(payload.jobPostings) && Number.isSafeInteger(payload.total) && payload.total >= 0, 'Invalid Workday inventory')
            if (total === null) total = payload.total
            // Native CXS suppresses the total on subsequent pages. Retain the
            // first-page count; a different positive total remains a change.
            requireValue(total === payload.total || offset > 0 && payload.total === 0, 'Workday inventory changed during pagination')
            if(config.reconcileWorkdayNativeContext===true)pageSnapshots.push({
              body:JSON.stringify({appliedFacets,limit:20,offset,searchText}),snapshot:currentWorkdayListingSnapshot(payload)})
            let newPaths = 0
            for (const row of payload.jobPostings) {
              observeWorkday(row, prefix, board)
              if (!row || typeof row.externalPath !== 'string' || !/^\/job\/[^?#]+$/.test(row.externalPath)) {
                observed.unresolved.push('native-role-identity-unavailable')
                observed.unqualifiedNativeRows = (observed.unqualifiedNativeRows || 0) + 1
                continue
              }
              const identity = JSON.stringify({ title: row.title, locationsText: row.locationsText, bulletFields: row.bulletFields })
              if (paths.has(row.externalPath)) {
                requireValue(paths.get(row.externalPath) === identity, 'Conflicting duplicate Workday role identity')
                observed.unresolved.push('native-pagination-repeated-role')
                continue
              }
              paths.set(row.externalPath, identity); newPaths++; observed.nativeRecords++
              if (!(Object.keys(appliedFacets).length || searchText
                || /\bindia\b|\bbengaluru\b|\bbangalore\b|\bhyderabad\b|\bpune\b|\bmumbai\b|\bchennai\b|\bgurugram\b|\bgurgaon\b|\bnoida\b|\bdelhi\b|\b\d+\s+locations\b/i.test(row.locationsText || ''))) continue
              if (inspected >= maxDetails || observed.requestCount >= maxRequests) { observed.unresolved.push('native-detail-budget-reached'); continue }
              inspected++
              const detail = await readJson(prefix + row.externalPath), info = detail.jobPostingInfo
              const expected = new URL(board.url + row.externalPath), actual = https(info?.externalUrl)
              const declaredSite = text(info?.jobPostingSiteId)
              const canonicalExpected = new URL(expected)
              if (declaredSite && declaredSite.toLowerCase() === board.site.toLowerCase()) {
                const publicRoot = new URL(board.url)
                canonicalExpected.pathname = publicRoot.pathname.slice(0, -board.site.length) + declaredSite + row.externalPath
              }
              requireValue(info && actual && actual.origin === expected.origin
                && [expected.pathname, canonicalExpected.pathname].includes(actual.pathname.replace(/^\/[a-z]{2}-[a-z]{2}\//i, '/'))
                && (!declaredSite || declaredSite.toLowerCase() === board.site.toLowerCase())
                && info.title === row.title && workdayListingHasRequisition(row,text(info.jobReqId)), 'Workday listing/detail identity changed')
              permit(actual.href)
              if (info.posted === false || info.canApply === false) {
                observed.exclusions.push({ reason: 'native-role-unavailable', url: actual.href }); continue
              }
              const primaryCountry = country(info.country), requisitionCountry = country(info.jobRequisitionLocation?.country)
              requireValue(!primaryCountry || !requisitionCountry || primaryCountry === requisitionCountry, 'Contradictory Workday native countries')
              const nativeCountry = primaryCountry || requisitionCountry
              if (nativeCountry !== 'India') {
                if (!nativeCountry) observed.unresolved.push('native-location-scope-unresolved')
                else {
                  observed.exclusions.push({ reason: 'native-explicit-non-India-primary-country', url: actual.href, country: nativeCountry })
                  // The primary country's scope cannot be extended to the
                  // additional location strings, which contain no countries.
                  if (asArray(info.additionalLocations).length) observed.unresolved.push('native-additional-location-scope-unresolved')
                }
                continue
              }
              let employer = detail.hiringOrganization, employerBinding = null
              const blankEmployer = employer == null || typeof employer === 'object' && !Array.isArray(employer)
                && Object.keys(employer).every(key => ['name', 'url'].includes(key))
                && [employer.name, employer.url].every(value => value == null || typeof value === 'string' && !value.trim())
              if (blankEmployer && matchingEmployer(config.nativeEmployerStatement?.name) && sourceDescription(info.jobDescription)) {
                const statement = roleEmployerStatement(info.jobDescription, config.nativeEmployerStatement)
                if (statement) {
                  employer = { name: statement.name }
                  employerBinding = { method: 'explicit-native-role-employer-statement', field: 'jobPostingInfo.jobDescription',
                    statement: statement.statement, surface: prefix + row.externalPath, legalEmployer: null }
                }
              }
              if(blankEmployer&&config.reconcileWorkdayNativeContext===true&&config.nativeWorkdayEmployerDeclaration){
                const declaration=reviewedWorkdayEmployerDeclaration(info.jobDescription,config.nativeWorkdayEmployerDeclaration)
                if(declaration&&matchingEmployer(declaration.name)){
                  employer={name:declaration.name}
                  employerBinding={method:'explicit-native-role-employment-declaration',field:'jobPostingInfo.jobDescription',
                    statement:declaration.statement,kind:declaration.kind,surface:prefix+row.externalPath,legalEmployer:null}
                }
              }
              let closingDetail=null
              if(config.reconcileWorkdayNativeContext===true){
                if(!matchingEmployer(employer?.name)||!sourceDescription(info.jobDescription)||closed(info.endDate,now)){
                  const reason=!matchingEmployer(employer?.name)?'native-employer-mismatch':!sourceDescription(info.jobDescription)?'native-full-description-unavailable':'native-role-expired'
                  observed.unresolved.push(reason);observed.exclusions.push({reason,url:actual.href,requisitionId:info.jobReqId,nativeEmployer:employer?.name||null});continue
                }
                const nativeSite=config.nativeWorkdaySiteId||board.site
                requireValue(nativeSite.toLowerCase()===board.site.toLowerCase(),'Configured native posting site does not match the published account')
                const opening=currentWorkdayRoleSnapshot(detail,row,nativeSite,now,config.nativeWorkdayEmployerDeclaration)
                requireValue(!nativeUids.has(info.id)&&!nativeRequisitions.has(info.jobReqId),'Duplicate native Workday posting or requisition identity')
                closingDetail=await readJson(prefix+row.externalPath,{cache:'no-store'})
                requireValue(currentWorkdayRoleSnapshot(closingDetail,row,nativeSite,now,config.nativeWorkdayEmployerDeclaration)===opening,'Workday closing native role context changed')
                nativeUids.add(info.id);nativeRequisitions.add(info.jobReqId)
              }
              const before=jobs.length
              addJob({ id: info.jobReqId, title: info.title, url: actual.href, description: info.jobDescription,
                employer, employerBinding, location: [info.location, 'India'].filter(Boolean).join(', '),
                posted: info.startDate, closing: info.endDate, record: detail })
              if(config.reconcileWorkdayNativeContext===true&&jobs.length>before){
                const criteria=extractWorkdayJobDetail('<section data-automation-id="jobPostingDescription"><div>'+info.jobDescription+'</div></section>')
                Object.assign(jobs.at(-1),{
                requisitionId:info.jobReqId,location:info.location,city:null,
                locations:[...new Set([info.location,...asArray(info.additionalLocations)])],
                employmentType:typeof info.timeType==='string'&&info.timeType.trim()?info.timeType:null,
                remoteStatus:typeof info.remoteType==='string'&&info.remoteType.trim()?info.remoteType:null,
                minimumQualification:criteria.minimumQualification??null,preferredQualification:criteria.preferredQualification??null,
                requiredSkills:criteria.requiredSkills||[],experienceRequired:criteria.experienceRequired??null,publicExperienceChecked:true,
                nativeLocationEvidence:{postingLocation:info.location,requisitionLocation:structuredClone(info.jobRequisitionLocation),
                  secondaryLocations:structuredClone(info.additionalLocations||[])},
                sourceAdditionalLocationCountryScopeUnresolved:asArray(info.additionalLocations).length>0,
                nativeLegalEmployer:asArray(config.nativeWorkdayLegalEmployerNames).includes(detail.hiringOrganization?.name)?detail.hiringOrganization.name:null,
                nativeListingRecord:structuredClone(row),nativeClosingSourceRecord:structuredClone(closingDetail),
                postingDatePrecision:'calendar-date',sourcePostedDateRaw:info.startDate,firstEverPostedAt:null,
                closingDatePrecision:info.endDate?'calendar-date':null,sourceClosingDateIsExact:false,
                sourceNativeFacetSelection:{appliedFacets:structuredClone(appliedFacets),
                  nativeCountryFacet:observed.nativeCountryFacet||null,nativeIndiaLocationFacets:observed.nativeIndiaLocationFacets||null},
                })
              }
            }
            if (payload.jobPostings.length && !newPaths) { observed.unresolved.push('native-pagination-no-progress'); break }
            offset += payload.jobPostings.length
            if (offset === total) break
            requireValue(payload.jobPostings.length > 0 && offset < total, 'Workday pagination is incomplete or inconsistent')
          }
          if(config.reconcileWorkdayNativeContext===true){
            requireValue(offset===total,'Selected Workday inventory did not finish within its bounds')
            for(const snapshot of pageSnapshots){
              const closing=await readJson(prefix+'/jobs',{method:'POST',headers:{'Content-Type':'application/json'},body:snapshot.body})
              requireValue(currentWorkdayListingSnapshot(closing)===snapshot.snapshot,'Workday closing selected listing context changed')
            }
            const corporateURL=board.bindingEvidence.officialURL
            const closingPublisher=await read(corporateURL,{cache:'no-store'})
            let closingDeclaration
            if(board.bindingEvidence.bindingMethod==='runtime-current-careers-publisher-declaration'){
              closingDeclaration=await readPublisherDeclaration(closingPublisher,'closing')
              requireValue(closingDeclaration.url===board.url
                &&JSON.stringify(closingDeclaration.context)===JSON.stringify(board.bindingEvidence.publisherDeclaration.context),
              'Workday closing current publisher declaration changed')
            }else{
              const publisher=readNativeDocument(normalizeNativeAttributeBoundaries(closingPublisher.html))
              requireValue(!publisher.nodes(node=>node.tag==='base').length,'Unreviewed closing company document base')
              requireValue(publisher.nodes(node=>node.tag==='a'&&node.attrs.href).some(node=>{
                const current=recruitmentBoard(new URL(node.attrs.href,closingPublisher.url).href)
                return current?.kind==='workday'&&current.origin===board.origin&&current.tenant===board.tenant&&current.site===board.site
              }),'Workday closing current company handoff changed')
            }
            for(const job of jobs.slice(jobsBeforeBoard))Object.assign(job,{
              sourceOfficialBinding:{...board.bindingEvidence,currentHandoffRechecked:true,closingURL:closingPublisher.url,
                ...(closingDeclaration?{closingPublisherDeclaration:closingDeclaration.evidence}:{}),
                closingBodySHA256:sha(closingPublisher.html),companyScopeComplete:false},
              sourceNativeClosingContext:{allSelectedListingPagesRechecked:true,eachFullRoleRechecked:true,
                selectedPages:pageSnapshots.length,selectedReportedTotal:total,companyScopeComplete:false},
            })
          }
        } else if (board.kind === 'keka') {
          await readKekaRecruitment(board, { readPage: read, readRenderer: value => read(value, {}, 'renderer'), readJson, permit,
            matchingEmployer, official, addJob, inventoryRead: value => observed.nativeInventoryReads.push(value),
            recordRead: (row, account) => { observed.nativeRecords++; observeNative({
              scope: 'keka:' + account.origin + ':' + account.identifier + ':' + account.portalName,
              id: row.id, title: row.title, url: account.rolePrefix + row.id }) }, unresolved: value => observed.unresolved.push(value) })
        } else if (board.kind === 'oracle') {
          await readOracleRecruitment(board, { readPage: read, readJson, permit, matchingEmployer, matchingPublisher,
            companyEmployerFlexField: config.oracleCompanyEmployerFlexField || null,
            brandEmploymentDeclaration: config.nativeOracleBrandEmployerDeclaration || null,
            descriptionEmployerDeclaration: config.nativeOracleDescriptionEmployerDeclaration || null,
            roleWorkplaceDeclarations: config.nativeOracleRoleWorkplaceDeclarations || null,
            reviewedPublisherEmployerName: config.nativeOracleCandidateSite ? config.companyName : null,
            requireNativeEmployerName: config.requireNativeEmployerName === true, maxPages, maxDetails,
            canRead: () => observed.requestCount < maxRequests,
            inventoryRead: value => { if (!observed.nativeInventoryReads.some(row => row.surface === value.surface)) observed.nativeInventoryReads.push(value) },
            recordRead: (row, account) => { observed.nativeRecords++; observeNative({ scope: 'oracle:' + account.origin + ':' + account.site,
              id: row.Id, title: row.Title, url: account.publicBase.replace(/\/$/, '') + '/job/' + row.Id })
              if (config.nativeOracleCandidateSite) {
                observed.nativeOracleRecords ||= []
                observed.nativeOracleRecords.push({listing:structuredClone(row),account:structuredClone(account)})
              }
            },
            unresolved: value => observed.unresolved.push(value),
            addJob: native => addJob(config.nativeOracleCandidateSite && !native.employer ? {...native,legalEmployer:null} : native) })
          if (config.nativeOracleCandidateSite) {
            requireValue(board.bindingEvidence.bindingMethod === 'runtime-current-careers-publisher-declaration',
              'Reviewed Oracle candidate site requires its current publisher declaration')
            const closingPublisher = await read(board.bindingEvidence.officialURL, {cache:'no-store'})
            const closingDeclaration = await readPublisherDeclaration(closingPublisher, 'closing')
            requireValue(closingDeclaration.url === board.url
              && JSON.stringify(closingDeclaration.context) === JSON.stringify(board.bindingEvidence.publisherDeclaration.context),
            'Oracle closing current publisher declaration changed')
            for (const job of jobs.slice(jobsBeforeBoard)) job.sourceOfficialBinding = {
              ...board.bindingEvidence,currentHandoffRechecked:true,closingURL:closingPublisher.url,
              closingPublisherDeclaration:closingDeclaration.evidence,closingBodySHA256:sha(closingPublisher.html),companyScopeComplete:false,
            }
          }
        }
      } catch (error) {
        if(board.kind==='workday'&&config.reconcileWorkdayNativeContext===true || board.kind==='oracle'&&config.nativeOracleCandidateSite)jobs.splice(jobsBeforeBoard)
        problem('native-' + board.kind, error)
      }
    }
    signal.throwIfAborted()
    observed.returnedIndiaJobs = jobs.length
    observed.unresolved = [...new Set(observed.unresolved)]
    observed.boards = [...boards.values()]
    const reviewedOracleFailure = config.nativeOracleCandidateSite && failures.some(row =>
      ['current-publisher-declaration','native-oracle'].includes(row.stage))
    if (reviewedOracleFailure) { jobs.splice(0); observed.returnedIndiaJobs = 0 }
    if (reviewedOracleFailure || !jobs.length && observed.nativeRecords === 0 && !observed.nativeInventoryReads.length) {
      if (!boards.size && receipts.some(row => row.status === 200 && row.format === 'page')) observed.unresolved.push('current-native-recruitment-contract-not-discovered')
      const error = Object.assign(new Error(`[${config.source}] Current verified recruitment inventory is unavailable`),
        { softFailure: true, upstreamOutage: false, abortRetries: true, failureKind: 'coverage_gap', recruitmentObservations: observed })
      addFailureDiagnostics(error, failureCauses, failures, receipts)
      throw error
    }
    const summary = failureSummary(failures)
    const reason = 'runtime-first-party-recruitment;source-scope-unverified;cleanup-forbidden;failures=' + failures.length
    attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: root?.href || homepage.href, firstParty: receipts.some(row => row.status === 200),
      listingComplete: false, pagesFetched: receipts.length, reportedTotal: null, indiaFacetCount: null,
      verifiedAt: now, reason: (reason + (summary ? '; diagnostic=' + summary : '')).slice(0, 1600) })
    Object.defineProperty(jobs, RECRUITMENT_OBSERVATIONS, { value: observed })
    observationAccounting.attach(jobs)
    // Accounting supplies the authoritative observation snapshot. Add the full
    // successful ATS models afterwards so its summary fallback cannot erase
    // foreign/unknown/intake rows or merge independent native board payloads.
    if (nativeBoards.length) Object.defineProperty(jobs, 'nativeCollectionEvidence', {
      value: { source: config.source, sourceScopeComplete: false,
        companyGlobalTotal: null, companyIndiaTotal: null,
        ...(readSourceObservationEvidence(jobs, config.source) || {}), nativeBoards },
      configurable: true,
    })
    return jobs
  } }
}
