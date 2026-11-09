import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { runApiPortalScraper } from '../../scraper-support/apiPortal/engine.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'groupm'
export const COMPANY = 'GroupM'
export const CAREERS_URL = 'https://www.wppmedia.com/careers'
export const APAC_JOBS_BOARD_URL = 'https://job-boards.greenhouse.io/wppmedia?offices%5B%5D=4046626008'
export const GREENHOUSE_JOBS_API_URL = 'https://boards-api.greenhouse.io/v1/boards/wppmedia/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '').replace(/<[^>]+>/g, ' '),
)

const normalizeUrl = (value) => {
  try {
    return new URL(value).toString()
  } catch {
    return null
  }
}

export const hasOfficialCareersSignal = (html) => {
  const page = normalizeWhitespace(html) || ''

  return page.includes("Let's build the future together")
    && /WPP Media/i.test(page)
    && /We only hire through our careers site and @wppmedia\.com or @wpp\.com emails/i.test(page)
    && /\bAPAC\b/i.test(page)
}

export const extractVerifiedJobsBoardUrl = (html) => {
  for (const match of String(html ?? '').matchAll(
    /<a\b[^>]+href=(['"])([^'"]*job-boards\.greenhouse\.io\/wppmedia[^'"]*)\1[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const label = stripTags(match[3])
    if (!/^APAC(?:\s+Open\s+Roles)?$/i.test(label || '')) continue

    const resolved = normalizeUrl(match[2])
    if (resolved) return resolved
  }

  return null
}

const createApiProvider = () => ({
  source: SOURCE,
  companyName: COMPANY,
  companyCareerPage: CAREERS_URL,
  countryFilter: 'India',
  config: {
    request: {
      method: 'GET',
      query: {
        content: 'true',
      },
    },
    pagination: {
      strategy: 'single-page',
      resultsPath: 'jobs',
      totalCountPath: 'meta.total',
    },
    mapping: {
      title: 'title',
      location: 'location.name',
      jobId: 'id',
      requisitionId: 'requisition_id',
      applyUrl: 'absolute_url',
      department: 'departments.0.name',
      jobDescription: 'content',
      postingDate: 'first_published',
    },
    resultFilter: {
      include: [
        {
          field: 'location',
          pattern: 'india',
        },
      ],
    },
    discovery: {
      listingApiUrl: GREENHOUSE_JOBS_API_URL,
    },
  },
})

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createGroupMScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('GroupM official careers surface changed and no longer matches the verified WPP Media page')
    }

    const boardUrl = extractVerifiedJobsBoardUrl(careersHtml)
    if (boardUrl !== APAC_JOBS_BOARD_URL) {
      throw new Error('GroupM verified APAC jobs handoff changed on the official WPP Media careers page')
    }

    const jobs = await runApiPortalScraper({
      provider: createApiProvider(),
      fetchJson,
    })

    const selected = Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
    const evidence = readInventoryEvidence(jobs)
    // The observed APAC handoff establishes this WPP Media board, but cannot
    // establish that it covers every GroupM recruiting channel. Preserve that
    // scope limit even when the documented board count reconciles.
    for (const job of selected) Object.assign(job, {
      sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    })
    return attachInventoryEvidence(selected, { ...evidence, status: 'discovery-only', listingComplete: false,
      reason: `whole-groupm-scope-unverified;${evidence.reason}${selected.length !== jobs.length ? ';source-job-limit' : ''}` })
  },
})

export const run = async (options = {}) => createGroupMScraper(options).run(options)

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
