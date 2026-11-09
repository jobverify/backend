import { createHash } from 'node:crypto'
import { MAX_HTML_BYTES } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { requireNative } from '../../scraper-support/shared/nativeJobPosting.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const origin = 'https://www.thoughtspot.com'
const careersURL = origin + '/careers'
const listingURL = origin + '/api/getCareersListing'
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
// Reviewed first-party component, component-to-module map, and webpack loader.
// They are read as data; none of this remote JavaScript is executed.
export const PUBLIC_ASSETS = new Map([
  [origin + '/_next/static/chunks/42179.dd76c7957fb6f98e.js', 'bce23fa90538d06ccd0029740a24ffd50e5293c0a1467c0e7c98ec20f714108e'],
  [origin + '/_next/static/chunks/90155-e179c67d0f81b18d.js', '706e99fccc3472cce60e64f67e6296e2da0aa04e527ce316b123735ceb878db0'],
  [origin + '/_next/static/chunks/webpack-434ac8987fd498f9.js', '73b861c20d22629966674beaf0205bd05d363ebb7a17d57a4af9c11dbf831310'],
])
const reviewedBody = 'a3b27ad91928feb3f18fa8c8c3e55e3d948113d415a9e287ca7950398df3807f'
const recruitingHost = /(?:^|\.)(?:ashbyhq\.com|greenhouse\.io|lever\.co|myworkdayjobs\.com|workable\.com|smartrecruiters\.com|rippling\.com|jobylon\.com|recruitee\.com|bamboohr\.com|teamtailor\.com|icims\.com|successfactors\.com|oraclecloud\.com|paylocity\.com)$/i
const recruitingAction = /\b(?:apply(?: now)?|open (?:roles|positions)|job (?:openings|opportunities)|(?:view|see|search|browse|explore)(?: (?:all|our|open|available))* (?:jobs|roles|positions|openings)|join (?:our|the) team|become a spotter)\b/i
const recruitingPath = /\/(?:careers?|jobs?|openings?|positions?|open-roles|opportunities|recruit(?:ing|ment)?|apply)(?:\/|$)/i
const asciiTrim = value => value.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '')
const executable = node => {
  if (node.tag !== 'script' || !node.attrs.src || Object.hasOwn(node.attrs, 'nomodule')) return false
  // Raw empty type defaults to classic; a nonempty whitespace-only value does
  // not. Module is an unpadded HTML keyword, and classic MIME parameters are
  // not an executable script type. Unknown legacy languages need review.
  if (!Object.hasOwn(node.attrs, 'type') && (node.attrs.language || '') !== '') return false
  const type = node.attrs.type || ''
  return type === '' || type.toLowerCase() === 'module'
    || ['text/javascript', 'application/javascript'].includes(asciiTrim(type).toLowerCase())
}
const bytesOf = response => Buffer.from(response.rawBodyBase64, 'base64')

function verifyPublicPage(response) {
  requireNative(response?.status === 200, 'ThoughtSpot current public careers page unavailable')
  const doc = readNativeDocument(new TextDecoder('utf-8', { fatal: true }).decode(bytesOf(response)))
  const scripts = doc.nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__')
  requireNative(scripts.length === 1, 'ThoughtSpot current page data ambiguous')
  const data = JSON.parse(scripts[0].raw), page = data.props?.pageProps?.page
  requireNative(typeof page?.bodyJsx === 'string' && sha(Buffer.from(page.bodyJsx)) === reviewedBody,
    'ThoughtSpot public recruiting template changed; current source scope needs review')
  const advertised = new Set(doc.nodes(executable)
    .map(node => new URL(node.attrs.src, careersURL).href))
  requireNative([...PUBLIC_ASSETS.keys()].every(url => advertised.has(url)), 'ThoughtSpot current public controller delegation changed')
  for (const node of doc.nodes(node => ['a', 'iframe', 'form', 'script'].includes(node.tag))) {
    const raw = node.attrs.href || node.attrs.action || node.attrs.src
    if (!raw) continue
    const url = new URL(raw, careersURL)
    const words = [doc.text(node), node.attrs.title, node.attrs['aria-label']].filter(Boolean).join(' ')
    const recruiting = recruitingHost.test(url.hostname) || recruitingAction.test(words) || recruitingPath.test(url.pathname)
    requireNative(!recruiting || url.origin === origin && url.pathname === '/careers'
      && !url.search && ['', '#spotter'].includes(url.hash), 'ThoughtSpot additional advertised recruiting surface remains unresolved')
    requireNative(node.tag !== 'iframe', 'ThoughtSpot unreviewed embedded public recruiting surface')
  }
}

export async function finalizePublicInventory(result, transport) {
  let verifiedAt = null
  try {
    requireNative(result.handoffVerified === true, 'ThoughtSpot current employer handoff unverified')
    verifyPublicPage(result.retainedResponses.find(response => response.url === careersURL))
    const listings = result.retainedResponses.filter(response => response.url === listingURL)
    requireNative(listings.length === 2, 'ThoughtSpot opening/closing public source reads unavailable')
    for (const response of listings) {
      const payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytesOf(response)))
      requireNative(Object.keys(payload).sort().join(',') === 'data', 'ThoughtSpot unreviewed public envelope or pagination metadata')
    }
    const closingTime = Date.parse(listings.at(-1).completedAt)
    requireNative(Number.isFinite(closingTime), 'ThoughtSpot current source completion clock unavailable')
    for (const response of result.retainedResponses) {
      const time = Date.parse(response.completedAt)
      requireNative(Number.isFinite(time) && time <= closingTime && closingTime - time <= 120000,
        'ThoughtSpot source observations are not one bounded current collection')
    }
    verifiedAt = new Date(closingTime).toISOString()
    requireNative(result.failures.length === 0 && result.unknownRawFailures.length === 0
      && result.listingPaginationComplete === true && result.closingInventoryMatches === true
      && result.candidateDetails === result.jobs.length + result.exclusions.length,
    'ThoughtSpot native enumeration, geography, details or closing proof incomplete')
    for (const [url, expectedSHA] of PUBLIC_ASSETS) {
      const response = await transport(url)
      requireNative(response && response.url === url && Number.isInteger(response.status)
        && response.bodyComplete === true && response.body instanceof Uint8Array
        && response.headers && !Array.isArray(response.headers), 'ThoughtSpot incomplete public controller response')
      const body = Buffer.from(response.body)
      const headers = Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key.toLowerCase(), value]))
      requireNative(body.length <= MAX_HTML_BYTES && result.retainedResponses.reduce((sum, row) => sum + row.bodyBytes, 0) + body.length <= 16 * 1024 * 1024,
        'ThoughtSpot public proof exceeds source body budget')
      const bodySHA256 = sha(body)
      result.retainedResponses.push({ url, status: response.status, headers, bodyBytes: body.length,
        bodySHA256, rawBodyBase64: body.toString('base64'),
        bodyRepresentation: 'complete decoded HTTP response body; not compressed wire bytes',
        requestedAt: response.requestedAt || null, completedAt: response.completedAt || null,
        provenance: response.provenance || null, proofRole: 'current-public-controller' })
      requireNative(response.status === 200 && /^(?:text|application)\/javascript(?:;|$)/i.test(headers['content-type'] || '')
        && bodySHA256 === expectedSHA, 'ThoughtSpot public controller or unfiltered enumeration contract changed')
    }
  } catch (error) {
    result.failures.push({ stage: 'public-inventory-proof', name: 'NativePublicInventoryIncomplete',
      message: String(error.message || 'Unknown public inventory proof failure').slice(0, 320) })
  }
  const complete = result.handoffVerified === true && verifiedAt !== null && result.failures.length === 0
  result.publicInventoryProof = { complete, verifiedAt: complete ? verifiedAt : null,
    scope: 'current-employer-advertised-public-careers-feed',
    observedPublisherRows: result.observedListingCount, observedDistinctRoles: result.listingRecords.length,
    unknownPrivateChannels: true, legalEmployerVerified: false }
  result.sourceScopeComplete = complete
  result.cleanupAllowed = complete
  result.verifiedZeroInventory = complete && result.listingRecords.length === 0
  result.rawJobs = complete ? result.observedListingCount : null
  result.indiaJobs = complete ? result.candidateDetails : null
  result.status = complete ? 'complete-public-inventory' : 'partial'
  for (const fact of result.jobs) fact.sourceScopeComplete = complete
  result.retainedResponses.sort((a, b) => a.url.localeCompare(b.url))
  result.collectionLimits = { maxRequests: 128, detailConcurrency: 2, maxAggregateBytes: 16 * 1024 * 1024,
    nativeCollectionMaxRequests: 125, publicControllerMaxRequests: 3 }
  return result
}
