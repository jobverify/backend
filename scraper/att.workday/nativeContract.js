import {createHash} from 'node:crypto'
import {readAttDocument, nativeDescendants, nativeTextBlocks, nativeTextWithout, normalizeNativeText as norm, decodeNativeText} from './nativeHtml.js'
import {findExplicitNativeClosure} from '../../scraper-support/utils/sourceAvailability.js'

export const ORIGIN = 'https://www.att.jobs'
export const INDIA_URL = ORIGIN + '/search-jobs?acm=ALL&alrpm=1269750&ascf=%5B%7B%22key%22%3A%22ALL%22%2C%22value%22%3A%22%22%7D%5D'
export const CLIENT_URL = 'https://tbcdn.talentbrew.com/js/client/search.js'
export const CORE_URL = 'https://tbcdn.talentbrew.com/bundles/tb-corepack.js'
const need = (condition, message) => { if (!condition) throw Error('AT&T native: ' + message) }
const one = (items, label) => { need(items.length === 1, 'Expected one ' + label); return items[0] }
const integer = (value, label) => {
  need(typeof value === 'string' && /^(0|[1-9]\d*)$/.test(value), 'Invalid ' + label)
  const number = Number(value)
  need(Number.isSafeInteger(number) && number <= 10000, 'Unbounded ' + label)
  return number
}
const meta = (document, name) => one(document.nodes(node => node.tag === 'meta' && node.attrs.name === name), 'native meta ' + name).attrs.content
const canonical = (document, url) => need(one(document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'native canonical').attrs.href === url, 'Native canonical mismatch')
const sameNativeCity = (structured, visible) => norm(structured) === visible || structured === 'Bangalore' && visible === 'Bengaluru'
const requisitionFamily = value => value.replace(/-1$/, '')

function office(value) {
  const match = /^([^,<>]+), India$/.exec(norm(value))
  need(match && /[\p{L}]/u.test(match[1]), 'Country-qualified India office unavailable')
  return {location: match[1] + ', India', city: match[1], country: 'India'}
}

function parseResults(document, filters, {page, total: expectedTotal}) {
  need(Number.isSafeInteger(page) && page >= 1 && page <= 100, 'Invalid page bound')
  const section = one(document.nodes(node => node.attrs.id === 'search-results'), 'native result section')
  const attributes = section.attrs
  need(attributes['data-ajax-url'] === '/search-jobs/results' && attributes['data-ajax-post-url'] === '/search-jobs/resultspost', 'Advertised native search endpoints changed')
  need(attributes['data-records-per-page'] === '12' && attributes['data-sort-criteria'] === '0' && attributes['data-sort-direction'] === '0' && attributes['data-search-type'] === '6', 'Native pagination contract changed')
  const total = integer(attributes['data-total-job-results'], 'country job count')
  const pages = integer(attributes['data-total-pages'], 'page count')
  need(total > 0 && total <= 1200 && integer(attributes['data-total-results'], 'result count') === total && pages === Math.ceil(total / 12) && integer(attributes['data-current-page'], 'current page') === page && page <= pages, 'Native totals/page drift')
  if (expectedTotal !== undefined) need(total === expectedTotal, 'Native inventory total drift')
  const selected = filters.nodes(node => node.tag === 'input' && filters.hasClass(node, 'filter-checkbox') && Object.hasOwn(node.attrs, 'checked') && !Object.hasOwn(node.attrs, 'disabled'))
  need(selected.length === 1, 'Native country scope is missing or ambiguous')
  const india = selected[0]
  need(india.attrs['data-facet-type'] === '2' && india.attrs['data-id'] === '1269750' && india.attrs['data-display'] === 'India' && integer(india.attrs['data-count'], 'India facet count') === total, 'Selected exact India country facet unavailable')
  const label = one(filters.nodes(node => node.tag === 'label' && node.attrs.for === india.attrs.id), 'India country label')
  need(filters.text(label) === 'India ' + total, 'Native India label/count mismatch')
  const list = one(nativeDescendants(section, node => node.attrs.id === 'search-results-list'), 'native role list')
  const applied = nativeDescendants(list, node => node.tag === 'button' && node.attrs['data-facet-type'] === '2' && node.attrs['data-id'] === '1269750' && node.attrs['data-facet-display'] === 'Country:  India')
  need(applied.length === 1 && document.text(applied[0]) === 'India', 'Applied native India filter unavailable')
  const cards = nativeDescendants(list, node => node.tag === 'li' && nativeDescendants(node, candidate => candidate.tag === 'a' && candidate.attrs['data-job-id']).length === 1)
  const rows = cards.map(card => {
    const link = one(nativeDescendants(card, node => node.tag === 'a' && node.attrs['data-job-id']), 'native role link')
    const id = link.attrs['data-job-id']
    need(/^[1-9]\d*$/.test(id ?? ''), 'Native role ID unavailable')
    const title = document.text(link)
    need(title && !/[<>]|talent (?:community|pool)|submit.*resume|future hiring/i.test(title), 'Native role title unavailable')
    let url
    try { url = new URL(link.attrs.href, ORIGIN) } catch { need(false, 'Native role URL malformed') }
    need(url.origin === ORIGIN && !url.username && !url.password && !url.search && !url.hash && new RegExp('^/job/[^/]+/[^/]+/117/' + id + '$').test(url.pathname), 'Native role URL/organization/ID mismatch')
    const location = office(document.text(one(nativeDescendants(card, node => document.hasClass(node, 'job-location')), 'native listing office')))
    const saved = nativeDescendants(card, node => node.tag === 'button' && document.hasClass(node, 'js-save-job-btn'))
    need(saved.length === 1 && saved[0].attrs['data-job-id'] === id && saved[0].attrs['data-org-id'] === '117', 'Native listing organization/ID mismatch')
    return {id, title, url: url.href, ...location}
  })
  need(rows.length === Math.min(12, total - (page - 1) * 12) && new Set(rows.map(row => row.id)).size === rows.length, 'Native page missing or duplicate rows')
  const next = nativeDescendants(section, node => node.tag === 'a' && document.hasClass(node, 'next'))
  const nextPath = page === 1 ? '/search-jobs&p=' : '/search-jobs/results&p='
  need(page < pages ? next.length === 1 && next[0].attrs.href === nextPath + (page + 1) : next.length === 0, 'Native continuation mismatch')
  return {total, pages, page, rows}
}

export function inspectAttSearch(html, {url = INDIA_URL, page = 1} = {}) {
  need(url === INDIA_URL && page === 1, 'Unknown current India search URL')
  const document = readAttDocument(html)
  canonical(document, INDIA_URL)
  const title = one(document.nodes(node => node.tag === 'title'), 'native search title')
  need(decodeNativeText(title.raw) === 'Search our Job Opportunities at AT&T', 'Native AT&T search identity unavailable')
  const scriptUrls = document.nodes(node => node.tag === 'script' && node.attrs.src).map(node => new URL(node.attrs.src, ORIGIN).href)
  need(scriptUrls.includes(CLIENT_URL) && scriptUrls.includes(CORE_URL), 'Advertised native query assets unavailable')
  return parseResults(document, document, {page})
}

export function inspectAttClients(client, core) {
  // Native strict UTF-8 decoding consumes an optional BOM. Compare the same
  // executable text for real HTTPS responses and byte-preserving fixture readers.
  const fingerprint = value => typeof value === 'string'
    ? createHash('sha256').update(value.replace(/^\uFEFF/, '')).digest('hex') : null
  need(fingerprint(client) === 'f58913158b9aa603a2a21969c4533ae9023d26ff6699d5ac505ef9d469bd85dd', 'Advertised native search client changed')
  need(fingerprint(core) === 'f1b4a0bc9413818f043290fe4b6944567a92888aa9e0a004673b1e90cd17c6a7', 'Advertised native query encoder changed')
}

export function attListingUrl(page, total) {
  need(Number.isSafeInteger(page) && page >= 2 && page <= 100 && Number.isSafeInteger(total) && total > 0 && total <= 1200 && page <= Math.ceil(total / 12), 'Invalid native pagination bounds')
  // This is the observed client mapping and bindQueryParams wire format. The
  // native page has no content inventory fields; its empty/NaN bookkeeping is
  // retained solely for the request and never treated as job-count evidence.
  return ORIGIN + '/search-jobs/results?ActiveFacetID=0&CurrentPage=' + page + '&RecordsPerPage=12&TotalContentResults=&Distance=50&RadiusUnitType=0&Keywords=&Location=&ShowRadius=False&IsPagination=False&CustomFacetName=&FacetTerm=&FacetType=0&FacetFilters%5B0%5D.ID=1269750&FacetFilters%5B0%5D.FacetType=2&FacetFilters%5B0%5D.Count=' + total + '&FacetFilters%5B0%5D.Display=India&FacetFilters%5B0%5D.IsApplied=true&FacetFilters%5B0%5D.FieldName=&SearchResultsModuleName=Search+Results&SearchFiltersModuleName=Search+Filters&SortCriteria=0&SortDirection=0&SearchType=6&PostalCode=&ResultsType=0&fc=&fl=&fcf=&afc=&afl=&afcf=&TotalContentPages=NaN'
}

export function parseAttPage(body, {page, total}) {
  let payload
  try { payload = JSON.parse(body) } catch { need(false, 'Native listing JSON malformed') }
  need(payload && typeof payload === 'object' && !Array.isArray(payload) && Object.keys(payload).sort().join(',') === 'filters,hasContent,hasJobs,results', 'Native listing envelope changed')
  need(payload.hasJobs === true && payload.hasContent === false && typeof payload.results === 'string' && typeof payload.filters === 'string', 'Native listing fields/error unavailable')
  return parseResults(readAttDocument(payload.results), readAttDocument(payload.filters), {page, total})
}

function originalDay(value, now) {
  need(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'Native original publication date unavailable')
  const date = new Date(value + 'T00:00:00.000Z')
  need(Number.isFinite(+date) && date.toISOString().slice(0, 10) === value && Number.isFinite(Date.parse(now)) && +date <= Date.parse(now), 'Invalid/future native original publication date')
  return date.toISOString()
}

function qualifyDescription(document, section, structured) {
  const nodes = nativeDescendants(section, node => document.hasClass(node, 'ats-description'))
  need(nodes.length <= 1, 'Ambiguous native full description')
  if (!nodes.length) return {description: null, visibleText: null, reason: 'native-visible-full-description-unavailable'}
  const visibleText = document.text(nodes[0])
  // AT&T places the independently checked Job ID and Date posted spans inside
  // the visible JD container. Exclude only those metadata spans for cross-channel
  // comparison; retain the complete visible channel separately.
  const text = nativeTextWithout(nodes[0], node => document.hasClass(node, 'job-info') && (document.hasClass(node, 'job-id') || document.hasClass(node, 'job-date')))
  const structuredDocument = readAttDocument(structured)
  const structuredText = structuredDocument.text(one(structuredDocument.nodes(node => node.tag === 'root'), 'structured description root'))
  need(text.replace(/\s/g, '') === structuredText.replace(/\s/g, ''), 'Visible and structured native full descriptions conflict')
  const blocks = nativeTextBlocks(nodes[0])
  if (findExplicitNativeClosure(blocks)) return {description: null, visibleText, reason: 'native-role-explicitly-closed'}
  const roleText = blocks.filter(block => !/^(?:please\b|click\b|apply now\b|(?:the )?(?:full )?job description\b.*\b(?:unavailable|coming soon|after.*apply)\b)/i.test(block)).join(' ')
  if (roleText.replace(/[^\p{L}]/gu, '').length < 100 || !/\b(?:responsibilities|qualifications|required (?:skills|experience)|you will|key competencies|skills and experience)\b/i.test(roleText)) {
    return {description: null, visibleText, reason: 'native-description-no-role-content'}
  }
  return {description: text, visibleText, reason: null}
}

export function parseAttDetail(html, row, {now = new Date().toISOString()} = {}) {
  const document = readAttDocument(html)
  need(row && /^[1-9]\d*$/.test(row.id ?? '') && row.country === 'India', 'Unqualified native listing role')
  canonical(document, row.url)
  const models = document.nodes(node => node.tag === 'script' && !node.attrs.src && node.attrs.type === 'application/ld+json').map(node => {
    try { return JSON.parse(node.raw) } catch { need(false, 'Malformed native structured role') }
  })
  const model = one(models.filter(value => value && value['@type'] === 'JobPosting'), 'native JobPosting')
  const req = model.identifier?.value
  need(model.url === row.url && norm(model.title) === row.title && model.hiringOrganization?.name === 'AT&T' && model.identifier?.name === 'Job ID' && /^R-[1-9]\d*(?:-1)?$/.test(req ?? ''), 'Native brand/title/requisition mismatch')
  need(meta(document, 'search-analytics-currentJobId') === row.id && meta(document, 'gtm_jobid') === row.id && meta(document, 'job-ats-req-id') === req && norm(meta(document, 'job-tbcn-job-title')) === row.title && norm(meta(document, 'gtm_tbcn_jobtitle')) === row.title && meta(document, 'gtm_tbcn_division') === '117,AT&T', 'Native role identity metadata mismatch')
  const sections = document.nodes(node => node.tag === 'section' && node.attrs['data-selector-name'] === 'jobdetails')
  need(sections.length === 2 && sections.every(section => section.attrs['data-org-id'] === '117' && section.attrs['data-job-id'] === row.id), 'Active native role scopes unavailable or conflicting')
  const header = one(sections.filter(section => document.hasClass(section, 'section11__header')), 'native role header')
  const content = one(sections.filter(section => section !== header), 'native full role scope')
  need(document.text(one(nativeDescendants(header, node => node.tag === 'h1'), 'visible native role title')) === row.title, 'Visible native role title mismatch')
  need(document.text(one(nativeDescendants(header, node => document.hasClass(node, 'section11__location')), 'visible native office')) === row.location, 'Visible native India office mismatch')
  const locationMetadata = meta(document, 'gtm_tbcn_location')
  const parts = locationMetadata.split('~')
  need(parts.length === 3 && parts[0] === row.city && parts[1] && parts[2] === 'India' && /^1269750(?:-\d+)+$/.test(meta(document, 'job-location-ids')), 'Native country metadata mismatch')
  need(Array.isArray(model.jobLocation) && model.jobLocation.length >= 1, 'Native structured offices unavailable')
  const addresses = model.jobLocation.map(location => {
    const address = location?.address
    // Only the observed empty country value and Bangalore/Bengaluru alias are
    // optional. The country-filtered listing, visible office, metadata and
    // location IDs have already independently corroborated this India office.
    need(address && ['India', ''].includes(address.addressCountry) && sameNativeCity(address.addressLocality, row.city) && typeof address.addressRegion === 'string' && norm(address.addressRegion), 'Native country/city mismatch')
    return structuredClone(address)
  })
  need(new Set(addresses.map(address => JSON.stringify(address))).size === addresses.length, 'Duplicate native offices')
  const postedAt = originalDay(model.datePosted, now)
  const activeDescriptions = nativeDescendants(content, node => document.hasClass(node, 'ats-description'))
  const visibleDates = nativeDescendants(content, node => document.hasClass(node, 'job-date'))
  const visibleRequisitions = nativeDescendants(content, node => document.hasClass(node, 'job-id'))
  need(visibleDates.length <= 1 && visibleRequisitions.length <= 1 && (!activeDescriptions.length || visibleDates.length === 1 && visibleRequisitions.length === 1), 'Visible original publication/requisition metadata unavailable')
  if (visibleDates.length) {
    const match = /^Date posted (\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(document.text(visibleDates[0]))
    need(match && `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}` === model.datePosted, 'Visible original publication date mismatch')
  }
  if (visibleRequisitions.length) need(document.text(visibleRequisitions[0]) === 'Job ID ' + req, 'Visible native requisition mismatch')
  const applicationControls = document.nodes(node => node.tag === 'a' && document.hasClass(node, 'job-apply'))
  need(applicationControls.length >= 1, 'Active role-specific application control unavailable')
  const applicationUrls = new Set(applicationControls.map(control => {
    need(!Object.hasOwn(control.attrs, 'disabled') && !Object.hasOwn(control.attrs, 'inert') && [undefined, 'false'].includes(control.attrs['aria-disabled']?.toLowerCase()) && control.attrs['data-job-id'] === row.id && control.attrs['data-job-organization-id'] === '117' && control.attrs.href === control.attrs['data-apply-url'], 'Native application control unavailable or conflicting')
    return control.attrs.href
  }))
  need(applicationUrls.size === 1, 'Conflicting native role application URLs')
  const applyUrl = [...applicationUrls][0]
  let application
  try { application = new URL(applyUrl) } catch { need(false, 'Native application URL malformed') }
  const nativeApplication = /^\/ATTGeneral\/job\/[^/]+\/[^/]+_(R-[1-9]\d*(?:-1)?)\/apply$/.exec(application.pathname)
  need(application.protocol === 'https:' && application.hostname === 'att.wd1.myworkdayjobs.com' && !application.port && !application.username && !application.password && !application.search && !application.hash && nativeApplication && requisitionFamily(nativeApplication[1]) === requisitionFamily(req) && meta(document, 'search-job-apply-url') === applyUrl, 'Native application brand/path/requisition mismatch')
  need(typeof model.description === 'string', 'Native structured full description unavailable')
  const qualified = qualifyDescription(document, content, model.description)
  if (!qualified.description) {
    const unavailable = Error('AT&T native: Current full role unavailable: ' + qualified.reason)
    Object.assign(unavailable, {code: 'ATT_NATIVE_ROLE_UNAVAILABLE', nativeJobId: row.id,
      nativeRequisitionId: req, unavailableReason: qualified.reason})
    throw unavailable
  }
  // Native JSON-LD uses a malformed timezone-bearing day (for example
  // 2026-10-31-07:00). It is retained verbatim and cannot certify an expiry.
  const validThrough = typeof model.validThrough === 'string' ? model.validThrough : null
  const exactExpiry = validThrough && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(validThrough) && Number.isFinite(Date.parse(validThrough))
  const closingDate = exactExpiry ? new Date(validThrough).toISOString() : null
  need(!closingDate || Date.parse(closingDate) >= Date.parse(postedAt), 'Native expiry precedes original publication')
  return {
    jobId: req, nativeRequisitionId: req, nativeJobId: row.id,
    company: 'AT&T', source: 'att', title: row.title,
    location: row.location, locations: [row.location], city: row.city, country: 'India',
    sourceUrl: row.url, sourceURL: row.url, url: row.url, applyUrl,
    nativeApplicationRequisitionId: nativeApplication[1],
    postedAt, datePosted: postedAt, nativePublicationDate: model.datePosted,
    sourcePostingDateIsExact: false, postingDatePrecision: 'day',
    nativePublicationSource: row.url, nativeEmployer: model.hiringOrganization.name,
    nativeLegalEmployer: null, nativeAddresses: addresses, nativeLocationMetadata: locationMetadata,
    nativeListingLocation: row.location, nativeStructuredDescription: model.description,
    nativeVisibleDescription: qualified.visibleText,
    sourceDateCorroborationComplete: visibleDates.length === 1,
    sourceRequisitionCorroborationComplete: visibleRequisitions.length === 1,
    nativeValidThrough: validThrough, closingDate, sourceClosingDateIsExact: Boolean(closingDate),
    sourceLifecycleComplete: Boolean(closingDate),
    sourceLifecycleFailureReason: closingDate ? null : validThrough ? 'native-valid-through-malformed' : 'native-valid-through-unavailable',
    nativeEmploymentType: model.employmentType ?? null,
    sourceDescription: qualified.description, jobDescription: qualified.description,
    sourceDetailComplete: Boolean(qualified.description), sourceDetailFailureReason: qualified.reason,
    sourceListingComplete: false, sourceScopeComplete: false,
    scrapedAt: new Date(now).toISOString(),
  }
}
