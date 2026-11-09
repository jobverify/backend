import path from 'node:path'
import { fileURLToPath } from 'node:url'

import BRIGOSHA_TECHNOLOGIES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BRIGOSHA_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_PAGE_URL = PROVIDER_METADATA.officialCareersPageUrl
export const OFFICIAL_CAREERS_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)
    return actualUrl.hostname.toLowerCase() === expectedUrl.hostname.toLowerCase()
      && actualUrl.pathname.replace(/\/+$/, '/') === expectedUrl.pathname.replace(/\/+$/, '/')
  } catch {
    return false
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const extractOfficialPortalHandoffUrl = (html = '') => {
  const match = String(html ?? '').match(/https:\/\/login\.brigosha\.com\/?/i)
  if (!match?.[0]) return null
  return match[0].replace(/\/$/, '/')
}

export const hasOfficialCareersSignal = (html = '') => {
  const title = extractTitle(html)
  const normalized = normalizeWhitespace(html)

  return /^Join Us\s*\|\s*brigosha Technologies$/i.test(title || '')
    || (
      normalized.includes('Unlock Your True Potential')
    && normalized.includes('Make Your Dream Come True At brigosha')
    && extractOfficialPortalHandoffUrl(html) === OFFICIAL_CAREERS_HANDOFF_URL
    )
}

const pageExposesPublicJobListings = (html = '') =>
  /job-description|apply now|jobdetails\/\d+|career-card/i.test(String(html ?? ''))

export const matchesVerifiedOpaquePortalState = ({ status, url, html } = {}) =>
  Number(status) === 200
  && matchesExpectedUrl(url, OFFICIAL_CAREERS_HANDOFF_URL)
  && normalizeWhitespace(html).includes('You need to enable JavaScript to run this app.')
  && !pageExposesPublicJobListings(html)

export const createBrigoshaTechnologiesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (
      Number(careersPage?.status) !== 200
      || !matchesExpectedUrl(careersPage?.url, CAREERS_PAGE_URL)
      || !hasOfficialCareersSignal(careersPage?.html)
    ) {
      throw new Error('The verified Brigosha Technologies careers handoff changed materially')
    }

    const handoffPage = await fetchPage(OFFICIAL_CAREERS_HANDOFF_URL)
    if (pageExposesPublicJobListings(handoffPage?.html)) {
      throw new Error('The verified Brigosha Technologies public jobs surface changed materially')
    }

    if (!matchesVerifiedOpaquePortalState(handoffPage)) {
      throw new Error('The verified Brigosha Technologies portal handoff changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createBrigoshaTechnologiesScraper().run(options)

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
