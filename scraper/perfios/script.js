import { readFileSync } from 'node:fs'
import { runReviewedThirdWaveDarwinboxInventory } from '../stanplus/nativeInventory.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'perfios'
export const CAREERS_PAGE_URL = 'https://perfios.ai/careers/'
export const DARWINBOX_URL = 'https://perfios.darwinbox.in/'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const hasDarwinboxHandoff = (html) => /perfios\.darwinbox\.in/i.test(String(html ?? ''))
const isDarwinboxLoginOnly = (html) => (
  /<title[^>]*>\s*Perfios\s*:\s*Login\s*<\/title>/i.test(String(html ?? ''))
  && /single sign on/i.test(String(html ?? ''))
  && /Perfios SSO/i.test(String(html ?? ''))
)

const nativeSpec = {
  "source": "perfios",
  "company": "Perfios",
  "brand": "Perfios",
  "tenant": "perfios",
  "tenantId": "244",
  "origin": "https://perfios.darwinbox.in",
  "corporateHandoff": "https://perfios.darwinbox.in/ms/candidate/careers/",
  "handoff": "https://perfios.darwinbox.in/ms/candidatev2/main"
}
nativeSpec.review = JSON.parse(readFileSync(new URL('./reviewedNativeScope.json', import.meta.url), 'utf8'))

export const createPerfiosScraper = (defaults = {}) => ({
  run: (options = {}) => runReviewedThirdWaveDarwinboxInventory(nativeSpec, { ...defaults, ...options }),
})

export const run = async (options = {}) => createPerfiosScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
