import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://recruiting.paylocity.com/recruiting/jobs/All/2ae5a3ce-3398-4774-8bea-215d1adff90f/Clarity-Benefit-Solutions'
const COMPANY_ID = '2ae5a3ce-3398-4774-8bea-215d1adff90f'

const formatLocation = ({ City: city, State: state, Country: country } = {}) =>
  [city, state, country].filter(Boolean).join(', ') || null

const parsePageData = (html) => {
  const serialized = String(html ?? '').match(/window\.pageData\s*=\s*([\s\S]*?);\s*<\/script>/i)?.[1]
  if (!serialized) return null

  try {
    return JSON.parse(serialized)
  } catch {
    return null
  }
}

export const extractSearchResults = (html) => (parsePageData(html)?.Jobs || [])
  .filter((job) => job?.JobLocation?.Country === 'India')
  .map((job) => {
    const jobId = String(job.JobId)

    return {
      title: job.JobTitle,
      company: 'Clarity Benefit Solutions',
      department: job.HiringDepartment || null,
      location: formatLocation(job.JobLocation),
      city: job.JobLocation?.City || null,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREER_PAGE_URL,
      applyUrl: `https://recruiting.paylocity.com/Recruiting/Jobs/Details/${jobId}/${COMPANY_ID}`,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: job.PublishedDate || null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
      compensation: null,
    }
  })

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; JobverifyBot/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createClarityScraper = ({ fetchText = defaultFetchText } = {}) => ({
  async run({ fetchText: overrideFetchText } = {}) {
    const jobs = extractSearchResults(await (overrideFetchText || fetchText)(CAREER_PAGE_URL))

    return jobs.map((job) => ({
      ...job,
      source: 'clarity',
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createClarityScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total India jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'clarity')
}
