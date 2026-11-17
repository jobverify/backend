import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { runCurrentMowito } from './currentNative20261117.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://www.mowito.ai/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const BRAND_PATTERN = /\bMowito\b/i
const PRODUCT_PATTERN = /\bNeuralPick\b/i
const CAREERS_SECTION_PATTERN = /\bCareers\b/i
const CAREERS_EMAIL_PATTERN = /careers@mowito\.in/i
const INDIA_ADDRESS_PATTERN = /Chandra Layout Main Road|Vijayanagar,\s*Bengaluru|Bengaluru,\s*Karnataka\s*560040/i
const PUBLIC_JOB_BOARD_PATTERN =
  /jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|workable\.com|smartrecruiters|myworkdayjobs|jobs-guest|linkedin\.com\/jobs\/view|base-search-card|job-search-card|open positions|current openings|job openings|view open positions|view all jobs|apply now/i

export const hasOfficialMowitoSignal = (html) => {
  const page = String(html ?? '')

  return BRAND_PATTERN.test(page)
    && PRODUCT_PATTERN.test(page)
    && CAREERS_SECTION_PATTERN.test(page)
    && CAREERS_EMAIL_PATTERN.test(page)
    && INDIA_ADDRESS_PATTERN.test(page)
}

export const hasPublicJobBoardSignal = (html) => {
  const doc = readNativeDocument(String(html ?? ''))
  const text = doc.nodes(node => node.tag === 'root').map(node => doc.text(node)).join(' ')
  const activeLinks = doc.nodes(node => node.tag === 'a' && node.attrs.href).map(node => node.attrs.href).join(' ')
  return PUBLIC_JOB_BOARD_PATTERN.test(text + ' ' + activeLinks)
}

export const extractSearchResults = () => []

export const createMowitoScraper = () => ({
  run: runCurrentMowito,
})

export const run = async (options = {}) => createMowitoScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'mowito')
  }
}
