import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'insolareenergy'
export const COMPANY = 'InSolare Energy'
export const HOMEPAGE_URL = 'https://insolare.com/'
export const CAREERS_URL = 'https://insolare.com/careers/'
export const APPLICATION_EMAIL = 'hr@insolare.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const extractCareersUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const absoluteUrl = new URL(match[1], HOMEPAGE_URL).toString()
      if (absoluteUrl === CAREERS_URL) return absoluteUrl
    } catch {
      // Ignore malformed href values in the page shell.
    }
  }

  return null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title[^>]*>\s*Home\s*-\s*Insolare Energy\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/insolare\.com\/["']/i.test(page)
    && /InSolare Energy is a leading renewable energy company in India/i.test(normalized || '')
    && /Solar Power Unleashed/i.test(normalized || '')
    && extractCareersUrl(page) === CAREERS_URL
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title[^>]*>\s*Careers\s*-\s*Insolare Energy\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/insolare\.com\/careers\/["']/i.test(page)
    && /Why Work at InSolare\?/i.test(normalized || '')
    && /Current Openings/i.test(normalized || '')
    && /Browse our open roles below or send your resume to/i.test(normalized || '')
    && /mailto:hr@insolare\.com/i.test(page)
    && /class=["']wpcf7 no-js["']/i.test(page)
    && /data-name=["']job_designation["']/i.test(page)
    && /<select[^>]+name=["']job_designation["']/i.test(page)
    && /Apply Now to Join Us|careers-form/i.test(page)
  }

export const extractRoleTitles = (html) => {
  const page = String(html ?? '')
  const selectMatch = page.match(
    /<select[^>]+name=["']job_designation["'][^>]*>([\s\S]*?)<\/select>/i,
  )

  if (!selectMatch) return []

  return [...selectMatch[1].matchAll(/<option[^>]*value=["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi)]
    .map(([, value, label]) => normalizeWhitespace(value || label))
    .filter((option) => option && !/^role$/i.test(option))
}

const buildJobDescription = (title) => normalizeWhitespace(
  `${title} is listed on the verified InSolare Energy careers page through the first-party application form. `
  + `Apply through ${CAREERS_URL} or contact ${APPLICATION_EMAIL}.`,
)

const buildJobs = (titles) => titles.map((title) => {
  const slug = slugify(title)

  return {
    title,
    company: COMPANY,
    department: null,
    location: 'India',
    city: null,
    country: 'India',
    jobId: `${SOURCE}-${slug}`,
    requisitionId: `${SOURCE}-${slug}`,
    sourceUrl: CAREERS_URL,
    applyUrl: CAREERS_URL,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription(title),
  }
})

export const createInsolareEnergyScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('InSolare Energy verified official homepage no longer matches the known careers handoff')
    }

    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('InSolare Energy verified careers page no longer matches the known first-party role picker')
    }

    const roleTitles = extractRoleTitles(careersHtml)

    if (roleTitles.length < 4) {
      throw new Error('InSolare Energy public role options no longer match the verified first-party careers form')
    }

    return buildJobs(roleTitles).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createInsolareEnergyScraper().run(options)

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
