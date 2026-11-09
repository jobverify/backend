import {createNativeScraper,nativeProfile,nativeMetadata} from './native.js'
export {nativeMetadata}
import https from 'node:https'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const BASE_URL = 'https://jobs.volkswagen-group.com'
export const SEARCH_PATH = new URL(nativeProfile.searchURL).pathname + new URL(nativeProfile.searchURL).search
export const CAREER_PAGE_URL = new URL('/cariad/', BASE_URL).toString()

const INDIA_LOCATION_PATTERN = /\b(india|bengaluru|bangalore|pune|hyderabad|chennai|mumbai|gurugram|gurgaon|noida|delhi|navi mumbai)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&hellip;/gi, '...')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  try {
    return new URL(decodeHtmlEntities(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const defaultFetchText = (url) =>
  new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
        },
      },
      (response) => {
        const chunks = []

        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8')

          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode} for ${url}`))
            return
          }

          resolve(body)
        })
      },
    )

    request.on('error', reject)
  })

export const buildSearchUrl = () => new URL(SEARCH_PATH, BASE_URL).toString()

export const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const isIndiaLocation = (location) => INDIA_LOCATION_PATTERN.test(String(location || ''))

const extractJobIdFromUrl = (value) =>
  extractFirst(/\/(\d+)\/?(?:[#?].*)?$/i, value, (match) => match[1])

export const extractSearchResults = (html) => {
  const rows = [...String(html).matchAll(/<tr class="data-row">([\s\S]*?)<\/tr>/gi)]

  return rows
    .map((rowMatch) => {
      const rowHtml = rowMatch[1]
      const title = normalizeWhitespace(
        extractFirst(/<a[^>]*class="jobTitle-link"[^>]*>([\s\S]*?)<\/a>/i, rowHtml),
      )
      const relativeLink = normalizeWhitespace(
        extractFirst(/<a(?=[^>]*class="jobTitle-link")(?=[^>]*href="([^"]+)")[^>]*>/i, rowHtml),
      )
      const department = normalizeWhitespace(
        extractFirst(/<span class="jobDepartment">\s*([\s\S]*?)\s*<\/span>/i, rowHtml),
      )
      const location = normalizeWhitespace(
        extractFirst(/<span class="jobLocation">\s*([\s\S]*?)\s*<\/span>/i, rowHtml),
      )
      const postingDate = normalizeWhitespace(
        extractFirst(/<span class="jobDate">\s*([\s\S]*?)\s*<\/span>/i, rowHtml),
      )
      const sourceUrl = toAbsoluteUrl(relativeLink)
      const jobId = extractJobIdFromUrl(sourceUrl)

      if (!title || !location || !sourceUrl || !jobId) return null

      return {
        title,
        department,
        location,
        city: extractCity(location),
        jobId,
        requisitionId: null,
        sourceUrl,
        postingDate,
      }
    })
    .filter(Boolean)
}

export const extractJobDetail = (html, listing = {}) => {
  const title = normalizeWhitespace(
    extractFirst(/itemprop="title"[^>]*>([\s\S]*?)<\/span>/i, html),
  ) || listing.title || null
  const location = normalizeWhitespace(
    extractFirst(/itemprop="streetAddress" content="([^"]+)"/i, html),
  ) || listing.location || null
  const postingDate = normalizeWhitespace(
    extractFirst(/itemprop="datePosted" content="([^"]+)"/i, html),
  ) || listing.postingDate || null
  const descriptionHtml = extractFirst(
    /<span class="jobdescription">([\s\S]*?)<\/span>\s*<\/span>/i,
    html,
  )
  const requiredSkills = [...String(descriptionHtml ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
  const applyPath = normalizeWhitespace(
    extractFirst(/class="btn btn-primary btn-large btn-lg apply dialogApplyBtn "\s+href="([^"]+)"/i, html),
  )

  return {
    title,
    location,
    city: listing.city || extractCity(location),
    jobId: listing.jobId || extractJobIdFromUrl(listing.sourceUrl),
    requisitionId: null,
    employmentType: null,
    experienceRequired: null,
    jobDescription: stripTags(descriptionHtml),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate,
    closingDate: null,
    applyUrl: toAbsoluteUrl(applyPath),
    sourceUrl: listing.sourceUrl || null,
  }
}

const ownModel = row => [row.jobId, row.title, row.internalJobId, row.requisitionId, row.sourceUrl, row.applyUrl,
  row.sourceNativePostingHTML, row.sourceNativeDescriptionHTMLs, row.sourceNativeFields, row.sourceNativeLabelledFields,
  row.sourceNativeStructuredFields, row.sourceNativeAddresses, row.sourceNativeWorksites, row.sourceNativeLocationLabels,
  row.sourceNativeEmployer, row.sourceNativeSchemaEmployer, row.sourcePostingDate, row.sourceClosingDate,
  row.sourceNativeEmploymentDeclarations, row.sourceNativeContractType, row.sourceNativeRemoteSetting]
const modelSignature = rows => JSON.stringify(rows.map(ownModel).sort((a, b) => a[0].localeCompare(b[0])))
const awaitSourceCallback = (callback, signal) => new Promise((resolve, reject) => {
  let settled = false
  const finish = (settle, value) => { if (settled) return; settled = true; signal.removeEventListener('abort', abort); settle(value) }
  const abort = () => finish(reject, signal.reason)
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) { abort(); return }
  Promise.resolve().then(callback).then(value => finish(resolve, value), error => finish(reject, error))
})
const completeNativePass = audit => Boolean(audit?.employerBindingQualified && audit.listingStable && audit.issues.length === 0
  && audit.opening.listingReadQualified && audit.closing.listingReadQualified
  && audit.opening.reportedTotal === audit.closing.reportedTotal
  && audit.observations.length === audit.opening.reportedTotal
  && new Set(audit.observations.map(row => row.jobId)).size === audit.observations.length
  && audit.observations.every(row => row.sourceCurrentNativePostingIdentityQualified && row.sourceNativeDetailQualified
    && row.sourceNativeEmployerFieldQualified && row.sourceNativeEmployer === nativeProfile.nativeEmployer
    && !row.sourceNativeCountryScopeUnresolved && !row.sourceCountryScopeUnresolved
    && ['Germany', 'India'].includes(row.country) && Array.isArray(row.sourceNativeWorksites) && row.sourceNativeWorksites.length > 0
    && row.sourceNativeWorksites.every(worksite => worksite.countryCode === ({ Germany: 'DE', India: 'IN' })[row.country])
    && (row.country === 'India') === row.sourceIndiaWorksiteQualified
    && !row.sourceNativeValidityExpired && !row.sourceNativeValidityUnresolved && !row.sourceNativeFieldIssues?.length)
  && audit.nativeCandidateCount === audit.returnedCount)

export const createCariadScraper = (defaults = {}) => ({
  async run(provided = {}) {
    const options = { ...defaults, ...provided }
    const signal = AbortSignal.any([AbortSignal.timeout(nativeProfile.timeoutMS), ...(options.signal ? [options.signal] : [])])
    signal.throwIfAborted()
    let opening, closing
    const collector = createNativeScraper()
    const jobs = await collector.run({ ...options, signal, onRecords: undefined, onAudit: audit => { opening = audit } })
    signal.throwIfAborted()
    await collector.run({ ...options, signal, onRecords: undefined, onAudit: audit => { closing = audit } })
    signal.throwIfAborted()
    const stable = modelSignature(opening.observations) === modelSignature(closing.observations)
      && JSON.stringify(opening.opening.rows) === JSON.stringify(closing.closing.rows)
    const complete = stable && completeNativePass(opening) && completeNativePass(closing)
    for (const row of [...jobs, ...opening.observations]) Object.assign(row, {
      sourceOwnModelStabilityQualified: complete, sourceDeclaredBoardScopeComplete: complete,
      sourceScopeComplete: false, sourceListingComplete: complete, lifecycleCleanupAllowed: false,
    })
    const audit = { ...opening, opening: opening.opening, closing: closing.closing,
      openingPass: opening, closingPass: closing, observations: opening.observations,
      ownModelStabilityQualified: complete, declaredBoardScopeComplete: complete,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false,
      verificationScope: 'declared official CARIAD SE first-party native board only', companyWideCoverageClaimed: false,
      authoritativeSourceTotal: complete ? opening.opening.reportedTotal : null,
      authoritativeIndiaCount: complete ? jobs.length : null }
    if (options.onRecords) await awaitSourceCallback(() => options.onRecords(structuredClone(opening.observations)), signal)
    if (options.onAudit) await awaitSourceCallback(() => options.onAudit(structuredClone(audit)), signal)
    signal.throwIfAborted()
    return attachInventoryEvidence(jobs, { status: complete ? 'complete-inventory' : 'coverage-gap',
      surface: nativeProfile.searchURL, firstParty: opening.employerBindingQualified && closing.employerBindingQualified,
      listingComplete: complete, pagesFetched: opening.rawPages.length + closing.rawPages.length,
      reportedTotal: opening.opening.reportedTotal, indiaFacetCount: complete ? jobs.length : null,
      verifiedAt: closing.observedAt, reason: complete
        ? 'declared-official-CARIAD-SE-native-board-only; repeated-full-own-post-criteria-address-and-labelled-field-models-match; opening-and-closing-native-counts-and-identities-reconciled; no-company-wide-channel-claim'
        : 'CARIAD declared native board remains incomplete: full own-model stability, identity, employer, country, count or result cap did not reconcile' })
  },
})

export const run = async (options = {}) => createCariadScraper().run(options)
