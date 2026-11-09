import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getValidIndiaCityForJob } from '../../src/utils/publicJobLocationScope.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { NK_SECURITIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = NK_SECURITIES_CATALOG.source
export const COMPANY = NK_SECURITIES_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = NK_SECURITIES_CATALOG.officialBrandName
export const VERIFIED_ON = NK_SECURITIES_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = NK_SECURITIES_CATALOG.verifiedSurfaceSummary
export const HOMEPAGE_URL = NK_SECURITIES_CATALOG.homepageUrl
export const OPEN_POSITIONS_URL = NK_SECURITIES_CATALOG.companyCareerPage
export const GREENHOUSE_JOBS_API_URL = NK_SECURITIES_CATALOG.greenhouseJobsApiUrl
export const GREENHOUSE_JOBS_API_WITH_CONTENT_URL = `${GREENHOUSE_JOBS_API_URL}?content=true`
export const GREENHOUSE_BOARD_URL = NK_SECURITIES_CATALOG.greenhouseBoardUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizePageText = (html) => normalizeWhitespace(
  String(html ?? '').replace(/<[^>]+>/g, ' '),
)

const defaultFetchPage = async (url) => {
  const html = await fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

  return {
    status: 200,
    url,
    html,
  }
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: OPEN_POSITIONS_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const splitLocationParts = (value) => String(value ?? '')
  .split(/[\/|;]+/)
  .map((part) => normalizeWhitespace(part))
  .filter(Boolean)

const preserveLeadingLocationLabel = (value) => {
  const leadingLabel = normalizeWhitespace(value)
    ?.split(/[\/|;]/)[0]
    ?.split(',')[0]
    ?.trim() ?? null

  if (!leadingLabel || /^india$/i.test(leadingLabel)) {
    return null
  }

  return leadingLabel
}

const deriveIndiaCity = (location) => {
  const primaryCity = getValidIndiaCityForJob({ location })
  if (primaryCity) {
    return preserveLeadingLocationLabel(location) ?? primaryCity
  }

  for (const token of splitLocationParts(location)) {
    const scopedCity = getValidIndiaCityForJob({ location: token })
    if (scopedCity) {
      return preserveLeadingLocationLabel(token) ?? scopedCity
    }

    const tokenCity = normalizeCity(token)
    if (tokenCity && getValidIndiaCityForJob({ city: tokenCity })) {
      return preserveLeadingLocationLabel(token) ?? tokenCity
    }
  }

  return null
}

const normalizeGreenhouseUrl = (value, jobId) => {
  const normalizedJobId = normalizeWhitespace(jobId)
  if (!normalizedJobId) return null

  try {
    const url = new URL(value)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    const pathname = url.pathname.replace(/\/+$/, '')

    if (!['job-boards.eu.greenhouse.io', 'job-boards.greenhouse.io'].includes(hostname)) {
      return null
    }

    if (pathname !== `/nksecuritiesresearch/jobs/${normalizedJobId}`) {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

const normalizeApplyUrl = (value, jobId) => {
  const sourceUrl = normalizeGreenhouseUrl(value, jobId)
  return sourceUrl ? `${sourceUrl}#application` : null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const pageText = normalizePageText(page)
  const hasVerifiedSebiMarker = /SEBI Regd\. No:\s*INZ000206920/i.test(page)
    || pageText?.includes('SEBI REG. INZ000206920')

  return /<title>\s*NK Securities Research - High Frequency Algorithmic Trading\s*<\/title>/i.test(page)
    && pageText?.includes('Where Technology Meets Markets Analyze. Execute. Excel.')
    && pageText?.includes('A high-frequency proprietary trading firm at the intersection of technology, data science, and global financial markets.')
    && pageText?.includes('We solve complex market problems in real time with speed, precision, and innovation at scale.')
    && /href=["']open-positions\.html["']/i.test(page)
    && hasVerifiedSebiMarker
}

export const extractGreenhouseApiUrl = (html) => {
  const page = String(html ?? '')
  const directMatch = page.match(
    /fetch\(\s*['"](https:\/\/api\.greenhouse\.io\/v1\/boards\/[a-z0-9-]+\/jobs)['"]\s*\)/i,
  )
  if (directMatch) return directMatch[1]

  const boardMatch = page.match(
    /\b(?:var|let|const)\s+BOARD_API\s*=\s*['"](https:\/\/api\.greenhouse\.io\/v1\/boards\/[a-z0-9-]+)['"]/i,
  )
  if (!boardMatch || !/getJson\(\s*BOARD_API\s*\+\s*['"]\/jobs\?content=true['"]\s*\)/i.test(page)) {
    return null
  }

  return `${boardMatch[1]}/jobs`
}

export const hasOfficialOpenPositionsSignal = (html) => {
  const page = String(html ?? '')
  const pageText = normalizePageText(page)

  return /<title>\s*Open Positions - NK Securities Research\s*<\/title>/i.test(page)
    && pageText?.includes('CURRENT OPENINGS')
    && pageText?.includes('Find your role')
    && /placeholder=["']Search by role(?:, team)? or location["']/i.test(page)
    && pageText?.includes('All Locations')
    && pageText?.includes('No open positions at this time. Check back soon.')
    && /id=["']ghSearch["']/i.test(page)
    && /id=["']ghLocation["']/i.test(page)
    && /id=["']gh-jobs-board["']/i.test(page)
    && extractGreenhouseApiUrl(page) !== null
}

export const extractIndiaJobsFromGreenhousePayload = (payload) => {
  const jobs = Array.isArray(payload?.jobs) ? payload.jobs : null
  if (!jobs) {
    throw new Error('NK Securities Greenhouse jobs API response no longer matches the expected payload')
  }

  return jobs
    .map((job) => {
      const location = normalizeWhitespace(job?.location?.name)
      const city = deriveIndiaCity(location)

      if (!city) {
        return null
      }

      const title = normalizeWhitespace(job?.title)
      const companyName = normalizeWhitespace(job?.company_name)
      const jobId = normalizeWhitespace(job?.id)
      const sourceUrl = normalizeGreenhouseUrl(job?.absolute_url, jobId)
      const applyUrl = normalizeApplyUrl(job?.absolute_url, jobId)

      if (companyName && companyName.toLowerCase() !== OFFICIAL_BRAND_NAME.toLowerCase()) {
        throw new Error('NK Securities Greenhouse payload no longer maps to the verified company identity')
      }

      if (!title || !location || !jobId || !sourceUrl || !applyUrl) {
        throw new Error('NK Securities Greenhouse payload no longer exposes the verified public job detail URLs')
      }

      return {
        title,
        company: OFFICIAL_BRAND_NAME,
        department: normalizeWhitespace(job?.departments?.[0]?.name),
        location,
        city,
        country: 'India',
        jobId,
        requisitionId: normalizeWhitespace(job?.requisition_id),
        sourceUrl,
        applyUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: job?.first_published ? new Date(job.first_published).toISOString() : null,
        closingDate: job?.application_deadline ? new Date(job.application_deadline).toISOString() : null,
        jobDescription: null,
      }
    })
    .filter(Boolean)
}

export const createNkSecuritiesScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = defaultNow,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('NK Securities verified homepage no longer matches the official first-party surface')
    }

    const openPositionsPage = await fetchPage(OPEN_POSITIONS_URL)
    if (openPositionsPage.status !== 200 || !hasOfficialOpenPositionsSignal(openPositionsPage.html)) {
      throw new Error('NK Securities verified open positions page no longer matches the official first-party surface')
    }

    if (extractGreenhouseApiUrl(openPositionsPage.html) !== GREENHOUSE_JOBS_API_URL) {
      throw new Error('NK Securities verified Greenhouse API contract changed on the official jobs page')
    }

    const scrapedAt = now()

    return extractIndiaJobsFromGreenhousePayload(
      await fetchJson(GREENHOUSE_JOBS_API_WITH_CONTENT_URL),
    ).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      companyCareerPage: OPEN_POSITIONS_URL,
      companyDomain: NK_SECURITIES_CATALOG.companyDomain,
      atsPlatform: NK_SECURITIES_CATALOG.atsPlatform,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createNkSecuritiesScraper(options).run(options)

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
