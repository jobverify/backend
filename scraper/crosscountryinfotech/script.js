import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import CROSS_COUNTRY_INFOTECH_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = CROSS_COUNTRY_INFOTECH_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: `${SOURCE}-html`,
  timeoutMs: 15000,
})

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const normalizeLocation = (value) => {
  const location = normalizeWhitespace(value)
    .replace(/^work\s+from\s+office,\s*/i, '')
  if (!location) return 'India'
  return /\bindia\b/i.test(location) ? location : `${location}, India`
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  const city = normalized.match(/\b(Pune|Hyderabad|Bengaluru|Bangalore|Mumbai)\b/i)?.[1]
  return city ? city.replace(/^Bengaluru$/i, 'Bengaluru') : null
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return text.includes('Join Our Community at CCI')
    && text.includes('Currently open positions')
    && /CCICareers@crosscountry\.com/i.test(page)
}

const buildApplyUrl = (href) => {
  try {
    return new URL(href, CAREERS_URL).toString()
  } catch {
    return null
  }
}

export const extractJobs = (html = '', scrapedAt = new Date().toISOString()) => {
  const page = String(html ?? '')
  const pattern = /<h3>([^<]+)<\/h3>[\s\S]*?<div>\s*Must have skills\s*<\/div>[\s\S]*?<p>([^<]+)<\/p>[\s\S]*?(?:<div>\s*Notice Period\s*<\/div>[\s\S]*?<p>([^<]+)<\/p>[\s\S]*?)?<div>\s*Experience\s*<\/div>[\s\S]*?<p>([^<]+)<\/p>[\s\S]*?<div>\s*Work location\s*<\/div>[\s\S]*?<p>([^<]+)<\/p>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>\s*Apply Now\s*<\/a>/gi
  const jobs = []
  const seen = new Set()

  for (const match of page.matchAll(pattern)) {
    const title = normalizeWhitespace(match[1])
    const requiredSkillsText = normalizeWhitespace(match[2])
    const experience = normalizeWhitespace(match[4])
    const location = normalizeLocation(match[5])
    const applyUrl = buildApplyUrl(match[6])
    const key = `${title}::${location}`

    if (!title || !requiredSkillsText || !experience || !applyUrl || seen.has(key)) continue
    seen.add(key)

    jobs.push({
      title,
      company: COMPANY,
      location,
      city: extractCity(location),
      country: 'India',
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: experience,
      requiredSkills: requiredSkillsText.split(/\s*,\s*/).filter(Boolean),
      jobDescription: null,
      source: SOURCE,
      link: applyUrl,
      scrapedAt,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
    })
  }

  return jobs
}

export const createCrossCountryInfotechScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(html)) {
      throw new Error('The verified Cross Country Infotech careers shell changed materially')
    }

    return extractJobs(html, now())
  },
})

export const run = async (options = {}) => createCrossCountryInfotechScraper(options).run(options)

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
