import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { CI_INFOTECH_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = CI_INFOTECH_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const stripTags = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

const hasMaintenanceSignal = (html = '') =>
  /We are updating our website\./i.test(stripTags(html))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialOpeningsSignal = (html = '') => {
  const normalized = String(html).replace(/\s+/g, ' ')

  return normalized.includes('Current Tech Openings - CI Infotech Pvt. Ltd.')
    && normalized.includes('Current Openings')
    && normalized.includes('Find Job')
}

export const parseOpeningCards = (html = '') => {
  const jobs = []
  const articlePattern = /<article\b[^>]*class=["'][^"']*job-entry[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi
  let articleMatch

  while ((articleMatch = articlePattern.exec(String(html)))) {
    const block = articleMatch[1]
    const titleMatch = block.match(/<h2[^>]*>\s*<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i)
    const postedMatch = block.match(/<span[^>]*class=["'][^"']*posted[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
    const locationMatch = block.match(/<span[^>]*class=["'][^"']*location[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
    const jobTypeMatch = block.match(/<span[^>]*class=["'][^"']*job-type[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)

    if (!titleMatch || !postedMatch || !locationMatch || !jobTypeMatch) {
      continue
    }

    jobs.push({
      title: stripTags(titleMatch[2]),
      location: stripTags(locationMatch[1]),
      postedAt: stripTags(postedMatch[1]),
      jobType: stripTags(jobTypeMatch[1]),
      detailUrl: new URL(titleMatch[1], CAREERS_URL).toString(),
    })
  }

  return jobs
}

export const createCiInfotechScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    let html
    try {
      html = await fetchText(CAREERS_URL)
    } catch (error) {
      if (!/HTTP 404\b/i.test(String(error?.message || ''))) {
        throw error
      }

      const homepageHtml = await fetchText('https://ciinfotech.net/')
      if (hasMaintenanceSignal(homepageHtml)) {
        return []
      }

      throw error
    }

    if (!hasOfficialOpeningsSignal(html)) {
      throw new Error('The verified CI Infotech openings page no longer matches the trusted first-party contract')
    }

    return parseOpeningCards(html)
  },
})

export const run = async (options = {}) => createCiInfotechScraper().run(options)

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
