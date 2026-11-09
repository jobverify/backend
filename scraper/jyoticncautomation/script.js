import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'jyoticncautomation'
export const COMPANY = 'Jyoti CNC Automation Limited'
export const CAREERS_URL = 'https://jyoti.co.in/career/'
export const APPLY_URL = 'https://jyoti.co.in/apply-now/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;|–|—/g, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const extractField = (sectionHtml, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const headingValueMatch = sectionHtml.match(
    new RegExp(
      `<h[1-6][^>]*>[\\s\\S]*?${escapedLabel}[\\s\\S]*?<\\/h[1-6]>\\s*<(?:div|p)[^>]*>([\\s\\S]*?)<\\/(?:div|p)>`,
      'i',
    ),
  )
  if (headingValueMatch) {
    return stripTags(headingValueMatch[1])
  }

  const inlineValueMatch = sectionHtml.match(
    new RegExp(
      `<(?:div|p|li)[^>]*>\\s*${escapedLabel}\\s*:?(?:\\s|&nbsp;)+([\\s\\S]*?)<\\/(?:div|p|li)>`,
      'i',
    ),
  )

  return stripTags(inlineValueMatch?.[1])
}

const normalizeLocation = (value) => {
  const normalized = stripTags(value)
  if (!normalized) return null

  const parenthesized = normalized.match(/^\(([^)]+)\)/)?.[1]
  const cleaned = normalizeWhitespace(parenthesized || normalized)
    ?.replace(/\s*\/\s*/g, ' / ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*\.\s*$/, '')

  if (!cleaned) return null
  return /\bindia\b/i.test(cleaned) ? cleaned : `${cleaned}, India`
}

const isCanonicalCityToken = (value) => Boolean(CANONICAL_CITIES[String(value ?? '').trim().toLowerCase()])

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)?.replace(/,\s*India$/i, '')
  if (!normalized) return null

  const tokens = normalized
    .split(/\s*(?:,|\/)\s*/)
    .map((token) => normalizeWhitespace(token))
    .filter(Boolean)

  if (tokens.length === 0) return null
  if (tokens.length === 1) return normalizeCity(tokens[0])

  const [firstToken, secondToken] = tokens
  if (!isCanonicalCityToken(firstToken) && secondToken) {
    return normalizeCity(secondToken)
  }

  return normalizeCity(firstToken)
}

const normalizeTitle = (rawTitle, department) => {
  const normalized = stripTags(rawTitle)
  if (!normalized) return null

  const departmentPattern = department
    ? department.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    : null

  const titleWithoutDepartment = departmentPattern
    ? normalized.replace(new RegExp(`\\s+Department\\s+${departmentPattern}\\s*$`, 'i'), '')
    : normalized.replace(/\s+Department\b[\s\S]*$/i, '')

  return normalizeWhitespace(titleWithoutDepartment)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<h[1-6][^>]*>\s*Current Openings\s*<\/h[1-6]>/i.test(page)
    && /Apply Now/i.test(text)
    && /Email Resume to/i.test(text)
    && /jyoti\.co\.in/i.test(page)
}

export const extractOpenings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Jyoti CNC Automation careers page no longer matches the verified official public careers surface')
  }

  const sections = [...String(html ?? '').matchAll(
    /<h4[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h4\b|<\/main>|<\/body>)/gi,
  )]

  const jobs = []
  const seen = new Set()

  for (const [, rawHeading, sectionHtml] of sections) {
    const department = extractField(sectionHtml, 'Department')
    const title = normalizeTitle(rawHeading, department)
    const location = normalizeLocation(extractField(sectionHtml, 'Job Location'))

    if (!title || !department || !location) continue

    const dedupeKey = `${title}::${location}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    jobs.push({
      title,
      department,
      location,
      city: deriveCity(location),
      experienceRequired: extractField(sectionHtml, 'Experience'),
      minimumQualification: extractField(sectionHtml, 'Qualification'),
      sourceUrl: CAREERS_URL,
      applyUrl: APPLY_URL,
      remoteStatus: 'On-site',
    })
  }

  if (jobs.length === 0) {
    throw new Error('Jyoti CNC Automation verified public openings changed or disappeared')
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createJyotiCncAutomationScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    return extractOpenings(html).map((job) => {
      const identitySlug = slugify(`${job.title}-${job.location}`)

      return {
        ...job,
        company: COMPANY,
        country: 'India',
        jobId: `${SOURCE}-${identitySlug}`,
        requisitionId: `${SOURCE}-${identitySlug}`,
        employmentType: null,
        requiredSkills: [],
        preferredQualification: null,
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      }
    })
  },
})

export const run = async (options = {}) => createJyotiCncAutomationScraper().run(options)

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
