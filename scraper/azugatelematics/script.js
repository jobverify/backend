import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { provider as PROVIDER_METADATA } from './provider.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export { PROVIDER_METADATA }

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasVerifiedAzugaCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  return /<title>\s*Get info about the latest career opportunities at Azuga\s*\|\s*Azuga\s*<\/title>/i.test(page)
    && normalized.includes('Careers @ Azuga')
    && normalized.includes('Take a look at our open positions.')
    && normalized.includes('No items found.')
    && /bebridgestone\.com/i.test(page)
}

export const hasPublicAzugaJobSignal = (html) => {
  const page = String(html ?? '')
  return /@type"\s*:\s*"JobPosting"/i.test(page)
    || /\bapply now\b/i.test(page)
    || /\bopen positions\b/i.test(page) && !/\bno items found\b/i.test(page)
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createAzugaTelematicsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const page = await fetchPage(CAREERS_URL)
    if (page.status !== 200 || !hasVerifiedAzugaCareersSignal(page.html)) {
      throw new Error('Azuga careers page no longer matches the verified no-openings first-party surface')
    }
    if (hasPublicAzugaJobSignal(page.html)) {
      throw new Error('Azuga careers page now exposes public openings')
    }
    return []
  },
})

export const run = async (options = {}) => createAzugaTelematicsScraper().run(options)

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
