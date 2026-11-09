import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ELASTIC_RUN_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ELASTIC_RUN_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_PAGE_URL = PROVIDER_METADATA.careersPageUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const PORTAL_ORIGIN = PROVIDER_METADATA.portalOrigin
export const JOB_LISTINGS_URL = PROVIDER_METADATA.jobListingsUrl
export const DEFAULT_PAGE_SIZE = 20
export const DEFAULT_SEARCH_BODY = {}

const JOBS_API_PATH = `${PORTAL_ORIGIN}/api/cp/rest/altone/cp/jobs/v1`
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const firstNonEmpty = (...values) => {
  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    if (normalized) return normalized
  }

  return null
}

const extractCity = (location) => normalizeWhitespace(String(location ?? '').split(',')[0]) || null

const extractCountry = (record = {}, location = null) => firstNonEmpty(
  record.country,
  Array.isArray(record.countryList) ? record.countryList[0] : null,
  /\bindia\b/i.test(String(location ?? '')) ? 'India' : null,
)

const flattenSkills = (skills = {}) => {
  if (Array.isArray(skills)) {
    return [...new Set(skills.map((skill) => normalizeWhitespace(skill)).filter(Boolean))]
  }

  return [...new Set(
    [skills.mustTohave, skills.goodtohave]
      .flatMap((group) => Array.isArray(group) ? group : [])
      .map((skill) => normalizeWhitespace(skill))
      .filter(Boolean),
  )]
}

export const buildApiUrl = ({ offset = 0, limit = DEFAULT_PAGE_SIZE } = {}) => (
  `${JOBS_API_PATH}?offset=${offset}&limit=${limit}`
)

export const buildJobDetailUrl = (jobCode) => (
  jobCode ? `${PORTAL_ORIGIN}/job/detail/${encodeURIComponent(jobCode)}` : null
)

export const buildPublicHeaders = () => ({
  Origin: PORTAL_ORIGIN,
  Referer: JOB_LISTINGS_URL,
  'User-Agent': USER_AGENT,
  Accept: 'application/json,text/plain,*/*',
  'Content-Type': 'application/json',
})

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/javascript,application/javascript,application/xml,text/plain,*/*',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: options.headers,
    body: options.body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const hasOfficialCareersShell = (html = '') => {
  const rawHtml = String(html ?? '')

  return /<title>\s*ElasticRun - India's Commerce Enabler\s*<\/title>/i.test(rawHtml)
    && /<div id="root"><\/div>/i.test(rawHtml)
    && /\/assets\/index-[^"']+\.js/i.test(rawHtml)
}

export const extractClientBundleUrl = (html = '') => {
  const match = String(html ?? '').match(/<script[^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/i)
  if (!match) return null

  try {
    return new URL(match[1], CAREERS_PAGE_URL).toString()
  } catch {
    return null
  }
}

export const sitemapHasCareersRoute = (xml = '') => (
  /<loc>\s*https:\/\/elastic\.run\/careers\/?\s*<\/loc>/i.test(String(xml ?? ''))
)

export const hasVerifiedCareersBundleHandoff = (bundleText = '') => {
  const text = String(bundleText ?? '')

  return text.includes("Careers at ElasticRun | Join India's Fastest Growing Company")
    && text.includes('Turbo charge your career')
    && text.includes('View Open Roles')
    && text.includes('Great Place to Work certified')
    && text.includes('https://elasticruncareers.peoplestrong.com/job/joblist')
}

export const hasPublicPortalShell = (html = '') => {
  const rawHtml = String(html ?? '')

  return /<title>\s*Candidate Portal\s*<\/title>/i.test(rawHtml)
    && /<app-root\b[^>]*data-testid=["']src-index-app-root-page-1["']/i.test(rawHtml)
    && /candidate-portal/i.test(rawHtml)
    && /main-[A-Z0-9]+\.js/i.test(rawHtml)
}

export const extractSearchResults = (payload = {}) => (
  Array.isArray(payload.response) ? payload.response : []
)
  .map((record) => {
    const title = firstNonEmpty(record.jobTitle, record.title, record.designation, record.name)
    const jobCode = firstNonEmpty(record.jobCode, record.reqCode, record.requisitionId, record.jobId)
    const sourceUrl = firstNonEmpty(record.jobDetailUrl, buildJobDetailUrl(jobCode))
    const location = firstNonEmpty(record.locationHierarchy, record.location, record.locationName)

    if (!title || !jobCode || !sourceUrl) return null

    return {
      title,
      company: COMPANY,
      department: firstNonEmpty(record.organizationUnit, record.department, record.departmentName),
      location,
      city: extractCity(location),
      country: extractCountry(record, location),
      jobId: firstNonEmpty(record.jobCode, record.jobId, record.requisitionId),
      requisitionId: firstNonEmpty(record.requisitionId, record.jobCode, record.jobId),
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: firstNonEmpty(
        record.employmentTenureType,
        record.employmentType,
        record.jobType,
      ),
      experienceRequired: firstNonEmpty(record.expRange, record.experience, record.experienceRange),
      minimumQualification: firstNonEmpty(record.minimumQualification, record.minQualification),
      preferredQualification: firstNonEmpty(record.preferredQualification, record.prefQualification),
      requiredSkills: flattenSkills(record.skills),
      postingDate: firstNonEmpty(record.jobPostedDate, record.postingDate, record.postedOn),
      closingDate: firstNonEmpty(record.jobClosureDate, record.closingDate, record.expiryDate),
      jobDescription: firstNonEmpty(record.jobDescription, record.description),
    }
  })
  .filter(Boolean)

export const createElasticRunScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    pageSize = DEFAULT_PAGE_SIZE,
    maxPages = Number.POSITIVE_INFINITY,
  } = {}) {
    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersShell(careersPage.html)) {
      throw new Error('ElasticRun verified official careers shell no longer matches the known public surface')
    }

    const sitemapXml = await fetchText(SITEMAP_URL)
    if (!sitemapHasCareersRoute(sitemapXml)) {
      throw new Error('ElasticRun sitemap no longer publishes the known careers route')
    }

    const bundleUrl = extractClientBundleUrl(careersPage.html)
    if (!bundleUrl) {
      throw new Error('ElasticRun verified official careers shell no longer exposes the known client bundle')
    }

    const careersBundle = await fetchText(bundleUrl)
    if (!hasVerifiedCareersBundleHandoff(careersBundle)) {
      throw new Error('ElasticRun verified careers bundle no longer contains the known PeopleStrong handoff')
    }

    const portalPage = await fetchPage(JOB_LISTINGS_URL)
    if (![200, 404].includes(portalPage.status) || !hasPublicPortalShell(portalPage.html)) {
      throw new Error('ElasticRun verified public PeopleStrong portal no longer matches the known public surface')
    }

    const jobs = []

    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * pageSize
      const payload = await fetchJson(buildApiUrl({ offset, limit: pageSize }), {
        method: 'POST',
        headers: buildPublicHeaders(),
        body: JSON.stringify(DEFAULT_SEARCH_BODY),
      })

      const pageJobs = extractSearchResults(payload)
      jobs.push(...pageJobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      })))

      const responseCount = Array.isArray(payload?.response) ? payload.response.length : 0
      const totalRecords = Number.parseInt(String(payload?.totalRecords ?? ''), 10)

      if (responseCount === 0) break
      if (Number.isFinite(totalRecords) && offset + responseCount >= totalRecords) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createElasticRunScraper().run(options)

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
