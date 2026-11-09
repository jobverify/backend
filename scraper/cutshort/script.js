import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'cutshort'
export const COMPANY = 'CutShort'
export const HOME_URL = 'https://cutshort.io/'
export const ABOUT_URL = 'https://cutshort.io/about'
export const BLOG_URL = 'https://cutshort.io/blog'
export const COMPANY_PAGE_URL = 'https://cutshort.io/company/cutshort-zFdWQxlN'
export const COMPANY_ALIAS = 'cutshort-zFdWQxlN'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERN =
  /\b(india|delhi|gurgaon|gurugram|noida|mumbai|pune|hyderabad|chennai|bengaluru|bangalore|kolkata|ahmedabad|coimbatore)\b/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;/gi, "'")
  .replace(/&quot;|&#34;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/section|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeUrl = (value) => normalizeWhitespace(value).replace(/\/+$/, '').toLowerCase()

const toArray = (value) => Array.isArray(value) ? value : []

const buildIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractCity = (location) => normalizeWhitespace(location).split(',')[0] || null

const normalizeEmploymentType = (roleTypes) => {
  const normalized = toArray(roleTypes).map((value) => normalizeWhitespace(value).toLowerCase())

  if (normalized.includes('full_time')) return 'Full-time'
  if (normalized.includes('internship')) return 'Internship'
  if (normalized.includes('part_time')) return 'Part-time'

  return null
}

const normalizeExperienceRequired = (expRange = {}) => {
  const min = Number(expRange.minVanity ?? expRange.min)
  const max = Number(expRange.maxVanity ?? expRange.max)

  if (Number.isFinite(min) && Number.isFinite(max) && max >= min) {
    return `${min} - ${max} years`
  }

  if (Number.isFinite(min)) {
    return `${min}+ years`
  }

  return null
}

const parseNextData = (html) => {
  const match = String(html ?? '').match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  )
  if (!match) return null

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('cutshort: making top professionals more successful.')
    && normalized.includes(
      'use the power of artificial intelligence to find jobs, hire people, meet other top professionals or otherwise succeed in your career.',
    )
    && normalized.includes('appyhappy software pvt. ltd.')
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('about | cutshort')
    && normalized.includes(
      'cutshort is a hiring platform for technology companies in india that uses ai to deliver shortlist-ready candidates who fit your roles.',
    )
}

export const hasOfficialCompanyPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return normalized.includes('cutshort careers |')
    && /\bjobs?\s+at\s+cutshort\b/i.test(normalized)
    && normalized.includes(COMPANY_PAGE_URL.toLowerCase())
    && /__NEXT_DATA__/i.test(page)
}

export const extractCompanyPageData = (html) => {
  const nextData = parseNextData(html)
  const queries = toArray(nextData?.props?.pageProps?.dehydratedState?.queries)
  const target = queries.find((entry) => {
    const queryKey = toArray(entry?.queryKey)
    return queryKey[0] === 'companyPageData' && queryKey[1] === COMPANY_ALIAS
  })

  const rawStateData = target?.state?.data
  const pageEnvelope = rawStateData?.data && typeof rawStateData.data === 'object'
    ? rawStateData.data
    : rawStateData

  if (pageEnvelope?.pageData?.company && pageEnvelope?.pageData?.companyJobs) {
    return {
      seoData: pageEnvelope.seoData ?? null,
      companyDetails: pageEnvelope.pageData.company,
      companyJobs: pageEnvelope.pageData.companyJobs,
      breadcrumbs: pageEnvelope.pageData.breadcrumbs ?? [],
    }
  }

  if (pageEnvelope?.companyDetails && pageEnvelope?.companyJobs) {
    return {
      seoData: pageEnvelope.seoData ?? null,
      companyDetails: pageEnvelope.companyDetails,
      companyJobs: pageEnvelope.companyJobs,
      breadcrumbs: pageEnvelope.breadcrumbs ?? [],
    }
  }

  return null
}

export const validateOfficialCompanyContext = (data) => {
  const companyDetails = data?.companyDetails
  const website = normalizeUrl(companyDetails?.links?.website)
  const about = normalizeUrl(companyDetails?.links?.about)
  const blog = normalizeUrl(companyDetails?.links?.blog)
  const canonical = normalizeUrl(data?.seoData?.canonical)
  const alias = normalizeWhitespace(companyDetails?.alias)

  return normalizeWhitespace(companyDetails?.name).toLowerCase() === 'cutshort'
    && alias === COMPANY_ALIAS
    && website === normalizeUrl(HOME_URL)
    && about === normalizeUrl(ABOUT_URL)
    && blog === normalizeUrl(BLOG_URL)
    && canonical === normalizeUrl(COMPANY_PAGE_URL)
}

const normalizeJob = (job, scrapedAt) => {
  const title = normalizeWhitespace(job?.headline)
  const jobId = normalizeWhitespace(job?._id)
  const sourceUrl = normalizeWhitespace(job?.publicUrl)
  const applyUrl = normalizeWhitespace(job?.authApplyUrl) || sourceUrl
  const location = buildIndiaLocation(job?.locationsText || toArray(job?.locations)[0])

  if (!title || !jobId || !sourceUrl || !location || !INDIA_LOCATION_PATTERN.test(location)) {
    return null
  }

  return {
    title,
    company: COMPANY,
    location,
    city: extractCity(location),
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl,
    employmentType: normalizeEmploymentType(job?.roleTypes),
    department: null,
    experienceRequired: normalizeExperienceRequired(job?.expRange),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: toArray(job?.allSkills).map((value) => normalizeWhitespace(value)).filter(Boolean),
    postingDate: normalizeWhitespace(job?.hiringIntentShownOn) || null,
    closingDate: null,
    jobDescription: stripHtml(job?.sanitizedComment),
    source: SOURCE,
    link: sourceUrl,
    scrapedAt,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createCutShortScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(HOME_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('CutShort verified homepage no longer matches the trusted first-party surface')
    }

    const aboutHtml = await fetchText(ABOUT_URL)
    if (!hasOfficialAboutSignal(aboutHtml)) {
      throw new Error('CutShort verified about page no longer matches the trusted first-party careers handoff')
    }

    const companyPageHtml = await fetchText(COMPANY_PAGE_URL)
    if (!hasOfficialCompanyPageSignal(companyPageHtml)) {
      throw new Error('CutShort official company page no longer matches the trusted public careers surface')
    }

    const companyPageData = extractCompanyPageData(companyPageHtml)
    if (!validateOfficialCompanyContext(companyPageData)) {
      throw new Error('CutShort official company page no longer exposes the verified company identity')
    }

    const rawJobs = companyPageData?.companyJobs?.jobs
    if (!Array.isArray(rawJobs)) {
      throw new Error('CutShort official company page jobs payload changed materially')
    }

    return rawJobs
      .map((job) => normalizeJob(job, now()))
      .filter(Boolean)
  },
})

export const run = async (options = {}) => createCutShortScraper().run(options)

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
