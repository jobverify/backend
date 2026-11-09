import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ellucianhighereducationsystems'
export const COMPANY = 'Ellucian Higher Education Systems'
export const COMPANY_DOMAIN = 'careers.ellucian.com'
export const INDIA_SEARCH_URL = 'https://careers.ellucian.com/jobs/locations/country/India'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeEmploymentType = (value) => {
  const cleaned = normalizeWhitespace(value).toLowerCase()
  if (cleaned === 'full time') return 'Full-time'
  return cleaned ? `${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}` : null
}

export const extractOfficialSearchConfig = (html) => {
  const jsonText = String(html ?? '').match(/window\.searchConfig\s*=\s*(\{[\s\S]*?\})\s*;/i)?.[1]
  if (!jsonText) return null

  try {
    const parsed = JSON.parse(jsonText)
    return {
      query: {
        country: parsed?.query?.country ?? null,
        internal: parsed?.query?.internal ?? null,
        separator: parsed?.query?.separator ?? null,
        facetField: parsed?.query?.facetField ?? null,
      },
      path: parsed?.path ?? null,
      numRowsPerPage: parsed?.numRowsPerPage ?? null,
    }
  } catch {
    return null
  }
}

export const hasOfficialIndiaSearchSignal = (html) => {
  const searchConfig = extractOfficialSearchConfig(html)

  return searchConfig?.query?.country === 'India'
    && searchConfig?.query?.internal === 'false'
    && searchConfig?.path === '/jobs/locations/country/India'
}

export const buildJobsApiUrl = ({ page, searchConfig }) => {
  return `https://careers.ellucian.com/api/jobs?page=${page}&country=${searchConfig.query.country}&internal=${searchConfig.query.internal}&separator=${searchConfig.query.separator}&facetField=${searchConfig.query.facetField}`
}

export const extractSearchResults = (payload) => (payload?.jobs ?? []).map((job) => ({
  title: normalizeWhitespace(job.title),
  company: COMPANY,
  department: normalizeWhitespace(job.categories?.[0]?.name) || null,
  location: [job.city, job.state, job.country].map((value) => normalizeWhitespace(value)).filter(Boolean).join(', '),
  city: normalizeWhitespace(job.city) || null,
  country: normalizeWhitespace(job.country) || null,
  jobId: String(job.req_id ?? job.slug),
  requisitionId: String(job.req_id ?? job.slug),
  sourceUrl: normalizeWhitespace(job.apply_url) || null,
  applyUrl: normalizeWhitespace(job.apply_url) || null,
  employmentType: normalizeEmploymentType(job.employment_type),
  experienceRequired: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: normalizeWhitespace(job.posted_date) || null,
  closingDate: null,
  jobDescription: stripTags(job.description) || null,
})).filter((job) => job.title && job.jobId && job.sourceUrl)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return response.text()
}

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
  })

  return response.json()
}

export const createEllucianHigherEducationSystemsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const indiaSearchHtml = await fetchText(INDIA_SEARCH_URL)
    const searchConfig = extractOfficialSearchConfig(indiaSearchHtml)

    if (!hasOfficialIndiaSearchSignal(indiaSearchHtml) || !searchConfig) {
      throw new Error('Ellucian India location page no longer matches the verified first-party Jibe surface')
    }

    return extractSearchResults(
      await fetchJson(buildJobsApiUrl({ page: 1, searchConfig })),
    ).map((job) => ({
      ...job,
      source: SOURCE,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-jibe-search',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createEllucianHigherEducationSystemsScraper().run(options)

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
