import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.controlone.ai/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

export const hasCareerPageSignal = (html) => /Join Our Team|Careers|Control One Logistics Private Limited/i
  .test(String(html ?? ''))

export const hasNoPublicListingsSignal = (html) => /Join Our Team[\s\S]*Careers[\s\S]*contact@controlone\.ai/i
  .test(String(html ?? ''))
  || (
    /<title>\s*Control One \|\s*AI Startup\s*<\/title>/i.test(String(html ?? ''))
    && /Join Our team/i.test(String(html ?? ''))
    && /ONE Transform Program/i.test(String(html ?? ''))
    && !/"@type"\s*:\s*"JobPosting"|boards\.greenhouse\.io|jobs\.lever\.co|workdayjobs|smartrecruiters|darwinbox/i
      .test(String(html ?? ''))
  )

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'controloneai',
  timeoutMs: 15000,
})

export const createControlOneAiScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREER_PAGE_URL)

    if (!hasCareerPageSignal(html)) {
      throw new Error('Control One careers page no longer matches the official public site')
    }

    if (!hasNoPublicListingsSignal(html)) {
      throw new Error('Control One public site now appears to expose a different hiring flow')
    }

    return []
  },
})

export const run = async () => createControlOneAiScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'controloneai')
  }
}
