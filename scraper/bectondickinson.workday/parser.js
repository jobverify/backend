import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { requireNative, oneNative, hasClass, nativeDate, plainNativeHTML, nativeLocationCountryName, readNativeJobPosting } from '../../scraper-support/shared/nativeJobPosting.js'

export const SOURCE = 'bectondickinson', COMPANY = 'Becton Dickinson', ORIGIN = 'https://jobs.bd.com'
export const HOME = ORIGIN + '/en', GLOBAL = HOME + '/search-jobs'
export const CORPORATE = 'https://news.bd.com/social-media-community-guidelines'
export const BOARD = HOME + '/location/india-jobs/159/1269750/2'
const ensure = (value, message) => requireNative(value, 'BD: ' + message)
const single = (d, predicate, label, root = d.root) => oneNative(d.nodes(predicate, root), 'BD ' + label)
const integer = (value, label) => {
  ensure(typeof value === 'string' && /^(?:0|[1-9]\d*)$/.test(value) && Number(value) <= 10000, label + ' invalid')
  return Number(value)
}
const rolePath = /^\/en\/job\/[a-z0-9-]+\/[a-z0-9-]+\/159\/([1-9][0-9]{0,19})$/
const key = value => norm(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
const cityKey = value => key(value).replace(/\bbangalore\b/g, 'bengaluru').replace(/\bgurugram\b/g, 'gurgaon')
// JobPosting double-escapes native numeric whitespace entities. Normalize
// that encoding only for comparison; both original descriptions are retained.
const contentKey = html => plainNativeHTML(html.replace(/&amp;(#(?:x[\da-f]+|\d+);)/gi, '&$1')).replace(/\s+/g, '')
export function createSourceConfig({ now = () => new Date().toISOString() } = {}) {
  const current = Date.parse(now()), details = new Set()
  ensure(Number.isFinite(current), 'Invalid observation clock')
  let nativeGlobalIndiaFacetCount = null
  const header = d => single(d, n => n.tag === 'section' && n.attrs['data-selector-name'] === 'jobdetails'
    && d.nodes(child => child.tag === 'dd' && hasClass(child, 'job-detail-job-id'), n).length === 1, 'native role metadata')
  const content = d => single(d, n => n.tag === 'section' && n.attrs['data-selector-name'] === 'jobdetails'
    && d.nodes(child => child.tag === 'div' && hasClass(child, 'ats-description'), n).length === 1, 'native role content')
  const description = d => single(d, n => n.tag === 'div' && hasClass(n, 'ats-description'), 'complete employer description', content(d))
  const visibleLocations = d => d.nodes(n => n.tag === 'dd' && hasClass(n, 'job-detail-location'), header(d)).map(n => d.text(n))
  const roleReader = {
    acceptedHiringOrganizations: ['Becton Dickinson & Company'], requireSchemaIdentifier: false,
    visibleTitle: d => d.text(single(d, n => n.tag === 'h1' && n.start < content(d).start, 'native role title')),
    rolePageText: d => d.text(content(d)), visibleDescriptionHTML: d => d.inner(description(d)), visibleLocations,
    compareDescriptions: (visible, schema) => contentKey(visible) === contentKey(schema),
    // Listing labels contain regions; role labels contain countries or an
    // explicit multi-location placeholder. Validate typed countries below.
    compareLocationLabels: (visible, listing) => visible.length > 0 && visible.every(Boolean) && listing.length > 0,
    readNativeDate(value, options) {
      const parsed = nativeDate(value, options)
      ensure(!options?.required || Date.parse(parsed.iso) <= current, 'Future native posting date')
      return parsed
    },
    applicationEvidence(d, schema, row) {
      for (const section of [header(d), content(d)]) ensure(section.attrs['data-org-id'] === '159'
        && section.attrs['data-job-id'] === row.id, 'Native organization/public job ID conflict')
      ensure(schema.identifier?.name === 'Job ID' && /^R-\d{5,9}$/.test(schema.identifier.value || ''), 'Missing native Workday requisition')
      const requisition = d.text(single(d, n => n.tag === 'dd' && hasClass(n, 'job-detail-job-id'), 'visible requisition', header(d)))
      ensure(requisition === schema.identifier.value, 'Visible/structured requisition mismatch')
      const links = d.nodes(n => n.tag === 'a' && hasClass(n, 'job-apply'))
      ensure(links.length >= 1 && links.length <= 4, 'Missing native application links')
      const values = links.map(link => {
        ensure(link.attrs['data-job-id'] === row.id && link.attrs['data-job-organization-id'] === '159'
          && link.attrs.href === link.attrs['data-apply-url'], 'Application/public role identity conflict')
        const url = new URL(link.attrs.href)
        ensure(url.origin === 'https://bdx.wd1.myworkdayjobs.com' && !url.username && !url.password && !url.search && !url.hash
          && new RegExp('^/EXTERNAL_CAREER_SITE_INDIA/job/[^/]+/[^/]+_' + requisition + '(?:-\\d+)?/apply$').test(url.pathname),
        'Application tenant or requisition conflict')
        return url.href
      })
      ensure(new Set(values).size === 1, 'Conflicting native application URLs')
      return { nativeApplicationURL: values[0], internalEmployeeBoardLinks: [] }
    },
  }
  const config = {
    source: SOURCE, companyName: COMPANY, boardURL: BOARD, sameReadIdentity: (from, to) => from === to,
    validateURL(value) {
      if ([HOME, GLOBAL, CORPORATE, BOARD].includes(value) || details.has(value)) return
      const url = new URL(value)
      ensure(url.origin === ORIGIN && !url.username && !url.password && !url.hash && !url.search
        && new RegExp('^' + new URL(BOARD).pathname + '/(?:[2-9]|[1-9][0-9]{1,2})$').test(url.pathname), 'Unqualified native read URL')
    },
    handoffs: [
      { url: CORPORATE, verify(html) {
        ensure(document(html).nodes(n => n.tag === 'a' && n.attrs.href === ORIGIN + '/').length > 0,
          'Official corporate public page no longer links this careers domain')
      } },
      { url: HOME, verify(html) {
        const d = document(html), orgs = d.nodes(n => n.tag === 'input' && n.attrs.name === 'orgIds').map(n => n.attrs.value)
        ensure(orgs.length > 0 && orgs.every(id => id === '159') && d.text(d.root).includes('Becton, Dickinson and Company'),
          'Official BD brand/organization changed')
        ensure(d.nodes(n => n.tag === 'a' && n.attrs.href === '/en/search-jobs').length > 0, 'Native search link missing')
      } },
      { url: GLOBAL, verify(html) {
        const d = document(html), facet = single(d, n => n.tag === 'input' && n.attrs['data-facet-type'] === '2'
          && n.attrs['data-id'] === '1269750' && n.attrs['data-display'] === 'India', 'India country facet')
        nativeGlobalIndiaFacetCount = integer(facet.attrs['data-count'], 'Native India facet count')
      } },
    ],
    parseListing(html, url) {
      const d = document(html), s = single(d, n => n.tag === 'section' && n.attrs.id === 'search-results', 'native search container')
      ensure(s.attrs['data-organization-ids'] === '159' && s.attrs['data-facet-type'] === '2'
        && s.attrs['data-facet-term'] === '1269750', 'Native organization/country filter changed')
      const total = integer(s.attrs['data-total-results'], 'Native total'), jobTotal = integer(s.attrs['data-total-job-results'], 'Native job total')
      const page = integer(s.attrs['data-current-page'], 'Native page'), pages = integer(s.attrs['data-total-pages'], 'Native last page')
      const size = integer(s.attrs['data-records-per-page'], 'Native page size'), lastPage = Math.max(1, Math.ceil(total / 15))
      ensure(jobTotal === total && size === 15 && pages === lastPage
        && page === (url === BOARD ? 1 : Number(new URL(url).pathname.split('/').at(-1))), 'Native pagination metadata contradicts total')
      const list = single(d, n => n.tag === 'ul' && hasClass(n, 'search-results-list__list'), 'native job list', s)
      const rows = list.children.filter(n => typeof n !== 'string' && n.tag === 'li')
      ensure(rows.length === Math.min(15, Math.max(0, total - (page - 1) * 15)), 'Native listing row count contradicts total')
      const records = [], errors = []
      for (const row of rows) try {
        const link = single(d, n => n.tag === 'a' && n.attrs['data-job-id'], 'native listing link', row)
        const id = link.attrs['data-job-id'], match = rolePath.exec(link.attrs.href || '')
        ensure(match && match[1] === id && link.attrs.id === 'job-' + id, 'Native public role URL/ID conflict')
        const title = d.text(link), locations = d.nodes(n => hasClass(n, 'job-location'), row).map(n => d.text(n))
        ensure(title && locations.length > 0 && locations.every(Boolean), 'Missing native listing title/location')
        const target = ORIGIN + link.attrs.href; details.add(target)
        records.push({ id, title, url: target, locations, countries: ['India'], nativeTalentBrewOrganizationID: '159', nativeGlobalIndiaFacetCount })
      } catch (error) { errors.push({ message: error.message, rawCandidate: { html: d.outer(row), text: d.text(row) } }) }
      const next = d.nodes(n => n.tag === 'a' && hasClass(n, 'next'), s), nextURL = page < lastPage ? BOARD + '/' + (page + 1) : null
      ensure(nextURL ? next.length === 1 && new URL(next[0].attrs.href, ORIGIN).href === nextURL : next.length === 0,
        'Native next-page control conflicts with total')
      return { pageNumber: page, lastPage, reportedTotal: total, observedRows: rows.length, records, errors, nextURL, terminationKnown: true }
    },
    pageFingerprint: page => JSON.stringify([page.reportedTotal, page.lastPage, page.pageNumber,
      page.records.map(r => [r.id, r.title, r.url, r.locations]), page.errors]),
    candidateForIndia: () => true,
    parseDetail(html, row) {
      // Country facets can include roles offered in India and other countries.
      // The shared reader validates every typed country; retain every address
      // and require its explicit India option, rather than asserting India-only.
      const fact = readNativeJobPosting(html, { ...row, countries: [] }, roleReader), schema = fact.nativeJobPosting, d = document(html)
      ensure(schema.url === row.url, 'Native canonical URL conflict')
      const countries = fact.nativeCountryAddresses.map(a => a.country)
      for (const label of fact.nativeVisibleLocationTexts) {
        const country = nativeLocationCountryName(label)
        ensure(!country || countries.includes(country), 'Visible/typed native country conflict')
      }
      const node = description(d), primary = single(d, n => /^h[1-6]$/.test(n.tag) && d.text(n) === 'Primary Work Location', 'primary work location heading', node)
      const next = d.nodes(n => /^h[1-6]$/.test(n.tag) && n.start > primary.start, node)[0]
      ensure(next, 'Missing primary work location boundary')
      const nativePrimaryWorkLocation = plainNativeHTML(html.slice(primary.end, next.start))
      ensure(/^IND\b/.test(nativePrimaryWorkLocation), 'Native primary workplace is not explicitly India')
      const addresses = fact.nativeCountryAddresses.filter(a => a.country === 'India')
      const city = addresses.length === 1 ? addresses[0].raw.addressLocality : null
      const consistentCity = city && fact.nativeVisibleLocationTexts.some(label => cityKey(label.split(',')[0]) === cityKey(city))
        && cityKey(nativePrimaryWorkLocation).includes(cityKey(city))
      const region = addresses.length === 1 ? addresses[0].raw.addressRegion : null
      const listingRegions = row.locations.filter(label => label.includes(',')).map(label => label.split(',').at(-1).trim())
      const regionConflict = region && listingRegions.length > 0 && !listingRegions.some(value => key(value) === key(region))
      return { ...fact, id: row.id, nativeListingRecord: row, sourceRequisitionID: schema.identifier.value,
        nativeTalentBrewJobID: row.id, nativeTalentBrewOrganizationID: '159', nativeGlobalIndiaFacetCount,
        nativePrimaryWorkLocation, nativeLocationDiscrepancy: Boolean(!consistentCity || regionConflict),
        projectedCity: consistentCity && !regionConflict ? city : null,
        projectedState: consistentCity && !regionConflict ? region || null : null,
        nativeGeographicProjection: consistentCity && !regionConflict ? 'native-typed-city-corroborated' : 'India-country-only;native-location-discrepancies-retained',
      }
    },
  }
  return config
}
