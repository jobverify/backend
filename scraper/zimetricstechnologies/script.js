import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { ZIMETRICS_TECHNOLOGIES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/&/g, ' ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes('Careers at Zimetrics')
    && normalized.includes('We are Hiring!')
    && normalized.includes('Join A Community Where You Can Thrive')
    && (/href=["'][^"']*#frmsub["']/i.test(page) || /id=["']frmsub["']/i.test(page))
    && /Apply Now/i.test(page)
}

export const extractJobsFromHtml = (html = '') => {
  const jobs = []
  const seen = new Set()
  const defaultApplyUrl = new URL('#frmsub', CAREERS_URL).toString()
  const cardPattern = /<p class="elementor-heading-title elementor-size-default">((?:(?!<\/?p\b)[\s\S])*?)<\/p>[\s\S]{0,500}?<p class="elementor-heading-title elementor-size-default">\|\s*([^<|]+?)\s*\|<\/p>[\s\S]{0,500}?(?:<a[^>]+href="([^"]*#frmsub|#frmsub)"[\s\S]{0,250}?Apply Now|<p class="elementor-heading-title elementor-size-default">\s*Apply Now\s*<\/p>)/gi

  for (const match of html.matchAll(cardPattern)) {
    const titleLine = normalizeWhitespace(match[1])
    const locationText = normalizeWhitespace(match[2])
    const applyUrl = match[3] ? new URL(match[3], CAREERS_URL).toString() : defaultApplyUrl
    const parts = titleLine.split('|').map((part) => normalizeWhitespace(part)).filter(Boolean)
    const title = parts[0] || null
    const experienceRequired = parts[1] || null
    const jobKey = `${slugify(title)}__${slugify(locationText)}`

    if (!title || !locationText || seen.has(jobKey)) continue
    seen.add(jobKey)

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: `${locationText}, India`,
      city: locationText,
      country: 'India',
      jobId: jobKey,
      requisitionId: jobKey,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    })
  }

  return jobs
}

export const createZimetricsTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Zimetrics Technologies verified first-party careers page changed materially')
    }

    const jobs = extractJobsFromHtml(careersHtml)
    if (!jobs.length) {
      throw new Error('Zimetrics Technologies verified first-party careers page changed materially')
    }

    return jobs.map((job) => ({
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

export const run = async (options = {}) => createZimetricsTechnologiesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
