import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DIRECTI_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DIRECTI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const BROKEN_LEVER_BOARD_URL = PROVIDER_METADATA.brokenLeverBoardUrl
export const BROKEN_LEVER_API_URL = PROVIDER_METADATA.brokenLeverApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, HOMEPAGE_URL).toString()
  } catch {
    return null
  }
}

const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/, '')

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /Directi/i.test(text)
    && /href=["']https:\/\/careers\.directi\.com\/?["']/i.test(page)
    && />\s*CAREERS\s*</i.test(page)
}

export const extractCareersUrl = (html = '') => {
  const match = String(html ?? '').match(/<a[^>]+href=["'](https:\/\/careers\.directi\.com\/?)["'][^>]*>\s*CAREERS\s*<\/a>/i)
  if (!match?.[1]) return null

  try {
    return new URL(match[1]).toString()
  } catch {
    return null
  }
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /Careers\s+[—-]\s+Directi/i.test(text)
    && /We.?re looking for passionate, out-of-the-box thinkers/i.test(text)
    && /View job posting/i.test(text)
}

export const extractBrokenLeverBoardUrl = (html = '') => {
  const match = String(html ?? '').match(/window\.open\(['"](https:\/\/jobs\.lever\.co\/directi)['"]\)/i)
  return match?.[1] || null
}

export const isVerifiedMissingLeverSurface = ({ status, url, html }) => {
  if (Number(status) !== 404) return false
  if (!/^https:\/\/(?:jobs|api)\.lever\.co\/.+/i.test(String(url ?? ''))) return false

  return /404/i.test(String(html ?? ''))
    || /not found/i.test(String(html ?? ''))
}

export const createDirectiScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Directi homepage no longer matches the verified public surface')
    }

    if (normalizeUrl(extractCareersUrl(homepage.html)) !== normalizeUrl(CAREERS_URL)) {
      throw new Error('Directi homepage careers handoff changed materially')
    }

    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200 || !hasVerifiedCareersPageSignal(careersPage.html)) {
      throw new Error('Directi careers page no longer matches the verified public surface')
    }

    if (extractBrokenLeverBoardUrl(careersPage.html) !== BROKEN_LEVER_BOARD_URL) {
      throw new Error('Directi careers handoff changed materially')
    }

    const brokenBoard = await fetchPage(BROKEN_LEVER_BOARD_URL)
    if (!isVerifiedMissingLeverSurface(brokenBoard)) {
      throw new Error('Directi Lever surface no longer matches the verified missing-jobs state')
    }

    const brokenApi = await fetchPage(BROKEN_LEVER_API_URL)
    if (!isVerifiedMissingLeverSurface(brokenApi)) {
      throw new Error('Directi Lever surface no longer matches the verified missing-jobs state')
    }

    return []
  },
})

export const run = async (options = {}) => createDirectiScraper().run(options)

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
