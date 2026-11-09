import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { EDR_CONTINUOUS_INFORMATION_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const COMMON_CAREERS_URLS = [
  'https://www.edrinfo.net/careers',
  'https://www.edrinfo.net/career',
  'https://www.edrinfo.net/jobs',
  'https://www.edrinfo.net/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
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

const fetchOptionalText = async (fetchText, url) => {
  try {
    return await fetchText(url)
  } catch {
    return null
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const text = normalizeWhitespace(html)
  return /Global Resources At Your Command/i.test(text)
    && /Why EDR/i.test(text)
    && /Contact Us/i.test(text)
}

export const hasCareersOrJobsSurfaceSignal = (html = '') => {
  const text = normalizeWhitespace(html)
  return !/404|not found/i.test(text)
    && /(careers|career opportunities|open positions|current openings|join us|jobs)/i.test(text)
}

export const hasPublicJobSignal = (html = '') =>
  /class=["'][^"']*job[-\s]?card/i.test(String(html ?? ''))
  || /href=["'][^"']*(?:\/jobdetails\/|\/applyjob\/|\/jobs\/)[^"']*["']/i.test(String(html ?? ''))

export const createEdrContinuousInformationScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('EDR Continuous Information verified official homepage no longer matches the trusted surface')
    }

    for (const candidateUrl of COMMON_CAREERS_URLS) {
      if (candidateUrl === HOMEPAGE_URL) continue

      const candidateHtml = await fetchOptionalText(fetchText, candidateUrl)
      if (!candidateHtml) continue

      if (hasPublicJobSignal(candidateHtml) || hasCareersOrJobsSurfaceSignal(candidateHtml)) {
        throw new Error('EDR Continuous Information exact-name domain now appears to expose a careers or jobs surface')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createEdrContinuousInformationScraper().run(options)

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
