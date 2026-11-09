import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import RAJA_SOFTWARE_LABS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = RAJA_SOFTWARE_LABS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const text = stripTags(html)
  return /<h1[^>]*>\s*Current Openings\s*<\/h1>/i.test(String(html ?? ''))
    && text.includes('To apply for a specific job')
    && /careers@rajasoftwarelabs\.com/i.test(text)
}

const buildAbsoluteUrl = (href) => {
  try {
    return new URL(href, CAREERS_URL).toString()
  } catch {
    return null
  }
}

export const extractJobs = (html = '', scrapedAt = new Date().toISOString()) => {
  const jobs = []
  const openingsListHtml = String(html ?? '').match(
    /To apply for a specific job[\s\S]*?<ul>([\s\S]*?)<\/ul>/i,
  )?.[1] ?? ''
  const pattern = /<li>\s*<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>\s*<\/li>/gi

  for (const match of openingsListHtml.matchAll(pattern)) {
    const applyUrl = buildAbsoluteUrl(match[1])
    const title = normalizeWhitespace(match[2])
    if (!applyUrl || !title) continue

    jobs.push({
      title,
      company: COMPANY,
      location: 'Pune, Maharashtra, India',
      city: 'Pune',
      country: 'India',
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      requiredSkills: [],
      jobDescription: null,
      publicExperienceChecked: true,
      source: SOURCE,
      link: applyUrl,
      scrapedAt,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    })
  }

  return jobs
}

export const createRajaSoftwareLabsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(html)) {
      throw new Error('The verified Raja Software Labs current openings page changed materially')
    }

    return extractJobs(html, now())
  },
})

export const run = async (options = {}) => createRajaSoftwareLabsScraper(options).run(options)

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
