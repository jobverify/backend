import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ubgroup'
export const COMPANY = 'United Breweries Limited'
export const FIRST_PARTY_CAREERS_URL = 'https://www.unitedbreweries.com/careers'
export const HANDOFF_URL = 'https://careers.theheinekencompany.com/India/?locale=en_GB'
export const JOB_LISTING_URL = 'https://careers.theheinekencompany.com/Job-Listing?operatings_company%5B0%5D=6739'

const DETAIL_PATH_PATTERN = /\/job\/united-breweries-limited\/india\/[^"'?#\s<]+/gi
const SUCCESSFACTORS_APPLY_URL_PATTERN = /https:\/\/career5\.successfactors\.eu\/careers\?company=C0000032666P(?:&amp;|&)career_job_req_id=(\d+)(?:&amp;|&)career_ns=job_application/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(value)

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")

export const buildDetailUrl = (value) => new URL(value, HANDOFF_URL).toString()

export const hasFirstPartyCareersSignal = (html) => {
  const page = String(html ?? '')
  const directCareersPage = /<title>\s*Careers\s*\|\s*United Breweries Limited\s*<\/title>/i.test(page)
    && /Build your Career with India(?:&#39;|&apos;|'|’)?s Pioneering Beer Company/i.test(page)
    && /https:\/\/careers\.theheinekencompany\.com\/India\/\?locale=en_GB/i.test(page)
    && /https:\/\/careers\.theheinekencompany\.com\/(?:["'#?]|\s|<)/i.test(page)

  const careersAgeGatePage = /<title>\s*Age Gate - THC\s*\|\s*United Breweries Limited\s*<\/title>/i.test(page)
    && /Welcome to United Breweries Limited/i.test(page)
    && /href="https:\/\/www\.unitedbreweries\.com\/careers"/i.test(page)
    && /Learn more about our business, brands, careers, investor information and more\./i.test(page)

  return directCareersPage || careersAgeGatePage
}

export const hasOfficialHandoffSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Careers at United Breweries Limited \|\s*Part of The HEINEKEN Company\s*<\/title>/i.test(page)
    && /\/Job-Listing\?operatings_company(?:%5B0%5D|\[0\])=6739/i.test(page)
}

const hasConfirmedEmptyListing = (html) => /<h[1-6]\b[^>]*>\s*No jobs found\s*<\/h[1-6]>/i.test(String(html ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ''))

export const hasOfficialListingSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Job Listing\s*\|\s*HEINEKEN Careers\s*<\/title>/i.test(page)
    && /job-listing-page/i.test(page)
    && /operatings_company(?:\\u005B0\\u005D|\[0\]|%5B0%5D)?\s*["']?\s*:\s*\[\s*"6739"\s*\]/i.test(page)
    && (/\/job\/united-breweries-limited\/india\//i.test(page) || hasConfirmedEmptyListing(page))
}

export const extractListings = (html) => {
  const listings = []
  const seenUrls = new Set()

  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']*\/job\/united-breweries-limited\/india\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const sourceUrl = buildDetailUrl(match[1])
    if (seenUrls.has(sourceUrl)) continue

    const title = stripTags(match[2])
    if (!title) continue

    seenUrls.add(sourceUrl)
    listings.push({ title, sourceUrl })
  }

  return listings
}

export const extractJobPosting = (html) => {
  for (const match of String(html ?? '').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(decodeHtmlEntities(match[1]))
      const graph = Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : [parsed]
      const jobPosting = graph.find((entry) => entry?.['@type'] === 'JobPosting')
      if (!jobPosting) continue

      return {
        title: normalizeWhitespace(jobPosting.title),
        datePosted: normalizeWhitespace(jobPosting.datePosted),
        employmentType: normalizeWhitespace(jobPosting.employmentType),
        validThrough: normalizeWhitespace(jobPosting.validThrough),
      }
    } catch {
      // Ignore malformed JSON-LD blocks and continue looking for the trusted JobPosting object.
    }
  }

  return null
}

const extractApplyUrl = (html) => {
  const match = String(html ?? '').match(SUCCESSFACTORS_APPLY_URL_PATTERN)
  if (!match) return { applyUrl: null, requisitionId: null }

  return {
    applyUrl: decodeHtmlEntities(match[0]),
    requisitionId: match[1],
  }
}

const extractDescription = (html) => {
  const section = String(html ?? '').match(/<div[^>]+class=["'][^"']*job-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
  return stripTags(section)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    Accept: 'text/html,application/xhtml+xml',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const buildJob = (listing, detailHtml) => {
  const jobPosting = extractJobPosting(detailHtml)
  const { applyUrl, requisitionId } = extractApplyUrl(detailHtml)

  if (!jobPosting?.title || !requisitionId || !applyUrl) {
    throw new Error(`UB Group detail page no longer exposes the verified SuccessFactors apply contract for ${listing.sourceUrl}`)
  }

  return {
    title: jobPosting.title || listing.title,
    company: COMPANY,
    department: null,
    location: 'India',
    city: null,
    country: 'India',
    jobId: requisitionId,
    requisitionId,
    sourceUrl: listing.sourceUrl,
    applyUrl,
    employmentType: jobPosting.employmentType || null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: jobPosting.datePosted || null,
    closingDate: jobPosting.validThrough || null,
    jobDescription: extractDescription(detailHtml),
    source: SOURCE,
    link: applyUrl,
    scrapedAt: new Date().toISOString(),
  }
}

export const createUbGroupScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const firstPartyCareersHtml = await fetchText(FIRST_PARTY_CAREERS_URL)
    if (!hasFirstPartyCareersSignal(firstPartyCareersHtml)) {
      throw new Error('UB Group verified first-party careers surface no longer matches the official HEINEKEN handoff contract')
    }

    const handoffHtml = await fetchText(HANDOFF_URL)
    if (!hasOfficialHandoffSignal(handoffHtml)) {
      throw new Error('UB Group official HEINEKEN handoff no longer matches the verified public surface')
    }

    const listingHtml = await fetchText(JOB_LISTING_URL)
    if (!hasOfficialListingSignal(listingHtml)) {
      throw new Error('UB Group official job listing no longer matches the verified filtered HEINEKEN surface')
    }

    const listings = extractListings(listingHtml)
    if (!listings.length && !hasConfirmedEmptyListing(listingHtml)) {
      throw new Error('UB Group listing has no parsed jobs and no verified empty result')
    }
    const seenRequisitionIds = new Set()
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const job = buildJob(listing, detailHtml)

      if (seenRequisitionIds.has(job.requisitionId)) continue
      seenRequisitionIds.add(job.requisitionId)
      jobs.push(job)
    }

    if (!jobs.length) return attachInventoryEvidence(jobs, { status: 'verified-empty', surface: JOB_LISTING_URL, firstParty: true, listingComplete: true, pagesFetched: 1, reportedTotal: 0, indiaFacetCount: 0, verifiedAt: new Date().toISOString(), reason: 'Verified current United Breweries operating-company filter with visible No jobs found' })
    return jobs
  },
})

export const run = async (options = {}) => createUbGroupScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  console.log(`Total UB Group jobs scraped: ${jobs.length}`)

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
