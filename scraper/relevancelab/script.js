import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://www.relevancelab.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtmlEntities = (value) => {
  const normalized = String(value ?? '')

  return normalized
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, '\'')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, ' ')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const getSlugFromUrl = (url) => {
  try {
    const { pathname } = new URL(url)
    return normalizeWhitespace(pathname.split('/').filter(Boolean).at(-1))
  } catch {
    return null
  }
}

const getSectionHtml = (html, heading) => {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(html ?? '').match(
    new RegExp(`<h[23][^>]*>\\s*${escapedHeading}\\s*<\\/h[23]>([\\s\\S]*?)(?=<h[23][^>]*>|$)`, 'i'),
  )

  return match?.[1] || ''
}

const getFieldValue = (html, heading) => stripTags(getSectionHtml(html, heading))

const getParagraphValues = (html) => (
  [...String(html ?? '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripTags(match[1]))
    .filter((value) => value && value !== '|')
)

const parseLocation = (value) => {
  const normalized = normalizeWhitespace(value)?.replace(/\s*\|\s*/g, ', ')
  if (!normalized) {
    return {
      location: null,
      city: null,
      state: null,
      country: null,
    }
  }

  const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean)

  return {
    location: normalized,
    city: parts[0] || null,
    state: parts.length > 2 ? parts[1] : null,
    country: parts.at(-1) || null,
  }
}

const extractLocationValue = (html) => {
  const values = getParagraphValues(getSectionHtml(html, 'Location'))
  return normalizeWhitespace(values.join(', '))
}

const extractSingleParagraphValue = (html, heading) => {
  const values = getParagraphValues(getSectionHtml(html, heading))
  return values[0] || null
}

const splitRequiredSkills = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return []

  return normalized
    .split(/\s*,\s*|\s+and\s+/i)
    .map((skill) => normalizeWhitespace(skill))
    .filter(Boolean)
}

const extractDescription = (html) => {
  const section = getSectionHtml(html, 'Job Description')
  return stripTags(section)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers\s*\|\s*Relevance Lab\s*<\/title>/i.test(page)
    && /Work that Makes a Difference/i.test(page)
    && /Explore Job Opportunities/i.test(page)
    && /Relevance Lab/i.test(page)
}

export const extractIndiaJobCards = (html) => {
  const indiaSectionMatch = String(html ?? '').match(
    /<h[23][^>]*>\s*India\s*<\/h[23]>([\s\S]*?)(?=<h[1-6][^>]*>\s*(?:USA|Ethiopia|Canada)\s*<\/h[1-6]>|$)/i,
  )

  if (!indiaSectionMatch) return []

  const cards = []
  const pattern = /<div[^>]+class="[^"]*job_offer_wrapper[^"]*"[\s\S]*?<h4[^>]*>\s*([^<]+?)\s*<\/h4>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>[\s\S]*?<\/a>[\s\S]*?<\/div>/gi

  for (const match of indiaSectionMatch[1].matchAll(pattern)) {
    const title = stripTags(match[1])
    const detailUrl = toAbsoluteUrl(match[2])

    if (!title || !detailUrl) continue

    cards.push({ title, detailUrl })
  }

  return cards
}

export const extractJobDetail = (expectedTitle, detailUrl, html) => {
  const title = getFieldValue(html, stripTags(`<h1>${expectedTitle}</h1>`)) || stripTags(expectedTitle)
  const locationFields = parseLocation(extractLocationValue(html))
  const country = locationFields.country

  if (!title || !detailUrl || !country || !/india/i.test(country)) {
    return null
  }

  const jobId = getSlugFromUrl(detailUrl)

  if (!jobId) return null

  return {
    title,
    company: 'Relevance Lab',
    department: null,
    location: locationFields.location,
    city: locationFields.city,
    state: locationFields.state,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: extractSingleParagraphValue(html, 'Commitment'),
    experienceRequired: extractSingleParagraphValue(html, 'Experience'),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: splitRequiredSkills(extractSingleParagraphValue(html, 'Required Skills')),
    postingDate: null,
    closingDate: null,
    jobDescription: extractDescription(html),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'relevancelab',
  timeoutMs: 15000,
})

export const createRelevanceLabScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Relevance Lab official careers surface changed; refusing to scrape an unverified page')
    }

    const cards = extractIndiaJobCards(careersHtml)
    const jobs = []

    for (const card of cards) {
      const detailHtml = await fetchText(card.detailUrl)
      const job = extractJobDetail(card.title, card.detailUrl, detailHtml)
      if (!job) continue
      jobs.push(job)
    }

    return jobs
      .sort((left, right) => left.title.localeCompare(right.title))
      .map((job) => ({
        ...job,
        source: 'relevancelab',
        link: job.applyUrl,
        scrapedAt: new Date().toISOString(),
      }))
  },
})

export const run = async () => createRelevanceLabScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'relevancelab')
}
