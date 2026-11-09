import { createHash } from 'node:crypto'
import { readClassplusClientReferences, verifyClassplusClientContract, CLASSPLUS_LIST_API, CLASSPLUS_DETAIL_API } from './nativeContract.js'
import { readNativeDocument, decodeNativeEntities, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const CAREERS_URL = 'https://classplusapp.com/careers/open-role'
export const DETAIL_URL = 'https://classplusapp.com/careers/job-description?jobId='
const clean = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const fail = reason => { throw Error('Classplus native inventory: ' + reason) }
const hash = value => createHash('sha256').update(value).digest('hex')
const nonemptyCriteria = value => value != null && (typeof value === 'string' ? Boolean(value.trim())
  : Array.isArray(value) ? value.some(nonemptyCriteria) : typeof value === 'object' ? Object.values(value).some(nonemptyCriteria) : true)
const unsafeDescriptionPresentation = html => {
  // Check raw attributes before the shared reader omits inactive nodes. Entity
  // decoding and CSS comment removal also cover encoded/unquoted opacity rules.
  const source = decodeNativeEntities(html).replace(/<!--[\s\S]*?(?:-->|$)/g, '')
  for (const match of source.matchAll(/<([a-z][a-z\d:-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi)) {
    if (/^(?:script|style|title|head|meta|link|base|noscript|template|textarea|iframe|object|input|form|xmp|noembed|noframes|plaintext)$/i.test(match[1])) return true
    const attrs = new Map()
    for (const a of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const key = a[1].toLowerCase()
      if (attrs.has(key)) return true
      attrs.set(key, decodeNativeEntities(a[2] ?? a[3] ?? a[4] ?? ''))
    }
    if (attrs.has('hidden') || attrs.has('inert') || /^true$/i.test(attrs.get('aria-hidden') || '')) return true
    const style = (attrs.get('style') || '').replace(/\/\*[\s\S]*?\*\//g, '')
    if (/\\|@import/i.test(style)) return true
    for (const declaration of style.split(';').filter(value => value.trim())) {
      // The current live inventory has no styled details to qualify. Only
      // numeric positive opacity has a proven visible projection here; other
      // inline styles can hide text through contrast or layout and stay partial.
      const opacity = declaration.match(/^\s*opacity\s*:\s*([\s\S]*)$/i)
      if (!opacity) return true
      const value = opacity[1].replace(/\s*!\s*important\s*$/i, '').trim()
      // CSS numbers permit leading zeros, signs and exponents. Negative values
      // clamp to zero; unsupported expressions cannot prove visible criteria.
      const number = value.match(/^([+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?)(%)?$/i)
      if (!number || !Number.isFinite(Number(number[1])) || Number(number[1]) <= 0) return true
    }
  }
  return false
}
const countryNames = new Map([['in', 'India'], ['ind', 'India'], ['india', 'India']])
const names = new Intl.DisplayNames(['en'], { type: 'region' })
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = names.of(code)
  if (name && name !== code && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)) { countryNames.set(code.toLowerCase(), name); countryNames.set(name.toLowerCase(), name) }
}
const rowIdentity = row => JSON.stringify([row.jobId, row.title, row.department, row.parentDepartment, row.locationCity, row.employeeType])
export const extractClassplusRows = payload => {
  if (!payload || !Array.isArray(payload.data?.Jobs) || payload.message !== 'Jobs Fetched Successfully' || payload.error || payload.errors) fail('malformed or unsuccessful native listing envelope')
  const ids = new Set()
  for (const row of payload.data.Jobs) {
    if (!row || !['string', 'number'].includes(typeof row.jobId) || !clean(String(row.jobId)) || !clean(row.title) || !clean(row.locationCity)
      || !clean(row.department) || !clean(row.parentDepartment) || !clean(row.employeeType) || ids.has(String(row.jobId))) fail('missing or duplicate native listing identity')
    ids.add(String(row.jobId))
  }
  return payload.data.Jobs
}
const explicitCountry = role => {
  const values = [role.locationCountry, role.country, role.countryCode].filter(v => v != null && v !== '')
  if (!values.length) return null
  const normalized = values.map(v => countryNames.get(clean(v).toLowerCase()))
  return normalized.every(v => v && v === normalized[0]) ? normalized[0] : null
}
const nativeDate = value => {
  if (value == null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return undefined
  const parsed = new Date(value)
  if (!Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== value.slice(0, 10)) return undefined
  return value.length === 10 ? value : parsed.toISOString()
}
const applyContext = (value, id) => {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return null
    if (url.hostname === 'classplusapp.com' && ['/careers/apply', '/careers/job-description'].includes(url.pathname)
      && url.searchParams.getAll('jobId').length === 1 && url.searchParams.get('jobId') === id && [...url.searchParams.keys()].every(k => k === 'jobId')) return url.href
    // External links are kept only when the native value is a role-specific
    // public job/apply URL. They are never fetched or submitted by this scraper.
    if (url.searchParams.size === 0 && /\/(?:jobs?|positions?|apply|requisitions?)\/(?:[^/]+\/)*[^/]{3,}\/?$/i.test(url.pathname)
      && !/\/(?:login|register|profile|signup|account)(?:\/|$)/i.test(url.pathname)) return url.href
  } catch { /* Invalid native URL is unresolved apply context. */ }
  return null
}
export const parseClassplusDetail = (payload, row, { now, reasons, audit }) => {
  const role = payload?.data?.JobDescription, id = String(row.jobId)
  const missing = reason => { reasons.add(reason + ':' + id); return null }
  if (!role || typeof role !== 'object' || Array.isArray(role) || payload.error || payload.errors) return missing('native-detail-envelope-unresolved')
  audit.detailsFetched++
  if (role.jobId != null && String(role.jobId) !== id || clean(role.designation) !== clean(row.title)
    || clean(role.locationCity) !== clean(row.locationCity) || clean(role.department) !== clean(row.department)
    || clean(role.parentDepartment) !== clean(row.parentDepartment) || clean(role.employeeType) !== clean(row.employeeType)) return missing('native-list-detail-identity-mismatch')
  const employers = [role.company, role.companyName, role.employerName].filter(v => v != null && v !== '')
  if (employers.some(v => !/^Classplus$/i.test(clean(v)))) return missing('native-employer-mismatch')
  if (row.department === 'VIDU') { audit.clientExcludedEmployerUnknownCount++; return missing('native-client-excluded-employer-hierarchy-unresolved') }
  if (['isPublished', 'isActive', 'published', 'active'].some(k => Object.hasOwn(role, k) && role[k] !== true)
    || ['closed', 'isClosed', 'archived'].some(k => Object.hasOwn(role, k) && role[k] !== false)) return missing('native-role-not-open')
  const country = explicitCountry(role)
  if (!country) { audit.unknownCountryCount++; return missing('native-job-country-unresolved') }
  if (country === 'India') audit.nativeIndiaCount++
  else audit.foreignCountryCount++
  // createdAt, updatedAt and ambiguous postingDate are preserved as raw context,
  // never promoted to original publication. datePosted/validThrough carry the
  // explicit job publication/expiry semantics if the API supplies them.
  const posted = nativeDate(role.datePosted), closing = nativeDate(role.validThrough)
  if (posted === undefined || closing === undefined) return missing('native-job-date-invalid')
  if (posted && Date.parse(posted) > Date.parse(now)) return missing('native-job-publication-in-future')
  if (closing) {
    if (closing.length === 10) return missing('native-expiry-timezone-unresolved')
    if (Date.parse(closing) <= Date.parse(now)) return missing('native-role-expired')
  }
  if (typeof role.jobDescription !== 'string') return missing('native-full-description-missing')
  const html = /&(?:lt|#0*60|#x0*3c);/i.test(role.jobDescription) ? decodeNativeEntities(role.jobDescription) : role.jobDescription
  if (unsafeDescriptionPresentation(html)) return missing('native-description-visibility-unresolved')
  if (Object.entries(role).some(([key, value]) => /qualif|skills|education|requirements|responsibilities|experienceRequired/i.test(key) && nonemptyCriteria(value))) {
    return missing('native-additional-criteria-presentation-unresolved')
  }
  const document = readNativeDocument(html)
  if (document.nodes(n => ['script', 'style', 'iframe', 'object', 'input', 'form'].includes(n.tag)).length) return missing('native-description-active-content-unresolved')
  const description = extractActiveDescription(html)
  if (!description || description.length < 80 || /\b(?:read more|see attached|job description attached)\b/i.test(description)) return missing('native-full-description-missing')
  audit.fullDetailCount++
  const applyUrl = applyContext(role.jobLink, id)
  if (!applyUrl) return missing('native-apply-context-unresolved')
  if (country !== 'India') return null
  const sourceUrl = DETAIL_URL + encodeURIComponent(id)
  const mode = clean(role.remoteStatus || role.workplaceType)
  const remoteStatus = /^(?:remote|hybrid|on-site|onsite)$/i.test(mode) ? /^remote$/i.test(mode) ? 'Remote' : /^hybrid$/i.test(mode) ? 'Hybrid' : 'On-site' : null
  const experience = [role.experienceFrom, role.experienceTo].map(v => typeof v === 'number' || typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN)
  return { source: 'classplus', company: 'Classplus', title: clean(role.designation), jobId: id,
    requisitionId: clean(role.requisitionId) || null, department: clean(role.department), parentDepartment: clean(role.parentDepartment),
    location: clean(role.locationCity), city: /^remote$/i.test(clean(role.locationCity)) ? null : clean(role.locationCity), country,
    sourceUrl, applyUrl, link: applyUrl, employmentType: clean(role.employeeType), remoteStatus,
    experienceRequired: experience.every(v => Number.isFinite(v) && v >= 0) && experience[1] >= experience[0] ? `${experience[0]}-${experience[1]} years` : null,
    minimumQualification: null, preferredQualification: null, requiredSkills: [],
    postingDate: posted, closingDate: closing, sourcePublicationDateUnavailable: !posted,
    jobDescription: description, sourceDescription: description, sourceDetailComplete: true, nativeDescriptionSHA256: hash(description),
    sourceNativeEmployerEvidence: { brand: 'Classplus', publicClient: CAREERS_URL, explicitEmployer: employers[0] || null, legalEmployer: null },
    sourceNativeCountryEvidence: { locationCountry: role.locationCountry ?? null, country: role.country ?? null, countryCode: role.countryCode ?? null },
    sourceNativeDates: { datePosted: role.datePosted ?? null, validThrough: role.validThrough ?? null, ambiguousPostingDate: role.postingDate ?? null,
      createdAt: role.createdAt ?? null, updatedAt: role.updatedAt ?? null }, scrapedAt: now }
}
const defaultFetchPage = async (url, init) => {
  const response = await fetch(url, { ...init, redirect: 'follow' })
  if ([401, 403, 429].includes(response.status)) return { url: response.url, status: response.status, body: '' }
  return { url: response.url, status: response.status, body: await response.text() }
}
export const createClassplusNativeInventory = (defaults = {}) => ({
  async run(options = {}) {
    const settings = { ...defaults, ...options }, signal = settings.signal, load = settings.fetchPage || defaultFetchPage
    const now = new Date((settings.now || (() => new Date().toISOString()))()).toISOString()
    const maxJobs = settings.maxJobs ?? null
    if (maxJobs != null && (!Number.isSafeInteger(maxJobs) || maxJobs < 0)) fail('invalid output cap')
    const reasons = new Set(), audit = { nativeGlobalCount: null, nativeIndiaCount: 0, foreignCountryCount: 0, unknownCountryCount: 0,
      clientExcludedEmployerUnknownCount: 0, detailsFetched: 0, fullDetailCount: 0, eligibleCount: 0, listingPagesFetched: 0 }
    const request = async url => {
      signal?.throwIfAborted()
      const packet = await load(url, { method: 'GET', headers: { Accept: url.startsWith('https://crm.classplus.co/') ? 'application/json' : 'text/html,application/javascript' },
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000) })
      signal?.throwIfAborted()
      if (packet?.status !== 200) { const error = Error('Classplus public jobs HTTP ' + packet?.status); error.status = packet?.status; throw error }
      if (packet.url !== url && !(url === CLASSPLUS_LIST_API && packet.url === url.slice(0, -1))) fail('public response redirected outside current binding')
      if (typeof packet.body !== 'string' || Buffer.byteLength(packet.body) > 8 * 1024 * 1024) fail('public response format/budget changed')
      return packet.body
    }
    const jsonAt = async url => { const body = await request(url); try { return JSON.parse(body) } catch { fail('public jobs JSON unavailable') } }
    const page = await request(CAREERS_URL), refs = readClassplusClientReferences(page)
    const main = await request(refs.mainUrl), listing = await request(refs.listUrl), detail = await request(refs.detailUrl)
    audit.clientContract = verifyClassplusClientContract({ main, listing, detail })
    const readList = async () => {
      const payload = await jsonAt(CLASSPLUS_LIST_API); audit.listingPagesFetched++
      const rows = extractClassplusRows(payload)
      // The currently executable client is unpaginated. Unexpected server
      // pagination metadata invalidates whole-inventory claims immediately.
      for (const object of [payload, payload.data]) for (const [key, value] of Object.entries(object)) {
        if (/^(?:next|nextPage|nextCursor|hasMore|cursor|page|pageSize|limit|offset|total|count|totalCount)$/i.test(key)) {
          if (/^(?:total|count|totalCount)$/i.test(key) && value === rows.length) continue
          reasons.add('native-server-pagination-or-count-contract-changed')
        }
      }
      return rows
    }
    const initial = await readList(), jobs = []; audit.nativeGlobalCount = initial.length
    if (initial.length > 1000) fail('native enumeration budget exceeded')
    for (const row of initial) {
      let payload
      try { payload = await jsonAt(CLASSPLUS_DETAIL_API + encodeURIComponent(String(row.jobId))) }
      catch (error) { signal?.throwIfAborted(); if ([401, 403, 429].includes(error.status)) throw error; reasons.add('native-detail-unavailable:' + String(row.jobId)); continue }
      const job = parseClassplusDetail(payload, row, { now, reasons, audit })
      if (job) jobs.push(job)
    }
    const closing = await readList()
    const state = rows => rows.map(rowIdentity).sort().join('\n')
    if (state(initial) !== state(closing)) reasons.add('closing-native-inventory-changed')
    const selected = maxJobs == null ? jobs : jobs.slice(0, maxJobs)
    if (selected.length !== jobs.length) reasons.add('native-output-cap')
    const nativeListingComplete = reasons.size === 0
    // This directly reachable first-party careers app is not advertised by the
    // current corporate SPA. Its complete board cannot establish the employer's
    // whole recruiting universe or the client-excluded VIDU hierarchy.
    reasons.add('whole-employer-careers-universe-unverified')
    const complete = false
    for (const job of selected) Object.assign(job, { sourceListingComplete: nativeListingComplete, sourceScopeComplete: false, lifecycleCleanupAllowed: false })
    Object.assign(audit, { eligibleCount: selected.length, nativeListingComplete, listingComplete: complete, sourceScopeComplete: false, lifecycleCleanupAllowed: false, reasons: [...reasons],
      descriptionChecks: jobs.map(j => ({ id: j.jobId, textLength: j.sourceDescription.length, sha256: j.nativeDescriptionSHA256 })) })
    settings.onNativeAudit?.(audit)
    return attachInventoryEvidence(selected, { status: complete ? initial.length ? 'complete-inventory' : 'verified-empty' : 'discovery-only',
      surface: CLASSPLUS_LIST_API, firstParty: true, listingComplete: complete, pagesFetched: audit.listingPagesFetched,
      reportedTotal: initial.length, indiaFacetCount: complete ? audit.nativeIndiaCount : null, verifiedAt: now,
      reason: complete ? 'classplus-current-public-client-and-stable-complete-native-inventory' : 'classplus-native-incomplete:' + [...reasons].join(';') })
  },
})
