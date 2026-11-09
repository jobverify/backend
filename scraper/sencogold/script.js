import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createCurrentSencoGoldScraper} from './currentBoundary.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'sencogold'
export const COMPANY = 'Senco Gold'
export const CAREERS_URL = 'https://www.sencogold.com/career'

const EXPIRED_TLS_PATTERNS = [
  /\bcertificate has expired\b/i,
  /\bcert_has_expired\b/i,
  /\berr_cert_date_invalid\b/i,
]

const normalizeText = (html) => String(html || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const collectErrorMessages = (error) => {
  const messages = []
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    messages.push(String(current?.message ?? current ?? ''))
    current = current?.cause
  }

  return messages.filter(Boolean)
}

export const hasExpiredTlsFailure = (error) =>
  collectErrorMessages(error)
    .some((message) => EXPIRED_TLS_PATTERNS.some((pattern) => pattern.test(message)))

export const hasVerifiedFormOnlySurface = (page = {}) => {
  const url = String(page.url || '')
  const markup = String(page.html || '')
  const text = `${normalizeText(markup)} ${markup}`

  if (Number(page.status) !== 200 || !/^https:\/\/(www\.)?sencogold\.com\//i.test(url)) {
    return false
  }

  const hasCareerForm = /\bCareer\b/i.test(text)
    && /\bJoin Us\b/i.test(text)
    && /Applying for position/i.test(text)
    && /CV Upload/i.test(text)
  const hasPublicListingSignal = /\b(job listings?|job openings?|current openings?|vacancies|jobposting|apply now|view jobs?)\b/i.test(text)

  return hasCareerForm && !hasPublicListingSignal
}

export const createSencoGoldScraper = createCurrentSencoGoldScraper

export const run = async (options = {}) => createSencoGoldScraper().run(options)

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
