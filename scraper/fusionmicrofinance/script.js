import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { FUSION_MICROFINANCE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FUSION_MICROFINANCE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const RECRUITER_EMAIL = PROVIDER_METADATA.recruiterEmail
export const GENERIC_JOB_TITLES = PROVIDER_METADATA.verifiedGenericJobTitles
export const FEATURED_ROLE_URLS = PROVIDER_METADATA.verifiedFeaturedRoleUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const VERIFIED_FEATURED_LISTING = {
  title: 'QA Engineer/Sr. QA Engineer',
  experienceRequired: '1-5',
  state: 'Haryana',
  city: 'Gurgaon/Gurugram',
  department: 'Automation Testing',
  sourceUrl: FEATURED_ROLE_URLS[0],
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/[“”]/g, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    const url = new URL(String(value), baseUrl)
    url.hash = ''
    if (url.pathname !== '/' && !url.pathname.endsWith('/')) {
      url.pathname = `${url.pathname}/`
    }
    return url.toString()
  } catch {
    return null
  }
}

const extractFieldValue = (html, label) => {
  const page = String(html ?? '')
  const structuredMatch = page.match(
    new RegExp(`${label}:\\s*<\\/strong><\\/span><a[^>]*>([\\s\\S]*?)<\\/a>`, 'i'),
  )
  if (structuredMatch) {
    return normalizeText(structuredMatch[1])
  }

  return normalizeText(
    page.match(new RegExp(`${label}:\\s*([^<\\n]+)`, 'i'))?.[1],
  )
}

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => normalizeText(match[1]))
  .filter(Boolean)

const buildGenericJob = (title) => {
  const normalizedTitle = normalizeText(title)
  const department = normalizedTitle?.split('-')[0]?.trim() || null
  const identity = slugify(normalizedTitle)

  if (!normalizedTitle || !identity) {
    throw new Error('Fusion Microfinance careers surface no longer exposes complete generic role metadata')
  }

  return {
    title: normalizedTitle,
    company: COMPANY,
    department,
    location: 'India',
    city: null,
    state: null,
    country: 'India',
    jobId: `${SOURCE}-${identity}`,
    requisitionId: `${SOURCE}-${identity}`,
    sourceUrl: CAREERS_URL,
    applyUrl: CAREERS_URL,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Apply through the public first-party Fusion careers form.',
    publicExperienceChecked: true,
    remoteStatus: 'On-site',
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

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Fusion Finance Limited\b[\s\S]*MFI Company[\s\S]*<\/title>/i.test(page)
    && /href=["']https:\/\/fusionfin\.com\/careers\/["'][^>]*>\s*Careers\b[\s\S]*?<\/a>/i.test(page)
    && normalized.includes('Fusion Finance Limited')
}

export const extractGenericJobTitles = (html) => {
  const selectHtml = String(html ?? '').match(
    /<label[^>]*>\s*Job Title\s*<\/label>[\s\S]*?<select\b[^>]*>([\s\S]*?)<\/select>/i,
  )?.[1] || ''

  return [...selectHtml.matchAll(/<option\b[^>]*>([\s\S]*?)<\/option>/gi)]
    .map((match) => normalizeText(match[1]))
    .filter((option) => option && !/^Select The Job(?: Title)?$/i.test(option))
}

export const extractFeaturedListings = (html) => {
  const normalized = normalizeWhitespace(html)
  const detailUrl = FEATURED_ROLE_URLS[0]

  if (
    !normalized.includes('QA Engineer/Sr. QA Engineer 1-5 Haryana Gurgaon/Gurugram Automation Testing More Details')
    || !String(html ?? '').includes(detailUrl)
  ) {
    return []
  }

  return [{ ...VERIFIED_FEATURED_LISTING }]
}

export const hasOfficialCareersSurface = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const genericTitles = extractGenericJobTitles(page)
  const featuredListings = extractFeaturedListings(page)

  return /<title>\s*Fusion Finance\b[\s\S]*Careers\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/fusionfin\.com\/careers\/["']/i.test(page)
    && normalized.includes('Current Openings')
    && normalized.includes('Click here to apply against open job postings')
    && normalized.includes(
      'Click here to apply for Area Manager, Branch Manager, Audit Officer & Relationship Officer jobs at branches of Fusion Micro Finance Ltd.',
    )
    && normalized.includes('Job Title')
    && normalized.includes('Apply Now')
    && genericTitles.length === GENERIC_JOB_TITLES.length
    && GENERIC_JOB_TITLES.every((title, index) => genericTitles[index] === title)
    && featuredListings.length === FEATURED_ROLE_URLS.length
    && FEATURED_ROLE_URLS.every((url, index) => featuredListings[index]?.sourceUrl === url)
}

export const hasOfficialDetailPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes('QA Engineer/Sr. QA Engineer')
    && extractFieldValue(page, 'Experience') === '1-5'
    && extractFieldValue(page, 'State') === 'Haryana'
    && extractFieldValue(page, 'City') === 'Gurgaon/Gurugram'
    && extractFieldValue(page, 'Job Role') === 'Automation Testing'
    && normalized.includes(`Interested applicants can reach out to us at ${RECRUITER_EMAIL}`)
    && normalized.includes('Apply for this position')
    && /<input[^>]+type=["']file["']/i.test(page)
}

export const extractFeaturedJobDetail = (html, listing = VERIFIED_FEATURED_LISTING) => {
  if (!hasOfficialDetailPageSignal(html)) {
    throw new Error('Fusion Microfinance verified featured detail page changed materially')
  }

  const requiredSkills = extractListItems(html)
  const title = normalizeText(
    String(html ?? '').match(/<h1>\s*([\s\S]*?)\s*<\/h1>/i)?.[1],
  ) || listing.title
  const state = extractFieldValue(html, 'State') || listing.state
  const city = extractFieldValue(html, 'City') || listing.city
  const department = extractFieldValue(html, 'Job Role') || listing.department
  const experienceRequired = extractFieldValue(html, 'Experience') || listing.experienceRequired
  const recruiterLine = normalizeText(
    String(html ?? '').match(/(Interested applicants can reach out to us at [^<]+)/i)?.[1],
  )
  const identity = slugify(title)

  if (!title || !state || !city || !department || !experienceRequired || !identity || requiredSkills.length === 0) {
    throw new Error('Fusion Microfinance verified featured detail page changed materially')
  }

  return {
    title,
    company: COMPANY,
    department,
    location: `${city}, ${state}, India`,
    city,
    state,
    country: 'India',
    jobId: `${SOURCE}-${identity}`,
    requisitionId: `${SOURCE}-${identity}`,
    sourceUrl: listing.sourceUrl || FEATURED_ROLE_URLS[0],
    applyUrl: `${listing.sourceUrl || FEATURED_ROLE_URLS[0]}#apply`,
    employmentType: null,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeText(
      `Job Role: ${department} ${requiredSkills.join(' ')} ${recruiterLine || ''}`,
    ),
    publicExperienceChecked: true,
    remoteStatus: 'On-site',
  }
}

export const createFusionMicrofinanceScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Fusion Microfinance verified homepage changed materially')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSurface(careersHtml)) {
      throw new Error('Fusion Microfinance verified careers surface changed materially')
    }

    const genericJobs = extractGenericJobTitles(careersHtml).map(buildGenericJob)
    const featuredJobs = []
    for (const listing of extractFeaturedListings(careersHtml)) {
      const detailHtml = await fetchText(listing.sourceUrl)
      featuredJobs.push(extractFeaturedJobDetail(detailHtml, listing))
    }

    const scrapedAt = (overrideNow || now)()

    return [...genericJobs, ...featuredJobs].map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createFusionMicrofinanceScraper().run(options)

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
