import {createHiddenBrainsNativeScraper} from './native20261108.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readHiddenBrainsCards, readHiddenBrainsDeclaredRoles } from './native.js'

import { HIDDEN_BRAINS_INFOTECH_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = HIDDEN_BRAINS_INFOTECH_CATALOG.source
export const COMPANY = HIDDEN_BRAINS_INFOTECH_CATALOG.companyName
export const CAREERS_URL = HIDDEN_BRAINS_INFOTECH_CATALOG.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;|&#34;/gi, '"')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const parseInteger = (value) => {
  const match = String(value ?? '').match(/\d+/)
  return match ? Number.parseInt(match[0], 10) : null
}

const isIndiaScopedTitle = (title) => !/\babu dhabi\b/i.test(title)

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /ALL POSITIONS/i.test(page)
    && /Join a People-first Environment/i.test(page)
    && /APPLY NOW!/i.test(page)
    && /#InquiryJob/i.test(page)
}

export const extractVisibleJobCards = (html = '') => readHiddenBrainsCards(html).cards

const defaultFetchText = (url, {signal} = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createHiddenBrainsInfotechScraper = (configuration={}) => createHiddenBrainsNativeScraper(configuration)

export const run = async (options = {}) => createHiddenBrainsInfotechScraper().run(options)

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
