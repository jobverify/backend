import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'remunanceservicespvtltd'
export const COMPANY = 'Remunance Services Pvt. Ltd.'
export const HOMEPAGE_URL = 'https://remunance.com/'
export const JOBS_URL = 'https://remunance.com/jobs/'
export const CAREERS_URL = 'https://remunance.com/careers/'
export const ELFSIGHT_WIDGET_ID = '40bef639-b4af-4953-bb78-5de275c4b2d5'
export const ELFSIGHT_BOOT_URL = `https://core.service.elfsight.com/p/boot/?w=${ELFSIGHT_WIDGET_ID}&page=${encodeURIComponent(CAREERS_URL)}`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;|&#8211;|&#8212;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<[^>]+>/g, ' '),
)

const normalizeUrl = (value) => {
  const parsed = new URL(value, HOMEPAGE_URL)

  if (!parsed.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(parsed.pathname)) {
    parsed.pathname = `${parsed.pathname}/`
  }

  parsed.hash = ''
  return parsed.toString()
}

const isOfficialJobDetailUrl = (value) => {
  try {
    return normalizeUrl(value).startsWith(JOBS_URL)
  } catch {
    return false
  }
}

const toLocation = (cityText) => {
  const city = normalizeWhitespace(cityText)
  if (!city) {
    return {
      location: null,
      city: null,
      country: 'India',
    }
  }

  return {
    location: `${city}, India`,
    city,
    country: 'India',
  }
}

const extractCanonicalUrl = (html) =>
  normalizeWhitespace(String(html ?? '').match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ?? null)

const extractFooterCompany = (html) =>
  stripTags(String(html ?? '').match(/<footer[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>/i)?.[1] ?? null)

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const htmlToLines = (html) => decodeHtmlEntities(String(html ?? ''))
  .replace(/\r/g, '')
  .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/figure|\/table|\/tbody|\/tr|\/td|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<(?:p|div|li|ul|ol|section|article|main|figure|table|tbody|tr|td|h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split(/\n+/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const dedupe = (values) => {
  const seen = new Set()
  return values.filter((value) => {
    const key = value.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
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

const defaultFetchJson = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json,text/plain,*/*' },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

const shouldUseBrowserFallback = (error) =>
  /HTTP (?:403|429)\b/i.test(String(error?.message ?? ''))

export const hasAccessChallengeSignal = (html = '') => {
  const page = String(html ?? '')
  return (/<title>\s*(?:Attention Required! \| Cloudflare|Just a moment\.\.\.)\s*<\/title>/i.test(page)
      && /Cloudflare Ray ID|challenge-platform/i.test(page))
    || (/Sorry, you have been blocked/i.test(page) && /Cloudflare/i.test(page))
}

const accessChallengeError = () => Object.assign(
  new Error('Remunance official site is blocked by an upstream Cloudflare access challenge'),
  { code: 'REMUNANCE_ACCESS_CHALLENGE', failureKind: 'upstream_unavailable', upstreamOutage: true, softFailure: true, abortRetries: true },
)

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*(?:Remunance\s*\|\s*)?Best Employer of Record(?: \(EOR\))? Services Provider India\s*<\/title>/i.test(page)
    && normalizeWhitespace(extractCanonicalUrl(page)) === HOMEPAGE_URL
    && extractFooterCompany(page) === 'Remunance Services Pvt Ltd'
    && /linkedin\.com\/company\/remunance/i.test(page)
}

export const hasJobsPageSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Job Openings Archive - Remunance\s*<\/title>/i.test(page)
    && normalizeWhitespace(extractCanonicalUrl(page)) === JOBS_URL
    && /awsm-job-listing-item/i.test(page)
    && extractFooterCompany(page) === 'Remunance Services Pvt Ltd'
}

export const hasCurrentCareersSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Career in Remunance\s*\|\s*Apply for remote working jobs\.\s*<\/title>/i.test(page)
    && normalizeWhitespace(extractCanonicalUrl(page)) === CAREERS_URL
    && /<meta\b[^>]*property=["']og:site_name["'][^>]*content=["']Remunance["']/i.test(page)
    && /<h2\b[^>]*>[\s\S]*?Current Openings[\s\S]*?<\/h2>/i.test(page)
    && new RegExp(`class=["'][^"']*elfsight-app-${ELFSIGHT_WIDGET_ID}\\b`, 'i').test(page)
    && /mailto:resume@remunance\.com/i.test(page)
    && extractFooterCompany(page) === 'Remunance Services Pvt Ltd'
}

const toGoogleApplicationUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === 'https://docs.google.com'
      && /^\/forms\/d\/e\/[^/]+\/viewform$/.test(url.pathname)
      && !url.username && !url.password ? url.toString() : null
  } catch { return null }
}

const currentIndiaLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (/^PAN India$/i.test(location || '')) return { location: 'India', city: null, country: 'India' }
  if (/^(?:Pune|Mumbai|Delhi|New Delhi|Bengaluru|Bangalore|Hyderabad|Chennai|Noida|Gurugram|Gurgaon|Goa|Coimbatore)$/i.test(location || '')) {
    return { location: `${location}, India`, city: location, country: 'India' }
  }
  return null
}

export const extractCurrentElfsightJobs = (payload) => {
  if (payload?.status !== 1 || !payload?.data?.widgets || Object.keys(payload.data.widgets).length !== 1) {
    throw new Error('Remunance invalid Elfsight widget inventory')
  }
  const widget = payload.data.widgets[ELFSIGHT_WIDGET_ID]
  let settings = widget?.data?.settings
  if (typeof settings === 'string') {
    try { settings = JSON.parse(settings) } catch { throw new Error('Remunance invalid serialized widget settings') }
  }
  const records = widget?.status === 1 && widget?.data?.app === 'job-board' ? settings?.jobs : null
  if (!Array.isArray(records) || !records.length) throw new Error('Remunance incomplete Elfsight job inventory')
  const seen = new Set()
  let unknownScope = false
  const jobs = []
  for (const record of records.filter(record => record?.visible !== false)) {
    const jobId = normalizeWhitespace(record?.id)
    const title = normalizeWhitespace(record?.title)
    const location = normalizeWhitespace(record?.location)
    const employmentType = normalizeWhitespace(record?.typeOfContract)
    const jobDescription = stripTags(record?.description)
    const applyUrl = record?.link?.type === 'url' ? toGoogleApplicationUrl(record?.link?.value) : null
    if (!jobId || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(jobId) || !title || !location || !employmentType || !jobDescription || jobDescription.length < 40 || !applyUrl) {
      throw new Error('Remunance incomplete record or invalid application link')
    }
    if (seen.has(jobId)) throw new Error('Remunance duplicate Elfsight job identifier')
    seen.add(jobId)
    const scoped = currentIndiaLocation(location)
    if (!scoped) {
      unknownScope = true
      continue
    }
    jobs.push({
      title, company: COMPANY, department: normalizeWhitespace(record.department), ...scoped,
      jobId, requisitionId: jobId, sourceUrl: CAREERS_URL, applyUrl, applicationUrlIsGeneric: true,
      employmentType,
      experienceRequired: jobDescription.match(/Experience required:\s*([0-9]+\s*(?:(?:-|to)\s*[0-9]+|\+)?\s*years?)/i)?.[1]?.trim() || null,
      minimumQualification: null, preferredQualification: null, requiredSkills: [],
      postingDate: null, closingDate: null, jobDescription,
      remoteStatus: /^PAN India$/i.test(location) ? null : 'On-site',
    })
  }
  if (!jobs.length && unknownScope) throw new Error('Remunance current openings have unknown India scope')
  if (!jobs.length) throw new Error('Remunance current openings do not expose publishable jobs')
  return jobs.map(job => ({ ...job, ...(unknownScope ? { sourceListingComplete: false } : {}) }))
}

export const extractJobCards = (html) => {
  if (!hasJobsPageSignal(html)) {
    throw new Error('Remunance jobs archive no longer matches the verified first-party public jobs surface')
  }

  const jobs = [...String(html ?? '').matchAll(
    /<div\b[^>]*class=["'][^"']*awsm-job-listing-item[^"']*["'][^>]*id=["']awsm-grid-item-(\d+)["'][^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*awsm-job-item[^"']*["'][^>]*>[\s\S]*?<h2\b[^>]*class=["'][^"']*awsm-job-post-title[^"']*["'][^>]*>([\s\S]*?)<\/h2>/gi,
  )]
    .map((match) => {
      const jobId = normalizeWhitespace(match[1])
      const sourceUrl = normalizeUrl(match[2])
      const title = stripTags(match[3])

      if (!jobId || !title || !sourceUrl.startsWith(JOBS_URL)) {
        return null
      }

      return {
        title,
        company: COMPANY,
        department: null,
        location: null,
        city: null,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: 'On-site',
      }
    })
    .filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('Remunance jobs archive no longer exposes trusted public job cards')
  }

  return jobs
}

const extractTableFields = (html) => {
  const fields = new Map()

  for (const match of String(html ?? '').matchAll(
    /<tr\b[^>]*>\s*<td\b[^>]*>[\s\S]*?<\/td>\s*<td\b[^>]*>\s*(?:<strong>)?([\s\S]*?)(?:<\/strong>)?\s*<\/td>\s*<td\b[^>]*>\s*(?:<strong>)?([\s\S]*?)(?:<\/strong>)?\s*<\/td>\s*<\/tr>/gi,
  )) {
    const label = stripTags(match[1])?.replace(/:$/, '')
    const value = stripTags(match[2])

    if (label && value) {
      fields.set(label.toLowerCase(), value)
    }
  }

  return fields
}

const extractEntryContentHtml = (html) => {
  const match = String(html ?? '').match(
    /<div\b[^>]*class=["'][^"']*awsm-job-entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?:<div\b[^>]*class=["'][^"']*awsm-job-specifications-container[^"']*["'][^>]*>[\s\S]*?<\/div>\s*)?<div\b[^>]*class=["'][^"']*awsm-job-form[^"']*["']/i,
  )

  return match?.[1] ?? null
}

const buildDetailContent = (entryHtml) => {
  const withoutTable = String(entryHtml ?? '').replace(/<figure\b[^>]*class=["'][^"']*wp-block-table[^"']*["'][\s\S]*?<\/figure>/i, '')
  const lines = htmlToLines(withoutTable)
    .filter((line) => !/^Greetings from Remunance\s*!?$/i.test(line))
    .filter((line) => line !== 'Job Description')
    .filter((line) => line !== 'Apply for this position')

  return {
    lines,
    listItems: extractListItems(withoutTable),
  }
}

const buildRequiredSkills = ({ lines, listItems }) => {
  const trailingSkills = []
  let inSkillSection = false

  for (const line of lines) {
    if (/^(?:Key Competencies|Skills and Qualifications):?$/i.test(line)) {
      inSkillSection = true
      continue
    }

    if (inSkillSection) {
      trailingSkills.push(line)
    }
  }

  return dedupe([
    ...listItems,
    ...trailingSkills,
  ].filter(Boolean))
}

const buildJobDescription = (lines) =>
  normalizeWhitespace(lines.join(' '))

const buildPostingDate = (html) => {
  const value = normalizeWhitespace(
    String(html ?? '').match(/<time\b[^>]*class=["'][^"']*updated[^"']*["'][^>]*datetime=["']([^"']+)["']/i)?.[1],
  )
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

const hasOfficialJobDetailSignal = (html, listing = {}) => {
  const page = String(html ?? '')
  const canonicalUrl = normalizeWhitespace(extractCanonicalUrl(page))
  const pageTitle = stripTags(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null)
  const heading = stripTags(page.match(/<h1\b[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? null)

  return pageTitle === `${listing.title} - Remunance`
    && heading === listing.title
    && (!canonicalUrl || isOfficialJobDetailUrl(canonicalUrl))
    && /<h2>\s*Apply for this position\s*<\/h2>/i.test(page)
    && /id=["']awsm-application-form["']/i.test(page)
    && extractFooterCompany(page) === 'Remunance Services Pvt Ltd'
}

export const extractJobDetail = (html, listing = {}) => {
  if (!hasOfficialJobDetailSignal(html, listing)) {
    throw new Error('Remunance job detail page no longer matches the verified first-party public jobs surface')
  }

  const page = String(html ?? '')
  const title = stripTags(page.match(/<h1\b[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? null)
    || listing.title
    || null
  const canonicalUrl = normalizeWhitespace(extractCanonicalUrl(page))
  const resolvedDetailUrl = isOfficialJobDetailUrl(canonicalUrl)
    ? normalizeUrl(canonicalUrl)
    : normalizeUrl(listing.sourceUrl || listing.applyUrl || '')
  const fields = extractTableFields(page)
  const entryHtml = extractEntryContentHtml(page)
  const { lines, listItems } = buildDetailContent(entryHtml)
  const requiredSkills = buildRequiredSkills({ lines, listItems })
  const locationData = toLocation(fields.get('location'))

  return {
    ...listing,
    title,
    company: COMPANY,
    sourceUrl: resolvedDetailUrl,
    applyUrl: resolvedDetailUrl,
    department: null,
    location: locationData.location,
    city: locationData.city,
    country: locationData.country,
    employmentType: null,
    experienceRequired: fields.get('experience') || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate: buildPostingDate(page),
    closingDate: null,
    jobDescription: buildJobDescription(lines),
    remoteStatus: 'On-site',
  }
}

export const createRemunanceServicesPvtLtdScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    fetchBrowserText,
    fetchBrowserListingHtml,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const browserTextFetcher = typeof fetchBrowserText === 'function' ? fetchBrowserText : null
    const browserListingFetcher =
      typeof fetchBrowserListingHtml === 'function' ? fetchBrowserListingHtml : null

    const fetchPageText = async (url) => {
      signal?.throwIfAborted()
      try {
        const html = await fetchText(url, { signal })
        signal?.throwIfAborted()
        if (!hasAccessChallengeSignal(html)) return html
        if (browserTextFetcher) {
          const browserHtml = await browserTextFetcher(url)
          signal?.throwIfAborted()
          return browserHtml
        }
        throw accessChallengeError()
      } catch (error) {
        if (error?.code === 'REMUNANCE_ACCESS_CHALLENGE') throw error
        if (!browserTextFetcher || !shouldUseBrowserFallback(error)) {
          throw error
        }

        const browserHtml = await browserTextFetcher(url)
        signal?.throwIfAborted()
        return browserHtml
      }
    }

    const fetchListingHtml = async () => {
      signal?.throwIfAborted()
      try {
        const html = await fetchText(JOBS_URL, { signal })
        signal?.throwIfAborted()
        if (!hasAccessChallengeSignal(html)) return html
        if (browserListingFetcher) return browserListingFetcher()
        throw accessChallengeError()
      } catch (error) {
        if (error?.code === 'REMUNANCE_ACCESS_CHALLENGE') throw error
        if (!browserListingFetcher || !shouldUseBrowserFallback(error)) {
          throw error
        }

        return browserListingFetcher()
      }
    }

    const homepageHtml = await fetchPageText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Remunance homepage no longer matches the verified first-party company surface')
    }

    if (/href=["']https:\/\/remunance\.com\/careers\/?["']/i.test(homepageHtml)) {
      const careersHtml = await fetchPageText(CAREERS_URL)
      if (!hasCurrentCareersSignal(careersHtml)) throw new Error('Remunance current careers page no longer matches the verified first-party widget surface')
      signal?.throwIfAborted()
      const payload = await fetchJson(ELFSIGHT_BOOT_URL, { signal })
      signal?.throwIfAborted()
      return extractCurrentElfsightJobs(payload).map(job => ({
        ...job, source: SOURCE, link: job.applyUrl, scrapedAt: now(),
        companyCareerPage: CAREERS_URL, companyDomain: 'remunance.com', atsPlatform: 'elfsight-job-board',
      }))
    }

    const listingHtml = await fetchListingHtml()
    const listings = extractJobCards(listingHtml)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchPageText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: now(),
        companyCareerPage: JOBS_URL,
        companyDomain: 'remunance.com',
        atsPlatform: 'wp-job-openings',
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createRemunanceServicesPvtLtdScraper().run(options)

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
