import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { MIRACLE_SOFTWARE_SYSTEMS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = MIRACLE_SOFTWARE_SYSTEMS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()

const parsePostingDate = (value) => {
  const match = String(value ?? '').match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th),\s+(\d{4})/)
  if (!match) return null

  const monthIndex = new Date(`${match[1]} 1, 2000`).getMonth()
  if (Number.isNaN(monthIndex)) return null

  const month = String(monthIndex + 1).padStart(2, '0')
  const day = String(Number(match[2])).padStart(2, '0')
  return `${match[3]}-${month}-${day}`
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Contact Notice')
    && normalized.includes('Open Positions')
    && normalized.includes('Miracle Heights, India')
    && normalized.includes('Miracle recruiters, HR or leadership')
}

export const extractVisibleJobCards = (html = '') => {
  const page = String(html ?? '')
  const buildCard = ({ title, details, href }) => {
    const normalizedTitle = normalizeWhitespace(title)
    const normalizedDetails = normalizeWhitespace(details)

    if (!normalizedTitle || !normalizedDetails || !href) {
      return null
    }

    return {
      title: normalizedTitle,
      location: normalizedDetails.replace(/[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th),\s+\d{4}\s*/i, '').trim(),
      postingDate: parsePostingDate(normalizedDetails),
      applyUrl: new URL(href, CAREERS_URL).toString(),
    }
  }

  const legacyCards = [...page.matchAll(/<section[^>]*class=["'][^"']*job-card[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi)]
    .map((match) => {
      const block = match[1]
      return buildCard({
        title: block.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? null,
        details: block.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i)?.[1] ?? null,
        href: block.match(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/i)?.[1] ?? null,
      })
    })
    .filter(Boolean)

  const currentCards = [...page.matchAll(
    /<div[^>]*class=["'][^"']*oc-item[^"']*["'][^>]*>[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/gi,
  )]
    .map((match) => buildCard({
      title: match[1],
      details: match[2],
      href: match[3],
    }))
    .filter(Boolean)

  return [...new Map([...legacyCards, ...currentCards].map((card) => [card.applyUrl, card])).values()]
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createMiracleSoftwareSystemsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Miracle Software Systems careers page no longer matches the verified first-party surface')
    }

    const jobs = extractVisibleJobCards(careersHtml)
      .map((job) => ({
        ...job,
        sourceUrl: job.applyUrl,
        companyCareerPage: CAREERS_URL,
      }))
      .sort((left, right) => left.title.localeCompare(right.title))

    if (jobs.length === 0) {
      throw new Error('Miracle Software Systems no longer exposes public job cards on the first-party careers page')
    }

    return jobs.map((job) => ({
      ...job,
      company: COMPANY,
      source: SOURCE,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      country: 'India',
      link: job.applyUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createMiracleSoftwareSystemsScraper().run(options)

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
