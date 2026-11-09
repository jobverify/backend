import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { URJANET_ENERGY_SOLUTIONS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const ACQUISITION_BLOG_URL = 'https://www.arcadia.com/blog/arcadia-acquires-urjanet'
export const URJANET_REDIRECT_URL = 'https://www.urjanet.com/'
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/â€”|—/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

export const hasAcquisitionBlogSignal = (html = '') => {
  const text = normalizeWhitespace(html)
  return text.includes('arcadia acquires urjanet')
    && text.includes('urjanet, the largest utility data provider in the world, is now part of arcadia.')
    && text.includes('the urjanet data network will significantly expand arc')
}

export const hasRedirectPlatformSignal = (html = '') => {
  const text = normalizeWhitespace(html)
  return text.includes('the most comprehensive energy data platform | arcadia')
    && text.includes('power every decision with energy intelligence.')
    && text.includes('the arcadia platform')
}

export const hasParentCareersSignal = (html = '') => {
  const text = normalizeWhitespace(html)
  return text.includes('careers | arcadia')
    && text.includes('change the future of energy with us')
    && text.includes('view job openings')
}

export const createUrjanetEnergySolutionsScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const acquisitionBlogHtml = await fetchText(ACQUISITION_BLOG_URL)
    const redirectPlatformHtml = await fetchText(URJANET_REDIRECT_URL)
    const careersHtml = await fetchText(CAREERS_URL)

    if (
      !hasAcquisitionBlogSignal(acquisitionBlogHtml)
      || !hasRedirectPlatformSignal(redirectPlatformHtml)
      || !hasParentCareersSignal(careersHtml)
    ) {
      throw new Error('Urjanet Energy Solutions verified acquisition evidence changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createUrjanetEnergySolutionsScraper(options).run(options)

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
