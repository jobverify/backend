import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { HUMANHIRECORP_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = HUMANHIRECORP_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const PAGE_URLS = [
  'https://humanhirecorp.com/leadership-board',
  'https://humanhirecorp.com/life-at-humanhire',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/â€“/g, '-')
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

export const hasOfficialSpaShellSignal = (html = '') => {
  const raw = String(html ?? '')
  const normalized = normalizeWhitespace(raw)

  return /Human Hire Corp/i.test(raw)
    && /Global Recruitment\s*&\s*Staffing\s+(?:Partner|Solutions)/i.test(normalized)
    && /<div id="root"><\/div>/i.test(raw)
    && /\/assets\/index-[A-Za-z0-9]+\.js/i.test(raw)
}

export const hasServerRenderedEmployerJobsSignal = (html = '') =>
  /current openings|job openings|apply now|href=["'][^"']*(job-opening|careers|jobs|apply)[^"']*["']/i.test(
    normalizeWhitespace(html),
  )

export const run = async ({ fetchText = defaultFetchText } = {}) => {
  for (const url of PAGE_URLS) {
    const html = await fetchText(url)

    if (hasServerRenderedEmployerJobsSignal(html)) {
      throw new Error('HumanHire Corp server-rendered employer jobs appeared on the verified recruitment SPA shell')
    }

    if (!hasOfficialSpaShellSignal(html)) {
      throw new Error('HumanHire Corp verified recruitment SPA shell changed materially')
    }
  }

  return []
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
