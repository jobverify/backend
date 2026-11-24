import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_URL = 'https://newgensoft.com/in/company/careers/'
export const JOBS_PORTAL_URL = 'https://omnirecruit.newgen.co.in/IShareReferral/CareerPortal.aspx'
export const APPLY_URL_BASE = 'https://omnirecruit.newgen.co.in/CandidateRegistration/CandidateRegistration.aspx?JobExternalUsers='

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const decodeEntities = (value) => normalizeWhitespace(value)
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))

const textFromHtml = (value) => decodeEntities(String(value ?? '')
  .replace(/<br\s*\/?>(?=\s*)/gi, ' ')
  .replace(/<[^>]*>/g, ' '))

const firstMatch = (html, pattern) => html.match(pattern)?.[1] || ''

const extractField = (card, className) => textFromHtml(firstMatch(
  card,
  new RegExp(`<[^>]+class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/`, 'i'),
))

const extractDescription = (card) => textFromHtml(firstMatch(
  card,
  /<[^>]+class=["'][^"']*\bjob-description\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?=<a\b|<button\b|$)/i,
))

const normalizeDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const iso = normalized.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
  if (iso) return iso.slice(1).join('-')

  const dayFirst = normalized.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/)
  if (!dayFirst) return null

  return `${dayFirst[3]}-${dayFirst[2].padStart(2, '0')}-${dayFirst[1].padStart(2, '0')}`
}

const extractJobId = (card) => {
  const applyUrl = firstMatch(card, /href=["']([^"']*JobExternalUsers=([^"'&#]+)[^"']*)["']/i)
  if (applyUrl) return decodeURIComponent(applyUrl.match(/JobExternalUsers=([^&#]+)/i)[1])
  return firstMatch(card, /(?:apply|job)\s*\(\s*["']([^"']+)["']/i)
}

const buildApplyUrl = (jobId) => `${APPLY_URL_BASE}${encodeURIComponent(jobId)}`

const parseCard = (card) => {
  const jobId = normalizeWhitespace(extractJobId(card))
  const title = extractField(card, 'job-title')
  const location = extractField(card, 'job-location')
  const dateText = extractField(card, 'job-date')
  const description = extractDescription(card)

  if (!jobId || !title) return null

  return {
    title,
    company: 'Newgen Software',
    location,
    city: location.split(',')[0].trim() || location,
    jobId,
    requisitionId: jobId,
    sourceUrl: JOBS_PORTAL_URL,
    applyUrl: buildApplyUrl(jobId),
    postingDate: normalizeDate(dateText),
    closingDate: null,
    jobDescription: description || null,
  }
}

export const extractJobs = (html) => {
  const source = String(html ?? '')
  const cardStarts = [...source.matchAll(/<(?:article|div|li)[^>]+class=["'][^"']*\bjob-card\b[^"']*["'][^>]*>/gi)]

  return cardStarts
    .map((match, index) => source.slice(match.index, cardStarts[index + 1]?.index ?? source.length))
    .map(parseCard)
    .filter(Boolean)
}

export const run = async ({ fetchImpl = fetch } = {}) => {
  const response = await fetchImpl(JOBS_PORTAL_URL)
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${JOBS_PORTAL_URL}`)

  const jobs = extractJobs(await response.text()).map((job) => ({
    ...job,
    source: 'newgen',
    link: job.applyUrl || job.sourceUrl,
    scrapedAt: new Date().toISOString(),
  }))

  if (Number.isInteger(config.maxJobs) && config.maxJobs >= 0) return jobs.slice(0, config.maxJobs)
  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Newgen scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'newgen')
}
