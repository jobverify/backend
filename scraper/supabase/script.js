import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { extractAshbyExperienceRequired } from '../../scraper-support/utils/ashbyExperience.js'
import { createPublishingGapAtsScraper } from '../../scraper-support/utils/publishingGapAts.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = 'supabase'
export const COMPANY = 'Supabase'
export const VERIFIED_ON = '2026-08-13'
export const CAREERS_PAGE_URL = 'https://supabase.com/careers'
export const ASHBY_PUBLIC_BOARD_URL = 'https://jobs.ashbyhq.com/supabase'
export const ASHBY_JOB_BOARD_URL = 'https://api.ashbyhq.com/posting-api/job-board/supabase'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
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

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const getAddress = (location = {}) => location?.address?.postalAddress || location?.address || {}

const toLocationCandidate = (location = {}) => {
  const address = getAddress(location)
  const label = normalizeWhitespace(location?.location)
  const city = normalizeWhitespace(address?.addressLocality)
  const state = normalizeWhitespace(address?.addressRegion)
  const country = normalizeWhitespace(address?.addressCountry)

  return {
    location: label || [city, state, country].filter(Boolean).join(', '),
    city,
    state,
    country,
  }
}

const hasExplicitIndiaSignal = (candidate = {}) => {
  const location = normalizeWhitespace(candidate.location) || ''
  const country = normalizeWhitespace(candidate.country) || ''
  const city = normalizeWhitespace(candidate.city) || ''
  const state = normalizeWhitespace(candidate.state) || ''

  return /india/i.test([location, country, city, state].join(' '))
}

const selectIndiaLocation = (job = {}) => {
  const candidates = [
    toLocationCandidate({ location: job.location, address: job.address }),
    ...(Array.isArray(job.secondaryLocations) ? job.secondaryLocations : []).map(toLocationCandidate),
  ].filter((candidate) => candidate.location)

  return filterIndiaJobs(candidates).find(hasExplicitIndiaSignal) || null
}

const inferRemoteStatus = (job = {}) => {
  if (job?.isRemote === true || /remote/i.test(String(job?.workplaceType ?? ''))) return 'Remote'
  if (/hybrid/i.test(String(job?.workplaceType ?? ''))) return 'Hybrid'
  if (job?.workplaceType) return 'On-site'
  return null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return ['Supabase Careers', 'Careers | Supabase'].includes(extractTitle(rawHtml))
    && normalized.includes("We're on a mission to build the best developer platform")
    && normalized.includes('Explore remote opportunities and join our team to help us achieve it.')
    && normalized.includes('Open positions')
    && normalized.includes('Apply for position')
}

export const extractVerifiedAshbyPublicBoardUrl = (html = '') =>
  /https:\/\/jobs\.ashbyhq\.com\/supabase\b/i.test(String(html ?? ''))
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
      const selectedLocation = selectIndiaLocation(job)

      if (!title || !jobId || !sourceUrl || !applyUrl || !selectedLocation) return null

      return {
        title,
        company: COMPANY,
        department: normalizeWhitespace(job?.department),
        location: selectedLocation.location,
        city: selectedLocation.city,
        state: selectedLocation.state,
        country: selectedLocation.country,
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

export const createSupabaseScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => {
  if (maxJobs !== null && (!Number.isSafeInteger(maxJobs) || maxJobs < 0)) {
    throw new Error('Invalid Supabase output limit')
  }
  return {
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    signal,
    onAudit,
  } = {}) {
    signal?.throwIfAborted()
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    signal?.throwIfAborted()
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Verified Supabase official careers page changed materially')
    }

    const verifiedPublicBoardUrl = extractVerifiedAshbyPublicBoardUrl(careersHtml)
    if (verifiedPublicBoardUrl !== ASHBY_PUBLIC_BOARD_URL) {
      throw new Error('Verified Ashby public board handoff changed materially')
    }

    const verifiedJobBoardUrl = buildAshbyJobBoardUrl(verifiedPublicBoardUrl)
    if (verifiedJobBoardUrl !== ASHBY_JOB_BOARD_URL) {
      throw new Error('Verified Ashby public board handoff changed materially')
    }

    const payload = await fetchJson(ASHBY_JOB_BOARD_URL)
    signal?.throwIfAborted()
    if (!Array.isArray(payload?.jobs)) {
      throw new Error('Verified Ashby payload changed materially')
    }

    // The complete original response reaches the existing strongest native
    // schema, identity and location checks before any India or output slice.
    const nativeJobs = await createPublishingGapAtsScraper({
      source: SOURCE, companyName: COMPANY, atsPlatform: 'ashby', boardToken: 'supabase',
      companyCareerPage: CAREERS_PAGE_URL, sourceScopeComplete: false,
      lifecycleCleanupAllowed: false,
    }).run({ signal, fetchJson: async (url) => {
      if (url !== ASHBY_JOB_BOARD_URL) throw new Error('Unexpected Supabase native endpoint')
      return payload
    } })
    signal?.throwIfAborted()
    const strongestEngineEvidence = readInventoryEvidence(nativeJobs)
    const nativeById = new Map(payload.jobs.map((record) => [String(record.id), record]))
    const selectedJobs = maxJobs === null ? nativeJobs : nativeJobs.slice(0, maxJobs)
    const jobs = selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
      sourceNativeRecord: structuredClone(nativeById.get(String(job.jobId))),
      sourceScopeComplete: false,
      lifecycleCleanupAllowed: false,
    }))
    const audit = {
      source: SOURCE, observedNativeBoardCount: payload.jobs.length,
      originalNativePayload: structuredClone(payload), nativeRecords: structuredClone(payload.jobs),
      strongestEngineEvidence, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
      authoritativeSourceTotal: null, authoritativeIndiaFacetCount: null,
      outputLimitApplied: selectedJobs.length < nativeJobs.length,
      currentLiveQualification: false, noClosingCaptureClaimed: true,
      missingProofs: ['current corporate activation and all recruiting channels',
        'native country alternatives and complete detail scope', 'fresh global opening/closing inventory'],
    }
    Object.defineProperty(jobs, 'sourceAudit', { value: audit })
    onAudit?.(structuredClone(audit))
    signal?.throwIfAborted()
    return attachInventoryEvidence(jobs, {
      ...strongestEngineEvidence, status: 'discovery-only', listingComplete: false,
      reportedTotal: null, indiaFacetCount: null,
      reason: 'supabase-source-scope-unresolved:' + strongestEngineEvidence.reason
        + (audit.outputLimitApplied ? ';source-output-limit-applied' : ''),
    })
  },
  }
}

export const run = async (options = {}) => createSupabaseScraper(options).run(options)

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
