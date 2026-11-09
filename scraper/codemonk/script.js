import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import {readCurrentCodemonk} from './currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://codemonk.io/careers'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/<!--[^]*?-->/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value) => new URL(value, CAREERS_URL).toString()

const extractCardValue = (html, className) => {
  const match = String(html ?? '').match(
    new RegExp(`<div\\b[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`, 'i'),
  )

  return normalizeWhitespace(match?.[1])
}

const extractLocation = (value) => {
  const match = String(value ?? '').match(
    /^(.+?),\s*([^,]+),\s*India\s*\|\s*Experience\s*(.+)$/i,
  )

  if (!match) return null

  return {
    location: `${normalizeWhitespace(match[1])}, ${normalizeWhitespace(match[2])}, India`,
    city: normalizeWhitespace(match[1]),
    state: normalizeWhitespace(match[2]),
    experienceRequired: normalizeWhitespace(match[3]),
  }
}

export const extractCareerListings = (html) => [...String(html ?? '').matchAll(
  /<a\b[^>]*href=["']([^"']*\/careers\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
)]
  .map((match) => {
    const sourceUrl = toAbsoluteUrl(match[1])
    const title = extractCardValue(match[2], 'font-semibold')
    const location = extractLocation(extractCardValue(match[2], 'text-gray-600'))
    const jobId = new URL(sourceUrl).pathname.split('/').filter(Boolean).at(-1) || null

    if (!title || !location || !jobId) return null

    return {
      title,
      company: 'Codemonk',
      department: null,
      ...location,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    }
  })
  .filter(Boolean)

const defaultFetchText = (url, {signal} = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'codemonk',
  timeoutMs: 15000,
  signal,
})

export const createCodemonkScraper = () => ({
  async run({ fetchText = defaultFetchText, signal, onAudit } = {}) {
    return readCurrentCodemonk({fetchText,signal,onAudit})
  },
})

export const run = async (options = {}) => createCodemonkScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Codemonk scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'codemonk')
    console.log('DB result:', result)
    process.exit(0)
  }
}
