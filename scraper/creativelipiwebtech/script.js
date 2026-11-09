import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { CREATIVELIPI_WEBTECH_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CONTACT_URL = PROVIDER_METADATA.companyCareerPage
export const PAGE_SITEMAP_URL = 'https://creativelipi.com/page-sitemap.xml'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
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
  return normalized.includes('Creative Lipi')
    && normalized.includes('Scalable Business Solutions for Smarter Growth')
}

export const hasOfficialContactPageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Contact Us')
    && normalized.includes('Creative Lipi')
}

export const hasExpectedPageSitemapSurface = (xml = '') => {
  const page = String(xml ?? '')
  return /https:\/\/creativelipi\.com\/<\/loc>/i.test(page)
    && /https:\/\/creativelipi\.com\/contact-us\/<\/loc>/i.test(page)
}

export const hasCareersLikeRoute = (xml = '') =>
  /https:\/\/creativelipi\.com\/[^<]*(careers?|jobs?|join-us|joinus|work-with-us|workwithus)[^<]*/i
    .test(String(xml ?? ''))

export const createCreativelipiWebtechScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Creativelipi Webtech verified homepage surface changed materially')
    }

    const contactHtml = await fetchText(CONTACT_URL)
    if (!hasOfficialContactPageSignal(contactHtml)) {
      throw new Error('Creativelipi Webtech verified contact page surface changed materially')
    }

    const pageSitemapXml = await fetchText(PAGE_SITEMAP_URL)
    if (!hasExpectedPageSitemapSurface(pageSitemapXml)) {
      throw new Error('Creativelipi Webtech verified page sitemap changed materially')
    }

    if (hasCareersLikeRoute(pageSitemapXml)) {
      throw new Error('Creativelipi Webtech public jobs surface changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createCreativelipiWebtechScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
