import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { withRetry } from '../../scraper-support/utils/retry.js'

import { AKASA_AIR_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AKASA_AIR_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const CAREERS_REDIRECT_URL = PROVIDER_METADATA.careersRedirectUrl
export const CAREERS_LANDING_URL = PROVIDER_METADATA.companyCareerPage
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const ROLE_PAGE_URLS = [...PROVIDER_METADATA.rolePageUrls]
export const BROKEN_PEOPLESTRONG_JOBLIST_URL = PROVIDER_METADATA.brokenPeopleStrongJoblistUrl
export const PILOT_APPLY_URL = PROVIDER_METADATA.pilotApplyUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const PAGE_REQUEST_TIMEOUT_MS = 30000

const VERIFIED_ROLE_PAGES = [
  {
    url: ROLE_PAGE_URLS[0],
    pageTitle: 'Hiring Cabin Crew - Careers at Akasa Air',
    jobTitle: 'Hiring Cabin Crew',
    department: 'Cabin Crew',
    expectedApplyUrl: BROKEN_PEOPLESTRONG_JOBLIST_URL,
  },
  {
    url: ROLE_PAGE_URLS[1],
    pageTitle: 'Hiring Pilots - Careers at Akasa Air',
    jobTitle: 'Hiring Pilots',
    department: 'Pilots',
    expectedApplyUrl: PILOT_APPLY_URL,
  },
  {
    url: ROLE_PAGE_URLS[2],
    pageTitle: 'Corporate and Commercial - Careers at Akasa Air',
    jobTitle: 'Corporate and Commercial',
    department: 'Corporate and Commercial',
    expectedApplyUrl: BROKEN_PEOPLESTRONG_JOBLIST_URL,
  },
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const trimTrailingSlash = (value) => String(value ?? '').replace(/\/+$/, '')

const normalizeUrl = (value) => trimTrailingSlash(String(value ?? ''))

const buildJobIdFromUrl = (url) => normalizeUrl(url).split('/').pop() || null

const normalizeMicrosoftFormsUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    const hostname = url.hostname.toLowerCase()

    if (!['forms.office.com', 'forms.cloud.microsoft'].includes(hostname)) {
      return null
    }

    return `${trimTrailingSlash(url.pathname)}${url.search}`
  } catch {
    return null
  }
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url, { signal } = {}) =>
  withRetry(async () => {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: composeAbortSignals(
        signal,
        createTimeoutSignal(PAGE_REQUEST_TIMEOUT_MS),
      ),
    })

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
    }
  }, {
    attempts: 3,
    baseDelayMs: 2000,
    label: `${SOURCE}-page`,
    signal,
  })

export const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

export const extractCanonicalUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i,
  )

  return match?.[1] ? normalizeUrl(match[1]) : null
}

export const extractMetaDescription = (html = '') => {
  const match = String(html ?? '').match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
  )

  return match?.[1] ? decodeHtmlEntities(match[1]).trim() : null
}

export const extractNextData = (html = '') => {
  const match = String(html ?? '').match(
    /<script id=["']__NEXT_DATA__["'] type=["']application\/json["']>([\s\S]*?)<\/script>/i,
  )

  if (!match?.[1]) return null

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

const extractStoryText = (nextData) => {
  try {
    return JSON.stringify(nextData?.props?.pageProps?.story ?? {})
  } catch {
    return ''
  }
}

export const extractApplyUrl = (html = '') => {
  const nextData = extractNextData(html)
  const storyText = extractStoryText(nextData)
  const match = storyText.match(
    /https:\/\/forms\.office\.com\/pages\/responsepage\.aspx[^"]+|https:\/\/careers-akasa\.peoplestrong\.com\/job\/joblist/i,
  )

  if (match?.[0]) {
    return normalizeUrl(decodeHtmlEntities(match[0]))
  }

  const fallbackMatch = String(html ?? '').match(
    /https:\/\/forms\.office\.com\/pages\/responsepage\.aspx[^"'\\\s<]+|https:\/\/careers-akasa\.peoplestrong\.com\/job\/joblist/i,
  )

  return fallbackMatch?.[0] ? normalizeUrl(decodeHtmlEntities(fallbackMatch[0])) : null
}

export const hasJobPostingSignal = (html = '') =>
  /JobPosting/i.test(String(html ?? ''))

export const hasCareersLandingSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === 'Careers at Akasa Air'
    && extractCanonicalUrl(rawHtml) === CAREERS_LANDING_URL
    && normalized.includes('Important notice for job applicants')
    && /jobverification@akasaair\.com/i.test(rawHtml)
    && /pilots/i.test(rawHtml)
  }

export const extractCareerRoleUrlsFromSitemap = (sitemapXml = '') => {
  const urls = [...String(sitemapXml ?? '').matchAll(/https:\/\/www\.akasaair\.com\/careers-at-akasa-air\/[^<\s]+/gi)]
    .map((match) => normalizeUrl(match[0]))

  return ROLE_PAGE_URLS.filter((url) => urls.includes(url))
}

export const isBrokenPeopleStrongSurface = (page = {}) =>
  normalizeUrl(page.url) === BROKEN_PEOPLESTRONG_JOBLIST_URL
  && Number(page.status) === 404

export const isWorkingOfficeFormSurface = (page = {}) =>
  normalizeMicrosoftFormsUrl(page.url) === normalizeMicrosoftFormsUrl(PILOT_APPLY_URL)
  && Number(page.status) === 200
  && /Microsoft Forms/i.test(String(page.html ?? ''))

const hasVerifiedRolePageSurface = (page, role) => (
  Number(page?.status) === 200
  && extractTitle(page?.html) === role.pageTitle
  && extractCanonicalUrl(page?.html) === normalizeUrl(role.url)
  && extractApplyUrl(page?.html) === normalizeUrl(role.expectedApplyUrl)
  && hasJobPostingSignal(page?.html)
)

const mapRolePageToJob = (page, role, now) => ({
  title: role.jobTitle,
  company: COMPANY,
  department: role.department,
  location: 'India',
  city: null,
  country: 'India',
  jobId: buildJobIdFromUrl(role.url),
  requisitionId: null,
  sourceUrl: normalizeUrl(role.url),
  applyUrl: normalizeUrl(role.expectedApplyUrl),
  employmentType: null,
  experienceRequired: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: null,
  closingDate: null,
  jobDescription: extractMetaDescription(page?.html),
  source: SOURCE,
  link: normalizeUrl(role.expectedApplyUrl),
  scrapedAt: now(),
})

export const createAkasaAirScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage, signal } = {}) {
    const landingPage = await fetchPage(CAREERS_REDIRECT_URL, { signal })

    if (
      Number(landingPage.status) !== 200
      || normalizeUrl(landingPage.url) !== CAREERS_LANDING_URL
      || !hasCareersLandingSignal(landingPage.html)
    ) {
      throw new Error('Akasa Air verified careers landing page no longer matches the public surface')
    }

    const sitemapPage = await fetchPage(SITEMAP_URL, { signal })
    const sitemapRoleUrls = extractCareerRoleUrlsFromSitemap(sitemapPage.html)

    if (
      Number(sitemapPage.status) !== 200
      || JSON.stringify(sitemapRoleUrls) !== JSON.stringify(ROLE_PAGE_URLS)
    ) {
      throw new Error('Akasa Air verified role-page sitemap set no longer matches the public surface')
    }

    const jobs = []

    for (const role of VERIFIED_ROLE_PAGES) {
      const rolePage = await fetchPage(role.url, { signal })

      if (!hasVerifiedRolePageSurface(rolePage, role)) {
        throw new Error(`Akasa Air verified role page surface changed: ${role.url}`)
      }

      const applyPage = await fetchPage(role.expectedApplyUrl, { signal })

      if (normalizeUrl(role.expectedApplyUrl) === PILOT_APPLY_URL) {
        if (!isWorkingOfficeFormSurface(applyPage)) {
          throw new Error('Akasa Air verified pilot apply handoff no longer matches the public surface')
        }

        jobs.push(mapRolePageToJob(rolePage, role, now))
        continue
      }

      if (!isBrokenPeopleStrongSurface(applyPage)) {
        throw new Error('Akasa Air verified broken PeopleStrong handoff no longer matches the public surface')
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createAkasaAirScraper().run(options)

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
