import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { UNICOMMERCE_ESOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = UNICOMMERCE_ESOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return /<title>\s*Current Openings,\s*Jobs at unicommerce\s*-\s*Unicommerce\.com\s*<\/title>/i.test(String(html ?? ''))
    && normalized.includes('Current openings are:')
    && normalized.includes('Senior/Java Developer')
}

export const extractJobs = (html = '') =>
  [...String(html ?? '').matchAll(/<section[^>]*class=["'][^"']*opening[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi)]
    .map((match) => {
      const block = match[1]
      const title = normalizeWhitespace(block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i)?.[1])
      const minimumQualification = normalizeWhitespace(block.match(/Qualification\s*:\s*([^<]+)/i)?.[1])
      const experienceRequired = normalizeWhitespace(block.match(/Experience\s*:\s*([^<.]+(?:\.[^<]+)?)/i)?.[1])?.replace(/\.$/, '')
      const paragraphs = [...block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
        .map((item) => normalizeWhitespace(item[1]))
        .filter(Boolean)
      const jobDescription = paragraphs.find((item) => item.startsWith('The ideal candidates'))

      if (!title || !jobDescription) return null

      return {
        title,
        company: COMPANY,
        department: 'Engineering',
        location: 'India',
        city: null,
        country: 'India',
        jobId: slugify(title),
        requisitionId: slugify(title),
        sourceUrl: CAREERS_URL,
        applyUrl: CAREERS_URL,
        employmentType: null,
        experienceRequired: experienceRequired || null,
        minimumQualification: minimumQualification || null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription,
        remoteStatus: null,
      }
    })
    .filter(Boolean)

export const createUnicommerceEsolutionsScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Unicommerce current openings page no longer matches the trusted first-party page')
    }

    const jobs = extractJobs(careersHtml)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: CAREERS_URL,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createUnicommerceEsolutionsScraper().run(options)

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
