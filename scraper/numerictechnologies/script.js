import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'numerictechnologies'
export const COMPANY = 'Numeric Technologies'
export const COMPANY_DOMAIN = 'numerictech.com'
export const HOMEPAGE_URL = 'https://numerictech.com/'
export const PAGE_SITEMAP_URL = 'https://numerictech.com/page-sitemap.xml'
export const CAREERS_URL = 'https://numerictech.com/careers/united-states/'
export const APPLY_EMAIL = 'jobs@numerictech.com'
export const APPLY_URL = `mailto:${APPLY_EMAIL}`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const MONTHS = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
}

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/header)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|section|article|header)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const buildPostingId = (title) => {
  const slug = slugify(title)
  return slug ? `${SOURCE}-${slug}` : null
}

const buildLocation = (city, state) => {
  const normalizedCity = normalizeWhitespace(city)
  const normalizedState = normalizeWhitespace(state)?.toUpperCase() || null

  if (!normalizedCity || !normalizedState) return null
  return `${normalizedCity}, ${normalizedState}, USA`
}

const parsePostedDateMatch = (value) => {
  const match = String(value ?? '').match(/\b([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})\b/)
  if (!match) return null

  const [, monthName, day, year] = match
  const month = MONTHS[monthName.toLowerCase()]
  if (!month) return null

  return `${year}-${month}-${day.padStart(2, '0')}`
}

export const extractPostingDateIso = (html) => parsePostedDateMatch(html)

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Numeric\s*\|\s*Transform Your Business\s*\|\s*SAP Consulting\s*<\/title>/i.test(page)
    && /<link rel=["']canonical["'] href=["']https:\/\/numerictech\.com\/["']/i.test(page)
    && /<meta property=["']og:site_name["'] content=["']Numeric["']/i.test(page)
    && /href=["']https:\/\/numerictech\.com\/careers\/["']/i.test(page)
    && /Founded in 1996 to address the looming Y2K crisis/i.test(page)
    && /17 global locations/i.test(page)
}

export const sitemapIncludesCareersUrl = (xml) =>
  /<loc>\s*https:\/\/numerictech\.com\/careers\/united-states\/\s*<\/loc>/i.test(String(xml ?? ''))

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''
  const applyLinkCount = (page.match(/href=["']mailto:jobs@numerictech\.com["']/gi) || []).length

  return /<title>\s*United States Careers\s*-\s*Numeric\s*<\/title>/i.test(page)
    && /<link rel=["']canonical["'] href=["']https:\/\/numerictech\.com\/careers\/united-states\/["']/i.test(page)
    && /<meta property=["']og:site_name["'] content=["']Numeric["']/i.test(page)
    && /<h1>\s*United States Careers\s*<\/h1>/i.test(page)
    && /href=["']https:\/\/numerictech\.com\/careers\/["'][^>]*title=["']Careers["']/i.test(page)
    && applyLinkCount >= 2
    && /SAP Analyst/i.test(text)
    && /Senior SAP S\/4 HANA Consultant/i.test(text)
    && extractPostingDateIso(page) === '2026-02-15'
}

const createBaseJob = ({ title, postingDate }) => {
  const identity = buildPostingId(title)
  if (!title || !identity || !postingDate) {
    throw new Error(
      'Numeric Technologies verified United States careers page no longer exposes the expected public openings',
    )
  }

  return {
    title,
    department: null,
    sourceUrl: CAREERS_URL,
    applyUrl: APPLY_URL,
    jobId: identity,
    requisitionId: identity,
    employmentType: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate,
    closingDate: null,
    remoteStatus: null,
  }
}

const extractSapAnalystOpening = (html, postingDate) => {
  const match = String(html ?? '').match(
    /<div class="elementToProof">\s*([\s\S]*?)<\/div>\s*<div class="elementToProof">\s*([\s\S]*?)<\/div>/i,
  )

  const firstBlockHtml = match?.[1] ?? null
  const secondBlockHtml = match?.[2] ?? null
  const firstBlock = stripTags(firstBlockHtml)
  const secondBlock = stripTags(secondBlockHtml)

  const title = normalizeWhitespace(
    firstBlock?.match(/position\s+(.+?)\s+with bachelor(?:'|’)?s degree/i)?.[1],
  )
  const qualificationFragment = normalizeWhitespace(
    firstBlock?.match(/with bachelor(?:'|’)?s degree in\s+(.+?)\s+and\s+\d+\s+yrs?\s+of exp/i)?.[1],
  )
  const minimumQualification = qualificationFragment
    ? `Bachelor's degree in ${qualificationFragment}`
    : null
  const experienceYears = firstBlock?.match(/\band\s+(\d+)\s+yrs?\s+of exp\b/i)?.[1] ?? null
  const experienceRequired = experienceYears ? `${experienceYears} years` : null
  const locationMatch = secondBlock?.match(/Work location is\s+([^,]+),\s*([A-Z]{2})\b/i) ?? null
  const city = normalizeWhitespace(locationMatch?.[1] ?? null)
  const state = normalizeWhitespace(locationMatch?.[2] ?? null)?.toUpperCase() || null
  const location = buildLocation(city, state)
  const jobDescription = normalizeWhitespace([firstBlock, secondBlock].filter(Boolean).join(' '))

  if (
    title !== 'SAP Analyst'
    || !minimumQualification
    || experienceRequired !== '2 years'
    || !location
    || !jobDescription
    || !/href=["']mailto:jobs@numerictech\.com["']/i.test(String(secondBlockHtml ?? ''))
  ) {
    throw new Error(
      'Numeric Technologies verified United States careers page no longer exposes the expected SAP Analyst opening',
    )
  }

  return {
    ...createBaseJob({ title, postingDate }),
    location,
    city,
    state,
    country: 'United States',
    experienceRequired,
    minimumQualification,
    jobDescription,
  }
}

const extractSeniorConsultantOpening = (html, postingDate) => {
  const afterDivider = String(html ?? '').split(/<hr\s*\/?>/i)[1] ?? ''
  const detailText = stripTags(afterDivider)
  const title = normalizeWhitespace(
    detailText?.match(/looking for a\s+(.+?)\s+to provide services/i)?.[1],
  )
  const qualificationFragment = normalizeWhitespace(
    detailText?.match(/requires a minimum of a Bachelor(?:'|’)?s degree in\s+(.+?)\./i)?.[1],
  )
  const minimumQualification = qualificationFragment
    ? `Bachelor's degree in ${qualificationFragment}`
    : null
  const jobDescription = detailText

  if (
    title !== 'Senior SAP S/4 HANA Consultant'
    || !minimumQualification
    || !jobDescription
    || !/Please submit resumes to jobs@numerictech\.com/i.test(jobDescription)
  ) {
    throw new Error(
      'Numeric Technologies verified United States careers page no longer exposes the expected Senior SAP S/4 HANA Consultant opening',
    )
  }

  return {
    ...createBaseJob({ title, postingDate }),
    location: null,
    city: null,
    state: null,
    country: 'United States',
    experienceRequired: null,
    minimumQualification,
    jobDescription,
  }
}

export const extractPublicOpenings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error(
      'Numeric Technologies verified United States careers page no longer matches the trusted first-party public jobs surface',
    )
  }

  const postingDate = extractPostingDateIso(html)
  const jobs = [
    extractSapAnalystOpening(html, postingDate),
    extractSeniorConsultantOpening(html, postingDate),
  ]

  if (jobs.length !== 2) {
    throw new Error(
      'Numeric Technologies verified United States careers page no longer exposes the expected public openings',
    )
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

export const createNumericTechnologiesScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error(
        'Numeric Technologies verified official homepage no longer matches the trusted first-party surface',
      )
    }

    const sitemapXml = await fetchText(PAGE_SITEMAP_URL)
    if (!sitemapIncludesCareersUrl(sitemapXml)) {
      throw new Error(
        'Numeric Technologies verified sitemap no longer points to the trusted Numeric Technologies careers route',
      )
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = extractPublicOpenings(careersHtml)

    return jobs.map((job) => ({
      ...job,
      company: COMPANY,
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-company-careers',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createNumericTechnologiesScraper().run(options)

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
