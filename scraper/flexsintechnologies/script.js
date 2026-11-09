import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { enrichRoleDescriptions } from '../../scraper-support/utils/enrichRoleDescriptions.js'

import { FLEXSIN_TECHNOLOGIES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const LOCATION_MAP = {
  noida: 'Noida, Uttar Pradesh, India',
  'sector 63': 'Sector 63, Noida, Uttar Pradesh, India',
  'sector 63, noida': 'Sector 63, Noida, Uttar Pradesh, India',
}

const defaultFetchText = (url, { signal, includeResponseMetadata = false } = {}) =>
  fetchTextWithRetry(url, {
    signal,
    includeResponseMetadata,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const slugFromUrl = (url) =>
  new URL(url, CAREERS_URL)
    .pathname
    .split('/')
    .filter(Boolean)
    .at(-1)

const hasVerifiedIndiaLocation = value => /^(?:India|(?:Noida(?:[,\s]+Sector\s*63)?|Sector\s*63(?:,\s*Noida)?)(?:,\s*Uttar Pradesh)?(?:,\s*India)?)$/i.test(normalizeWhitespace(value))

const normalizeLocation = (value) => {
  const raw = normalizeWhitespace(value)
  return LOCATION_MAP[raw.toLowerCase()] || (hasVerifiedIndiaLocation(raw) ? `${raw}, India` : raw)
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Career Opportunities\s*<\/title>/i.test(page)
    && /class=["']jobsList\b/i.test(page)
    && /href=["']https:\/\/www\.flexsin\.com\/careers\/[a-z0-9-]+\/["']/i.test(page)
  }

export const extractJobs = (html = '') => {
  const jobs = []
  const listing = String(html).match(/<ul\b[^>]*class=["'][^"']*\bjobsList\b[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1]
  if (!listing) throw new Error('Flexsin incomplete current listing')
  const expectedUrls = new Set([...listing.matchAll(/<a\b[^>]*href=["']([^"']*\/careers\/[a-z0-9-]+\/)["']/gi)].map(([, href]) => new URL(href, CAREERS_URL).toString()))
  const expectedCards = [...listing.matchAll(/<a\b[^>]*class=["'](?:[^"']*\s)?inner(?:\s[^"']*)?["'][^>]*>/gi)].length

  for (const match of listing.matchAll(/<li>\s*<a[^>]+href="([^"]+)"[^>]*class="(?:[^"]*\s)?inner(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi)) {
    const sourceUrl = new URL(match[1], CAREERS_URL).toString()
    const block = match[2]
    const title = normalizeWhitespace(block.match(/<div[^>]*class="hd"[^>]*>([\s\S]*?)<\/div>/i)?.[1])
    const infoMatches = [...block.matchAll(/<div[^>]*class="info(?:\s+location)?"[^>]*>([\s\S]*?)<\/div>/gi)]
    const experienceRequired = normalizeWhitespace(infoMatches[0]?.[1])
    const rawLocation = normalizeWhitespace(infoMatches[1]?.[1])
    const jobId = slugFromUrl(sourceUrl)

    if (!title || !experienceRequired || !jobId || new URL(sourceUrl).origin !== new URL(CAREERS_URL).origin
      || !/^\/careers\/[a-z0-9-]+\/$/.test(new URL(sourceUrl).pathname)) throw new Error('Flexsin incomplete public role card')

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: normalizeLocation(rawLocation) || null,
      city: rawLocation || null,
      country: hasVerifiedIndiaLocation(rawLocation) ? 'India' : null,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired,
      sourceExperienceRequired: experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    })
  }

  if (jobs.length !== expectedCards || jobs.length !== expectedUrls.size || jobs.some(job => !expectedUrls.has(job.sourceUrl)) || new Set(jobs.map(job => job.sourceUrl)).size !== expectedCards) throw new Error('Flexsin incomplete current listing')
  return jobs
}

export const createFlexsinTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText, signal } = {}) {
    signal?.throwIfAborted()
    let careersHtml
    try { careersHtml = await fetchText(CAREERS_URL, { signal }) }
    finally { signal?.throwIfAborted() }
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error(
        'The verified Flexsin Technologies careers surface no longer matches the trusted first-party page',
      )
    }

    const jobs = extractJobs(careersHtml)
    if (jobs.some(job => !job.country)) {
      for (const job of jobs) job.sourceListingComplete = false
      console.warn('[flexsintechnologies] Some role locations remain unverified; prior jobs will be preserved.')
    }
    if (jobs.length === 0) {
      throw new Error('Flexsin Technologies no longer exposes trusted public job cards')
    }

    const verifiedJobs = jobs.filter(job => job.country === 'India')
    if (!verifiedJobs.length) throw new Error('Flexsin incomplete country scope: no verified India roles')
    return enrichRoleDescriptions(verifiedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    })), { fetchText, signal })
  },
})

export const run = async (options = {}) => createFlexsinTechnologiesScraper().run(options)

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
