import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { GGK_TECHNOLOGIES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const REDIRECT_TARGET_URL = PROVIDER_METADATA.redirectTargetUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasRedirectedHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Your Trusted IT Solutions and Digital Transformation Company')
    && normalized.includes('Innova Solutions')
}

export const pageExposesGgkJobListings = (html = '') => {
  const publicHtml = String(html ?? '')
    .replace(/<input\b(?=[^>]*\btype\s*=\s*["']hidden["'])[^>]*>/gi, '')
  return /ggk/i.test(publicHtml) && /careers|jobs|software engineer|developer/i.test(publicHtml)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  redirect: 'follow',
  label: SOURCE,
  timeoutMs: 15000,
})

export const createGGKTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(HOMEPAGE_URL)

    if (!hasRedirectedHomepageSignal(html)) {
      throw new Error('The GGK Technologies first-party domain no longer matches the verified redirect target contract')
    }

    if (pageExposesGgkJobListings(html)) {
      throw new Error('The GGK Technologies first-party domain now exposes GGK-branded public job listings')
    }

    return []
  },
})

export const run = async (options = {}) => createGGKTechnologiesScraper().run(options)

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
