import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const LISTINGS_URL = 'https://www.pega.com/about/careers/job-listings'
const BASE_URL = 'https://www.pega.com'

const stripTags = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\s+/g, ' ')
  .trim()

const firstMatch = (value, pattern) => value.match(pattern)?.[1] || null

const extractPegaCards = (html = '') => String(html).match(
  /<bolt-card-replacement\b[\s\S]*?<\/bolt-card-replacement>|<article\b[^>]*class=["'][^"']*bolt-card-replacement[^"']*["'][^>]*>[\s\S]*?<\/article>/gi,
) || []

const isPotentialPegaJobCard = (card) => (
  /\/about\/careers\//i.test(card)
  || /\b(?:Job Category|Location):/i.test(card)
  || /<p\b[^>]*>[\s\S]*?\bIndia\b[\s\S]*?<\/p>/i.test(card)
)

const isExplicitEmptyListing = (html = '') => {
  const messages = String(html).match(
    /<(?:p|div|section|h[1-6])\b[^>]*>[\s\S]{0,500}?<\/(?:p|div|section|h[1-6])>/gi,
  ) || []
  return messages.some((message) => (
    /^(?:no (?:open )?jobs?(?: found| available)?|no results?(?: found)?|0 jobs? found|sorry,? (?:there are )?no jobs?[^.]*)[.!]?$/i
      .test(stripTags(message))
  ))
}

const parsePegaCard = (card) => {
  const href = firstMatch(card, /href=["'](\/about\/careers\/\d+\/[^"']+)["']/i)
    || firstMatch(card, /\burl=["'](\/about\/careers\/\d+\/[^"']+)["']/i)
  const title = stripTags(firstMatch(card, /<h3\b[^>]*>([\s\S]*?)<\/h3>/i)
    || firstMatch(card, /aria-label=["']([^"']+)["']/i))
  const paragraphValues = (String(card).match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [])
    .map(stripTags)
    .filter(Boolean)
  const location = stripTags(firstMatch(card, /Location:\s*([^<]+)/i)
    || paragraphValues.find((value) => /\b(?:India|United States|United Kingdom|Canada|Australia|Germany|France|Japan|Singapore)\b/i.test(value))
    || paragraphValues.at(-1))
  const department = stripTags(firstMatch(card, /Job Category:\s*([^<]+)/i)) || null
  if (!href || !title || !location) return null
  return {
    title,
    location,
    department,
    sourceUrl: new URL(href, BASE_URL).toString(),
    jobId: href.match(/\/careers\/(\d+)\//)?.[1] || null,
  }
}

export const extractPegaListings = (html = '') => {
  const cards = extractPegaCards(html).filter(isPotentialPegaJobCard)

  return cards.map(parsePegaCard).filter((item) => item && /\bindia\b/i.test(item.location))
}

const extractNextPage = (html, currentUrl) => {
  const relative = firstMatch(String(html), /data-url=["']([^"']*\?page=\d+)["']/i)
  return relative ? new URL(relative.replace(/&amp;/g, '&'), currentUrl).toString() : null
}

export const extractPegaDetail = (html = '') => {
  const source = String(html)
  const title = stripTags(firstMatch(source, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i)) || null
  const fixtureDescription = firstMatch(
    source,
    /<div\b[^>]*class=["'][^"']*job-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  )
  const blockStart = source.search(/class=["']c-text-block["']/i)
  const blockTagStart = blockStart >= 0 ? source.lastIndexOf('<', blockStart) : -1
  const blockEnd = blockTagStart >= 0
    ? source.slice(blockTagStart).search(/<[^>]+class=["'][^"']*c-webform-card/i)
    : -1
  const realDescription = blockTagStart >= 0
    ? source.slice(
        blockTagStart,
        blockEnd > 0 ? blockTagStart + blockEnd : blockTagStart + 60000,
      )
    : null
  return {
    title,
    jobDescription: stripTags(fixtureDescription || realDescription) || null,
  }
}

export const createPegaScraper = ({
  maxPages = 20,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = (url) => fetchTextWithRetry(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)' },
      label: 'pega',
      timeoutMs: 20000,
    }),
  } = {}) {
    if (!Number.isInteger(maxPages) || maxPages <= 0) {
      throw new Error('[pega] maxPages must be a positive integer')
    }
    const listings = []
    const seenPages = new Set()
    const seenJobs = new Set()
    let pageUrl = LISTINGS_URL

    while (pageUrl) {
      if (seenPages.has(pageUrl)) {
        throw new Error('[pega] listing pagination repeated a page')
      }
      if (seenPages.size >= maxPages) {
        throw new Error(`[pega] listing pagination limit reached after ${maxPages} pages; refusing truncated results`)
      }
      seenPages.add(pageUrl)
      const html = await fetchText(pageUrl)
      const cards = extractPegaCards(html).filter(isPotentialPegaJobCard)
      if (cards.length === 0) {
        if (isExplicitEmptyListing(html)) break
        throw new Error('[pega] official listing page did not contain recognizable job cards')
      }
      const parsedCards = cards.map(parsePegaCard)
      if (parsedCards.some((item) => !item)) {
        throw new Error('[pega] official listing contains a malformed job card contract')
      }
      for (const item of parsedCards.filter((entry) => /\bindia\b/i.test(entry.location))) {
        if (seenJobs.has(item.jobId || item.sourceUrl)) continue
        seenJobs.add(item.jobId || item.sourceUrl)
        listings.push(item)
      }
      pageUrl = extractNextPage(html, pageUrl)
    }

    const jobs = []
    for (const listing of listings) {
      let detail = {}
      try {
        detail = extractPegaDetail(await fetchText(listing.sourceUrl))
      } catch {
        // Listing evidence is sufficient to retain an active role if a detail request is transiently unavailable.
      }
      const title = detail.title || listing.title
      const locationParts = listing.location
        .replace(/^India\s*-\s*/i, '')
        .split(/\s+-\s+|,/)
        .map((part) => part.trim())
        .filter(Boolean)
      const cityCandidate = (locationParts.at(-1) || '')
        .replace(/\s*\+\s*\d+\s+other locations?\s*$/i, '')
        .trim() || null
      const remoteStatus = /hybrid/i.test(listing.location)
        ? 'Hybrid'
        : (/remote/i.test(listing.location) ? 'Remote' : null)
      jobs.push({
        title,
        company: 'Pegasystems',
        location: listing.location,
        city: cityCandidate && !/^(?:india|remote)$/i.test(cityCandidate) ? cityCandidate : null,
        country: 'India',
        link: listing.sourceUrl,
        sourceUrl: listing.sourceUrl,
        applyUrl: listing.sourceUrl,
        jobId: listing.jobId,
        requisitionId: listing.jobId,
        department: listing.department,
        employmentType: null,
        remoteStatus,
        jobDescription: detail.jobDescription || null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        source: 'pega',
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = (options = {}) => createPegaScraper().run(options)
