import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'cloverinfotech'
export const COMPANY = 'Clover Infotech'
export const BASE_URL = 'https://www.cloverinfotech.com'
export const JOB_OPENINGS_URL = `${BASE_URL}/job-openings/`
export const COMPANY_DOMAIN = 'cloverinfotech.com'
export const DESKTOP_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_SEGMENTS = new Map([
  ['airoli', 'Airoli'],
  ['bengaluru', 'Bengaluru'],
  ['chennai', 'Chennai'],
  ['delhi', 'Delhi'],
  ['delhi ncr', 'Delhi NCR'],
  ['gurugram', 'Gurugram'],
  ['hyderabad', 'Hyderabad'],
  ['indore', 'Indore'],
  ['india', 'India'],
  ['kerala', 'Kerala'],
  ['mumbai', 'Mumbai'],
  ['navi mumbai', 'Navi Mumbai'],
  ['new delhi', 'New Delhi'],
  ['noida', 'Noida'],
  ['pune', 'Pune'],
])

const COMMON_HTML_ENTITIES = new Map([
  ['&nbsp;', ' '],
  ['&#160;', ' '],
  ['&amp;', '&'],
  ['&quot;', '"'],
  ['&#34;', '"'],
  ['&#39;', "'"],
  ['&apos;', "'"],
  ['&rsquo;', '’'],
  ['&lsquo;', '‘'],
  ['&ldquo;', '“'],
  ['&rdquo;', '”'],
  ['&#8211;', '–'],
  ['&#8212;', '—'],
  ['&ndash;', '–'],
  ['&mdash;', '—'],
  ['&lt;', '<'],
  ['&gt;', '>'],
])

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': DESKTOP_BROWSER_USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 1,
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': DESKTOP_BROWSER_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })

  return {
    status: response.status,
    url: response.url || url,
    headers: Object.fromEntries(response.headers.entries()),
    html: await response.text(),
  }
}

const decodeHtmlEntities = (value) => {
  let decoded = String(value ?? '')

  for (const [entity, replacement] of COMMON_HTML_ENTITIES.entries()) {
    decoded = decoded.replaceAll(entity, replacement)
  }

  return decoded.replace(/&#(\d+);/g, (_, digits) => {
    const codePoint = Number.parseInt(digits, 10)
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : _
  })
}

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/h[1-6]|\/tr|\/td)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|section|article|li|h[1-6]|tr)\b[^>]*>/gi, '\n')
    .replace(/<td\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const htmlToText = (value) => String(value ?? '')
  .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/h[1-6]|\/tr|\/td)\b[^>]*>/gi, '\n')
  .replace(/<(p|div|section|article|li|h[1-6]|tr)\b[^>]*>/gi, '\n')
  .replace(/<td\b[^>]*>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\r/g, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{2,}/g, '\n')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)
  .join('\n')

const getPageHtml = (page = {}) => String(page.html ?? page.body ?? page.text ?? '')

const getHeader = (page = {}, name) => {
  const normalizedName = String(name ?? '').toLowerCase()
  const headers = page?.headers
  if (!headers) return ''
  if (typeof headers.get === 'function') {
    return String(headers.get(normalizedName) || headers.get(name) || '')
  }
  return String(headers[normalizedName] || headers[name] || '')
}

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const toAbsoluteUrl = (value) => {
  try {
    return new URL(decodeHtmlEntities(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const slugFromUrl = (url) => extractFirst(/\/jobs\/([^/?#]+)\/?$/i, url)

const splitLocationSegments = (location) => normalizeWhitespace(location)
  ?.split(/(?:\/|,|;|&|\band\b)/i)
  .map((segment) => normalizeWhitespace(segment?.replace(/\([^)]*\)/g, ' ')))
  .filter(Boolean) || []

const normalizeLocationSegment = (segment) =>
  normalizeWhitespace(segment)?.toLowerCase() || null

export const buildJobOpeningsPageUrl = (page = 1) => {
  if (!Number.isInteger(page) || page <= 1) return JOB_OPENINGS_URL
  return new URL(`page/${page}/`, JOB_OPENINGS_URL).toString()
}

export const extractCity = (location) => {
  for (const segment of splitLocationSegments(location)) {
    const normalized = normalizeLocationSegment(segment)
    if (normalized && INDIA_LOCATION_SEGMENTS.has(normalized)) {
      return INDIA_LOCATION_SEGMENTS.get(normalized)
    }
  }

  return null
}

export const isIndiaLocation = (location) => {
  const segments = splitLocationSegments(location)
  if (segments.length === 0) return false

  let sawIndiaSegment = false
  for (const segment of segments) {
    const normalized = normalizeLocationSegment(segment)
    if (!normalized) continue
    if (!INDIA_LOCATION_SEGMENTS.has(normalized)) return false
    sawIndiaSegment = true
  }

  return sawIndiaSegment
}

const extractLineValue = (text, label) => {
  const pattern = new RegExp(`${escapeRegExp(label)}\\s*-\\s*([^\\n]+)`, 'i')
  return normalizeWhitespace(extractFirst(pattern, text))
}

const extractLabeledParagraphValue = (html, label) => normalizeWhitespace(
  extractFirst(
    new RegExp(`<p>\\s*${escapeRegExp(label)}\\s*<\\/p>\\s*<p>([\\s\\S]*?)<\\/p>`, 'i'),
    html,
  ),
)

const extractListAfterLabel = (html, label) => [...String(html ?? '').matchAll(
  new RegExp(`<p>\\s*${escapeRegExp(label)}\\s*<\\/p>\\s*<ul>([\\s\\S]*?)<\\/ul>`, 'ig'),
)]
  .flatMap((match) => [...match[1].matchAll(/<li>([\s\S]*?)<\/li>/gi)])
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractPublishedDate = (html) =>
  extractFirst(/"datePublished"\s*:\s*"([^"]+)"/i, html)
  || extractFirst(/"datePublished":"([^"]+)"/i, html)

const isGenericDetailHeading = (value) => /^(job openings|apply for job|job features|apply online|stay connected with us|quick links|subscribe)$/i
  .test(normalizeWhitespace(value) || '')

const hasCanonicalJobOpeningsUrl = (html) =>
  /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.cloverinfotech\.com\/job-openings\/(?:page\/\d+\/)?["']/i
    .test(String(html ?? ''))

export const hasOfficialJobOpeningsSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /<title>\s*Job Openings \| Clover Infotech\s*<\/title>/i.test(rawHtml)
    && hasCanonicalJobOpeningsUrl(rawHtml)
    && /class=["'][^"']*article--career[^"']*["']/i.test(rawHtml)
    && /career__title/i.test(rawHtml)
}

export const hasVerifiedBlockedJobOpeningsSignal = (page = {}) => {
  const html = getPageHtml(page)

  return Number(page.status) === 403
    && /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(html)
    && /Checking your browser\.\.\./i.test(html)
    && /\?ki-cf-botcl=1/i.test(html)
}

export const isVerifiedCloudflareBlockedPage = (page = {}, expectedUrl) => {
  const finalUrl = String(page.url || expectedUrl)

  return finalUrl === expectedUrl
    && /cloudflare/i.test(getHeader(page, 'server'))
    && getHeader(page, 'cf-ray').trim().length > 0
    && hasVerifiedBlockedJobOpeningsSignal(page)
}

export const extractListings = (html) => [...String(html ?? '').matchAll(
  /<article\b[^>]*class=["'][^"']*article--career[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi,
)]
  .map((match) => {
    const articleHtml = match[0]
    const articleText = htmlToText(articleHtml)
    const title = normalizeWhitespace(
      extractFirst(/<h3\b[^>]*class=["'][^"']*career__title[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i, articleHtml),
    )
    const sourceUrl = toAbsoluteUrl(
      extractFirst(/<a\b[^>]*href=["']([^"']*\/jobs\/[^"']+)["']/i, articleHtml),
    )
    const experienceRequired = extractLineValue(articleText, 'Experience')
    const location = extractLineValue(articleText, 'Location')

    if (!title || !sourceUrl || !location || !isIndiaLocation(location)) return null

    return {
      title,
      sourceUrl,
      location,
      city: extractCity(location),
      experienceRequired,
    }
  })
  .filter(Boolean)

export const extractPaginationSummary = (html) => {
  const rawHtml = String(html ?? '')
  const explicitCurrentPage = extractFirst(
    /class=["'][^"']*page-numbers current[^"']*["'][^>]*>\s*(\d+)\s*</i,
    rawHtml,
    (match) => Number.parseInt(match[1], 10),
  )
  const canonicalCurrentPage = extractFirst(
    /rel=["']canonical["'][^>]+href=["']https:\/\/www\.cloverinfotech\.com\/job-openings\/page\/(\d+)\/["']/i,
    rawHtml,
    (match) => Number.parseInt(match[1], 10),
  )
  const pageNumbers = [...rawHtml.matchAll(/(?:\/page\/|paged=)(\d+)/gi)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isInteger)

  const currentPage = explicitCurrentPage || canonicalCurrentPage || 1
  const totalPages = Math.max(currentPage, ...(pageNumbers.length > 0 ? pageNumbers : [1]))

  return { currentPage, totalPages }
}

export const hasOfficialJobDetailSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.cloverinfotech\.com\/jobs\/[^"']+\/["']/i
    .test(rawHtml)
    && /class=["'][^"']*job-description[^"']*["']/i.test(rawHtml)
    && /class=["'][^"']*job-features[^"']*["']/i.test(rawHtml)
    && /class=["'][^"']*jobpost-form[^"']*["']/i.test(rawHtml)
}

const extractDetailTitle = (html, listing) => {
  const titleTag = normalizeWhitespace(extractFirst(/<title>([\s\S]*?)<\/title>/i, html))
  const headings = [...String(html ?? '').matchAll(/<h3>([\s\S]*?)<\/h3>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
  const headingTitle = headings.find((heading) => !isGenericDetailHeading(heading))

  return (!isGenericDetailHeading(titleTag) ? titleTag : null)
    || headingTitle
    || listing?.title
    || null
}

const extractDetailLocation = (html, listing) =>
  extractLabeledParagraphValue(html, 'Location')
  || listing?.location
  || null

const extractDetailExperience = (html, listing) =>
  extractLabeledParagraphValue(html, 'Experience')
  || normalizeWhitespace(
    extractFirst(/<tr>\s*<td>\s*Experience\s*<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/i, html),
  )
  || listing?.experienceRequired
  || null

export const extractJobDetail = (html, listing = {}) => {
  const title = extractDetailTitle(html, listing)
  const location = extractDetailLocation(html, listing)
  const experienceRequired = extractDetailExperience(html, listing)
  const summary = extractLabeledParagraphValue(html, 'Job Summary:')
  const responsibilities = extractListAfterLabel(html, 'Key Responsibilities:')
  const qualifications = extractListAfterLabel(html, 'Qualifications and Skills:')
  const goodToHave = extractListAfterLabel(html, 'Good to Have:')
  const jobId = normalizeWhitespace(
    extractFirst(/<input\b[^>]*name=["']job_id["'][^>]*value=["']([^"']+)["']/i, html),
  ) || listing.jobId || slugFromUrl(listing.sourceUrl)

  const descriptionParts = []
  if (summary) descriptionParts.push(`Job Summary: ${summary}`)
  if (responsibilities.length > 0) {
    descriptionParts.push(`Key Responsibilities: ${responsibilities.join(' ')}`)
  }
  if (qualifications.length > 0) {
    descriptionParts.push(`Qualifications and Skills: ${qualifications.join(' ')}`)
  }
  if (goodToHave.length > 0) {
    descriptionParts.push(`Good to Have: ${goodToHave.join(' ')}`)
  }

  return {
    title,
    jobId,
    requisitionId: jobId,
    location,
    city: extractCity(location),
    employmentType: null,
    experienceRequired,
    jobDescription: descriptionParts.join(' '),
    minimumQualification: qualifications[0] || null,
    preferredQualification: goodToHave[0] || null,
    requiredSkills: responsibilities,
    postingDate: extractPublishedDate(html),
    closingDate: null,
    applyUrl: listing.sourceUrl || null,
    sourceUrl: listing.sourceUrl || null,
  }
}

export const createCloverInfotechScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, fetchPage = defaultFetchPage } = {}) {
    const fetchTrustedPageText = async (url) => {
      try {
        return await fetchText(url)
      } catch (error) {
        throw new Error(`Clover Infotech first-party jobs page fetch failed for ${url}: ${error.message}`)
      }
    }

      const firstPageUrl = buildJobOpeningsPageUrl(1)
      let firstPageHtml
      try {
        firstPageHtml = await fetchTrustedPageText(firstPageUrl)
      } catch (error) {
        const blockedPage = await fetchPage(firstPageUrl)
        if (isVerifiedCloudflareBlockedPage(blockedPage, firstPageUrl)) {
          return []
        }

        throw error
      }
      if (!hasOfficialJobOpeningsSignal(firstPageHtml)) {
        throw new Error('Clover Infotech verified first-party job openings page no longer matches the trusted public surface')
      }

      const maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY
      const { totalPages } = extractPaginationSummary(firstPageHtml)
      const pagesToFetch = Math.max(1, Math.min(totalPages || 1, maxPages))

      const jobs = []
      const seenSourceUrls = new Set()

      for (let page = 1; page <= pagesToFetch; page += 1) {
        const html = page === 1
          ? firstPageHtml
          : await fetchTrustedPageText(buildJobOpeningsPageUrl(page))

        if (page > 1 && !hasOfficialJobOpeningsSignal(html)) {
          throw new Error('Clover Infotech verified first-party job openings page no longer matches the trusted public surface')
        }

        for (const listing of extractListings(html)) {
          if (seenSourceUrls.has(listing.sourceUrl)) continue
          seenSourceUrls.add(listing.sourceUrl)

          const detailHtml = await fetchTrustedPageText(listing.sourceUrl)
          if (!hasOfficialJobDetailSignal(detailHtml)) {
            throw new Error('Clover Infotech verified first-party job detail page no longer matches the trusted public surface')
          }

          const detail = extractJobDetail(detailHtml, listing)

          jobs.push({
            jobId: detail.jobId || slugFromUrl(listing.sourceUrl),
            requisitionId: detail.requisitionId || detail.jobId || slugFromUrl(listing.sourceUrl),
            title: detail.title || listing.title,
            company: COMPANY,
            department: null,
            location: detail.location || listing.location,
            city: detail.city || listing.city,
            link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
            applyUrl: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
            sourceUrl: detail.sourceUrl || listing.sourceUrl,
            source: SOURCE,
            employmentType: detail.employmentType,
            experienceRequired: detail.experienceRequired || listing.experienceRequired,
            jobDescription: detail.jobDescription,
            minimumQualification: detail.minimumQualification,
            preferredQualification: detail.preferredQualification,
            requiredSkills: detail.requiredSkills,
            postingDate: detail.postingDate,
            closingDate: detail.closingDate,
            scrapedAt: now(),
            companyCareerPage: JOB_OPENINGS_URL,
            companyDomain: COMPANY_DOMAIN,
            atsPlatform: 'official-company-careers',
          })
        }
      }

      return jobs
  },
})

export const run = async (options = {}) => createCloverInfotechScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')

  console.log(`Running ${COMPANY} scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
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
