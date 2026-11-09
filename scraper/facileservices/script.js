import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { FACILE_SERVICES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = FACILE_SERVICES_CATALOG.source
export const COMPANY = FACILE_SERVICES_CATALOG.companyName
export const CAREERS_URL = FACILE_SERVICES_CATALOG.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&#34;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')

const stripTags = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|li|ul|ol|h\d)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null
const normalizeRichText = (value) => normalizeWhitespace(stripTags(value)) || null

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const inferCity = (location) => normalizeText(String(location ?? '').split(',')[0])

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /Career Opportunities/i.test(page)
    && /data-jtitle="Content Writer"/i.test(page)
    && /data-jtitle="Database Administrator"/i.test(page)
    && /data-jtitle="Programmatic Ads Specialist"/i.test(page)
    && /class="location-col">\s*Pune\s*<\/td>/i.test(page)
}

export const extractCareerRows = (html = '') => [...String(html ?? '').matchAll(/<tr>([\s\S]*?)<\/tr>/gi)]
  .map((match) => {
    const rowHtml = match[1]
    if (!/post-title-col/i.test(rowHtml) || !/location-col/i.test(rowHtml)) return null

    const title = normalizeText(
      rowHtml.match(/data-jtitle="([^"]+)"/i)?.[1]
      || rowHtml.match(/class="post-title-col">\s*([^<]+)/i)?.[1],
    )
    const description = normalizeRichText(rowHtml.match(/data-jdesc="([\s\S]*?)"/i)?.[1])
    const location = normalizeText(rowHtml.match(/class="location-col">\s*([\s\S]*?)\s*<\/td>/i)?.[1])
    const experienceRequired = normalizeText(
      String(rowHtml.match(/class="exp-col">\s*([\s\S]*?)\s*<\/td>/i)?.[1] ?? '')
        .replace(/^EXP:\s*/i, ''),
    )

    if (!title || !location) return null

    const slug = slugify(title)

    return {
      title,
      department: null,
      location,
      city: inferCity(location),
      country: 'India',
      jobId: `${SOURCE}-${slug}`,
      requisitionId: slug,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: null,
      workplaceType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: description || title,
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

export const createFacileServicesScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Facile Services careers page no longer matches the trusted first-party surface')
    }

    const jobs = extractCareerRows(careersHtml)
    if (jobs.length === 0) {
      throw new Error('Facile Services careers page no longer exposes the verified current openings table')
    }

    return jobs
      .sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))
      .map((job) => ({
        ...job,
        companyCareerPage: CAREERS_URL,
        company: COMPANY,
        source: SOURCE,
        companyDomain: FACILE_SERVICES_CATALOG.companyDomain,
        atsPlatform: FACILE_SERVICES_CATALOG.atsPlatform,
        link: CAREERS_URL,
        scrapedAt: (overrideNow || now)(),
      }))
  },
})

export const run = async (options = {}) => createFacileServicesScraper().run(options)

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
