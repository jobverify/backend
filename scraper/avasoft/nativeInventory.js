import { createHash } from 'node:crypto'
import { readNativeDocument, decodeNativeEntities, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { withCurrentPublicProbe } from '../aurobindopharma/publicProbe.js'

const H = 'https://avasoft.com/', C = H + 'career/', A = H + 'contact-us/'
const LOADING_CLIENT_SHA256 = '1284289e77997e4fe3cdb392235b6548d60a278198f2f38d032ba88ee3c8ba4c'
const clean = value => decodeNativeEntities(value).replace(/\s+/g, ' ').trim()
const folded = value => clean(value).toLowerCase()
const hash = value => createHash('sha256').update(value).digest('hex')
const cls = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const children = node => node.children.filter(child => typeof child !== 'string')
const descendants = (node, predicate) => !node || node.inert ? [] : [...(predicate(node) ? [node] : []), ...children(node).flatMap(child => descendants(child, predicate))]
const structural = (node, predicate) => !node || ['template', 'noscript', 'script', 'style', 'object'].includes(node.tag) ? []
  : [...(predicate(node) ? [node] : []), ...children(node).flatMap(child => structural(child, predicate))]
class AvasoftIdentityError extends Error {
  constructor(message) { super('Avasoft native identity: ' + message); this.name = 'AvasoftIdentityError'; this.abortRetries = true }
}
const valid = (condition, message) => { if (!condition) throw new AvasoftIdentityError(message) }
const one = (nodes, label) => { valid(nodes.length === 1, 'expected one ' + label); return nodes[0] }
const parse = value => { try { return JSON.parse(value) } catch { throw new AvasoftIdentityError('invalid native JSON') } }
const allBreakpointsHidden = node => ['desktop', 'laptop', 'tablet', 'mobile'].every(view => cls(node, 'elementor-hidden-' + view))
const visibleDocument = html => {
  const doc = readVisibleNativeDocument(html)
  const project = (node, active = true) => {
    active = active && !node.inert && !allBreakpointsHidden(node)
    return { ...node, inert: !active, children: node.children.map(child => typeof child === 'string' ? child : project(child, active)) }
  }
  const roots = doc.nodes(n => n.tag === 'root').map(node => project(node))
  return { ...doc, nodes: predicate => roots.flatMap(root => descendants(root, predicate)) }
}
const structured = doc => doc.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json').flatMap(node => {
  const value = parse(node.raw); return Array.isArray(value['@graph']) ? value['@graph'] : [value]
})
const countryNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' }), countries = new Map()
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = countryNames.of(code)
  if (name && !['ZZ', 'XA', 'XB', 'UN', 'EU', 'EZ', 'QO'].includes(code)) { countries.set(folded(code), code); countries.set(folded(name), code) }
}
for (const [label, code] of [['USA', 'US'], ['United States of America', 'US'], ['UK', 'GB'], ['Hong Kong', 'HK']]) countries.set(folded(label), code)
const scopes = value => clean(value).split(/\s*(?:\/|;|\|)\s*/).map(label => ({ label, country: countries.get(folded(label.split(',').at(-1))) || null }))
const roleUrl = value => {
  let url
  try { url = new URL(value, H) } catch { throw new AvasoftIdentityError('invalid native role URL') }
  valid(url.origin === new URL(H).origin && /^\/[a-z0-9-]+\/$/.test(url.pathname) && !url.search && !url.hash && !url.username && !url.password
    && ![H, C, A].includes(url.href), 'native role URL identity conflicts')
  return url.href
}
const documentAt = (html, url, reasons) => {
  const raw = readNativeDocument(html), doc = visibleDocument(html)
  valid(one(raw.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical'), 'native canonical').attrs.href === url, 'native canonical identity changed')
  const values = structured(raw), organization = one(values.filter(value => value['@type'] === 'Organization'), 'native employer organization')
  valid(organization.name === 'AVASOFT' && organization['@id'] === H + '#organization' && organization.url === H, 'native employer identity conflicts')
  const main = one(doc.nodes(n => n.tag === 'main' && n.attrs.id === 'content'), 'native main'), rawMain = one(raw.nodes(n => n.tag === 'main' && n.attrs.id === 'content'), 'published native main')
  const page = one(descendants(main, n => n.attrs['data-elementor-type'] === 'wp-page'), 'native WordPress page')
  const pageId = page.attrs['data-elementor-id']
  valid(/^[1-9]\d*$/.test(pageId || '') && cls(main, 'post-' + pageId) && cls(main, 'status-publish'), 'native published document identity conflicts')
  const webPage = one(values.filter(value => value['@type'] === 'WebPage'), 'native webpage metadata')
  valid(webPage['@id'] === url, 'native structured webpage identity conflicts')
  const loading = raw.nodes(n => n.tag === 'script' && !n.attrs.src && !Object.hasOwn(n.attrs, 'nomodule') && /^(?:|text\/javascript|application\/javascript)$/i.test(n.attrs.type || '')
    && (n.raw || '').includes('LoadMorePushAjax'))
  if (loading.length !== 1 || hash(loading[0].raw) !== LOADING_CLIENT_SHA256) reasons.add('unverified-native-loading-client')
  if (descendants(rawMain, n => Object.keys(n.attrs).some(key => /^data-alm|^data-glm|^data-ajax|^data-load/.test(key))
    || cls(n, 'ald-ajax-btn') || cls(n, 'loadMoreBtn')).length) reasons.add('additional-active-native-loading-target')
  return { raw, doc, main, rawMain, page, pageId, webPage, postings: values.filter(value => value['@type'] === 'JobPosting') }
}
const splitLocation = (node, doc) => {
  const separator = one(descendants(node, n => n.children.some(child => typeof child !== 'string' && cls(child, 'star-icon'))), 'native location/mode separator')
  const at = separator.children.findIndex(child => typeof child !== 'string' && cls(child, 'star-icon'))
  const text = nodes => clean(nodes.map(child => typeof child === 'string' ? child : doc.text(child)).join(' '))
  return { location: text(separator.children.slice(0, at)), mode: text(separator.children.slice(at + 1)), container: separator }
}
const readCards = info => {
  const readCard = (card, doc) => {
    const titleNode = one(descendants(card, n => n.tag === 'h4'), 'native card title')
    const anchor = one(descendants(titleNode, n => n.tag === 'a'), 'native card role URL')
    const url = roleUrl(anchor.attrs.href), title = doc.text(titleNode), { location, mode, container } = splitLocation(card, doc)
    const department = doc.text(one(descendants(card, n => cls(n, 'elementor-widget-container') && n !== container && doc.text(n)
      && !descendants(n, child => child.tag === 'h4').length), 'native card department'))
    valid(title && location && mode && department, 'native card identity unavailable')
    return { url, title, location, mode, department, scopes: scopes(location) }
  }
  const active = new Map(descendants(info.main, n => cls(n, 'open-position')).map(card => {
    const row = readCard(card, info.doc); return [row.url, row]
  })), rows = new Map()
  for (const card of descendants(info.rawMain, n => cls(n, 'open-position'))) {
    const row = readCard(card, info.raw)
    valid(!rows.has(row.url), 'native card identity duplicate')
    valid(!active.has(row.url) || JSON.stringify(row) === JSON.stringify(active.get(row.url)), 'native visible card metadata conflicts')
    rows.set(row.url, { ...row, visible: active.has(row.url) })
  }
  return rows
}
const readContact = info => {
  const matches = node => descendants(node, n => n.tag === 'p' && info.doc.text(n) === 'For career enquiries').length > 0
    && descendants(node, n => n.tag === 'a' && /^mailto:/i.test(n.attrs.href || '')).length > 0
  const candidates = descendants(info.main, n => n.tag === 'div' && matches(n)).filter(node => !children(node).some(matches))
  const group = one(candidates, 'explicit career-enquiry group'), anchor = one(descendants(group, n => n.tag === 'a' && /^mailto:/i.test(n.attrs.href || '')), 'career-enquiry email')
  const email = anchor.attrs.href.slice(7)
  valid(/^[a-z0-9._%+-]+@avasoft\.com$/i.test(email) && folded(info.doc.text(anchor)) === folded(email), 'career-enquiry application identity conflicts')
  return { url: A, email, pageId: info.pageId }
}
const ATS = /(?:^|\.)(?:greenhouse\.io|myworkdayjobs\.com|myworkdaysite\.com|ashbyhq\.com|lever\.co|workable\.com|careers-page\.com|manatal\.com|smartrecruiters\.com|icims\.com|jobvite\.com|bamboohr\.com|teamtailor\.com|zohorecruit\.(?:com|in)|darwinbox\.(?:com|in)|dayforcehcm\.com)$/i
const inspectScope = (html, base, reasons, refs) => {
  const doc = readNativeDocument(html), frames = node => node.activeFrame ? [node] : node.inert ? [] : children(node).flatMap(frames)
  if (doc.nodes(n => n.tag === 'root').flatMap(frames).length) reasons.add('additional-active-frame-hiring-scope')
  for (const node of doc.nodes(n => n.tag === 'a' && n.attrs.href || n.tag === 'script' && n.attrs.src)) {
    let url
    try { url = new URL(node.attrs.href || node.attrs.src, base) } catch { continue }
    if (url.protocol === 'mailto:' || url.protocol === 'tel:') continue
    const hiring = ATS.test(url.hostname) || /(?:^|\.)(?:jobs?|careers?|hiring|recruitment)\./i.test(url.hostname)
      || /\b(?:careers?|jobs?|openings?|open positions|join our team|opportunities)\b/i.test(doc.text(node))
      || /\/(?:careers?|jobs?|openings?|recruitment)(?:\/|$)/i.test(url.pathname)
    if (!hiring) continue
    if (url.origin === new URL(H).origin && [H, C, A].some(known => known.replace(/\/$/, '') === url.origin + url.pathname.replace(/\/$/, '')) && !url.search) continue
    reasons.add('additional-public-hiring-scope:' + url.origin + url.pathname)
  }
  if (base === C) {
    const main = doc.nodes(n => n.tag === 'main' && n.attrs.id === 'content')[0]
    for (const heading of descendants(main, n => n.tag === 'h4')) for (const anchor of descendants(heading, n => n.tag === 'a' && n.attrs.href)) refs.add(roleUrl(anchor.attrs.href))
  }
}
const description = value => extractActiveDescription(value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
const publicationDate = value => {
  if (value == null || value === '') return null
  const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2}))?$/)
  valid(match, 'invalid native job publication date')
  const calendar = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  valid(calendar.getUTCFullYear() === Number(match[1]) && calendar.getUTCMonth() === Number(match[2]) - 1 && calendar.getUTCDate() === Number(match[3])
    && (!match[4] || Number(match[4]) < 24 && Number(match[5]) < 60 && Number(match[6]) < 60) && Number.isFinite(Date.parse(value)), 'invalid native job publication calendar')
  return match[4] ? new Date(value).toISOString() : value
}
const roleMetadata = (info, row, reasons) => {
  valid(info.postings.length <= 1, 'ambiguous native structured posting identity')
  const schema = info.postings[0]
  if (!schema) return { schema: null, addresses: [], posted: null, closing: null }
  valid(folded(schema.title) === folded(row.title) && (schema.url == null || schema.url === row.url), 'native structured posting title/URL identity conflicts')
  const organization = schema.hiringOrganization
  if (organization) valid((organization['@id'] === H + '#organization' || organization.name === 'AVASOFT')
    && (organization['@id'] == null || organization['@id'] === H + '#organization') && (organization.name == null || organization.name === 'AVASOFT')
    && (organization.sameAs == null || [H, H.slice(0, -1)].includes(organization.sameAs))
    && (organization.url == null || [H, H.slice(0, -1)].includes(organization.url)), 'native structured posting employer identity conflicts')
  const addresses = (Array.isArray(schema.jobLocation) ? schema.jobLocation : schema.jobLocation ? [schema.jobLocation] : []).map(location => location.address).filter(Boolean)
  for (const address of addresses) {
    const rawCountry = typeof address.addressCountry === 'object' ? address.addressCountry?.name : address.addressCountry
    const code = countries.get(folded(rawCountry))
    if (rawCountry != null && !code) reasons.add('native-structured-country-unresolved:' + row.url)
    if (code) valid(row.scopes.some(scope => scope.country === code) || row.scopes.some(scope => !scope.country), 'native structured country conflicts with posted location')
    const city = clean(address.addressLocality)
    if (city && !/^remote$/i.test(city)) valid(row.scopes.some(scope => folded(scope.label.split(',')[0]) === folded(city)), 'native structured city/location identity conflicts')
  }
  const closing = publicationDate(schema.validThrough)
  if (closing && /^\d{4}-\d{2}-\d{2}$/.test(closing)) reasons.add('native-closing-timezone-unresolved:' + row.url)
  return { schema, addresses, posted: publicationDate(schema.datePosted), closing }
}
const readDetail = (info, row, reasons, now) => {
  const title = info.doc.text(one(descendants(info.main, n => n.tag === 'h1'), 'native role heading'))
  valid(folded(title) === folded(row.title), 'native role title identity conflicts')
  const rawPage = one(descendants(info.rawMain, n => n.attrs['data-elementor-type'] === 'wp-page'), 'native raw role page')
  const rawBody = one(children(rawPage).filter(n => !descendants(n, child => child.tag === 'h1').length), 'native role-owned body')
  const body = descendants(info.page, n => n.attrs['data-id'] === rawBody.attrs['data-id'])[0]
  let animationValid = true
  if (cls(rawBody, 'elementor-invisible')) {
    const settings = parse(rawBody.attrs['data-settings'] || '{}')
    const sources = info.raw.nodes(n => n.tag === 'script' && n.attrs.src && !Object.hasOwn(n.attrs, 'nomodule')
      && /^(?:|(?:text|application)\/(?:javascript|ecmascript))$/i.test(n.attrs.type || '')).map(n => n.attrs.src)
    animationValid = settings.animation === 'fadeInUp' && Object.keys(settings).length === 1
      && ['frontend.min.js', 'frontend-modules.min.js'].every(file => sources.includes(H + 'wp-content/plugins/elementor/assets/js/' + file + '?ver=4.3.5'))
  }
  const apply = one(descendants(body, n => n.tag === 'a' && info.doc.text(n) === 'Apply Here'), 'role-declared application')
  valid(new URL(apply.attrs.href, row.url).href === A, 'role-declared application identity changed')
  const detailMeta = descendants(body, n => cls(n, 'text-icon'))
  valid(detailMeta.length <= 1, 'native role location identity ambiguous')
  const nativeLocation = detailMeta.length ? splitLocation(detailMeta[0], info.doc) : null
  if (nativeLocation) valid(folded(nativeLocation.location) === folded(row.location) && folded(nativeLocation.mode) === folded(row.mode), 'native country/location identity conflicts')
  const metadata = roleMetadata(info, row, reasons)
  const deadlineMs = metadata.closing && Date.parse(metadata.closing)
  // A date-only validThrough supplies no deadline clock. Keep that precision and
  // partial scope; call it definitely expired only after all plausible zones.
  const expiryBound = metadata.closing?.length === 10 ? deadlineMs + 38 * 3600000 : deadlineMs
  if (metadata.closing && expiryBound <= Date.parse(now)) { reasons.add('native-role-expired:' + row.url); return null }
  const known = row.scopes.every(scope => scope.country), india = row.scopes.filter(scope => scope.country === 'IN')
  if (!known || india.length && !nativeLocation) reasons.add('native-country-or-location-unresolved:' + row.url)
  const eligibleWidget = n => n.attrs['data-widget_type'] && !cls(n, 'text-icon') && n.attrs['data-widget_type'] !== 'button.default'
  const expected = structural(rawBody, eligibleWidget), active = descendants(body, eligibleWidget)
  const visibleIds = new Set(active.map(n => n.attrs['data-id']))
  let full = animationValid && expected.length === active.length && expected.every(n => visibleIds.has(n.attrs['data-id']))
    && active.every(n => ['heading.default', 'text-editor.default', 'icon-list.default'].includes(n.attrs['data-widget_type']))
  const pieces = [], headings = []
  let sectionHasContent = true, nonHeadingCount = 0
  for (const widget of active) {
    const text = info.doc.text(widget)
    if (widget.attrs['data-widget_type'] === 'heading.default') {
      if (!sectionHasContent) full = false
      sectionHasContent = false; headings.push(text)
    } else { if (!description(text)) full = false; else { sectionHasContent = true; nonHeadingCount++ } }
    if (text) pieces.push(text)
  }
  full = Boolean(full && sectionHasContent && nonHeadingCount > 0)
  if (india.length && !['Who can apply?', 'What are we looking for in a potential candidate?', 'Interview Process:'].every(label => headings.includes(label))) full = false
  if (!full) reasons.add('native-full-description-incomplete:' + row.url)
  const closed = /\b(?:this (?:job|position|role) (?:is |has been )?(?:closed|filled|expired)|no longer accepting applications)\b/i.test(info.doc.text(info.main))
  if (closed) { reasons.add('native-role-closed:' + row.url); return null }
  const text = full ? pieces.join('\n\n') : null
  return { source: 'avasoft', company: 'AVASOFT', jobId: new URL(row.url).pathname.split('/').filter(Boolean)[0], requisitionId: null,
    title: row.title, department: row.department, location: india.map(scope => scope.label).join(' / ') || row.location,
    locations: india.map(scope => scope.label), country: india.length ? 'India' : null,
    city: india.length === 1 && india[0].label.includes(',') ? india[0].label.split(',')[0] : null,
    remoteStatus: row.mode === 'Office' ? 'On-site' : ['Remote', 'Hybrid'].includes(row.mode) ? row.mode : null,
    employmentType: typeof metadata.schema?.employmentType === 'string' ? clean(metadata.schema.employmentType) : null,
    experienceRequired: null, requiredSkills: [], sourceUrl: row.url, applyUrl: A, link: A,
    applicationMethod: 'career-enquiry', postingDate: metadata.posted, closingDate: metadata.closing, sourcePublicationDateUnavailable: !metadata.posted,
    jobDescription: text, sourceDescription: text, sourceDetailComplete: full, sourceDetailFailureKind: full ? null : 'missing-content',
    nativeDescriptionSHA256: full ? hash(text) : null,
    sourceNativeDocumentIdentity: { wordpressPageId: info.pageId, canonicalUrl: row.url, title },
    sourceNativeDates: { documentDatePublished: info.webPage.datePublished ?? null, documentDateModified: info.webPage.dateModified ?? null,
      originalJobPublicationDate: metadata.schema?.datePosted ?? null, originalJobValidThrough: metadata.schema?.validThrough ?? null,
      closingTimezoneUnavailable: Boolean(metadata.closing && metadata.closing.length === 10) },
    sourceNativeCountryEvidence: { listingLocation: row.location, nativeDetailLocation: nativeLocation?.location ?? null, selectedIndiaLocations: india.map(scope => scope.label), nativeScopes: row.scopes, structuredAddresses: metadata.addresses },
    sourceNativeEmployerEvidence: { brand: 'AVASOFT', companyWebsite: H, legalEmployer: null },
    sourceNativePresentationEvidence: { wordpressTemplate: 'Elementor', animation: cls(rawBody, 'elementor-invisible') ? 'fadeInUp' : null, declaredAnimationVerified: animationValid } }
}
const rowState = row => JSON.stringify([row?.url, row?.title, row?.location, row?.mode, row?.department, row?.visible])
const detailState = job => JSON.stringify(job && [job.sourceNativeDocumentIdentity, job.title, job.sourceNativeCountryEvidence,
  job.sourceNativeDates, job.nativeDescriptionSHA256, job.sourceDetailComplete, job.applyUrl, job.closingDate])
const defaultFetchPage = async (url, init) => {
  const response = await fetch(url, { ...init, redirect: 'follow' })
  return { status: response.status, url: response.url, contentType: response.headers.get('content-type'), body: await response.text() }
}
export const createAvasoftNativeInventory = (defaults = {}) => ({
  async run(options = {}) {
    const settings = { ...defaults, ...options }, maxJobs = settings.maxJobs ?? 0
    valid(!settings.fetchText || settings.fetchPage, 'current native transport requires fetchPage')
    valid(Number.isSafeInteger(maxJobs) && maxJobs >= 0, 'invalid native output budget')
    settings.signal?.throwIfAborted()
    return withCurrentPublicProbe('avasoft', settings, async context => {
    const signal = context.signal
    const observedAt = () => new Date((settings.now || (() => new Date().toISOString()))()).toISOString()
    const reasons = new Set(), references = new Set(); let requests = 0
    const pageAt = async url => {
      signal?.throwIfAborted()
      const response = await context.read(url)
      signal?.throwIfAborted(); requests++
      valid(response?.url === url, 'native response redirected outside verified employer binding')
      if (response.status !== 200) { const error = Error('Avasoft native public HTTP ' + response.status); error.status = response.status; throw error }
      valid(typeof response.body === 'string' && Buffer.byteLength(response.body) <= 4 * 1024 * 1024 && /^text\/html\b/i.test(response.contentType || ''), 'native public response format changed')
      inspectScope(response.body, response.url, reasons, references)
      return documentAt(response.body, url, reasons)
    }
    const readScope = async () => {
      const home = await pageAt(H), careers = await pageAt(C), rows = readCards(careers)
      valid(rows.size <= 500, 'native role enumeration budget exhausted')
      if ([...rows.values()].some(row => !row.visible)) reasons.add('responsive-hidden-or-inactive-native-cards')
      if (![...rows.values()].some(row => row.visible)) reasons.add('no-visible-active-inventory-or-verified-empty-state')
      return { homeId: home.pageId, careersId: careers.pageId, rows }
    }
    const initial = await readScope(), details = new Map()
    for (const row of initial.rows.values()) details.set(row.url, readDetail(await pageAt(row.url), row, reasons, observedAt()))
    const contact = readContact(await pageAt(A)), closing = await readScope()
    const finalDetails = new Map()
    for (const row of closing.rows.values()) if (initial.rows.has(row.url)) finalDetails.set(row.url, readDetail(await pageAt(row.url), row, reasons, observedAt()))
    const finalContact = readContact(await pageAt(A)), finalScope = await readScope()
    if (initial.homeId !== closing.homeId || initial.careersId !== closing.careersId || initial.rows.size !== closing.rows.size
      || [...initial.rows].some(([url, row]) => rowState(row) !== rowState(closing.rows.get(url)))) reasons.add('closing-native-card-inventory-changed')
    if (initial.homeId !== finalScope.homeId || initial.careersId !== finalScope.careersId || initial.rows.size !== finalScope.rows.size
      || [...initial.rows].some(([url, row]) => rowState(row) !== rowState(finalScope.rows.get(url)))) reasons.add('final-post-detail-native-card-inventory-changed')
    const stableContact = JSON.stringify(contact) === JSON.stringify(finalContact)
    if (!stableContact) reasons.add('closing-career-enquiry-application-changed')
    if ([...details].some(([url, job]) => detailState(job) !== detailState(finalDetails.get(url)))) reasons.add('closing-native-role-document-changed')
    if ([...references].some(url => !initial.rows.has(url) || !closing.rows.has(url))) reasons.add('unassigned-native-role-reference')
    const healthy = [...details].filter(([url, job]) => job?.country === 'India' && initial.rows.get(url).visible && closing.rows.get(url)?.visible
      && finalScope.rows.get(url)?.visible && rowState(initial.rows.get(url)) === rowState(finalScope.rows.get(url))
      && rowState(initial.rows.get(url)) === rowState(closing.rows.get(url)) && detailState(job) === detailState(finalDetails.get(url)) && stableContact).map(([, job]) => job)
    const selected = maxJobs ? healthy.slice(0, maxJobs) : healthy
    if (selected.length !== healthy.length) reasons.add('source-job-limit')
    const complete = reasons.size === 0, now = observedAt()
    for (const job of selected) Object.assign(job, { scrapedAt: now, sourceListingComplete: complete, sourceDeclaredBoardScopeComplete: complete,
      sourceScopeComplete: false, sourceCompanyWideScopeComplete: false, lifecycleCleanupAllowed: false, companyCareerPage: C, companyDomain: 'avasoft.com', atsPlatform: 'official-company-careers',
      sourceNativeApplicationEvidence: { declaredRoleApplyUrl: A, careerEnquiryEmail: contact.email, contactPageId: contact.pageId, roleSpecificForm: false } })
    const evidence = { status: complete ? 'complete-inventory' : 'discovery-only', surface: C, firstParty: true,
      listingComplete: complete, reportedTotal: complete ? initial.rows.size : null, indiaFacetCount: complete ? healthy.length : null,
      verifiedAt: now, pagesFetched: requests, reason: complete ? 'avasoft-current-visible-configured-native-inventory-and-role-documents-final-after-details;company-totals-and-cleanup-unverified' : 'avasoft-native-incomplete:' + [...reasons].join(';') }
    const observations = [...initial.rows].map(([url,row]) => ({ nativeCard: row, nativeOpeningDetail: details.get(url), nativeClosingDetail: finalDetails.get(url), nativeFinalCard: finalScope.rows.get(url) ?? null,
      activeVacancyCandidate: Boolean(row.visible && closing.rows.get(url)?.visible && finalScope.rows.get(url)?.visible), qualification: row.visible ? 'declared-visible-card-with-native-detail-observations' : 'responsive-hidden-content-observation-not-active-vacancy' }))
    const audit = { configuredSource: C, observations, nativePublishedCardCount: initial.rows.size, nativeVisibleCardCount: [...initial.rows.values()].filter(row=>row.visible).length,
      nativeUnpublishedCardCount: [...initial.rows.values()].filter(row=>!row.visible).length, inventoryEvidence: evidence, nativeInventoryComplete: complete, reasons: [...reasons],
      originalPublicationDatesPreserved: true, closingAfterAllDetailAndPublicApplicationReads: true, sourceScopeComplete: false,
      sourceCompanyWideScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null, lifecycleCleanupAllowed: false }
    await context.audit(audit)
    Object.defineProperty(selected,'sourceAudit',{value:audit})
    attachSourceObservationEvidence(selected,{source:'avasoft',recordKind:'mixed',observedRecordCount:observations.length,observedVacancyCount:observations.filter(row=>row.activeVacancyCandidate).length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
    return attachInventoryEvidence(selected,evidence)
    })
  },
})
