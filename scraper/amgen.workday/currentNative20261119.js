import { createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { decodeHTML } from 'entities'
import { boundedDeclaredPublicGet } from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import { readJobPosting, nodeText, geography, countryName } from '../../scraper-support/native-sources/jobPostingData.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { nativeLines, descendants, comparable } from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import { readOriginalNativeCriteria } from '../../scraper-support/native-sources/currentNativeCriteria20261106.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import PROFILE_DATA from './currentProfile20261119.json' with { type: 'json' }

// This file is intentionally source local while the shared native readers are
// frozen for independently running captures. No challenge or alternate transport.
export const PROFILE = Object.freeze(PROFILE_DATA)
const failure = message => Object.assign(Error(PROFILE.source + ' current native publication: ' + message), {
 softFailure: true, abortRetries: true, lifecycleCleanupAllowed: false,
})
const need = (value, message) => { if (!value) throw failure(message) }
const one = (rows, label) => { need(rows.length === 1, 'Missing or ambiguous ' + label); return rows[0] }
const clean = value => decodeHTML(String(value ?? '')).replace(/\s+/g, ' ').trim()
const hasClass = (node, value) => (node.attrs.class ?? '').split(/\s+/).includes(value)
const all = node => [node, ...node.children.filter(child => typeof child !== 'string').flatMap(all)]

const presentationPaths = (document, nodes) => {
 const parents = new Map(), root = document.nodes(node => node.tag === 'root')[0]
 for (const node of all(root)) for (const child of node.children) if (typeof child !== 'string') parents.set(child, node)
 const selected = new Set()
 for (let node of nodes) while (node) { selected.add(node); node = parents.get(node) }
 return [...selected]
}
const presentationSignatures = nodes => [...new Set(nodes.flatMap(node => Object.entries(node.attrs)
 .filter(([key]) => ['class','style','id'].includes(key)).map(([attribute,value]) => JSON.stringify([node.tag,attribute,value]))))]
 .sort().map(value => JSON.parse(value))
const approvedPresentation = (signatures, approved) => {
 const known = new Set(approved.map(value => JSON.stringify(value)))
 return signatures.every(value => known.has(JSON.stringify(value)))
}

const roleURL = value => {
 try { const u = new URL(value); return u.origin === PROFILE.origin && !u.username && !u.password && !u.search && !u.hash && new RegExp(PROFILE.rolePath).test(u.pathname) }
 catch { return false }
}
const links = (document, base) => document.nodes(node => node.tag === 'a' && node.attrs.href).flatMap(node => {
 try { return [{ url: new URL(node.attrs.href, base).href, text: nodeText(node), attrs: node.attrs, node }] } catch { return [] }
})
function ownedDocument(html, url, requireCanonical = false) {
 need(typeof html === 'string' && html.length > 0, 'Missing native HTML')
 const parsed = readJobPosting(html), document = parsed.document
 const root = one(document.nodes(node => node.tag === 'root'), 'document root'), nodes = all(root)
 need(!nodes.some(node => node.tag === 'base' || node.tag === 'meta' && (node.attrs['http-equiv'] ?? '').toLowerCase() === 'refresh'), 'Unreviewed document base or navigation')
 one(nodes.filter(node => node.tag === 'html'), 'owned HTML document')
 const head = one(nodes.filter(node => node.tag === 'head'), 'owned head'), body = one(nodes.filter(node => node.tag === 'body'), 'owned body')
 need(!head.inert && !body.inert, 'Native document authority is hidden')
 const canonicals = nodes.filter(node => node.tag === 'link' && (node.attrs.rel ?? '').toLowerCase().split(/\s+/).includes('canonical'))
 need(canonicals.length <= 1 && (!requireCanonical || canonicals.length === 1) && canonicals.every(node => head.children.includes(node) && node.attrs.href === url), 'Foreign or ambiguous native canonical')
 const title = one(nodes.filter(node => node.tag === 'title'), 'document title')
 need(head.children.includes(title), 'Native title is outside head')
 const visible = readVisibleNativeDocument(html, { strict: true })
 return { ...parsed, document, visible, title: clean(title.raw), root }
}
function nativeCalendar(value) {
 if (typeof value !== 'string') return null
 let match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/)
 let year, month, day
 if (match) [, year, month, day] = match
 else if ((match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) [, month, day, year] = match
 else if ((match = value.match(/^([A-Z][a-z]+)\.?\s+(\d{1,2}),\s+(\d{4})$/))) {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const index = months.findIndex(name => name === match[1] || name.slice(0,3) === match[1])
  if (index < 0) return null
  month = index + 1; day = match[2]; year = match[3]
 } else return null
 const calendar = [String(year).padStart(4,'0'), String(month).padStart(2,'0'), String(day).padStart(2,'0')].join('-')
 const date = new Date(calendar + 'T00:00:00Z')
 if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== calendar || Number(year) < 1900) return null
 if (value.includes('T') && !Number.isFinite(Date.parse(value))) return null
 return calendar
}
export function parseCurrentIndex(html) {
 const { visible } = ownedDocument(html, PROFILE.indexURL), rows = [], seen = new Set()
 const container = one(visible.nodes(node => node.attrs.id === 'search-results-list'), 'current search result list')
 for (const anchor of descendants(container, node => node.tag === 'a' && node.attrs.href)) {
  let url; try { url = new URL(anchor.attrs.href, PROFILE.indexURL).href } catch { continue }
  if (!roleURL(url)) continue
  const headings = descendants(anchor, node => /^h[1-6]$/.test(node.tag)), heading = one(headings, 'native role card title')
  const title = clean(nodeText(heading)); need(title && !seen.has(url), 'Duplicate or empty native role card')
  seen.add(url)
  const dates = descendants(anchor, node => node.tag === 'span' && /(?:date|posted)/i.test(node.attrs.class ?? '') || node.tag === 'time')
   .map(node => ({ raw: nodeText(node), datetime: node.attrs.datetime ?? null }))
  rows.push({ sourceUrl: url, title, nativeCardText: nodeText(anchor), nativeCardDates: dates,
   publisherJobId: new URL(url).pathname.split('/').at(-1) })
 }
 need(rows.length > 0 && rows.length <= 32, 'Missing or excessive native result cohort')
 return rows
}
const modelFields = new Set(['@context','@type','baseSalary','datePosted','description','educationRequirements','employmentType','identifier','industry','title','url','workHours','directApply','hiringOrganization','jobLocation','validThrough'])
export function parseCurrentRole(html, listing, observedAt) {
 need(roleURL(listing.sourceUrl), 'Unbound native role identity')
 const now = new Date(observedAt); need(Number.isFinite(now.getTime()), 'Invalid native observation clock')
 const expectedCanonical = PROFILE.canonicalAliases?.[listing.sourceUrl] ?? listing.sourceUrl
 const { candidate, errors, visible, document, title: pageTitle } = ownedDocument(html, expectedCanonical, PROFILE.roleRequireCanonical !== false)
 need(errors.length === 0 && candidate, 'Missing, invalid or ambiguous native JobPosting')
 const model = candidate.model
 need(Object.keys(model).every(key => modelFields.has(key)), 'Unreviewed native role state, date or scope carrier')
 need(model['@type'] === 'JobPosting' && ['http://schema.org','https://schema.org'].includes(model['@context'])
  && model.hiringOrganization?.['@type'] === 'Organization' && model.hiringOrganization.name === PROFILE.company && Object.keys(model.hiringOrganization).every(key => ['@type','name','logo'].includes(key)), 'Native employer identity changed')
 need(model.url === listing.sourceUrl && clean(model.title) === listing.title && pageTitle === listing.title + PROFILE.titleSuffix, 'Native role title or URL changed')
 const sections = visible.nodes(node => node.tag === 'section' && node.attrs['data-selector-name'] === 'jobdetails')
 const section = one(sections, 'active native role owner')
 need(section.attrs['data-job-id'] === listing.publisherJobId && section.attrs['data-org-id'] === PROFILE.roleOrg, 'Native publisher role identity disagrees')
 const headingOwner = PROFILE.headingOwner ? one(descendants(section, node => hasClass(node, PROFILE.headingOwner)), 'native heading owner') : section
 const headings = descendants(headingOwner, node => node.tag === PROFILE.headingTag && clean(nodeText(node)) === listing.title)
 one(headings, 'visible native role heading')
 need(!all(section).some(node => ['script','iframe','frame','frameset','object','embed','template','base'].includes(node.tag)
  || Object.hasOwn(node.attrs, 'srcdoc') || Object.keys(node.attrs).some(key => /^on[a-z]/.test(key))), 'Unreviewed role or application program')
 need(!all(document.nodes(node => node.tag === 'root')[0]).some(node => /^(?:addressCountry|datePosted|validThrough|hiringOrganization|jobLocation|identifier|jobStatus)$/i.test(node.attrs.itemprop ?? '')
  || /(?:^|\s)https?:\/\/schema\.org\/JobPosting(?:\s|$)/i.test(node.attrs.itemtype ?? '')), 'Unreviewed additional native role authority')
 const metadata = name => one(document.nodes(node => node.tag === 'meta' && node.attrs.name === name), 'native ' + name).attrs.content
 const requisitionId = model.identifier?.value
 need(model.identifier?.name === 'Job ID' && typeof requisitionId === 'string' && new RegExp(PROFILE.requisition).test(requisitionId)
  && metadata('job-ats-req-id') === requisitionId && clean(metadata('job-tbcn-job-title')) === listing.title, 'Native requisition or title metadata disagrees')
 const idNode = one(descendants(section, node => node.tag === 'span' && hasClass(node, 'job-id')), 'visible requisition')
 need(clean(nodeText(idNode)).replace(/^(?:JOB ID:|Job ID)\s*/, '') === requisitionId, 'Visible native requisition disagrees')
 const applications = descendants(section, node => node.tag === 'a' && node.attrs['data-selector-name'] === 'job-apply-link')
 need(applications.length >= 1 && applications.length <= 2, 'Missing active native application')
 const nativeApply = applications.map(node => {
  const attrs = node.attrs, url = new URL(attrs.href, listing.sourceUrl)
  need(url.origin === PROFILE.applyOrigin && !url.search && !url.hash && !url.username && !url.password
   && new RegExp(PROFILE.applyPathPrefix + '[^/]+/[^/]+_' + requisitionId + '(?:-\\d+)?/apply$').test(url.pathname)
   && attrs['data-apply-url'] === url.href && attrs['data-job-id'] === listing.publisherJobId
   && attrs['data-job-organization-id'] === PROFILE.roleOrg && attrs['data-delay-url'] === 'False'
   && attrs['data-override-candidate-card'] === 'False' && !Object.hasOwn(attrs, 'disabled')
   && !Object.keys(attrs).some(key => /^on[a-z]/.test(key)) && !['true','1'].includes(attrs['aria-disabled'])
   && /^(?:Apply|Apply Now)$/.test(nodeText(node)), 'Inactive, foreign or unbound native application')
  return { url: url.href, attrs: { ...attrs }, text: nodeText(node) }
 })
 need(new Set(nativeApply.map(row => row.url)).size === 1, 'Ambiguous native applications')
 const geo = geography(model)
 need(!geo.unresolved && geo.country !== null && geo.countries.length === 1, 'Unknown or mixed native workplace countries')
 const locationCarrier = metadata('gtm_tbcn_location')
 const countries = locationCarrier.split('|').map(value => value.split('~').at(-1))
 need(countries.length > 0 && countries.every(country => country === geo.country), 'Native country carriers disagree')
 if (PROFILE.source !== 'carrier') {
  const locations = descendants(section, node => node.tag === 'span' && hasClass(node, PROFILE.locationClass))
  need(locations.length >= 1 && locations.every(node => nodeText(node).includes(geo.country)), 'Visible native country missing or foreign')
 } else {
  const visibleLocations = descendants(section, node => node.tag === 'p' && hasClass(node, 'job-location'))
  need(visibleLocations.length === 1, 'Native visible worksite owner changed')
  const explicitCountries = nativeLines(visibleLocations[0]).map(line => countryName(line.split(',').at(-1).replace(/\s*\(inactive\)$/, '').trim())).filter(Boolean)
  need(explicitCountries.every(country => country === geo.country), 'Native visible workplace countries disagree')
  // Carrier's native view combines multiple typed worksites into one paragraph;
  // one India address is countryless. Country comes from every own typed postal
  // address AND every native GTM worksite tuple, never that incomplete address.

 }
 const publicationDates = []
 const recordDate = (raw, origin) => { const calendar = nativeCalendar(raw); need(calendar, 'Invalid native posting calendar'); need(calendar <= now.toISOString().slice(0,10), 'Future native posting calendar'); publicationDates.push({ origin, raw, calendar }) }
 if (model.datePosted != null && model.datePosted !== '') recordDate(model.datePosted, 'JobPosting.datePosted')
 const visibleDateNodes = descendants(section, node => node.tag === 'span' && hasClass(node, PROFILE.dateClass) && nodeText(node).startsWith(PROFILE.datePrefix))
 need(visibleDateNodes.length >= 1, 'Native visible posting carrier missing')
 for (const node of visibleDateNodes) recordDate(nodeText(node).replace(PROFILE.datePrefix, '').trim(), 'visible-role-posting-date')
 for (const row of listing.nativeCardDates) {
  const raw = row.datetime ?? row.raw
  if (raw) recordDate(raw, 'visible-role-card-date')
 }
 let closingDate = null
 if (model.validThrough != null && model.validThrough !== '') {
  closingDate = nativeCalendar(model.validThrough); need(closingDate, 'Invalid native application deadline')
  need(model.validThrough.includes('T') ? Date.parse(model.validThrough) >= now.getTime() : closingDate >= now.toISOString().slice(0,10), 'Native role application deadline expired')
 }
 const roleText = nodeText(section)
 need(!/\b(?:this|the)\s+(?:job|role|vacancy|position)\s+(?:is\s+(?:closed|no longer available|not available)|has\s+(?:closed|been\s+(?:closed|filled)))\b/i.test(roleText), 'Native role is explicitly closed')
 const primaryPresentation = presentationSignatures(presentationPaths(visible, [section,...headings,idNode,...applications,
  ...descendants(section, node => hasClass(node, PROFILE.locationClass))]))
 need(approvedPresentation(primaryPresentation, PROFILE.approvedPrimaryPresentation), 'Unreviewed primary role or application presentation')
 const criteria = readOriginalNativeCriteria(typeof model.description === 'string' ? model.description : '', failure)
 const ats = descendants(section, node => node.tag === 'div' && hasClass(node, 'ats-description'))
 let visibleCriteria = ats.length === 1 ? nativeLines(ats[0]).join('\n') : ''
 if (PROFILE.source === 'capitalone') visibleCriteria = visibleCriteria.replace(/^Overview\s*/, '')
 const criteriaPresentation = ats.length === 1 ? presentationSignatures([...all(ats[0]),...presentationPaths(visible,[ats[0]])]) : []
 const criteriaPresentationApproved = approvedPresentation(criteriaPresentation, PROFILE.approvedCriteriaPresentation)
 const complete = criteriaPresentationApproved && criteria.sourceDetailComplete && comparable(decodeHTML(visibleCriteria)) === comparable(decodeHTML(criteria.sourceDescription))
 const dateValues = [...new Set(publicationDates.map(row => row.calendar))].sort()
 return { jobId: PROFILE.source + '-' + requisitionId, requisitionId, publisherJobId: listing.publisherJobId, title: listing.title,
  sourceUrl: listing.sourceUrl, sourceCanonicalURL: expectedCanonical, applyUrl: nativeApply[0].url, nativeApplyLinks: nativeApply,
  country: geo.country, city: geo.city, state: geo.state, location: geo.location ?? geo.locations.join(' / '), locations: geo.locations,
  sourceNativeCountryCodes: geo.countries, sourceNativeLocationCarrier: locationCarrier,
  sourceNativeWorkplacePresentation: descendants(section, node => hasClass(node, PROFILE.locationClass)).map(node => ({tag:node.tag,attrs:{...node.attrs},text:nodeText(node)})), sourceCountryScopeUnresolved: false, sourceNativeJobLocations: geo.originalJobLocations,
  nativeEmployerDisplayName: PROFILE.company, nativeEmployer: null, sourceLegalEmployer: null,
  employmentType: clean(model.employmentType) || null, nativeIndustry: model.industry ?? null,
  postingDate: dateValues[0] ?? null, closingDate, sourceNativePublicationDates: publicationDates,
  sourceNativePublicationDateConflict: dateValues.length > 1,
  sourcePublicationDatePolicy: 'earliest-original-authored-calendar-for-aging;all-native-carriers-retained;timezone-and-first-publication-semantics-unresolved',
  jobDescription: complete ? criteria.jobDescription : null, sourceDescription: complete ? criteria.sourceDescription : null,
  sourceDescriptionHTML: typeof model.description === 'string' ? model.description : null,
  sourceDescriptionLines: criteria.sourceDescriptionLines, sourceDetailComplete: complete,
  sourceDetailFailureKind: complete ? null : !criteriaPresentationApproved ? 'native-criteria-presentation-requires-review' : criteria.sourceDetailFailureKind ?? 'native-visible-criteria-unavailable-or-disagreeing',
  sourceNativeCriticalPresentation: { primary: primaryPresentation, criteria: criteriaPresentation },
  sourceNativeVisibleCriteriaText: visibleCriteria || null, sourceNativeJobPosting: model, sourceNativeJobPostingOriginal: candidate.raw,
  sourceNativeDocumentHTML: html, sourceNativeCard: listing,
  sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
  backendApplicationActivationVerified: false,
 }
}
function createReader(options) {
 const caller = options.signal; caller?.throwIfAborted()
 const sourceTimeoutMs = options.sourceTimeoutMs ?? 180000, requestTimeoutMs = options.requestTimeoutMs ?? 15000
 need(Number.isSafeInteger(sourceTimeoutMs) && sourceTimeoutMs > 0 && sourceTimeoutMs <= 180000 && Number.isSafeInteger(requestTimeoutMs) && requestTimeoutMs > 0 && requestTimeoutMs <= 15000, 'Invalid source or request budget')
 const started = performance.now(), controller = new AbortController(), signal = caller ? AbortSignal.any([caller, controller.signal]) : controller.signal
 const timer = setTimeout(() => controller.abort(new DOMException('Native source deadline', 'TimeoutError')), sourceTimeoutMs)
 const permitted = new Set([...PROFILE.chain.map(row => row.url), PROFILE.indexURL]), receipts = []
 let decodedBytes = 0, nextStart = 0
 const check = () => { caller?.throwIfAborted(); if (performance.now() - started >= sourceTimeoutMs && !controller.signal.aborted) controller.abort(new DOMException('Native source deadline', 'TimeoutError')); signal.throwIfAborted() }
 return { check, allowRole(url) { need(roleURL(url), 'Unbound role URL'); permitted.add(url) },
  async read(url, declaration = null) {
   check(); need(permitted.has(url) && receipts.length < 96, 'Unbound URL or exhausted request budget')
   if (nextStart > performance.now()) await delay(nextStart - performance.now(), undefined, { signal })
   check(); nextStart = performance.now() + 500
   const response = await boundedDeclaredPublicGet(url, { signal, timeoutMs: requestTimeoutMs, fetchImpl: (requested, init) => (options.fetchImpl ?? globalThis.fetch)(requested, { ...init, credentials: 'omit', cache: 'no-store' }),
    overflowError: failure('Original response byte budget exceeded') })
   check(); const bytes = Buffer.from(response.bodyBase64, 'base64'); decodedBytes += bytes.length
   const receipt = { requestedUrl: url, url: response.url, status: response.status, headers: response.headers,
    bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), bodyComplete: true }
   receipts.push(receipt); need(decodedBytes <= 32 * 1024 * 1024 && response.url === url, 'Aggregate byte budget or original final URL changed')
   if (declaration?.status === 302) {
    need(response.status === 302 && response.headers.location === declaration.target, 'Native declared redirect changed')
    return { body: null, receipt }
   }
   need(response.status === 200, 'Original public HTTP ' + response.status)
   need(/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers['content-type'] ?? ''), 'Unexpected native HTML MIME')
   const body = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
   check(); return { body, receipt }
  },
  stats: () => ({ requests: receipts.length, decodedBytes, receipts: structuredClone(receipts), sourceTimeoutMs, requestTimeoutMs, nativeRequestIntervalMs: 500 }),
  close() { clearTimeout(timer); controller.abort() },
 }
}
export async function runCurrentNative(options = {}) {
 need(options.maxJobs == null, 'Truncated native observations are unsupported')
 const reader = createReader(options)
 try {
  const observedAt = (typeof options.now === 'function' ? options.now() : options.now) ?? new Date().toISOString()
  need(typeof observedAt === 'string' && Number.isFinite(Date.parse(observedAt)), 'Invalid observation clock')
  const readChain = async () => {
   const bindings = []
   for (const step of PROFILE.chain) {
    const response = await reader.read(step.url, step)
    if (step.status === 302) { bindings.push({ url: step.url, status: 302, target: step.target }); continue }
    const document = ownedDocument(response.body, step.url, step.canonical !== false)
    const current = links(document.visible, step.url)
    need(current.some(row => row.url === step.target && (!step.text || row.text === step.text)), 'Current native employer handoff missing: ' + step.url)
    bindings.push({ url: step.url, status: 200, target: step.target, text: step.text ?? null })
   }
   return bindings
  }
  const openingBindings = await readChain(), opening = await reader.read(PROFILE.indexURL), listings = parseCurrentIndex(opening.body), facts = [], ids = new Set()
  for (const listing of listings) {
   reader.allowRole(listing.sourceUrl)
   const response = await reader.read(listing.sourceUrl), fact = parseCurrentRole(response.body, listing, observedAt)
   need(!ids.has(fact.requisitionId), 'Duplicate native requisition'); ids.add(fact.requisitionId); facts.push(fact); reader.check()
  }
  for (const [index, fact] of facts.entries()) {
   const closing = await reader.read(fact.sourceUrl), checked = parseCurrentRole(closing.body, listings[index], observedAt)
   // Full native model, criteria, application attributes and primary date facts
   // reconcile. Nonsemantic whole-document telemetry is retained separately.
   const semantic = row => { const record = { ...row }; delete record.sourceNativeDocumentHTML; delete record.sourceNativeJobPostingOriginal; return record }
   need(JSON.stringify(semantic(checked)) === JSON.stringify(semantic(fact)), 'Closing native role, criteria, application, geography or dates changed')
  }
  const closing = await reader.read(PROFILE.indexURL)
  need(JSON.stringify(parseCurrentIndex(closing.body)) === JSON.stringify(listings), 'Closing native published result cohort changed')
  const closingBindings = await readChain()
  need(JSON.stringify(openingBindings) === JSON.stringify(closingBindings), 'Closing native employer handoff changed')
  const jobs = facts.filter(row => row.country === 'India').map(row => ({ ...row, source: PROFILE.source, company: PROFILE.company,
   link: row.applyUrl, scrapedAt: observedAt, companyCareerPage: PROFILE.chain[0].url, companyDomain: PROFILE.companyDomain,
   atsPlatform: 'official-company-careers' }))
  const audit = { source: PROFILE.source, recoveryKind: 'current-native-publication-subset', observedRecordCount: listings.length,
   observedVacancyCount: listings.length, observedNativeRoleRecords: facts, returnedRows: jobs.length,
   nativeIndiaCountryMatches: jobs.length, explicitNonIndiaCount: facts.length - jobs.length,
   nativeOpeningClosingRecordsMatch: true, nativeOpeningClosingCriteriaMatch: true, employerOpeningClosingBindings: openingBindings,
   fullCriteriaRecovered: jobs.every(row => row.sourceDetailComplete), fullCriteriaIndiaJobs: jobs.filter(row => row.sourceDetailComplete).length,
   missingCriteriaJobs: jobs.filter(row => !row.sourceDetailComplete).length, backendApplicationActivationVerified: false,
   sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null, lifecycleCleanupAllowed: false,
   sourcePaginationHold: 'observed-current-first-result-page-only;remaining-native-pages-and-whole-company-enumeration-unproven', ...reader.stats() }
  attachSourceObservationEvidence(jobs, { source: PROFILE.source, recordKind: 'vacancy-rows', observedRecordCount: listings.length,
   observedVacancyCount: listings.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit, configurable: true })
  attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: PROFILE.indexURL, firstParty: true, listingComplete: false,
   lifecycleCleanupAllowed: false, pagesFetched: audit.requests, reportedTotal: null, indiaFacetCount: null, verifiedAt: observedAt,
   reason: audit.sourcePaginationHold + ';native-role-identity-country-criteria-application-reconciled;company-and-backend-activation-held' })
  need(Buffer.byteLength(JSON.stringify(jobs)) <= 16 * 1024 * 1024, 'Native output budget exceeded')
  reader.check(); return jobs
 } catch (error) { if (options.signal?.aborted) throw options.signal.reason; throw error }
 finally { reader.close() }
}
