import { createFirstPartyHTMLScraper, createHTMLTransport } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { nativeCountryName, nativeLocationCountryName, nativePostingJobs, requireNative } from '../../scraper-support/shared/nativeJobPosting.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { collectPublicControllers, finalizePublicInventory, PUBLIC_ASSETS } from './publicInventory.js'
import { NATIVE_BOARD_URL } from './nativeBoard.js'

export const CAREERS_URL = 'https://www.arcadia.com/careers'
export const LISTING_URL = 'https://www.arcadia.com/api/rippling-jobs'
const BOARD_URL = 'https://ats.rippling.com/arcadiacareers/jobs'
const ROLE_PREFIX = BOARD_URL + '/'
const UUID = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/
const norm = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const same = (a, b) => norm(a).normalize('NFKC') === norm(b).normalize('NFKC')
const one = (values, name) => { requireNative(values.length === 1, 'Arcadia missing/ambiguous ' + name); return values[0] }
const contentKey = text => norm(text).replace(/\s/g, '')
const rootText = doc => doc.text(one(doc.nodes(node => node.tag === 'root'), 'document root'))
const sameLabels = (left, right) => Array.isArray(left) && Array.isArray(right) && left.length === right.length
  && new Set(left.map(norm)).size === left.length && new Set(right.map(norm)).size === right.length
  && left.every(label => right.some(other => same(label, other)))

export function verifyArcadiaPrimary(html) {
  const doc = readNativeDocument(html)
  requireNative(!doc.nodes(node => node.tag === 'base').length, 'Arcadia unreviewed primary base URL')
  requireNative(one(doc.nodes(node => node.tag === 'title'), 'primary title').raw === 'Careers | Arcadia', 'Arcadia primary employer identity changed')
  requireNative(one(doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'primary canonical').attrs.href === CAREERS_URL,
    'Arcadia primary careers identity changed')
  const next = JSON.parse(one(doc.nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__'
    && node.attrs.type === 'application/json'), 'primary page data').raw)
  requireNative(next.page === '/[...slug]' && JSON.stringify(next.query?.slug) === '["careers"]'
    && next.props?.pageProps?.page?.uid === 'careers' && next.props.pageProps.page.type === 'platform_page',
  'Arcadia current Prismic careers route unavailable')
}

function validatedLocations(locations) {
  requireNative(Array.isArray(locations) && locations.length > 0 && locations.length <= 32, 'Arcadia native locations unavailable')
  for (const location of locations) {
    requireNative(location && Object.keys(location).sort().join(',') === 'city,country,countryCode,name,state,stateCode,workplaceType'
      && norm(location.name) && typeof location.countryCode === 'string' && /^[A-Z]{2}$/.test(location.countryCode)
      && norm(location.country) && nativeCountryName(location.countryCode)
      && nativeCountryName(location.countryCode) === nativeCountryName(location.country)
      && ['city', 'state', 'stateCode'].every(key => location[key] === null || typeof location[key] === 'string')
      && ['ON_SITE', 'HYBRID', 'REMOTE'].includes(location.workplaceType), 'Arcadia contradictory or unknown typed country/workplace')
    const label = norm(location.name), cityOrState = [location.city, location.state, location.stateCode]
      .some(value => norm(value) && same(label, value))
    const written = /^[A-Za-z]{2,3}$/.test(label) || cityOrState ? null
      : nativeLocationCountryName(label.replace(/^Remote\s*\(([^()]+)\)$/i, '$1'))
    requireNative(!written || written === nativeCountryName(location.countryCode), 'Arcadia written country contradicts typed country')
    if (location.countryCode !== 'IN') requireNative(!/\bIndia\b/i.test(label), 'Arcadia contradictory India location label')
  }
  return locations
}

export function parseArcadiaListing(text) {
  const payload = JSON.parse(text)
  requireNative(payload && !payload.error && payload.success !== false && Array.isArray(payload.items)
    && payload.items.length <= 1000, 'Arcadia native listing envelope unavailable')
  const groups = new Map(), disputed = new Set(), errors = []
  for (const row of payload.items) {
    try {
      requireNative(row && Object.keys(row).sort().join(',') === 'department,id,language,locations,name,url'
        && typeof row.id === 'string' && UUID.test(row.id) && !disputed.has(row.id)
        && norm(row.name) && row.url === ROLE_PREFIX + row.id && row.language === 'en-US'
        && row.department && norm(row.department.name) && norm(row.department.displayName),
      'Arcadia foreign, disputed or malformed native identity')
      const locations = validatedLocations(row.locations), previous = groups.get(row.id)
      const metadata = value => JSON.stringify(Object.fromEntries(Object.keys(value).filter(key => key !== 'locations').sort().map(key => [key, value[key]])))
      requireNative(!previous || previous.metadata === metadata(row), 'Arcadia conflicting publisher records for one native role')
      const group = previous || { row, metadata: metadata(row), locations: [], nativeRecords: [] }
      for (const location of locations) {
        const existing = group.locations.find(item => same(item.name, location.name))
        requireNative(!existing || JSON.stringify(existing) === JSON.stringify(location), 'Arcadia contradictory typed metadata for one workplace label')
        if (!existing) group.locations.push(location)
      }
      group.nativeRecords.push(row)
      groups.set(row.id, group)
    } catch (error) {
      if (row && typeof row.id === 'string') { groups.delete(row.id); disputed.add(row.id) }
      errors.push({ message: error.message, rawCandidate: row })
    }
  }
  const records = [...groups.values()].map(group => ({ id: group.row.id, title: group.row.name, url: group.row.url,
    locations: group.locations.map(location => location.name), countries: group.locations.map(location => location.country),
    nativeRecord: { ...group.row, locations: group.locations }, nativeRecords: group.nativeRecords }))
  const knownEnvelope = Object.keys(payload).sort().join(',') === 'items,page,pageSize,totalItems,totalPages'
  const terminal = knownEnvelope && payload.page === 0 && payload.pageSize === 1000
    && Number.isSafeInteger(payload.totalItems) && payload.totalItems >= 0 && payload.totalItems === payload.items.length
    && (payload.totalPages === 1 || payload.totalItems === 0 && payload.totalPages === 0)
  // The reviewed public component requests only this unfiltered default page.
  // New pagination is an unresolved inventory, rather than a guessed query.
  return { pageNumber: 1, lastPage: 1, nextURL: null, terminationKnown: terminal,
    reportedTotal: Number.isSafeInteger(payload.totalItems) && payload.totalItems >= 0 ? payload.totalItems : null,
    observedRows: payload.items.length, records, errors, nativeEnvelope: { ...payload, items: undefined } }
}

const DUTIES = /^(?:\d+\.\s*)?(?:What You(?:['’]ll| will) Do|Key Responsibilities|Roles\s*&\s*Responsibilities|Responsibilities)\s*[:?]?$/i
const REQUIREMENTS = /^(?:\d+\.\s*)?(?:What Will Help You Succeed|Requirements|Required Qualifications|Qualifications|Our Ideal Candidate Profile|Must[- ]Haves?)\s*[:?]?$/i
const LOOKING_FOR = /^What We(?:['’]re| are) Looking For\s*[:?]?$/i
const STOP = /^(?:Benefits|Compensation\s*&\s*Benefits|Nice[- ]to[- ]Haves?|What We(?:['’]re| are) Not Looking For|Celebrating Diversity and Inclusion|Eliminating carbon footprints, eliminating carbon copies\.)\s*[:?]?$/i
function requireRoleContent(html) {
  const doc = readVisibleNativeDocument(html, { strict: true }), events = []
  const visit = node => {
    if (typeof node === 'string') { events.push({ text: node }); return }
    requireNative(!node.inert && !['script', 'style', 'iframe', 'object', 'link', 'base'].includes(node.tag), 'Arcadia hidden or executable description content')
    if (/^h[1-6]$/.test(node.tag) || ['strong', 'b', 'p'].includes(node.tag)) {
      const text = doc.text(node)
      const role = DUTIES.test(text) ? 'duties' : REQUIREMENTS.test(text) ? 'requirements'
        : LOOKING_FOR.test(text) ? 'looking-for' : STOP.test(text) ? 'stop' : null
      if (role) { events.push({ role }); return }
    }
    if (node.tag === 'li') events.push({ listItem: true })
    node.children.forEach(visit)
  }
  doc.nodes(node => node.tag === 'root').forEach(visit)
  const sections = events.flatMap((event, index) => {
    if (!event.role) return []
    const following = []
    for (const next of events.slice(index + 1)) { if (next.role) break; following.push(next) }
    return [{ role: event.role, text: contentKey(following.map(item => item.text || '').join(' ')),
      listItems: following.filter(item => item.listItem).length }]
  })
  requireNative(sections.some(section => section.role === 'duties' && section.text.length >= 80), 'Arcadia full description lacks substantive role duties')
  // The Revenue Ops posting has two "What We're Looking For" sections. Only
  // the final candidate-criteria list qualifies; its short introductory years
  // label and an ordinary introductory summary cannot replace qualifications.
  requireNative(sections.some(section => section.text.length >= 80 && (section.role === 'requirements'
    || section.role === 'looking-for' && section.listItems >= 2)), 'Arcadia full description lacks substantive candidate qualifications')
  return rootText(doc)
}

export function parseArcadiaDetail(html, row) {
  const doc = readVisibleNativeDocument(html, { strict: true })
  requireNative(!doc.nodes(node => node.tag === 'base').length, 'Arcadia unreviewed detail base URL')
  requireNative(one(doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical'), 'native canonical').attrs.href === row.url,
    'Arcadia native canonical role contradiction')
  const main = one(doc.nodes(node => node.attrs.id === 'main-content'), 'visible native role body'), within = new Set()
  const include = (node, target) => { target.add(node); node.children.filter(child => typeof child !== 'string').forEach(child => include(child, target)) }
  include(main, within)
  const previews = doc.nodes(node => within.has(node) && doc.hasClass(node, 'ATS_htmlPreview')), authored = new Set()
  previews.forEach(node => include(node, authored))
  const title = doc.text(one(doc.nodes(node => node.tag === 'h1' && within.has(node) && !authored.has(node)), 'visible native role title'))
  requireNative(same(title, row.title), 'Arcadia visible/native role title contradiction')
  const closed = /^(?:Sorry[,!]?\s*)?(?:This|That) (?:job|position|role|opportunity) (?:is|has been) (?:now\s+)?(?:no longer (?:available|open|active|accepting applications)|closed|filled|withdrawn|cancelled)\b/i
  requireNative(!doc.nodes(node => within.has(node) && doc.text(node).length <= 240 && closed.test(doc.text(node))).length,
    'Arcadia visible native role is closed')
  const next = JSON.parse(one(doc.nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__'
    && node.attrs.type === 'application/json'), 'native role data').raw)
  requireNative(next.page === '/[jobBoardSlug]/jobs/[jobId]' && next.query?.jobBoardSlug === 'arcadiacareers'
    && next.query.jobId === row.id, 'Arcadia native route/role identity changed')
  const api = next.props?.pageProps?.apiData, post = api?.jobPost
  for (const board of [api?.jobBoard, post?.board]) requireNative(board && board.slug === 'arcadiacareers'
    && board.companyName === 'Arcadia' && board.boardURL === BOARD_URL && board.boardType === 'RIPPLING' && board.isTest === false,
  'Arcadia native employer board identity changed')
  requireNative(post.uuid === row.id && post.url === row.url && same(post.name, row.title) && post.companyName === 'Arcadia'
    && post.unlistedFromSearch === false && post.isConfidential !== true && post.confidential !== true
    && same(post.department?.name, row.nativeRecord.department.name), 'Arcadia foreign, confidential, unlisted or contradictory native post')
  for (const labels of [api.workLocations, post.workLocations]) requireNative(sameLabels(labels, row.locations),
    'Arcadia listing/native office union contradiction')
  const workplaceRows = doc.nodes(node => node.tag === 'div' && within.has(node) && !authored.has(node)
    && node.children.some(child => typeof child !== 'string' && child.tag === 'span' && child.attrs['data-icon'] === 'LOCATION_OUTLINE'))
  const visibleLocations = workplaceRows.flatMap(node => node.children.filter(child => typeof child !== 'string'
    && child.tag === 'p' && !child.inert).map(child => doc.text(child)))
  requireNative(visibleLocations.length === post.workLocations.length && visibleLocations.every((label, index) => same(label, post.workLocations[index])),
    'Arcadia visible/native office union contradiction or missing label')
  requireNative(post.activeJobApplication && Array.isArray(post.activeJobApplication.basicQuestions)
    && post.activeJobApplication.basicQuestions.length > 0, 'Arcadia native application unavailable')
  requireNative(doc.nodes(node => node.tag === 'button' && within.has(node) && !authored.has(node)
    && node.attrs['data-testid'] === 'Apply now' && !Object.hasOwn(node.attrs, 'disabled') && node.attrs['data-disabled'] === 'false'
    && (!Object.hasOwn(node.attrs, 'aria-disabled') || norm(node.attrs['aria-disabled']).toLowerCase() === 'false')
    && doc.text(node) === 'Apply now').length > 0, 'Arcadia visible enabled application unavailable')
  const description = post.description
  requireNative(description && !Array.isArray(description) && Object.keys(description).sort().join(',') === 'company,role'
    && Object.values(description).every(value => typeof value === 'string'), 'Arcadia unreviewed native description fields')
  const rawDescription = description.company + '\n' + description.role
  const descriptionDoc = readVisibleNativeDocument(rawDescription, { strict: true }), descriptionText = rootText(descriptionDoc)
  requireNative(previews.length > 0 && previews.length <= 2 && descriptionText.length >= 100
    && contentKey(previews.map(node => doc.text(node)).join(' ')) === contentKey(descriptionText),
  'Arcadia full native description is absent from the visible role body')
  const locations = validatedLocations(row.nativeRecord.locations), noDate = { raw: null, iso: null, precision: null, exact: false }
  const fact = { id: row.id, title, sourceURL: row.url, nativeListingRecord: row, nativePost: post,
    nativeHiringOrganization: { name: post.companyName }, nativeDescriptionFields: description,
    nativeCountryAddresses: locations.map(location => ({ raw: { addressLocality: location.city,
      addressRegion: location.state, addressCountry: location.country }, country: nativeCountryName(location.countryCode),
    nativeCountryRaw: location.countryCode, proof: 'current-first-party-typed-country-reconciled-to-native-role-and-exact-office-union' })),
    nativeVisibleLocationTexts: visibleLocations, nativeVisibleDescriptionHTML: rawDescription,
    nativePostedDate: noDate, nativeValidThrough: noDate, nativeApplicationURL: null,
    nativeCreatedOn: post.createdOn ?? null, sourceScopeComplete: false }
  if (!locations.some(location => location.countryCode === 'IN')) return { ...fact, excluded: true, exclusionReason: 'native-explicit-non-India-country' }
  requireRoleContent(description.role)
  return fact
}

const config = {
  source: 'arcadia', companyName: 'Arcadia', boardURL: LISTING_URL,
  maxRequests: 120, detailConcurrency: 2, maxAggregateBytes: 10 * 1024 * 1024,
  validateURL(value) { requireNative(value === CAREERS_URL || value === LISTING_URL || value === NATIVE_BOARD_URL || PUBLIC_ASSETS.has(value)
    || value.startsWith(ROLE_PREFIX) && UUID.test(value.slice(ROLE_PREFIX.length)), 'Arcadia unreviewed request URL') },
  sameReadIdentity: (before, after) => before === after,
  expectedContentType: value => value === LISTING_URL ? 'application/json' : PUBLIC_ASSETS.has(value) ? 'application/javascript' : 'text/html',
  handoffs: [{ url: CAREERS_URL, verify: verifyArcadiaPrimary }],
  parseListing: parseArcadiaListing,
  pageFingerprint: page => JSON.stringify({ observedRows: page.observedRows, reportedTotal: page.reportedTotal,
    nativeEnvelope: page.nativeEnvelope, terminationKnown: page.terminationKnown, errors: page.errors,
    records: page.records.map(row => row.nativeRecords) }),
  // Worldwide details establish each foreign exclusion and reconcile the
  // publisher's repeated-office rows against one exact native role.
  candidateForIndia: () => true,
  parseDetail: parseArcadiaDetail,
  projectJobs: (result, settings) => nativePostingJobs(result, settings).map((job, index) => ({ ...job,
    nativeCreatedOn: result.jobs[index].nativeCreatedOn, nativePublicationDate: null,
    employmentType: result.jobs[index].nativePost.employmentType?.id || null,
    department: result.jobs[index].nativePost.department?.name || null })),
}

export const createArcadiaScraper = () => {
  const engine = createFirstPartyHTMLScraper(config)
  const collect = async (options = {}) => {
    options.signal?.throwIfAborted()
    const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(120000)])
    try {
      const transport = options.transport || createHTMLTransport(config, { ...options, signal })
      const controllers = await collectPublicControllers(transport, signal)
      const result = await engine.collect({ ...options, transport, signal })
      await finalizePublicInventory(result, transport, controllers, signal)
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
    if (!complete && !result.jobs.length) throw Object.assign(new Error('Arcadia current India inventory remains unverified'),
      { softFailure: true, abortRetries: true, failureKind: 'coverage_gap', nativeEvidence: result })
    const jobs = config.projectJobs(result, config).map(job => ({ ...job,
      sourceListingComplete: complete, sourceScopeComplete: complete, lifecycleCleanupAllowed: complete }))
    attachInventoryEvidence(jobs, { status: complete ? result.verifiedZeroInventory ? 'verified-empty' : 'complete-inventory' : 'coverage-gap',
      surface: LISTING_URL, firstParty: result.handoffVerified === true, listingComplete: complete,
      pagesFetched: result.pagesFetched, reportedTotal: result.nativeReportedTotal,
      indiaFacetCount: complete ? result.jobs.length : null, verifiedAt: result.publicInventoryProof.verifiedAt,
      lifecycleCleanupAllowed: complete,
      reason: complete ? 'current-employer-advertised-unfiltered-public-feed;native-board-inventory-reconciled;native-board-declarations-qualified;all-countries-and-native-details-verified;stable-closing-native-board-careers-and-feed;publisher-rows=' + result.observedListingCount + ';distinct-roles=' + result.listingRecords.length
        : 'public-inventory-proof-incomplete;cleanup-forbidden;failures=' + result.failures.length })
    Object.defineProperty(jobs, Symbol.for('jobverify.native-html-evidence'), { value: result })
    return jobs
  } }
}
