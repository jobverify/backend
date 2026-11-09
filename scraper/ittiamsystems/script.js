import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ittiamsystems'
export const COMPANY = 'Ittiam Systems'
export const HOMEPAGE_URL = 'https://www.ittiam.com/'
export const CAREERS_PAGE_URL = 'https://www.ittiam.com/careers/'
export const CAREERS_PAGE_API_URL = 'https://www.ittiam.com/wp-json/wp/v2/pages?slug=careers&per_page=20'
export const APPLICATION_EMAIL = 'talent@ittiam.com'
export const APPLICATION_URL = `mailto:${APPLICATION_EMAIL}`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&#8221;|&#8220;|&quot;/g, '"')
  .replace(/&#8217;|&#39;|&apos;|&rsquo;/g, "'")
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const decodeTabbingContent = (value) => {
  const raw = normalizeWhitespace(value)
  if (!raw) return null

  if (raw.startsWith('[') || raw.startsWith('{')) {
    return raw
  }

  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

const extractAttributeValue = (renderedHtml, attributeName) => {
  const html = String(renderedHtml ?? '')
  const patterns = [
    new RegExp(`${escapeRegExp(attributeName)}=&#8221;([\\s\\S]*?)&#8221;`, 'i'),
    new RegExp(`${escapeRegExp(attributeName)}=&quot;([\\s\\S]*?)&quot;`, 'i'),
    new RegExp(`${escapeRegExp(attributeName)}='([\\s\\S]*?)'`, 'i'),
    new RegExp(`${escapeRegExp(attributeName)}="([\\s\\S]*?)"`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(html)
    if (match?.[1]) return match[1]
  }

  return null
}

const extractLabelValue = (html, label) => {
  const pattern = new RegExp(
    `<strong[^>]*>\\s*${escapeRegExp(label)}:\\s*<\\/strong>\\s*([\\s\\S]*?)(?=<strong[^>]*>\\s*[^<]+:\\s*<\\/strong>|$)`,
    'i',
  )
  const match = pattern.exec(String(html ?? ''))
  return match ? stripTags(match[1]) : null
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .replace(/\bto\b/gi, '-')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const isOfficialPagePayload = (page) => (
  page?.link === CAREERS_PAGE_URL
  && page?.title?.rendered === 'Careers'
  && typeof page?.content?.rendered === 'string'
)

export const hasOfficialCareersSignal = (renderedHtml) => {
  const html = String(renderedHtml ?? '')
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Current Opportunities')
    && normalized.includes(APPLICATION_EMAIL)
    && /ittiam_vertical_tabbing_layout/i.test(html)
}

export const extractCurrentOpportunities = (renderedHtml) => {
  if (!hasOfficialCareersSignal(renderedHtml)) {
    throw new Error('Ittiam Systems verified official careers surface changed or disappeared')
  }

  const tabbingContent = decodeTabbingContent(extractAttributeValue(
    renderedHtml,
    'tabbing_content',
  ))

  if (!tabbingContent) {
    throw new Error('Ittiam Systems verified official careers surface changed or disappeared')
  }

  let parsedJobs
  try {
    parsedJobs = JSON.parse(tabbingContent)
  } catch {
    throw new Error('Ittiam Systems verified official careers surface changed or disappeared')
  }

  if (!Array.isArray(parsedJobs) || parsedJobs.length === 0) {
    throw new Error('Ittiam Systems verified official careers surface changed or disappeared')
  }

  return parsedJobs.map((job) => {
    const title = normalizeWhitespace(job?.title)
    const description = String(job?.description ?? '')
    const plainDescription = stripTags(description)
    const location = extractLabelValue(description, 'Location')
    const experienceRequired = normalizeExperience(extractLabelValue(description, 'Required Experience'))
    const minimumQualification = extractLabelValue(description, 'Educational Qualification')
    const employmentTypeRaw = extractLabelValue(description, 'Mode of Employment')
    const employmentType = employmentTypeRaw?.toLowerCase().includes('contract')
      ? 'Contract'
      : null

    return {
      title,
      company: COMPANY,
      department: null,
      location,
      city: location?.split(',')[0]?.trim() || null,
      country: 'India',
      jobId: slugify(title),
      requisitionId: null,
      sourceUrl: CAREERS_PAGE_URL,
      applyUrl: APPLICATION_URL,
      employmentType,
      experienceRequired,
      minimumQualification,
      preferredQualification: null,
      requiredSkills: extractListItems(description),
      postingDate: null,
      closingDate: null,
      jobDescription: plainDescription,
      remoteStatus: null,
    }
  }).filter((job) => job.title)
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createIttiamSystemsScraper = () => ({
  async run({ fetchJson = defaultFetchJson } = {}) {
    const payload = await fetchJson(CAREERS_PAGE_API_URL)
    const page = Array.isArray(payload) ? payload[0] : payload

    if (!isOfficialPagePayload(page)) {
      throw new Error('Ittiam Systems verified official careers surface changed or disappeared')
    }

    if (!hasOfficialCareersSignal(page.content.rendered)) {
      throw new Error('Ittiam Systems verified official careers surface changed or disappeared')
    }

    const jobs = extractCurrentOpportunities(page.content.rendered)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createIttiamSystemsScraper().run(options)

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
