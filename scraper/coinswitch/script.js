import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://recruiterflow.com/coinswitch/jobs'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (normalized === 'full time' || normalized === 'full-time') return 'Full-time'
  if (normalized === 'contract') return 'Contract'
  if (normalized?.includes('intern')) return 'Internship'
  return null
}

const getRemoteStatus = (value) => (/remote/i.test(value ?? '') ? 'Remote' : 'On-site')

const getCity = (location) => normalizeWhitespace(location)?.split(',')[0]?.trim() || null

const getJobsList = (html) => {
  const match = String(html ?? '').match(/window\.jobsList\s*=\s*(\{[\s\S]*?\});/)
  if (!match) return null

  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

export const extractRecruiterflowJobs = (html) => {
  const jobsList = getJobsList(html)
  if (!Array.isArray(jobsList?.department)) return []

  return jobsList.department.flatMap(([department, listings]) => (
    Array.isArray(listings)
      ? listings.map((listing) => {
        const title = normalizeWhitespace(listing?.job_name)
        const jobId = normalizeWhitespace(listing?.job_id)
        const location = normalizeWhitespace(listing?.details)
        const applyPath = normalizeWhitespace(listing?.apply_link)

        if (!title || !jobId || !location || !applyPath) return null

        const applyUrl = new URL(applyPath, 'https://recruiterflow.com/').href
        return {
          title,
          company: 'CoinSwitch',
          department: normalizeWhitespace(department),
          location,
          city: getCity(location),
          country: 'India',
          jobId,
          requisitionId: jobId,
          sourceUrl: applyUrl,
          applyUrl,
          employmentType: normalizeEmploymentType(listing.employment_type),
          experienceRequired: null,
          minimumQualification: null,
          preferredQualification: null,
          requiredSkills: [],
          postingDate: normalizeWhitespace(listing.last_opened),
          closingDate: null,
          jobDescription: null,
          remoteStatus: getRemoteStatus(listing.remote_type),
        }
      }).filter(Boolean)
      : []
  ))
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyBot/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createCoinSwitchScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const jobs = extractRecruiterflowJobs(await fetchText(CAREER_PAGE_URL))

    return jobs.map((job) => ({
      ...job,
      source: 'coinswitch',
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createCoinSwitchScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total India jobs scraped: ${jobs.length}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'coinswitch')
  }
}
