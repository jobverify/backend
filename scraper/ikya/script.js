import {createNativeGetSource} from '../../scraper-support/native-sources/publicNativeGetSources/nativeCareers.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchPageWithRetry } from '../../scraper-support/utils/fetchPageWithRetry.js'

import { IKYA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = IKYA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()

const stripTags = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const defaultFetchPage = (url) => fetchPageWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const extractPublicJobLinksFromBoard = (html = '') => {
  const links = new Set()
  const page = String(html ?? '')

  for (const match of page.matchAll(/<a\b[^>]+href="([^"]+)"[^>]*>/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], CAREERS_URL)
    if (!absoluteUrl) continue
    if (!absoluteUrl.startsWith(`${CAREERS_URL}/`)) continue
    links.add(absoluteUrl)
  }

  return [...links]
}

export const hasVerifiedEmptyBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Careers at ikya\s*<\/title>/i.test(page)
    && /Jobs at ikya/i.test(page)
    && /No job postings are currently available\./i.test(page)
    && /(https?:\/\/)?www\.ikya\.com\/?/i.test(page)
    && extractPublicJobLinksFromBoard(page).length === 0
}

export const hasHomepagePlaceholderSignal = (body = '') => {
  const rawBody = String(body ?? '')
  const normalized = normalizeWhitespace(stripTags(rawBody))
  const hasBrowserChallengeSignal =
    /<title>\s*Checking your browser\.\.\.\s*<\/title>/i.test(rawBody)
    && /Security check/i.test(rawBody)
    && /Before you can access this site,\s*we need to verify/i.test(rawBody)
    && /Verification failed\.\s*Please refresh and try again\./i.test(rawBody)

  if (
    normalized.length > 0
    && normalized.length <= 10
    && !/<html|<head|<body|<title/i.test(rawBody)
  ) {
    return true
  }

  return hasBrowserChallengeSignal
    || (
      /<title>\s*www\.ikya\.com\s*-\s*Coming Soon\s*<\/title>/i.test(rawBody)
      && /This domain is coming soon\./i.test(normalized)
    )
}

export const createIkyaScraper = (defaults = {}) => createNativeGetSource('ikya', defaults)

export const run = async (options = {}) => createIkyaScraper().run(options)

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
