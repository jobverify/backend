import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { hydrateSourceDescriptions } from '../../scraper-support/utils/sourceDescriptionHydration.js'
import { createDarwinboxScraper } from '../darwinbox/script.js'
import SCRIPBOX_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SCRIPBOX_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const PUBLIC_BOARD_URL = PROVIDER_METADATA.publicBoardUrl
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

const extractNextDataPayload = (html = '') => {
  const match = String(html ?? '').match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  )

  if (!match) return null

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

const normalizeDarwinboxJobUrl = (value) => {
  if (!value) return null

  try {
    const url = new URL(value, CAREERS_URL)
    const normalizedHost = url.hostname.replace(/^www\./i, '').toLowerCase()
    const normalizedPath = url.pathname.replace(/\/+$/, '')

    if (normalizedHost !== 'scripbox.darwinbox.in') return null
    if (
      !normalizedPath.startsWith('/ms/candidate/careers/')
      && !normalizedPath.startsWith('/ms/candidatev2/main/careers/jobDetails/')
    ) {
      return null
    }

    return `https://scripbox.darwinbox.in${normalizedPath}${url.search}`
  } catch {
    return null
  }
}

const firstValue = (value) => Array.isArray(value) ? value[0] : value

const buildLocation = (opening = {}) => {
  const city = normalizeWhitespace(firstValue(opening.location_city) || firstValue(opening.location))
  const country = normalizeWhitespace(opening.location_country)

  if (city && country) return `${city}, ${country}`
  if (city && /india/i.test(city)) return city
  if (city) return `${city}, India`

  return normalizeWhitespace(opening.location)
}

const buildExperienceRequired = (opening = {}) => {
  const from = Number.parseInt(opening.experience_from, 10)
  const to = Number.parseInt(opening.experience_to, 10)

  if (Number.isFinite(from) && Number.isFinite(to)) return `${from}-${to} years`
  if (Number.isFinite(from)) return `${from}+ years`
  if (Number.isFinite(to)) return `0-${to} years`
  return null
}

const isIndiaOpening = (opening = {}) => {
  const country = normalizeWhitespace(opening.location_country)
  if (country?.toLowerCase() === 'india') return true

  const location = normalizeWhitespace(firstValue(opening.location))
  return /(?:^|,\s*)india(?:$|[\s,)(-])/i.test(location || '')
}

const isPublicCareerOpening = (opening = {}) => Number(opening.post_on_careers_page) === 1

export const extractEmbeddedJobOpenings = (html = '') => {
  const payload = extractNextDataPayload(html)
  const openings = payload?.props?.pageProps?.jobOpenings

  if (!Array.isArray(openings)) {
    throw new Error('Scripbox verified careers page no longer exposes the expected jobOpenings payload')
  }

  return openings
}

const extractDarwinboxJobLinks = (html = '') => {
  const byTitle = new Map()
  const byId = new Map()
  const anchorPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi

  for (const match of String(html ?? '').matchAll(anchorPattern)) {
    const url = normalizeDarwinboxJobUrl(match[1])
    const title = normalizeWhitespace(match[2])
    const jobId = normalizeWhitespace(url?.match(/\/(?:jobDetails|careers)\/([^/?#]+)/i)?.[1])

    if (!url || !title) continue
    if (!byTitle.has(title)) byTitle.set(title, url)
    if (jobId && !byId.has(jobId)) byId.set(jobId, url)
  }

  return { byTitle, byId }
}

const hasCanonicalCareersUrl = (html = '') =>
  /<link\b(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']https:\/\/scripbox\.com\/pages\/careers["'])[^>]*>/i
    .test(String(html ?? ''))

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  try {
    const openings = extractEmbeddedJobOpenings(page)
    const publicIndiaOpenings = openings.filter(
      (opening) => isPublicCareerOpening(opening) && isIndiaOpening(opening),
    )
    const detailLinks = extractDarwinboxJobLinks(page)
    const allOpeningsHaveMatchedDetailLinks = publicIndiaOpenings.every((opening) => {
      const title = normalizeWhitespace(opening.job_title)
      const jobId = normalizeWhitespace(opening.job_id)

      if (!title || !jobId) return false

      return Boolean(detailLinks.byId.get(jobId) || detailLinks.byTitle.get(title))
    })

    return /<title>\s*Careers\s*\|\s*Scripbox\s*<\/title>/i.test(page)
      && hasCanonicalCareersUrl(page)
      && page.includes('__NEXT_DATA__')
      && text.includes('Join us in helping make every Indian financially secure')
      && text.includes('Job Openings')
      && text.includes('Get In Touch')
      && publicIndiaOpenings.length >= 3
      && allOpeningsHaveMatchedDetailLinks
  } catch {
    return false
  }
}

export const extractIndiaJobsFromCareersPage = (
  html,
  { scrapedAt = new Date().toISOString() } = {},
) => {
  const openings = extractEmbeddedJobOpenings(html)
  const detailLinks = extractDarwinboxJobLinks(html)

  const jobs = openings
    .filter((opening) => isPublicCareerOpening(opening) && isIndiaOpening(opening))
    .map((opening) => {
      const title = normalizeWhitespace(opening.job_title)
      const jobId = normalizeWhitespace(opening.job_id)
      const link = detailLinks.byId.get(jobId) || detailLinks.byTitle.get(title)
      const location = buildLocation(opening)
      const country = normalizeWhitespace(opening.location_country) || 'India'
      const city = normalizeCity(normalizeWhitespace(firstValue(opening.location_city) || firstValue(opening.location)))

      if (!title || !link || !location || !jobId) {
        throw new Error('Scripbox public Darwinbox detail links no longer match the verified handoff')
      }

      return {
        title,
        company: COMPANY,
        location,
        city,
        country,
        employmentType: normalizeWhitespace(opening.employee_type),
        experienceRequired: buildExperienceRequired(opening),
        jobId,
        requisitionId: jobId,
        sourceUrl: link,
        applyUrl: link,
        link,
        source: SOURCE,
        scrapedAt,
      }
    })

  if (!jobs.length) {
    throw new Error('Scripbox verified first-party careers page no longer exposes the expected India openings')
  }

  return jobs
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'scripbox-html',
  timeoutMs: 15000,
  signal,
})

export const createScripboxScraper = () => {
  const native = createDarwinboxScraper({ source: SOURCE, companyName: COMPANY, origin: 'https://scripbox.darwinbox.in' })
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
        throw new Error('Scripbox verified first-party careers page no longer matches the trusted public jobs surface')
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

export const run = async (options = {}) => createScripboxScraper(options).run(options)

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
