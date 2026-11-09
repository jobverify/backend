import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runApiPortalScraper } from '../../scraper-support/apiPortal/engine.js'
import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

import MICRON_TECHNOLOGY_INDIA_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const DETAIL_API_PATTERN = /\/api\/pcsx\/position_details\b/i
const DETAIL_FETCH_CONCURRENCY = 6
const NATIVE_CAREERS_URL = 'https://careers.micron.com/careers'

export const SEARCH_PAGE_SIZE = 10
export const SEARCH_TIMEOUT_MS = 120000
export const API_CAREERS_LANDING_URL = 'https://careers.micron.com/careers?domain=micron.com&location=India'

export const PROVIDER_METADATA = MICRON_TECHNOLOGY_INDIA_CATALOG
export const SOURCE = MICRON_TECHNOLOGY_INDIA_CATALOG.source
export const COMPANY = MICRON_TECHNOLOGY_INDIA_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = MICRON_TECHNOLOGY_INDIA_CATALOG.officialBrandName
export const VERIFIED_ON = MICRON_TECHNOLOGY_INDIA_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = MICRON_TECHNOLOGY_INDIA_CATALOG.verifiedSurfaceSummary
export const HOMEPAGE_URL = MICRON_TECHNOLOGY_INDIA_CATALOG.homepageUrl
export const OFFICIAL_CAREERS_URL = MICRON_TECHNOLOGY_INDIA_CATALOG.companyCareerPage
export const PUBLIC_BOARD_URL = MICRON_TECHNOLOGY_INDIA_CATALOG.publicBoardUrl
export const LISTING_API_URL = MICRON_TECHNOLOGY_INDIA_CATALOG.listingApiUrl

const API_QUERY = MICRON_TECHNOLOGY_INDIA_CATALOG.apiQuery

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const parseJsonText = (rawText, url) => {
  try {
    return JSON.parse(String(rawText ?? '').trim())
  } catch (error) {
    throw new Error(`Micron JSON fetch returned invalid JSON for ${url}: ${error.message}`)
  }
}

const fetchMicronDetailJson = async (url, { signal } = {}) => parseJsonText(
  await fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json, text/plain, */*',
      Referer: API_CAREERS_LANDING_URL,
      Origin: 'https://careers.micron.com',
    },
    label: `${SOURCE}-detail-json`,
    signal,
    attempts: 1,
    timeoutMs: 20000,
  }),
  url,
)

const failMicronDetailPublicUrl = () => {
  throw Object.assign(new Error('Micron detail identity mismatch: publicUrl'), {
    incompleteScope: true, abortRetries: true,
  })
}

const readMicronDetailRequestId = (value) => {
  let request
  try { request = new URL(value) } catch { failMicronDetailPublicUrl() }
  const ids = request.searchParams.getAll('position_id')
  if (request.origin !== new URL(NATIVE_CAREERS_URL).origin
    || request.pathname !== '/api/pcsx/position_details'
    || request.username || request.password || request.hash
    || request.searchParams.size !== 3 || ids.length !== 1 || !/^[1-9]\d*$/.test(ids[0])
    || request.searchParams.getAll('domain').length !== 1 || request.searchParams.get('domain') !== API_QUERY.domain
    || request.searchParams.getAll('hl').length !== 1 || request.searchParams.get('hl') !== 'en') failMicronDetailPublicUrl()
  return ids[0]
}

// A successful native endpoint alone cannot qualify a description. The native
// public URL must independently bind the same request ID and position path;
// the existing Eightfold guard checks the exact listing identity and workplace.
const assertMicronDetailPublicUrl = (id, payload) => {
  const detail = payload?.data
  let publicUrl, positionUrl
  try {
    if (typeof detail?.publicUrl !== 'string' || typeof detail?.positionUrl !== 'string') failMicronDetailPublicUrl()
    publicUrl = new URL(detail.publicUrl)
    positionUrl = new URL(detail.positionUrl, NATIVE_CAREERS_URL)
  } catch { failMicronDetailPublicUrl() }
  const expected = new URL(NATIVE_CAREERS_URL).origin + '/careers/job/' + id
  if (publicUrl.protocol !== 'https:' || publicUrl.username || publicUrl.password
    || publicUrl.href !== expected || positionUrl.href !== expected) failMicronDetailPublicUrl()
}

const normalizeMicronExperienceRequired = (jobDescription) => {
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

const normalizeMicronPostingDate = (value) => {
  const numeric = Number(value)
  if (Number.isFinite(numeric) && numeric >= 1000000000 && numeric < 10000000000) {
    return new Date(numeric * 1000).toISOString()
  }

  return value ?? null
}

const decorateMicronJob = (job = {}) => {
  const normalizedDescription = normalizeWhitespace(job.jobDescription)

  return {
    ...job,
    experienceRequired:
      normalizeMicronExperienceRequired(job.jobDescription)
      || job.experienceRequired
      || null,
    postingDate: normalizeMicronPostingDate(job.postingDate),
    publicExperienceChecked: Boolean(normalizedDescription),
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

export const buildListingApiUrl = ({
  start = 0,
  limit = SEARCH_PAGE_SIZE,
} = {}) => {
  const url = new URL(LISTING_API_URL)
  url.searchParams.set('domain', API_QUERY.domain)
  url.searchParams.set('query', API_QUERY.query)
  url.searchParams.set('location', API_QUERY.location)
  url.searchParams.set('start', String(start))
  url.searchParams.set('limit', String(limit))
  return url.toString()
}

export const buildDetailApiUrl = (jobId) =>
  `https://careers.micron.com/api/pcsx/position_details?position_id=${jobId}&domain=micron.com&hl=en`

export const isIndiaLocation = (value = '') => /india/i.test(String(value ?? ''))

export const hasOfficialMicronIndiaCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page).toLowerCase()

  return (
    /<title>\s*Careers\s*\|\s*Micron(?:\s+India|\s+Technology Inc\.)\s*<\/title>/i.test(page)
    && text.includes('micron')
    && text.includes('search current jobs')
    && text.includes('hyderabad')
    && text.includes('india')
    && page.includes(PUBLIC_BOARD_URL)
  )
}

// A caller or engine request signal remains authoritative even if a supplied
// reader ignores it. This adds no timer or retry, and never inspects its reason.
const withMicronSignal = async (signal, operation) => {
  signal?.throwIfAborted()
  if (!signal) return operation()
  let onAbort
  const aborted = new Promise((resolve, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    const value = await Promise.race([
      Promise.resolve().then(() => { signal.throwIfAborted(); return operation() }),
      aborted,
    ])
    signal.throwIfAborted()
    return value
  } catch (error) {
    signal.throwIfAborted()
    throw error
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

const isTargetClosedError = (error) =>
  /Target closed/i.test(String(error?.message || error))

const closeBrowserSession = async (browserSession) => {
  try {
    await browserSession.close()
  } catch (error) {
    if (!isTargetClosedError(error)) {
      throw error
    }
  }
}

const isRetriableBrowserFetchError = (error) =>
  /ERR_ABORTED|Access denied|Target closed|Execution context was destroyed|Protocol error/i
    .test(String(error?.message || error))

const parseBrowserJsonText = (rawText, url) => {
  try {
    return JSON.parse(String(rawText ?? '').trim())
  } catch (error) {
    throw new Error(`Micron browser fetch returned invalid JSON for ${url}: ${error.message}`)
  }
}

const createMicronBrowserJsonFetcher = async ({
  createBrowserFetchSessionImpl = createBrowserFetchSession,
  signal,
} = {}) => {
  let browserSession = null

  const ensureSession = async (requestSignal) => {
    if (!browserSession) {
      const created = await createBrowserFetchSessionImpl({
        userAgent: USER_AGENT,
        timeoutMs: SEARCH_TIMEOUT_MS,
        signal,
      })
      if (requestSignal?.aborted) {
        try { await closeBrowserSession(created) } finally { requestSignal.throwIfAborted() }
      }
      browserSession = created
    }

    return browserSession
  }

  const resetSession = async () => {
    if (browserSession) {
      await closeBrowserSession(browserSession)
      browserSession = null
    }
  }

  return {
    fetchJson: async (url, options = {}) => {
      const requestSignal = options.signal || signal
      let lastError = null

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        requestSignal?.throwIfAborted()
        const activeSession = await ensureSession(requestSignal)
        requestSignal?.throwIfAborted()

        try {
          const rawText = await activeSession.fetchText(url, {
            referer: API_CAREERS_LANDING_URL,
            signal: requestSignal,
          })
          requestSignal?.throwIfAborted()
          return parseBrowserJsonText(rawText, url)
        } catch (error) {
          requestSignal?.throwIfAborted()
          lastError = error
          await resetSession()
          requestSignal?.throwIfAborted()

          if (!isRetriableBrowserFetchError(error) || attempt === 2) {
            throw error
          }
        }
      }

      throw lastError
    },
    close: resetSession,
  }
}

export const buildMicronTechnologyIndiaApiProvider = () => ({
  source: SOURCE,
  atsPlatform: MICRON_TECHNOLOGY_INDIA_CATALOG.atsPlatform,
  companyName: COMPANY,
  companyCareerPage: NATIVE_CAREERS_URL,
  countryFilter: 'India',
  config: {
    discovery: {
      listingApiUrl: LISTING_API_URL,
    },
    request: {
      method: 'GET',
      query: API_QUERY,
    },
    // Share paced starts and native 429 cooldowns across listing/detail workers.
    // Keep requests concurrent in flight and reuse the portal's bounded retries.
    rateLimit: {
      minimumIntervalMs: 250,
      maxRetries: 2,
      baseDelayMs: 1000,
      maxDelayMs: 5000,
    },
    pagination: {
      strategy: 'offset-limit',
      pageSize: SEARCH_PAGE_SIZE,
      offsetParam: 'start',
      limitParam: 'limit',
      resultsPath: 'data.positions',
      totalCountPath: 'data.count',
    },
    mapping: {
      title: 'name',
      location: { strategy: 'eightfold-location' },
      country: { strategy: 'eightfold-country' },
      jobId: 'id',
      requisitionId: 'displayJobId',
      sourceUrl: {
        strategy: 'template',
        template: 'https://careers.micron.com{{positionUrl}}',
        values: {
          positionUrl: 'positionUrl',
        },
      },
      applyUrl: {
        strategy: 'template',
        template: 'https://careers.micron.com{{positionUrl}}',
        values: {
          positionUrl: 'positionUrl',
        },
      },
      department: 'department',
      postingDate: 'postedTs',
    },
    detail: {
      enabled: true,
      requireListingIdentity: true,
      concurrency: DETAIL_FETCH_CONCURRENCY,
      urlTemplate: buildDetailApiUrl('{{jobId}}'),
      method: 'GET',
      mapping: {
        jobDescription: 'data.jobDescription',
      },
    },
    resultFilter: {
      include: [
        {
          field: 'country',
          pattern: '^India$',
        },
      ],
      exclude: [],
    },
  },
})

export const createMicronTechnologyIndiaScraper = ({
  createBrowserFetchSessionImpl = createBrowserFetchSession,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson,
    signal,
  } = {}) {
    const careersHtml = await withMicronSignal(signal, () => fetchText(OFFICIAL_CAREERS_URL, { signal }))

    if (!hasOfficialMicronIndiaCareersSignal(careersHtml)) {
      throw new Error('The verified Micron India careers page no longer matches the public jobs handoff')
    }

    let browserFetcher = null
    const traversalController = new AbortController()
    const traversalSignal = signal
      ? AbortSignal.any([signal, traversalController.signal])
      : traversalController.signal

    try {
      const liveFetchJson = fetchJson || await (async () => {
        browserFetcher = await createMicronBrowserJsonFetcher({
          createBrowserFetchSessionImpl,
          signal,
        })

        return async (url, options) => {
          if (DETAIL_API_PATTERN.test(url)) {
            return fetchMicronDetailJson(url, options)
          }

          return browserFetcher.fetchJson(url, options)
        }
      })()

      const jobs = await runApiPortalScraper({
        provider: buildMicronTechnologyIndiaApiProvider(),
        signal: traversalSignal,
        fetchJson: async (url, options = {}) => withMicronSignal(options.signal || traversalSignal, async () => {
          const detailId = DETAIL_API_PATTERN.test(url) ? readMicronDetailRequestId(url) : null
          const payload = await liveFetchJson(url, options)
          if (detailId) assertMicronDetailPublicUrl(detailId, payload)
          return payload
        }),
      })

      return mapJobsWithInventoryEvidence(jobs, decorateMicronJob)
    } catch (error) {
      // A terminal native identity failure must also stop paced peer requests
      // before this source releases its owned browser session.
      traversalController.abort(error)
      throw error
    } finally {
      try {
        if (browserFetcher) {
          // Start cleanup once and observe it even when caller settlement wins.
          const closing = Promise.resolve().then(() => browserFetcher.close())
          closing.catch(() => {})
          await withMicronSignal(signal, () => closing)
        }
      } finally {
        signal?.throwIfAborted()
      }
    }
  },
})

export const run = async (options = {}) => createMicronTechnologyIndiaScraper().run(options)

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
