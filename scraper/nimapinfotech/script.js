import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import NIMAP_INFOTECH_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = NIMAP_INFOTECH_CATALOG.source
export const COMPANY = NIMAP_INFOTECH_CATALOG.companyName
export const CAREERS_URL = NIMAP_INFOTECH_CATALOG.companyCareerPage

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

export const hasVerifiedNoFirstPartyJobsSignal = (html = '') => {
  const page = String(html ?? '')

  return /Life at Nimap Infotech/i.test(page)
    && /therecruiter\.co\.in\/career\/1/i.test(page)
    && /Careers/i.test(page)
  }

export const hasFirstPartyJobsSurfaceSignal = (html = '') =>
  /https?:\/\/nimapinfotech\.com\/(?:careers|jobs)\/[a-z0-9-]+\/?/i.test(String(html ?? ''))
    || /\b(current openings|job openings|apply now)\b/i.test(String(html ?? ''))
      && !/therecruiter\.co\.in\/career\/1/i.test(String(html ?? ''))

export const run = async ({ fetchText = defaultFetchText } = {}) => {
  const careersHtml = await fetchText(CAREERS_URL)

  if (hasFirstPartyJobsSurfaceSignal(careersHtml)) {
    throw new Error('Nimap Infotech now exposes a first-party jobs surface')
  }

  if (!hasVerifiedNoFirstPartyJobsSignal(careersHtml)) {
    throw new Error('The verified Nimap Infotech careers shell no longer matches the external-handoff no-jobs state')
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
