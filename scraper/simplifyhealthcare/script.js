import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'simplifyhealthcare'
export const COMPANY = 'Simplify Healthcare'
export const CAREERS_URL = 'https://simplifyhealthcare.com/careers/current-openings/'
export const INDIA_ARCHIVE_URL = 'https://simplifyhealthcare.com/category/careers/current-openings/india/'
export const WORDPRESS_POSTS_API_URL = 'https://simplifyhealthcare.com/wp-json/wp/v2/posts'

const BASE_URL = 'https://simplifyhealthcare.com'
const INDIA_DETAIL_PATH_PATTERN = /^\/careers\/current-openings\/india\/[^/?#]+\/?$/i
const DATE_PATTERN = /\b([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\b/
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const MONTH_INDEX = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTagsToLines = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\r/g, '')
  .replace(/\[(?:\/)?[^\]]+\]/g, ' ')
  .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/main|\/nav|\/h[1-6]|\/a|\/ul|\/ol)\b[^>]*>/gi, '\n')
  .replace(/<(p|div|li|section|article|main|nav|h[1-6]|a|ul|ol)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/[ \t\f\v]+/g, ' ')
  .replace(/\n+/g, '\n')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const stripTagsToText = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/\r/g, '')
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/main|\/nav|\/h[1-6]|\/a|\/ul|\/ol)\b[^>]*>/gi, ' ')
    .replace(/<(p|div|li|section|article|main|nav|h[1-6]|a|ul|ol)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), baseUrl).toString()
  } catch {
    return null
  }
}

const isIndiaDetailUrl = (value) => {
  if (!value) return false

  try {
    const url = new URL(value)
    return /(^|\.)simplifyhealthcare\.com$/i.test(url.hostname)
      && INDIA_DETAIL_PATH_PATTERN.test(url.pathname)
  } catch {
    return false
  }
}

const getJobSlugFromUrl = (value) => {
  try {
    const parts = new URL(value).pathname.split('/').filter(Boolean)
    return parts.at(-1) || null
  } catch {
    return null
  }
}

export const buildWordPressPostApiUrl = (value) => {
  const slug = getJobSlugFromUrl(value)
  if (!slug) return null

  return `${WORDPRESS_POSTS_API_URL}?slug=${encodeURIComponent(slug)}&_fields=id,date,date_gmt,link,slug,title,content,status`
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/\bIndia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const deriveCity = (value) => {
  const normalized = normalizeLocation(value)
  if (!normalized) return null

  const [firstPart] = normalized.split(',').map((part) => part.trim()).filter(Boolean)
  return normalizeCity(firstPart || normalized)
}

const toIsoDate = (value) => {
  const match = normalizeWhitespace(value)?.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})$/)
  if (!match) return null

  const month = MONTH_INDEX[match[1].slice(0, 3).toLowerCase()]
  const day = match[2].padStart(2, '0')
  const year = match[3]

  return month ? `${year}-${month}-${day}` : null
}

const inferRemoteStatus = (...values) => {
  const haystack = values.filter(Boolean).join(' ')
  if (/hybrid/i.test(haystack)) return 'Hybrid'
  if (/remote|remote-first|work from home/i.test(haystack)) return 'Remote'
  return 'On-site'
}

const extractExperienceRequired = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized.match(/\b\d+\s*(?:-|to)\s*\d+\s+years?\b/i)?.[0]
    || normalized.match(/\b\d+\+?\s+years?\b/i)?.[0]
    || null
}

const extractPostingMetadata = (html, lines) => {
  for (const match of String(html ?? '').matchAll(
    /<div\b[^>]*class=["'][^"']*\bentry-meta\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
  )) {
    const entryMetaHtml = match[1]
    const rawDate = stripTagsToText(
      entryMetaHtml.match(/<span\b[^>]*class=["'][^"']*\bpublished\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1],
    )?.match(DATE_PATTERN)?.[1] ?? null
    const location = normalizeLocation(stripTagsToText(
      entryMetaHtml.match(/<span\b[^>]*class=["'][^"']*\bblog-label\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1],
    ))

    if (rawDate || location) {
      return {
        rawDate,
        postingDate: toIsoDate(rawDate),
        location,
      }
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const dateMatch = line.match(DATE_PATTERN)
    if (!dateMatch) continue

    const rawDate = normalizeWhitespace(dateMatch[1])
    const remainder = normalizeWhitespace(line.replace(DATE_PATTERN, ''))
    const nextLine = normalizeWhitespace(lines[index + 1])
    const location = normalizeLocation(remainder || nextLine)
    if (!rawDate || !location) continue

    return {
      rawDate,
      postingDate: toIsoDate(rawDate),
      location,
    }
  }

  return {
    rawDate: null,
    postingDate: null,
    location: null,
  }
}

const extractDescription = (lines) => {
  const startIndex = lines.findIndex((line) => /^(About Simplify Healthcare|Role Overview|Role:?)$/i.test(line))
  if (startIndex === -1) return null

  const descriptionLines = []

  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index]
    if (
      index > startIndex
      && (
        /^If you have any questions\b/i.test(line)
        || /^(Related Posts|Share on|Home Careers)$/i.test(line)
      )
    ) {
      break
    }

    descriptionLines.push(line)
  }

  return normalizeWhitespace(descriptionLines.join(' '))
}

const hasVerifiedWordPressPostSignal = (payload, { url } = {}) => {
  if (!Array.isArray(payload) || payload.length !== 1) {
    return false
  }

  const [post] = payload
  const slug = getJobSlugFromUrl(url)
  const normalizedLink = toAbsoluteUrl(post?.link)
  const renderedContent = String(post?.content?.rendered ?? '')

  return normalizeWhitespace(post?.slug) === slug
    && normalizedLink === toAbsoluteUrl(url)
    && Boolean(normalizeWhitespace(post?.title?.rendered))
    && /careers@simplifyhealthcare\.com/i.test(renderedContent)
    && /(About Simplify Healthcare|About the Role|Role Overview|Role:)/i.test(renderedContent)
}

const extractWordPressDescription = (renderedContent) => {
  const lines = stripTagsToLines(renderedContent)
  return normalizeWhitespace(lines.join(' '))
}

const toPostingDateFromWordPressPost = (post = {}) => {
  const value = normalizeWhitespace(post?.date_gmt) || normalizeWhitespace(post?.date)
  if (!value) return null

  const date = new Date(value.endsWith('Z') ? value : `${value}Z`)
  if (Number.isNaN(date.getTime())) return null

  return date.toISOString().slice(0, 10)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTagsToLines(page).join(' ')

  return /Simplify Healthcare/i.test(page)
    && /Current Openings/i.test(page)
    && /New Thinking\. New Opportunities\./i.test(text)
}

const hasOfficialJobDetailSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTagsToLines(page).join(' ')

  return /Simplify Healthcare/i.test(page)
    && /About Simplify Healthcare/i.test(text)
    && /careers@simplifyhealthcare\.com/i.test(text)
  }

export const extractIndiaDetailUrls = (html) => {
  const urls = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!isIndiaDetailUrl(absoluteUrl) || seen.has(absoluteUrl)) continue

    seen.add(absoluteUrl)
    urls.push(absoluteUrl)
  }

  return urls
}

export const extractJobFromDetailHtml = ({ url, html }) => {
  if (!hasOfficialJobDetailSignal(html)) {
    throw new Error('Simplify Healthcare detail page no longer matches the verified official public careers surface')
  }

  const lines = stripTagsToLines(html)
  const title = normalizeWhitespace(String(html ?? '').match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
    || lines.find((line) => !/^(Home Careers|Current Openings|India)$/i.test(line))
    || null
  const metadata = extractPostingMetadata(html, lines)
  const jobDescription = extractDescription(lines)
  const slug = getJobSlugFromUrl(url)

  if (!title || !metadata.location || !slug) {
    throw new Error('Simplify Healthcare detail page no longer exposes the verified public job fields')
  }

  return {
    jobId: `${SOURCE}-${slug}`,
    requisitionId: `${SOURCE}-${slug}`,
    title,
    company: COMPANY,
    department: null,
    location: metadata.location,
    city: deriveCity(metadata.location),
    country: 'India',
    sourceUrl: url,
    applyUrl: url,
    employmentType: null,
    experienceRequired: extractExperienceRequired(jobDescription),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: metadata.postingDate,
    closingDate: null,
    jobDescription,
    remoteStatus: inferRemoteStatus(metadata.location, jobDescription),
  }
}

export const extractJobFromWordPressPostPayload = ({ url, payload }) => {
  if (!hasVerifiedWordPressPostSignal(payload, { url })) {
    throw new Error('Simplify Healthcare detail page no longer matches the verified official public careers surface')
  }

  const [post] = payload
  const title = normalizeWhitespace(post?.title?.rendered)
  const slug = getJobSlugFromUrl(url)
  const jobDescription = extractWordPressDescription(post?.content?.rendered)

  if (!title || !slug || !jobDescription) {
    throw new Error('Simplify Healthcare detail page no longer exposes the verified public job fields')
  }

  return {
    jobId: `${SOURCE}-${slug}`,
    requisitionId: `${SOURCE}-${slug}`,
    title,
    company: COMPANY,
    department: null,
    location: 'India',
    city: null,
    country: 'India',
    sourceUrl: url,
    applyUrl: url,
    employmentType: null,
    experienceRequired: extractExperienceRequired(jobDescription),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: toPostingDateFromWordPressPost(post),
    closingDate: null,
    jobDescription,
    remoteStatus: inferRemoteStatus(jobDescription),
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSimplifyHealthcareScraper = ({ maxDetails = 50 } = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
  } = {}) {
    const detailQueue = []
    const discoveredUrls = new Set()

    const enqueue = (urls, currentUrl = null) => {
      for (const candidate of urls) {
        if (candidate === currentUrl || discoveredUrls.has(candidate)) continue
        discoveredUrls.add(candidate)
        detailQueue.push(candidate)
      }
    }

    for (const listingUrl of [CAREERS_URL, INDIA_ARCHIVE_URL]) {
      const html = await fetchText(listingUrl)
      if (!hasOfficialCareersSignal(html)) {
        throw new Error('Simplify Healthcare careers page no longer matches the verified official public careers surface')
      }

      enqueue(extractIndiaDetailUrls(html))
    }

    const jobs = []

    while (detailQueue.length > 0 && jobs.length < maxDetails) {
      const url = detailQueue.shift()
      const html = await fetchText(url)
      const extractedJob = hasOfficialJobDetailSignal(html)
        ? extractJobFromDetailHtml({ url, html })
        : extractJobFromWordPressPostPayload({
            url,
            payload: await fetchJson(buildWordPressPostApiUrl(url)),
          })

      jobs.push({
        ...extractedJob,
        source: SOURCE,
        link: url,
        scrapedAt: now(),
      })

      enqueue(extractIndiaDetailUrls(html), url)
    }

    if (jobs.length === 0) {
      throw new Error('Simplify Healthcare no longer exposes verified public India current-opening detail pages')
    }

    return jobs
  },
})

export const run = async (options = {}) => createSimplifyHealthcareScraper().run(options)

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
