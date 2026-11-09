import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { RNF_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = RNF_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const ALLOWED_HOSTNAMES = new Set(['rnftechnologies.com', 'www.rnftechnologies.com'])

const INDIA_LOCATION_PATTERN =
  /\b(?:india|noida|gurugram|gurgaon|delhi|new delhi|bangalore|bengaluru|hyderabad|chennai|mumbai|pune)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<\/(p|div|li|td|th|tr|section|article|h[1-6]|nav|table|tbody|thead)>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  try {
    const url = new URL(value, baseUrl)
    if (!ALLOWED_HOSTNAMES.has(url.hostname.toLowerCase())) return null
    url.hostname = url.hostname.replace(/^www\./i, '')
    return url.toString()
  } catch {
    return null
  }
}

const stripTags = (value) => normalizeWhitespace(value) || null

const extractFirst = (pattern, value) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? match[1] : null
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const readStructuredRecords = (html = '') => [...String(html).matchAll(
  /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
)].flatMap(([, value]) => {
  const record = JSON.parse(value)
  return Array.isArray(record) ? record : record['@graph'] || [record]
})
const hasCurrentListingsSignal = (html = '') => /<title[^>]*>[\s\S]*RNF Technologies\s*<\/title>/i.test(html)
  && /Current openings at RNF Technologies/i.test(html) && /class=["']rl-row["']/i.test(html)

const extractCurrentListings = (html = '') => {
  const collection = readStructuredRecords(html).find(record => record['@type'] === 'ItemList' && record.name === 'Current openings at RNF Technologies')
  const cards = [...String(html).matchAll(/<div\b[^>]*class=["']rl-row["'][^>]*>([\s\S]*?)<\/div>/gi)]
  if (!collection || !Array.isArray(collection.itemListElement) || collection.numberOfItems !== cards.length || collection.itemListElement.length !== cards.length || !cards.length) {
    throw new Error('RNF incomplete current listing')
  }
  const records = cards.map(([, card]) => {
    const anchor = card.match(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
    const sourceUrl = toAbsoluteUrl(anchor?.[1])
    const title = stripTags(anchor?.[2])
    const fields = [...card.matchAll(/<span[^>]*class=["']rl-c["'][^>]*>([\s\S]*?)<\/span>/gi)].map(([, text]) => stripTags(text))
    const location = fields[1]
    const matchingItem = collection.itemListElement.find(item => toAbsoluteUrl(item.url) === sourceUrl && item.name === title)
    if (!title || !location || !sourceUrl || !matchingItem || !/^\/join-our-team\/current-openings\/[a-z0-9-]+$/.test(new URL(sourceUrl).pathname)) throw new Error('RNF incomplete current role identity')
    const jobId = new URL(sourceUrl).pathname.split('/').at(-1)
    return { title, department: fields[0], location, city: stripTags(location.split(',')[0]), country: /\bindia\b/i.test(location) ? 'India' : null,
      jobId, requisitionId: jobId, employmentType: fields[2], sourceUrl, detailUrl: sourceUrl, link: sourceUrl }
  })
  if (new Set(records.map(job => job.jobId)).size !== records.length) throw new Error('RNF incomplete duplicate current role identity')
  return records
}

export const hasOfficialListingsSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  if (hasCurrentListingsSignal(page)) return true

  return /<title[^>]*>[\s\S]*RNF Technologies\s*<\/title>/i.test(page)
    && normalized.includes('Current Job Openings')
    && normalized.includes('Job Title')
    && normalized.includes('Location')
  }

export const extractJobListings = (html = '') => {
  if (hasCurrentListingsSignal(html)) return extractCurrentListings(html)
  const page = String(html ?? '')
  const jobs = []

  for (const match of page.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = match[1]
    const href = extractFirst(/<a[^>]*href=["']([^"']+)["']/i, rowHtml)
    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cellMatch) => stripTags(cellMatch[1]))
      .filter(Boolean)
    const jobTitle = stripTags(extractFirst(/<a[^>]*href=["'][^"']+["'][^>]*>([\s\S]*?)<\/a>/i, rowHtml))
    const location = cells[1] || null
    const sourceUrl = toAbsoluteUrl(href)

    if (!jobTitle || !location || !sourceUrl || !INDIA_LOCATION_PATTERN.test(location)) continue

    jobs.push({
      title: jobTitle,
      location,
      city: stripTags(location.split(',')[0]) || null,
      country: 'India',
      jobId: slugify(jobTitle),
      requisitionId: slugify(jobTitle),
      sourceUrl,
      detailUrl: sourceUrl,
      link: sourceUrl,
    })
  }

  return jobs
}

export const hasOfficialDetailSignal = (html = '', listing = {}) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const expectedTitle = listing.title ? new RegExp(listing.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') : null

  return /<title[^>]*>[\s\S]*?\|\s*RNF Technologies\s*<\/title>/i.test(page)
    && normalized.includes('Current Openings')
    && (
      normalized.includes('Job Description')
      || normalized.includes('Job Role:')
    )
    && (
      normalized.includes('Skills')
      || normalized.includes('Must Have Skills')
    )
    && /\/join-our-team\/current-openings\/(?:\d+|[a-z0-9-]+)\/apply/i.test(page)
    && (!expectedTitle || expectedTitle.test(normalized))
  }

export const extractJobDetail = (html = '', listing = {}) => {
  const structured = readStructuredRecords(html).find(record => record['@type'] === 'JobPosting')
  if (structured) {
    const employer = structured.hiringOrganization?.name
    const detailUrl = toAbsoluteUrl(structured.url)
    if (employer !== 'RNF Technologies' || !detailUrl || detailUrl !== toAbsoluteUrl(listing.sourceUrl)
      || structured.identifier?.value !== listing.jobId || structured.title !== listing.title) throw new Error('RNF structured detail employer or job identity mismatch')
    const address = structured.jobLocation?.address
    const countryValue = address?.addressCountry?.name || address?.addressCountry
    const countryCode = String(countryValue || '').toUpperCase()
    const country = /^(IN|INDIA)$/.test(countryCode) ? 'India'
      : /^[A-Z]{2}$/.test(countryCode) ? new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' }).of(countryCode) : null
    if (!address || !country || !address.addressLocality || !structured.description) throw new Error('RNF structured detail location or description incomplete')
    return { ...listing, title: structured.title, company: COMPANY, city: address.addressLocality, country,
      location: [address.addressLocality, address.addressRegion, country].filter(Boolean).join(', '),
      applyUrl: detailUrl, sourceUrl: detailUrl, postingDate: structured.datePosted || null,
      employmentType: structured.employmentType || null, jobDescription: stripTags(structured.description), remoteStatus: 'On-site' }
  }
  if (!hasOfficialDetailSignal(html, listing)) {
    throw new Error('The verified RNF Technologies detail page no longer matches the trusted first-party surface')
  }

  const title = stripTags(extractFirst(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html)) || listing.title
  const department = stripTags(extractFirst(/Department:\s*([^<\n]+)</i, `${html}<`))
  const experienceRequired = stripTags(
    extractFirst(/Relevant Experience:\s*([^<\n]+)</i, `${html}<`),
  )
  const jobDescriptionHtml = extractFirst(
    /(?:<h2[^>]*>\s*Job Description\s*<\/h2>\s*|Job Role:\s*)([\s\S]*?)(?:<h2[^>]*>\s*(?:Skills|Must Have Skills)\s*<\/h2>|Must Have Skills|«\s*Back to Openings|$)/i,
    html,
  )
  const jobDescription = stripTags(jobDescriptionHtml)
  const skillsSectionHtml = extractFirst(
    /(?:<h2[^>]*>\s*Skills\s*<\/h2>\s*|Must Have Skills\s*)([\s\S]*?)(?:«\s*Back to Openings|<h2[^>]*>|$)/i,
    html,
  )
  const requiredSkills = [...String(skillsSectionHtml ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
  const applyHref = extractFirst(
    /<a[^>]*href=["']([^"']*\/join-our-team\/current-openings\/(?:\d+|[a-z0-9-]+)\/apply)["']/i,
    html,
  )
  const applyUrl = toAbsoluteUrl(applyHref, listing.sourceUrl || CAREERS_URL)

  return {
    title,
    company: COMPANY,
    department: department || null,
    location: listing.location || null,
    city: listing.city || null,
    country: listing.country || 'India',
    jobId: listing.jobId || slugify(title),
    requisitionId: listing.requisitionId || slugify(title),
    sourceUrl: listing.sourceUrl || null,
    applyUrl,
    employmentType: null,
    experienceRequired: experienceRequired || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription,
    remoteStatus: 'On-site',
  }
}

export const createRNFTechnologiesScraper = ({
  maxJobs = null,
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({ signal, fetchText = defaultFetchText, now = defaultNow } = {}) {
    const request = async (fetcher, url, options = {}) => {
      signal?.throwIfAborted()
      try { return await fetcher(url, { ...options, signal }) }
      finally { signal?.throwIfAborted() }
    }
    const listingsHtml = await request(fetchText, CAREERS_URL)
    if (!hasOfficialListingsSignal(listingsHtml)) {
      throw new Error('The verified RNF Technologies current openings surface no longer matches the trusted first-party page')
    }

    const listings = extractJobListings(listingsHtml)
    const selectedListings = maxJobs ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const listing of selectedListings) {
      const detailHtml = await request(fetchText, listing.detailUrl)
      const job = extractJobDetail(detailHtml, listing)
      if (job.country !== 'India') continue
      jobs.push({
        ...job,
        ...(selectedListings.length < listings.length ? { sourceListingComplete: false } : {}),
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createRNFTechnologiesScraper().run(options)

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
