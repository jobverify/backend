import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { createDaVinciNativeInventory } from './nativeInventory.js'
import DAVINCI_TRADING_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_PAGE_URL = 'https://davincitrading.com/careers/'
export const PROVIDER_METADATA = DAVINCI_TRADING_CATALOG

const normalizeText = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const getJobId = (url) => new URL(url).pathname.split('/').filter(Boolean).at(-1) || null

const extractTitle = (html, text) => normalizeText(
  String(html).match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1],
) || text
  .replace(/\bApply\b/gi, '')
  .replace(/Mumbai,?\s+Maharashtra,?\s+India/gi, '')
  .trim() || null

// Legacy pure listing output is retained for archived consumers. The active
// runtime below requires current native detail, date and inventory evidence.
export const extractCareerJobs = (html) => {
  const jobs = []
  const pageHtml = String(html ?? '')
  const jobLinkPattern = /<a\b[^>]*href=["']([^"']*\/job\/[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi

  for (const match of pageHtml.matchAll(jobLinkPattern)) {
    const cardHtml = match[2]
    const cardText = normalizeText(cardHtml)
    if (!/\bMumbai\b[\s\S]*\bIndia\b/i.test(cardText || '')) continue

    const sourceUrl = new URL(match[1], CAREERS_PAGE_URL).toString()
    const jobId = getJobId(sourceUrl)
    const title = extractTitle(cardHtml, cardText || '')
    if (!title || !jobId) continue

    jobs.push({
      title,
      company: 'Da Vinci Trading',
      department: null,
      location: 'Mumbai, Maharashtra, India',
      city: 'Mumbai',
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Apply through the official Da Vinci Trading careers page.',
    })
  }

  return [...new Map(jobs.map((job) => [job.sourceUrl, job])).values()]
}

export const createDaVinciTradingScraper = (options = {}) => createDaVinciNativeInventory({
  maxJobs: Number.isInteger(config.maxJobs) ? config.maxJobs : 0, ...options,
})

export const run = async (options = {}) => createDaVinciTradingScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'davincitrading')
}
