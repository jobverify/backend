import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { inspectSightSpectrumCareers, runCurrentSightSpectrum } from './nativeCareers.js'

import SIGHTSPECTRUM_TECHNOLOGY_SOLUTIONS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SIGHTSPECTRUM_TECHNOLOGY_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const extractListItems = (html = '') => [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

const inferRemoteStatus = (location) => {
  if (/\bremote\b/i.test(location)) return 'Remote'
  return 'On-site'
}

const inferCountry = (location) => {
  if (/^India$/i.test(normalizeWhitespace(location))) return 'India'
  if (/^(?:USA|United States)$/i.test(normalizeWhitespace(location))) return 'United States'
  return null
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Join Our Team')
    && normalized.includes('positions currently open at SightSpectrum')
  }

export const extractJobs = (html = '') => /type=["']application\/ld\+json["']/i.test(html)
  ? inspectSightSpectrumCareers(html).jobs
  : [...String(html ?? '').matchAll(
  /<section[^>]*class=["'][^"']*job-opening[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi,
)]
  .map((match) => {
    const block = match[1]
    const title = normalizeWhitespace(block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1])
    const paragraphs = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((paragraph) => normalizeWhitespace(paragraph[1]))
      .filter(Boolean)
    const location = paragraphs[0] || null
    const jobDescription = normalizeWhitespace(block) || null
    const requiredSkills = extractListItems(block.match(/<h3[^>]*>\s*Requirements\s*<\/h3>([\s\S]*?)<\/ul>/i)?.[1])
    const country = inferCountry(location || '')

    if (!title || !location) return null

    return {
      title,
      company: COMPANY,
      department: null,
      location,
      city: normalizeWhitespace(location.split(',')[0] || location),
      country,
      jobId: slugify(title),
      requisitionId: slugify(title),
      sourceUrl: CAREERS_URL,
      applyUrl: null,
      employmentType: null,
      experienceRequired: jobDescription?.match(/\b\d+(?:\s*[-–]\s*\d+)?\+?\s+years?\b/i)?.[0] || null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription,
      remoteStatus: inferRemoteStatus(location),
      sourceDetailComplete: false,
      sourceListingComplete: false,
    }
  })
  .filter(Boolean)

export const createSightSpectrumTechnologySolutionsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  run: (options = {}) => runCurrentSightSpectrum({ ...options, now }),
})

export const run = async (options = {}) => createSightSpectrumTechnologySolutionsScraper().run(options)

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
