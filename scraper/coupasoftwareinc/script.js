import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { hydrateSourceDescriptions } from '../../scraper-support/utils/sourceDescriptionHydration.js'
import { extractActiveDescription, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { isExactPublicJobUrl, publicPostingDescription } from '../../rewriting/publicPostingDescription.js'
import COUPA_SOFTWARE_INC_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = COUPA_SOFTWARE_INC_CATALOG.source
export const COMPANY = COUPA_SOFTWARE_INC_CATALOG.companyName
export const JOBS_PAGE_URL = COUPA_SOFTWARE_INC_CATALOG.jobsPageUrl
export const VERIFIED_ON = COUPA_SOFTWARE_INC_CATALOG.verifiedOn

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value), JOBS_PAGE_URL)
    url.hash = ''
    return url.toString()
  } catch {
    return null
  }
}

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: composeAbortSignals(signal, AbortSignal.timeout(15000)),
  })

  return {
    status: response.status,
    url: response.url || url,
    headers: Object.fromEntries(response.headers.entries()),
    html: await response.text(),
  }
}

const defaultFetchText = async (url, options) => {
  const response = await defaultFetchPage(url, options)
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.html
}

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

const buildJobId = (title, sourceUrl) => {
  const titleMatch = String(title ?? '').match(/-\s*(\d+)\s*$/)
  if (titleMatch) return titleMatch[1]

  const urlMatch = String(sourceUrl ?? '').match(/(\d+)(?:\/)?$/)
  return urlMatch?.[1] ?? null
}

export const hasOfficialJobsPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*(?:Shape your career at Coupa|Jobs)\s*-\s*Explore opportunities to make an impact\.\s*\|\s*Coupa Careers(?:\s*-\s*Page\s+\d+)?\s*<\/title>/i.test(page)
    && text.includes('Shape your career at Coupa')
    && (
      /Displaying\s+\d+\s+to\s+\d+\s+of\s+\d+\s+matching\s+jobs/i.test(text)
      || /class=["'][^"']*js-card-job[^"']*["']/i.test(page)
    )
}

export const hasVerifiedCloudflareChallengeSignal = (page = {}) => {
  const html = getPageHtml(page)
  return [200, 403].includes(Number(page.status))
    && /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(html)
    && /Enable JavaScript and cookies to continue/i.test(html)
}

export const isVerifiedCloudflareChallengedPage = (page = {}, expectedUrl) => {
  const finalUrl = String(page.url || expectedUrl)

  return finalUrl === expectedUrl
    && /cloudflare/i.test(getHeader(page, 'server'))
    && getHeader(page, 'cf-ray').trim().length > 0
    && ['challenge', ''].includes(getHeader(page, 'cf-mitigated').toLowerCase())
    && hasVerifiedCloudflareChallengeSignal(page)
}

const extractLegacyIndiaJobsFromPage = (html = '') => Array.from(
  String(html ?? '').matchAll(
    /<article\b[^>]*>[\s\S]*?<h2>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>[\s\S]*?<li>([\s\S]*?)<\/li>[\s\S]*?<li>([\s\S]*?)<\/li>(?:[\s\S]*?<li>([\s\S]*?)<\/li>)?/gi,
  ),
  (match) => {
    const sourceUrl = normalizeUrl(match[1])
    const title = stripTags(match[2])
    const location = stripTags(match[3])
    const department = stripTags(match[4])
    const employmentType = stripTags(match[5])
    const jobId = buildJobId(title, sourceUrl)

    return {
      title,
      location,
      department,
      employmentType,
      sourceUrl,
      jobId,
    }
  },
).filter((job) => job.title && /,\s*India$/i.test(job.location || '') && job.sourceUrl && job.jobId)

const extractCardGridIndiaJobsFromPage = (html = '') => Array.from(
  String(html ?? '').matchAll(
    /<div\b[^>]*class=["'][^"']*js-card-job[^"']*["'][^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*aria-label=["'][^"']*View job:\s*([^"']+)["'][^>]*>\s*<\/a>[\s\S]*?<ul[^>]*class=["'][^"']*job-meta[^"']*["'][^>]*>([\s\S]*?)<\/ul>/gi,
  ),
  (match) => {
    const sourceUrl = normalizeUrl(match[1])
    const title = stripTags(match[2])
    const metaItems = [...String(match[3] ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((item) => stripTags(item[1]))
      .filter(Boolean)
    const [location = null, department = null, employmentType = null] = metaItems
    const jobId = buildJobId(title, sourceUrl)

    return {
      title,
      location,
      department,
      employmentType,
      sourceUrl,
      jobId,
    }
  },
).filter((job) => job.title && /,\s*India$/i.test(job.location || '') && job.sourceUrl && job.jobId)

export const extractIndiaJobsFromPage = (html = '') => {
  const jobs = extractLegacyIndiaJobsFromPage(html)
  if (jobs.length > 0) return jobs

  return extractCardGridIndiaJobsFromPage(html)
}

export const extractPaginationUrls = (html = '') => {
  const urls = new Set()

  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']*page=\d+[^"']*)["'][^>]*>/gi)) {
    const normalized = normalizeUrl(match[1])
    if (normalized && normalized !== JOBS_PAGE_URL) {
      urls.add(normalized)
    }
  }

  return [...urls]
}

const extractCity = (location) => normalizeWhitespace(String(location ?? '').replace(/,\s*India$/i, ''))

const normalizeJob = (job, scrapedAt) => ({
  title: job.title,
  company: COMPANY,
  department: job.department,
  location: job.location,
  city: extractCity(job.location),
  country: 'India',
  jobId: job.jobId,
  requisitionId: job.jobId,
  sourceUrl: job.sourceUrl,
  applyUrl: job.sourceUrl,
  employmentType: job.employmentType,
  experienceRequired: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: null,
  closingDate: null,
  jobDescription: null,
  remoteStatus: job.employmentType === 'Remote' ? 'Remote' : job.employmentType || null,
  source: SOURCE,
  link: job.sourceUrl,
  scrapedAt,
  companyCareerPage: JOBS_PAGE_URL,
  companyDomain: COUPA_SOFTWARE_INC_CATALOG.companyDomain,
  atsPlatform: COUPA_SOFTWARE_INC_CATALOG.atsPlatform,
})

// The role URL carries the native UUID, while listing titles carry the numeric
// requisition. Require both, the active page identity and explicit India schema.
export const extractCoupaJobDescription = (job, response = {}) => {
  if (response.status !== 200 || job.company !== COMPANY || !isExactPublicJobUrl(job.sourceUrl, response.url)) return null
  try {
    const url = new URL(job.sourceUrl)
    const path = url.pathname.match(/^\/en\/jobs\/([a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})\/[^/]+-(\d+)\/$/)
    if (url.origin !== 'https://careers.coupa.com' || !path || path[2] !== job.jobId || buildJobId(job.title, '') !== job.jobId) return null
    const document = readNativeDocument(getPageHtml(response))
    const canonicals = document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')
    const headings = document.nodes(node => node.tag === 'h1')
    const details = document.nodes(node => node.attrs.id === 'js-job-detail')
    const scripts = document.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json' && !node.attrs.src)
    if (canonicals.length !== 1 || !isExactPublicJobUrl(canonicals[0].attrs.href, job.sourceUrl)
      || headings.length !== 1 || document.text(headings[0]) !== normalizeWhitespace(job.title)
      || details.length !== 1 || details[0].attrs['data-id'] !== path[1]
      || normalizeWhitespace(details[0].attrs['data-jobtitle']) !== normalizeWhitespace(job.title)
      || scripts.length !== 1) return null
    const record = JSON.parse(scripts[0].raw)
    const address = record.jobLocation?.address
    if (record['@type'] !== 'JobPosting' || record.identifier !== path[1]
      || normalizeWhitespace(record.title) !== normalizeWhitespace(job.title)
      || !isExactPublicJobUrl(record.url, job.sourceUrl)
      || record.hiringOrganization?.name !== 'Coupa' || record.hiringOrganization?.url !== 'https://www.coupa.com/'
      || Array.isArray(record.jobLocation) || address?.addressCountry !== 'India'
      || !normalizeWhitespace(address?.addressLocality) || typeof record.description !== 'string') return null
    const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
    if (!validDate(record.datePosted) || (record.validThrough != null && !validDate(record.validThrough))) return null
    const facts = { sourcePostingDate: record.datePosted, postingDate: record.datePosted, sourceDateEvidence: 'coupa-canonical-jobposting-dates-v1' }
    if (record.validThrough != null) Object.assign(facts, { sourceClosingDate: record.validThrough, closingDate: record.validThrough })
    if (!extractActiveDescription(record.description)) return { ...facts, sourceDescription: null }
    const posting = publicPostingDescription({ ...job, jobId: path[1] }, getPageHtml(response), response.url, { employerAliases: ['Coupa'] })
    return posting ? { ...facts, sourceDescription: posting.description } : null
  } catch {
    return null
  }
}

export const createCoupaSoftwareIncScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchPage = defaultFetchPage, fetchDetailPage = defaultFetchPage, detailEnrichmentBudgetMs, signal } = {}) {
    signal?.throwIfAborted()
    const loadJobsPage = async (url) => {
      try {
        const html = await fetchText(url, { signal })
        signal?.throwIfAborted()
        return html
      } catch (error) {
        signal?.throwIfAborted()
        const fallbackPage = await fetchPage(url, { signal })
        signal?.throwIfAborted()
        if (isVerifiedCloudflareChallengedPage(fallbackPage, url)) {
          return null
        }

        const fallbackHtml = getPageHtml(fallbackPage)
        if (hasOfficialJobsPageSignal(fallbackHtml)) {
          return fallbackHtml
        }

        throw error
      }
    }

    const firstPage = await loadJobsPage(JOBS_PAGE_URL)
    if (firstPage == null) {
      return []
    }
    if (!hasOfficialJobsPageSignal(firstPage)) {
      throw new Error('The verified Coupa jobs page no longer matches the trusted first-party surface')
    }

    const visited = new Set([JOBS_PAGE_URL])
    const queue = extractPaginationUrls(firstPage)
    const jobs = extractIndiaJobsFromPage(firstPage)

    while (queue.length > 0) {
      const nextUrl = queue.shift()
      if (!nextUrl || visited.has(nextUrl)) continue
      visited.add(nextUrl)
      const html = await loadJobsPage(nextUrl)
      if (html == null) {
        return []
      }
      for (const job of extractIndiaJobsFromPage(html)) {
        if (!jobs.some((existing) => existing.jobId === job.jobId)) {
          jobs.push(job)
        }
      }
    }

    const detailFacts = new Map()
    const hydrated = await hydrateSourceDescriptions(jobs.map(job => ({ ...normalizeJob(job, now()), sourceListingComplete: false })), {
      signal, detailEnrichmentBudgetMs,
      fetchDetail: async (job, { signal: detailSignal }) => {
        const response = await fetchDetailPage(job.sourceUrl, { signal: detailSignal })
        detailSignal.throwIfAborted()
        const detail = extractCoupaJobDescription(job, response)
        if (detail) {
          const { sourceDescription, ...facts } = detail
          detailFacts.set(job.jobId, facts)
        }
        return detail
      },
    })
    return hydrated.map(job => ({ ...job, ...detailFacts.get(job.jobId) }))
  },
})

export const run = async (options = {}) => createCoupaSoftwareIncScraper(options).run(options)

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
