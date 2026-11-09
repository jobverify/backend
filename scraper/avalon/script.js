import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { AVALON_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AVALON_CATALOG.source
export const COMPANY = AVALON_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = AVALON_CATALOG.officialBrandName
export const VERIFIED_ON = AVALON_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = AVALON_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = AVALON_CATALOG
export const HOMEPAGE_URL = AVALON_CATALOG.homepageUrl
export const CAREERS_URL = AVALON_CATALOG.companyCareerPage
export const CAREER_ALIAS_URL = AVALON_CATALOG.careerAliasUrl
export const LEGACY_CAREERS_URL = AVALON_CATALOG.legacyCareersPageUrl
export const APPLICATION_EMAIL = AVALON_CATALOG.applicationEmail
export const NO_PUBLIC_JOB_ROUTE_URLS = AVALON_CATALOG.noPublicJobRouteUrls

const COMPANY_DOMAIN = AVALON_CATALOG.companyDomain
const ATS_PLATFORM = AVALON_CATALOG.atsPlatform
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&ndash;|&#8211;|\u2013|\u2014/g, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\u2018|\u2019/g, "'")

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const stripTagsToLines = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|td|th|section)>/gi, '\n')
  .replace(/<(p|div|li|ul|ol|h[1-6]|tr|td|th|section)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\r/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)

const stripScriptAndStyle = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, HOMEPAGE_URL).toString()
  } catch {
    return null
  }
}

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const extractMatch = (value, pattern) => String(value ?? '').match(pattern)?.[1] ?? null

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === COMPANY_DOMAIN || hostname === `www.${COMPANY_DOMAIN}`
  } catch {
    return false
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const sameDomainVacancyLinkPattern = /href=["'](?:https?:\/\/(?:www\.)?avaloninfosys\.com)?\/vacancies\/[^"'#? >]+["']/i

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Avalon Information Systems \| Open-Source Development Tools for SDGs\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.avaloninfosys\.com\/["']/i.test(page)
    && /href=["']\/career["']/i.test(page)
    && normalized.includes('CMMI Maturity Level 3 and ISO 27001:2013 software development company')
}

export const extractListingRows = (html = '') => [...String(html ?? '').matchAll(
  /<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>\s*<a[^>]+href=["']([^"']+)["'][^>]*>\s*View Job\s*<\/a>\s*<\/td>\s*<\/tr>/gi,
)].map((match) => ({
  title: normalizeText(match[1]),
  experienceRequired: normalizeText(match[2]),
  skillsSummary: normalizeText(match[3]),
  sourceUrl: toAbsoluteUrl(match[4]),
})).filter((listing) => listing.title && listing.experienceRequired && listing.skillsSummary && listing.sourceUrl)

export const pageExposesPublicJobListings = (html = '') => {
  const page = String(html ?? '')

  return extractListingRows(page).length > 0
    || /"@type"\s*:\s*"JobPosting"/i.test(page)
    || sameDomainVacancyLinkPattern.test(page)
}

export const hasOfficialCareerPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Career \| Avalon Information Systems\s*<\/title>/i.test(page)
    && normalized.includes('Current Opening')
    && extractListingRows(page).length > 0
}

export const hasLegacyCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const hasLegacyHandoff = /href=["']\/index\.php\/career["']/i.test(page)
  const hasCurrentCareersCopy = normalized.includes('Aside from the openings below')
    || normalized.includes('send examples of your work to')
    || normalized.includes('Join Avalon Information Systems')

  return /<title>\s*Avalon Information Systems \| Careers\s*<\/title>/i.test(page)
    && normalized.includes('Current Openings')
    && normalized.includes(APPLICATION_EMAIL)
    && (hasLegacyHandoff || hasCurrentCareersCopy)
    && extractListingRows(page).length === 0
    && !sameDomainVacancyLinkPattern.test(page)
  }

export const hasOfficialDetailPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*[^<]+\|\s*Avalon Information Systems\s*<\/title>/i.test(page)
    && /<h3 class=["'][^"']*jobs-title[^"']*["']>\s*[^<]+<\/h3>/i.test(page)
    && /<h5 class=["'][^"']*job-summary[^"']*["']>\s*Experience:/i.test(page)
    && /<div class=["'][^"']*jobs-description[^"']*["']>/i.test(page)
    && /upload\s+(?:your\s+)?resume/i.test(normalized)
    && /<button[^>]*>\s*Apply Now\s*<\/button>/i.test(page)
    && /<form[^>]+action=["'](?:\/index\.php)?\/vacancies\/[^"']+["'][^>]*>/i.test(page)
}

export const isMissingNoPublicJobRoute = (page = {}) => {
  const html = String(page.html ?? '')
  const normalized = normalizeWhitespace(html)

  return Number(page.status) === 404
    && isOfficialDomainUrl(page.url || '')
    && /<title>\s*404\s*\|\s*Avalon Information Systems\s*<\/title>/i.test(html)
    && normalized.includes('Page Not Found')
    && normalized.includes('Something went wrong, Looks like this page is not available any more')
    && /href=["']\/career["']/i.test(html)
    && !pageExposesPublicJobListings(html)
}

const parseWorkplaceLocation = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return { workplaceType: null, location: null, city: null }
  }

  const match = normalized.match(/^([^()]+?)\s*\(([^()]+)\)$/)
  const workplaceType = normalizeText(match?.[1] ?? null)
  const location = normalizeText(match?.[2] ?? normalized)
  const citySeed = location?.split(',')[0] ?? null

  return {
    workplaceType,
    location,
    city: normalizeCity(citySeed) || null,
  }
}

const extractJobsDescriptionChunk = (html) => {
  const page = String(html ?? '')
  const start = page.search(/<div class=["'][^"']*jobs-description[^"']*["']/i)
  const end = page.search(/<div class=["'][^"']*right-content-form-career[^"']*["']/i)

  if (start === -1) return ''
  if (end !== -1 && end > start) {
    return page.slice(start, end)
  }

  return page.slice(start)
}

const buildJobDescription = (html) => stripTagsToLines(html).join('\n') || null

const extractMinimumQualification = (html) => normalizeText(
  extractMatch(html, /Educational Qualification<\/p>\s*<p>([\s\S]*?)<\/p>/i),
)

const extractEmploymentType = (html, title) => {
  const explicit = normalizeText(
    extractMatch(html, /Employment Type:\s*([^<\n]+?)(?:<br|<\/p>|$)/i),
  )

  if (explicit) return explicit
  if (/internship/i.test(String(title ?? ''))) return 'Internship'
  return null
}

const extractCompensation = (html) => normalizeText(
  extractMatch(html, /Stipend:\s*([^<\n]+?)(?:<br|<\/p>|$)/i),
)

export const extractJobDetail = (html, listing) => {
  if (!hasOfficialDetailPageSignal(html)) {
    throw new Error('Avalon verified vacancy detail page no longer matches the trusted first-party surface')
  }

  const title = normalizeText(
    extractMatch(html, /<h3 class=["'][^"']*jobs-title[^"']*["']>\s*([\s\S]*?)<\/h3>/i)
      || listing?.title,
  )
  const summary = normalizeText(
    extractMatch(html, /<h5 class=["'][^"']*job-summary[^"']*["']>\s*([\s\S]*?)<\/h5>/i),
  )
  const summaryMatch = summary?.match(/^Experience:\s*(.*?)\s*\|\s*Location:\s*(.*?)\s*\|\s*Required Skills:\s*(.*)$/i)
  const experienceRequired = normalizeText(summaryMatch?.[1] ?? listing?.experienceRequired)
  const skillsSummary = normalizeText(summaryMatch?.[3] ?? listing?.skillsSummary)
  const { workplaceType, location, city } = parseWorkplaceLocation(summaryMatch?.[2] ?? null)
  const descriptionChunk = extractJobsDescriptionChunk(html)
  const sourceUrl = listing?.sourceUrl
  const slug = decodeURIComponent(new URL(sourceUrl).pathname.split('/').filter(Boolean).at(-1) ?? '')

  return {
    title,
    department: null,
    location,
    city,
    jobId: `${SOURCE}-${slugify(slug)}`,
    requisitionId: `${SOURCE}-${slugify(slug)}`,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: extractEmploymentType(descriptionChunk, title),
    workplaceType,
    experienceRequired,
    minimumQualification: extractMinimumQualification(descriptionChunk),
    preferredQualification: null,
    requiredSkills: skillsSummary ? [skillsSummary] : [],
    compensation: extractCompensation(descriptionChunk),
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription(descriptionChunk),
    companyCareerPage: CAREERS_URL,
  }
}

export const createAvalonScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage = defaultFetchPage, now: overrideNow } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Avalon verified homepage no longer matches the trusted first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareerPageSignal(careersPage.html)) {
      throw new Error('Avalon verified career page no longer matches the trusted first-party vacancy table')
    }

    const listings = extractListingRows(careersPage.html)
    if (listings.length === 0) {
      throw new Error('Avalon verified career page no longer exposes public vacancy rows')
    }

    const careerAliasPage = await fetchPage(CAREER_ALIAS_URL)
    if (careerAliasPage.status !== 200 || !hasOfficialCareerPageSignal(careerAliasPage.html)) {
      throw new Error('Avalon career alias no longer resolves to the trusted first-party vacancy table')
    }

    const legacyCareersPage = await fetchPage(LEGACY_CAREERS_URL)
    if (legacyCareersPage.status !== 200 || !hasLegacyCareersPageSignal(legacyCareersPage.html)) {
      throw new Error('Avalon legacy careers page no longer matches the verified stale placeholder surface')
    }

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isMissingNoPublicJobRoute(routePage)) {
        throw new Error(`Avalon common no-public job route changed materially or now exposes jobs: ${routeUrl}`)
      }
    }

    const jobs = (await Promise.all(listings.map(async (listing) => extractJobDetail(
      (await fetchPage(listing.sourceUrl)).html,
      listing,
    ))))
      .sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))
      .map((job) => ({
        ...job,
        company: COMPANY,
        country: 'India',
        source: SOURCE,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: ATS_PLATFORM,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: (overrideNow || now)(),
      }))

    if (jobs.length === 0) {
      throw new Error('Avalon first-party vacancy surface no longer yields normalized jobs')
    }

    return jobs
  },
})

export const run = async (options = {}) => createAvalonScraper().run(options)

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
