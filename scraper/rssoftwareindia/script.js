import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { RS_SOFTWARE_INDIA_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('RS Software')
    && normalized.includes('Payments at the Speed of Thought')
    && normalized.includes('Join Our Team')
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Where talent meets opportunity')
    && normalized.includes('Find your next role and take the leap')
    && normalized.includes('Global Delivery Head')
    && normalized.includes('Senior Manager Sales, Bangalore/Chennai')
    && normalized.includes('sourcing@rssoftware.co.in')
}

export const extractOpenRoles = (html = '') => Array.from(
  String(html ?? '').matchAll(
    /<section>[\s\S]*?<h4>\s*([^<]+?)\s*<\/h4>[\s\S]*?<p>\s*Roles in Focus:\s*([^<]+?)\s*<\/p>[\s\S]*?<p>\s*([\s\S]*?)\s*<\/p>[\s\S]*?<\/section>/gi,
  ),
  (match) => ({
    title: normalizeWhitespace(match[1]),
    roleFocus: normalizeWhitespace(match[2]),
    description: normalizeWhitespace(match[3]),
  }),
).filter((item) => item.title && item.roleFocus && item.description)

const inferLocation = (title) => {
  const normalized = normalizeWhitespace(title)

  if (/mumbai/i.test(normalized)) {
    return {
      location: 'Mumbai, India',
      city: 'Mumbai',
    }
  }

  if (/bangalore\/chennai/i.test(normalized)) {
    return {
      location: 'Bangalore/Chennai, India',
      city: 'Bangalore/Chennai',
    }
  }

  return {
    location: 'Kolkata, India',
    city: 'Kolkata',
  }
}

export const createRsSoftwareIndiaScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('RS Software verified official homepage no longer matches the known first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('RS Software verified join-team page no longer matches the known first-party surface')
    }

    return extractOpenRoles(careersHtml)
      .filter((role) => !/,\s*US$/i.test(role.title))
      .map((role) => {
        const { location, city } = inferLocation(role.title)
        const jobId = slugify(role.title)

        return {
          title: role.title,
          company: COMPANY,
          department: role.roleFocus,
          location,
          city,
          country: 'India',
          sourceUrl: CAREERS_URL,
          applyUrl: CAREERS_URL,
          jobId,
          requisitionId: jobId,
          employmentType: null,
          experienceRequired: null,
          minimumQualification: null,
          preferredQualification: null,
          requiredSkills: [],
          postingDate: null,
          closingDate: null,
          jobDescription: role.description,
          remoteStatus: null,
          source: SOURCE,
          link: CAREERS_URL,
          scrapedAt: now(),
          companyCareerPage: CAREERS_URL,
          companyDomain: PROVIDER_METADATA.companyDomain,
          atsPlatform: PROVIDER_METADATA.atsPlatform,
        }
      })
  },
})

export const run = async (options = {}) => createRsSoftwareIndiaScraper(options).run(options)

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
