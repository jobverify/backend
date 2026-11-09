import { document, norm } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { requireNative, nativeCountryName, nativeDate, plainNativeHTML } from '../../scraper-support/shared/nativeJobPosting.js'
import { createPhenomScraper, extractNativeModel, extractPhAppDdo } from '../../scraper-support/phenom/engine.js'

export const SOURCE = 'akzonobel', COMPANY = 'AkzoNobel'
export const ORIGIN = 'https://careers.akzonobel.com'
export const CORPORATE = 'https://www.akzonobel.com/en/careers', HOME = ORIGIN + '/gb/en'
export const SEARCH = HOME + '/search-results', BOARD = ORIGIN + '/widgets?from=0'
const ensure = (value, message) => requireNative(value, 'AkzoNobel: ' + message)
const object = value => value && typeof value === 'object' && !Array.isArray(value)
const id = value => typeof value === 'string' && /^[1-9]\d{0,11}$/.test(value)
const contentKey = html => plainNativeHTML(html).replace(/\s+/g, '')
const readPhenomDate = (value, options) => {
  const parsed = nativeDate(typeof value === 'string' ? value.replace(/\+0000$/, 'Z') : value, options)
  return { ...parsed, raw: value ?? null }
}

export function createSourceConfig({ now = () => new Date().toISOString() } = {}) {
  const current = Date.parse(now())
  ensure(Number.isFinite(current), 'Invalid observation clock')
  // Only the shared pure extraction helpers are used here. HTTP and inventory
  // qualification remain in the bounded native collector; no second scrape.
  const phenom = createPhenomScraper({ companyName: COMPANY, source: SOURCE, baseUrl: ORIGIN,
    searchPath: '/gb/en/search-results', jobPathPrefix: '/gb/en' })
  const allowedDetails = new Set()
  const listingURL = offset => ORIGIN + '/widgets?from=' + offset
  const publicRoleURL = row => phenom.buildJobDetailUrl({ ...row, reqId: row.jobSeqNo })
  function appBinding(html, pageName) {
    const app = extractNativeModel(html, 'app')
    ensure(app?.refNum === 'ANDANAGB' && app.widgetApiEndpoint === ORIGIN + '/widgets'
      && app.baseDomain === ORIGIN && app.baseUrl === HOME + '/' && app.locale === 'en_gb'
      && app.country === 'gb' && app.deviceType === 'desktop' && app.pageName === pageName,
    'Public Phenom tenant/locale/API binding changed')
  }
  function validateRow(row) {
    ensure(object(row) && id(row.jobId) && id(row.reqId)
      && row.jobSeqNo === 'ANDANAGB' + row.jobId + 'EXTERNALENGB', 'Invalid native listing identifiers')
    ensure(typeof row.title === 'string' && norm(row.title) && row.country === 'IND'
      && typeof row.location === 'string' && row.location.endsWith(', IND')
      && row.cityStateCountry === row.location && Array.isArray(row.multi_location)
      && row.multi_location.length > 0 && row.multi_location.every(label => typeof label === 'string' && label.endsWith(', IND')),
    'Missing or conflicting explicit India listing location')
    ensure(typeof row.postedDate === 'string', 'Missing native ATS listing date')
    return row
  }
  const config = {
    source: SOURCE, companyName: COMPANY, boardURL: BOARD,
    sameReadIdentity: (from, to) => from === to,
    expectedContentType: url => new URL(url).pathname === '/widgets' ? 'application/json' : 'text/html',
    validateURL(value) {
      if ([CORPORATE, HOME, SEARCH].includes(value) || allowedDetails.has(value)) return
      const url = new URL(value), offset = url.searchParams.get('from')
      ensure(url.origin === ORIGIN && !url.username && !url.password && !url.hash && url.pathname === '/widgets'
        && url.searchParams.size === 1 && /^(?:0|[1-9]\d{0,3})$/.test(offset || '')
        && Number(offset) % 100 === 0 && value === listingURL(Number(offset)), 'Unqualified public read URL')
    },
    readRequest(url) {
      config.validateURL(url)
      if (new URL(url).pathname !== '/widgets') return { method: 'GET', headers: { Accept: 'text/html' } }
      // Body-driven cursor is mirrored in the actual request URL so the common
      // collector can distinguish pages. The server was verified with this URL.
      return { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang: 'en_gb', deviceType: 'desktop', country: 'gb', pageName: 'search-results',
          ddoKey: 'refineSearch', jobs: true, counts: true, all_fields: ['country'], size: 100, global: true,
          keywords: '', sortBy: 'Most recent', sort: { field: 'postedDate', order: 'desc' },
          selected_fields: { country: ['IND'] }, from: Number(new URL(url).searchParams.get('from')) }) }
    },
    handoffs: [
      { url: CORPORATE, verify(html) {
        ensure(document(html).nodes(n => n.tag === 'a' && n.attrs.href === ORIGIN + '/').length > 0,
          'Official corporate careers link missing')
      } },
      { url: HOME, verify: html => appBinding(html, 'home') },
      { url: SEARCH, verify(html) {
        appBinding(html, 'search-results')
        const payload = phenom.extractSearchPayload(html)
        ensure(Number.isSafeInteger(payload.totalHits) && payload.totalHits >= 0
          && Number.isSafeInteger(payload.aggregations?.country?.IND) && payload.aggregations.country.IND >= 0,
        'Missing advertised native country facet')
      } },
    ],
    parseListing(raw, url) {
      const payload = JSON.parse(raw)?.refineSearch, offset = Number(new URL(url).searchParams.get('from'))
      ensure(object(payload) && payload.status === 200 && Number.isSafeInteger(payload.totalHits)
        && payload.totalHits >= 0 && payload.totalHits <= 10000 && Array.isArray(payload.data?.jobs)
        && payload.hits === payload.data.jobs.length
        && payload.hits === Math.min(100, Math.max(0, payload.totalHits - offset)), 'Truncated or failed native search envelope')
      const records = [], errors = []
      for (const candidate of payload.data.jobs) {
        try {
          const row = validateRow(candidate), url = publicRoleURL(row)
          allowedDetails.add(url)
          records.push({ id: row.jobId, title: norm(row.title), url, locations: row.multi_location,
            countries: ['India'], nativeAPIListing: row })
        } catch (error) { errors.push({ message: error.message, rawCandidate: candidate }) }
      }
      return { pageNumber: offset / 100 + 1, lastPage: Math.max(1, Math.ceil(payload.totalHits / 100)),
        reportedTotal: payload.totalHits, observedRows: payload.hits, records, errors,
        nextURL: offset + 100 < payload.totalHits ? listingURL(offset + 100) : null, terminationKnown: true }
    },
    pageFingerprint: page => JSON.stringify([page.pageNumber, page.lastPage, page.reportedTotal,
      page.observedRows, page.records.map(row => row.nativeAPIListing), page.errors]),
    candidateForIndia: () => true,
    parseDetail(html, row) {
      appBinding(html, 'job')
      const envelope = extractPhAppDdo(html)?.jobDetail, job = envelope?.data?.job, listing = row.nativeAPIListing
      ensure(envelope?.status === 200 && object(job), 'Missing native role detail')
      const dom = document(html)
      const canonicals = dom.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical').map(n => n.attrs.href)
      const postings = dom.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json')
        .map(n => JSON.parse(n.raw)).filter(value => value['@type'] === 'JobPosting')
      // Phenom serves both native title aliases with HTTP200. Accept only the
      // two title-derived variants for this exact tenant and job sequence.
      const punctuationSlug = listing.title.normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '')
      const canonicalAlias = HOME + '/job/' + listing.jobSeqNo + '/' + punctuationSlug
      ensure(canonicals.length === 1 && [row.url, canonicalAlias].includes(canonicals[0]) && postings.length === 1,
        'Missing or conflicting role canonical/JobPosting')
      const schema = postings[0]
      ensure(job.refNum === 'ANDANAGB' && job.parentRefNum === 'ANDANAGB' && job.companyName === COMPANY
        && job.jobId === row.id && job.jobReqId === row.id && job.reqId === listing.reqId && job.jobCode === listing.reqId
        && job.jobSeqNo === listing.jobSeqNo && norm(job.title) === row.title && norm(schema.title) === row.title
        && schema.identifier?.value === row.id && schema.identifier.name === COMPANY
        && schema.hiringOrganization?.name === COMPANY, 'Native role/company/listing identity conflict')
      ensure(job.country === 'IND' && nativeCountryName(job.standardisedCountry) === 'India'
        && nativeCountryName(job.ml_country) === 'India' && job.location === listing.location
        && Array.isArray(job.multi_location) && job.multi_location.length > 0, 'Missing or conflicting native detail country')
      const locations = Array.isArray(schema.jobLocation) ? schema.jobLocation : [schema.jobLocation]
      ensure(locations.length === job.multi_location.length && locations.length <= 32, 'Native location count conflict')
      const addresses = locations.map((location, i) => {
        const address = location?.address, native = job.multi_location[i]
        ensure(object(address) && address.addressCountry === 'IND' && object(native) && native.country === 'IND'
          && typeof address.addressLocality === 'string' && address.addressLocality === native.city
          && address.addressRegion === native.state && (address.postalCode === native.postalCode
            || address.postalCode === '""' && native.postalCode === '')
          && native.location === address.addressLocality + ', IND' && row.locations.includes(native.location),
        'Conflicting typed India address')
        return { raw: address, country: 'India', nativeCountryRaw: address.addressCountry }
      })
      ensure(typeof job.description === 'string' && plainNativeHTML(job.description).length > 0
        && typeof schema.description === 'string' && contentKey(plainNativeHTML(schema.description)) === contentKey(job.description),
      'Missing or conflicting full original ATS description')
      ensure(job.postedDate === listing.postedDate && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+0000$/.test(job.postedDate),
        'Missing or conflicting explicit ATS posting time')
      const posted = nativeDate(job.postedDate.replace(/\+0000$/, 'Z'), { required: true })
      ensure(job.atsPostedDate === posted.iso.slice(0, 19).replace('T', ' ') && Date.parse(posted.iso) <= current,
        'Conflicting ATS date or future posting')
      const schemaPosted = readPhenomDate(schema.datePosted, { required: true }), closing = readPhenomDate(schema.validThrough)
      ensure(!closing.iso || closing.iso >= posted.iso, 'Native expiry precedes ATS posting')
      ensure(job.jobStatus === 'Approved' && job.displayCareerSite === true && job.skipJob === false
        && job.siteType === 'external' && job.visibilityType === 'External'
        && ['Open', 'Requisition On Hold'].includes(job.sfJobStatus) && job.postingStatus === job.sfJobStatus,
      'Unknown or conflicting native public role status')
      const normalized = phenom.extractJobDetail(html, { sourceUrl: row.url, jobId: row.id,
        requisitionId: listing.reqId, title: row.title })
      return { id: row.id, title: row.title, sourceURL: canonicals[0], nativeRequestedRoleURL: row.url, nativeListingRecord: listing,
        nativeAPIRecord: job, nativeJobPosting: schema, nativeJobPostingIdentifier: schema.identifier,
        nativeHiringOrganization: schema.hiringOrganization, nativeCountryAddresses: addresses,
        nativeVisibleLocationTexts: [], nativeSchemaDescription: schema.description, nativeVisibleDescriptionHTML: null,
        nativeDescriptionHTML: job.description, nativeDescriptionOrigin: 'official inline Phenom jobDetail.data.job.description; rendered HTML not asserted',
        nativePostedDate: posted, nativeValidThrough: closing, nativeATSPostedDate: job.postedDate,
        nativeSchemaDatePosted: schemaPosted.raw, schemaDateUsedForPostingAge: false,
        nativePhenomSequenceID: job.jobSeqNo, sourceRequisitionID: job.reqId,
        nativeQuotedEmptyPostalCode: addresses.some(address => address.raw.postalCode === '""'),
        normalizedAttributes: Object.fromEntries(['department', 'employmentType', 'experienceRequired', 'minimumQualification',
          'preferredQualification', 'requiredSkills'].map(key => [key, normalized[key] ?? null])),
        nativeApplicationURL: null, applicationsVisited: false, firstEverPublication: null, legalEmployer: null,
        sourceScopeComplete: false, ...(job.sfJobStatus === 'Requisition On Hold'
          ? { excluded: true, exclusionReason: 'native-requisition-on-hold' } : {}) }
    },
  }
  return config
}
