import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'torrentgas'
export const COMPANY = 'Torrent Gas'
export const CAREERS_URL = 'https://careers.torrentgas.com/'
export const LOGIN_URL = 'https://careers.torrentgas.com/index.php/site/login'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const OFFICIAL_CAREERS_SIGNALS = [
  'careers @ torrent gas',
  'our way of life',
  "any organization's growth depends upon the dedication and synergy of its employees.",
  'torrent gas. v1.0',
]

const PUBLIC_JOB_LISTING_PATTERNS = [
  /<a[^>]*>\s*view detail\s*<\/a>/i,
  /<(?:a|button)[^>]*>\s*apply\s*<\/(?:a|button)>/i,
]

export const hasOfficialCareersShellSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return OFFICIAL_CAREERS_SIGNALS.every((signal) => normalized.includes(signal))
    && /href=["']\/index\.php\/site\/login["'][^>]*>\s*(?:<i[^>]*><\/i>\s*)?log in\s*</i.test(page)
}

export const hasNoPublicJobListingsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return normalized.includes('to apply simply chose your preferred job department as well as post, and "apply".')
    && normalized.includes('you can view the position details in "view detail".')
    && normalized.includes('to apply for multiple positions, kindly login to your account with valid email id and password')
    && /<!--\s*<div class="col-lg-1 tcolor">\s*<label>\s*Location:\s*<\/label>/i.test(page)
    && /<label>\s*Title:\s*<\/label>/i.test(page)
    && /<label>\s*Department:\s*<\/label>/i.test(page)
    && !PUBLIC_JOB_LISTING_PATTERNS.some((pattern) => pattern.test(page))
}

export const hasOfficialLoginGateSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return normalized.includes('careers @ torrent gas')
    && normalized.includes('account access')
    && normalized.includes('forgot password?')
    && normalized.includes('torrent gas. v1.0')
    && /name=["']LoginForm\[login_username\]["']/i.test(page)
    && /name=["']LoginForm\[login_password\]["']/i.test(page)
    && /name=["']LoginForm\[captcha\]["']/i.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createTorrentGasScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersShellSignal(careersHtml)) {
      throw new Error('Torrent Gas careers page no longer matches the verified official public surface')
    }

    if (!hasNoPublicJobListingsSignal(careersHtml)) {
      throw new Error('Torrent Gas public careers surface now exposes openings or changed shape')
    }

    const loginHtml = await fetchText(LOGIN_URL)
    if (!hasOfficialLoginGateSignal(loginHtml)) {
      throw new Error('Torrent Gas login gate no longer matches the verified public careers access surface')
    }

    return []
  },
})

export const run = async (options = {}) => createTorrentGasScraper().run(options)

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
