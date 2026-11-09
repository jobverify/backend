import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { extractAshbyExperienceRequired } from '../../scraper-support/utils/ashbyExperience.js'
import { createRuntimeVerifiedPublicAtsScraper } from '../../scraper-support/utils/publicAtsRuntimeInventory.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

import { RAIN_INSTANT_PAY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = RAIN_INSTANT_PAY_CATALOG.source
export const COMPANY = RAIN_INSTANT_PAY_CATALOG.companyName
export const VERIFIED_ON = RAIN_INSTANT_PAY_CATALOG.verifiedOn
export const PROVIDER_METADATA = RAIN_INSTANT_PAY_CATALOG
export const CAREERS_PAGE_URL = RAIN_INSTANT_PAY_CATALOG.companyCareerPage
export const ASHBY_PUBLIC_BOARD_URL = RAIN_INSTANT_PAY_CATALOG.ashbyPublicBoardUrl
export const ASHBY_JOB_BOARD_URL = RAIN_INSTANT_PAY_CATALOG.ashbyJobBoardUrl

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6]|\/a|\/span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;|&#038;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalized.replace(/([a-z])([A-Z])/g, '$1 $2')
}

const getAddress = (job = {}) => job?.address?.postalAddress || job?.address || {}

const buildLocation = (job = {}) => {
  const label = normalizeWhitespace(job?.location)
  const address = getAddress(job)
  const city = normalizeWhitespace(address?.addressLocality)
  const state = normalizeWhitespace(address?.addressRegion)
  const country = normalizeWhitespace(address?.addressCountry)
  const addressLocation = [city, state, country].filter(Boolean).join(', ')

  if (city && country) {
    return {
      location: [city, country].filter(Boolean).join(', '),
      city,
      state,
      country,
    }
  }

  return {
    location: label || addressLocation || null,
    city,
    state,
    country,
  }
}

const inferRemoteStatus = (job = {}) => {
  if (job?.isRemote === true || /remote/i.test(String(job?.workplaceType ?? ''))) return 'Remote'
  if (/hybrid/i.test(String(job?.workplaceType ?? ''))) return 'Hybrid'
  if (job?.workplaceType) return 'On-site'
  return null
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  includeResponseMetadata: true,
  signal,
})

const defaultFetchJson = (url, { signal } = {}) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  },
  label: SOURCE,
  timeoutMs: 15000,
  signal,
})

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Rain\s*-\s*Careers\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Our mission')
    && normalized.includes('Welcome to Rain')
    && normalized.includes('See open roles')
}

export const extractVerifiedAshbyPublicBoardUrl = (html = '') =>
  /https:\/\/jobs\.ashbyhq\.com\/rain-technologies\b/i.test(String(html ?? ''))
    ? ASHBY_PUBLIC_BOARD_URL
    : null

export const buildAshbyJobBoardUrl = (publicBoardUrl) => {
  try {
    const url = new URL(String(publicBoardUrl ?? ''))
    if (url.hostname !== 'jobs.ashbyhq.com') return null
    const slug = url.pathname.split('/').filter(Boolean)[0]
    return slug ? `https://api.ashbyhq.com/posting-api/job-board/${slug}` : null
  } catch {
    return null
  }
}

export const extractAshbyJobs = (payload = {}) =>
  (Array.isArray(payload?.jobs) ? payload.jobs : [])
    .filter((job) => job?.isListed === true)
    .map((job) => {
      const title = normalizeWhitespace(job?.title)
      const jobId = normalizeWhitespace(job?.id)
      const sourceUrl = normalizeWhitespace(job?.jobUrl)
      const applyUrl = normalizeWhitespace(job?.applyUrl)
      const location = buildLocation(job)

      if (!title || !jobId || !sourceUrl || !applyUrl) return null

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job?.department),
        location: location.location,
        city: location.city,
        state: location.state,
        country: location.country,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl,
        employmentType: normalizeEmploymentType(job?.employmentType),
        experienceRequired: extractAshbyExperienceRequired({
          title,
          jobDescription: normalizeWhitespace(job?.descriptionPlain ?? job?.descriptionHtml),
        }),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(job?.publishedAt),
        closingDate: null,
        jobDescription: normalizeWhitespace(job?.descriptionPlain ?? job?.descriptionHtml),
        remoteStatus: inferRemoteStatus(job),
      }
    })
    .filter(Boolean)

export const createRainInstantPayScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    fetchPage,
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const response = await (fetchPage || fetchText)(CAREERS_PAGE_URL, { signal })
    signal?.throwIfAborted()
    // String responses are a legacy injected transport contract. The default
    // HTTP client retains status and final URL for current employer validation.
    const employerPage = typeof response === 'string' && fetchText !== defaultFetchText
      ? { status: 200, url: CAREERS_PAGE_URL, html: response } : response
    const careersHtml = employerPage?.html
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Verified Rain Instant Pay official careers page changed materially')
    }

    const verifiedPublicBoardUrl = extractVerifiedAshbyPublicBoardUrl(careersHtml)
    if (verifiedPublicBoardUrl !== ASHBY_PUBLIC_BOARD_URL) {
      throw new Error('Verified Ashby public board handoff changed materially')
    }

    const verifiedJobBoardUrl = buildAshbyJobBoardUrl(verifiedPublicBoardUrl)
    if (verifiedJobBoardUrl !== ASHBY_JOB_BOARD_URL) {
      throw new Error('Verified Ashby public board handoff changed materially')
    }

    let payload
    const indiaJobs = await createRuntimeVerifiedPublicAtsScraper({ ...PROVIDER_METADATA,
      boardToken: 'rain-technologies', runtimeInventoryVerification: {
        mode: 'board-handoff', boardUrl: ASHBY_PUBLIC_BOARD_URL,
      },
    }).run({ signal, fetchPage: async url => {
      if (url !== CAREERS_PAGE_URL) throw new Error('Unexpected Rain employer verification URL')
      return employerPage
    }, fetchJson: async (url, options) => {
      if (url !== ASHBY_JOB_BOARD_URL) throw new Error('Unexpected Rain native inventory URL')
      payload = await fetchJson(url, options)
      // Retain the source-specific error used by existing callers; malformed
      // envelopes, identities and geography are checked by the shared adapter.
      if (!Array.isArray(payload?.jobs)) throw new Error('Verified Ashby payload changed materially')
      return payload
    } })
    const evidence = readInventoryEvidence(indiaJobs)
    const globalJobs = extractAshbyJobs(payload), rawById = new Map(payload.jobs.map(row => [row.id, row]))
    const indiaById = new Map(indiaJobs.map(job => [job.jobId, job]))
    const expectedIds = new Set(payload.jobs.filter(row => row.isListed).map(row => row.id))
    const mappedIds = new Set(globalJobs.map(job => job.jobId))
    const mappingComplete = globalJobs.length === expectedIds.size && mappedIds.size === expectedIds.size
      && [...expectedIds].every(id => mappedIds.has(id))
    const limit = Number.isSafeInteger(maxJobs) && maxJobs >= 0 ? maxJobs : null
    const capped = limit != null && globalJobs.length > limit
    const prepared = globalJobs.map(job => {
      const native = rawById.get(job.jobId), india = indiaById.get(job.jobId)
      const description = hasSourceDescription({ sourceDescription: native.descriptionHtml })
        ? native.descriptionHtml : native.descriptionPlain
      return { ...job,
        ...(india ? { location: india.location, city: india.city, state: india.state, country: 'India' } : {}),
        jobDescription: normalizeWhitespace(description), sourceDescription: description || null,
        descriptionHtml: hasSourceDescription({ sourceDescription: native.descriptionHtml }) ? native.descriptionHtml : null,
        sourceDetailComplete: hasSourceDescription({ sourceDescription: description }),
        nativePrimaryLocation: native.location, nativeSecondaryLocations: native.secondaryLocations || [],
        source: SOURCE, link: job.applyUrl, scrapedAt: now(),
      }
    })
    const detailsComplete = prepared.every(job => job.sourceDetailComplete)
    const complete = evidence.listingComplete && mappingComplete && detailsComplete && !capped
    const selectedJobs = (limit == null ? prepared : prepared.slice(0, limit)).map(job => ({ ...job,
      sourceListingComplete: complete, lifecycleCleanupAllowed: complete,
    }))
    signal?.throwIfAborted()
    return attachInventoryEvidence(selectedJobs, { ...evidence, listingComplete: complete,
      status: complete ? evidence.status : 'coverage-gap', indiaFacetCount: complete ? evidence.indiaFacetCount : null,
      reason: [evidence.reason, ...(!mappingComplete ? ['rain-global-mapping-unreconciled'] : []),
        ...(!detailsComplete ? ['rain-global-role-detail-unavailable'] : []), ...(capped ? ['rain-output-capped'] : [])].filter(Boolean).join(';'),
    })
  },
})

export const run = async (options = {}) => createRainInstantPayScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
