import path from 'path'
import { fileURLToPath } from 'url'
import { runCurrentArbutus } from './currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://recruiting.paylocity.com/recruiting/jobs/All/f2fda2c7-bfc6-4840-90d0-83d242cada87/Arbutus-Biopharma-Inc'
const COMPANY_ID = 'f2fda2c7-bfc6-4840-90d0-83d242cada87'

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
      company: 'Arbutus Biopharma',
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

export const createArbutusScraper = (defaults = {}) => ({run: options => runCurrentArbutus({ ...defaults, ...options })})

export const run = async (options = {}) => createArbutusScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total India jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'arbutus')
}
