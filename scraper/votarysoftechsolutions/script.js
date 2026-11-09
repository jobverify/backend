import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { VOTARY_SOFTECH_SOLUTIONS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#8217;|&#39;|&apos;/gi, "'")
  .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li|ul|ol|h[1-6]|span)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const decodeFaqHtml = (value) => String(value ?? '')
  .replace(/\\u003c/gi, '<')
  .replace(/\\u003e/gi, '>')
  .replace(/\\u0026/gi, '&')
  .replace(/\\"/g, '"')
  .replace(/\\\//g, '/')
  .replace(/\\n/g, '\n')

const parsePostedDate = (value) => {
  const match = String(value ?? '').match(/Posted on\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i)
  if (!match) return null

  const monthLookup = {
    january: '01',
    february: '02',
    march: '03',
    april: '04',
    may: '05',
    june: '06',
    july: '07',
    august: '08',
    september: '09',
    october: '10',
    november: '11',
    december: '12',
  }

  const month = monthLookup[match[2].toLowerCase()]
  if (!month) return null

  return `${match[3]}-${month}-${match[1].padStart(2, '0')}`
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Careers\s*&#8211;\s*Votary Tech\s*<\/title>/i.test(page)
    && text.includes('Featured Jobs')
    && text.includes('Current Openings')
    && text.includes('Software Engineer / WLAN Testing')
}

export const extractFaqJobEntries = (html = '') => {
  const entries = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(
    /<script type="application\/ld\+json">([\s\S]*?"@type":"FAQPage"[\s\S]*?)<\/script>/gi,
  )) {
    let payload
    try {
      payload = JSON.parse(match[1])
    } catch {
      continue
    }

    const entities = Array.isArray(payload?.mainEntity) ? payload.mainEntity : []
    for (const entity of entities) {
      const rawName = stripTags(entity?.name ?? '')
      const answerHtml = decodeFaqHtml(entity?.acceptedAnswer?.text ?? '')
      const answerItems = extractListItems(answerHtml)
      if (!rawName || answerItems.length === 0) continue

      const title = normalizeWhitespace(
        rawName
          .replace(/Hyderabad[\s\S]*$/i, '')
          .replace(/\s+Posted on[\s\S]*$/i, '')
          .replace(/\s+Hybrid[\s\S]*$/i, ''),
      )
      if (!title || !title.includes('/')) continue

      const locationItem = answerItems.find((item) => /^location\b/i.test(item) || /Location\s*:/i.test(item))
      const experienceItem = answerItems.find((item) => /^experience\b/i.test(item) || /Experience\s*:/i.test(item))
      const qualificationItem = answerItems.find((item) => /^qualification\b/i.test(item) || /Qualification\s*:/i.test(item))
      const postingItem = answerItems.find((item) => /^posted on\b/i.test(item))
      const requiredSkills = answerItems.filter((item) => !/^(posted on|location|experience|qualification|industry-required|hybrid|job title)\b/i.test(item))
      const jobId = `${SOURCE}-${slugify(title)}`
      if (seen.has(jobId)) continue
      seen.add(jobId)

      entries.push({
        title,
        location: locationItem?.replace(/^Location\s*:\s*/i, '') ?? 'Hyderabad',
        experienceRequired: experienceItem?.replace(/^Experience\s*:\s*/i, '') ?? null,
        minimumQualification: qualificationItem?.replace(/^Qualification\s*:\s*/i, '') ?? null,
        postingDate: parsePostedDate(postingItem),
        requiredSkills,
        sourceUrl: CAREERS_URL,
        applyUrl: CAREERS_URL,
        jobDescription: stripTags(answerHtml),
        jobId,
      })
    }
  }

  if (entries.length === 0) {
    throw new Error('Votary Softech Solutions careers page no longer exposes trusted FAQ job entries')
  }

  return entries
}

export const createVotarySoftechSolutionsScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Votary Softech Solutions verified careers page no longer matches the trusted first-party surface')
    }

    return extractFaqJobEntries(careersHtml).map((job) => ({
      ...job,
      requisitionId: job.jobId,
      company: COMPANY,
      source: SOURCE,
      country: 'India',
      city: 'Hyderabad',
      state: 'Telangana',
      companyCareerPage: CAREERS_URL,
      companyDomain: 'votarytech.com',
      atsPlatform: 'official-company-careers',
      link: job.applyUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createVotarySoftechSolutionsScraper().run(options)

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
