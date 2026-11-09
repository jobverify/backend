import { extractLinkedinJobCards } from '../../scraper-support/utils/linkedinJobCards.js'
export const SOURCE = 'trell'
export const COMPANY = 'Trell'
export const LINKEDIN_COMPANY_PAGE_URL = 'https://www.linkedin.com/company/trell/'
export const LINKEDIN_INDIA_JOBS_URL =
  'https://www.linkedin.com/jobs/search/?f_C=10796691&geoId=102713980'
export const LINKEDIN_COMPANY_ID = '10796691'
export const DISPOSITION = 'verified-linkedin-company-page-plus-public-india-jobs-search'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on Sunday, August 2, 2026 that direct access to https://trell.co/ timed out during live checks, but the public LinkedIn company page at https://www.linkedin.com/company/trell/ remained accessible and identified Trell via urn:li:organization:10796691, its public company description, and its website field pointing to https://trell.co/. The public LinkedIn India jobs search at https://www.linkedin.com/jobs/search/?f_C=10796691&geoId=102713980 returned "We couldn’t find a match" with zero India jobs on the verified date. This scraper validates that current public LinkedIn contract and returns India jobs only when the public search exposes them.'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify/1.0)'

const decodeHtml = (value = '') =>
  String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) =>
  normalizeWhitespace(
    decodeHtml(String(value ?? ''))
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n')
      .replace(/<p\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )

const normalizePageText = (value = '') =>
  normalizeWhitespace(
    String(value)
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )

const parseLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const city = parts[0] || null
  const country = parts.at(-1) === 'India' ? 'India' : parts.at(-1) || null

  return {
    location: normalized,
    city,
    country,
  }
}

export const pageIndicatesTrellLinkedInCompany = (html = '') => {
  const page = String(html)
  const text = normalizePageText(page) || ''

  return /\btrell\s*\|\s*linkedin\b/i.test(page)
    && /\bindia'?s largest lifestyle social commerce platform\b/i.test(text)
    && /\bbangalore,\s*karnataka\b/i.test(text)
    && (
      new RegExp(`urn:li:organization:${LINKEDIN_COMPANY_ID}`, 'i').test(page)
      || /https:\/\/trell\.co\/?/i.test(page)
    )
}

export const hasVerifiedLinkedInJobsPageSignal = (html = '') => {
  const page = String(html)
  const text = normalizePageText(page) || ''

  return /\blinkedin\b/i.test(text)
    && /\btrell\b/i.test(text)
    && (
      /base-card__full-link/i.test(page)
      || /we couldn['’]t find a match/i.test(text)
      || /\b0 jobs?\s+jobs?\s+in india\b/i.test(text)
      || /\bno matching jobs found\b/i.test(text)
    )
}

export const extractSearchResults = (html = '') => extractLinkedinJobCards(html)
  .map(({ id: jobId, href: rawHref, title: rawTitle, company: rawCompany, location: rawLocation, datetime: postingDate }) => {
      const title = stripTags(rawTitle)
      const company = stripTags(rawCompany)
      const sourceUrl = normalizeWhitespace(rawHref)?.replace(/&amp;/g, '&')
      const locationData = parseLocation(stripTags(rawLocation))

      if (!jobId || !title || !company || !sourceUrl) return null
      if (company !== COMPANY || locationData.country !== 'India') return null

      return {
        title,
        company,
        department: null,
        location: locationData.location,
        city: locationData.city,
        country: locationData.country,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeWhitespace(postingDate),
        closingDate: null,
        jobDescription: null,
      }
    })
    .filter(Boolean)
    .filter((listing, index, collection) =>
      collection.findIndex((candidate) => candidate.jobId === listing.jobId) === index)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createTrellScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const companyHtml = await fetchText(LINKEDIN_COMPANY_PAGE_URL)
    if (!pageIndicatesTrellLinkedInCompany(companyHtml)) {
      throw new Error(
        'Trell LinkedIn company page no longer matches the verified public organization surface.',
      )
    }

    const searchHtml = await fetchText(LINKEDIN_INDIA_JOBS_URL)
    if (!hasVerifiedLinkedInJobsPageSignal(searchHtml)) {
      throw new Error(
        'Trell LinkedIn India jobs search page no longer matches the verified public search shell.',
      )
    }

    return extractSearchResults(searchHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createTrellScraper().run(options)
