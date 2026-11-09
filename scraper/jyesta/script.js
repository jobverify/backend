import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'jyesta'
export const COMPANY = 'Jyesta Corporate Entity'
export const HOMEPAGE_URL = 'https://www.jyesta.com/'
export const CAREERS_URL = 'https://www.jyesta.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? '')).replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Jyesta Corporate Entity\s*<\/title>/i.test(page)
    && /<a[^>]+href=["']\/careers["'][^>]*>\s*Careers\s*<\/a>/i.test(page)
    && /<a[^>]+href=["']\/job-portal["'][^>]*>\s*Job Portal\s*<\/a>/i.test(page)
    && /Molecule LMS/i.test(text)
    && /info@jyesta\.com/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Jyesta Corporate Entity\s*<\/title>/i.test(page)
    && /We['’]re hiring across India/i.test(text)
    && /Careers at Jyesta/i.test(text)
    && /Open Positions/i.test(text)
    && /View job description/i.test(text)
    && /Showing\s+\d+\s+roles?/i.test(text)
}

const extractReportedRoleCount = (html) => {
  const text = stripTags(html)
  const match = text.match(/Showing\s+(\d+)\s+roles?/i)
  return match ? Number.parseInt(match[1], 10) : null
}

const JOB_CARD_PATTERN =
  /<p\b[^>]*text-base[^>]*>([^<]+)<\/p>\s*<div\b[^>]*>([^<]+)<\/div>[\s\S]*?<p\b[^>]*text-sm[^>]*>([\s\S]*?)<\/p>[\s\S]*?<span\b[^>]*>[\s\S]*?([A-Za-z][^<]*,\s*India)<\/span>[\s\S]*?<span\b[^>]*>[\s\S]*?(On-site|Remote|Hybrid)<\/span>[\s\S]*?<span\b[^>]*>[\s\S]*?(Internship|Full-time|Part-time|Contract)<\/span>[\s\S]*?aria-controls=["']([^"']+)["']/gi

export const extractPublicJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Jyesta verified first-party careers page no longer matches the known public shell')
  }

  const jobs = [...String(html ?? '').matchAll(JOB_CARD_PATTERN)].map((match) => {
    const [
      ,
      rawTitle,
      rawDepartment,
      rawDescription,
      rawLocation,
      rawWorkplaceType,
      rawEmploymentType,
      rawControlId,
    ] = match

    const title = stripTags(rawTitle)
    const department = stripTags(rawDepartment)
    const location = stripTags(rawLocation)
    const workplaceType = stripTags(rawWorkplaceType)
    const employmentType = stripTags(rawEmploymentType)
    const controlId = stripTags(rawControlId)
    const jobDescription = stripTags(rawDescription)
    const city = location.replace(/,\s*India$/i, '')
    const jobId = `jyesta-${slugify(`${title}-${city}`)}`
    const sourceUrl = `${CAREERS_URL}#${controlId}`

    if (!title || !department || !location || !employmentType || !workplaceType || !controlId) {
      throw new Error('Jyesta verified careers job cards changed shape')
    }

    return {
      title,
      company: COMPANY,
      department,
      location,
      city,
      country: 'India',
      jobId,
      requisitionId: controlId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType,
      workplaceType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
    }
  })

  if (jobs.length === 0) {
    throw new Error('Jyesta verified careers job cards changed shape')
  }

  const reportedRoleCount = extractReportedRoleCount(html)
  if (Number.isFinite(reportedRoleCount) && reportedRoleCount !== jobs.length) {
    throw new Error('Jyesta verified careers job cards changed shape')
  }

  return jobs.sort((left, right) => left.title.localeCompare(right.title))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createJyestaScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Jyesta verified official homepage no longer matches the known first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = extractPublicJobs(careersHtml)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: (overrideNow || now)(),
      companyCareerPage: CAREERS_URL,
      companyDomain: 'jyesta.com',
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createJyestaScraper().run(options)

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
