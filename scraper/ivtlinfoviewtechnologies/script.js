import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { IVTL_INFOVIEW_TECHNOLOGIES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const stripTags = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialHomepageSignal = (html = '') => {
  const text = stripTags(html)
  return text.includes('Works Applications (India)')
    && text.includes('Formerly known as Infoview')
    && text.includes('Talk to our experts right away!')
}

export const hasContactOnlySignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page)
  return text.includes('wai-hr@worksap.co.jp')
    && page.includes('hr-office@ivtlinfoview.co.jp')
}

export const createIvtlInfoviewTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(html)) {
      throw new Error('IVTL Infoview Technologies homepage no longer matches the verified first-party surface')
    }
    if (!hasContactOnlySignal(html)) {
      throw new Error('IVTL Infoview Technologies homepage no longer matches the verified contact-only handoff state')
    }
    return []
  },
})

export const run = async (options = {}) => createIvtlInfoviewTechnologiesScraper().run(options)

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
