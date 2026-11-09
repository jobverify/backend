import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {createNativeTeradataScraper} from './native.js'

import TERADATA_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = TERADATA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const hasOfficialTeradataCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return /<title[^>]*>\s*Careers \| Teradata/i.test(page)
    && text.includes('Careers at Teradata')
    && text.includes('Explore careers')
    && /https:\/\/careers\.teradata\.com/i.test(page)
}

export {buildSearchJobsRequestBody, isTeradataSearchRequest} from './searchRequest.js'

const isIndiaJob = (node = {}) => {
  const locationText = [
    node.primaryLocation,
    ...(Array.isArray(node.places) ? node.places.map((place) => place?.name) : []),
  ]
    .filter(Boolean)
    .join(' ')

  return /\bindia\b/i.test(locationText)
}

const buildJobUrl = (job = {}) => {
  const number = normalizeWhitespace(job.number || job.key)
  const title = normalizeWhitespace(job.title)
  if (!number || !title) return null
  return `https://careers.teradata.com/jobs/${number}/${slugify(title)}`
}

export const extractJobs = (payload = {}) => {
  const nodes = payload?.data?.searchJobs?.results?.nodes
  if (!Array.isArray(nodes)) return []

  return nodes
    .filter((node) => isIndiaJob(node))
    .map((node) => {
      const title = normalizeWhitespace(node.title)
      const sourceUrl = buildJobUrl(node)
      const places = Array.isArray(node.places) ? node.places.map((place) => normalizeWhitespace(place?.name)).filter(Boolean) : []
      const location = normalizeWhitespace(node.primaryLocation) || places[0] || null
      const city = location?.split(',')[0] || null

      return {
        title,
        company: COMPANY,
        department: null,
        location,
        city,
        country: 'India',
        jobId: normalizeWhitespace(node.key || node.number),
        requisitionId: normalizeWhitespace(node.number),
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: normalizeWhitespace(node.positionType?.name),
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(node.postedOn)?.slice(0, 10) || null,
        closingDate: null,
        jobDescription: normalizeWhitespace(node.descriptionHTML),
        workplaceType: normalizeWhitespace(node.workplaceType),
      }
    })
    .filter((job) => job.title && job.jobId && job.sourceUrl)
}

export const createTeradataScraper = (defaults = {}) => createNativeTeradataScraper(defaults)

export const run = async (options = {}) => createTeradataScraper(options).run(options)

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
