import { createFirstPartyHTMLScraper, createHTMLTransport } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { nativeCountryName, nativeLocationCountryName, nativePostingJobs, requireNative } from '../../scraper-support/shared/nativeJobPosting.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { finalizePublicInventory, PUBLIC_ASSETS } from './publicInventory.js'

export const CAREERS_URL = 'https://www.thoughtspot.com/careers'
export const LISTING_URL = 'https://www.thoughtspot.com/api/getCareersListing'
const ROLE_PREFIX = 'https://ats.rippling.com/thoughtspot/jobs/'
const UUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const same = (a, b) => norm(a).normalize('NFKC') === norm(b).normalize('NFKC')
const one = (values, name) => { requireNative(values.length === 1, 'ThoughtSpot missing/ambiguous ' + name); return values[0] }
const rootText = doc => doc.text(one(doc.nodes(node => node.tag === 'root'), 'document root'))
const contentKey = text => norm(text).replace(/\s/g, '')

export function verifyThoughtSpotPrimary(html) {
  const doc = readNativeDocument(html)
  requireNative(doc.nodes(node => node.tag === 'base').length === 0, 'ThoughtSpot unreviewed primary base URL')
  const title = one(doc.nodes(node => node.tag === 'title'), 'primary title')
  requireNative(same(title.raw, 'Careers | ThoughtSpot'), 'ThoughtSpot primary employer identity changed')
  const canonical = one(doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'primary canonical URL')
  requireNative(canonical.attrs.href === CAREERS_URL, 'ThoughtSpot primary careers identity changed')
  const data = JSON.parse(one(doc.nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__'
    && node.attrs.type === 'application/json'), 'primary page data').raw)
  // This is a current first-party careers document, not a historic ATS name or
  // a URL guessed from the source ID. Native details must reciprocate it below.
  requireNative(data.page === '/[...slug]', 'ThoughtSpot current careers route unavailable')
}

const validatedLocations = locations => {
  requireNative(Array.isArray(locations) && locations.length > 0 && locations.length <= 32, 'ThoughtSpot native locations unavailable')
  for (const location of locations) {
    requireNative(location && norm(location.name) && typeof location.countryCode === 'string'
      && /^[A-Z]{2}$/.test(location.countryCode) && norm(location.country)
      && nativeCountryName(location.countryCode) === nativeCountryName(location.country)
      && nativeCountryName(location.countryCode) !== null, 'ThoughtSpot contradictory or unknown typed country')
    // A bare CA/IN label can be a state abbreviation; it is not a typed country.
    // Native city/state fields also disambiguate labels such as Georgia.
    const label = norm(location.name)
    const cityOrState = [location.city, location.state, location.stateCode].some(value => norm(value) && same(label, value))
    const writtenCountry = /^[A-Za-z]{2,3}$/.test(label) || cityOrState ? null : nativeLocationCountryName(label)
    requireNative(!writtenCountry || writtenCountry === nativeCountryName(location.countryCode),
      'ThoughtSpot explicit written country contradicts typed country')
    if (location.countryCode !== 'IN') requireNative(!/\bIndia\b/i.test(location.name), 'ThoughtSpot contradictory India location label')
  }
  return locations
}

export function parseThoughtSpotListing(text) {
  const payload = JSON.parse(text)
  requireNative(payload && !payload.error && payload.success !== false && Array.isArray(payload.data)
    && payload.data.length <= 1000, 'ThoughtSpot native listing envelope unavailable')
  const records = [], errors = [], groups = new Map(), disputed = new Set()
  for (const row of payload.data) {
    try {
      requireNative(row && typeof row.id === 'string' && UUID.test(row.id) && !disputed.has(row.id)
        && norm(row.name) && row.url === ROLE_PREFIX + row.id, 'ThoughtSpot duplicate, foreign or malformed native identity')
      const locations = validatedLocations(row.locations)
      const previous = groups.get(row.id)
      requireNative(!previous || previous.url === row.url && same(previous.name, row.name)
        && previous.language === row.language && JSON.stringify(previous.department) === JSON.stringify(row.department),
      'ThoughtSpot conflicting publisher records for one native role')
      if (!previous) groups.set(row.id, { ...row, locations: [...locations], nativeRecords: [row] })
      else {
        previous.nativeRecords.push(row)
        for (const location of locations) if (!previous.locations.some(existing => JSON.stringify(existing) === JSON.stringify(location))) {
          previous.locations.push(location)
        }
      }
    } catch (error) {
      if (row && typeof row.id === 'string') { groups.delete(row.id); disputed.add(row.id) }
      errors.push({ message: error.message, rawCandidate: row })
    }
  }
  for (const group of groups.values()) {
    const { nativeRecords, ...record } = group
    records.push({ id: record.id, title: record.name, url: record.url, locations: record.locations.map(location => location.name),
      nativeRecord: record, nativeRecords, countries: record.locations.map(location => location.country) })
  }
  return { pageNumber: 1, lastPage: 1, nextURL: null, terminationKnown: payload.hasMore !== true && payload.next == null,
    reportedTotal: null, observedRows: payload.data.length, records, errors }
}

const DUTIES = /^(?:What You(?:['’]ll| will) Do|Key Responsibilities|Responsibilities)\s*[:?]?$/i
const REQUIREMENTS = /^(?:What You(?:['’]ll| will) Bring|What You Bring|What You Have|What We['’]re Looking For|Qualifications)\s*[:?]?$/i
const STOP = /^(?:In-Office at ThoughtSpot|About ThoughtSpot|Mandatory and Required Skills for All ThoughtSpot Roles)\s*[:?]?$/i
function requireRoleContent(html) {
  const doc = readVisibleNativeDocument(html, { strict: true }), events = []
  const visit = node => {
    if (typeof node === 'string') { events.push({ text: node }); return }
    requireNative(!node.inert && !['script', 'style', 'iframe', 'object', 'link'].includes(node.tag), 'ThoughtSpot hidden or executable description content')
    if (/^h[1-6]$/.test(node.tag) || ['strong', 'b'].includes(node.tag)) {
      const text = doc.text(node), role = DUTIES.test(text) ? 'duties' : REQUIREMENTS.test(text) ? 'requirements' : STOP.test(text) ? 'stop' : null
      if (role) { events.push({ role }); return }
    }
    node.children.forEach(visit)
  }
  doc.nodes(node => node.tag === 'root').forEach(visit)
  for (const role of ['duties', 'requirements']) {
    const index = events.findIndex(event => event.role === role)
    requireNative(index >= 0, 'ThoughtSpot full description lacks role duties or qualifications')
    const text = []
    for (const event of events.slice(index + 1)) { if (event.role) break; text.push(event.text || '') }
    requireNative(contentKey(text.join(' ')).length >= 80, 'ThoughtSpot role duties or qualifications are empty')
  }
  return rootText(doc)
}

export function parseThoughtSpotDetail(html, row) {
  const doc = readVisibleNativeDocument(html, { strict: true })
  requireNative(doc.nodes(node => node.tag === 'base').length === 0, 'ThoughtSpot unreviewed detail base URL')
  const main = one(doc.nodes(node => node.attrs.id === 'main-content'), 'visible role body')
  const withinMain = new Set()
  const include = node => { withinMain.add(node); node.children.filter(child => typeof child !== 'string').forEach(include) }
  include(main)
  const previews = doc.nodes(node => withinMain.has(node) && doc.hasClass(node, 'ATS_htmlPreview'))
  const authored = new Set()
  const mark = node => { authored.add(node); node.children.filter(child => typeof child !== 'string').forEach(mark) }
  previews.forEach(mark)
  // Publisher-authored h1 headings inside a full JD are not the page's role
  // title. Equally, they cannot replace an absent/hidden native title.
  const title = doc.text(one(doc.nodes(node => node.tag === 'h1' && withinMain.has(node) && !authored.has(node)), 'visible role title'))
  requireNative(same(title, row.title), 'ThoughtSpot visible/native title contradiction')
  const closed = /^(?:Sorry[,!]?\s*)?(?:This|That) (?:job|position|role|opportunity) (?:is|has been) (?:now\s+)?(?:no longer (?:available|open|active|accepting applications)|closed|filled|withdrawn|cancelled)\b/i
  requireNative(!doc.nodes(node => withinMain.has(node) && doc.text(node).length <= 240
    && closed.test(doc.text(node))).length, 'ThoughtSpot visible native role is closed')
  const next = JSON.parse(one(doc.nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__'
    && node.attrs.type === 'application/json'), 'native role data').raw)
  requireNative(next.page === '/[jobBoardSlug]/jobs/[jobId]' && next.query?.jobBoardSlug === 'thoughtspot'
    && next.query.jobId === row.id, 'ThoughtSpot native route/role identity changed')
  const api = next.props?.pageProps?.apiData, post = api?.jobPost
  for (const board of [api?.jobBoard, post?.board]) requireNative(board && board.slug === 'thoughtspot'
    && board.companyName === 'ThoughtSpot' && board.boardURL === CAREERS_URL && board.isTest === false,
  'ThoughtSpot reciprocal native employer board identity changed')
  requireNative(post.uuid === row.id && post.url === row.url && same(post.name, row.title)
    && post.companyName === 'ThoughtSpot' && post.unlistedFromSearch === false,
  'ThoughtSpot foreign, unlisted or contradictory native post')
  for (const labels of [api.workLocations, post.workLocations]) requireNative(Array.isArray(labels)
    && labels.length === row.locations.length && labels.every((label, index) => same(label, row.locations[index])),
  'ThoughtSpot listing/detail workplace contradiction')
  // The aria-hidden glyph labels the adjacent visible paragraph structurally;
  // no hidden text supplies geography. Publisher-authored description markup
  // cannot impersonate this native role metadata row.
  const workplaceRows = doc.nodes(node => node.tag === 'div' && withinMain.has(node) && !authored.has(node)
    && node.children.some(child => typeof child !== 'string' && child.tag === 'span'
      && child.attrs['data-icon'] === 'LOCATION_OUTLINE'))
  const visibleLocations = workplaceRows.flatMap(node => node.children.filter(child => typeof child !== 'string'
    && child.tag === 'p' && !child.inert).map(child => doc.text(child)))
  requireNative(visibleLocations.length === row.locations.length
    && visibleLocations.every((label, index) => same(label, row.locations[index])),
  'ThoughtSpot visible/native workplace contradiction or missing label')
  const application = post.activeJobApplication
  requireNative(application && Array.isArray(application.basicQuestions) && application.basicQuestions.length > 0,
    'ThoughtSpot native application unavailable')
  requireNative(doc.nodes(node => node.tag === 'button' && withinMain.has(node) && !authored.has(node)
    && node.attrs['data-testid'] === 'Apply now'
    && !Object.hasOwn(node.attrs, 'disabled') && node.attrs['data-disabled'] === 'false'
    && (!Object.hasOwn(node.attrs, 'aria-disabled') || norm(node.attrs['aria-disabled']).toLowerCase() === 'false')
    && doc.text(node) === 'Apply now').length > 0, 'ThoughtSpot visible enabled application unavailable')
  const description = post.description
  requireNative(description && !Array.isArray(description) && Object.keys(description).sort().join(',') === 'company,role'
    && Object.values(description).every(value => typeof value === 'string'), 'ThoughtSpot unreviewed native description fields')
  const rawDescription = description.company + '\n' + description.role
  const descriptionText = requireRoleContent(rawDescription)
  requireNative(previews.length > 0 && previews.length <= 2
    && contentKey(previews.map(node => doc.text(node)).join(' ')) === contentKey(descriptionText),
  'ThoughtSpot native description is not present in the visible role body')
  const india = validatedLocations(row.nativeRecord.locations).filter(location => location.countryCode === 'IN')
  requireNative(india.length > 0, 'ThoughtSpot explicit typed India country unavailable')
  const noDate = { raw: null, iso: null, precision: null, exact: false }
  return { id: row.id, title, sourceURL: row.url, nativeListingRecord: row, nativePost: post,
    nativeHiringOrganization: { name: post.companyName }, nativeDescriptionFields: description,
    nativeCountryAddresses: india.map(location => ({ raw: { addressLocality: location.city || null,
      addressRegion: location.state || null, addressCountry: location.country }, country: 'India', nativeCountryRaw: location.countryCode,
    proof: 'first-party-typed-country-reconciled-to-native-role-and-workplace' })),
    nativeVisibleLocationTexts: visibleLocations, nativeVisibleDescriptionHTML: rawDescription,
    nativePostedDate: noDate, nativeValidThrough: noDate, nativeApplicationURL: null,
    nativeCreatedOn: post.createdOn ?? null, sourceScopeComplete: false }
}

const config = {
  source: 'thoughtspot', companyName: 'ThoughtSpot', boardURL: LISTING_URL,
  // Reserve three bounded requests for current controller/enumeration proof.
  maxRequests: 125, detailConcurrency: 2, maxAggregateBytes: 10 * 1024 * 1024,
  validateURL(value) { requireNative(value === CAREERS_URL || value === LISTING_URL
    || PUBLIC_ASSETS.has(value)
    || value.startsWith(ROLE_PREFIX) && UUID.test(value.slice(ROLE_PREFIX.length)), 'ThoughtSpot unreviewed request URL') },
  sameReadIdentity: (before, after) => before === after,
  expectedContentType: value => value === LISTING_URL ? 'application/json' : PUBLIC_ASSETS.has(value) ? 'text/javascript' : 'text/html',
  handoffs: [{ url: CAREERS_URL, verify: verifyThoughtSpotPrimary }],
  parseListing: parseThoughtSpotListing,
  pageFingerprint: page => JSON.stringify({ observedRows: page.observedRows, terminationKnown: page.terminationKnown,
    errors: page.errors, records: page.records.map(row => row.nativeRecords) }),
  candidateForIndia: row => row.nativeRecord.locations.some(location => location.countryCode === 'IN'),
  parseDetail: parseThoughtSpotDetail,
  projectJobs: (result, settings) => nativePostingJobs(result, settings).map((job, index) => ({ ...job,
    nativeCreatedOn: result.jobs[index].nativeCreatedOn, nativePublicationDate: null,
    employmentType: result.jobs[index].nativePost.employmentType?.id || null,
    department: result.jobs[index].nativePost.department?.name || null })),
}

export const createThoughtSpotScraper = () => {
  const engine = createFirstPartyHTMLScraper(config)
  const collect = async (options = {}) => {
    options.signal?.throwIfAborted()
    const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(120000)])
    try {
      const transport = options.transport || createHTMLTransport(config, { ...options, signal })
      const result = await engine.collect({ ...options, transport, signal })
      await finalizePublicInventory(result, transport)
      options.signal?.throwIfAborted()
      signal.throwIfAborted()
      return result
    } catch (error) {
      options.signal?.throwIfAborted()
      signal.throwIfAborted()
      throw error
    }
  }
  return { collect, async run(options = {}) {
    const result = await collect(options), complete = result.publicInventoryProof.complete
    if (!complete && !result.jobs.length) throw Object.assign(new Error('ThoughtSpot current India inventory remains unverified'),
      { softFailure: true, abortRetries: true, failureKind: 'coverage_gap', nativeEvidence: result })
    const jobs = config.projectJobs(result, config).map(job => ({ ...job,
      sourceListingComplete: complete, sourceScopeComplete: complete, lifecycleCleanupAllowed: complete }))
    attachInventoryEvidence(jobs, {
      status: complete ? result.verifiedZeroInventory ? 'verified-empty' : 'complete-inventory' : 'coverage-gap',
      surface: LISTING_URL, firstParty: result.handoffVerified === true, listingComplete: complete,
      pagesFetched: result.pagesFetched, reportedTotal: result.nativeReportedTotal,
      indiaFacetCount: complete ? result.candidateDetails : null,
      verifiedAt: result.publicInventoryProof.verifiedAt,
      reason: complete ? 'current-employer-advertised-unfiltered-public-feed;all-countries-and-India-details-verified;stable-closing;publisher-rows=' + result.observedListingCount + ';distinct-roles=' + result.listingRecords.length
        : 'public-inventory-proof-incomplete;cleanup-forbidden;failures=' + result.failures.length,
    })
    Object.defineProperty(jobs, Symbol.for('jobverify.native-html-evidence'), { value: result })
    return jobs
  } }
}
