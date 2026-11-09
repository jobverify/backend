import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { PRATIAN_TECHNOLOGIES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = PROVIDER_METADATA.source
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const stripTags = (value) => String(value ?? '').replace(/<[^>]+>/g, ' ')
const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

export const hasOfficialCareersShellSignal = (html = '') => {
  const normalized = normalizeWhitespace(stripTags(html))

  return normalized.includes('Pratian')
    && /<app-root/i.test(String(html ?? ''))
    && /main\.[^"']+\.js/i.test(String(html ?? ''))
}

export const extractBundlePath = (html = '') => {
  const match = String(html ?? '').match(/<script[^>]+src="([^"]*main\.[^"]+\.js)"[^>]*type="module"[^>]*><\/script>/i)
  if (!match) return null

  try {
    return new URL(match[1], CAREERS_URL).toString()
  } catch {
    return null
  }
}

export const bundleHasExpectedCareerMessaging = (bundleText = '') => {
  const normalized = normalizeWhitespace(bundleText)
  const expectedPhrases = [
    'At Pratian, it is all about you.',
    'nurture',
    'challenge',
    'celebrate',
    'trust',
  ]

  return /path:\s*"career"/i.test(normalized)
    && expectedPhrases.every((phrase) => normalized.toLowerCase().includes(phrase.toLowerCase()))
}

export const bundleExposesStructuredJobListings = (bundleText = '') =>
  /current openings/i.test(String(bundleText ?? ''))
  || /apply now/i.test(String(bundleText ?? ''))
  || /\/jobs\/[a-z0-9-]+/i.test(String(bundleText ?? ''))
  || /job openings/i.test(String(bundleText ?? ''))

export const isCertificateExpiredError = (error) => {
  let current = error

  while (current) {
    if (current?.code === 'CERT_HAS_EXPIRED') return true
    if (/certificate has expired/i.test(String(current?.message ?? current))) return true
    current = current?.cause
  }

  return false
}

export const createPratianTechnologiesScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    let careersHtml
    try {
      careersHtml = await fetchText(CAREERS_URL)
    } catch (error) {
      if (isCertificateExpiredError(error)) return []
      throw error
    }

    if (!hasOfficialCareersShellSignal(careersHtml)) {
      throw new Error('The verified Pratian careers shell changed; refusing to assume there are still no public jobs')
    }

    if (bundleExposesStructuredJobListings(careersHtml)) {
      throw new Error('The verified Pratian careers shell now appears to expose public listings and needs a dedicated scraper')
    }

    const bundleUrl = extractBundlePath(careersHtml)
    if (!bundleUrl) {
      throw new Error('Unable to locate the verified Pratian careers bundle')
    }

    let bundleText
    try {
      bundleText = await fetchText(bundleUrl)
    } catch (error) {
      if (isCertificateExpiredError(error)) return []
      throw error
    }

    if (!bundleHasExpectedCareerMessaging(bundleText)) {
      throw new Error('The verified Pratian careers bundle changed and needs manual review before assuming no public jobs')
    }

    if (bundleExposesStructuredJobListings(bundleText)) {
      throw new Error('The verified Pratian careers bundle now appears to expose public job listings and needs a dedicated scraper')
    }

    return []
  },
})

export const run = async (options = {}) => createPratianTechnologiesScraper(options).run(options)

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
