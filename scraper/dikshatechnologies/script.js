import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { DIKSHA_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DIKSHA_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")

const stripTags = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(stripTags(value))
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return CAREERS_URL
  }
}

const getJobSlug = (value) => {
  try {
    const segments = new URL(value).pathname.split('/').filter(Boolean)
    return segments.at(-1) || SOURCE
  } catch {
    return SOURCE
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /Search jobs/i.test(page)
    && /join-diksha-now/i.test(page)
    && /\/job\/[a-f0-9-]+\//i.test(page)
    && /Read More/i.test(page)
}

export const extractPaginationPages = (html = '') => {
  const page = String(html ?? '')
  const paginationHtml = page.match(
    /<ul[^>]+class="[^"]*pagination[^"]*"[^>]*>([\s\S]*?)<\/ul>/i,
  )?.[1] ?? ''
  const pages = new Set()

  for (const match of paginationHtml.matchAll(/>(\d+)<\/a>/gi)) {
    pages.add(Number.parseInt(match[1], 10))
  }

  if (pages.size === 0 && hasOfficialCareersSignal(page)) {
    pages.add(1)
  }

  return [...pages].filter(Number.isFinite).sort((left, right) => left - right)
}

export const extractJobCards = (html = '') => [...String(html ?? '').matchAll(
  /<div class="card-body bg-light p-4">([\s\S]*?)<\/div>\s*<\/article>/gi,
)]
  .map((match) => {
    const block = match[1]
    const href = block.match(/<a[^>]+href="([^"]*\/job\/[^"]+)"[^>]*>/i)?.[1]
    const title = normalizeText(
      block.match(/<h4[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h4>/i)?.[1],
    )
    const meta = normalizeText(block.match(/<p[^>]*class="[^"]*card-text[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1])

    if (!title || !href) return null

    const applyUrl = toAbsoluteUrl(href)
    const slug = getJobSlug(applyUrl)
    const metaParts = String(meta ?? '')
      .split('|')
      .map((value) => value.trim())
      .filter(Boolean)
    const [postingDate = null, location = null, workplaceType = null, experienceRequired = null] = metaParts
    const jobDescription = metaParts.join(' | ') || title

    return {
      title,
      department: null,
      location,
      city: location,
      country: 'India',
      jobId: `${SOURCE}-${slug}`,
      requisitionId: slug,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: null,
      workplaceType,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate,
      closingDate: null,
      jobDescription,
      publicExperienceChecked: Boolean(jobDescription),
    }
  })
  .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createDikshaTechnologiesScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const firstPageHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(firstPageHtml)) {
      throw new Error('Diksha Technologies careers page no longer matches the verified first-party jobs surface')
    }

    const paginationPages = extractPaginationPages(firstPageHtml)
    if (paginationPages.length === 0) {
      throw new Error('Diksha Technologies careers page no longer exposes the verified first-party pagination contract')
    }

    const jobMap = new Map()
    const pagesToFetch = paginationPages.includes(1) ? paginationPages : [1, ...paginationPages]

    for (const pageNumber of pagesToFetch) {
      const pageHtml = pageNumber === 1
        ? firstPageHtml
        : await fetchText(`${CAREERS_URL}?page=${pageNumber}`)
      const jobs = extractJobCards(pageHtml)

      for (const job of jobs) {
        jobMap.set(job.jobId, job)
      }
    }

    if (jobMap.size === 0) {
      throw new Error('Diksha Technologies careers page no longer exposes verified first-party job cards')
    }

    return [...jobMap.values()]
      .sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))
      .map((job) => ({
        ...job,
        companyCareerPage: CAREERS_URL,
        company: COMPANY,
        source: SOURCE,
        companyDomain: PROVIDER_METADATA.companyDomain,
        atsPlatform: PROVIDER_METADATA.atsPlatform,
        link: job.applyUrl,
        scrapedAt: (overrideNow || now)(),
      }))
  },
})

export const run = async (options = {}) => createDikshaTechnologiesScraper().run(options)

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
