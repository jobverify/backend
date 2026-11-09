import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SOFTURA_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERN =
  /\b(india|ahmedabad|chennai|pune|bengaluru|bangalore|hyderabad|gurgaon|gurugram|noida|indore|mumbai|delhi|kolkata|kochi|coimbatore|trivandrum)\b/i

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
})

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeTitle = (value) => normalizeWhitespace(value)
  ?.replace(/^Softura Private Limited\s*-\s*/i, '')
  .replace(/\|\s*Softura\s*$/i, '')
  .replace(/\s+-\s+Softura\s*$/i, '')
  .trim() || null

const sanitizeLocation = (value) => normalizeWhitespace(value)
  ?.replace(/\s*(?:Roles?\s+and\s+Responsibilities?|Key Responsibilities|We are.*|About Softura.*|Technical Skills.*)$/i, '')
  .replace(/\s*&\s*/g, ' & ')
  .replace(/\s*,\s*/g, ', ')
  .trim() || null

const extractFirst = (pattern, value) => sanitizeLocation(String(value ?? '').match(pattern)?.[1] ?? null)

const inferIndiaLocationFromTitleOrUrl = ({ title, url } = {}) => {
  const normalizedTitle = normalizeTitle(title) || ''
  const titleCity = normalizedTitle.match(/\bin\s+([A-Za-z ]+)$/i)?.[1]
  if (titleCity && INDIA_LOCATION_PATTERN.test(titleCity)) return sanitizeLocation(titleCity)

  if (/\bChennai\b/i.test(normalizedTitle)) return 'Chennai'
  if (/\bAhmedabad\b/i.test(normalizedTitle)) return 'Ahmedabad'
  if (/\bPune\b/i.test(normalizedTitle)) return 'Pune'
  if (/\bCoimbatore\b/i.test(normalizedTitle)) return 'Coimbatore'

  const href = String(url ?? '').toLowerCase()
  if (href.includes('chennai')) return 'Chennai'
  if (href.includes('ahmedabad')) return 'Ahmedabad'
  if (href.includes('pune')) return 'Pune'

  return null
}

const extractWorkplaceType = (location = '', text = '') => {
  const haystack = `${location} ${text}`
  if (/remote\/hybrid|hybrid/i.test(haystack)) return 'Hybrid'
  if (/\bremote\b/i.test(haystack)) return 'Remote'
  if (/onsite|on-site|on site/i.test(haystack)) return 'On-site'
  return null
}

const extractExperience = (text = '') => {
  const value = String(text ?? '').match(
    /Experience\s*[:\-]?\s*(.+?)(?:Work Location|Location|Employment|Compensation|Industry Type|Skills Required|Roles?\s+and\s+Responsibilities?|Key Responsibilities|Technical Skills|We are|About Softura)/i,
  )?.[1] ?? null

  return normalizeWhitespace(value)?.replace(/^[\u2022\-\s]+/, '') || null
}

const isIndiaRole = ({ title, location, url } = {}) =>
  INDIA_LOCATION_PATTERN.test(`${location ?? ''} ${title ?? ''} ${url ?? ''}`)

const isMissingDetailPageError = (error) => {
  const status = Number(error?.status ?? error?.cause?.status)
  return status === 404 || /\bHTTP 404\b/i.test(String(error?.message ?? error))
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title[^>]*>\s*Softura Careers(?:\s*[\u2013\u2014-]\s*Explore Opportunities)?\s*<\/title>/i.test(page)
    && normalized.includes('Softura - Careers')
    && normalized.includes('Building a Culture of Software Excellence and Creating an Open, Fair and Transparent Workplace.')
    && normalized.includes('Find a Position')
}

export const extractApplyUrls = (html = '', baseUrl = CAREERS_URL) => {
  const seen = new Set()
  const urls = []

  for (const match of String(html ?? '').matchAll(
    /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const label = normalizeWhitespace(match[4])
    if (!/^Apply Now$/i.test(label ?? '')) continue

    const rawHref = (match[1] || match[2] || match[3] || '').trim()
    if (!rawHref || /^https?:\/$/i.test(rawHref)) continue

    const absoluteUrl = toAbsoluteUrl(rawHref, baseUrl)
    if (!absoluteUrl) continue

    let hostname = ''
    try {
      hostname = new URL(absoluteUrl).hostname.toLowerCase()
    } catch {
      continue
    }

    if (!hostname.endsWith('softura.com') && !hostname.endsWith('softura.zohorecruit.in')) continue

    const normalizedUrl = absoluteUrl.replace(/^http:\/\//i, 'https://').replace(/\/$/, '')
    if (seen.has(normalizedUrl)) continue

    seen.add(normalizedUrl)
    urls.push(normalizedUrl)
  }

  return urls
}

const extractNearestListingTitle = (html = '') => {
  const candidates = []
  const patterns = [
    /<div\b[^>]*class=["'][^"']*\bwidth-cla\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    /<div\b[^>]*class=["'][^"']*\bsite-heading\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
  ]

  for (const pattern of patterns) {
    for (const match of String(html ?? '').matchAll(pattern)) {
      const value = normalizeWhitespace(match[1])
      if (!value || /^\d+$/.test(value) || /^(?:Job Title|No\. of Positions|Apply)$/i.test(value)) continue
      candidates.push({ index: match.index, value })
    }
  }

  return candidates.sort((left, right) => left.index - right.index).at(-1)?.value ?? null
}

const createListingJob = ({ title, location, url }) => {
  const jobId = url.match(/\/Careers\/(\d+)\//i)?.[1]
    ?? (title + '-' + location).toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city: location === 'India' ? null : location,
    state: null,
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: url,
    applyUrl: url,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    workplaceType: null,
  }
}

export const extractCurrentListingJobs = (html = '') => {
  const page = String(html ?? '')
  const labels = [...page.matchAll(
    /<span\b[^>]*class=["'][^"']*\bou-accordion-label\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
  )]
  if (labels.length === 0) return []

  const jobs = []
  const seen = new Set()
  const collect = (segment, groupLocation, { zohoOnly = false } = {}) => {
    for (const match of String(segment ?? '').matchAll(
      /<a\b[^>]*href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>\s*Apply Now\s*<\/a>/gi,
    )) {
      const url = toAbsoluteUrl(match[1] || match[2] || match[3])
        ?.replace(/^http:\/\//i, 'https://')
        .replace(/\/$/, '')
      if (!url) continue

      const hostname = new URL(url).hostname.toLowerCase()
      if (zohoOnly && !hostname.endsWith('softura.zohorecruit.in')) continue
      if (!hostname.endsWith('softura.com') && !hostname.endsWith('softura.zohorecruit.in')) continue

      const title = extractNearestListingTitle(
        String(segment).slice(Math.max(0, match.index - 1800), match.index),
      )
      if (!title) continue

      const identityKey = title.toLowerCase() + '\u0000' + url
      if (seen.has(identityKey)) continue

      const inferredLocation = inferIndiaLocationFromTitleOrUrl({ title, url })
      const location = /^(?:Chennai|Ahmedabad)$/i.test(groupLocation)
        ? groupLocation
        : inferredLocation || 'India'

      seen.add(identityKey)
      jobs.push(createListingJob({ title, location, url }))
    }
  }

  collect(page.slice(0, labels[0].index), 'India', { zohoOnly: true })
  labels.forEach((label, index) => {
    collect(
      page.slice(label.index, labels[index + 1]?.index ?? page.length),
      normalizeWhitespace(label[1]),
    )
  })

  return jobs
}

export const extractFirstPartyJob = ({ url, html } = {}) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const titleTag = page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null
  const title = normalizeTitle(titleTag)

  if (!title || /Page Not Found/i.test(title)) return null

  const location = extractFirst(
    /(?:Work Location|Location)\s*[:\-]?\s*(.+?)(?:No\.?\s*of\s*Positions|Employment|Compensation|Industry Type|Skills Required|Roles?\s+and\s+Responsibilities?|Key Responsibilities|Technical Skills|We are|About Softura)/i,
    normalized,
  ) || inferIndiaLocationFromTitleOrUrl({ title, url })

  if (!location || !isIndiaRole({ title, location, url })) return null

  const slug = normalizeWhitespace(new URL(url).pathname.split('/').filter(Boolean).pop())

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city: location.split('&')[0]?.split(',')[0]?.trim() || location,
    state: null,
    country: 'India',
    jobId: slug,
    requisitionId: slug,
    sourceUrl: url,
    applyUrl: url,
    employmentType: normalizeWhitespace(
      String(normalized).match(/Employment\s*[:\-]?\s*(.+?)(?:Compensation|Roles?\s+and\s+Responsibilities?|Key Responsibilities|About Softura)/i)?.[1] ?? null,
    ) || null,
    experienceRequired: extractExperience(normalized),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    workplaceType: extractWorkplaceType(location, normalized),
  }
}

export const extractZohoJob = ({ url, html } = {}) => {
  const page = String(html ?? '')
  const titleTag = page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null
  const normalizedTitle = normalizeTitle(titleTag)
  const metaDescription = normalizeWhitespace(
    page.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ?? null,
  )

  const titleMatch = normalizedTitle?.match(/^(.*)\s+in\s+([A-Za-z ]+)$/i)
  const title = normalizeWhitespace(titleMatch?.[1] ?? normalizedTitle)
  const location = sanitizeLocation(
    titleMatch?.[2]
    ?? metaDescription?.match(/Location\s*-?\s*([^K]+?)(?:Key Responsibilities|Common Technical Skills|Technical Skills|Job Description|$)/i)?.[1]
    ?? inferIndiaLocationFromTitleOrUrl({ title: normalizedTitle, url }),
  )

  if (!title || !location || !isIndiaRole({ title, location, url })) return null

  const jobId = url.match(/\/Careers\/(\d+)\//i)?.[1] ?? null
  const experience = normalizeWhitespace(
    metaDescription?.match(/Experience-?\s*([0-9+\-\u2013 ]+\s*(?:Years?|yrs?)?)/i)?.[1] ?? null,
  )

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city: location.split(',')[0]?.trim() || location,
    state: null,
    country: 'India',
    jobId: jobId || normalizeWhitespace(new URL(url).pathname),
    requisitionId: jobId || normalizeWhitespace(new URL(url).pathname),
    sourceUrl: url,
    applyUrl: url,
    employmentType: null,
    experienceRequired: experience,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: metaDescription,
    workplaceType: null,
  }
}

export const createSofturaScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Softura careers surface no longer matches the verified public first-party careers page')
    }

    const applyUrls = extractApplyUrls(careersHtml)
    if (applyUrls.length === 0) {
      throw new Error('Softura careers page no longer exposes public Apply Now links')
    }

    const scrapedAt = now()
    const listingJobs = extractCurrentListingJobs(careersHtml)
    if (listingJobs.length > 0) {
      return listingJobs.slice(0, maxJobs || listingJobs.length).map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt,
        companyCareerPage: CAREERS_URL,
        companyDomain: PROVIDER_METADATA.companyDomain,
        atsPlatform: PROVIDER_METADATA.atsPlatform,
      }))
    }

    const jobs = []
    for (const url of applyUrls) {
      let detailHtml
      try {
        detailHtml = await fetchText(url)
      } catch (error) {
        if (isMissingDetailPageError(error)) continue
        throw error
      }

      const hostname = new URL(url).hostname.toLowerCase()
      const job = hostname.endsWith('softura.zohorecruit.in')
        ? extractZohoJob({ url, html: detailHtml })
        : extractFirstPartyJob({ url, html: detailHtml })

      if (!job) continue

      jobs.push({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt,
        companyCareerPage: CAREERS_URL,
        companyDomain: PROVIDER_METADATA.companyDomain,
        atsPlatform: PROVIDER_METADATA.atsPlatform,
      })

      if (maxJobs && jobs.length >= maxJobs) {
        return jobs.slice(0, maxJobs)
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createSofturaScraper().run(options)

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
