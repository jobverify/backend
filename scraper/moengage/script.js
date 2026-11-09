import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { runCurrentMoEngage } from './currentKula.js'

export const CAREERS_PAGE_URL = 'https://www.moengage.com/careers/'
export const BOARD_URL = 'https://moengage.hire.trakstar.com/'

const BOARD_ORIGIN = new URL(BOARD_URL).origin
const JOB_PATH_PATTERN = /^\/jobs\/([a-z0-9-]+)\/?$/i

const normalizeText = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?\s*>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim() || null

const getVerifiedJobUrl = (value) => {
  try {
    const url = new URL(value, BOARD_URL)
    const match = url.pathname.match(JOB_PATH_PATTERN)
    if (url.origin !== BOARD_ORIGIN || !match) return null

    url.search = ''
    url.hash = ''
    return { url: url.toString(), jobId: match[1] }
  } catch {
    return null
  }
}

const extractCity = (location) => normalizeText(location)
  ?.replace(/,?\s*india$/i, '')
  .split(/[,/|-]/)[0]
  ?.trim() || null

const extractIndiaLocation = (value) => {
  const text = normalizeText(value)
  if (!text || !/(?:\bindia\b|\bbengaluru\b|\bbangalore\b)/i.test(text)) return null

  const match = text.match(/(?:[A-Za-z .-]+,\s*)?(?:Bengaluru|Bangalore)(?:,\s*India)?|[A-Za-z .-]+,\s*India/i)
  return match?.[0]?.trim() || 'India'
}

const getListingContext = (html, index) => {
  const before = html.slice(0, index)
  const after = html.slice(index)
  const rowStart = Math.max(before.lastIndexOf('<tr'), before.lastIndexOf('<li'), before.lastIndexOf('<div'))
  const rowEndCandidates = [after.search(/<\/tr\s*>/i), after.search(/<\/li\s*>/i), after.search(/<\/div\s*>/i)]
    .filter((candidate) => candidate >= 0)
  const rowEnd = rowEndCandidates.length > 0 ? Math.min(...rowEndCandidates) : 900

  return html.slice(rowStart >= 0 ? rowStart : index, index + rowEnd + 12)
}

export const extractTrakstarListings = (html) => {
  const page = String(html ?? '')
  const listings = []
  const linkPattern = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi

  for (const match of page.matchAll(linkPattern)) {
    const detail = getVerifiedJobUrl(match[1])
    const title = normalizeText(match[2])
    if (!detail || !title) continue

    const context = getListingContext(page, match.index)
    const location = extractIndiaLocation(context)
    if (!location) continue

    listings.push({
      title,
      location,
      city: extractCity(location),
      sourceUrl: detail.url,
      applyUrl: detail.url,
      link: detail.url,
      jobId: detail.jobId,
      requisitionId: detail.jobId,
    })
  }

  return [...new Map(listings.map((listing) => [listing.sourceUrl, listing])).values()]
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /moengage/i.test(page)
    && /careers?/i.test(page)
    && [...page.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)]
      .some((match) => new URL(match[1], CAREERS_PAGE_URL).toString() === BOARD_URL)
}

export const hasVerifiedTrakstarBoardSignal = (html) => /moengage/i.test(String(html ?? ''))
  && extractTrakstarListings(html).length > 0

const extractLabeledField = (text, label) => normalizeText(
  text.match(new RegExp(`${label}\\s*:\\s*([^<\\n]+)`, 'i'))?.[1],
)

export const extractTrakstarDetail = (html, listing) => {
  const page = String(html ?? '')
  const text = normalizeText(page) || ''
  const descriptionMatch = page.match(/<(section|div)[^>]*class=["'][^"']*job-description[^"']*["'][^>]*>([\s\S]*?)<\/\1>/i)
  const description = normalizeText(descriptionMatch?.[2])?.replace(/^job description\s*/i, '')
    || text.match(/Job Description\s+([\s\S]*?)(?=\s+(?:Department|Location|Qualifications?)\s*:|$)/i)?.[1]?.trim()
    || null
  const location = extractIndiaLocation(extractLabeledField(page, 'Location') || text)

  return {
    isVerified: /moengage/i.test(page)
      && (new RegExp(listing.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(page) || /job description/i.test(page)),
    department: extractLabeledField(page, 'Department'),
    location,
    city: extractCity(location),
    jobDescription: description,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',
    Accept: 'text/html,application/xhtml+xml',
  },
  label: 'moengage',
  timeoutMs: 15000,
})

export const createMoEngageScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('MoEngage official careers page no longer links to the verified Trakstar board')
    }

    const boardHtml = await fetchText(BOARD_URL)
    if (!hasVerifiedTrakstarBoardSignal(boardHtml)) {
      throw new Error('MoEngage verified Trakstar board no longer exposes India job listings')
    }

    const jobs = []
    for (const listing of extractTrakstarListings(boardHtml)) {
      const detail = extractTrakstarDetail(await fetchText(listing.sourceUrl), listing)
      if (!detail.isVerified) continue

      jobs.push({
        ...listing,
        title: listing.title,
        company: 'MoEngage',
        department: detail.department || null,
        location: detail.location || listing.location,
        city: detail.city || listing.city,
        country: 'India',
        employmentType: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: detail.jobDescription,
        source: 'moengage',
        link: listing.link,
        scrapedAt: new Date().toISOString(),
      })
    }

    return jobs
  },
})

export const run = options => runCurrentMoEngage(options)
