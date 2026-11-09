import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AKRIVIA_AUTOMATION_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AKRIVIA_AUTOMATION_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return undefined

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(15000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasOfficialCareersSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('careers @ akrivia')
    && normalized.includes('job application form')
    && normalized.includes('akrivia automation pvt. ltd.')
}

export const extractJobOptions = (html) => {
  const selectMarkup = String(html ?? '').match(/<select[^>]+(?:field_6|name=["']field_6["'])[^>]*>([\s\S]*?)<\/select>/i)?.[1]
  if (!selectMarkup) {
    throw new Error('Expected verified Akrivia Automation careers form with a Job selector')
  }

  const options = []
  const seen = new Set()

  for (const match of selectMarkup.matchAll(/<option[^>]*>([\s\S]*?)<\/option>/gi)) {
    const option = normalizeWhitespace(match[1])
    if (!option || seen.has(option)) continue
    seen.add(option)

    if (/please select/i.test(option) || /job title \d+/i.test(option) || /more jobs here/i.test(option)) {
      continue
    }

    options.push(option)
  }

  if (options.length === 0) {
    throw new Error('Akrivia Automation careers form no longer exposes non-placeholder public job options')
  }

  return options
}

export const createAkriviaAutomationScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Akrivia Automation verified careers form no longer matches the trusted first-party surface')
    }

    const scrapedAt = new Date(now()).toISOString()

    return extractJobOptions(careersHtml).map((title) => ({
      title,
      company: COMPANY,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      requisitionId: null,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: null,
      jobDescription: null,
      preserveExistingSourceContent: true,
      publicExperienceChecked: true,
      source: SOURCE,
      link: CAREERS_URL,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createAkriviaAutomationScraper().run(options)

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
