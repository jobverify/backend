import { createHash } from 'node:crypto'
import { readNativeDocument, decodeNativeEntities, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { disposeResponseReader } from '../../scraper-support/shared/responseBodyDisposal.js'

export const HOMEPAGE_URL = 'https://finzly.com/'
export const CAREERS_URL = HOMEPAGE_URL + 'careers/'
const CONTACT_URL = HOMEPAGE_URL + 'contact/'
const PAGE_COLLECTION_URL = HOMEPAGE_URL + 'wp-json/wp/v2/pages?parent=7713&per_page=100'
const PARENT_PAGE_ID = 7713
const CLIENT_PATH = '/wp-content/themes/salient-child/assets/js/app.js'
// This currently advertised client filters existing role cards locally. Unknown
// revisions cannot establish the same enumeration contract. Never execute it.
const REVIEWED_CLIENTS = new Map([
  [CLIENT_PATH, 'e726b4b859cc70c204b4c3da1548552ddbc16159fb26a311bc619201d35b6720'],
  // SiteGround concatenates the same local role filter into the advertised
  // bundle. Validate the whole reviewed response, without executing it.
  ['/wp-content/uploads/siteground-optimizer-assets/siteground-optimizer-combined-js-8f29d20962e24ab18283de5299e449c4.js',
    '5315697a3cc04890633705a8994fd6d00f06f24487fe37fb7516b0c95cc1d619'],
])
const hash = value => createHash('sha256').update(value).digest('hex')
const clean = value => typeof value === 'string' ? decodeNativeEntities(value).replace(/\s+/g, ' ').trim() : ''
const folded = value => clean(value).replace(/[\u2010-\u2015]/g, '-').replace(/\s*-\s*/g, '-').toLowerCase()
const cls = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const descendants = (node, predicate) => !node || node.inert ? [] : [ ...(predicate(node) ? [node] : []),
  ...node.children.filter(child => typeof child !== 'string').flatMap(child => descendants(child, predicate)) ]
class FinzlyIdentityError extends Error {
  constructor(message) { super('Finzly native identity: ' + message); this.name = 'FinzlyIdentityError' }
}
const requireIdentity = (ok, message) => { if (!ok) throw new FinzlyIdentityError(message) }
const one = (nodes, name) => { requireIdentity(nodes.length === 1, 'expected one ' + name); return nodes[0] }
const validRoleUrl = value => {
  let url
  try { url = new URL(value) } catch { throw new FinzlyIdentityError('invalid role URL') }
  requireIdentity(url.origin === 'https://finzly.com' && !url.username && !url.password && !url.port && !url.search && !url.hash
    && /^\/careers\/[a-z0-9-]+\/$/.test(url.pathname), 'foreign role URL')
  return url.href
}
const verifyPage = (document, url) => {
  requireIdentity(one(document.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical'), 'canonical URL').attrs.href === url,
    'canonical role/page URL changed')
  requireIdentity(one(document.nodes(n => n.tag === 'meta' && n.attrs.property === 'og:site_name'), 'native site brand').attrs.content === 'Finzly, Inc.',
    'native employer brand changed')
}
const headerField = (document, label) => {
  const headings = document.nodes(n => n.tag === 'h4' && folded(document.text(n)) === folded(label))
  if (!headings.length) return null
  const heading = one(headings, label + ' label'), parents = new Map()
  const walk = node => {
    for (const child of node.children.filter(child => typeof child !== 'string')) { parents.set(child, node); walk(child) }
  }
  for (const root of document.nodes(n => n.tag === 'root')) walk(root)
  let node = parents.get(heading)
  while (node && node.tag !== 'root') {
    const values = descendants(node, n => n.tag === 'p').map(n => clean(document.text(n))).filter(Boolean)
    if (values.length) return values.length === 1 ? values[0] : null
    node = parents.get(node)
  }
  return null
}
const roleHeading = (node, document) => /^h[23]$/.test(node.tag)
  && /^(?:about the role\b|role\s*&\s*responsibilities\b)/i.test(document.text(node))
const nativeFragments = raw => typeof raw === 'string' ? [...raw.matchAll(/\[vc_column_text(?:\s[^\]]*)?\]([\s\S]*?)\[\/vc_column_text\]/g)]
  .map(match => ({ html: match[1], end: match.index + match[0].length })) : []
const nativeHeader = (raw, fragments, label) => {
  const matches = fragments.filter(fragment => {
    const d = readNativeDocument(fragment.html)
    return d.nodes(n => n.tag === 'h4' && folded(d.text(n)) === folded(label)).length
  })
  if (matches.length !== 1) return null
  const next = raw.slice(matches[0].end).match(/^\s*\[vc_custom_heading\s+([^\]]+)\]/)
  const attributes = decodeNativeEntities(next?.[1] || '').replace(/[\u201c\u201d\u2033]/g, '"')
  return clean(attributes.match(/\btext="([^"]*)"/)?.[1]) || null
}
const listingState = row => JSON.stringify([row.url, row.title, row.location, row.department, row.locationToken])
const parseBoard = (html, reasons) => {
  const active = readNativeDocument(html), visible = readVisibleNativeDocument(html)
  verifyPage(visible, CAREERS_URL)
  requireIdentity(visible.nodes(n => n.tag === 'select' && n.attrs.name === 'filter-role-by-department').length === 1
    && visible.nodes(n => n.tag === 'select' && n.attrs.name === 'filter-role-by-location').length === 1, 'current native role filters unavailable')
  const departments = new Map(visible.nodes(n => n.tag === 'select' && n.attrs.name === 'filter-role-by-department')
    .flatMap(select => descendants(select, n => n.tag === 'option')).map(n => [n.attrs.value, visible.text(n)]))
  const roles = new Map(), cards = active.nodes(n => cls(n, 'c-finzly-open-roles__role-item'))
  const visibleCards = new Set(visible.nodes(n => cls(n, 'c-finzly-open-roles__role-item'))
    .flatMap(card => descendants(card, n => n.tag === 'a' && cls(n, 'c-finzly-open-roles__button'))).map(n => n.attrs.href))
  for (const card of cards) {
    const url = validRoleUrl(one(descendants(card, n => n.tag === 'a' && cls(n, 'c-finzly-open-roles__button')), 'native role link').attrs.href)
    const title = clean(active.text(one(descendants(card, n => cls(n, 'c-finzly-open-roles__role-position')), 'native title')))
    const location = clean(active.text(one(descendants(card, n => cls(n, 'c-finzly-open-roles__role-location')), 'native location')))
    requireIdentity(title && location && !roles.has(url), 'missing or duplicate native role identity')
    const locationToken = clean(card.attrs['data-location'])
    if (folded(location).replace(/[^a-z0-9]+/g, '-') !== locationToken) reasons.add('native-listing-location-token-conflict:' + url)
    const isVisible = visibleCards.has(url)
    if (!isVisible) reasons.add('native-role-card-hidden:' + url)
    roles.set(url, { url, title, location, locationToken, department: departments.get(card.attrs['data-department']) || null, visible: isVisible })
  }
  const clients = visible.nodes(n => n.tag === 'script' && n.attrs.src && !Object.hasOwn(n.attrs, 'nomodule')
    && /^(?:|module|text\/javascript|application\/javascript)$/i.test(n.attrs.type || ''))
    .map(n => new URL(n.attrs.src, CAREERS_URL)).filter(url => url.origin === 'https://finzly.com' && REVIEWED_CLIENTS.has(url.pathname))
  const client = one(clients, 'current filtering client')
  requireIdentity(!client.hash && !client.username && !client.password && [...client.searchParams].every(([key, value]) => key === 'ver' && /^\d+$/.test(value)), 'current filtering client URL changed')
  for (const node of active.nodes(n => n.tag === 'a' && n.attrs.href)) {
    let url
    try { url = new URL(node.attrs.href, CAREERS_URL) } catch { continue }
    const localSection = url.pathname === '/careers/' && !url.search
    if (node.attrs.rel?.split(/\s+/).includes('next') || (/^\/careers\//.test(url.pathname) && !localSection && !roles.has(url.href))) {
      reasons.add('additional-native-enumeration-scope-unresolved')
    }
    if (/^https?:$/.test(url.protocol) && url.origin !== 'https://finzly.com'
      && /careers?|jobs?|recruit|workable|greenhouse|lever\.co|ashbyhq|workday|mynexthire|darwinbox/i.test(url.href)) reasons.add('additional-employer-recruiting-scope-unresolved')
  }
  // Observed cards are not an independently reported whole-employer total.
  reasons.add('native-authoritative-total-unavailable')
  return { roles, clientUrl: client.href }
}
const scopedLocation = (row, raw, native, id, reasons, office) => {
  if (!raw || folded(native) !== folded(raw)
    || folded(row.location).replace(/[^a-z0-9]+/g, '-') !== row.locationToken) {
    reasons.add(`native-country-scope-conflicts:${id}`); return null
  }
  const listed = folded(row.location).match(/^india-(chennai(?:\/pune)?|pune|remote)$/)
  const explicitDetail = folded(raw).match(/^india-(chennai(?:\/pune)?|pune|remote)$/)
  const untypedDetail = folded(raw).match(/^(chennai(?:\/pune)?|pune|remote)$/)
  if (!listed || (!explicitDetail && !untypedDetail)) {
    if (office && folded(row.location) === 'charlotte, nc' && folded(raw) === 'charlotte, nc') return { foreign: 'US' }
    if (!(folded(row.location) === 'usa-remote' && folded(raw) === 'usa-remote')) reasons.add(`native-country-scope-unresolved:${id}`)
    return null
  }
  const detailOffices = (explicitDetail || untypedDetail)[1].split('/'), listedOffices = listed[1].split('/')
  // An untyped detail office inherits country only from this exact role's
  // explicit India listing, with the same office assigned in both carriers.
  if (!explicitDetail && detailOffices.some(office => !listedOffices.includes(office))) {
    reasons.add(`native-country-scope-unresolved:${id}`); return null
  }
  if (detailOffices.join('/') !== listedOffices.join('/')) reasons.add(`native-listing-detail-location-set-differs:${id}`)
  const names = detailOffices.map(name => name === 'remote' ? 'Remote' : name === 'pune' ? 'Pune' : 'Chennai')
  const cities = names.map(city => getValidIndiaCityForJob({ city, location: city + ', India', country: 'India' }))
  if (cities.some(city => !city)) { reasons.add(`native-india-city-scope-unresolved:${id}`); return null }
  return { city: cities.length === 1 ? cities[0] : null, locations: names.map(city => city + ', India'), remote: names[0] === 'Remote' }
}
const defaultFetchPage = async (url, init, callerSignal) => {
  const response = await fetch(url, { ...init, redirect: 'error' }), reader = response.body?.getReader(), chunks = []
  let length = 0, readComplete = false
  if (reader) try {
    while (true) {
      const part = await reader.read()
      if (part.done) break
      length += part.value.byteLength
      requireIdentity(length <= 4 * 1024 * 1024, 'native response exceeds size limit')
      chunks.push(Buffer.from(part.value))
    }
    readComplete = true
  } finally {
    try { await disposeResponseReader(reader, { signal: callerSignal, bestEffort: !readComplete }) }
    finally { reader.releaseLock() }
  }
  return { status: response.status, url: response.url, body: Buffer.concat(chunks).toString('utf8'), contentType: response.headers.get('content-type'),
    wpTotal: response.headers.get('x-wp-total'), wpTotalPages: response.headers.get('x-wp-totalpages') }
}
const pageState = row => JSON.stringify([row?.id, row?.parent, row?.slug, row?.status, row?.type, row?.link, row?.title?.rendered,
  row?.content?.rendered, row?.content?.protected, row?.country ?? null, row?.countryCode ?? null, row?.acf ?? null])
const closedNotice = text => /\b(?:this (?:role|position|vacancy) (?:is|has been) (?:closed|filled)|no longer accepting applications)\b/i.test(text)
const metadataLabels = new Set(['location', 'full/part time', 'experience level', 'working hours'])
const roleContentTree = node => ({ ...node, children: node.children.filter(child => typeof child === 'string'
  || !(child.tag === 'footer' || child.attrs.role === 'contentinfo' || cls(child, 'before-footer') || child.attrs.id === 'footer-outer'))
  .map(child => typeof child === 'string' ? child : roleContentTree(child)) })

export const createFinzlyNativeInventory = (defaults = {}) => ({
  async run(options = {}) {
    const settings = { ...defaults, ...options }, signal = settings.signal, now = settings.now || (() => new Date().toISOString())
    const fetchPage = settings.fetchPage || defaultFetchPage, maxJobs = settings.maxJobs ?? 0, reasons = new Set()
    requireIdentity(Number.isSafeInteger(maxJobs) && maxJobs >= 0, 'invalid output limit')
    signal?.throwIfAborted()
    let requests = 0
    const responseAt = async (url, type) => {
      signal?.throwIfAborted()
      const response = await fetchPage(url, { method: 'GET', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000),
        headers: { Accept: 'text/html,application/json,application/javascript,*/*' } }, ...(fetchPage === defaultFetchPage ? [signal] : []))
      signal?.throwIfAborted(); requests++
      requireIdentity(response?.url === url, 'native response redirected')
      if (response.status !== 200) throw Error(`Finzly public native HTTP ${response.status}`)
      requireIdentity(typeof response.body === 'string' && Buffer.byteLength(response.body) <= 4 * 1024 * 1024
        && (response.contentType == null || (type === 'json' ? /^application\/json\b/i : type === 'client' ? /^(?:application|text)\/javascript\b/i : /^text\/html\b/i).test(response.contentType)), 'native response format changed')
      return response
    }
    const pageAt = async (url, type) => (await responseAt(url, type)).body
    const collectPublishedPages = async () => {
      const records = new Map(), maxPages = settings.maxPages ?? 20
      if (!Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 100) throw Error('Finzly published-page enumeration limit invalid')
      let total, pages
      for (let page = 1; page <= (pages ?? 1); page++) {
        if (page > maxPages) throw Error('Finzly published-page enumeration incomplete')
        const response = await responseAt(PAGE_COLLECTION_URL + (page === 1 ? '' : '&page=' + page), 'json')
        if (!/^\d+$/.test(response.wpTotal || '') || !/^\d+$/.test(response.wpTotalPages || '')) throw Error('Finzly published-page total unavailable')
        const observedTotal = Number(response.wpTotal), observedPages = Number(response.wpTotalPages)
        if (!Number.isSafeInteger(observedTotal) || !Number.isSafeInteger(observedPages) || observedPages !== Math.ceil(observedTotal / 100)
          || observedPages > maxPages || (total != null && (total !== observedTotal || pages !== observedPages))) throw Error('Finzly published-page totals inconsistent')
        total = observedTotal; pages = observedPages
        const rows = JSON.parse(response.body)
        if (!Array.isArray(rows) || rows.length > 100) throw Error('Finzly published-page inventory invalid')
        for (const row of rows) {
          requireIdentity(row?.status === 'publish', 'published-page response contains an unpublished record')
          if (!Number.isSafeInteger(row?.id) || row.id <= 0 || records.has(row.id) || row.parent !== PARENT_PAGE_ID || row.status !== 'publish'
            || row.type !== 'page' || row.link !== CAREERS_URL + row.slug + '/') throw Error('Finzly published-page inventory identity invalid')
          validRoleUrl(row.link); records.set(row.id, row)
        }
      }
      if (records.size !== total) throw Error('Finzly published-page terminal count incomplete')
      return { total, records }
    }
    const collectOptionalPages = async () => {
      try { return await collectPublishedPages() } catch (error) {
        signal?.throwIfAborted()
        if (error instanceof FinzlyIdentityError) throw error
        reasons.add('published-career-page-inventory-unavailable'); return null
      }
    }
    const homepage = readVisibleNativeDocument(await pageAt(HOMEPAGE_URL))
    verifyPage(homepage, HOMEPAGE_URL)
    requireIdentity(homepage.nodes(n => n.tag === 'a' && n.attrs.href === CAREERS_URL).length > 0, 'current corporate careers handoff unavailable')
    const initial = parseBoard(await pageAt(CAREERS_URL), reasons)
    let office = null
    if (homepage.nodes(n => n.tag === 'a' && n.attrs.href === CONTACT_URL).length) {
      try {
        const contact = readVisibleNativeDocument(await pageAt(CONTACT_URL)); verifyPage(contact, CONTACT_URL)
        const candidates = contact.nodes(n => cls(n, 'wpb_text_column')).filter(node =>
          descendants(node, n => n.tag === 'h5' && contact.text(n) === 'Charlotte, US (HQ)').length === 1
          && descendants(node, n => n.tag === 'p' && /\bCharlotte, NC 28217 USA$/.test(contact.text(n))).length === 1)
        if (candidates.length === 1) office = { sourceUrl: CONTACT_URL, country: 'US', address: contact.text(candidates[0]) }
      } catch (error) { signal?.throwIfAborted(); reasons.add('current-native-office-country-proof-unavailable') }
    }
    const initialPages = await collectOptionalPages()
    requireIdentity(hash(await pageAt(initial.clientUrl, 'client')) === REVIEWED_CLIENTS.get(new URL(initial.clientUrl).pathname), 'current filtering client contract changed')
    const jobs = new Map(), pageIds = new Set(), detailStates = new Map()
    for (const row of initial.roles.values()) {
      let html, raw
      try {
        html = await pageAt(row.url)
        const doc = readNativeDocument(html)
        const reference = one(doc.nodes(n => n.tag === 'link' && n.attrs.rel === 'alternate' && n.attrs.title === 'JSON' && n.attrs.type === 'application/json'), 'linked native JSON page')
        requireIdentity(/^https:\/\/finzly\.com\/wp-json\/wp\/v2\/pages\/[1-9]\d*$/.test(reference.attrs.href), 'foreign native JSON page')
        raw = JSON.parse(await pageAt(reference.attrs.href, 'json'))
      } catch (error) {
        signal?.throwIfAborted()
        if (error instanceof FinzlyIdentityError) throw error
        reasons.add('native-detail-unavailable:' + row.url); continue
      }
      const doc = readVisibleNativeDocument(html)
      verifyPage(doc, row.url)
      const heading = clean(doc.text(one(doc.nodes(n => n.tag === 'h1'), 'role heading')))
      const nativeTitle = clean(raw?.title?.rendered)
      const alias = row.url === CAREERS_URL + 'production-support-analyst-payments/' && row.title === 'Production Support Analyst'
        && heading === 'Production Support Analyst \u2013 Payments'
      requireIdentity(Number.isSafeInteger(raw?.id) && raw.id > 0 && !pageIds.has(raw.id) && raw.parent === PARENT_PAGE_ID && raw.type === 'page'
        && raw.link === row.url && raw.slug === new URL(row.url).pathname.split('/').at(-2)
        // Yoast REST metadata is optional. The current HTML has already bound
        // its canonical URL and employer; supplied REST metadata must agree.
        && (raw.yoast_head_json == null || raw.yoast_head_json.og_site_name === 'Finzly, Inc.' && raw.yoast_head_json.canonical === row.url)
        && doc.nodes(n => n.tag === 'body' && cls(n, 'page-id-' + raw.id) && cls(n, 'parent-pageid-' + PARENT_PAGE_ID)).length === 1
        && folded(nativeTitle) === folded(heading) && (folded(row.title) === folded(heading) || alias), 'role, page, parent, title or employer identity conflicts')
      pageIds.add(raw.id)
      detailStates.set(raw.id, pageState(raw))
      if (raw.status !== 'publish' || raw.content?.protected !== false) { reasons.add(`native-page-not-published:${raw.id}`); continue }
      const fragments = nativeFragments(raw.content?.rendered), anchors = fragments.filter(fragment => {
        const d = readNativeDocument(fragment.html)
        return d.nodes(n => roleHeading(n, d)).length > 0
      })
      const containers = doc.nodes(n => cls(n, 'container-wrap') && descendants(n, child => child.tag === 'h1' && clean(doc.text(child)) === heading).length === 1)
      if (anchors.length !== 1 || containers.length !== 1) { reasons.add(`full-native-description-unavailable:${raw.id}`); continue }
      const container = roleContentTree(containers[0]), nativeItems = fragments.map(fragment => ({ ...fragment, text: extractActiveDescription(fragment.html) || '' }))
      if (closedNotice(doc.text(container)) || nativeItems.some(item => closedNotice(item.text))) {
        reasons.add(`native-role-no-longer-open:${raw.id}`); continue
      }
      const nativeBlocks = nativeItems.filter(item => item.text && !metadataLabels.has(folded(item.text)))
      const visibleBlocks = descendants(container, node => cls(node, 'wpb_text_column'))
      const visibleTexts = visibleBlocks.map(node => clean(doc.text(node))).filter(text => text && !metadataLabels.has(folded(text)))
      const equalContent = (a, b) => a.replace(/\s/g, '') === b.replace(/\s/g, '')
      const complete = nativeBlocks.length > 0 && nativeBlocks.every(item => visibleTexts.some(text => equalContent(text, item.text)))
        && visibleTexts.every(text => nativeBlocks.some(item => equalContent(text, item.text)))
      if (!complete) {
        reasons.add(`full-native-description-mismatch:${raw.id}`); continue
      }
      const description = nativeBlocks.map(item => item.text).join('\n\n'), nativeHtml = nativeBlocks.map(item => item.html).join('\n\n')
      const applicationBlocks = nativeBlocks.filter(item => {
        const d = readNativeDocument(item.html)
        return d.nodes(n => /^h[1-6]$/.test(n.tag) && /^apply:?$/i.test(clean(d.text(n)))).length
          && d.nodes(n => n.tag === 'a' && n.attrs.href === 'mailto:careers@finzly.com').length
      })
      const application = applicationBlocks.some(item => visibleBlocks.some(node => equalContent(clean(doc.text(node)), item.text)
        && descendants(node, n => n.tag === 'a' && n.attrs.href === 'mailto:careers@finzly.com').length))
      if (!application) { reasons.add(`native-application-unavailable:${raw.id}`); continue }
      const nativeLocation = nativeHeader(raw.content.rendered, fragments, 'Location'), location = headerField(doc, 'Location')
      const scope = scopedLocation(row, location, nativeLocation, raw.id, reasons, office)
      if (!scope || scope.foreign || !row.visible) continue
      if ([raw.country, raw.countryCode, raw.acf?.country, raw.acf?.countryCode].some(country => country != null && !['India', 'IN', 'IND'].includes(country))) {
        reasons.add(`native-country-scope-conflicts:${raw.id}`); continue
      }
      jobs.set(row.url, { source: 'finzly', company: 'Finzly', nativeEmployerBrand: 'Finzly', jobId: String(raw.id), requisitionId: null,
        title: heading, sourceUrl: row.url, applyUrl: 'mailto:careers@finzly.com', link: row.url, applicationEmail: 'careers@finzly.com', applicationMethod: 'email',
        country: 'India', city: scope.city, location: scope.locations.join(' / '), locations: scope.locations,
        remoteStatus: scope.remote ? 'Remote' : null, department: row.department,
        employmentType: headerField(doc, 'Full/Part Time'), experienceRequired: headerField(doc, 'Experience Level'),
        sourceNativeWorkingHours: headerField(doc, 'Working Hours'),
        jobDescription: description, sourceDescription: description, jobDescriptionHtml: nativeHtml,
        nativeDescriptionSHA256: hash(nativeHtml), sourceNativeDescriptionFragmentCount: nativeBlocks.length, sourceDetailComplete: true,
        postingDate: null, closingDate: null, sourcePublicationDateUnavailable: true,
        sourceNativePageDates: { created: raw.date ?? null, createdGMT: raw.date_gmt ?? null, modified: raw.modified ?? null, modifiedGMT: raw.modified_gmt ?? null,
          meaning: 'WordPress document creation/modification; not job publication' },
        sourceNativeCountryEvidence: { method: 'matching-native-role-location-labels', listing: row.location, visibleDetail: location, nativeDetail: nativeLocation },
        sourceNativeEmployerEvidence: { brand: 'Finzly', siteName: one(doc.nodes(n => n.tag === 'meta' && n.attrs.property === 'og:site_name'), 'native site brand').attrs.content,
          nativePageId: raw.id, parentPageId: raw.parent, legalEmployer: null },
        sourceNativeStatusEvidence: { pageStatus: raw.status, currentlyAdvertised: true, vacancyStatus: null },
        sourceAdvertisedRoleCount: initial.roles.size, requiredSkills: [], minimumQualification: null, preferredQualification: null,
        sourcePublishedCareerPageCount: initialPages?.total ?? null,
        sourceNativeForeignOfficeEvidence: office,
        companyCareerPage: CAREERS_URL, companyDomain: 'finzly.com', atsPlatform: 'first-party-wordpress-careers', scrapedAt: new Date(now()).toISOString(),
        sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
      })
    }
    const closingPages = await collectOptionalPages()
    if (initialPages && closingPages && (initialPages.total !== closingPages.total
      || [...initialPages.records].some(([id, row]) => pageState(row) !== pageState(closingPages.records.get(id))))) reasons.add('closing-published-career-page-inventory-changed')
    if (closingPages && [...closingPages.records.values()].some(row => !initial.roles.has(row.link))) reasons.add('published-career-pages-not-advertised')
    const closing = parseBoard(await pageAt(CAREERS_URL), reasons)
    if (closing.clientUrl !== initial.clientUrl) reasons.add('closing-native-client-contract-changed')
    if (closing.roles.size !== initial.roles.size || [...initial.roles].some(([url, row]) => listingState(row) !== listingState(closing.roles.get(url) || {}))) {
      reasons.add('closing-native-advertised-inventory-changed')
    }
    const healthy = [...initial.roles.values()].filter(row => jobs.has(row.url) && closing.roles.has(row.url)
      && closing.roles.get(row.url).visible && listingState(row) === listingState(closing.roles.get(row.url))).map(row => jobs.get(row.url))
      .filter(job => {
        const id = Number(job.jobId), state = detailStates.get(id)
        if ((initialPages && state !== pageState(initialPages.records.get(id))) || (closingPages && state !== pageState(closingPages.records.get(id)))) {
          reasons.add('closing-native-page-state-changed:' + id); return false
        }
        return true
      })
    const selected = maxJobs ? healthy.slice(0, maxJobs) : healthy
    if (selected.length !== healthy.length) reasons.add('source-job-limit')
    return attachInventoryEvidence(selected, { status: 'discovery-only', firstParty: true, surface: CAREERS_URL, listingComplete: false,
      reportedTotal: null, indiaFacetCount: null, pagesFetched: requests, verifiedAt: new Date(now()).toISOString(),
      reason: 'finzly-native-incomplete:' + [...reasons].join(';') })
  },
})
