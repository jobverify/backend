import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { NTRUST_INFOTECH_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = NTRUST_INFOTECH_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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

export const hasVerifiedCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return /<title>\s*NTrust - Revolutionizing Commercial Real Estate Management\s*<\/title>/i.test(String(html ?? ''))
    && normalized.includes('Join the team')
    && normalized.includes('View Open Roles')
    && normalized.includes('applicant tracking system')
    && normalized.includes('Engineering & Data Science')
}

export const hasOnlyGenericAtsRoleCards = (html = '') => {
  const matches = [...String(html ?? '').matchAll(/<a[^>]*(?:href=["']([^"']+)["'][^>]*class=["'][^"']*role-card[^"']*["']|class=["'][^"']*role-card[^"']*["'][^>]*href=["']([^"']+)["'])/gi)]
    .map((match) => match[1] || match[2])
  return matches.length > 0 && matches.every((href) => href === '#')
}

export const pageExposesDirectJobLinks = (html = '') =>
  [...String(html ?? '').matchAll(/<a[^>]*(?:href=["']([^"']+)["'][^>]*class=["'][^"']*role-card[^"']*["']|class=["'][^"']*role-card[^"']*["'][^>]*href=["']([^"']+)["'])/gi)]
    .map((match) => match[1] || match[2])
    .some((href) => href && href !== '#')

export const createNtrustInfotechScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (pageExposesDirectJobLinks(careersHtml)) {
      throw new Error('The Ntrust Infotech first-party careers page now exposes direct public jobs')
    }
    if (!hasVerifiedCareersSignal(careersHtml)) {
      throw new Error('The trusted Ntrust Infotech careers page changed materially')
    }
    if (!hasOnlyGenericAtsRoleCards(careersHtml)) {
      throw new Error('The Ntrust Infotech careers page no longer matches the verified generic ATS handoff shell')
    }

    return []
  },
})

export const run = async (options = {}) => createNtrustInfotechScraper().run(options)

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
