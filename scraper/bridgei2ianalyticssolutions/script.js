import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { BRIDGEI2I_ANALYTICS_SOLUTIONS_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = PROVIDER_METADATA.source
export const HOMEPAGE_URL = PROVIDER_METADATA.companyCareerPage
export const ACQUISITION_NOTICE_URL = PROVIDER_METADATA.acquisitionNoticeUrl

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")

const stripTags = (value) => String(value ?? '').replace(/<[^>]+>/g, ' ')
const normalizeWhitespace = (value) => decodeHtmlEntities(value).replace(/\s+/g, ' ').trim()

export const hasRedirectedHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(stripTags(html))

  return normalized.includes('Artificial Intelligence (AI) Services & Solutions')
    && normalized.includes('Data careers')
    && normalized.includes('Search open roles')
    && normalized.includes('Accenture')
}

export const hasAcquisitionNoticeSignal = (html = '') => {
  const normalized = normalizeWhitespace(stripTags(html))

  return normalized.includes('BRIDGEi2i is now part of Accenture.')
    && normalized.includes('Accenture Completes Acquisition of BRIDGEi2i')
}

export const pageExposesDedicatedBridgei2iJobs = (html = '') => {
  const normalized = normalizeWhitespace(stripTags(html))
  return /\bbridgei2i\b/i.test(normalized)
    && (/\bcareers\b/i.test(normalized)
      || /\bcurrent openings\b/i.test(normalized)
      || /\bjob openings\b/i.test(normalized)
      || /\bapply now\b/i.test(normalized)
      || /\/jobs\/[a-z0-9-]+/i.test(String(html ?? '')))
}

const isRetiredLegacyDomainError = (error) => /HTTP 404 for https:\/\/bridgei2i\.com\/?/i.test(
  String(error?.message ?? error ?? ''),
)

export const createBridgei2iAnalyticsSolutionsScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    try {
      const homepageHtml = await fetchText(HOMEPAGE_URL)
      if (!hasRedirectedHomepageSignal(homepageHtml)) {
        throw new Error('The verified Bridgei2i homepage no longer matches the redirected Accenture parent surface')
      }

      if (pageExposesDedicatedBridgei2iJobs(homepageHtml)) {
        throw new Error('Bridgei2i now appears to expose dedicated public openings and needs a real scraper')
      }
    } catch (error) {
      if (!isRetiredLegacyDomainError(error)) throw error
    }

    const acquisitionNoticeHtml = await fetchText(ACQUISITION_NOTICE_URL)
    if (!hasAcquisitionNoticeSignal(acquisitionNoticeHtml)) {
      throw new Error('The verified Bridgei2i acquisition notice changed and needs manual review')
    }

    if (pageExposesDedicatedBridgei2iJobs(acquisitionNoticeHtml)) {
      throw new Error('Bridgei2i acquisition notice unexpectedly exposes public openings and needs a dedicated scraper')
    }

    return []
  },
})

export const run = async (options = {}) => createBridgei2iAnalyticsSolutionsScraper(options).run(options)

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
