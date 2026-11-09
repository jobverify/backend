import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'xcaliberinfotech'
export const COMPANY = 'Xcaliber Infotech'
export const HOMEPAGE_URL = 'https://xcaliberinfotech.com/'
export const CAREERS_URL = 'https://xcaliberinfotech.com/search-jobs/'
export const COMPANY_DOMAIN = 'xcaliberinfotech.com'
export const ATS_PLATFORM = 'sucuri-blocked-first-party-careers-shell'
export const VERIFIED_ON = '2026-07-18'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const REQUEST_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

const createManualFetchSignal = () =>
  typeof AbortSignal?.timeout === 'function'
    ? AbortSignal.timeout(15000)
    : undefined

const fetchTextWithCapturedHttpBody = async (url) => {
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
    redirect: 'manual',
    signal: createManualFetchSignal(),
  })
  const html = await response.text()

  if (response.ok) {
    return html
  }

  const error = new Error(`HTTP ${response.status} for ${url}`)
  error.status = response.status
  error.responseBody = html
  throw error
}

const defaultFetchText = async (url) => {
  try {
    return await fetchTextWithRetry(url, {
      headers: REQUEST_HEADERS,
      label: `${SOURCE}-html`,
      timeoutMs: 15000,
    })
  } catch (error) {
    if (!hasHttpStatus(error, 307)) {
      throw error
    }

    return fetchTextWithCapturedHttpBody(url)
  }
}

export const hasVerifiedBlockedCareersSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*You are being redirected\.\.\.\s*<\/title>/i.test(page)
    && /Javascript is required\./i.test(page)
    && /sucuri_cloudproxy_js/i.test(page)
}

const findErrorInChain = (error, predicate) => {
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    if (predicate(current)) {
      return current
    }
    current = current?.cause
  }

  return null
}

const hasHttpStatus = (error, status) =>
  Boolean(findErrorInChain(error, (candidate) => Number(candidate?.status) === status))

const hasVerifiedBlockedCareersError = (error) =>
  Boolean(
    findErrorInChain(
      error,
      (candidate) =>
        Number(candidate?.status) === 307
        && hasVerifiedBlockedCareersSignal(candidate?.responseBody),
    ),
  )

export const createXcaliberInfotechScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    let careersHtml
    try {
      careersHtml = await fetchText(CAREERS_URL)
    } catch (error) {
      if (hasVerifiedBlockedCareersError(error)) {
        return []
      }

      throw error
    }

    if (!hasVerifiedBlockedCareersSignal(careersHtml)) {
      throw new Error('Xcaliber Infotech verified first-party careers shell changed materially and no longer matches the blocked public surface')
    }

    return []
  },
})

export const run = async (options = {}) => createXcaliberInfotechScraper().run(options)

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
