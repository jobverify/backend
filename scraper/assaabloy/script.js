import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.assaabloy.com/career/en/open-positions'
// Configured by the official careers page's gw-group-job-openings-grid component.
export const JOBS_API_URL = 'https://integration-hub-prod-assets.globalweb.aws.assaabloy.com/job-openings/jobs.json'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const unique = (values) => [...new Set(values.filter(Boolean))]

const extractIndiaLocations = (locations) => unique(
  (Array.isArray(locations) ? locations : [])
    .filter((location) => /india/i.test(String(location?.country || '')))
    .map((location) => normalizeWhitespace(location?.city))
    .filter((city) => city && city !== '-'),
)

const buildDescription = (item, cities) => normalizeWhitespace([
  item?.jobFunction?.category ? `Category: ${item.jobFunction.category}.` : null,
  item?.jobFunction?.name ? `Function: ${item.jobFunction.name}.` : null,
  item?.officePresence ? `Office presence: ${item.officePresence}.` : null,
  cities.length > 0 ? `Locations: ${cities.join(', ')}, India.` : null,
].filter(Boolean).join(' '))

export const buildSearchUrl = () => JOBS_API_URL

export const extractSearchResults = (payload) => {
  if (
    !Array.isArray(payload?.items)
    || !Number.isInteger(payload?.itemsTotalCount)
    || payload.itemsTotalCount < 0
    || payload.items.length !== payload.itemsTotalCount
  ) {
    throw new Error('ASSA ABLOY job inventory is malformed or incomplete')
  }

  const items = payload.items

  return items
    .map((item) => {
      const cities = extractIndiaLocations(item.locations)
      if (cities.length === 0) return null

      const jobId = normalizeWhitespace(item.jobReqId)
      const jobDescription = buildDescription(item, cities)

      return {
        title: normalizeWhitespace(item.title),
        company: 'ASSA ABLOY',
        department: normalizeWhitespace(item?.jobFunction?.name || item?.jobFunction?.category),
        location: `${cities.join(', ')}, India`,
        city: cities[0] || null,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: normalizeWhitespace(item.applicationUrl),
        applyUrl: normalizeWhitespace(item.applicationUrl),
        employmentType: 'Full-time',
        experienceRequired: normalizeWhitespace(item?.experienceLevel?.name),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(item.postStartDate),
        closingDate: normalizeWhitespace(item.applicationDueDate),
        jobDescription,
        publicExperienceChecked: Boolean(jobDescription),
      }
    })
    .filter(Boolean)
}

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    Accept: 'application/json',
  },
  label: 'assaabloy',
})

export const createAssaAbloyScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchJson = options.fetchJson || defaultFetchJson
    const payload = await fetchJson(buildSearchUrl())
    const jobs = extractSearchResults(payload)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'assaabloy',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createAssaAbloyScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ASSA ABLOY scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'assaabloy')
    console.log('DB result:', result)
    process.exit(0)
  }
}
