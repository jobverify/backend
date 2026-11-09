import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const BASE_URL = 'https://careers.vestas.com'
const SEARCH_PATH = '/search/?q=&locationsearch=India'
const config = loadConfig(new URL('.', import.meta.url).pathname)

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value).replace(/\s+/g, ' ').trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value) => pattern.exec(String(value ?? ''))?.[1] ?? null

const isIndiaLocation = (location) => /(?:\bIN\b|\bIndia\b)/i.test(location ?? '')

const toOfficialUrl = (value) => {
  try {
    const url = new URL(decodeHtmlEntities(value), BASE_URL)
    return url.origin === BASE_URL ? url.toString() : null
  } catch {
    return null
  }
}

const extractJobIdFromUrl = (value) => extractFirst(/\/(\d+)\/?(?:[?#].*)?$/i, value)

const extractLabelValue = (html, label) => {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return normalizeWhitespace(extractFirst(
    new RegExp(`<dt[^>]*>\\s*${escapedLabel}\\s*<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`, 'i'),
    html,
  ))
}

const normalizePostingDate = (value) => {
  const text = normalizeWhitespace(value)
  if (!text) return null

  const match = /^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/.exec(text)
  if (!match) return text

  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    .indexOf(match[1])
  if (month < 0) return text

  return `${match[3]}-${String(month + 1).padStart(2, '0')}-${match[2].padStart(2, '0')}`
}

export const buildIndiaSearchUrl = (startRow = null) => {
  const url = new URL(SEARCH_PATH, BASE_URL)
  if (Number.isInteger(startRow) && startRow > 0) {
    url.searchParams.set('startrow', String(startRow))
  }
  return url.toString()
}

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(/<tr\b[^>]*class=["'][^"']*data-row[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi)]
  .map((match) => {
    const row = match[1]
    const linkMatch = /<a\b(?=[^>]*class=["'][^"']*jobTitle-link[^"']*["'])(?=[^>]*href=["']([^"']+)["'])[^>]*>([\s\S]*?)<\/a>/i.exec(row)
    const title = normalizeWhitespace(linkMatch?.[2])
    const sourceUrl = toOfficialUrl(linkMatch?.[1])
    const location = normalizeWhitespace(extractFirst(/<span\b[^>]*class=["'][^"']*jobLocation[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, row))
    const jobId = extractJobIdFromUrl(sourceUrl)

    if (!title || !location || !isIndiaLocation(location) || !sourceUrl || !jobId) return null

    return {
      title,
      location,
      city: location.split(',')[0]?.trim() || null,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      postingDate: normalizePostingDate(extractFirst(/<span\b[^>]*class=["'][^"']*jobDate[^"']*["'][^>]*>([\s\S]*?)<\/span>/i, row)),
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html, listing = {}) => {
  const descriptionHtml = extractFirst(/itemprop=["']description["'][^>]*>([\s\S]*?)<\/span>/i, html)
  const applyUrl = toOfficialUrl(extractFirst(/<a\b[^>]*class=["'][^"']*apply[^"']*["'][^>]*href=["']([^"']+)["']/i, html))
  const title = normalizeWhitespace(extractFirst(/<(?:h1|span)\b[^>]*itemprop=["']title["'][^>]*>([\s\S]*?)<\/(?:h1|span)>/i, html)) || listing.title || null
  const location = extractLabelValue(html, 'Location(s):') || listing.location || null
  const skills = [...String(descriptionHtml ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

  return {
    title,
    location,
    city: location?.split(',')[0]?.trim() || listing.city || null,
    jobId: listing.jobId || extractJobIdFromUrl(listing.sourceUrl),
    requisitionId: extractLabelValue(html, 'Requisition ID:') || listing.requisitionId || null,
    employmentType: extractLabelValue(html, 'Type of position:') || null,
    experienceRequired: extractLabelValue(html, 'Work experience:') || null,
    jobDescription: stripTags(descriptionHtml),
    requiredSkills: skills,
    postingDate: normalizeWhitespace(extractFirst(/<meta\b[^>]*itemprop=["']datePosted["'][^>]*content=["']([^"']+)["']/i, html)) || listing.postingDate || null,
    applyUrl,
    sourceUrl: listing.sourceUrl || null,
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify Vestas scraper)',
      Accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

export const createVestasScraper = () => ({
  async run({
    maxPages = config.maxPages,
    maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
    fetchText = defaultFetchText,
  } = {}) {
    const jobs = []
    const seenJobIds = new Set()
    let startRow = 0

    for (let page = 1; page <= maxPages; page += 1) {
      const listings = extractSearchResults(await fetchText(buildIndiaSearchUrl(startRow || null)))
      if (listings.length === 0) break

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detail = extractJobDetail(await fetchText(listing.sourceUrl), listing)
        if (!isIndiaLocation(detail.location)) continue

        jobs.push({
          ...detail,
          company: 'Vestas',
          link: detail.applyUrl || detail.sourceUrl,
          source: 'vestas',
          scrapedAt: new Date().toISOString(),
        })
        if (maxJobs && jobs.length >= maxJobs) return jobs
      }

      startRow += listings.length
    }

    return jobs
  },
})

export const run = async () => createVestasScraper().run()
