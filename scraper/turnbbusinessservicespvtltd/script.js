import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'turnbbusinessservicespvtltd'
export const COMPANY = 'TurnB Business Services Pvt. Ltd'
export const CAREERS_URL = 'https://turnb.com/career'
export const INDIA_APPLY_EMAIL = 'careers@turnb.com'

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

const buildAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const extractTabHtml = (html, tabId, nextTabId = null) => {
  const page = String(html ?? '')
  const marker = `id="nav-${tabId}"`
  const startIndex = page.indexOf(marker)
  if (startIndex < 0) return null

  const endIndex = nextTabId ? page.indexOf(`id="nav-${nextTabId}"`, startIndex + marker.length) : -1
  return endIndex >= 0 ? page.slice(startIndex, endIndex) : page.slice(startIndex)
}

const extractApplyUrl = (tabHtml) => {
  const emailMatch = String(tabHtml ?? '').match(/mailto:([^"'\s>]+)/i)
  return emailMatch ? `mailto:${emailMatch[1].toLowerCase()}` : null
}

const hasRoleCardSignal = (tabHtml) =>
  /uploads\/media\//i.test(String(tabHtml ?? '')) && /Know More/i.test(String(tabHtml ?? ''))

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = (stripTags(page) || '').toLowerCase()

  return text.includes('careers at turnb')
    && text.includes('why work with turnb')
    && text.includes('great place to work certified organization')
    && /data-bs-target="#nav-India"/i.test(page)
    && /data-bs-target="#nav-UAE"/i.test(page)
    && /mailto:careers@turnb\.com/i.test(page)
}

export const extractPublicListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Expected verified TurnB careers surface with official India tab and apply handoff')
  }

  const indiaTabHtml = extractTabHtml(html, 'India', 'UAE')
  const applyUrl = extractApplyUrl(indiaTabHtml)

  if (!indiaTabHtml || applyUrl !== `mailto:${INDIA_APPLY_EMAIL}`) {
    throw new Error('Expected verified TurnB careers surface with official India tab and apply handoff')
  }

  const jobs = [...String(indiaTabHtml).matchAll(
    /<h3\b[^>]*>\s*([^<]+?)\s*<\/h3>[\s\S]*?<a\b[^>]*href="([^"]+\.pdf)"[^>]*>[\s\S]*?<\/a>/gi,
  )].map((match) => {
    const title = normalizeWhitespace(match[1])
    const sourceUrl = buildAbsoluteUrl(match[2], CAREERS_URL)
    const jobKey = slugify(`${title} india`)

    if (!title || !sourceUrl || !jobKey) return null

    return {
      title,
      company: COMPANY,
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: `${SOURCE}-${jobKey}`,
      requisitionId: `${SOURCE}-${jobKey}`,
      sourceUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
      companyCareerPage: CAREERS_URL,
      atsPlatform: 'official-company-careers',
    }
  }).filter(Boolean)

  if (jobs.length === 0 && hasRoleCardSignal(indiaTabHtml)) {
    throw new Error('Expected verified TurnB India role-card structure with first-party PDF links')
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

export const createTurnBScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    return extractPublicListings(careersHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createTurnBScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total TurnB India jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
