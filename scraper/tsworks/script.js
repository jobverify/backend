import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'tsworks'
export const COMPANY = 'T-Works'
export const CAREERS_URL = 'https://tworks.telangana.gov.in/careers'
export const OPENINGS_URL = 'https://tworks.telangana.gov.in/openings'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/ul|\/ol|\/h[1-6]|\/span)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|section|article|ul|ol|h[1-6]|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const toAbsoluteUrl = (value, baseUrl = OPENINGS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const buildJobDescription = (title) => normalizeWhitespace(
  `Official ${COMPANY} job description PDF for ${title}. Review the first-party PDF and apply through the official T-Works openings form.`,
)

export const hasOfficialCareersSignal = (html) => {
  const text = stripTags(html) || ''

  return /Join Our Team/i.test(text)
    && /drive India's hardware innovation/i.test(text)
    && /Current Openings/i.test(text)
    && /Applications Open/i.test(text)
}

export const hasVerifiedClosedCareersSignal = (html) => {
  const page = String(html ?? '')
  const cards = [...page.matchAll(/&quot;title&quot;:\s*&quot;(Current Openings|Internships)&quot;[\s\S]*?&quot;buttonText&quot;:\s*&quot;([^&]+)&quot;[\s\S]*?&quot;buttonLink&quot;:\s*&quot;([^&]*)&quot;/gi)]
  return /<title>\s*Careers\s*\|\s*T-Works\s*<\/title>/i.test(page)
    && /drive India(?:&#39;|&apos;|')s hardware innovation/i.test(page)
    && /<h2[^>]*>Current Openings<\/h2>/i.test(page)
    && cards.length === 2
    && new Set(cards.map(match => match[1])).size === 2
    && cards.every(match => match[2] === 'APPLICATIONS CLOSED' && match[3] === '')
    && !/Applications Open/i.test(page)
}

export const extractOpeningsUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = stripTags(match[2]) || ''
    if (/Applications Open/i.test(text)) {
      return toAbsoluteUrl(match[1], CAREERS_URL)
    }
  }

  return null
}

export const hasOfficialOpeningsSignal = (html) => {
  const text = stripTags(html) || ''

  return /Job openings/i.test(text)
    && /Application Form/i.test(text)
    && /T-Works/i.test(text)
    && /Job Description/i.test(text)
}

export const extractPublicOpenings = (html) => {
  if (!hasOfficialOpeningsSignal(html)) {
    throw new Error('T-Works openings page no longer matches the verified official public jobs surface')
  }

  const jobs = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const anchorText = stripTags(match[2]) || ''
    if (!/Job Description/i.test(anchorText)) continue

    const title = normalizeWhitespace(anchorText.replace(/\s*-\s*Job Description\s*$/i, ''))
    const sourceUrl = toAbsoluteUrl(match[1], OPENINGS_URL)
    const requisitionId = `${SOURCE}-${slugify(title)}`

    if (!title || !sourceUrl || !requisitionId || seen.has(requisitionId)) continue
    seen.add(requisitionId)

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: requisitionId,
      requisitionId,
      sourceUrl,
      applyUrl: OPENINGS_URL,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: buildJobDescription(title),
    })
  }

  if (jobs.length === 0) {
    throw new Error('T-Works openings page no longer exposes the expected public PDF job links')
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

export const createTsworksScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (hasVerifiedClosedCareersSignal(careersHtml)) {
      return attachInventoryEvidence([], {
        status: 'verified-empty',
        surface: CAREERS_URL,
        firstParty: true,
        listingComplete: true,
        pagesFetched: 1,
        reportedTotal: 0,
        indiaFacetCount: 0,
        verifiedAt: now(),
        reason: 'tsworks-current-openings-and-internships-applications-closed',
      })
    }
    const openingsUrl = extractOpeningsUrl(careersHtml)

    if (!hasOfficialCareersSignal(careersHtml) || openingsUrl !== OPENINGS_URL) {
      throw new Error('T-Works verified official careers surface no longer links to the expected openings page')
    }

    const openingsHtml = await fetchText(OPENINGS_URL)

    return extractPublicOpenings(openingsHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createTsworksScraper().run(options)

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
