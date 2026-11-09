import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import provider from './provider.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = provider
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#8217;|&#39;|&apos;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const text = normalizeWhitespace(html)

  return /JOIN THE T-CREW/i.test(text)
    && /Careers at Tarento/i.test(text)
    && /careers@tarento\.com/i.test(text)
    && /open positions/i.test(text)
}

export const extractChallengeTitles = (html = '') => {
  const text = normalizeWhitespace(html)
  const titles = []

  if (/Mobile Interaction Design/i.test(text)) titles.push('Mobile Interaction Design')
  if (/Design a Clock Application/i.test(text)) titles.push('Design a Clock Application')

  return titles
}

const extractPublicJobLinks = (html = '') => [...new Set(
  [...String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => toAbsoluteUrl(match[1]))
    .filter(Boolean)
    .filter((url) => /tarento\.com/i.test(url))
    .filter((url) => /(jobs?|positions?|openings?|apply|data-engineer|software-engineer)/i.test(url))
    .filter((url) => url !== CAREERS_URL),
)]

export const run = async ({ fetchText = defaultFetchText } = {}) => {
  const careersHtml = await fetchText(CAREERS_URL)

  if (!hasOfficialCareersSignal(careersHtml)) {
    throw new Error('Tarento verified careers page no longer matches the trusted first-party surface')
  }

  if (extractPublicJobLinks(careersHtml).length > 0) {
    throw new Error('Tarento public jobs surface changed materially; replace the fail-closed sentinel with a real scraper')
  }

  return []
}

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
