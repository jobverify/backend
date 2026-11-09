import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AGILISIUM_CATALOG } from './catalog.js'
import { createZohoNativeInventoryScraper } from '../../scraper-support/utils/zohoNativeInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AGILISIUM_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const BOARD_URL = PROVIDER_METADATA.jobsBoardUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeSearchText = (value) => normalizeWhitespace(value).toLowerCase()

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const includesAnyText = (text, fragments) => fragments.some((fragment) => text.includes(fragment))

const includesAnyRaw = (page, fragments) => fragments.some((fragment) => page.includes(fragment))

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeSearchText(page)

  return extractTitle(page) === 'Careers at Agilisium | Life Sciences AI & Data Jobs'
    && includesAnyText(text, [
      'explore open roles',
      'view current openings',
      'see job openings',
    ])
    && text.includes('explore open roles')
    && page.includes(BOARD_URL)
}

export const hasVerifiedBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return extractTitle(page) === 'Jobs at Agilisium'
    && page.includes(BOARD_URL)
    && includesAnyRaw(page, ['id="meta"', "id='meta'"])
    && page.includes('list_url')
    && includesAnyRaw(page, [
      '"page_name":"Careers"',
      '"page_name":"careers"',
      'page_name":"Careers',
      'page_name":"careers',
    ])
}

export const createAgilisiumScraper = (options = {}) => createZohoNativeInventoryScraper({
  source: SOURCE, company: COMPANY, nativeCompany: 'Agilisium', companyDomain: 'agilisium.com',
  officialUrl: CAREERS_URL, boardUrl: BOARD_URL, orgId: '589705000000313622', pageId: '589705000000471052',
}, options)

export const run = async (options = {}) => createAgilisiumScraper(options).run(options)

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
