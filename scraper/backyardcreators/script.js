import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'backyardcreators'
export const COMPANY = 'BACKYARD CREATORS'
export const HOMEPAGE_URL = 'https://www.backyardcreators.com/'
export const CAREERS_URL = 'https://www.backyardcreators.com/careers'

const COMPANY_DOMAIN = 'backyardcreators.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const ZERO_JOBS_PATTERN = /\b(no current openings|no open positions|no jobs available|check back later)\b/i
const CARD_CLASS =
  'border rounded-lg p-4 shadow hover:shadow-lg cursor-pointer transition duration-200 ease-in-out'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#8211;|&ndash;|[\u2013\u2014]/g, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&#039;|&#39;|&apos;|&rsquo;|&#8217;|[\u2018\u2019]/g, "'")
  .replace(/&ldquo;|&rdquo;|&quot;|[\u201c\u201d]/g, '"')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const countMatches = (value, pattern) => [...String(value ?? '').matchAll(pattern)].length

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/^full[\s-]?time$/i.test(normalized)) return 'Full-time'
  if (/^part[\s-]?time$/i.test(normalized)) return 'Part-time'
  if (/^intern(ship)?$/i.test(normalized)) return 'Internship'
  if (/^contract$/i.test(normalized)) return 'Contract'
  return normalized
}

const extractCardSegments = (html) => [...String(html ?? '').matchAll(
  new RegExp(`<div class="${CARD_CLASS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">([\\s\\S]*?)<\\/div>`, 'gi'),
)]
  .map((match) => match[1])
  .filter(Boolean)

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return (
    /<title>\s*Backyard Creators\s*<\/title>/i.test(page)
    && /meta name="description" content="Redefining Hearing Through Non-Invasive Bionic ear"/i.test(page)
    && /Redefining Hearing Through\s*Non-Invasive/i.test(text)
    && /Backyard Creators Private Limited/i.test(text)
    && /AIC Raise,\s*Eachanari,\s*Coimbatore/i.test(text)
    && /href="\/careers"/i.test(page)
  ) || (
    /Backyard Creators/i.test(text)
    && /Non-invasive electromagnetic platform/i.test(text)
    && /Pursuing hearing with steerable electromagnetic fields/i.test(text)
    && /Backyard Creators is developing a non-invasive approach to restore hearing/i.test(text)
    && /Talk to us/i.test(text)
  )
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Backyard Creators\s*<\/title>/i.test(page)
    && /Don['’]t work at Backyard Creators,\s*Just build different/i.test(text)
    && /Multiphysics Simulation Expert/i.test(text)
    && /Research\s*&\s*Development/i.test(text)
    && /\bFull Time\b/i.test(text)
    && /Backyard Creators Private Limited/i.test(text)
    && /href="\/careers"/i.test(page)
    && countMatches(page, new RegExp(`<div class="${CARD_CLASS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">`, 'gi')) >= 1
}

export const extractPublicJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Backyard Creators verified first-party careers page no longer matches the known public shell')
  }

  const cards = extractCardSegments(html)
  if (cards.length === 0) {
    if (ZERO_JOBS_PATTERN.test(stripTags(html))) {
      return []
    }

    throw new Error('Backyard Creators verified first-party careers page no longer exposes public job cards')
  }

  const jobs = cards.map((cardHtml) => {
    const title = normalizeWhitespace(cardHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? '')
    const department = stripTags(cardHtml.match(/<h6[^>]*>([\s\S]*?)<\/h6>/i)?.[1] ?? '')
    const employmentType = normalizeEmploymentType(
      stripTags(cardHtml.match(/<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? ''),
    )

    if (!title || !department || !employmentType) {
      throw new Error('Backyard Creators verified first-party careers job cards changed shape')
    }

    const jobId = `${SOURCE}-${slugify(title)}`

    return {
      title,
      company: COMPANY,
      department,
      location: null,
      city: null,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl: null,
      employmentType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    }
  })

  return [...new Map(jobs.map((job) => [job.jobId, job])).values()]
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 1,
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const isLegacyCareersLinkedHomepage = (html = '') => /href="\/careers"/i.test(String(html ?? ''))
const isHomepageShellWithoutPublicCareers = (html = '') =>
  hasOfficialHomepageSignal(html) && !hasOfficialCareersSignal(html)

export const createBackyardCreatorsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchPage = defaultFetchPage,
    now: overrideNow,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Backyard Creators verified official homepage no longer matches the known first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status === 404 && !isLegacyCareersLinkedHomepage(homepageHtml)) {
      return []
    }

    const careersHtml = careersPage.status === 200
      ? careersPage.html
      : null

    if (
      !isLegacyCareersLinkedHomepage(homepageHtml)
      && isHomepageShellWithoutPublicCareers(careersHtml)
    ) {
      return []
    }

    const jobs = extractPublicJobs(careersHtml)

    return jobs.map((job) => normalizeScrapedJob({
      ...job,
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-company-careers',
      scrapedAt: (overrideNow || now)(),
    }, {
      companyName: COMPANY,
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-company-careers',
      countryFilter: 'India',
    }))
  },
})

export const run = async (options = {}) => createBackyardCreatorsScraper().run(options)

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
