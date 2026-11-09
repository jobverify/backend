import path from 'path'
import { fileURLToPath } from 'url'

import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const CLIENT_GUID = '28fad22cfe584b879917858203dd97ce'
const COMPANY_NAME = 'Aptiv'
const SOURCE = 'aptiv'

export const SEARCH_API_URL = 'https://aptivcareers.searchapi-na.hawksearch.com/api/v2/search/'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const firstValue = (value) => Array.isArray(value) ? value[0] ?? null : value ?? null

const extractExperienceRequired = (html) => {
  const normalized = normalizeWhitespace(
    String(html ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
  const match = /Experience:\s*([^<\n]+?)(?:Key Responsibilities:|Qualifications|Privacy Notice|$)/i.exec(normalized)
  return match ? normalizeWhitespace(match[1]) : null
}

const inferExperienceFromDescription = (jobDescription) => {
  const normalizedDescription = normalizeWhitespace(
    String(jobDescription ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
  if (!normalizedDescription) return null

  const experienceProfile = extractJobFilterSignals({
    description: normalizedDescription,
  })?.experienceProfile
  const evidence = normalizeWhitespace(experienceProfile?.evidence)

  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
      ? 'No experience required'
      : evidence
  )
}

export const buildSearchRequestPayload = ({
  pageNo = 1,
  keyword = '',
  facets = { country: ['India'] },
} = {}) => ({
  ClientData: {
    UserAgent: null,
    VisitId: null,
    VisitorId: null,
    Custom: { custom: 'en' },
  },
  Keyword: keyword,
  FacetSelections: { ...facets },
  PageNo: pageNo,
  IndexName: '',
  IgnoreSpellcheck: false,
  IsInPreview: true,
  ClientGuid: CLIENT_GUID,
  Is100CoverageTurnedOn: false,
})

export const normalizeJobListing = (document = {}) => {
  const jobDescription = firstValue(document.jobdescription) || null

  return {
    title: normalizeWhitespace(firstValue(document.title)),
    company: COMPANY_NAME,
    location: normalizeWhitespace(firstValue(document.primarylocation) || firstValue(document.location)),
    city: normalizeWhitespace(firstValue(document.primarycity) || firstValue(document.city)),
    country: normalizeWhitespace(firstValue(document.primarycountry) || firstValue(document.country)),
    link: normalizeWhitespace(firstValue(document.link)),
    applyUrl: normalizeWhitespace(firstValue(document.externalapplyurl)),
    sourceUrl: normalizeWhitespace(firstValue(document.link)),
    source: SOURCE,
    jobId: normalizeWhitespace(firstValue(document.jobrequisitionid)),
    requisitionId: normalizeWhitespace(firstValue(document.jobrequisitionid)),
    department: normalizeWhitespace(firstValue(document.category) || firstValue(document.jobfamilygroup)),
    employmentType: null,
    experienceRequired: extractExperienceRequired(jobDescription) || inferExperienceFromDescription(jobDescription),
    jobDescription,
    publicExperienceChecked: Boolean(jobDescription),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(firstValue(document.created_moment)),
    scrapedAt: new Date().toISOString(),
  }
}

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'POST',
    headers: options.headers,
    body: options.body,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const createAptivScraper = () => ({
  async run({
    maxPages = Number.POSITIVE_INFINITY,
    maxJobs = Number.POSITIVE_INFINITY,
    fetchJson = defaultFetchJson,
  } = {}) {
    const jobs = []

    for (let pageNo = 1; pageNo <= maxPages; pageNo += 1) {
      const payload = buildSearchRequestPayload({ pageNo })
      const response = await fetchJson(SEARCH_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'X-HawkSearch-ClientGuid': CLIENT_GUID,
        },
        body: JSON.stringify(payload),
      })

      const documents = Array.isArray(response?.Results)
        ? response.Results.map((item) => item?.Document).filter(Boolean)
        : []

      for (const document of documents) {
        const job = normalizeJobListing(document)
        if (!job.title || !job.sourceUrl) continue
        jobs.push(job)
        if (jobs.length >= maxJobs) return jobs
      }

      const totalPages = Number.parseInt(response?.Pagination?.NofPages, 10)
      if (!Number.isFinite(totalPages) || pageNo >= totalPages || documents.length === 0) {
        break
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createAptivScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Aptiv scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
