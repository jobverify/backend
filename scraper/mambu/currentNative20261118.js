import { readNativeDocument, extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'
import { createCorporateFeedReader, corporateScriptNodes, requireCorporateFeed, requireCorporatePublisher,
  attachCorporateFeedResult } from '../../scraper-support/utils/currentCorporateFeed20261118.js'

const CORPORATE = 'https://new.mambu.com/en/careers', ORIGIN = 'https://careers-mambu.icims.com'
const one = (values, label) => { requireCorporateFeed(values.length === 1, 'Mambu ambiguous or missing ' + label); return values[0] }
const publicURL = value => {
  const url = new URL(value)
  requireCorporateFeed(url.origin === ORIGIN && !url.username && !url.password && !url.hash, 'Mambu undeclared native account refused')
  return url
}
const roleIdentity = value => {
  const url = publicURL(value), route = url.pathname.match(/^\/jobs\/(\d+)\/[^/]+\/job$/)
  requireCorporateFeed(route, 'Mambu invalid native role path')
  return { id: route[1], canonicalURL: url.origin + url.pathname }
}
const countryCode = value => {
  if (value === 'India') return 'IN'
  if (value === 'Japan') return 'JP'
  requireCorporateFeed(typeof value === 'string' && /^[A-Z]{2}$/.test(value) && !['ZZ', 'EU', 'UN'].includes(value),
    'Mambu native worksite country unavailable')
  const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(value)
  requireCorporateFeed(name !== value, 'Mambu native worksite country invalid')
  return value
}

export function readMambuListing(html) {
  const document = readNativeDocument(html)
  const pagination = one(document.nodes(node => node.tag === 'h2' && document.hasClass(node, 'iCIMS_SubHeader_Jobs')), 'listing pagination')
  const count = document.text(pagination).match(/^Search Results Page (\d+) of (\d+)$/)
  requireCorporateFeed(count && +count[1] >= 1 && +count[2] >= +count[1], 'Mambu native pagination shape changed')
  const records = document.nodes(node => node.tag === 'li' && document.hasClass(node, 'iCIMS_JobCardItem')).map(card => {
    const anchor = one(document.nodes(node => node.tag === 'a' && document.hasClass(node, 'iCIMS_Anchor'), card), 'listing role link')
    const identity = roleIdentity(anchor.attrs.href)
    const title = document.text(one(document.nodes(node => node.tag === 'h3', card), 'listing title'))
    const header = one(document.nodes(node => document.hasClass(node, 'header') && document.hasClass(node, 'left'), card), 'listing location')
    const labels = document.nodes(node => node.tag === 'span' && !document.hasClass(node, 'field-label'), header).map(node => document.text(node))
    requireCorporateFeed(labels.length > 0 && labels.every(label => /^[A-Z]{2}-.+/.test(label)), 'Mambu native listing country unavailable')
    const countryCodes = [...new Set(labels.map(label => countryCode(label.slice(0, 2))))].sort()
    const requisition = document.nodes(node => node.tag === 'dd' && document.hasClass(node, 'iCIMS_JobHeaderData'), card)
      .map(node => document.text(node)).find(value => /^\d{4}-\d+$/.test(value))
    requireCorporateFeed(title && requisition?.endsWith('-' + identity.id), 'Mambu native listing requisition identity mismatch')
    return { ...identity, sourceURL: anchor.attrs.href, title, requisitionId: requisition, locationLabels: labels, countryCodes }
  })
  requireCorporateFeed(new Set(records.map(row => row.id)).size === records.length, 'Mambu duplicate native listing identity')
  const next = document.nodes(node => node.tag === 'a' && /next/i.test([document.text(node), node.attrs.title, node.attrs['aria-label']].join(' ')))
    .map(node => node.attrs.href).filter(Boolean).map(publicURL).filter(url => url.pathname === '/jobs/search')
  return { records, page: +count[1], pages: +count[2], next: next.length === 1 ? next[0].href : null }
}

export function readMambuDetail(html, listing, now = new Date().toISOString()) {
  const document = readNativeDocument(html)
  const schemas = document.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json' && !node.attrs.src)
    .map(node => JSON.parse(node.raw)).filter(node => node['@type'] === 'JobPosting')
  const schema = one(schemas, 'native role JobPosting')
  requireCorporateFeed(schema.hiringOrganization?.name === 'Mambu', 'Mambu native role employer mismatch')
  const identity = roleIdentity(schema.url)
  const title = document.text(one(document.nodes(node => node.tag === 'h1' && document.hasClass(node, 'iCIMS_Header')), 'native role title'))
  requireCorporateFeed(identity.id === listing.id && identity.canonicalURL === listing.canonicalURL
    && title === listing.title && schema.title === listing.title, 'Mambu listing/detail role identity mismatch')
  const countries = [...new Set([schema.jobLocation].flat().map(place => countryCode(place?.address?.addressCountry)))].sort()
  requireCorporateFeed(JSON.stringify(countries) === JSON.stringify(listing.countryCodes), 'Mambu listing/detail worksite country mismatch')
  requireCorporateFeed(extractActiveDescription(schema.description), 'Mambu native full role criteria unavailable')
  requireCorporateFeed(Number.isFinite(Date.parse(schema.datePosted)) && Number.isFinite(Date.parse(now)), 'Mambu native original publication unavailable')
  requireCorporateFeed(!schema.validThrough || Number.isFinite(Date.parse(schema.validThrough)) && Date.parse(schema.validThrough) >= Date.parse(now),
    'Mambu native role expired')
  const apply = one(document.nodes(node => node.tag === 'a' && document.hasClass(node, 'iCIMS_ApplyOnlineButton')), 'native application declaration')
  const applyURL = publicURL(apply.attrs.href)
  requireCorporateFeed(roleIdentity(applyURL).canonicalURL === listing.canonicalURL && applyURL.searchParams.get('mode') === 'apply',
    'Mambu application declaration role identity mismatch')
  const india = countries.includes('IN')
  return { source: 'mambu', company: 'Mambu', companyDomain: 'mambu.com', companyCareerPage: CORPORATE,
    jobId: identity.id, requisitionId: listing.requisitionId, title,
    location: listing.locationLabels.join(' | '), country: india ? 'India' : countries.length === 1
      ? new Intl.DisplayNames(['en'], { type: 'region' }).of(countries[0]) : null,
    nativeCountryCodes: countries, nativeWorksites: schema.jobLocation, sourceUrl: identity.canonicalURL,
    applyUrl: applyURL.href, link: applyURL.href, sourceDescription: schema.description, jobDescription: schema.description,
    postingDate: schema.datePosted, expiryDate: schema.validThrough || null, employmentType: schema.employmentType || null,
    nativeSourceRecord: schema, sourceDetailComplete: true, sourceScopeComplete: false, sourceListingComplete: false,
    lifecycleCleanupAllowed: false, applicationVisited: false, scrapedAt: new Date().toISOString() }
}

export async function runCurrentMambu(options = {}) {
  const reader = createCorporateFeedReader('mambu', options), jobs = [], records = [], details = [], failures = [], searchSnapshots = []
  try {
    const corporate = await reader.readPage(CORPORATE)
    requireCorporatePublisher(corporate.html, 'Mambu')
    const document = readNativeDocument(corporate.html)
    const links = document.nodes(node => node.tag === 'a' && /^View open positions$/i.test(document.text(node)))
      .map(node => publicURL(node.attrs.href)).filter(url => url.pathname === '/' && !url.search)
    requireCorporateFeed(links.length > 0 && new Set(links.map(url => url.href)).size === 1, 'Mambu current corporate iCIMS handoff unavailable')
    const landing = await reader.readPage(links[0].href)
    const nativeDocument = readNativeDocument(landing.html)
    requireCorporateFeed(nativeDocument.nodes(node => node.tag === 'script'
      && /^https:\/\/cdn02\.icims\.com\/a\/images\.icims\.com\/content\/platform_[^/]+\/script\/common\/icims\.js$/.test(node.attrs.src || '')).length === 1,
    'Mambu current native framework declaration unavailable')
    const declarations = corporateScriptNodes(landing.html, { pageReadyFunctions: ['icimsAddOnload'] }).filter(node => node.type === 'AssignmentExpression'
      && node.left.type === 'MemberExpression' && !node.left.computed && node.left.object.name === 'icimsFrame'
      && node.left.property.name === 'src' && node.right.type === 'Literal' && typeof node.right.value === 'string')
    const frameURL = publicURL(one(declarations, 'current iCIMS iframe declaration').right.value)
    requireCorporateFeed(frameURL.pathname === '/' && frameURL.searchParams.get('in_iframe') === '1', 'Mambu current native iframe changed')
    const intro = await reader.readPage(frameURL.href)
    requireCorporateFeed(publicURL(intro.url).pathname === '/jobs/intro', 'Mambu native intro redirect changed')
    const introDocument = readNativeDocument(intro.html)
    const search = one(introDocument.nodes(node => node.tag === 'a' && /^view all open positions$/i.test(introDocument.text(node))), 'current public search link')
    let next = publicURL(search.attrs.href).href, pages = null
    const maxPages = options.maxPages ?? 8, maxDetails = options.maxDetails ?? 80
    requireCorporateFeed(Number.isSafeInteger(maxPages) && maxPages > 0 && maxPages <= 24
      && Number.isSafeInteger(maxDetails) && maxDetails > 0 && maxDetails <= 80, 'Mambu invalid native read limits')
    for (let page = 1; next && page <= maxPages; page++) {
      requireCorporateFeed(publicURL(next).pathname === '/jobs/search', 'Mambu unbound native search request refused')
      const response = await reader.readPage(next), listing = readMambuListing(response.html)
      if (pages === null) pages = listing.pages
      requireCorporateFeed(listing.page === page && listing.pages === pages, 'Mambu native pagination drift')
      searchSnapshots.push({ url: next, listing })
      records.push(...listing.records)
      next = listing.page < listing.pages ? listing.next : null
      requireCorporateFeed(listing.page === listing.pages || next, 'Mambu native next-page declaration unavailable')
    }
    requireCorporateFeed(!next && new Set(records.map(row => row.id)).size === records.length, 'Mambu native listing incomplete or duplicated')
    for (const record of records.slice(0, maxDetails)) {
      try {
        const response = await reader.readPage(record.sourceURL)
        requireCorporateFeed(roleIdentity(response.url).canonicalURL === record.canonicalURL, 'Mambu native detail redirect identity mismatch')
        const job = readMambuDetail(response.html, record, options.now ? options.now() : undefined)
        details.push(job)
        if (job.nativeCountryCodes.includes('IN')) jobs.push(job)
      } catch (error) { reader.signal.throwIfAborted(); failures.push({ stage: 'native-detail', surface: record.sourceURL, message: error.message }); if ([401, 403, 429].includes(error.status)) break }
    }
    if (details.length !== records.length) failures.push({ stage: 'native-details', message: 'Mambu native detailed role coverage incomplete' })
    requireCorporateFeed(jobs.length > 0 || failures.length === 0, 'Mambu current native role detail inventory unavailable')
    const binding = { officialURL: corporate.url, officialPageSHA256: corporate.bodySHA256, declaredProgram: links[0].href,
      bindingMethod: 'runtime-current-corporate-iCIMS-script-frame-search-handoffs', nativeIframeURL: frameURL.href }
    let nativeScopeComplete = false
    if (failures.length === 0) {
      try {
        for (const snapshot of searchSnapshots) {
          const closing = readMambuListing((await reader.readPage(snapshot.url)).html)
          requireCorporateFeed(JSON.stringify(closing) === JSON.stringify(snapshot.listing), 'Mambu closing native role inventory changed')
        }
        for (const [index, record] of records.entries()) {
          const closingPage = await reader.readPage(record.sourceURL)
          requireCorporateFeed(roleIdentity(closingPage.url).canonicalURL === record.canonicalURL, 'Mambu closing detail redirect identity mismatch')
          const closing = readMambuDetail(closingPage.html, record, options.now ? options.now() : undefined)
          requireCorporateFeed(JSON.stringify(closing.nativeSourceRecord) === JSON.stringify(details[index].nativeSourceRecord),
            'Mambu closing native role model changed')
        }
        const closingCorporate = await reader.readPage(CORPORATE)
        requireCorporatePublisher(closingCorporate.html, 'Mambu')
        const closingDocument = readNativeDocument(closingCorporate.html)
        const closingLinks = closingDocument.nodes(node => node.tag === 'a' && /^View open positions$/i.test(closingDocument.text(node)))
          .map(node => publicURL(node.attrs.href).href)
        requireCorporateFeed(closingLinks.length === links.length && closingLinks.every(link => link === links[0].href),
          'Mambu closing corporate native handoff changed')
        nativeScopeComplete = true
        binding.closingCorporatePageSHA256 = closingCorporate.bodySHA256
      } catch (error) { reader.signal.throwIfAborted(); failures.push({ stage: 'closing-native-scope', message: error.message }) }
    }
    for (const job of jobs) job.officialAtsBinding = binding
    return attachCorporateFeedResult(jobs, { source: 'mambu', surface: CORPORATE, reader, failures, nativeScopeComplete,
      nativeBoards: [{ kind: 'icims', boardToken: 'careers-mambu', surface: search.attrs.href, binding,
        nativeRecords: records, nativeDetailedRecords: details, observedNativePages: pages }] })
  } catch (error) {
    reader.signal.throwIfAborted()
    error.nativeCollectionEvidence = { source: 'mambu', nativeRecords: records, nativeDetailedRecords: details,
      failures, receipts: reader.receipts, sourceScopeComplete: false, lifecycleCleanupAllowed: false }
    throw error
  }
}
