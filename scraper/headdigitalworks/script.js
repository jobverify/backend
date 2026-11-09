import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { HEAD_DIGITAL_WORKS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = HEAD_DIGITAL_WORKS_CATALOG.source
export const COMPANY = HEAD_DIGITAL_WORKS_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = HEAD_DIGITAL_WORKS_CATALOG.officialBrandName
export const CAREERS_URL = HEAD_DIGITAL_WORKS_CATALOG.companyCareerPage
export const LEVER_BOARD_URL = 'https://jobs.lever.co/hdworks'
export const LEVER_POSTINGS_API_URL = 'https://api.lever.co/v0/postings/hdworks?mode=json'
export const VERIFIED_ON = HEAD_DIGITAL_WORKS_CATALOG.verifiedOn
export const PROVIDER_METADATA = HEAD_DIGITAL_WORKS_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const isHttp404Error = (error) => /HTTP 404/i.test(String(error?.message ?? error))

export const hasVerifiedCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Join our Team - Head Digital Works\s*<\/title>/i.test(page)
    && /Life at HDW/i.test(page)
    && /Explore Opportunites|Explore Opportunities/i.test(page)
    && /Can't find your perfect fit\?/i.test(page)
    && /Follow Head Digital Works on Linkedin/i.test(page)
}

export const hasMissingLeverBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return /Sorry,\s*we couldn't find anything here/i.test(page)
    || /404 error/i.test(page)
    || /No job postings currently open/i.test(page)
    || /Check back later!/i.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  method: options.method,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createHeadDigitalWorksScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasVerifiedCareersSignal(careersHtml)) {
      throw new Error('Head Digital Works careers page no longer matches the verified first-party surface')
    }

    let leverBoardMatchesVerifiedMissingState = false

    try {
      const leverBoardHtml = await fetchText(LEVER_BOARD_URL)
      leverBoardMatchesVerifiedMissingState = hasMissingLeverBoardSignal(leverBoardHtml)
    } catch (error) {
      if (isHttp404Error(error)) {
        leverBoardMatchesVerifiedMissingState = true
      } else {
        throw error
      }
    }

    if (!leverBoardMatchesVerifiedMissingState) {
      throw new Error('Head Digital Works Lever board no longer matches the verified missing-or-empty state')
    }

    let leverApiMatchesVerifiedMissingState = false

    try {
      const payload = await fetchJson(LEVER_POSTINGS_API_URL, { method: 'GET' })
      leverApiMatchesVerifiedMissingState = Array.isArray(payload) && payload.length === 0
    } catch (error) {
      if (isHttp404Error(error)) {
        leverApiMatchesVerifiedMissingState = true
      } else {
        throw error
      }
    }

    if (!leverApiMatchesVerifiedMissingState) {
      throw new Error('Head Digital Works Lever postings API no longer matches the verified missing-board state')
    }

    return []
  },
})

export const run = async (options = {}) => createHeadDigitalWorksScraper(options).run(options)

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
