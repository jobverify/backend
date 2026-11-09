import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://jobs.tetrapak.com'
export const SEARCH_PAGE_URL = `${BASE_URL}/search/?locationsearch=India&q=&searchResultView=LIST&locale=en_GB`
export const SEARCH_API_URL = `${BASE_URL}/services/recruiting/v1/jobs`
const DEFAULT_LOCALE = 'en_GB'
const COMPANY_NAME = 'Tetra Pak'
const SOURCE = 'tetrapak'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const unique = (values) => [...new Set(values.filter(Boolean))]

const normalizeLocation = (value) => normalizeWhitespace(value)
  ?.replace(/,\s*IND\b/i, '')
  .trim() || null

const normalizeLocationArray = (values) => unique(
  (Array.isArray(values) ? values : [])
    .map(normalizeLocation)
    .filter(Boolean),
)

const joinLocations = (values) => {
  const locations = normalizeLocationArray(values)
  return locations.length > 0 ? `${locations.join(', ')}, India` : null
}

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

export const buildSearchRequestPayload = (pageNumber = 0) => ({
  keywords: '',
  locale: DEFAULT_LOCALE,
  location: 'India',
  pageNumber,
  sortBy: 'recent',
})

export const buildDetailUrl = (title, jobId, locale = DEFAULT_LOCALE) =>
  `${BASE_URL}/job/${decodeHtmlEntities(title)}/${jobId}-${locale}/`

export const normalizeEmploymentType = (title) => {
  const normalizedTitle = normalizeWhitespace(title)?.toLowerCase() || ''
  if (/intern|internship|co-op|apprentice/.test(normalizedTitle)) return 'Internship'
  if (/contract|contractor|freelance/.test(normalizedTitle)) return 'Contract'
  return 'Full-time'
}

export const extractSearchSummary = (payload) => ({
  totalJobCount: Number.isFinite(payload?.totalJobs) ? payload.totalJobs : null,
  pageSize: Array.isArray(payload?.jobSearchResult) ? payload.jobSearchResult.length : 0,
})

export const extractSearchResults = (payload) => {
  if (!Array.isArray(payload?.jobSearchResult)) return []

  return payload.jobSearchResult
    .map((entry) => entry?.response || null)
    .filter(Boolean)
    .filter((record) => (record.jobLocationShort || []).some((value) => /\bIND\b|\bIndia\b/i.test(String(value))))
    .map((record) => {
      const title = normalizeWhitespace(record.unifiedStandardTitle)
      const jobId = normalizeWhitespace(record.id)
      const locations = normalizeLocationArray(record.sfstd_jobLocation_obj || record.jobLocationShort)
      const location = joinLocations(record.sfstd_jobLocation_obj || record.jobLocationShort || locations)
      const urlTitle = normalizeWhitespace(record.unifiedUrlTitle || record.urlTitle || title)
      const sourceUrl = title && jobId && urlTitle ? buildDetailUrl(urlTitle, jobId) : null

      if (!title || !jobId || !location || !urlTitle || !sourceUrl) return null

      return {
        title,
        location,
        city: locations[0] || null,
        state: null,
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        postingDate: normalizeWhitespace(record.unifiedStandardStart),
        closingDate: normalizeWhitespace(record.unifiedStandardEnd),
      }
    })
    .filter(Boolean)
}

const isGenericInterestTitle = (value) => /^(?:expression of interest|tetra pak(?:\s+|\s*[-\u2013\u2014]\s*)expression of interest|expression of interest(?:\s+|\s*[-\u2013\u2014]\s*)tetra pak)$/i
  .test(normalizeWhitespace(value) || '')

// Detection only: retained descriptions and all other fields still use the existing extraction.
const visibleInterestFields = (html) => {
  const source = String(html ?? '')
  const fields = { title: [], description: [] }
  const stack = []
  const inert = new Set(['head', 'script', 'style', 'template', 'noscript', 'textarea', 'footer', 'aside', 'nav'])
  const rawText = new Set(['script', 'style', 'noscript', 'textarea'])
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
  const tokens = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?[a-z][a-z0-9:-]*(?:[^"'<>]|"[^"]*"|'[^']*')*>|[^<]+|</gi

  for (const match of source.matchAll(tokens)) {
    const token = match[0]
    const rawTag = stack.at(-1)?.tag
    if (rawText.has(rawTag) && !new RegExp(`^</${rawTag}\\s*>$`, 'i').test(token)) continue
    if (token.startsWith('<!--') || token.startsWith('<!')) continue
    if (token === '<') return null
    if (!token.startsWith('<')) {
      if (!stack.at(-1)?.hidden) {
        for (const node of stack) {
          if (node.capture && match.index < node.capture.limit) {
            node.capture.text.push(token.slice(0, node.capture.limit - match.index))
          }
        }
      }
      continue
    }

    const [, closing, tagName] = /^<(\/?)([a-z][a-z0-9:-]*)/i.exec(token)
    const tag = tagName.toLowerCase()
    if (closing) {
      const index = stack.findLastIndex((node) => node.tag === tag)
      if (index < 0) return null
      if (stack[index].capture) stack[index].capture.closed = true
      stack.splice(index)
      continue
    }

    const attributes = new Map([...token.matchAll(/\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)]
      .map((attr) => [attr[1].toLowerCase(), decodeHtmlEntities(attr[2] ?? attr[3] ?? attr[4] ?? '')]))
    const hidden = stack.at(-1)?.hidden || inert.has(tag) || attributes.has('hidden')
      || /^true$/i.test(attributes.get('aria-hidden') || '')
      || /(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse))/i.test(attributes.get('style') || '')
      || /(?:^|[\s_-])(?:related(?:jobs|roles)?|recommended(?:jobs|roles)?|recommendations|similar(?:jobs|roles)?|jobcards?|job-card|footer|hidden)(?:$|[\s_-])/i
        .test(`${attributes.get('class') || ''} ${attributes.get('id') || ''}`)
    const node = { tag, hidden }
    const prop = attributes.get('itemprop')?.toLowerCase()
    if (!hidden && tag === 'span' && (prop === 'title' || prop === 'description')) {
      const start = match.index + token.length
      const firstClose = /<\/span>/i.exec(source.slice(start))
      // Never recover text beyond the extractor's first-closing-span boundary.
      node.capture = { text: [], closed: false, limit: firstClose ? start + firstClose.index : start }
      fields[prop].push(node.capture)
    }
    if (!voidTags.has(tag)) stack.push(node)
  }
  return fields
}

const isConfirmedGeneralInterest = (html, title, listingTitle) => {
  if (!isGenericInterestTitle(title) || (normalizeWhitespace(listingTitle) && !isGenericInterestTitle(listingTitle))) return false
  const fields = visibleInterestFields(html)
  if (!fields || fields.title.length !== 1 || fields.description.length !== 1) return false
  const [ownTitle] = fields.title
  const [description] = fields.description
  return ownTitle.closed && description.closed
    && isGenericInterestTitle(normalizeWhitespace(ownTitle.text.join(' ')))
    && /\bThis is not an application for a specific position\./i.test(normalizeWhitespace(description.text.join(' ')) || '')
}

export const extractJobDetail = (html, listing = {}) => {
  const title = normalizeWhitespace(
    extractFirst(/itemprop="title"[^>]*>([\s\S]*?)<\/span>/i, html),
  ) || listing.title || null
  const descriptionHtml = extractFirst(
    /itemprop="description"[^>]*>([\s\S]*?)<\/span>/i,
    html,
  )
  if (isConfirmedGeneralInterest(html, title, listing.title)) return null
  const jobId = normalizeWhitespace(
    extractFirst(/jobID\s*[:=]\s*(\d+)/i, html),
  ) || normalizeWhitespace(
    extractFirst(/\/apply\/(\d+)\/\?locale=/i, html),
  ) || listing.jobId || null
  const sourceUrl = listing.sourceUrl || (title && jobId ? buildDetailUrl(title, jobId) : null)

  return {
    title,
    location: listing.location || null,
    city: listing.city || null,
    state: listing.state || null,
    jobId,
    requisitionId: listing.requisitionId || jobId,
    employmentType: normalizeEmploymentType(title),
    experienceRequired: listing.experienceRequired || null,
    jobDescription: stripTags(descriptionHtml),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractListItems(descriptionHtml),
    postingDate: listing.postingDate || null,
    closingDate: listing.closingDate || null,
    applyUrl: sourceUrl,
    sourceUrl,
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

const defaultFetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      ...(options.headers || {}),
    },
    body: options.body,
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

export const createTetraPakScraper = () => ({
  async run({
    maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
    maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
    fetchJson = defaultFetchJson,
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const jobs = []
    const seenJobIds = new Set()

    for (let pageNumber = 0; pageNumber < maxPages; pageNumber += 1) {
      const payload = await fetchJson(SEARCH_API_URL, {
        method: 'POST',
        body: JSON.stringify(buildSearchRequestPayload(pageNumber)),
      })
      const listings = extractSearchResults(payload)
      const summary = extractSearchSummary(payload)

      if (listings.length === 0) break

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detail = extractJobDetail(await fetchText(listing.sourceUrl), listing)
        if (!detail) continue

        jobs.push({
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          title: detail.title || listing.title,
          company: COMPANY_NAME,
          department: null,
          location: detail.location || listing.location,
          city: detail.city || listing.city,
          state: detail.state || listing.state,
          link: detail.sourceUrl || listing.sourceUrl,
          applyUrl: detail.applyUrl || listing.sourceUrl,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          source: SOURCE,
          employmentType: detail.employmentType,
          experienceRequired: detail.experienceRequired,
          jobDescription: detail.jobDescription,
          minimumQualification: detail.minimumQualification,
          preferredQualification: detail.preferredQualification,
          requiredSkills: detail.requiredSkills,
          postingDate: detail.postingDate || listing.postingDate,
          closingDate: detail.closingDate || listing.closingDate,
          scrapedAt: now(),
        })

        if (maxJobs && jobs.length >= maxJobs) return jobs
      }

      const totalJobCount = summary.totalJobCount || 0
      const pageSize = summary.pageSize || listings.length
      if ((pageNumber + 1) * pageSize >= totalJobCount) break
    }

    return jobs
  },
})

export const run = async (options = {}) => createTetraPakScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Tetra Pak scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'tetrapak')
    console.log('DB result:', result)
    process.exit(0)
  }
}
