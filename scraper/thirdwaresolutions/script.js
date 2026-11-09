import path from 'node:path'
import { fileURLToPath } from 'node:url'

import THIRDWARE_SOLUTIONS_CATALOG from './catalog.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = THIRDWARE_SOLUTIONS_CATALOG.source
export const COMPANY = THIRDWARE_SOLUTIONS_CATALOG.companyName
export const PROVIDER_METADATA = THIRDWARE_SOLUTIONS_CATALOG
export const VERIFIED_ON = THIRDWARE_SOLUTIONS_CATALOG.verifiedOn
export const CANDIDATE_ROUTE_URLS = THIRDWARE_SOLUTIONS_CATALOG.candidateRouteUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    attempts: 1,
    label: SOURCE,
    timeoutMs: 15000,
  })

export const isTrustedOfflineFailure = (error) => {
  const message = String(error?.message ?? error).toLowerCase()

  return message.includes('timed out')
    || message.includes('connect timeout')
    || message.includes('could not connect')
    || message.includes('connection was closed')
    || message.includes("certificate's altnames")
    || message.includes('err_tls_cert_altname_invalid')
}

export const hasPublicJobsSurfaceSignal = (html) =>
  /\b(current openings|open positions|job openings|apply now)\b/i.test(String(html ?? ''))
    || /\/job(s)?\//i.test(String(html ?? ''))

export const run = async ({ fetchText = defaultFetchText } = {}) => {
  for (const url of CANDIDATE_ROUTE_URLS) {
    try {
      const html = await fetchText(url)
      if (hasPublicJobsSurfaceSignal(html)) {
        throw new Error('Thirdware Solutions now exposes a public jobs surface')
      }
    } catch (error) {
      if (isTrustedOfflineFailure(error)) {
        continue
      }

      throw error
    }
  }

  return []
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
