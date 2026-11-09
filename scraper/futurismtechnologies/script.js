import path from 'node:path'
import { fileURLToPath } from 'node:url'

import FUTURISM_TECHNOLOGIES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = FUTURISM_TECHNOLOGIES_CATALOG.source
export const COMPANY = FUTURISM_TECHNOLOGIES_CATALOG.companyName
export const PROVIDER_METADATA = FUTURISM_TECHNOLOGIES_CATALOG
export const VERIFIED_ON = FUTURISM_TECHNOLOGIES_CATALOG.verifiedOn
export const CAREERS_URL = FUTURISM_TECHNOLOGIES_CATALOG.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return response.text()
}

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()

export const hasCloudflareBlockSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('attention required! | cloudflare')
    && normalized.includes('sorry, you have been blocked')
    && normalized.includes('unable to access futurismtechnologies.com')
}

export const run = async ({ fetchText = defaultFetchText } = {}) => {
  const careersHtml = await fetchText(CAREERS_URL)

  if (hasCloudflareBlockSignal(careersHtml)) {
    return []
  }

  throw new Error('Futurism Technologies careers surface changed materially or now exposes a public jobs surface')
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
