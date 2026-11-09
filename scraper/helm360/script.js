import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { HELM360_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = HELM360_CATALOG.source
export const COMPANY = HELM360_CATALOG.companyName
export const CAREERS_URL = HELM360_CATALOG.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")

const stripTags = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(stripTags(value))
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const isIndeedUrl = (value) => {
  try {
    return /(^|\.)indeed\.com$/i.test(new URL(value).hostname)
  } catch {
    return false
  }
}

export const extractOpenJobsLinks = (html = '') => [...String(html ?? '').matchAll(
  /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
)]
  .map((match) => ({
    href: normalizeText(match[1]),
    text: normalizeText(match[2]),
  }))
  .filter((link) => link.href && /search open jobs|check out our current openings!?/i.test(link.text ?? ''))

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /Fast-Paced\., High-Growth\., International\., Remote\./i.test(page)
    && /Search Open Jobs/i.test(page)
    && /Check out our current openings!/i.test(page)
    && /Work with us!/i.test(page)
}

export const hasVerifiedIndeedHandoffOnly = (html = '') => {
  const links = extractOpenJobsLinks(html)
  return links.length >= 2 && links.every((link) => isIndeedUrl(link.href))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createHelm360Scraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Helm360 careers page no longer matches the trusted first-party surface')
    }

    if (!hasVerifiedIndeedHandoffOnly(careersHtml)) {
      throw new Error('Helm360 careers page no longer matches the verified Indeed handoff-only surface')
    }

    return []
  },
})

export const run = async (options = {}) => createHelm360Scraper().run(options)

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
