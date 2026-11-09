import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { composeAbortSignals } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY_NAME = 'dhiOmics'
export const SOURCE = 'dhiomics'
export const DARWINBOX_COMPANY_ID = 'main'
export const DARWINBOX_ORIGIN = 'https://adaglobal.darwinbox.com'
export const OFFICIAL_HOMEPAGE_URL = 'https://dhiomics.com'
export const VERIFIED_REDIRECT_URL = 'https://adaglobal.com/'
export const OFFICIAL_CAREERS_URL = 'https://adaglobal.com/careers/'
export const PUBLIC_JOBS_URL =
  `${DARWINBOX_ORIGIN}/ms/candidatev2/${DARWINBOX_COMPANY_ID}/careers/allJobs`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PUBLIC_LISTING_API_URL = `${DARWINBOX_ORIGIN}/ms/candidateapi/job/alljobs`
const fetchPublishedDarwinbox = (url, options) => {
  const isListing = url === PUBLIC_LISTING_API_URL + '?companyId=main'
  return fetch(isListing ? PUBLIC_LISTING_API_URL : url, isListing ? {
    ...options,
    headers: { ...options?.headers, 'Accept-Language': 'en' },
  } : options)
}

const darwinboxScraper = createDarwinboxScraper({
  companyName: COMPANY_NAME,
  source: SOURCE,
  companyId: DARWINBOX_COMPANY_ID,
  origin: DARWINBOX_ORIGIN,
  fetchImpl: fetchPublishedDarwinbox,
})

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html = '') => {
  const match = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

export const hasVerifiedDhiOmicsHomepageRedirect = ({
  status,
  url,
  html,
} = {}) => {
  const text = normalizeWhitespace(html) || ''

  return status === 200
    && url === VERIFIED_REDIRECT_URL
    && extractTitle(html) === 'ADA Global | The Data & AI Experience Company'
    && text.includes('The Data & AI Experience Company')
    && /https:\/\/adaglobal\.com\/careers\//i.test(String(html ?? ''))
}

export const extractPublicJobsUrl = (html = '') => {
  const match = String(html).match(
    /https:\/\/adaglobal\.darwinbox\.com\/ms\/candidatev2\/main\/careers\/allJobs/i,
  )

  return normalizeWhitespace(match?.[0])
}

export const hasVerifiedAdaCareersSignals = (html = '') => {
  const text = normalizeWhitespace(html) || ''

  return extractTitle(html) === 'Careers | Build What the Next Era Runs On | ADA Global'
    && text.includes('Build what the next era runs on')
    && text.includes('Discover career opportunities at ADA Global')
    && extractPublicJobsUrl(html) === PUBLIC_JOBS_URL
}


const nativeDate = (value) => {
  if (value == null || value === '') return null
  const milliseconds = typeof value === 'number' || /^\d+(?:\.\d+)?$/.test(String(value))
    ? Number(value) * (Number(value) < 1e12 ? 1000 : 1)
    : Date.parse(String(value))
  if (!Number.isFinite(milliseconds)) throw new Error('Published careers lifecycle date is invalid')
  return new Date(milliseconds).toISOString()
}

const activeNativeDates = (row, nowMs) => {
  const careers = row.job_posting?.careers
  if (careers !== undefined && (!careers || careers.source !== 'careers' || careers.from == null)) return null
  const postingDate = nativeDate(careers?.from ?? row.posted_on)
  const closingDate = nativeDate(careers?.to)
  if ((postingDate && Date.parse(postingDate) > nowMs)
    || (closingDate && Date.parse(closingDate) <= nowMs)) return null
  return { postingDate, closingDate }
}

const descriptionText = (value) => String(value || '')
  .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()

const defaultFetchPage = async (url, { signal } = {}) => {
  signal?.throwIfAborted()
  const response = await fetch(url, {
    redirect: 'follow',
    signal: composeAbortSignals(signal, AbortSignal.timeout(30000)),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createDhiOmicsScraper = ({
  maxJobs: configuredMaxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  ...darwinboxScraper,
  buildListingApiUrl: () => PUBLIC_LISTING_API_URL,
  async run({
    maxPages = config.maxPages,
    maxJobs = configuredMaxJobs,
    fetchPage = defaultFetchPage,
    fetchListingPage = darwinboxScraper.fetchListingPageFromApi,
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const homepage = await fetchPage(OFFICIAL_HOMEPAGE_URL, { signal })
    signal?.throwIfAborted()

    if (!hasVerifiedDhiOmicsHomepageRedirect(homepage)) {
      throw new Error('dhiOmics verified official homepage redirect no longer matches the ADA Global handoff')
    }

    signal?.throwIfAborted()
    const careersPage = await fetchPage(OFFICIAL_CAREERS_URL, { signal })
    signal?.throwIfAborted()

    if (
      careersPage.status !== 200
      || careersPage.url !== OFFICIAL_CAREERS_URL
      || !hasVerifiedAdaCareersSignals(careersPage.html)
    ) {
      throw new Error('dhiOmics verified official careers page no longer matches the verified ADA Global public jobs surface')
    }

    const scrapedAt = now()
    let pagesFetched = 2
    let reportedTotal = null
    const verifiedIndiaIds = new Set()
    const rawIds = new Set()
    const datesById = new Map()
    const jobs = await darwinboxScraper.run({
      maxPages,
      maxJobs,
      signal,
      fetchListingPage: async (request) => {
        const payload = await fetchListingPage(request)
        pagesFetched++
        reportedTotal = payload?.job_counts == null ? null : Number(payload.job_counts)
        for (const row of Array.isArray(payload?.data) ? payload.data : []) {
          const id = String(row?.id || '').trim()
          if (rawIds.has(id)) throw new Error('dhiOmics published listing has a duplicate raw ID')
          rawIds.add(id)
          if (String(row.country || '').trim().toLowerCase() !== 'india'
            || !/\bIndia\s*$/i.test(String(row.locations || '').trim())) continue
          const dates = activeNativeDates(row, Date.parse(scrapedAt))
          if (!dates) continue
          if (descriptionText(row.jd).length < 100) {
            throw new Error('dhiOmics published India job description is incomplete')
          }
          verifiedIndiaIds.add(id)
          datesById.set(id, dates)
        }
        return payload
      },
    })

    return attachInventoryEvidence(jobs.filter((job) => verifiedIndiaIds.has(String(job.jobId))).map((job) => ({
      ...job,
      country: 'India',
      ...datesById.get(String(job.jobId)),
      sourceListingComplete: false,
      scrapedAt,
    })), {
      status: 'coverage-gap', surface: PUBLIC_JOBS_URL, firstParty: true,
      listingComplete: false, pagesFetched, reportedTotal, indiaFacetCount: null,
      verifiedAt: scrapedAt,
      reason: 'Verified explicit India roles with full published descriptions. Generic Darwinbox pagination and per-role application completeness do not establish authoritative source coverage.',
    })
  },
})

export const run = async (options = {}) => createDhiOmicsScraper().run(options)

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
