import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'
import { withRetry } from '../../scraper-support/utils/retry.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { classifyScraperError } from '../../scraper-support/utils/failureClassification.js'

import { TECHTREE_IT_SYSTEMS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = (url) => withRetry(async () => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(20000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}, {
  attempts: 3,
  baseDelayMs: 2000,
  label: SOURCE,
})

const defaultFetchJson = (url) => withRetry(async () => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(20000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  if (response.status !== 200 || response.url !== url) {
    throw new Error('Native detail response status or URL changed')
  }

  return response.json()
}, {
  attempts: 3,
  baseDelayMs: 2000,
  label: SOURCE,
})

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(value)

const extractVisibleText = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<\/(p|div|section|article|li|h[1-6]|ul|ol|main|header|footer)>/gi, '\n')
  .replace(/<(br|hr)\b[^>]*\/?>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n')
  .replace(/<p\b[^>]*>/gi, '\n')
  .replace(/<div\b[^>]*>/gi, '\n')
  .replace(/<section\b[^>]*>/gi, '\n')
  .replace(/<article\b[^>]*>/gi, '\n')
  .replace(/<h[1-6]\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value) => {
  try {
    const url = new URL(value, CAREERS_URL)
    if (url.protocol !== 'https:' || !isSameOfficialDomain(url.href)
      || url.username || url.password || url.search || url.hash
      || !/^\/jobs\/[^/]+\/$/.test(url.pathname)) return null
    return url.toString()
  } catch {
    return null
  }
}

const extractSpecificationTerms = (cardHtml, type) => {
  const section = cardHtml.match(
    new RegExp(
      `<div\\b[^>]*class=["'][^"']*awsm-job-specification-${type}[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`,
      'i',
    ),
  )?.[1]

  if (!section) return []

  return [...section.matchAll(/awsm-job-specification-term">([\s\S]*?)</gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
}

const formatLocation = (locations) => locations.join(' / ')

const buildDetailApiUrl = (postId) => {
  if (!postId) return null

  return `https://www.techtreeit.com/wp-json/wp/v2/awsm_job_openings/${encodeURIComponent(String(postId))}`
}

const inferExperienceFromDescription = (jobDescription) => {
  const normalizedDescription = normalizeWhitespace(jobDescription)
  if (!normalizedDescription) return null

  const experienceProfile = extractJobFilterSignals({
    description: normalizedDescription,
  })?.experienceProfile
  const evidence = normalizeWhitespace(experienceProfile?.evidence)

  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
      ? 'No experience required'
      : evidence
  )
}

const isSameOfficialDomain = (value) => {
  try {
    const hostname = new URL(String(value ?? CAREERS_URL)).hostname.toLowerCase()
    return hostname === 'techtreeit.com' || hostname === 'www.techtreeit.com'
  } catch {
    return false
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Careers\s*\|\s*TechTree IT System Pvt Ltd\s*<\/title>/i.test(page)
    && text.includes('CAREERS')
    && text.includes('All Job Category')
    && /awsm-job-listings/i.test(page)
    && /awsm-job-post-title/i.test(page)
    && /More Details/i.test(page)
}

export const hasSucuriChallengeSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*You are being redirected\.\.\.\s*<\/title>/i.test(page)
    && /sucuri_cloudproxy_js/i.test(page)
    && text.includes('Javascript is required. Please enable javascript before you are allowed to see this page.')
}

export const isVerifiedCareersPage = ({ status, url, html } = {}) =>
  Number(status) === 200
  && url === CAREERS_URL
  && hasOfficialCareersSignal(html)

export const isVerifiedSucuriChallengePage = ({ status, url, html } = {}) =>
  [200, 307, 403].includes(Number(status))
  && isSameOfficialDomain(url)
  && hasSucuriChallengeSignal(html)

export const extractJobCards = (html = '') => {
  const page = String(html ?? '')
  const cards = []

  for (const match of page.matchAll(/<div class="awsm-job-listing-item awsm-list-item"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi)) {
    const cardHtml = match[0]
    const postId = cardHtml.match(/id="awsm-list-item-(\d+)"/i)?.[1] || null
    const sourceUrl = toAbsoluteUrl(cardHtml.match(/<a href="([^"]+)"[^>]*>\s*[^<]+/i)?.[1])
    const title = stripTags(cardHtml.match(/<h2 class="awsm-job-post-title">([\s\S]*?)<\/h2>/i)?.[1])
    const employmentType = extractSpecificationTerms(cardHtml, 'job-type')[0] || null
    const locations = extractSpecificationTerms(cardHtml, 'job-location')

    if (!sourceUrl || !title || locations.length === 0 || !postId) continue

    cards.push({
      title,
      employmentType,
      locations,
      location: formatLocation(locations),
      city: locations[0],
      sourceUrl,
      applyUrl: sourceUrl,
      postId,
    })
  }

  return cards
}

export const enrichJobWithDetailJson = (job, detailPayload = {}) => {
  const nativeFields = Object.fromEntries(['id', 'link', 'status', 'type', 'date', 'date_gmt', 'modified', 'modified_gmt']
    .map(key => [key, detailPayload?.[key] ?? null]))
  const reject = (code) => { throw sourceError(code, { postId: job.postId, sourceUrl: job.sourceUrl, nativeFields }) }
  if (!job.postId || !/^\d+$/.test(String(job.postId)) || String(detailPayload.id) !== String(job.postId)
    || !toAbsoluteUrl(detailPayload.link) || detailPayload.link !== job.sourceUrl
    || detailPayload.type !== 'awsm_job_openings'
    || stripTags(detailPayload.title?.rendered) !== job.title) reject('native-identity-mismatch')
  if (detailPayload.status !== 'publish') reject('native-status-not-published')
  // WordPress date is local without an offset. Only date_gmt is an exact instant;
  // modified is retained for provenance and never substituted for publication.
  const rawGmt = detailPayload.date_gmt
  if (rawGmt == null || rawGmt === '') reject('native-publication-missing')
  if (typeof rawGmt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(rawGmt)) reject('native-publication-invalid')
  const timestamp = new Date(`${rawGmt}Z`)
  if (!Number.isFinite(timestamp.getTime()) || timestamp.toISOString() !== `${rawGmt}.000Z`) reject('native-publication-invalid')
  if (!Array.isArray(job.locations) || !job.locations.length
    || !job.locations.every(location => /(?:^|,)\s*India\s*$/i.test(location))) reject('native-india-country-unproven')
  const detailHtml = detailPayload?.content?.rendered || ''
  const jobDescription = extractVisibleText(detailHtml) || null
  if (!jobDescription) reject('native-description-missing')

  return {
    ...job,
    country: 'India',
    postingDate: timestamp.toISOString(),
    postedAt: timestamp.toISOString(),
    nativeDate: nativeFields.date,
    nativeDateGmt: nativeFields.date_gmt,
    nativeModified: nativeFields.modified,
    nativeModifiedGmt: nativeFields.modified_gmt,
    nativeId: nativeFields.id,
    nativeLink: nativeFields.link,
    nativeStatus: nativeFields.status,
    sourceCountryEvidence: 'Every exact native inline role location explicitly names India',
    jobDescription,
    experienceRequired: inferExperienceFromDescription(jobDescription) || null,
    publicExperienceChecked: Boolean(jobDescription),
    sourceDetailComplete: true,
    sourceListingComplete: false,
    sourceScopeComplete: false,
    sourceCompanyCoverageComplete: false,
    sourceGlobalJobCount: null,
    sourceIndiaJobCount: null,
  }
}

const sourceError = (code, diagnostics = {}, cause = null) => {
  const error = Object.assign(new Error(`TechTree extraction failed: ${code}`, cause ? { cause } : undefined), {
    code,
    diagnostics: { listingComplete: false, companyCoverageComplete: false, ...diagnostics },
  })
  let classification
  if (code === 'careers-blocked') {
    classification = { softFailure: true, upstreamOutage: true, failureKind: 'blocked_or_access_denied' }
  } else if (code === 'careers-fetch-failed' && cause) {
    classification = classifyScraperError(cause)
  } else if (code === 'careers-unavailable' || code === 'careers-cards-missing') {
    const status = Number(diagnostics.status)
    classification = status >= 400 && status <= 599
      ? classifyScraperError(new Error(`HTTP ${status}`))
      : { softFailure: true, upstreamOutage: false, failureKind: 'surface_drift_or_fail_closed' }
  }
  if (classification?.softFailure) {
    Object.assign(error, classification)
    if (Number(diagnostics.status) === 429) {
      error.abortRetries = false
    } else if (['blocked_or_access_denied', 'surface_drift_or_fail_closed'].includes(classification.failureKind)) {
      error.abortRetries = true
    }
  }
  return error
}

export const createTechtreeItSystemsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
  } = {}) {
    let careersPage
    try { careersPage = await fetchPage(CAREERS_URL) } catch (error) {
      throw sourceError('careers-fetch-failed', { reason: error.message }, error)
    }

    if (!isVerifiedCareersPage(careersPage)) {
      try {
        const homepagePage = await fetchPage(HOMEPAGE_URL)

        if (
          isVerifiedSucuriChallengePage(careersPage)
          && isVerifiedSucuriChallengePage(homepagePage)
        ) {
          throw sourceError('careers-blocked', { status: careersPage.status, homepageStatus: homepagePage.status })
        }
      } catch (error) {
        if (error.code === 'careers-blocked') throw error
        // Fall through to the fail-closed verified-surface error below.
      }

      throw sourceError('careers-unavailable', { status: careersPage?.status ?? null, url: careersPage?.url ?? null })
    }

    const cards = extractJobCards(careersPage.html)
    if (cards.length === 0) {
      throw sourceError('careers-cards-missing')
    }

    const jobs = []
    const failures = []

    for (const card of cards) {
      const baseJob = {
        title: card.title,
        company: COMPANY,
        location: card.location,
        city: card.city,
        locations: card.locations,
        postId: card.postId,
        employmentType: card.employmentType,
        sourceUrl: card.sourceUrl,
        applyUrl: card.applyUrl,
        link: card.applyUrl,
        jobId: new URL(card.sourceUrl).pathname.split('/').filter(Boolean).at(-1),
        requisitionId: new URL(card.sourceUrl).pathname.split('/').filter(Boolean).at(-1),
        source: SOURCE,
        scrapedAt: now(),
        companyCareerPage: CAREERS_URL,
        companyDomain: PROVIDER_METADATA.companyDomain,
        atsPlatform: PROVIDER_METADATA.atsPlatform,
      }

      try {
        const detailPayload = await fetchJson(buildDetailApiUrl(card.postId))
        jobs.push(enrichJobWithDetailJson(baseJob, detailPayload))
      } catch (error) {
        failures.push({ postId: card.postId, sourceUrl: card.sourceUrl,
          code: error.code || 'detail-fetch-failed', reason: error.message, ...error.diagnostics })
      }
    }

    if (failures.length) throw sourceError('detail-extraction-failed', { observedCards: cards.length, validatedDetails: jobs.length, failures })
    return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: CAREERS_URL,
      firstParty: true, listingComplete: false, pagesFetched: 1, reportedTotal: null,
      indiaFacetCount: null, verifiedAt: now(),
      reason: 'Observed inline roles only; pagination, whole-company scope and application endpoints unverified' })
  },
})

export const run = async (options = {}) => createTechtreeItSystemsScraper(options).run(options)

const isDirectExecution = (() => {
  if (!process.argv[1]) return false

  try {
    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
