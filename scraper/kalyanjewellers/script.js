import path from 'node:path'
import { fileURLToPath } from 'node:url'

import KALYAN_JEWELLERS_PROVIDER from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = KALYAN_JEWELLERS_PROVIDER.source
export const COMPANY = KALYAN_JEWELLERS_PROVIDER.companyName
export const CAREERS_URL = KALYAN_JEWELLERS_PROVIDER.companyCareerPage

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|\u00a0/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const isIndiaLocation = (value) => /\b(?:india|bangalore|bengaluru|chennai|delhi|gurugram|hyderabad|kochi|kolkata|mumbai|noida|pune|thane|thiruvananthapuram|thrissur)\b/i.test(value)
const absoluteUrl = (href) => new URL(href, CAREERS_URL).href

export const extractIndiaOpenings = (html = '') => Array.from(
  String(html).matchAll(/<(?:article|li|div|section)\b[^>]*class=["'][^"']*(?:job|career|opening|vacanc)[^"']*["'][^>]*>([\s\S]*?)<\/(?:article|li|div|section)>/gi),
  (match) => {
    const card = match[1]
    const link = card.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
    const text = normalizeWhitespace(card)
    const title = normalizeWhitespace(link?.[2])
    if (!link || !title || !isIndiaLocation(text)) return null
    const sourceUrl = absoluteUrl(link[1])
    if (!sourceUrl.startsWith('https://careers.kalyanjewellers.company/')) return null
    return {
      title,
      location: text,
      jobId: sourceUrl.split('/').pop() || title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      sourceUrl,
    }
  },
).filter(Boolean)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)', Accept: 'text/html' },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createKalyanJewellersScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    return extractIndiaOpenings(await fetchText(CAREERS_URL)).map((opening) => ({
      title: opening.title,
      company: COMPANY,
      location: opening.location,
      city: null,
      country: 'India',
      jobId: opening.jobId,
      requisitionId: opening.jobId,
      sourceUrl: opening.sourceUrl,
      applyUrl: opening.sourceUrl,
      source: SOURCE,
      link: opening.sourceUrl,
      scrapedAt: now(),
      companyCareerPage: CAREERS_URL,
      companyDomain: KALYAN_JEWELLERS_PROVIDER.companyDomain,
      atsPlatform: KALYAN_JEWELLERS_PROVIDER.atsPlatform,
    }))
  },
})

export const run = async (options = {}) => createKalyanJewellersScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
