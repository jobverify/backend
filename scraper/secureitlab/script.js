import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'secureitlab'
export const COMPANY = 'SecureITLab'
export const CAREERS_URL = 'https://secureitlab.com/careers'
export const APPLICATION_EMAIL = 'work@secureitlab.com'
export const APPLICATION_URL = `mailto:${APPLICATION_EMAIL}`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(value)
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/ul|\/ol|\/h[1-6]|\/span)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|section|article|ul|ol|h[1-6]|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const normalizeApplyUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /^mailto:/i.test(normalized)
    ? `mailto:${normalized.replace(/^mailto:/i, '').toLowerCase()}`
    : normalized
}

const normalizeSkills = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return []

  return normalized
    .replace(/\.$/, '')
    .split(/\s*,\s*/)
    .map((skill) => normalizeWhitespace(skill?.replace(/\.$/, '')))
    .filter(Boolean)
}

export const hasOfficialCareersSurface = (html) => {
  const page = String(html ?? '')
  const text = (stripTags(page) || '').toLowerCase()

  return /<title>\s*Careers\s*-\s*SecureItLab\s*<\/title>/i.test(page)
    && text.includes('open job position')
    && text.includes('as a remote first company secureitlab embraces the flexibility')
    && /mailto:work@secureitlab\.com/i.test(page)
}

const CARD_PATTERN = /<div class="card-job\b[^>]*>[\s\S]*?<h5>([\s\S]*?)<\/h5>[\s\S]*?<h6\b[^>]*>\s*Role:\s*<\/h6>\s*<span\b[^>]*>([\s\S]*?)<\/span>[\s\S]*?<h6\b[^>]*>\s*Skills:\s*<\/h6>\s*<span\b[^>]*>([\s\S]*?)<\/span>[\s\S]*?<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi

export const extractOpenPositions = (html) => {
  if (!hasOfficialCareersSurface(html)) {
    throw new Error('Expected verified SecureITLab careers surface with remote-first role cards and official apply handoff')
  }

  const jobs = [...String(html ?? '').matchAll(CARD_PATTERN)].map((match) => {
    const title = normalizeWhitespace(match[1])
    const jobDescription = normalizeWhitespace(match[2])
    const requiredSkills = normalizeSkills(match[3])
    const applyUrl = normalizeApplyUrl(match[4])
    const jobId = slugify(title)

    if (!title || !jobId || !jobDescription || applyUrl !== APPLICATION_URL) return null

    return {
      title,
      company: COMPANY,
      department: null,
      location: 'Remote',
      city: null,
      state: null,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription,
      publicExperienceChecked: true,
      remoteStatus: 'Remote',
    }
  }).filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('Expected verified SecureITLab role-card listings with the official shared apply email')
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

export const createSecureItLabScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    return extractOpenPositions(careersHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createSecureItLabScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total SecureITLab jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
