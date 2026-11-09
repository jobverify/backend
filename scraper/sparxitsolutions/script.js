import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SPARX_IT_SOLUTIONS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const APPLY_URL = 'mailto:talent@sparxitsolutions.com'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#8217;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const getAccordionBlocks = (html = '') => String(html ?? '')
  .split(/<hr class="bottom-line">/i)
  .map((block) => block.trim())
  .filter((block) => /Profile:/i.test(block))

const extractDescription = (normalizedBlock) => {
  const summaryMatch = normalizedBlock.match(/SUMMARY:\s*(.+?)\s+Apply$/i)
  if (summaryMatch) return summaryMatch[1].trim()

  const responsibilitiesMatch = normalizedBlock.match(/Key Responsibilities:\s*(.+?)\s+Apply$/i)
  if (responsibilitiesMatch) return responsibilitiesMatch[1].trim()

  return null
}

const extractEligibility = (normalizedBlock) => {
  const match = normalizedBlock.match(/Eligibility Criteria \(Educational\):\s*(.+?)\s+(?:SUMMARY:|Key Responsibilities:)/i)
  return match ? match[1].trim() : null
}

const extractLocation = (locationText) => {
  const cleaned = String(locationText ?? '').trim()
  const cityMatch = cleaned.match(/^([^()]+?)(?:\s*\(|$)/)
  const city = cityMatch ? cityMatch[1].trim() : cleaned

  return {
    location: `${cleaned}, India`,
    city: city || null,
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Profile: Senior Android Developer')
    && normalized.includes('Profile: Project Consultant')
    && normalized.includes('Profile: Python Developer')
    && /mailto:talent@sparxitsolutions\.com/i.test(String(html ?? ''))
}

export const extractJobCards = (html = '') => getAccordionBlocks(html)
  .map((block) => {
    const normalized = normalizeWhitespace(block)
    const headerMatch = normalized.match(
      /Profile:\s*(.+?)\s+Position(?:s)?\s*:\s*([0-9]+)\s+Experience:\s*(.+?)\s+Location:\s*(.+?)\s+Eligibility Criteria/i,
    )

    if (!headerMatch) return null

    const title = headerMatch[1].trim()
    const experienceRequired = headerMatch[3].trim()
    const locationText = headerMatch[4].trim()
    const { location, city } = extractLocation(locationText)
    const description = extractDescription(normalized)
    const eligibility = extractEligibility(normalized)
    const applyMatch = block.match(/href="(mailto:[^"]+)"/i)

    return {
      title,
      company: COMPANY,
      department: null,
      location,
      city,
      state: null,
      country: 'India',
      jobId: slugify(title),
      requisitionId: slugify(title),
      sourceUrl: CAREERS_URL,
      applyUrl: applyMatch ? applyMatch[1] : APPLY_URL,
      employmentType: null,
      experienceRequired,
      minimumQualification: eligibility,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: description,
      remoteStatus: null,
    }
  })
  .filter(Boolean)

export const createSparxItSolutionsScraper = ({
  maxJobs = null,
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = defaultNow,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified SPARX IT Solutions careers accordion changed materially')
    }

    const jobs = extractJobCards(careersHtml)
    if (jobs.length === 0) {
      throw new Error('The verified SPARX IT Solutions careers accordion no longer exposes public role blocks')
    }

    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createSparxItSolutionsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
