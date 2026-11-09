import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'criamosengineeringpvtltd'
export const COMPANY = 'CRIAMOS ENGINEERING PVT LTD'
export const HOMEPAGE_URL = 'https://www.criamose.com/'
export const CAREERS_URL = 'https://www.criamose.com/index.php/careers'
export const COMPANY_DOMAIN = 'criamose.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const ZERO_JOBS_PATTERN = /\b(no current openings|no current vacancies|no openings|check back later)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const toLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /india$/i.test(normalized) ? normalized : `${normalized}, India`
}

const toCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /[\/|]/.test(normalized)) return null

  const firstPart = normalized.split(',')[0]?.trim()
  return firstPart || null
}

const extractParagraphs = (html) => [...String(html ?? '').matchAll(/<p>([\s\S]*?)<\/p>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractOpeningsSection = (html) => {
  const match = String(html ?? '').match(/<div id="inn_cnt">([\s\S]*?)<\/div>/i)
  return match?.[1] ?? null
}

const extractExperienceRequired = (title) => {
  const match = normalizeWhitespace(title)?.match(/\bwith\s+(.+)$/i)
  return match?.[1] ? normalizeWhitespace(match[1]) : null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Criamos Engineering Pvt Ltd \| Criamos \| Tire and Rubber Machinery\s*<\/title>/i.test(page)
    && /Criamos Engineering Pvt Ltd/i.test(text)
    && /Engineering for better tomorrow/i.test(text)
    && /href=["']https?:\/\/www\.criamose\.com\/index\.php\/careers["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Criamos Engineering Pvt Ltd \| Careers \|\s*<\/title>/i.test(page)
    && /<h3>\s*Careers\s*<\/h3>/i.test(page)
    && /<a href="https:\/\/www\.criamose\.com\/">\s*Home\s*<\/a>\s*(?:&gt;|>)\s*Careers/i.test(page)
    && /<div id="inn_cnt">/i.test(page)
    && /\bJob Opportunities\b/i.test(text)
}

export const extractPublicJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('CRIAMOS verified first-party careers page no longer matches the known public surface')
  }

  const openingsSection = extractOpeningsSection(html)
  if (!openingsSection) {
    throw new Error('CRIAMOS verified careers page no longer exposes the expected openings container')
  }

  const paragraphs = extractParagraphs(openingsSection)
  const sectionText = paragraphs.join('\n')
  const roles = []
  let currentRole = null

  for (const paragraph of paragraphs) {
    if (/^job opportunities$/i.test(paragraph)) continue

    const numberedMatch = paragraph.match(/^\d+\)\s*(.+)$/)
    if (numberedMatch) {
      if (currentRole) roles.push(currentRole)
      currentRole = {
        title: normalizeWhitespace(numberedMatch[1]),
        details: [],
      }
      continue
    }

    if (currentRole) {
      currentRole.details.push(paragraph)
    }
  }

  if (currentRole) roles.push(currentRole)

  if (roles.length === 0) {
    if (ZERO_JOBS_PATTERN.test(sectionText)) return []
    throw new Error('CRIAMOS verified careers page no longer exposes numbered public job openings')
  }

  return roles.map((role) => {
    const locationText = role.details
      .map((detail) => detail.match(/^Location:\s*(.+)$/i)?.[1] ?? null)
      .find(Boolean) ?? null

    const title = normalizeWhitespace(role.title)
    const jobId = `${SOURCE}-${slugify(title)}`

    if (!title || !jobId) {
      throw new Error('CRIAMOS verified careers page numbered job openings changed shape')
    }

    return {
      title,
      company: COMPANY,
      department: null,
      location: toLocation(locationText),
      city: toCity(locationText),
      state: null,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: null,
      experienceRequired: extractExperienceRequired(title),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: role.details.length > 0 ? role.details.join('\n') : null,
      remoteStatus: null,
    }
  })
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createCriamosEngineeringPvtLtdScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('CRIAMOS verified official homepage no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = extractPublicJobs(careersHtml)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: (overrideNow || now)(),
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createCriamosEngineeringPvtLtdScraper().run(options)

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
