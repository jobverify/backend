import path from 'path'
import { fileURLToPath } from 'url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { isIndiaJob as isIndiaJobInScope } from '../../scraper-support/utils/indiaLocationFilter.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREERS_URL = 'https://g7cr-site-dev-update-12-12-25.azurewebsites.net/job-listings/'
export const CAREERS_SITEMAP_URL = 'https://g7cr-site-dev-update-12-12-25.azurewebsites.net/careers-sitemap.xml'
export const COMPANY = 'G7 CR Technologies'
export const SOURCE = 'g7cr'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const DETAIL_URL_REGEX = /^https:\/\/g7cr-site-dev-update-12-12-25\.azurewebsites\.net\/job-details\/([a-z0-9-]+)\/$/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeSlugToken = (value) => normalizeWhitespace(String(value ?? '').replace(/-/g, ' '))

const toTitleCase = (value) => normalizeWhitespace(value)
  ?.split(' ')
  .filter(Boolean)
  .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
  .join(' ')
  || null

const buildLocation = (cityToken, countryToken) => {
  const rawCity = toTitleCase(decodeSlugToken(cityToken))
  const city = normalizeCity(rawCity)
  const country = toTitleCase(decodeSlugToken(countryToken))
  if (!rawCity || !city || !country) return { city: null, country: null, location: null }

  return {
    city,
    country,
    location: `${rawCity}, ${country}`,
  }
}

const parseSlug = (slug) => {
  const parts = String(slug ?? '').split('-').filter(Boolean)
  if (parts.length < 3) return null

  const countryToken = parts.at(-1)
  const cityToken = parts.at(-2)
  const titleTokens = parts.slice(0, -2)
  const title = toTitleCase(titleTokens.join(' '))
  const { city, country, location } = buildLocation(cityToken, countryToken)

  if (!title || !city || !country || !location) return null

  return {
    title,
    city,
    country,
    location,
  }
}

const extractUrlEntries = (xml) => Array.from(
  String(xml ?? '').matchAll(/<url>\s*<loc>([\s\S]*?)<\/loc>(?:\s*<lastmod>([\s\S]*?)<\/lastmod>)?[\s\S]*?<\/url>/gi),
).map((match) => ({
  url: normalizeWhitespace(match[1]),
  lastmod: normalizeWhitespace(match[2]) || null,
}))

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /g7\s*cr/i.test(page)
    && /job listings/i.test(page)
    && /https:\/\/g7cr-site-dev-update-12-12-25\.azurewebsites\.net\/job-listings\/?/i.test(page)
}

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

export const extractJobsFromSitemap = (xml) => {
  const jobs = []
  const seenJobIds = new Set()

  for (const entry of extractUrlEntries(xml)) {
    const sourceUrl = entry.url
    const slug = normalizeWhitespace(sourceUrl?.match(DETAIL_URL_REGEX)?.[1])
    if (!sourceUrl || !slug || seenJobIds.has(slug)) continue

    const parsed = parseSlug(slug)
    if (!parsed) continue

    const job = {
      title: parsed.title,
      company: COMPANY,
      department: null,
      location: parsed.location,
      city: parsed.city,
      country: parsed.country,
      jobId: slug,
      requisitionId: slug,
      sourceUrl,
      applyUrl: `${sourceUrl}#career_detail`,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: entry.lastmod,
      closingDate: null,
      jobDescription: null,
    }

    if (!isIndiaJobInScope(job)) continue

    seenJobIds.add(slug)
    jobs.push(job)
  }

  return jobs
}


const CURRENT_ORIGIN = 'https://noventiqai.com'
const CURRENT_JOBS_URL = CURRENT_ORIGIN + '/job-listings/'
const textFromHtml = (html) => normalizeWhitespace(String(html ?? '')
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#0*38;/gi, '&'))
const hasCanonical = (html, url) => [...String(html ?? '').matchAll(/<link\b[^>]*>/gi)]
  .some(([tag]) => /rel=["']canonical["']/i.test(tag) && tag.match(/href=["']([^"']+)["']/i)?.[1] === url)

const fetchMigratedJobs = async (fetchText, { now, maxJobs }) => {
  const homepage = await fetchText(CURRENT_ORIGIN + '/')
  const hasCurrentBrandTitle = [...String(homepage).matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)]
    .some((match) => textFromHtml(match[1]) === 'Noventiq Global AI Solutions')
  const hasG7CrCompanyLink = [...String(homepage).matchAll(/<a\b[^>]*>/gi)]
    .some(([tag]) => /^https:\/\/www\.linkedin\.com\/company\/g7cr-technologies\/?$/.test(
      tag.match(/href=["']([^"']+)["']/i)?.[1] || '',
    ))
  if (!hasCanonical(homepage, CURRENT_ORIGIN + '/') || !hasCurrentBrandTitle || !hasG7CrCompanyLink) {
    throw new Error('G7 CR current official employer identity is not confirmed by the Noventiq homepage')
  }
  const about = await fetchText(CURRENT_ORIGIN + '/about/')
  if (!hasCanonical(about, CURRENT_ORIGIN + '/about/')
    || !/G7\s*CR Technologies is proudly part of Noventiq Global/i.test(textFromHtml(about) || '')) {
    throw new Error('G7 CR current official employer identity is not confirmed by the Noventiq About page')
  }
  const privacy = await fetchText(CURRENT_ORIGIN + '/privacy-policy/')
  const privacyText = textFromHtml(privacy) || ''
  if (!hasCanonical(privacy, CURRENT_ORIGIN + '/privacy-policy/')
    || !/NOVENTIQ GLOBAL AI SOLUTIONS PVT\.\s*LTD\./i.test(privacyText)
    || !/Only authorized personnel from G7\s*CR TECHNOLOGIES PVT\.\s*LTD\./i.test(privacyText)) {
    throw new Error('G7 CR current official employer identity is not confirmed by the Noventiq privacy policy')
  }
  const listingsHtml = await fetchText(CURRENT_JOBS_URL)
  if (!hasCanonical(listingsHtml, CURRENT_JOBS_URL) || !/Job Listings/i.test(listingsHtml)
    || !/Noventiq Global AI Solutions/i.test(listingsHtml)) {
    throw new Error('G7 CR current public jobs board changed materially')
  }
  const listings = [...String(listingsHtml).matchAll(/<h4\b[^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h4>/gi)]
    .map((match) => ({ sourceUrl: match[1], title: textFromHtml(match[2]) }))
  if (!listings.length || listings.some((job) => !job.title
    || !/^https:\/\/noventiqai\.com\/job-details\/[a-z0-9-]+\/$/i.test(job.sourceUrl))
    || new Set(listings.map((job) => job.sourceUrl)).size !== listings.length) {
    throw new Error('G7 CR current public board has invalid or duplicate listings')
  }
  const sitemap = await fetchText(CURRENT_ORIGIN + '/careers-sitemap.xml')
  const sitemapUrls = new Set([...String(sitemap).matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map((match) => match[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim()))
  if (sitemapUrls.size !== listings.length || listings.some((job) => !sitemapUrls.has(job.sourceUrl))) {
    throw new Error('G7 CR current careers sitemap and listings disagree')
  }
  const jobs = []
  for (const listing of Number.isInteger(maxJobs) && maxJobs > 0 ? listings.slice(0, maxJobs) : listings) {
    const detail = await fetchText(listing.sourceUrl)
    const section = [...String(detail).matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)]
      .map((match) => match[1])
      .find((block) => textFromHtml(block.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1]) === listing.title)
    const description = textFromHtml(section)
    const lines = String(section || '').replace(/<\/(?:li|p|div)>/gi, '\n').replace(/<[^>]+>/g, ' ')
    const location = normalizeWhitespace(lines.match(/\bLocation\s*:\s*([^\n]+)/i)?.[1])
    const city = normalizeCity(location?.split(',')[0]?.trim())
    if (!section || !/G7\s*CR/i.test(description || '') || !location || !city
      || !isIndiaJobInScope({ location, city }) || !/href=["']#career_detail["']/i.test(detail)
      || !/id=["']career_detail["']/i.test(detail)) {
      throw new Error('G7 CR current job detail no longer confirms the employer, role, location and apply form: ' + listing.sourceUrl)
    }
    const jobId = new URL(listing.sourceUrl).pathname.split('/').filter(Boolean).at(-1)
    jobs.push({ ...listing, company: COMPANY, department: null, location, city, country: 'India',
      jobId, requisitionId: jobId, applyUrl: listing.sourceUrl + '#career_detail',
      employmentType: null, experienceRequired: null, minimumQualification: null,
      preferredQualification: null, requiredSkills: [], postingDate: null, closingDate: null,
      jobDescription: description, source: SOURCE, link: listing.sourceUrl + '#career_detail', scrapedAt: now(),
    })
  }
  return jobs
}

export const createG7CrScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    let careersHtml
    try {
      careersHtml = await fetchText(CAREERS_URL)
    } catch (error) {
      if (!/HTTP (?:403|404)\b/.test(error.message || '')) throw error
      return fetchMigratedJobs(fetchText, { now, maxJobs })
    }
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Response is not the verified official G7 CR careers page')
    }

    const sitemapXml = await fetchText(CAREERS_SITEMAP_URL)
    const jobs = extractJobsFromSitemap(sitemapXml)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createG7CrScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running G7 CR scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
