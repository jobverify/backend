import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://www.engati.ai/'
export const CAREERS_URL = 'https://www.engati.ai/careers'
export const CAREERS_EMAIL = 'careers@engati.com'

const SOURCE = 'engati'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const extractTitle = (html = '') =>
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, ' ').trim() || null

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const title = extractTitle(page)

  return /Engati/i.test(title || '')
    && /AI-native Customer eXperience|Drive Revenue Growth across your Customer eXperience lifecycle/i.test(page)
    && /href=["']https:\/\/www\.engati\.(?:ai|com)\/careers\/?["']/i.test(page)
}

export const hasCareersShellSignal = (html) => {
  const page = String(html ?? '')
  return /Careers at Engati/i.test(page)
    && /Check out our current openings or drop us a note/i.test(page)
    && new RegExp(CAREERS_EMAIL.replace('.', '\\.'), 'i').test(page)
    && /search/i.test(page)
}

export const hasNoJobsSignal = (html) => /No items found\./i.test(String(html ?? ''))

export const hasVisibleOpeningsSignal = (html) => {
  const page = String(html ?? '')
  return /apply-job-wrapper[\s\S]*w-dyn-item/i.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createEngatiScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Engati homepage no longer matches the verified official public site')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasCareersShellSignal(careersHtml) || !hasNoJobsSignal(careersHtml) || hasVisibleOpeningsSignal(careersHtml)) {
      throw new Error('Engati careers page no longer matches the verified official empty-state public surface')
    }

    return []
  },
})

export const run = async (options = {}) => createEngatiScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Engati scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
