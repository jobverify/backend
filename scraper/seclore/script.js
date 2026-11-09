import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { hydrateSourceDescriptions } from '../../scraper-support/utils/sourceDescriptionHydration.js'
import { createDarwinboxScraper } from '../darwinbox/script.js'
import SECLORE_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SECLORE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const PUBLIC_JOB_HOST = PROVIDER_METADATA.publicJobHost
export const VERIFIED_SAMPLE_JOB_URL = PROVIDER_METADATA.verifiedSampleJobUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeDarwinboxJobUrl = (value) => {
  if (!value) return null

  try {
    const url = new URL(value, CAREERS_URL)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPath = url.pathname.replace(/\/+$/, '')

    if (normalizedHost !== 'seclore.darwinbox.in') return null
    if (!normalizedPath.startsWith('/ms/candidatev2/main/careers/jobDetails/')) return null

    return `https://seclore.darwinbox.in${normalizedPath}`
  } catch {
    return null
  }
}

const parseInlineOpening = (text) => {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return null

  const match = normalized.match(
    /^(.*?)\s+Employee Type:\s*(.*?)\s+Department:\s*(.*?)\s+Location:\s*(.*?)$/i,
  )

  if (!match) return null

  return {
    title: normalizeWhitespace(match[1]),
    employmentType: normalizeWhitespace(match[2]),
    department: normalizeWhitespace(match[3]),
    location: normalizeWhitespace(match[4]),
  }
}

const extractJobIdFromUrl = (url) => {
  try {
    return new URL(url).pathname.split('/').filter(Boolean).pop() ?? null
  } catch {
    return null
  }
}

export const extractIndiaJobsFromCareersPage = (
  html,
  { scrapedAt = new Date().toISOString() } = {},
) => {
  const page = String(html ?? '')
  const anchorPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi

  const jobs = []

  for (const match of page.matchAll(anchorPattern)) {
    const link = normalizeDarwinboxJobUrl(match[1])
    const opening = parseInlineOpening(match[2])

    if (opening && /india/i.test(opening.location || '') && !link) {
      throw new Error('Seclore public Darwinbox links no longer match the verified careers contract')
    }

    if (!link || !opening) continue
    if (!/india/i.test(opening.location || '')) continue

    const jobId = extractJobIdFromUrl(link)
    if (!jobId || !opening.title) {
      throw new Error('Seclore public Darwinbox links no longer match the verified careers contract')
    }

    jobs.push({
      title: opening.title,
      company: COMPANY,
      location: 'India',
      city: null,
      country: 'India',
      employmentType: opening.employmentType,
      department: opening.department,
      jobId,
      requisitionId: jobId,
      sourceUrl: link,
      applyUrl: link,
      link,
      source: SOURCE,
      scrapedAt,
    })
  }

  if (!jobs.length) {
    throw new Error('Seclore public Darwinbox links no longer match the verified careers contract')
  }

  return jobs
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  try {
    let indiaOpeningCount = 0

    for (const match of page.matchAll(/<a[^>]+href=["'][^"']+["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const opening = parseInlineOpening(match[1])
      if (opening && /india/i.test(opening.location || '')) {
        indiaOpeningCount += 1
      }
    }

    return /<title>\s*Seclore\s*\|\s*Careers\s*<\/title>/i.test(page)
      && text.includes('Drive Innovation. Embrace Collaboration. Discover Horizons.')
      && text.includes('Join us to redefine how the world protects data.')
      && text.includes('Open Positions')
      && indiaOpeningCount > 0
  } catch {
    return false
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'seclore-html',
  timeoutMs: 15000,
  signal,
})

export const createSecloreScraper = () => {
  const native = createDarwinboxScraper({ source: SOURCE, companyName: COMPANY, origin: 'https://seclore.darwinbox.in' })
  return {
    async run({
      fetchText = defaultFetchText,
      fetchJobDetail = native.fetchJobDetailFromApi,
      detailEnrichmentBudgetMs,
      signal,
      now = () => new Date().toISOString(),
    } = {}) {
      signal?.throwIfAborted()
      const careersHtml = await fetchText(CAREERS_URL, { signal })
      signal?.throwIfAborted()

      if (!hasVerifiedCareersPageSignal(careersHtml)) {
        throw new Error('Seclore verified first-party careers page no longer matches the trusted public jobs surface')
      }

      const jobs = extractIndiaJobsFromCareersPage(careersHtml, {
        scrapedAt: now(),
      })
      const detailFacts = new Map()
      const hydrated = await hydrateSourceDescriptions(jobs.map(job => ({ ...job, sourceListingComplete: false })), {
        signal, detailEnrichmentBudgetMs,
        fetchDetail: async (job, { signal: detailSignal }) => {
          const payload = await fetchJobDetail({ jobId: job.jobId, companyId: 'main', signal: detailSignal })
          detailSignal.throwIfAborted()
          detailFacts.set(job.jobId, native.extractJobDetailFacts(payload, job))
          return { sourceDescription: native.validateJobDetail(payload, job) }
        },
      })
      return hydrated.map(job => ({ ...job, ...detailFacts.get(job.jobId) }))
    },
  }
}

export const run = async (options = {}) => createSecloreScraper(options).run(options)

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
