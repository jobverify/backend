import crypto from 'node:crypto'
import { createFirstPartyHTMLScraper, createHTMLTransport, MAX_HTML_BYTES, HTML_REQUEST_TIMEOUT_MS } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { nativePostingJobs, requireNative, nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readNativeDocument, activeIframeSources } from '../../scraper-support/utils/activeNativeHtml.js'
import { readBaswareRawScripts, isReviewedBaswareClassicScript } from './scriptExecution.js'

const PRIMARY_URL = 'https://careers.basware.com/'
const LOADER_URL = 'https://cdn.jobylon.com/embedder.js'
const LOADER_TARGET = 'https://static-eu.jobylon.com/js/embedder.min.24408da12364.js'
const CONTROLLER_URL = 'https://static-eu.jobylon.com/js/embed-v2.min.d139cbc386fa.js'
export const BASWARE_PROOF_URLS = [LOADER_URL, LOADER_TARGET, CONTROLLER_URL]
const LOADER_SHA256 = '288c0e5d98e21264eca0fe0c588c1f10469aec413515d00e29060c60b919bf34'
const CONTROLLER_SHA256 = '54c4a3d4c7e83122cdbb8cf219b20f11cec7e8377178fc0c949a664f1a659a72'
const PUBLIC_SCOPE = 'current-employer-advertised-unfiltered-public-Jobylon-group-195-company-1689'
const sha = body => crypto.createHash('sha256').update(body).digest('hex')
const norm = value => typeof value === 'string' ? value.normalize('NFKD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase() : ''
const country = label => label === 'USA' ? 'United States' : label === 'The Netherlands' ? 'Netherlands' : label === 'UK' ? 'United Kingdom' : nativeCountryName(label)

// Reviewed country-office labels in the native widget taxonomy. These are
// explicit employer country declarations, never country guesses from cities.
// Each physical location must also map to an office declared on that same row.
const offices = [
  ['Belgium', 'Gent'], ['Denmark', 'Frederiksberg C', 'Frederiksberg'],
  ['Finland', 'Espoo'], ['Finland', 'Pori'], ['Finland', 'Tampere'], ['France', 'Paris'],
  ['Germany', 'Home office'], ['India', 'Chandigarh'], ['Romania', 'Bucharest'], ['Romania', 'Iasi'],
  ['Netherlands', 'Amsterdam'], ['United Kingdom', 'London'], ['United Kingdom', 'Manchester'],
  ['United States', 'Austin, Texas', 'Austin'], ['United States', 'Boston'],
  ['United States', 'Charlotte Metro Area', 'Charlotte'], ['United States', 'Chicago'],
  ['United States', 'Florida'], ['United States', 'Georgia'], ['United States', 'Minneapolis'],
  ['United States', 'New York'], ['United States', 'Philadelphia'], ['United States', 'Pittsburgh'],
]
const officeByDepartment = new Map(offices.map(([name, office, alias]) => [name + '\0' + norm(office), { country: name, aliases: [office, alias].filter(Boolean).map(norm) }]))
const readOffice = label => {
  requireNative(typeof label === 'string', 'Basware missing written country-office label')
  const parts = /^(.+) - (.+)$/.exec(label), name = parts && country(parts[1])
  const office = name && officeByDepartment.get(name + '\0' + norm(parts[2]))
  requireNative(office, 'Basware unknown or contradictory country-office label')
  return office
}

export function verifyBaswareDetailAddresses(locations, row) {
  const rowOffices = row.nativeRecord.departments.map(readOffice)
  const nonPhysicalOffices = new Map([
    ['Germany\0germany', 'Home office'], ['United States\0philadelphia metropolitan area', 'Philadelphia'],
    ['United States\0georgia', 'Georgia'], ['United States\0florida', 'Florida'],
  ])
  const parsed = locations.map(location => {
    const address = location?.address
    requireNative(address && typeof address === 'object' && !Array.isArray(address)
      && typeof address.streetAddress === 'string' && typeof address.addressLocality === 'string',
    'Basware native full country address unavailable')
    const parts = address.streetAddress.split(',').map(value => value.trim()), name = country(parts.at(-1))
    requireNative(name && (address.addressCountry == null || country(address.addressCountry) === name),
      'Basware explicit detail country unavailable or contradictory')
    const locality = norm(address.addressLocality) || norm(nonPhysicalOffices.get(name + '\0' + norm(parts.slice(0, -1).join(',') || parts[0])))
    const office = locality && rowOffices.find(office => office.country === name && office.aliases.includes(locality))
    requireNative(office,
      'Basware detail address contradicts its country-office declarations')
    return { office, fact: { raw: address, country: name, nativeCountryRaw: address.streetAddress,
      proof: 'explicit-native-street-address-country-and-listing-department' } }
  })
  requireNative(row.locations.every(label => parsed.some(({ fact }) => norm(fact.raw.addressLocality) === norm(label)))
    && rowOffices.every(office => parsed.some(address => address.office === office)),
  'Basware full detail location/office accounting incomplete')
  return parsed.map(({ fact }) => fact)
}

function verifyWidgetExecution(html) {
  const scripts = readBaswareRawScripts(html)
  // The reviewed widget uses modern classic JavaScript. A source URL in a data
  // block, nomodule tag, module, or unreviewed language cannot prove delegation.
  requireNative(scripts.every(isReviewedBaswareClassicScript), 'Basware public widget script execution mode changed')
  const reviewedSources = [
    'https://cdn.jobylon.com/cdn-cgi/scripts/5c5dd728/cloudflare-static/email-decode.min.js',
    'https://static-eu.jobylon.com/js/bower_components/jquery/jquery.min.397754ba49e9.js',
    'https://static-eu.jobylon.com/js/vendor/bootstrap/3.2.0/js/bootstrap.min.abda843684d0.js',
    CONTROLLER_URL,
  ]
  const external = scripts.filter(node => node.attrs.src).map(node => new URL(node.attrs.src, 'https://cdn.jobylon.com/').href)
  requireNative(JSON.stringify(external) === JSON.stringify(reviewedSources), 'Basware public widget controller/scripts changed')
  const inline = scripts.filter(node => !node.attrs.src)
  requireNative(inline.length === 2 && inline.filter(node => /JBL\.embed_v2\[['"]jobs['"]\]/.test(node.raw || '')).length === 1,
    'Basware additional inline widget execution')
  const cloudflare = inline.find(node => !/JBL\.embed_v2\[['"]jobs['"]\]/.test(node.raw || ''))
  // The captured optional Cloudflare jsd helper differs only in its public ray
  // and capture token. It does not implement or mutate the job inventory.
  const normalized = cloudflare.raw.replace(/r:'[0-9a-f]{16}',t:'[A-Za-z0-9+/=]+'/g, "r:'[ray]',t:'[timestamp]'")
    .replace(/ray=[0-9a-f]{16}/g, 'ray=[ray]')
  requireNative(sha(normalized) === '8a89554bf0eedb0bbf573edc70c3749ae956c814fa1b516ed86a131ed004da46',
    'Basware unreviewed inline widget helper')
}

function verifyGeography(page, result) {
  const departments = page.nativeCountryOfficeTaxonomy, locations = page.nativeLocationTaxonomy
  requireNative(Array.isArray(departments) && departments.every(value => typeof value === 'string')
    && new Set(departments).size === departments.length && Array.isArray(locations)
    && locations.every(value => norm(value)) && new Set(locations.map(norm)).size === locations.length,
  'Basware missing or ambiguous native office/location taxonomy')
  const taxonomy = new Map(departments.map(label => [label, readOffice(label)]))
  requireNative(locations.every(label => [...taxonomy.values()].some(office => office.aliases.includes(norm(label)))),
    'Basware native taxonomy contains an unreviewed location')
  let india = 0, foreign = 0, unknown = 0
  for (const row of page.records) {
    try {
      const native = row.nativeRecord
      requireNative(Array.isArray(native.departments) && native.departments.length > 0
        && native.departments.length <= 64 && new Set(native.departments).size === native.departments.length
        && Array.isArray(native.locations) && native.locations.length > 0 && native.locations.length <= 64
        && native.locations.every(label => typeof label === 'string' && norm(label))
        && new Set(native.locations.map(norm)).size === native.locations.length,
      'Basware missing or ambiguous row country-office/location relation')
      const rowOffices = native.departments.map(label => {
        const office = readOffice(label)
        requireNative(taxonomy.has(label), 'Basware row office absent from native taxonomy')
        return office
      })
      requireNative(native.locations.every(label => locations.some(value => norm(value) === norm(label))
        && rowOffices.some(office => office.aliases.includes(norm(label)))),
      'Basware physical location contradicts its explicit row country-office labels')
      if (rowOffices.some(office => office.country === 'India')) india++
      else foreign++
    } catch (error) {
      unknown++
      result.failures.push({ stage: 'public-inventory-geography', code: 'NATIVE_COUNTRY_OFFICE_UNKNOWN', message: error.message })
      result.unknownRawFailures.push({ stage: 'public-inventory-geography', candidate: row })
    }
  }
  result.observedIndiaListingCount = india
  result.nonIndiaListingCount = foreign
  result.unknownCountryListingCount = unknown
  return unknown === 0 && india + foreign === result.observedListingCount
}

function verifyPublicSurface(html, config) {
  config.verifyCompletePublicHandoff(html)
  const doc = readNativeDocument(html)
  requireNative(doc.nodes(node => node.tag === 'title' && /Basware\s*\|\s*Careers/.test(node.raw || '')).length === 1,
    'Basware current careers page identity changed')
  const ats = /(?:jobylon|greenhouse|lever\.co|workday|rippling|smartrecruiters|ashbyhq|icims|successfactors|taleo|recruitee|bamboohr|workable|teamtailor)/i
  const recruiting = /\b(?:careers?|jobs|apply(?:\s+now)?|open\s+(?:roles|positions|opportunities)|(?:view|search|browse|find|all)\s+(?:jobs|roles|positions|vacancies)|job\s+(?:search|openings)|vacancies|recruit(?:ing|ment)|join\s+our\s+team|work\s+with\s+us|hiring)\b/i
  const recruitingNodes = [...doc.nodes(node => ['a', 'form', 'embed', 'object'].includes(node.tag)), ...readBaswareRawScripts(html)]
  for (const node of recruitingNodes) {
    const raw = node.attrs.href || node.attrs.action || node.attrs.src || node.attrs.data
    if (!raw) continue
    const url = new URL(raw, PRIMARY_URL)
    const allowedHome = node.tag === 'a' && url.origin === PRIMARY_URL.slice(0, -1) && url.pathname === '/' && ['', '#', '#positions'].includes(url.hash) && !url.search
    const allowedAlert = node.tag === 'a' && url.origin === PRIMARY_URL.slice(0, -1) && url.pathname === '/subscribe-to-jobs/' && !url.search
    if (allowedHome || allowedAlert || url.href === LOADER_URL) continue
    const isRecruitingRoute = /\/(?:careers?|jobs?|open-roles|open-positions|vacancies|opportunities|apply)(?:\/|$|[?#])/i.test(url.pathname)
    const recruitingHost = url.origin !== PRIMARY_URL.slice(0, -1) && /^(?:careers?|jobs?|recruit(?:ing|ment))\./i.test(url.hostname)
    requireNative(!ats.test(url.hostname) && !recruitingHost && !isRecruitingRoute
      && !recruiting.test(node.tag === 'script' ? '' : doc.text(node)),
      'Basware additional advertised recruiting surface/account')
  }
  // iframe fallback content is inert, but the delegated frame itself is active.
  const blankPixel = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg=='
  requireNative(activeIframeSources(html).every(source => source === blankPixel), 'Basware additional active recruiting iframe')
}

const retained = response => {
  const body = Buffer.from(response.body), headers = Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key.toLowerCase(), value]))
  return { url: response.url, status: response.status, headers, bodyBytes: body.length, bodySHA256: sha(body),
    rawBodyBase64: body.toString('base64'), bodyRepresentation: 'complete decoded HTTP response body; not compressed wire bytes',
    requestedAt: response.requestedAt || null, completedAt: response.completedAt || null, provenance: response.provenance || null }
}

async function abortable(task, signal) {
  signal.throwIfAborted()
  let abort
  const interrupted = new Promise((_, reject) => {
    abort = () => reject(signal.reason)
    signal.addEventListener('abort', abort, { once: true })
  })
  try { return await Promise.race([task, interrupted]) }
  finally { signal.removeEventListener('abort', abort) }
}

export async function collectBaswarePublicInventory(config, options = {}) {
  options.signal?.throwIfAborted()
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(120000)])
  const rawTransport = options.transport || createHTMLTransport(config, { ...options, signal })
  let requests = 0, totalBytes = 0, stopped = false
  const transport = async (url, requestOptions = {}) => {
    signal.throwIfAborted()
    config.validateURL(url)
    requireNative(!stopped && ++requests <= config.maxRequests, 'Basware public read stopped or request budget exhausted')
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(HTML_REQUEST_TIMEOUT_MS)])
    const response = await abortable(Promise.resolve().then(() => rawTransport(url, { ...requestOptions, signal: requestSignal })), requestSignal)
    signal.throwIfAborted()
    requireNative(response && response.url === url && response.bodyComplete === true && response.body instanceof Uint8Array
      && response.headers && !Array.isArray(response.headers) && Number.isInteger(response.status), 'Basware incomplete public response')
    totalBytes += response.body.length
    requireNative(response.body.length <= MAX_HTML_BYTES && totalBytes <= config.maxAggregateBytes, 'Basware public aggregate/body byte bound')
    const challenge = /(?:<title[^>]*>\s*(?:just a moment|access denied|security check|captcha|verify (?:you are|your identity)|attention required)|<(?:form|div)\b[^>]*\bid=["'](?:challenge-running|challenge-stage|captcha-challenge)["'])/i.test(Buffer.from(response.body).subarray(0, 16384).toString('utf8'))
    if ([403, 429].includes(response.status) || challenge) stopped = true
    requireNative(!challenge, 'Basware public upstream challenge; further requests stopped')
    return response
  }
  const result = await createFirstPartyHTMLScraper(config).collect({ ...options, signal, transport })
  options.signal?.throwIfAborted()
  signal.throwIfAborted()
  result.wholeCompanyScope = null
  result.legalEmployer = null
  result.publicInventoryScope = PUBLIC_SCOPE
  result.publicInventoryProof = { complete: false, countryPartitionComplete: false, currentUnfilteredDelegation: false,
    loaderVerified: false, controllerVerified: false, verifiedAt: null }
  try {
    requireNative(result.handoffVerified && result.pagesFetched === 1 && result.listingPaginationComplete
      && result.closingInventoryMatches && result.observedListingCount === result.listingRecords.length,
    'Basware opening/closing public inventory enumeration incomplete')
    const listings = result.retainedResponses.filter(response => response.url === config.boardURL)
    requireNative(listings.length === 2, 'Basware opening/closing response evidence missing')
    const page = config.parseListing(Buffer.from(listings[0].rawBodyBase64, 'base64').toString('utf8'))
    const closing = config.parseListing(Buffer.from(listings[1].rawBodyBase64, 'base64').toString('utf8'))
    for (const response of listings) verifyWidgetExecution(Buffer.from(response.rawBodyBase64, 'base64').toString('utf8'))
    requireNative(JSON.stringify(page.nativeCountryOfficeTaxonomy) === JSON.stringify(closing.nativeCountryOfficeTaxonomy)
      && JSON.stringify(page.nativeLocationTaxonomy) === JSON.stringify(closing.nativeLocationTaxonomy),
    'Basware native country-office taxonomy changed during check')
    result.publicInventoryProof.countryPartitionComplete = verifyGeography(page, result)
    requireNative(result.publicInventoryProof.countryPartitionComplete && result.failures.length === 0 && result.unknownRawFailures.length === 0
      && result.candidateDetails === result.observedIndiaListingCount
      && result.jobs.length + result.exclusions.length === result.candidateDetails,
    'Basware public country/detail accounting incomplete')
    const primary = result.retainedResponses.find(response => response.url === PRIMARY_URL)
    requireNative(primary, 'Basware current employer response missing')
    verifyPublicSurface(Buffer.from(primary.rawBodyBase64, 'base64').toString('utf8'), config)
    requireNative(page.controllerSources.filter(url => url === CONTROLLER_URL).length === 1
      && !page.controllerSources.some(url => /embed-v2/i.test(url) && url !== CONTROLLER_URL),
    'Basware public widget controller changed')
    result.publicInventoryProof.currentUnfilteredDelegation = true
    const readProof = async url => {
      const response = await transport(url, { method: 'GET', redirect: 'manual', credentials: 'omit', signal })
      const saved = retained(response)
      result.retainedResponses.push(saved)
      return saved
    }
    const redirect = await readProof(LOADER_URL)
    requireNative(redirect.status === 302 && redirect.headers.location === LOADER_TARGET,
      'Basware public loader delegation changed or denied')
    const loader = await readProof(LOADER_TARGET)
    requireNative(loader.status === 200 && /^(?:text|application)\/javascript(?:;|$)/i.test(loader.headers['content-type'] || '')
      && loader.bodySHA256 === LOADER_SHA256, 'Basware public loader contract changed')
    result.publicInventoryProof.loaderVerified = true
    const controller = await readProof(CONTROLLER_URL)
    // This reviewed controller assigns c.jobs=JBL.embed_v2.jobs; query={} and
    // filters/paging operate on that local array. Its only HTTP action is an
    // optional subscription POST, which the scraper never executes. A changed
    // controller needs review before the array may again prove enumeration.
    requireNative(controller.status === 200 && /^(?:text|application)\/javascript(?:;|$)/i.test(controller.headers['content-type'] || '')
      && controller.bodySHA256 === CONTROLLER_SHA256, 'Basware public controller no longer proves complete local-array enumeration')
    result.publicInventoryProof.controllerVerified = true
    const clocks = result.retainedResponses.map(response => {
      const start = Date.parse(response.requestedAt), end = Date.parse(response.completedAt)
      requireNative(Number.isFinite(start) && start > 0 && Number.isFinite(end) && end >= start && end <= Date.now(),
        'Basware original public observation clock missing or contradictory')
      return end
    })
    result.publicInventoryProof.verifiedAt = new Date(Math.max(...clocks)).toISOString()
    result.publicInventoryProof.complete = true
  } catch (error) {
    options.signal?.throwIfAborted()
    signal.throwIfAborted()
    result.failures.push({ stage: 'public-inventory-proof', code: 'PUBLIC_INVENTORY_UNPROVEN', message: error.message })
  }
  options.signal?.throwIfAborted()
  signal.throwIfAborted()
  const complete = result.publicInventoryProof.complete && result.failures.length === 0 && result.unknownRawFailures.length === 0
  result.sourceScopeComplete = complete
  result.cleanupAllowed = complete
  result.verifiedZeroInventory = complete && result.observedListingCount === 0
  result.status = complete ? 'complete-public-inventory' : 'partial'
  result.collectionLimits = { ...result.collectionLimits, requestsMade: requests, aggregateBytes: totalBytes, stoppedOnUpstreamDenialOrChallenge: stopped }
  for (const fact of result.jobs) Object.assign(fact, { sourceScopeComplete: complete, sourceListingComplete: complete,
    lifecycleCleanupAllowed: complete, publicInventoryScope: PUBLIC_SCOPE, legalEmployer: null })
  result.retainedResponses.sort((a, b) => a.url.localeCompare(b.url))
  return result
}

export function projectBaswarePublicInventory(result, config) {
  const complete = result.sourceScopeComplete === true
  const jobs = nativePostingJobs(result, config)
  for (const job of jobs) Object.assign(job, { sourceListingComplete: complete, sourceScopeComplete: complete,
    lifecycleCleanupAllowed: complete, publicInventoryScope: PUBLIC_SCOPE, legalEmployer: null })
  return attachInventoryEvidence(jobs, { status: complete ? result.verifiedZeroInventory ? 'verified-empty' : 'complete-inventory' : 'coverage-gap',
    surface: config.boardURL, firstParty: result.handoffVerified === true, listingComplete: complete,
    pagesFetched: result.pagesFetched, reportedTotal: null, indiaFacetCount: complete ? result.observedIndiaListingCount : null,
    verifiedAt: complete ? result.publicInventoryProof.verifiedAt : null,
    reason: complete
      ? `Current unfiltered employer-advertised public Jobylon group verified; observed rows=${result.observedListingCount}; verified India candidates=${result.observedIndiaListingCount}; stable closing; no unresolved advertised recruiting surface; legal-company universality unknown.`
      : 'Basware public source proof incomplete; verified role positives retained; cleanup forbidden; legal-company universality unknown.' })
}
