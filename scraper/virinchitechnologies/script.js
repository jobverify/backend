import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { VIRINCHI_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = VIRINCHI_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value = '') => String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const text = normalizeWhitespace(rawHtml)

  return (
    /<title>\s*\.::\s*Welcome to Virinchi\s*::\.\s*<\/title>/i.test(rawHtml)
      && /Virinchi is always looking to recruit exceptionally bright and outstanding people/i.test(rawHtml)
  ) || (
    /<title>\s*\.::\s*Welcome to Virinchi\s*::\.\s*<\/title>/i.test(rawHtml)
      && text.includes('Corporate Website Join Us Products and Solutions Services Investor Relations')
      && text.includes('Welcome to Virinchi! Your Extended IT Arm')
      && text.includes('Virinchi Limited is an IT Products & Services company')
  )
}

export const hasNoPublicJobListingsSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  return (
    /profSignup\.php/i.test(rawHtml)
      && /Profile Sign Up/i.test(rawHtml)
      && /virinchi2015@gmail\.com/i.test(rawHtml)
  ) || (
    !/apply now|current openings|job opening|career openings|mailto:hr@|mailto:careers@/i.test(rawHtml)
      && !/recruitcareers|bullhorn|apply\?job=|job-card|accordionCareerHiring/i.test(rawHtml)
  )
}

export const createVirinchiTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml) || !hasNoPublicJobListingsSignal(careersHtml)) {
      throw new Error('Virinchi verified careers page no longer matches the known fail-closed contract')
    }

    return []
  },
})

export const run = async (options = {}) => createVirinchiTechnologiesScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
