import path from 'node:path'
import { extractSucuriCookieData } from '../../scraper-support/utils/remoteScriptData.js'
import { fileURLToPath } from 'node:url'

import { ONWARD_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ONWARD_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const INDIA_LOCATION_RE =
  /\b(india|bengaluru|bangalore|gurugram|gurgaon|noida|new delhi|delhi|mumbai|navi mumbai|pune|chennai|hyderabad|kolkata|ahmedabad|coimbatore|kochi|ernakulam|trivandrum|thiruvananthapuram|mysuru|mysore)\b/i
const NON_INDIA_LOCATION_RE =
  /\b(usa|united states|detroit|rosemont|illinois|mid-west|midwest)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripHtml = (html) => normalizeWhitespace(
  String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\n{3,}/g, '\n\n'),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  ?? null

const buildHeaders = (cookie = null) => ({
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  ...(cookie ? { Cookie: cookie } : {}),
})

export const defaultFetchText = async (url, options = {}) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      ...buildHeaders(),
      ...(options?.headers ?? {}),
    },
  })

  const text = await response.text()

  if (!response.ok) {
    // Onward's Sucuri edge currently returns the JavaScript challenge in a 307
    // response body, without exposing a usable Location header.
    if (
      response.status === 307
      && hasSucuriChallengeSignal(text)
    ) {
      return text
    }

    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return text
}

export const hasSucuriChallengeSignal = (html) =>
  /sucuri_cloudproxy|You are being redirected|Javascript is required/i.test(String(html ?? ''))

export const extractSucuriCookie = (html) => {
  const scriptMatch = String(html ?? '').match(/<script>([\s\S]*?)<\/script>/i)
  if (!scriptMatch) throw new Error('Onward Technologies Sucuri challenge script not found')

  const cookie = extractSucuriCookieData(String(html ?? ''))
  if (!/^sucuri_cloudproxy_uuid_[a-z0-9]+=.+$/i.test(cookie)) {
    throw new Error('Onward Technologies Sucuri challenge did not yield the expected cookie')
  }

  return cookie
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')

  return /Onward Tech\s*\|\s*Career/i.test(page)
    && /Current Openings/i.test(page)
    && /accordion-databox/i.test(page)
}

const isIndiaLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return false
  if (NON_INDIA_LOCATION_RE.test(normalized)) return false
  return INDIA_LOCATION_RE.test(normalized)
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || normalized.includes('/')) return null

  const city = normalizeWhitespace(normalized.split(',')[0]?.split('-')[0])
  return city && INDIA_LOCATION_RE.test(city) ? city : null
}

const buildMailtoUrl = (email, title) => {
  const normalizedEmail = normalizeWhitespace(email)?.toLowerCase()
  const normalizedTitle = normalizeWhitespace(title)
  if (!normalizedEmail || !normalizedTitle) return null
  return `mailto:${normalizedEmail}?subject=${encodeURIComponent(normalizedTitle)}`
}

const buildJobId = ({ title, location, postingDate }) =>
  slugify(`${title}-${location}-${postingDate}`)

export const extractIndiaJobs = (html) =>
  String(html ?? '')
    .split('<div class="accordion-databox">')
    .slice(1)
    .map((segment) => {
      const headerMatch = segment.match(
        /<span class="title">([\s\S]*?)<\/span>[\s\S]*?<div class="col border-end">\s*<span>([\s\S]*?)<\/span>[\s\S]*?<div class="col border-end">\s*<span>([\s\S]*?)<\/span>[\s\S]*?<div class="col border-end">\s*<span>([\s\S]*?)<\/span>/i,
      )
      if (!headerMatch) return null

      const title = normalizeWhitespace(headerMatch[1])
      const postingDate = normalizeWhitespace(headerMatch[2])
      const location = normalizeWhitespace(headerMatch[3])
      const experienceRequired = normalizeWhitespace(headerMatch[4])

      if (!title || !postingDate || !location || !isIndiaLocation(location)) return null

      const detailMatch = segment.match(
        /<div class="accordion-data"[^>]*>\s*<div class="careers-tab">([\s\S]*?)<div class="d-flex align-items-center justify-content-center">/i,
      )
      const detailHtml = detailMatch?.[1] ?? ''
      const emailMatch = detailHtml.match(/[A-Z0-9._%+-]+@onwardgroup\.com/i)
      const email = normalizeWhitespace(emailMatch?.[0] ?? PROVIDER_METADATA.officialResumeSubmissionEmail)
      const jobId = buildJobId({ title, location, postingDate })

      if (!jobId) return null

      return {
        title,
        company: COMPANY,
        department: null,
        location,
        city: extractCity(location),
        state: null,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: CAREERS_PAGE_URL,
        applyUrl: buildMailtoUrl(email, title),
        employmentType: null,
        experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate,
        closingDate: null,
        jobDescription: stripHtml(detailHtml),
        remoteStatus: null,
      }
    })
    .filter(Boolean)

export const createOnwardTechnologiesScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const firstResponseHtml = await fetchText(CAREERS_PAGE_URL, { headers: buildHeaders() })
    const careersPageHtml = hasSucuriChallengeSignal(firstResponseHtml)
      ? await fetchText(CAREERS_PAGE_URL, {
        headers: buildHeaders(extractSucuriCookie(firstResponseHtml)),
      })
      : firstResponseHtml

    if (!hasOfficialCareersPageSignal(careersPageHtml)) {
      throw new Error('Response is not the verified official Onward Technologies careers page')
    }

    return extractIndiaJobs(careersPageHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async () => createOnwardTechnologiesScraper().run()

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
