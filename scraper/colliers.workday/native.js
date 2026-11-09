import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { createFirstPartyHTMLScraper } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { nativeCountryName, nativeLocationCountryName, nativeDate, requireNative } from '../../scraper-support/shared/nativeJobPosting.js'

export const BOARD = 'https://careers.colliers.com/jobs?options=705&page=1'
const ORIGIN = 'https://careers.colliers.com'
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const one = (items, label) => { requireNative(items.length === 1, 'Colliers: missing or ambiguous ' + label); return items[0] }
const cls = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name)
const same = values => [...new Set(values)]
const key = html => { const doc = document(html); return doc.text(doc.root).replace(/\s/g, '') }
// A base element affects URL resolution even when it or an ancestor is hidden.
// Template contents and raw-text strings are outside the active document tree.
const hasDocumentBase = node => node.tag !== 'template' && (node.tag === 'base'
  || node.children.some(child => typeof child !== 'string' && hasDocumentBase(child)))
const publicURL = value => {
  const url = new URL(value, BOARD)
  requireNative(url.origin === ORIGIN && !url.username && !url.password && !url.hash, 'Colliers: foreign native URL')
  return url
}
const listingURL = value => {
  const url = publicURL(value)
  requireNative(url.pathname === '/jobs' && url.searchParams.getAll('options').length === 1
    && url.searchParams.get('options') === '705' && url.searchParams.getAll('page').length === 1
    && /^[1-9]\d*$/.test(url.searchParams.get('page')) && [...url.searchParams].length === 2,
  'Colliers: native regional pagination identity changed')
  return url
}
const role = value => {
  const url = publicURL(value), match = /^\/job\/[a-z\d-]+-jid-([1-9]\d*)$/.exec(url.pathname)
  requireNative(match && !url.search, 'Colliers: native role identity changed')
  return { id: match[1], url: url.href }
}
const utcDate = (value, required = false) => {
  requireNative(typeof value === 'string' || !required && value == null, 'Colliers: invalid native date')
  const date = nativeDate(value?.replace(/\+00:00$/, 'Z'), { required })
  return { ...date, raw: value ?? null }
}

export function parseColliersListing(html, value = BOARD) {
  const url = listingURL(value), doc = document(html)
  requireNative(!hasDocumentBase(doc.root), 'Colliers: unreviewed native document base')
  const indiaOptions = doc.nodes(node => node.attrs['data-option-id'] === '705')
  requireNative(indiaOptions.some(option => doc.nodes(node => node.attrs.role === 'checkbox'
    && node.attrs['aria-label'] === 'India' && node.attrs['aria-checked'] === 'true', option).length === 1),
  'Colliers: current explicit India filter missing')
  const numeric = (name, expression) => {
    const values = same(doc.nodes(node => cls(node, name)).map(node => {
      const match = expression.exec(doc.text(node))
      requireNative(match, 'Colliers: malformed native pagination value')
      return Number(match[1])
    }))
    return one(values, name)
  }
  const reportedTotal = numeric('attrax-pagination__total-results', /^(\d+) results?$/)
  const pageNumber = reportedTotal ? numeric('attrax-pagination__page-item--current', /^(\d+)$/) : 1
  const lastPage = reportedTotal ? numeric('attrax-pagination__results-of--2', /^(\d+)$/) : 1
  requireNative(pageNumber === Number(url.searchParams.get('page')) && pageNumber <= lastPage
    && lastPage <= 100 && lastPage === Math.max(1, Math.ceil(reportedTotal / 12)), 'Colliers: native page/total mismatch')
  const records = doc.nodes(node => cls(node, 'attrax-vacancy-tile')).map(card => {
    const anchor = one(doc.nodes(node => node.tag === 'a' && cls(node, 'attrax-vacancy-tile__title'), card), 'listed title/link')
    const identity = role(anchor.attrs.href)
    const locationBox = one(doc.nodes(node => cls(node, 'attrax-vacancy-tile__location-freetext'), card), 'listed native location')
    const location = doc.text(one(doc.nodes(node => cls(node, 'attrax-vacancy-tile__item-value'), locationBox), 'listed location value'))
    const title = doc.text(anchor)
    requireNative(identity.id === card.attrs['data-jobid'] && title && nativeLocationCountryName(location) === 'India',
      'Colliers: native listed identity or written India location disagrees')
    return { ...identity, title, locations: [location], countries: ['India'] }
  })
  requireNative(records.length === Math.min(12, reportedTotal - (pageNumber - 1) * 12)
    && new Set(records.map(row => row.id)).size === records.length, 'Colliers: missing or duplicate native listed role')
  const next = doc.nodes(node => cls(node, 'attrax-pagination__next'))
  if (pageNumber < lastPage) requireNative(next.length > 0 && next.every(node =>
    doc.nodes(anchor => anchor.tag === 'a' && anchor.attrs.href === `javascript:pagination(${pageNumber + 1})`, node).length === 1),
  'Colliers: advertised next page missing')
  else requireNative(next.length === 0, 'Colliers: last page still advertises continuation')
  return { records, observedRows: records.length, reportedTotal, pageNumber, lastPage,
    nextURL: pageNumber < lastPage ? ORIGIN + `/jobs?options=705&page=${pageNumber + 1}` : null,
    terminationKnown: true, fingerprint: JSON.stringify([reportedTotal, pageNumber, lastPage, records]) }
}

export function parseColliersDetail(html, row) {
  const doc = document(html), postings = []
  requireNative(!hasDocumentBase(doc.root), 'Colliers: unreviewed native document base')
  requireNative(!/\b(?:this (?:job|position|requisition) is no longer (?:available|active)|(?:this )?position (?:has been|is) filled)\b/i.test(doc.text(doc.root)),
    'Colliers: native role visibly closed')
  const visit = value => {
    if (Array.isArray(value)) { value.forEach(visit); return }
    if (!value || typeof value !== 'object') return
    if ([value['@type']].flat().includes('JobPosting')) postings.push(value)
    if (value['@graph']) visit(value['@graph'])
  }
  for (const script of doc.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')) visit(JSON.parse(script.raw))
  const posting = one(postings, 'native JobPosting')
  requireNative(role(posting.url).url === row.url && posting.hiringOrganization?.name === 'Colliers International'
    && posting.hiringOrganization.url === ORIGIN, 'Colliers: native role URL or employer mismatch')
  const title = doc.text(one(doc.nodes(node => node.attrs.id === 'headertext'), 'visible title'))
  requireNative(title === row.title && norm(posting.title) === title, 'Colliers: listing/schema/visible title mismatch')
  const description = one(doc.nodes(node => node.attrs['aria-label'] === 'Job description'), 'visible full description')
  const fullHTML = doc.inner(description)
  requireNative(doc.text(description).length >= 100 && typeof posting.description === 'string'
    && key(fullHTML) === key(posting.description), 'Colliers: missing or conflicting full native content')
  requireNative(posting.identifier?.name === 'Colliers International'
    && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(posting.identifier.value), 'Colliers: native posting identifier missing')
  requireNative(Array.isArray(posting.jobLocation) && posting.jobLocation.length === 1, 'Colliers: unreviewed native location inventory')
  const address = posting.jobLocation[0]?.address, location = norm(address?.addressLocality)
  requireNative(location === row.locations[0] && nativeLocationCountryName(location) === 'India'
    && (address.addressCountry == null || nativeCountryName(address.addressCountry) === 'India'),
  'Colliers: native written country/location contradiction')
  const city = location.split(',').slice(0, -1).join(',').trim()
  requireNative(city && doc.nodes(node => cls(node, 'attrax-text-widget__value') && doc.text(node) === location).length === 1,
    'Colliers: visible detail location missing or different')
  const links = same(doc.nodes(node => node.tag === 'a' && cls(node, 'jobApplyBtn')).map(node => node.attrs.href))
  const apply = publicURL(one(links, 'native application link'))
  requireNative(apply.pathname === '/Workflow' && [...apply.searchParams].length === 2
    && apply.searchParams.getAll('vacancyId').length === 1 && apply.searchParams.get('vacancyId') === row.id
    && apply.searchParams.getAll('workflowId').length === 1
    && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(apply.searchParams.get('workflowId')),
  'Colliers: native application identity mismatch')
  const posted = utcDate(posting.datePosted, true), expiry = utcDate(posting.validThrough)
  requireNative(!expiry.iso || expiry.iso >= posted.iso, 'Colliers: native expiry precedes publication')
  const hundredYears = new Date(posted.iso)
  hundredYears.setUTCFullYear(hundredYears.getUTCFullYear() + 100)
  // Attrax emits publication+100years as a schema expiry while its UI has an
  // unset 01Jan0001 expiry. Preserve raw schema evidence without a false deadline.
  const placeholderExpiry = expiry.iso === hundredYears.toISOString()
  return { id: row.id, title, sourceURL: row.url, nativeListingRecord: row,
    nativeJobPosting: posting, nativeJobPostingIdentifier: posting.identifier,
    nativeHiringOrganization: posting.hiringOrganization,
    nativeCountryAddresses: [{ raw: address, country: 'India', nativeCountryRaw: location.split(',').at(-1).trim() }],
    nativeWrittenLocalityCity: city, nativeVisibleLocationTexts: [location], nativeSchemaDescription: posting.description,
    nativeVisibleDescriptionHTML: fullHTML, nativePostedDate: posted,
    nativeValidThrough: placeholderExpiry ? nativeDate(null) : expiry,
    nativeSchemaExpiryPlaceholder: placeholderExpiry ? posting.validThrough : null,
    nativeApplicationURL: apply.href, nativeDirectApplyFlag: null, applicationsVisited: false,
    firstEverPublication: null, legalEmployer: null, sourceScopeComplete: false }
}

export async function runNativeColliers(options = {}) {
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(180000)])
  signal.throwIfAborted()
  const config = { source: 'colliers', companyName: 'Colliers', boardURL: BOARD,
    maxRequests: 128, maxAggregateBytes: 16 * 1024 * 1024, detailConcurrency: 4,
    validateURL(value) { const url = publicURL(value); if (url.pathname === '/jobs') listingURL(value); else role(value) },
    sameReadIdentity: (left, right) => left === right,
    handoffs: [{ url: BOARD, verify: html => parseColliersListing(html, BOARD) }],
    parseListing: parseColliersListing, candidateForIndia: () => true,
    parseDetail: parseColliersDetail, pageFingerprint: page => page.fingerprint }
  let jobs
  try { jobs = await createFirstPartyHTMLScraper(config).run({ ...options, signal }) }
  catch (error) { signal.throwIfAborted(); throw error }
  signal.throwIfAborted()
  for (const job of jobs) Object.assign(job, { city: job.nativeFacts.nativeWrittenLocalityCity,
    location: job.nativeFacts.nativeVisibleLocationTexts.join(' / '),
    sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false })
  return jobs
}
