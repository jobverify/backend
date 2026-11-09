import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PARAMATRIX_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = PARAMATRIX_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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

const extractTitle = (html = '') =>
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? null

const extractCanonicalUrl = (html = '') =>
  String(html ?? '').match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]?.trim() ?? null

export const extractInlineRoleTitles = (html = '') =>
  Array.from(
    String(html ?? '').matchAll(/selectOption\('([^']+)'\)/g),
    (match) => match[1].trim(),
  ).filter(Boolean)

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const roleTitles = extractInlineRoleTitles(page)

  return extractTitle(page) === 'Careers - Paramatrix Technologies Ltd.'
    && extractCanonicalUrl(page) === CAREERS_URL
    && page.includes('Be a part of our talent network')
    && page.includes('Explore our diverse opportunities and job roles')
    && roleTitles.length > 0
}

export const createParamatrixTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Paramatrix Technologies careers page no longer matches the verified first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createParamatrixTechnologiesScraper().run(options)

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
