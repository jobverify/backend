import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { publicPostingDescription } from '../../rewriting/publicPostingDescription.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'planetspark'
export const COMPANY = 'PlanetSpark'
export const CAREERS_URL = 'https://www.planetspark.in/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const REMOTE_PATTERN = /\bwork\s*from\s*home\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTagsToLines = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\r/g, '')
  .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/main|\/h[1-6]|\/a)\b[^>]*>/gi, '\n')
  .replace(/<(p|div|li|section|article|main|h[1-6]|a)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/[ \t\f\v]+/g, ' ')
  .replace(/\n+/g, '\n')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const deriveCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || REMOTE_PATTERN.test(normalized)) return null

  const primaryLocation = normalized
    .split('(')[0]
    .split('·')[0]
    .trim()

  return normalizeCity(primaryLocation || normalized)
}

const findMetadataValue = (lines, prefix) => {
  const pattern = new RegExp(`^${prefix}\\b`, 'i')
  const index = lines.findIndex((entry) => pattern.test(entry))
  if (index < 0) return null

  const inlineValue = normalizeWhitespace(lines[index]?.replace(pattern, ''))
  if (inlineValue) return inlineValue

  return normalizeWhitespace(lines[index + 1] || null)
}

const getVerifiedRolesSection = (html) => String(html ?? '').match(
  /We(?:'|’|&#39;|&rsquo;|&#x2019;)?re[\s\S]*?hiring[\s\S]*?for these[\s\S]*?roles([\s\S]*?)For job application related queries/i,
)?.[1] || null

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTagsToLines(page).join(' ')

  return /PlanetSpark/i.test(page)
    && /Explore a career/i.test(text)
    && /We(?:'|’)?re hiring for these roles/i.test(text)
    && /View\s*&\s*Apply/i.test(text)
    && /teach@planetspark\.in/i.test(text)
}

export const extractRoleCards = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('PlanetSpark careers page no longer matches the verified official public careers surface')
  }

  const rolesSection = getVerifiedRolesSection(html)
  if (!rolesSection) {
    throw new Error('PlanetSpark careers page no longer exposes the verified public roles section')
  }

  const jobs = rolesSection
    .split(/View\s*&(?:amp;)?\s*Apply/gi)
    .map((chunk) => {
      const title = normalizeWhitespace(chunk.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/i)?.[1])
      if (!title) return null

      const lines = stripTagsToLines(chunk)
      const rawLocation = findMetadataValue(lines, 'location_on')
      const experienceRequired = findMetadataValue(lines, 'calendar_today')

      if (!rawLocation || !experienceRequired) return null

      return {
        title,
        location: normalizeLocation(rawLocation),
        city: deriveCity(rawLocation),
        employmentType: findMetadataValue(lines, 'access_time'),
        experienceRequired,
        sourceUrl: CAREERS_URL,
        applyUrl: CAREERS_URL,
      }
    })
    .filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('PlanetSpark careers page no longer exposes verified public role cards')
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

export const createPlanetSparkScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    return extractRoleCards(html).map((job) => {
      const identitySlug = slugify(`${job.title}-${job.location}`)

      const currentJob = {
        ...job,
        company: COMPANY,
        department: null,
        country: 'India',
        jobId: `${SOURCE}-${identitySlug}`,
        requisitionId: `${SOURCE}-${identitySlug}`,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      }
      const posting = publicPostingDescription(currentJob, html, CAREERS_URL)
      return { ...currentJob, sourceDescription: posting?.description ?? null,
        jobDescription: posting?.description ?? null }
    })
  },
})

export const run = async (options = {}) => createPlanetSparkScraper().run(options)

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
