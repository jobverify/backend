import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mosillubricantspvtltd'
export const COMPANY = 'Mosil Lubricants Pvt.Ltd.'
export const HOMEPAGE_URL = 'https://mosil.com/'
export const CAREERS_URL = 'https://mosil.com/careers'
export const COMPANY_DOMAIN = 'mosil.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_ERROR =
  'MOSIL verified official homepage no longer matches the trusted first-party surface'
const CAREERS_ERROR =
  'MOSIL verified first-party careers page no longer matches the known public surface'
const OPTIONS_ERROR = 'MOSIL verified public position options changed shape'

const EXPECTED_POSITION_OPTIONS = [
  'Sales Team - PAN India',
  'Technical Support Team - Navi Mumbai',
  'RD and QC Team - Navi Mumbai',
  'Operations Team - Navi Mumbai',
  'Accounts and Finance Team - Mumbai',
  'HR and Admin Team - Navi Mumbai',
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/[‐‑‒–—−]+/g, '-')
  .replace(/\s*-\s*/g, ' - ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Custom\s*&(?:amp;)?\s*Specialty Lubricants Manufacturer\s*\|\s*MOSIL(?:\s+Lubricants)?\s*<\/title>/i.test(page)
    && /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/mosil\.com\/["']/i.test(page)
    && /"name"\s*:\s*"MOSIL Lubricants Pvt\. Ltd\."/i.test(page)
    && /href=["'](?:https:\/\/mosil\.com\/careers|https:\/\/www\.mosil\.com\/careers|\/careers)["']/i.test(page)
    && /three advanced manufacturing units/i.test(text)
    && /Navi Mumbai/i.test(text)
    && /(Research\s*&\s*Development\s*&\s*QA Lab|R&D is the engine driving every innovation)/i.test(text)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Careers\s*-\s*Join Our Team\s*\|\s*MOSIL\s*<\/title>/i.test(page)
    && /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/mosil\.com\/careers["']/i.test(page)
    && /Fuel Your Future With Us!/i.test(text)
    && /<form[^>]+id=["']careerForm["'][^>]+data-url=["']https:\/\/mosil\.com\/ajax\/career\.php["']/i.test(page)
    && /<select[^>]+name=["']position["'][^>]+id=["']positionSelect["']/i.test(page)
    && /<input[^>]+type=["']file["'][^>]+name=["']resume["']/i.test(page)
    && />\s*Upload\s*</i.test(page)
    && />\s*Send\s*</i.test(page)
}

const extractPositionOptions = (html) => {
  const selectHtml = String(html ?? '').match(
    /<select[^>]+name=["']position["'][^>]+id=["']positionSelect["'][^>]*>([\s\S]*?)<\/select>/i,
  )?.[1]

  if (!selectHtml) {
    throw new Error(OPTIONS_ERROR)
  }

  return [...selectHtml.matchAll(/<option[^>]*>([\s\S]*?)<\/option>/gi)]
    .map((match) => normalizeWhitespace(stripTags(match[1])))
    .filter(Boolean)
    .filter((value) => !/^Position$/i.test(value))
}

const parseOptionLabel = (value) => {
  const normalized = normalizeWhitespace(value)
  const parts = normalized.split(/\s-\s/)

  if (parts.length < 2) {
    throw new Error(OPTIONS_ERROR)
  }

  const location = parts.pop()
  const title = parts.join(' - ')

  if (!title || !location) {
    throw new Error(OPTIONS_ERROR)
  }

  return { title, location }
}

const mapCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /^PAN India$/i.test(normalized)) {
    return null
  }

  return normalized
}

export const extractPublicJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error(CAREERS_ERROR)
  }

  const positionOptions = extractPositionOptions(html)
  if (
    positionOptions.length !== EXPECTED_POSITION_OPTIONS.length
    || positionOptions.some((value, index) => value !== EXPECTED_POSITION_OPTIONS[index])
  ) {
    throw new Error(OPTIONS_ERROR)
  }

  return positionOptions.map((label) => {
    const { title, location } = parseOptionLabel(label)
    const jobId = `${SOURCE}-${slugify(label)}`

    return {
      title,
      company: COMPANY,
      department: title,
      location,
      city: mapCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: `${CAREERS_URL}#${jobId}`,
      applyUrl: CAREERS_URL,
      employmentType: null,
      workplaceType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: normalizeWhitespace(
        `Public MOSIL careers position option: ${label}. `
          + 'Apply via the official MOSIL careers page and upload your resume through the shared resume upload form.',
      ),
      publicExperienceChecked: true,
    }
  })
}

export const createMosilLubricantsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error(HOMEPAGE_ERROR)
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

export const run = async (options = {}) => createMosilLubricantsScraper().run(options)

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
