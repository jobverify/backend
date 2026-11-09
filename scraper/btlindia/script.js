import {readListings,collect,nativeFetch} from './native.js'
import {runCurrentBtl} from './currentReader.js'
import {runLegacyBtl} from './currentLegacy.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://www.btlnet.co.in/careers.php'
export const APPLY_EMAIL = 'btlinrd-hr@btlnet.com'

const COMPANY = 'BTL India Pvt. Ltd.'
const SOURCE = 'btlindia'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const buildAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const extractExperience = (title) => {
  const match = String(title ?? '').match(/(\d+\s+to\s+\d+\s+years?)/i)
  return normalizeWhitespace(match?.[1] || '') || null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /BE PART OF OUR TEAM/i.test(page)
    && /btlinrd-hr@btlnet\.com/i.test(page)
    && /Job Opportunities/i.test(page)
    && /BTL India/i.test(page)
}

export const extractPublicListings = readListings

const defaultFetchText = nativeFetch

export const createBTLIndiaScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run(options={}) { return options.fetchText&&!options.fetchResponse&&!options.fetchImpl?runLegacyBtl({...options,now:options.now??now}):runCurrentBtl({...options,now:options.now??now}) },
})

export const run = async (options = {}) => createBTLIndiaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total BTL India jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
