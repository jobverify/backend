import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { KIWI_TECH_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#8211;|&ndash;|â€“/gi, '-')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const normalizeLocation = (location) => {
  const raw = normalizeWhitespace(location)
  if (!raw) {
    return {
      location: 'India',
      city: null,
      remoteStatus: 'On-site',
    }
  }

  const [cityPart] = raw.split('/').map((part) => normalizeWhitespace(part))
  const city = cityPart || raw
  const remoteStatus = /hybrid/i.test(raw)
    ? 'Hybrid'
    : /remote/i.test(raw)
      ? 'Remote'
      : 'On-site'

  return {
    location: `${city}, India`,
    city,
    remoteStatus,
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const text = stripTags(html)
  return text.includes('KiwiTech Careers')
    && text.includes('Current Openings')
    && text.includes('Full Stack Lead (React / Angular + Node.js / Python)')
    && text.includes('Associate Lead AI & ML')
}

export const extractJobCards = (html = '') => {
  const matches = String(html ?? '').matchAll(
    /<li class="service-item"[\s\S]*?<a href="([^"]+)"[\s\S]*?<span class="profile">\s*<strong>(.*?)<\/strong>[\s\S]*?<span class="location-year"><span>(.*?)<\/span>\s*([^<]+)<\/span>[\s\S]*?<\/li>/gi,
  )

  return [...matches].map((match) => ({
    title: stripTags(match[2]),
    location: stripTags(match[3]),
    experience: stripTags(match[4]),
    applyUrl: match[1],
  }))
}

export const createKiwiTechScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(html)) {
      throw new Error('The verified KiwiTech careers page no longer matches the trusted first-party surface')
    }

    return extractJobCards(html).map((card) => {
      const locationData = normalizeLocation(card.location)
      const jobId = `${slugify(card.title)}-${slugify(locationData.city)}`

      return {
        title: card.title,
        company: COMPANY,
        department: null,
        location: locationData.location,
        city: locationData.city,
        country: 'India',
        sourceUrl: CAREERS_URL,
        applyUrl: card.applyUrl,
        jobId,
        requisitionId: jobId,
        employmentType: null,
        experienceRequired: card.experience,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: `${card.title} - ${card.experience}`,
        remoteStatus: locationData.remoteStatus,
        source: SOURCE,
        link: card.applyUrl,
        scrapedAt: now(),
        companyCareerPage: CAREERS_URL,
        companyDomain: PROVIDER_METADATA.companyDomain,
        atsPlatform: PROVIDER_METADATA.atsPlatform,
      }
    })
  },
})

export const run = async (options = {}) => createKiwiTechScraper(options).run(options)

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
