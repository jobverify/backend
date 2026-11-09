import { extractLinkedinJobCards } from '../../scraper-support/utils/linkedinJobCards.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { SNAPDEAL_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = SNAPDEAL_CATALOG.source
export const COMPANY_NAME = SNAPDEAL_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = SNAPDEAL_CATALOG.officialBrandName
export const OFFICIAL_CAREERS_URL = SNAPDEAL_CATALOG.companyCareerPage
export const OFFICIAL_ABOUT_URL = SNAPDEAL_CATALOG.officialAboutPageUrl
export const OFFICIAL_CAREERS_HANDOFF_URL = SNAPDEAL_CATALOG.officialCareersHandoffUrl
export const LINKEDIN_COMPANY_PAGE_URL = SNAPDEAL_CATALOG.linkedinCompanyPageUrl
export const LINKEDIN_WORLDWIDE_JOBS_URL = SNAPDEAL_CATALOG.linkedinWorldwideJobsUrl
export const LINKEDIN_PUBLIC_JOBS_URL = SNAPDEAL_CATALOG.publicLinkedInJobsUrl
export const VERIFIED_ON = SNAPDEAL_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = SNAPDEAL_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = SNAPDEAL_CATALOG

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/, '')

const extractTitle = (html) => normalizeWhitespace(
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || null,
)

const toAbsoluteUrl = (value, baseUrl = OFFICIAL_CAREERS_URL) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeLinkedInCompanyPageUrl = (value) => {
  const absoluteUrl = toAbsoluteUrl(value, OFFICIAL_CAREERS_URL)
  if (!absoluteUrl) return null

  try {
    const url = new URL(absoluteUrl)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    if (hostname !== 'linkedin.com' && hostname !== 'in.linkedin.com') return null

    if (/^\/company\/snapdeal\/?$/i.test(url.pathname)) {
      return LINKEDIN_COMPANY_PAGE_URL
    }

    if (/^\/authwall\/?$/i.test(url.pathname)) {
      const redirected = url.searchParams.get('sessionRedirect')
      return redirected ? normalizeLinkedInCompanyPageUrl(redirected) : null
    }
  } catch {
    return null
  }

  return null
}

const normalizeLinkedInWorldwideJobsUrl = (value) => {
  const absoluteUrl = toAbsoluteUrl(value, LINKEDIN_COMPANY_PAGE_URL)
  if (!absoluteUrl) return null

  try {
    const url = new URL(absoluteUrl)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    if (hostname !== 'linkedin.com' && hostname !== 'in.linkedin.com') return null
    if (!/^\/jobs\/snapdeal-jobs-worldwide\/?$/i.test(url.pathname)) return null
    if (url.searchParams.get('f_C') !== '2100709') return null
  } catch {
    return null
  }

  return LINKEDIN_WORLDWIDE_JOBS_URL
}

export const extractLinkedInCompanyPageUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*Careers/gi)) {
    const normalizedUrl = normalizeLinkedInCompanyPageUrl(match[1])
    if (normalizedUrl) return normalizedUrl
  }

  return null
}

export const extractLinkedInWorldwideJobsUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
    const normalizedUrl = normalizeLinkedInWorldwideJobsUrl(match[1])
    if (normalizedUrl) return normalizedUrl
  }

  return null
}

export const hasOfficialSnapdealHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = (stripTags(page) || '').toLowerCase()
  const title = (extractTitle(page) || '').toLowerCase()

  return title === 'online shopping for men, women & kids fashion, home decor, lifestyle & more'
    && text.includes("snapdeal is india's leading pure-play value ecommerce platform.")
    && text.includes("snapdeal's vision is to enable the shoppers of bharat")
    && text.includes('company')
    && extractLinkedInCompanyPageUrl(page) === LINKEDIN_COMPANY_PAGE_URL
}

export const hasOfficialSnapdealAboutPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = (stripTags(page) || '').toLowerCase()
  const title = (extractTitle(page) || '').toLowerCase()

  return title === "about us: snapdeal.com - india's largest online marketplace"
    && text.includes('about us')
    && text.includes("india's largest online marketplace")
    && text.includes('bharat')
    && text.includes('acevector')
    && extractLinkedInCompanyPageUrl(page) === LINKEDIN_COMPANY_PAGE_URL
}

export const hasVerifiedLinkedInCompanySignal = ({ url, html } = {}) => {
  const normalizedHtml = normalizeWhitespace(html)?.toLowerCase() || ''
  const title = extractTitle(html)?.toLowerCase() || ''

  return normalizeUrl(url) === normalizeUrl(LINKEDIN_COMPANY_PAGE_URL)
    && title === 'snapdeal | linkedin'
    && normalizedHtml.includes('urn:li:organization:2100709')
    && normalizedHtml.includes('snapdeal.com')
    && extractLinkedInWorldwideJobsUrl(html) === LINKEDIN_WORLDWIDE_JOBS_URL
}

export const hasPublicLinkedInJobsSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)?.toLowerCase() || ''

  return /job-search-card/i.test(rawHtml)
    && normalized.includes('snapdeal')
    && normalized.includes('gurugram')
}

const parseLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const city = parts[0] || null
  const country = parts.at(-1) === 'India' ? 'India' : parts.at(-1) || null

  return {
    location: normalized,
    city,
    country,
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full_time' || normalized === 'full time') return 'Full-time'
  if (normalized === 'part_time' || normalized === 'part time') return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('intern')) return 'Internship'
  return normalizeWhitespace(value)
}

const parseJobPostingJsonLd = (html = '') => {
  const scripts = [...String(html ?? '').matchAll(
    /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/gi,
  )]

  for (const [, rawJson] of scripts) {
    try {
      const parsed = JSON.parse(rawJson)
      if (parsed?.['@type'] === 'JobPosting') return parsed
    } catch {
      // Skip malformed JSON-LD blocks until the public JobPosting payload is found.
    }
  }

  return null
}

export const extractSearchResults = (html = '') => extractLinkedinJobCards(html)
  .map(({ id: jobId, href: rawHref, title: rawTitle, company: rawCompany, location: rawLocation, datetime }) => {
    const sourceUrl = normalizeWhitespace(rawHref)?.replace(/&amp;/g, '&')
    const title = stripTags(rawTitle)
    const company = stripTags(rawCompany)
    const locationData = parseLocation(stripTags(rawLocation))
    const postingDate = normalizeWhitespace(datetime)

    if (
      !title
      || !jobId
      || !sourceUrl
      || locationData.country !== 'India'
      || normalizeWhitespace(company)?.toLowerCase() !== OFFICIAL_BRAND_NAME.toLowerCase()
    ) {
      return null
    }

    return {
      title,
      company,
      department: null,
      location: locationData.location,
      city: locationData.city,
      country: locationData.country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate,
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html = '') => {
  const jobPosting = parseJobPostingJsonLd(html)
  if (!jobPosting) return {}

  const address = jobPosting?.jobLocation?.address || {}
  const country = address.addressCountry === 'IN'
    ? 'India'
    : normalizeWhitespace(address.addressCountry)
  const parts = [
    normalizeWhitespace(address.addressLocality),
    normalizeWhitespace(address.addressRegion),
    country,
  ].filter(Boolean)

  return {
    title: normalizeWhitespace(jobPosting?.title) || null,
    company: normalizeWhitespace(jobPosting?.hiringOrganization?.name) || null,
    location: parts.join(', ') || null,
    city: normalizeWhitespace(address.addressLocality),
    country,
    employmentType: normalizeEmploymentType(jobPosting?.employmentType),
    postingDate: normalizeWhitespace(jobPosting?.datePosted)?.slice(0, 10) || null,
    jobDescription: stripTags(jobPosting?.description) || null,
  }
}

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

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 1,
  label: 'snapdeal-linkedin',
  timeoutMs: 15000,
})

const shouldIgnoreLinkedInDetailError = (error) =>
  /HTTP 429\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const createSnapdealScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
  } = {}) {
    const homepage = await fetchPage(OFFICIAL_CAREERS_URL)
    if (homepage.status !== 200 || !hasOfficialSnapdealHomepageSignal(homepage.html)) {
      throw new Error('Snapdeal verified official homepage careers handoff changed materially')
    }

    const aboutPage = await fetchPage(OFFICIAL_ABOUT_URL)
    if (aboutPage.status !== 200 || !hasOfficialSnapdealAboutPageSignal(aboutPage.html)) {
      throw new Error('Snapdeal verified official about page careers handoff changed materially')
    }

    const linkedInCompanyPage = await fetchPage(LINKEDIN_COMPANY_PAGE_URL)
    if (
      linkedInCompanyPage.status !== 200
      || !hasVerifiedLinkedInCompanySignal(linkedInCompanyPage)
    ) {
      throw new Error('Snapdeal verified LinkedIn company page changed materially')
    }

    const listingsHtml = await fetchText(LINKEDIN_PUBLIC_JOBS_URL)
    const listings = extractSearchResults(listingsHtml)
    if (!hasPublicLinkedInJobsSignal(listingsHtml) && listings.length === 0) {
      throw new Error('Snapdeal public LinkedIn jobs surface changed materially')
    }

    const selectedJobs = maxJobs ? listings.slice(0, maxJobs) : listings
    const enrichedJobs = []

    for (const listing of selectedJobs) {
      let detail = {}

      try {
        detail = extractJobDetail(await fetchText(listing.sourceUrl))
      } catch (error) {
        if (!shouldIgnoreLinkedInDetailError(error)) throw error
      }

      enrichedJobs.push({
        ...listing,
        ...Object.fromEntries(
          Object.entries(detail).filter(([, value]) => value != null),
        ),
      })
    }

    const scrapedAt = now()
    return enrichedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createSnapdealScraper(options).run(options)

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
