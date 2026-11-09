import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = 'riscvinternational'
export const COMPANY = 'RISC-V International'
export const VERIFIED_ON = '2026-07-25'
export const ABOUT_URL = 'https://riscv.org/about/'
export const JOBS_BOARD_URL = 'https://riscv.org/community/jobs/'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasNonprofitAboutSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''

  return /RISC-V International is the global non-profit home of the open standard RISC-V Instruction Set Architecture/i.test(normalized)
    && /As a non-profit, RISC-V does not maintain any commercial interest in products or services/i.test(normalized)
}

export const hasCommunityJobsBoardSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''

  return /\bJob Board\b/i.test(normalized)
    && /Search for available careers working in RISC-V/i.test(normalized)
    && /SUBMIT A JOB/i.test(normalized)
}

export const createRiscVInternationalScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const aboutHtml = await fetchText(ABOUT_URL)
    if (!hasNonprofitAboutSignal(aboutHtml)) {
      throw new Error('Verified RISC-V International about page changed materially')
    }

    const jobsBoardHtml = await fetchText(JOBS_BOARD_URL)
    if (!hasCommunityJobsBoardSignal(jobsBoardHtml)) {
      throw new Error('Verified RISC-V International community jobs board changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createRiscVInternationalScraper().run(options)

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
