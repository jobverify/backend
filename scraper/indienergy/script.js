import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'indienergy'
export const COMPANY = 'INDI ENERGY'
export const HOMEPAGE_URL = 'https://indienergy.in/'
export const CAREERS_URL = 'https://indienergy.in/careers/'
export const VERIFIED_ON = '2026-08-07'
export const VERIFIED_SURFACE_SUMMARY = 'Verified on Friday, August 7, 2026 that both https://indienergy.in/ and https://indienergy.in/careers/ served IndiEnergy\'s live first-party Vercel SPA shell titled "IndiEnergy — Desh Ki Battery. Designed for the World.", with the same root div, brand description, OG metadata, and client bundle assets. Also verified on Friday, August 7, 2026 that the public bundle exposed About and Contact routes plus Contact Us and Send enquiry copy, but no trustworthy public careers route, ATS handoff, or enumerable jobs surface. This provider is therefore repinned fail-closed and returns an honest empty result until the official first-party site publishes public openings.'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bjob description\b/i,
  /\bapply now\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
]

const SHARED_DESCRIPTION_SNIPPET =
  'IndiEnergy transforms agricultural biomass into advanced Sodium-ion battery materials and intelligent energy-storage systems'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const extractCareersUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const absoluteUrl = new URL(match[1], HOMEPAGE_URL).toString()
      if (absoluteUrl === CAREERS_URL) {
        return absoluteUrl
      }
    } catch {
      // Ignore malformed href values from the page shell.
    }
  }

  return null
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /<title[^>]*>\s*IndiEnergy\s*[—-]\s*Desh Ki Battery\. Designed for the World\.\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+name=["']description["'][^>]+content=["'][^"']*IndiEnergy transforms agricultural biomass into advanced Sodium-ion battery materials and intelligent energy-storage systems/i.test(rawHtml)
    && /<meta[^>]+property=["']og:title["'][^>]+content=["']IndiEnergy\s*[—-]\s*Desh Ki Battery\. Designed for the World\./i.test(rawHtml)
    && /<meta[^>]+property=["']og:type["'][^>]+content=["']website["']/i.test(rawHtml)
    && /<link[^>]+href=["']\/logo\.svg["'][^>]*>/i.test(rawHtml)
    && /<script[^>]+src=["']\/assets\/index-[^"']+\.js["'][^>]*>/i.test(rawHtml)
    && /<div id=["']root["']><\/div>/i.test(rawHtml)
}

export const hasNoPublicCareersShellSignal = (html) => {
  const rawHtml = String(html ?? '')

  return hasOfficialHomepageSignal(rawHtml)
    && rawHtml.includes(SHARED_DESCRIPTION_SNIPPET)
    && !/career options at indienergy/i.test(rawHtml)
    && extractCareersUrl(rawHtml) === null
}

export const hasPublicJobListingsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const createIndiEnergyScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('INDI ENERGY verified official homepage no longer matches the verified public surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)

    if (hasPublicJobListingsSignal(careersPage.html)) {
      throw new Error('INDI ENERGY careers page now appears to expose public job listings')
    }

    if (careersPage.status !== 200 || !hasNoPublicCareersShellSignal(careersPage.html)) {
      throw new Error('INDI ENERGY careers page no longer matches the verified no-public-careers shell')
    }

    return []
  },
})

export const run = async (options = {}) => createIndiEnergyScraper().run(options)

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
