import { createHash } from 'node:crypto'
import { MAX_HTML_BYTES } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { requireNative } from '../../scraper-support/shared/nativeJobPosting.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { NATIVE_ASSETS, NATIVE_BOARD_URL, parseNativeBoard, boardRowFingerprint } from './nativeBoard.js'

const careersURL = 'https://www.arcadia.com/careers'
const listingURL = 'https://www.arcadia.com/api/rippling-jobs'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
// The current Prismic page selects job_listing_new. Its route map delegates to
// module84792, its loader names this exact chunk, and the component performs
// one unfiltered default feed GET followed by local search/location filtering.
// Retained remote JavaScript is compared as data and never executed.
export const PUBLIC_ASSETS = new Map([
  ['https://www.arcadia.com/_next/static/chunks/4792.8037ed21fe4fcdd2.js', '34553bb2de9afbf9c5e0ead283e05f51526ba86335a1e29a3ffa237049c29492'],
  ['https://www.arcadia.com/_next/static/chunks/pages/%5B...slug%5D-d2de9499420f13d5.js', '0369d3a76286c6d1626e3a02c20aaf0d9d0ea411976e0b930d03da0fbfeef5b0'],
  ['https://www.arcadia.com/_next/static/chunks/webpack-5077571903b5b238.js', '933ed92e5bbff976b4096c70d3f40aa92b1347f6e3d5637b468870ffeab596dc'],
  ...NATIVE_ASSETS,
])
// This SSG document contains the full Prismic slice template, all rendered
// public recruiting links, and its exact executable controller declarations.
// Even a new unrelated document revision needs review before cleanup resumes.
const currentCareersSHA = 'fcc15b1d97546975dde3374530155406b688646a03832a70f41a33e27598e480'
const proofFailure = error => ({ stage: 'public-inventory-proof', name: 'NativePublicInventoryIncomplete',
  message: String(error.message || 'Arcadia current public inventory proof unavailable').slice(0, 320) })
const bytesOf = response => Buffer.from(response.rawBodyBase64, 'base64')

async function readPublicObservation(transport, url, responses, signal, aggregateLimit = 16 * 1024 * 1024) {
  signal.throwIfAborted()
  const response = await transport(url, { method: 'GET', redirect: 'manual', credentials: 'omit', signal })
  signal.throwIfAborted()
  requireNative(response && response.url === url && Number.isInteger(response.status) && response.bodyComplete === true
    && response.body instanceof Uint8Array && response.headers && !Array.isArray(response.headers), 'Arcadia incomplete current public response')
  const body = Buffer.from(response.body), headers = Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key.toLowerCase(), value]))
  requireNative(Object.keys(headers).length === Object.keys(response.headers).length, 'Arcadia duplicate public response header casing')
  requireNative(body.length <= MAX_HTML_BYTES && responses.reduce((sum, row) => sum + row.bodyBytes, 0) + body.length <= aggregateLimit,
    'Arcadia current source proof exceeds body budget')
  const retained = { url, status: response.status, headers, bodyBytes: body.length, bodySHA256: sha(body), rawBodyBase64: body.toString('base64'),
    bodyRepresentation: 'complete decoded HTTP response body; not compressed wire bytes', requestedAt: response.requestedAt || null,
    completedAt: response.completedAt || null, provenance: response.provenance || null,
    proofRole: PUBLIC_ASSETS.has(url) ? 'current-public-controller' : url === NATIVE_BOARD_URL ? 'current-native-board-inventory' : 'closing-current-careers' }
  responses.push(retained)
  requireNative(response.status === 200, 'Arcadia current public response HTTP ' + response.status)
  const mime = headers['content-type']?.split(';')[0].trim().toLowerCase()
  requireNative(PUBLIC_ASSETS.has(url) ? ['application/javascript', 'text/javascript'].includes(mime) : mime === 'text/html',
    'Arcadia current public response MIME changed')
  if (PUBLIC_ASSETS.has(url)) requireNative(retained.bodySHA256 === PUBLIC_ASSETS.get(url), 'Arcadia current public controller or unfiltered enumeration contract changed')
  return retained
}

export async function collectPublicControllers(transport, signal) {
  const retainedResponses = [], failures = []
  for (const url of [...PUBLIC_ASSETS.keys(), NATIVE_BOARD_URL]) {
    try { await readPublicObservation(transport, url, retainedResponses, signal, 2 * 1024 * 1024) }
    catch (error) { signal.throwIfAborted(); failures.push(proofFailure(error)) }
  }
  return { retainedResponses, failures }
}

function verifyPublicPage(response) {
  requireNative(response?.status === 200, 'Arcadia current public careers document unavailable')
  const body = bytesOf(response), doc = readNativeDocument(new TextDecoder('utf-8', { fatal: true }).decode(body))
  requireNative(!doc.nodes(node => node.children.some(child => typeof child !== 'string' && child.activeFrame === true)).length,
    'Arcadia unreviewed embedded public recruiting surface')
  const scripts = doc.nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__')
  requireNative(scripts.length === 1, 'Arcadia current careers page data ambiguous')
  const next = JSON.parse(scripts[0].raw), page = next.props?.pageProps?.page
  requireNative(next.page === '/[...slug]' && JSON.stringify(next.query?.slug) === '["careers"]'
    && page?.uid === 'careers' && page.type === 'platform_page' && Array.isArray(page.data?.slices)
    && page.data.slices.filter(slice => slice.slice_type === 'job_listing_new').length === 1,
  'Arcadia current Prismic recruiting template unavailable')
  const advertised = new Set(doc.nodes(node => node.tag === 'script' && node.attrs.src).map(node => new URL(node.attrs.src, careersURL).href))
  requireNative([...PUBLIC_ASSETS.keys()].filter(url => url.startsWith('https://www.arcadia.com/')).every(url => advertised.has(url)), 'Arcadia current public controller delegation changed')
  requireNative(sha(body) === currentCareersSHA, 'Arcadia current public careers document changed; source scope needs review')
}

export async function finalizePublicInventory(result, transport, controllers, signal) {
  result.retainedResponses.push(...controllers.retainedResponses)
  result.failures.push(...controllers.failures)
  result.nativeBoardInventoryProof = { complete: false, observedPublisherRows: null, observedDistinctRoles: null }
  let verifiedAt = null
  try {
    await readPublicObservation(transport, NATIVE_BOARD_URL, result.retainedResponses, signal)
    await readPublicObservation(transport, careersURL, result.retainedResponses, signal)
    requireNative(result.handoffVerified === true, 'Arcadia current employer handoff unverified')
    const pages = result.retainedResponses.filter(row => row.url === careersURL)
    requireNative(pages.length === 2, 'Arcadia opening/closing careers observations unavailable')
    pages.forEach(verifyPublicPage)
    for (const [url, hash] of PUBLIC_ASSETS) requireNative(result.retainedResponses.filter(row => row.url === url
      && row.status === 200 && row.bodySHA256 === hash).length === 1, 'Arcadia current public controller proof incomplete')
    const feeds = result.retainedResponses.filter(row => row.url === listingURL)
    requireNative(feeds.length === 2, 'Arcadia opening/closing public feed observations unavailable')
    for (const row of feeds) {
      const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytesOf(row)))
      requireNative(Object.keys(payload).sort().join(',') === 'items,page,pageSize,totalItems,totalPages'
        && payload.page === 0 && payload.pageSize === 1000 && payload.totalItems === payload.items.length
        && (payload.totalPages === 1 || payload.totalPages === 0 && payload.totalItems === 0),
      'Arcadia public envelope, count or pagination metadata remains unresolved')
    }
    const boardResponses = result.retainedResponses.filter(row => row.url === NATIVE_BOARD_URL)
    requireNative(boardResponses.length === 2, 'Arcadia complete opening/closing native board observations unavailable')
    const nativeBoards = boardResponses.map(row => parseNativeBoard(new TextDecoder('utf-8', { fatal: true }).decode(bytesOf(row))))
    const corporateRows = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytesOf(feeds[0]))).items
    requireNative(nativeBoards.every(board => board.rowFingerprint === boardRowFingerprint(corporateRows))
      && nativeBoards[0].rowFingerprint === nativeBoards[1].rowFingerprint,
    'Arcadia native board and corporate publisher rows, identities or workplaces diverge')
    result.nativeBoardInventoryProof = { complete: true, observedPublisherRows: nativeBoards[0].observedPublisherRows,
      observedDistinctRoles: nativeBoards[0].observedDistinctRoles, visiblePublisherCards: nativeBoards[0].visiblePublisherCards,
      openingClosingStable: true, unfiltered: true, controllerVerified: true,
      declarationsVerified: nativeBoards.every(board => board.declarationProof.complete), declarationProof: nativeBoards[0].declarationProof }
    const closingTime = Date.parse(pages.at(-1).completedAt)
    requireNative(Number.isFinite(closingTime), 'Arcadia current collection completion clock unavailable')
    for (const response of result.retainedResponses) {
      const requested = Date.parse(response.requestedAt), completed = Date.parse(response.completedAt)
      requireNative(Number.isFinite(requested) && Number.isFinite(completed) && requested <= completed
        && completed <= closingTime && closingTime - requested <= 120000,
      'Arcadia source observations are not one bounded current collection')
    }
    requireNative(result.retainedResponses.reduce((sum, row) => sum + row.bodyBytes, 0) <= 16 * 1024 * 1024,
      'Arcadia current source evidence exceeds aggregate bound')
    const indiaCount = result.listingRecords.filter(row => row.nativeRecord.locations.some(location => location.countryCode === 'IN')).length
    requireNative(result.failures.length === 0 && result.unknownRawFailures.length === 0 && result.listingPaginationComplete === true
      && result.closingInventoryMatches === true && result.nativeReportedTotal === result.observedListingCount
      && result.candidateDetails === result.listingRecords.length && result.candidateDetails === result.jobs.length + result.exclusions.length
      && result.jobs.length === indiaCount && result.exclusions.every(fact => fact.nativeCountryAddresses.every(address => address.country !== 'India')),
    'Arcadia native enumeration, country, office, full detail or closing proof incomplete')
    verifiedAt = new Date(closingTime).toISOString()
  } catch (error) {
    signal.throwIfAborted()
    result.failures.push(proofFailure(error))
  }
  const complete = verifiedAt !== null && result.handoffVerified === true && result.failures.length === 0 && result.nativeBoardInventoryProof.complete === true
  result.publicInventoryProof = { complete, verifiedAt: complete ? verifiedAt : null,
    scope: 'current-employer-advertised-public-careers-feed', observedPublisherRows: result.observedListingCount,
    observedDistinctRoles: result.listingRecords.length, indiaNativeDetails: result.jobs.length,
    unknownPrivateChannels: true, legalEmployerVerified: false }
  result.sourceScopeComplete = complete
  result.cleanupAllowed = complete
  result.verifiedZeroInventory = complete && result.listingRecords.length === 0
  result.rawJobs = complete ? result.observedListingCount : null
  result.indiaJobs = complete ? result.jobs.length : null
  result.status = complete ? 'complete-public-inventory' : 'partial'
  for (const fact of [...result.jobs, ...result.exclusions]) fact.sourceScopeComplete = complete
  result.retainedResponses.sort((a, b) => a.url.localeCompare(b.url))
  result.collectionLimits = { maxRequests: 128, detailConcurrency: 2, maxAggregateBytes: 16 * 1024 * 1024,
    nativeCollectionMaxRequests: 120, nativeCollectionMaxAggregateBytes: 10 * 1024 * 1024, publicProofMaxRequests: 8,
    publicOpeningEvidenceMaxAggregateBytes: 2 * 1024 * 1024 }
  return result
}
