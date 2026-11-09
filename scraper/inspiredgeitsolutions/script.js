import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createBrowserNetworkFallback,
  defaultShouldUseBrowserNetworkFallback,
} from '../../scraper-support/shared/browserNetworkFallback.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { enrichJobsWithPublicExperience } from '../../scraper-support/utils/publicExperienceEnrichment.js'

import { INSPIREDGE_IT_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = INSPIREDGE_IT_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')

const normalizeWhitespace = (value) => decodeHtml(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeOptionalValue = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const INSPIREDGE_HOMEPAGE_SHELL_PATTERNS = [
  /\bmanaged services and industry specific solutions\b/i,
  /\bredifining digital landscape with intelligent ai experts in execution\b/i,
  /\benterprise transformation with agentic ai\b/i,
  /\bhappy clients are the best advertising money can'?t buy\b/i,
  /\bhello!! i'?m sophie\b/i,
]
const INSPIREDGE_HOMEPAGE_TITLE = 'Managed Services and Industry Specific Solutions - Inspiredge IT Solutions'

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

const unique = (values) => [...new Set(values.filter(Boolean))]

const extractTitle = (html = '') => normalizeOptionalValue(
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
)

const looksLikeInspiredgeHomepageShell = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return false

  let hits = 0
  for (const pattern of INSPIREDGE_HOMEPAGE_SHELL_PATTERNS) {
    if (!pattern.test(normalized)) continue
    hits += 1
    if (hits >= 2) return true
  }

  return false
}

const isInspiredgeHomepageFallbackHtml = (html = '') => {
  return extractTitle(html) === INSPIREDGE_HOMEPAGE_TITLE
    || looksLikeInspiredgeHomepageShell(html)
}

const CITY_METADATA = {
  hyderabad: {
    label: 'Hyderabad',
    state: 'Telangana',
  },
  visakhapatnam: {
    label: 'Visakhapatnam',
    state: 'Andhra Pradesh',
  },
}

const NON_INDIA_LOCATION_PATTERN =
  /\b(?:uae|united\s+states|usa|charlotte|dallas|frisco|texas|canada|london|united\s+kingdom|uk|singapore|australia)\b/i

const toAbsoluteUrl = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return null

  try {
    return new URL(normalized, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const normalizeLocation = (value) => {
  const raw = normalizeOptionalValue(value)
  if (!raw || NON_INDIA_LOCATION_PATTERN.test(raw)) return null

  const parts = unique(
    raw
      .split(',')
      .map((part) => normalizeOptionalValue(part))
      .filter(Boolean),
  )

  const hasRemote = parts.some((part) => /^remote$/i.test(part))
  const cities = parts.filter((part) => !/^remote$/i.test(part))
  const primaryCityKey = cities[0]?.toLowerCase() || null
  const primaryCity = primaryCityKey && CITY_METADATA[primaryCityKey]
    ? CITY_METADATA[primaryCityKey].label
    : cities[0] || null
  const primaryState = primaryCityKey && CITY_METADATA[primaryCityKey]
    ? CITY_METADATA[primaryCityKey].state
    : null

  if (hasRemote && cities.length === 0) {
    return {
      location: 'Remote, India',
      city: null,
      remoteStatus: 'Remote',
    }
  }

  if (cities.length === 1 && primaryState) {
    return {
      location: `${primaryCity}, ${primaryState}, India`,
      city: primaryCity,
      remoteStatus: hasRemote ? 'Hybrid' : 'On-site',
    }
  }

  return {
    location: `${unique(cities).join(', ')}, India`,
    city: primaryCity,
    remoteStatus: hasRemote ? 'Hybrid' : 'On-site',
  }
}

export const hasOfficialJobsArchiveSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Jobs Archive\s*-\s*Inspiredge IT Solutions\s*<\/title>/i.test(page)
    && /class=["'][^"']*sjb-listing[^"']*["']/i.test(page)
    && normalized.includes('apply now')
    && normalized.includes('telecom analyst')
    && normalized.includes('ai engineer')
}

export const extractArchivePageUrls = (html = '') => {
  const archivePageUrls = new Map()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']*\/jobs\/(?:\?page=|page\/)\d+\/?)["']/gi)) {
    const pageNumber = Number.parseInt(
      match[1].match(/(?:\?page=|page\/)(\d+)\/?/i)?.[1] ?? '',
      10,
    )

    if (!Number.isInteger(pageNumber) || pageNumber <= 1) continue
    archivePageUrls.set(pageNumber, new URL(`page/${pageNumber}/`, CAREERS_URL).toString())
  }

  return [...archivePageUrls.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([, url]) => url)
}

export const extractJobs = (html = '') =>
  [...String(html ?? '').matchAll(
    /<div[^>]*class=["'][^"']*list-data[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<!--\s*=+\s*End Jobs List View/gi,
  )]
    .map((match) => match[1])
    .map((block) => {
      const title = normalizeOptionalValue(
        block.match(/<span[^>]*class=["'][^"']*job-title[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1],
      )
      const sourceUrl = toAbsoluteUrl(
        block.match(/<a[^>]+href=["']([^"']+)["'][^>]*class=["'][^"']*btn[^"']*["'][^>]*>\s*Apply Now\s*<\/a>/i)?.[1]
          || block.match(/<h4>[\s\S]*?<a[^>]+href=["']([^"']+)["']/i)?.[1],
      )
      const department = normalizeOptionalValue(
        block.match(/<div[^>]*class=["'][^"']*job-type[^"']*["'][^>]*>[\s\S]*?<\/i>([\s\S]*?)<\/div>/i)?.[1],
      )
      const locationValue = normalizeOptionalValue(
        block.match(/<div[^>]*class=["'][^"']*job-location[^"']*["'][^>]*>[\s\S]*?<\/i>([\s\S]*?)<\/div>/i)?.[1],
      )
      const posted = normalizeOptionalValue(
        block.match(/<div[^>]*class=["'][^"']*job-date[^"']*["'][^>]*>[\s\S]*?<\/i>([\s\S]*?)<\/div>/i)?.[1],
      )
      const jobDescription = normalizeOptionalValue(
        block.match(/<div[^>]*class=["'][^"']*job-description-list[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1],
      )

      if (!title || !sourceUrl || !locationValue) return null

      const normalizedLocation = normalizeLocation(locationValue)
      if (!normalizedLocation) return null

      const jobKey = slugify(new URL(sourceUrl).pathname.split('/').filter(Boolean).at(-1) || title)
      if (!jobKey) return null

      return {
        title,
        company: COMPANY,
        department,
        location: normalizedLocation.location,
        city: normalizedLocation.city,
        country: 'India',
        jobId: jobKey,
        requisitionId: jobKey,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: jobDescription || posted,
        remoteStatus: normalizedLocation.remoteStatus,
      }
    })
    .filter(Boolean)

export const createInspiredgeItSolutionsScraper = ({ maxJobs = null } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchBrowserText,
    now = () => new Date().toISOString(),
  } = {}) {
    const browserFallback = createBrowserNetworkFallback({
      fetchText,
      fetchBrowserText,
      userAgent: USER_AGENT,
      shouldUseBrowserFallback: (error) =>
        /protocol(?:\s+parse)?\s+error/i.test(String(error?.message ?? error ?? ''))
        || defaultShouldUseBrowserNetworkFallback(error),
      browserSessionOptions: {
        timeoutMs: 90000,
        settleTimeMs: 4000,
        ignoreHTTPSErrors: false,
      },
    })

    try {
      let jobsArchiveHtml = await browserFallback.fetchText(CAREERS_URL)
      if (!hasOfficialJobsArchiveSignal(jobsArchiveHtml)) {
        jobsArchiveHtml = await browserFallback.fetchTextInBrowser(CAREERS_URL)
      }

      if (!hasOfficialJobsArchiveSignal(jobsArchiveHtml)) {
        throw new Error(
          'The verified Inspiredge IT Solutions jobs archive no longer matches the trusted first-party page',
        )
      }

      const pageUrlsToVisit = [CAREERS_URL]
      const visitedPageUrls = new Set()
      const pageHtmlByUrl = new Map([[CAREERS_URL, jobsArchiveHtml]])
      const jobsByUrl = new Map()

      while (pageUrlsToVisit.length > 0 && visitedPageUrls.size < 20) {
        const pageUrl = pageUrlsToVisit.shift()
        if (!pageUrl || visitedPageUrls.has(pageUrl)) continue

        visitedPageUrls.add(pageUrl)
        const pageHtml = pageHtmlByUrl.get(pageUrl) || await browserFallback.fetchText(pageUrl)
        pageHtmlByUrl.set(pageUrl, pageHtml)

        for (const job of extractJobs(pageHtml)) {
          jobsByUrl.set(job.sourceUrl, job)
        }

        for (const nextPageUrl of extractArchivePageUrls(pageHtml)) {
          if (!visitedPageUrls.has(nextPageUrl)) {
            pageUrlsToVisit.push(nextPageUrl)
          }
        }
      }

      const jobs = [...jobsByUrl.values()]
      const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

      const baseJobs = selectedJobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
      }))
      const baseJobsBySourceUrl = new Map(
        baseJobs
          .filter((job) => job?.sourceUrl)
          .map((job) => [job.sourceUrl, job]),
      )

      const enrichedJobs = await enrichJobsWithPublicExperience(baseJobs, {
        fetchText: (url) => browserFallback.fetchText(url),
        fetchBrowserText: (url) => browserFallback.fetchTextInBrowser(url),
        concurrency: 4,
      })

      const finalizedJobs = await Promise.all(enrichedJobs.map(async (job) => {
        const baseJob = baseJobsBySourceUrl.get(job?.sourceUrl) || null
        const missingExperience = !String(job?.experienceRequired || '').trim()
        const hasHomepageShellDescription =
          looksLikeInspiredgeHomepageShell(job?.description)
          || looksLikeInspiredgeHomepageShell(job?.jobDescription)

        if (
          missingExperience
          && job?.publicExperienceChecked !== true
          && baseJob
          && hasHomepageShellDescription
        ) {
          return {
            ...job,
            description: baseJob.jobDescription || null,
            jobDescription: baseJob.jobDescription || null,
            publicExperienceChecked: true,
          }
        }

        if (!missingExperience || job?.publicExperienceChecked === true || !baseJob?.sourceUrl) {
          return job
        }

        try {
          const fallbackHtml = await browserFallback.fetchTextInBrowser(baseJob.sourceUrl)
          if (!isInspiredgeHomepageFallbackHtml(fallbackHtml)) {
            return job
          }

          return {
            ...job,
            description: baseJob.jobDescription || null,
            jobDescription: baseJob.jobDescription || null,
            publicExperienceChecked: true,
          }
        } catch {
          return job
        }
      }))

      return finalizedJobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      }))
    } finally {
      await browserFallback.close()
    }
  },
})

export const run = async (options = {}) => createInspiredgeItSolutionsScraper().run(options)

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
