import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mycaptain'
export const COMPANY = 'MyCaptain'
export const HOMEPAGE_URL = 'https://mycaptain.in/'
export const CAREER_URL = 'https://mycaptain.in/career'
export const CAREERS_URL = 'https://mycaptain.in/careers'
export const JOB_URL = 'https://mycaptain.in/job'
export const JOBS_URL = 'https://mycaptain.in/jobs'
export const VERIFIED_ON = '2026-08-15'
export const VERIFIED_ROUTE_URLS = [
  HOMEPAGE_URL,
  CAREER_URL,
  CAREERS_URL,
  JOB_URL,
  JOBS_URL,
]

const COMPANY_DOMAIN = 'mycaptain.in'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&quot;/gi, '"')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const countMatches = (value, pattern) => [...String(value ?? '').matchAll(pattern)].length

const parseNextData = (html) => {
  const match = String(html ?? '').match(
    /<script id=["']__NEXT_DATA__["'] type=["']application\/json["']>([\s\S]*?)<\/script>/i,
  )

  if (!match) return null

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*MyCaptain - E-Learning Platform with Job Ready &amp; Certification Programs\s*<\/title>/i.test(page)
    && /Transform your Career with/i.test(text)
    && /3,80,000\+\s+learners already have!/i.test(text)
    && /\bHiring Partners\b/i.test(text)
    && /https:\/\/app\.mycaptain\.in\//i.test(page)
    && /Imarticus Learning Pvt Ltd/i.test(text)
}

export const hasOfficialCareerPageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)
  const nextData = parseNextData(page)

  return nextData?.page === '/career'
    && /scripts\.zipteams\.com\/v2\.0\/index\.js/i.test(page)
    && /Join us in creating an Impact/i.test(text)
    && /See Current Openings/i.test(text)
    && /Current Job Openings/i.test(text)
    && /placeholder=["']Search by job role["']/i.test(page)
    && /All departments \(\d+\)/i.test(text)
    && /linkedin\.com\/company\/mycaptain-in\//i.test(page)
    && /Imarticus Learning Pvt Ltd/i.test(text)
}

const ZERO_JOBS_PATTERN = /\b(no current openings|no open positions|no jobs available|check back later)\b/i
const JOB_CARD_START_PATTERN = /<div class="jobOpenings_jobCards__[A-Za-z0-9_]+ card">/gi

const extractCardSegments = (html) => {
  const page = String(html ?? '')
  const startIndexes = [...page.matchAll(JOB_CARD_START_PATTERN)]
    .map((match) => match.index)
    .filter((index) => Number.isInteger(index))

  if (startIndexes.length === 0) return []

  return startIndexes.map((startIndex, index) => {
    const endIndex = index + 1 < startIndexes.length
      ? startIndexes[index + 1]
      : page.indexOf('<div class="footer_footerContainer', startIndex)

    return page.slice(startIndex, endIndex > startIndex ? endIndex : undefined)
  })
}

const extractTitle = (segmentHtml) => normalizeWhitespace(
  segmentHtml.match(/<div class="jobOpenings_jobTitle__[A-Za-z0-9_]+ card-title h5">([\s\S]*?)<\/div>/i)?.[1],
)

const extractLocation = (segmentHtml) => stripTags(
  segmentHtml.match(/<p[^>]*class="nextImageBlock card-text"[^>]*>([\s\S]*?)<\/p>/i)?.[1],
)

export const extractInlineJobCards = (html) => {
  if (!hasOfficialCareerPageSignal(html)) {
    throw new Error('MyCaptain verified first-party /career page no longer matches the known public shell')
  }

  const segments = extractCardSegments(html)

  if (segments.length === 0) {
    if (ZERO_JOBS_PATTERN.test(stripTags(html))) {
      return []
    }

    throw new Error('MyCaptain verified first-party /career page no longer exposes inline job cards')
  }

  const jobCounts = new Map()

  return segments.map((segmentHtml) => {
    const title = extractTitle(segmentHtml)
    const location = extractLocation(segmentHtml)

    if (!title || !location) {
      throw new Error('MyCaptain verified first-party /career page inline job cards changed shape')
    }

    const city = normalizeWhitespace(location.split(',')[0]) || location
    const baseSlug = slugify(`${title}-${location}`)
    const seenCount = (jobCounts.get(baseSlug) ?? 0) + 1
    jobCounts.set(baseSlug, seenCount)

    const jobId = `${SOURCE}-${baseSlug}${seenCount > 1 ? `-${seenCount}` : ''}`

    return {
      title,
      company: COMPANY,
      location,
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREER_URL,
      applyUrl: null,
      department: null,
      employmentType: null,
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
}

export const hasVerifiedDeploymentPausedSignal = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const text = stripTags(rawHtml)
  const serverHeader = String(page?.headers?.server ?? '').toLowerCase()

  return Number(page?.status) === 402
    && /<title>\s*Deployment Paused\s*<\/title>/i.test(rawHtml)
    && text.includes('Deployment Paused')
    && text.includes('This deployment is temporarily paused')
    && serverHeader.includes('vercel')
}

export const isMyCaptainVerifiedTimeoutBlocker = (error) =>
  /connect timeout error|timed out|timeout|fetch failed|getaddrinfo|err_connection_timed_out|other side closed|terminated/i
    .test(String(error?.message ?? error?.cause?.message ?? error ?? ''))

const defaultFetchPage = async (url, { signal } = {}) => {
  signal?.throwIfAborted()
  const deadline = AbortSignal.timeout(15000)
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
  })

  return {
    status: response.status,
    url: response.url,
    headers: {
      server: response.headers.get('server'),
    },
    html: await response.text(),
  }
}

export const createMyCaptainScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage = defaultFetchPage, now: overrideNow, signal } = {}) {
    signal?.throwIfAborted()
    try {
      const routePages = new Map()
      const loadPage = async (url) => {
        signal?.throwIfAborted()
        if (!routePages.has(url)) {
          routePages.set(url, await fetchPage(url, { signal }))
          signal?.throwIfAborted()
        }

        return routePages.get(url)
      }

      const homepage = await loadPage(HOMEPAGE_URL)
      const careerPage = await loadPage(CAREER_URL)

      if (homepage.status === 200) {
        if (!hasOfficialHomepageSignal(homepage.html)) {
          throw new Error('MyCaptain verified official homepage no longer matches the known accessible first-party surface')
        }

        if (careerPage.status !== 200 || !hasOfficialCareerPageSignal(careerPage.html)) {
          throw new Error('MyCaptain /career page no longer matches the verified accessible jobs surface')
        }

        const jobs = extractInlineJobCards(careerPage.html)
        const capturedAt = (overrideNow || now)()

        return attachInventoryEvidence(jobs.map((job) => ({
          ...job,
          source: SOURCE,
          scrapedAt: capturedAt,
          companyCareerPage: CAREER_URL,
          companyDomain: COMPANY_DOMAIN,
          atsPlatform: 'official-company-careers',
          sourceListingComplete: false,
          sourceDetailComplete: false,
        })), {
          status: 'coverage-gap', surface: CAREER_URL, firstParty: true,
          listingComplete: false, pagesFetched: routePages.size,
          reportedTotal: null, indiaFacetCount: null, verifiedAt: capturedAt,
          reason: 'native-cards-without-verified-full-role-details-or-application-entry',
        })
      }

      for (const url of VERIFIED_ROUTE_URLS.slice(2)) {
        await loadPage(url)
      }

      if (VERIFIED_ROUTE_URLS.every((url) => hasVerifiedDeploymentPausedSignal(routePages.get(url)))) {
        throw Object.assign(new Error('MyCaptain public deployment is paused; native inventory unavailable'), {
          softFailure: true, failureKind: 'upstream_inventory_unavailable',
          abortRetries: true, status: 402,
        })
      }

      throw new Error('MyCaptain first-party public routes no longer match either the verified reachable jobs shell or the verified deployment-paused sentinel')
    } catch (error) {
      signal?.throwIfAborted()
      throw error
    }
  },
})

export const run = async (options = {}) => createMyCaptainScraper().run(options)

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
