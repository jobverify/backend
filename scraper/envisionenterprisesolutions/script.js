import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { ENVISION_ENTERPRISE_SOLUTIONS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CONTACT_URL = PROVIDER_METADATA.contactPageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#x27;|&#39;|&apos;/gi, "'")
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

export const hasOfficialHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Envision Enterprise Solutions')
    && normalized.includes('Technology Solutions')
}

export const hasOfficialContactSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes('Jobs/Career')
    && /href=["']\/about-us\/join-us["']/i.test(page)
}

export const hasJoinUsFormSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes('Join Us | Careers | Career at Envision | Work with Envision')
    && normalized.includes('Explore your career opportunity with Envision by filling out this form')
    && /forms\.zohopublic\.com\/envisionmiddleeast\/form\/EnvisionCareers/i.test(page)
}

export const hasOfficialSitemapSignal = (xml = '') => {
  const sitemap = String(xml ?? '')
  return /https:\/\/www\.envisionesl\.com\/about-us\/contact-us/i.test(sitemap)
    && /https:\/\/www\.envisionesl\.com\/about-us\/join-us/i.test(sitemap)
}

export const hasPublicJobsSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return /\b(open positions|job openings|current openings|vacancies|job id|software engineer)\b/i
    .test(normalized)
}

export const createEnvisionEnterpriseSolutionsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Envision Enterprise Solutions verified homepage surface changed materially')
    }

    const contactHtml = await fetchText(CONTACT_URL)
    if (!hasOfficialContactSignal(contactHtml)) {
      throw new Error('Envision Enterprise Solutions verified contact surface changed materially')
    }

    const joinUsHtml = await fetchText(CAREERS_URL)
    if (hasPublicJobsSignal(joinUsHtml)) {
      throw new Error('Envision Enterprise Solutions public jobs surface changed materially')
    }

    if (!hasJoinUsFormSignal(joinUsHtml)) {
      throw new Error('Envision Enterprise Solutions verified form-only careers surface changed materially')
    }

    const sitemapXml = await fetchText(SITEMAP_URL)
    if (!hasOfficialSitemapSignal(sitemapXml)) {
      throw new Error('Envision Enterprise Solutions verified sitemap surface changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createEnvisionEnterpriseSolutionsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
