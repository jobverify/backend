import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BAIN_COMPANY_CATALOG, VERIFIED_INDIA_OFFICES } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BAIN_COMPANY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_HOME_URL = PROVIDER_METADATA.careersHomeUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOB_SEARCH_API_URL = PROVIDER_METADATA.jobSearchApiUrl
export const ALL_ROLES_API_URL = PROVIDER_METADATA.allRolesApiUrl
export const POSITION_APPLY_BASE_URL = PROVIDER_METADATA.positionApplyBaseUrl
export { VERIFIED_INDIA_OFFICES }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const REQUIRED_FILTER_GROUPS = ['workareas', 'teams', 'employmenttype', 'offices']
const INDIA_OFFICE_SET = new Set(VERIFIED_INDIA_OFFICES)

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&rsquo;|&#8217;|&#39;|&apos;/gi, "'")
  .replace(/&ldquo;|&rdquo;|&quot;/gi, '"')
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/&#x27;/gi, "'")
  .replace(/&#x2F;/gi, '/')

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(
    String(value ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<\/?(?:p|div|section|article|li|ul|ol|strong|span|br)\b[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  ),
)

const normalizeUrl = (value) => {
  try {
    return new URL(String(value ?? '')).href.replace(/\/+$/, '')
  } catch {
    return String(value ?? '').replace(/\/+$/, '')
  }
}

const sameUrl = (left, right) => normalizeUrl(left) === normalizeUrl(right)

const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const unique = (values = []) => [...new Set(values)]

const normalizeCategories = (value) => {
  if (!Array.isArray(value)) return []
  return unique(value.map((entry) => normalizeWhitespace(entry)).filter(Boolean))
}

const toLocationList = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeWhitespace(entry)).filter(Boolean)
  }

  const normalized = normalizeWhitespace(value)
  if (!normalized) return []

  return normalized.split(',').map((entry) => normalizeWhitespace(entry)).filter(Boolean)
}

const extractIndiaOffices = (job = {}) => unique(
  toLocationList(job.Location).filter((office) => INDIA_OFFICE_SET.has(office)),
)

const buildApiRequestHeaders = () => ({
  'user-agent': USER_AGENT,
  referer: CAREERS_URL,
  accept: 'application/json, text/javascript, */*; q=0.01',
  'x-requested-with': 'XMLHttpRequest',
})

export const hasCareersHomeSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  return /<title[^>]*>\s*Careers at Bain \| Bain &amp; Company\s*<\/title>/i.test(rawHtml)
    && /href="\/careers\/find-a-role\/"[^>]*>\s*FIND JOBS\s*<\/a>/i.test(rawHtml)
}

export const hasFindARoleSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  return /<title[^>]*>\s*Find a Role\s*\|\s*Bain &amp; Company\s*<\/title>/i.test(rawHtml)
    && /var\s+jobRoleSearchPageData\s*=/.test(rawHtml)
    && /viewJobDescriptionUrl:\s*"\/careers\/find-a-role\/position\/"/.test(rawHtml)
    && /var\s+roleSearchEndpoint\s*=\s*'\/en\/api\/jobsearch\/keyword\/get'/.test(rawHtml)
    && /var\s+autocompleteUrl\s*=\s*'\/en\/api\/jobsearch\/autocomplete\/get'/.test(rawHtml)
    && /id="role-search-page-react"/.test(rawHtml)
}

export const extractRoleSearchConfig = (html = '') => {
  const rawHtml = String(html ?? '')
  const getVarValue = (name, preferredPattern = null) => {
    const values = [...rawHtml.matchAll(new RegExp(`var\\s+${name}\\s*=\\s*'([^']+)'`, 'g'))]
      .map((match) => match[1])

    return preferredPattern
      ? values.find((value) => preferredPattern.test(value)) ?? values[0] ?? null
      : values[0] ?? null
  }
  const viewJobDescriptionUrl = rawHtml.match(/viewJobDescriptionUrl:\s*"([^"]+)"/)?.[1] ?? null
  const roleSearchEndpoint = getVarValue('roleSearchEndpoint', /\/api\/jobsearch\//)
  const autocompleteUrl = getVarValue('autocompleteUrl', /\/api\/jobsearch\//)
  const searchPaginationEndpoint = getVarValue('searchPaginationEndpoint', /\/api\/jobsearch\//)
  const resultsPerPageValue = rawHtml.match(/var\s+resultsPerPage\s*=\s*(\d+)/)?.[1] ?? null

  return {
    viewJobDescriptionUrl,
    roleSearchEndpoint,
    autocompleteUrl,
    searchPaginationEndpoint,
    resultsPerPage: resultsPerPageValue ? Number(resultsPerPageValue) : null,
  }
}

export const buildAllRolesApiUrl = (
  baseUrl = JOB_SEARCH_API_URL,
  {
    start = 0,
    results = 500,
    filters = '',
    searchValue = '',
  } = {},
) => {
  const url = new URL(baseUrl)
  url.searchParams.set('start', String(start))
  url.searchParams.set('results', String(results))
  url.searchParams.set('filters', String(filters))
  url.searchParams.set('searchValue', String(searchValue))
  return url.toString()
}

export const hasJobSearchPayloadShape = (payload = {}) => {
  if (!payload || typeof payload !== 'object') return false
  if (!Array.isArray(payload.results) || typeof payload.totalResults !== 'number') return false
  const filterGroups = Array.isArray(payload.filters?.filterBlocks)
    ? payload.filters.filterBlocks.map((block) => block?.filterGroup).filter(Boolean)
    : []

  return REQUIRED_FILTER_GROUPS.every((group) => filterGroups.includes(group))
}

const buildDepartment = (job = {}) => {
  const categories = normalizeCategories(job.Categories)
  return categories.length > 0 ? categories.join(', ') : null
}

const buildSourceUrl = (job = {}) => toAbsoluteUrl(job.Link, HOMEPAGE_URL)

const buildApplyUrl = (job = {}, sourceUrl) => {
  if (sourceUrl && sourceUrl.includes('/careers/find-a-role/position/?jobid=')) {
    return `${POSITION_APPLY_BASE_URL}${encodeURIComponent(String(job.JobId ?? ''))}`
  }

  return sourceUrl
}

const mapJob = (job = {}) => {
  const indiaOffices = extractIndiaOffices(job)
  const sourceUrl = buildSourceUrl(job)
  const applyUrl = buildApplyUrl(job, sourceUrl)

  return {
    title: normalizeWhitespace(job.JobTitle),
    department: buildDepartment(job),
    location: `${indiaOffices.join(', ')}, India`,
    city: indiaOffices[0] ?? null,
    country: 'India',
    jobId: String(job.JobId ?? ''),
    requisitionId: String(job.JobId ?? ''),
    sourceUrl,
    applyUrl,
    employmentType: normalizeWhitespace(job.EmployeeType) || null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: stripTags(job.JobDescription) || null,
  }
}

export const extractIndiaJobs = (payload = {}) => {
  if (!Array.isArray(payload.results)) return []

  return payload.results
    .filter((job) => extractIndiaOffices(job).length > 0)
    .map((job) => mapJob(job))
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: buildApiRequestHeaders(),
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    json: await response.json(),
  }
}

export const createBainCompanyScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson } = {}) {
    const careersHomePage = await fetchPage(CAREERS_HOME_URL)
    if (
      Number(careersHomePage.status) !== 200
      || !sameUrl(careersHomePage.url, CAREERS_HOME_URL)
      || !hasCareersHomeSignal(careersHomePage.html)
    ) {
      throw new Error('Bain & Company verified careers home no longer matches the public surface')
    }

    const findARolePage = await fetchPage(CAREERS_URL)
    if (
      Number(findARolePage.status) !== 200
      || !sameUrl(findARolePage.url, CAREERS_URL)
      || !hasFindARoleSignal(findARolePage.html)
    ) {
      throw new Error('Bain & Company verified find-a-role page no longer matches the public surface')
    }

    const roleSearchConfig = extractRoleSearchConfig(findARolePage.html)
    const roleSearchEndpointUrl = toAbsoluteUrl(roleSearchConfig.roleSearchEndpoint, HOMEPAGE_URL)

    if (
      roleSearchConfig.viewJobDescriptionUrl !== '/careers/find-a-role/position/'
      || roleSearchEndpointUrl !== JOB_SEARCH_API_URL
      || roleSearchConfig.autocompleteUrl !== '/en/api/jobsearch/autocomplete/get'
      || roleSearchConfig.searchPaginationEndpoint !== '/en/api/jobsearch/keyword/get'
      || roleSearchConfig.resultsPerPage !== 10
    ) {
      throw new Error('Bain & Company verified find-a-role page no longer matches the public surface')
    }

    const apiUrl = buildAllRolesApiUrl(roleSearchEndpointUrl)
    const apiResponse = await fetchJson(apiUrl)
    if (
      Number(apiResponse.status) !== 200
      || !hasJobSearchPayloadShape(apiResponse.json)
    ) {
      throw new Error('Bain & Company verified jobsearch API no longer matches the public surface')
    }

    return extractIndiaJobs(apiResponse.json).map((job) => ({
      ...job,
      company: COMPANY,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createBainCompanyScraper(options).run(options)

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
