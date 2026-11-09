import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'technologicsglobalprojectsrdlab'
export const COMPANY = 'Technologics Global Projects & R&D Lab'
export const HOMEPAGE_URL = 'https://technologics.in/'
export const JOBS_PAGE_URL = 'https://technologics.in/jobs/'
export const PAGE_SITEMAP_URL = 'https://technologics.in/page-sitemap.xml'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const SAME_DOMAIN_HOSTS = new Set([
  'technologics.in',
  'www.technologics.in',
])

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&apos;/gi, "'")
  .replace(/&rsquo;|&lsquo;/gi, "'")
  .replace(/&rdquo;|&ldquo;/gi, '"')
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/&hellip;/gi, '...')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .replace(/\s+([,.;:!?])/g, '$1')
  .trim()

const normalizeLine = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractMainHtml = (html) => {
  const match = String(html ?? '').match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)
  return match ? match[1] : String(html ?? '')
}

const htmlToLines = (html) => decodeHtmlEntities(html)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|h1|h2|h3|h4|li|section|article|main|ul|ol)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\[(?:\/)?[^\]]+\]/g, ' ')
  .split('\n')
  .map((line) => normalizeLine(line))
  .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const isSameOfficialDomain = (value) => {
  try {
    return SAME_DOMAIN_HOSTS.has(new URL(value || HOMEPAGE_URL).hostname.toLowerCase())
  } catch {
    return false
  }
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
    .replace(/\s*\/\s*/g, ' / ')
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return null

  return normalized.replace(/\b[a-z]/g, (char) => char.toUpperCase())
}

const extractFirstMatch = (value, pattern) => {
  const match = String(value ?? '').match(pattern)
  return match ? normalizeWhitespace(match[1]) : null
}

const extractPostingText = (html) => {
  const lines = htmlToLines(extractMainHtml(html))
    .filter((line) => !/^job description$/i.test(line))

  return {
    lines,
    text: normalizeWhitespace(lines.join(' ')),
  }
}

const extractApplyUrl = (html, fallbackUrl) => {
  const mainHtml = decodeHtmlEntities(extractMainHtml(html))

  return extractFirstMatch(mainHtml, /\[sf_button[^\]]*link=["']\s*(https?:\/\/[^"']+)["']/i)
    || extractFirstMatch(mainHtml, /href=["']\s*(https?:\/\/[^"']+)["'][^>]*>\s*register/i)
    || normalizeWhitespace(fallbackUrl)
}

const defaultFetchText = (url) => withRetry(async () => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}, {
  attempts: 3,
  baseDelayMs: 2000,
  label: SOURCE,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const hasCareersEntryLink = /href=["']https:\/\/technologics\.in\/(?:jobs|careers)\/?["']/i.test(page)

  return /<title>\s*No\.1 PLC SCADA Training Institute In Bangalore\s*<\/title>/i.test(page)
    && hasCareersEntryLink
    && /href=["']https:\/\/technologics\.in\/lab\/["']/i.test(page)
    && /href=["']https:\/\/technologics\.in\/about-us\/["']/i.test(page)
    && normalized.includes('For Immediate Assistance Call Us +919738171920')
    && /TECHNOLOGICS/i.test(page)
}

export const hasOfficialJobsPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Jobs - Technologics\b/i.test(page)
    && /href=["']https:\/\/technologics\.in\/jobs\/["']/i.test(page)
    && /href=["']https:\/\/technologics\.in\/lab\/["']/i.test(page)
    && /<h1[^>]*>\s*Jobs\s*<\/h1>/i.test(page)
    && normalized.includes('[jobpost]')
}

export const extractCandidateJobUrls = (sitemapXml) => {
  const matches = [...String(sitemapXml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)]

  return matches
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
    .filter((url) => isSameOfficialDomain(url))
    .filter((url) => /\b(career|careers|job|jobs)\b/i.test(url))
    .filter((url, index, urls) => urls.indexOf(url) === index)
}

export const isJobPostingPage = ({ url, html } = {}) => {
  if (!isSameOfficialDomain(url)) {
    return false
  }

  const { text } = extractPostingText(html)
  return /designation\s*:/i.test(text)
    && /work location\b/i.test(text)
    && /no of openings\s*:/i.test(text)
}

const extractRequiredSkills = (text) => {
  const skills = []

  if (/programming knowledge/i.test(text)) {
    skills.push('Programming knowledge')
  }

  if (/good english communication/i.test(text)) {
    skills.push('Good English communication')
  }

  return skills
}

export const extractJobFromPostingPage = ({ url, html } = {}) => {
  const { lines, text } = extractPostingText(html)
  const title = extractFirstMatch(text, /designation\s*:\s*([^.]+)\.?/i)
  const location = normalizeLocation(
    extractFirstMatch(
      text,
      /work location\s*[-:]\s*([^.]+?)(?:\.\s|no of openings\s*:|1st interview\s*:|2nd interview\s*:|interview location\s*:|eligibility criteria\s*:|$)/i,
    ),
  )
  const minimumQualification = lines
    .map((line) => extractFirstMatch(line, /education\s*:\s*(.+)$/i))
    .find(Boolean)
    || null
  const applyUrl = extractApplyUrl(html, url)

  const jobId = `${slugify(url?.split('/').filter(Boolean).pop() || 'posting')}::${slugify(title || 'unknown-role')}`

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city: null,
    country: null,
    jobId,
    requisitionId: jobId,
    sourceUrl: normalizeWhitespace(url),
    applyUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification,
    preferredQualification: null,
    requiredSkills: extractRequiredSkills(text),
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeLine(lines.join(' ')),
  }
}

export const createTechnologicsGlobalProjectsRDLabScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Technologics homepage no longer matches the verified first-party public surface')
    }

    const jobsPageHtml = await fetchText(JOBS_PAGE_URL)
    if (!hasOfficialJobsPageSignal(jobsPageHtml)) {
      throw new Error('Technologics jobs page no longer matches the verified first-party public surface')
    }

    const pageSitemapXml = await fetchText(PAGE_SITEMAP_URL)
    const candidateUrls = extractCandidateJobUrls(pageSitemapXml)
    const jobs = []

    for (const candidateUrl of candidateUrls) {
      const pageHtml = await fetchText(candidateUrl)
      if (!isJobPostingPage({ url: candidateUrl, html: pageHtml })) {
        continue
      }

      const job = extractJobFromPostingPage({ url: candidateUrl, html: pageHtml })

      jobs.push({
        ...job,
        source: SOURCE,
        link: job.applyUrl || candidateUrl,
        scrapedAt: new Date().toISOString(),
      })

      if (maxJobs && jobs.length >= maxJobs) {
        break
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createTechnologicsGlobalProjectsRDLabScraper().run(options)

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
