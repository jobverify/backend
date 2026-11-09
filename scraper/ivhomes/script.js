import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ivhomes'
export const COMPANY = 'Iv Homes'
export const HOMEPAGE_URL = 'https://ivhomes.in/'
export const CAREERS_URL = 'https://ivhomes.in/hiring/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;|[\u2013\u2014]/g, '-')
  .replace(/&#8212;|&mdash;/g, '-')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/table|\/tr|\/td|\/th)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<tr\b[^>]*>/gi, '\n')
    .replace(/<td\b[^>]*>/gi, ' ')
    .replace(/<th\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const stripTagsWithLineBreaks = (value) => {
  const text = String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/table|\/tr|\/td|\/th)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<tr\b[^>]*>/gi, '\n')
    .replace(/<td\b[^>]*>/gi, ' ')
    .replace(/<th\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')

  return normalizeWhitespace(text.replace(/\n+/g, '\n').replace(/ *\n */g, '\n'))
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/['"]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const extractCareerLink = (html) => {
  const match = String(html ?? '').match(/href=["']([^"']*\/hiring\/?)["']/i)
  if (!match) return null
  try {
    return new URL(match[1], HOMEPAGE_URL).toString()
  } catch {
    return null
  }
}

const extractParagraphBlocks = (html) => {
  const blocks = []
  const pattern = /<p\b[^>]*>([\s\S]*?)<\/p>/gi
  for (const match of String(html ?? '').matchAll(pattern)) {
    blocks.push({
      rawHtml: match[1],
      text: stripTags(match[1]),
    })
  }
  return blocks.filter((block) => block.text)
}

const isDesktopTitleParagraph = (rawHtml) => (
  /text-decoration:\s*underline/i.test(rawHtml)
  || /<u\b/i.test(rawHtml)
)

const extractTitleFromParagraph = (text) => {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return null

  const title = normalized
    .replace(/\s+(?:Experience|Responsibilities|Qualifications|Location):.*$/i, '')
    .replace(/\s+(?:Job Title|Position reports to|External \/ Internal Interface|Minimum Qualification|Minimum Experience|Special Skills\/Attributes|Overall, Purpose\/Objective Of the job|Key Responsibilities):.*$/i, '')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s*(?:[.:])\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim()

  return title || null
}

const extractLocation = (text) => {
  const match = normalizeWhitespace(text)?.match(/\bLocation:\s*(.*?)(?=\s+(?:Responsibilities|Qualifications)|$)/i)
  const location = normalizeWhitespace(match?.[1] ?? null)?.replace(/[.]+$/u, '')
  if (!location) return null
  return /india/i.test(location) ? location : `${location}, India`
}

const extractExperience = (text) => normalizeWhitespace(
  text?.match(/\bExperience:\s*(.*?)(?=\s+(?:Location|Responsibilities|Qualifications)|$)/i)?.[1] ?? null,
)?.replace(/[.]+$/u, '')

const buildJobDescription = (title, bodyText, extraText = null) => {
  const parts = [bodyText, extraText]
    .filter(Boolean)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  return parts.join(' ') || title
}

const buildDesktopOpenings = (html) => {
  const source = String(html ?? '')
  const start = source.indexOf('<div class="elementor-text-editor elementor-clearfix">')
  const end = source.indexOf('<div class="elementor-toggle-item">')
  if (start < 0 || end < 0 || end <= start) return []

  const paragraphs = extractParagraphBlocks(source.slice(start, end))
  const jobs = []
  let current = null

  const flushCurrent = () => {
    if (!current) return

    const bodyText = normalizeWhitespace(current.textParts.join(' '))
    const location = extractLocation(bodyText)
    const city = location && !/[,/&]/.test(location.replace(/,?\s*India$/i, ''))
      ? location.replace(/,?\s*India$/i, '')
      : null

    jobs.push({
      title: current.title,
      location,
      city,
      experienceRequired: extractExperience(bodyText),
      jobId: slugify(current.title),
      requisitionId: slugify(current.title),
      sourceUrl: CAREERS_URL,
      applyUrl: null,
      department: current.title,
      minimumQualification: current.qualificationText || null,
      requiredSkills: [],
      jobDescription: buildJobDescription(current.title, bodyText, current.qualificationText || null),
    })
  }

  for (const paragraph of paragraphs) {
    if (paragraph.text === 'Why Work with PR Properties?') break

    if (isDesktopTitleParagraph(paragraph.rawHtml)) {
      flushCurrent()
      current = {
        title: extractTitleFromParagraph(paragraph.text),
        textParts: [paragraph.text],
        qualificationText: null,
      }
      continue
    }

    if (!current) continue

    current.textParts.push(paragraph.text)

    if (/^Qualifications:/i.test(paragraph.text) && !current.qualificationText) {
      current.qualificationText = normalizeWhitespace(
        paragraph.text.replace(/^Qualifications:\s*/i, ''),
      )
    }
  }

  flushCurrent()
  return jobs
}

const buildAccordionOpenings = (html) => {
  const source = String(html ?? '')
  const jobs = []
  const titlePattern = /<a class="elementor-toggle-title"[^>]*>([\s\S]*?)<\/a>/gi

  for (const match of source.matchAll(titlePattern)) {
    const title = stripTags(match[1])
    if (!title) continue

    const titleEnd = match.index + match[0].length
    const nextItemIndex = source.indexOf('<div class="elementor-toggle-item">', titleEnd)
    const contentStartMarker = source.indexOf('<div class="elementor-tab-content', titleEnd)
    if (contentStartMarker < 0) continue

    const contentStart = source.indexOf('>', contentStartMarker) + 1
    const contentEnd = nextItemIndex > 0 ? nextItemIndex : source.length
    const contentHtml = source.slice(contentStart, contentEnd)
    const bodyText = stripTagsWithLineBreaks(contentHtml)

    const minimumQualification = contentHtml.match(/Minimum Qualification<\/strong>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i)
      ? stripTags(contentHtml.match(/Minimum Qualification<\/strong>\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? null)
      : null

    jobs.push({
      title,
      location: extractLocation(bodyText),
      city: null,
      experienceRequired: extractExperience(bodyText),
      jobId: slugify(title),
      requisitionId: slugify(title),
      sourceUrl: CAREERS_URL,
      applyUrl: null,
      department: title,
      minimumQualification,
      requiredSkills: [],
      jobDescription: buildJobDescription(title, bodyText),
    })
  }

  return jobs
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''
  return [
    'iv homes',
    'real estate sales experts',
    'real estate sales as a service',
    'trusted real estate sales experts',
  ].some((signal) => normalized.includes(signal)) && extractCareerLink(html) === CAREERS_URL
}

export const hasOfficialHiringSignal = (html) => {
  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''
  return normalized.includes('current job openings')
    && (normalized.includes('elementor-toggle-title') || normalized.includes('sales manager'))
}

export const extractJobOpenings = (html) => {
  const jobs = [
    ...buildDesktopOpenings(html),
    ...buildAccordionOpenings(html),
  ]

  return [...new Map(jobs.map((job) => [job.title, job])).values()]
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createIvHomesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Iv Homes homepage no longer matches the verified official homepage')
    }

    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialHiringSignal(careersHtml)) {
      throw new Error('Iv Homes hiring page no longer matches the verified first-party hiring page')
    }

    const openings = extractJobOpenings(careersHtml)
    if (openings.length === 0) {
      throw new Error('Iv Homes hiring page no longer exposes verified first-party job openings')
    }

    return openings.map((job) => ({
      ...job,
      company: COMPANY,
      country: 'India',
      employmentType: null,
      postingDate: null,
      closingDate: null,
      source: SOURCE,
      link: CAREERS_URL,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createIvHomesScraper().run()

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
