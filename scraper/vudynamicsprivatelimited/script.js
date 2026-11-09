import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'vudynamicsprivatelimited'
export const COMPANY = 'VU-DYNAMICS Private Limited'
export const HOMEPAGE_URL = 'https://vudynamics.co.in/'
export const CAREERS_URL = 'https://vudynamics.co.in/careers/'
export const CAREERS_API_URL =
  'https://vudynamics.co.in/wp-json/wp/v2/pages?slug=careers&_fields=id,slug,link,title,content'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const RESERVED_SECTION_TITLES = new Set([
  'job description',
  'skills required',
  'key responsibilities',
  'why join us?',
  'why join us',
  'how to apply',
  'location',
  'employment type',
  'qualifications',
  'qualification',
  'experience',
  'salary(ctc)',
  'salary (ctc)',
  'salary',
  'other perks',
  'joining date',
  'date of joining',
  'note',
  'number of positions',
])

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#8211;|&ndash;|\u2013/gi, '-')
  .replace(/&#8212;|&mdash;|\u2014/gi, '-')
  .replace(/&#8216;|&#8217;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&#8220;|&#8221;|&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/\r/g, '')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6]|\/a|\/span)\b[^>]*>/gi, '\n')
    .replace(/<(?:p|div|li|ul|ol|section|article|main|h[1-6]|a|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'role'

const htmlToTextLines = (html) => decodeHtml(String(html ?? ''))
  .replace(/\r/g, '')
  .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6]|\/a|\/span)\b[^>]*>/gi, '\n')
  .replace(/<(?:p|div|li|ul|ol|section|article|main|h[1-6]|a|span)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split(/\n+/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const buildApplyUrl = (title) => `mailto:careers@vudynamics.co.in?subject=${encodeURIComponent(title)}`

const extractLineValue = (lines, label) => {
  const exactPattern = new RegExp(`^${escapeRegex(label)}\\s*:`, 'i')
  const barePattern = new RegExp(`^${escapeRegex(label)}$`, 'i')

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (exactPattern.test(line)) {
      return normalizeWhitespace(line.replace(exactPattern, ''))
    }

    if (barePattern.test(line)) {
      return normalizeWhitespace(lines[index + 1])
    }
  }

  return null
}

const extractListSection = (html, label) => {
  const pattern = new RegExp(
    `<(?:p|h[1-6])\\b[^>]*>\\s*(?:<strong>)?\\s*${escapeRegex(label)}\\s*:?(?:<\\/strong>)?\\s*<\\/(?:p|h[1-6])>\\s*<ul\\b[^>]*>([\\s\\S]*?)<\\/ul>`,
    'i',
  )
  const match = pattern.exec(String(html ?? ''))
  if (!match) return []

  return [...match[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((item) => stripTags(item[1]))
    .filter(Boolean)
}

const extractJobBlocks = (html) => {
  const blocks = []
  const rawBlocks = String(html ?? '').split(/<hr\b[^>]*\/?>/i)

  for (const block of rawBlocks) {
    const normalizedBlock = normalizeWhitespace(block)?.toLowerCase()
    if (!normalizedBlock) continue
    if (!normalizedBlock.includes('job description')) continue
    if (normalizedBlock.includes('send your cv and portfolio')) continue
    blocks.push(block)
  }

  return blocks
}

const extractTitle = (block, lines) => {
  for (const match of String(block ?? '').matchAll(/<strong>\s*([^<]+?)\s*<\/strong>/gi)) {
    const candidate = normalizeWhitespace(match[1])
    if (!candidate) continue
    if (RESERVED_SECTION_TITLES.has(candidate.toLowerCase())) continue
    return candidate
  }

  return lines.find((line) => !RESERVED_SECTION_TITLES.has(line.toLowerCase())) || null
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/kanpur/i.test(normalized)) return 'Kanpur'
  return null
}

const buildJobDescription = (block, title) => {
  const text = stripTags(block)
  if (!text) return null

  return normalizeWhitespace(
    text
      .replace(new RegExp(`^${escapeRegex(title)}\\s*`, 'i'), '')
      .replace(/HOW TO APPLY[\s\S]*$/i, '')
      .replace(/Send your CV and Portfolio[\s\S]*$/i, ''),
  )
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*VU-DYNAMICS\s*<\/title>/i.test(page)
    && normalized.includes('Founded in 2022')
    && normalized.includes('Born out of the corridors of IIT Kanpur')
    && /href=["']https:\/\/vudynamics\.co\.in\/careers\/["']/i.test(page)
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Careers\b[\s\S]*VU-DYNAMICS\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/vudynamics\.co\.in\/careers\/["']/i.test(page)
    && normalized.includes('JOIN OUR TEAM')
    && normalized.includes('HOW TO APPLY')
    && /mailto:careers@vudynamics\.co\.in/i.test(page)
}

export const hasVerifiedCareersApiPayload = (payload) => {
  if (!Array.isArray(payload) || payload.length !== 1) return false

  const [page] = payload
  const content = String(page?.content?.rendered ?? '')

  return page?.slug === 'careers'
    && page?.link === CAREERS_URL
    && normalizeWhitespace(page?.title?.rendered)?.toLowerCase() === 'careers'
    && /Embedded Systems Engineer|UAV Test Pilot|Software Engineer|CAD Engineer/i.test(content)
    && /mailto:careers@vudynamics\.co\.in/i.test(content)
    && /Number of Positions/i.test(content)
}

export const extractJobsFromCareersHtml = (html) => extractJobBlocks(html)
  .map((block) => {
    const lines = htmlToTextLines(block)
    const title = extractTitle(block, lines)
    if (!title) return null

    const location = extractLineValue(lines, 'Location')
    const employmentType = extractLineValue(lines, 'Employment Type')
    const minimumQualification =
      extractLineValue(lines, 'Qualifications')
      || extractLineValue(lines, 'Qualification')
    const experienceRequired = extractLineValue(lines, 'Experience')
    const requiredSkills = extractListSection(block, 'Skills Required')

    return {
      title,
      company: COMPANY,
      location,
      city: extractCity(location),
      country: 'India',
      jobId: `${SOURCE}-${slugify(`${title}-${location || 'india'}`)}`,
      requisitionId: null,
      sourceUrl: CAREERS_URL,
      applyUrl: buildApplyUrl(title),
      employmentType,
      department: null,
      experienceRequired,
      minimumQualification,
      preferredQualification: null,
      requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: buildJobDescription(block, title),
    }
  })
  .filter((job) => job?.title && job?.location)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createVuDynamicsPrivateLimitedScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('VU-DYNAMICS verified official homepage changed')
    }

    const careersPageHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersPageHtml)) {
      throw new Error('VU-DYNAMICS verified official careers page changed')
    }

    const careersPayload = await fetchJson(CAREERS_API_URL)
    if (!hasVerifiedCareersApiPayload(careersPayload)) {
      throw new Error('VU-DYNAMICS verified careers API changed')
    }

    const jobs = extractJobsFromCareersHtml(careersPayload[0].content.rendered)
      .sort((left, right) => left.title.localeCompare(right.title))

    if (jobs.length === 0) {
      throw new Error('VU-DYNAMICS verified careers API no longer exposes trusted public roles')
    }

    return jobs
  },
})

export const run = async (options = {}) => createVuDynamicsPrivateLimitedScraper().run(options)

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
