import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'credgenics'
export const COMPANY = 'Credgenics'
export const HOMEPAGE_URL = 'https://www.credgenics.com/'
export const LINKEDIN_COMPANY_ID = '14634991'
export const VERIFIED_LINKEDIN_JOBS_URL =
  `https://www.linkedin.com/jobs/search/?f_C=${LINKEDIN_COMPANY_ID}&geoId=92000000`
export const ZAPPYHIRE_BOARD_URL = 'https://recruitcareers.zappyhire.com/en/credgenics'
export const ZAPPYHIRE_API_BASE = 'https://credgenics.zappyhire-multitenant-be-prod.zappyhire.com/api/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(value, HOMEPAGE_URL).toString()
  } catch {
    return null
  }
}

const normalizeLinkedInJobsUrl = (value) => {
  const absoluteUrl = toAbsoluteUrl(value)
  if (!absoluteUrl) return null

  try {
    const url = new URL(absoluteUrl)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()

    if (hostname !== 'linkedin.com') return null

    if (/^\/authwall\/?$/i.test(url.pathname)) {
      const redirected = url.searchParams.get('sessionRedirect')
      return redirected ? normalizeLinkedInJobsUrl(redirected) : null
    }

    if (/^\/company\/credgenics\/jobs\/?$/i.test(url.pathname)) {
      return VERIFIED_LINKEDIN_JOBS_URL
    }

    if (/^\/jobs\/search\/?$/i.test(url.pathname)) {
      if (url.searchParams.get('f_C') !== LINKEDIN_COMPANY_ID) return null

      const normalized = new URL('https://www.linkedin.com/jobs/search/')
      normalized.searchParams.set('f_C', LINKEDIN_COMPANY_ID)
      normalized.searchParams.set('geoId', url.searchParams.get('geoId') || '92000000')
      return normalized.toString()
    }
  } catch {
    return null
  }

  return null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Credgenics\s*\|\s*Debt Collections\s*(?:&amp;|&)\s*Resolution Platform/i.test(page)
    && /Supercharge debt collections with AI-driven full-stack platform/i.test(text)
    && /India'?s Best Selling AI-powered Loan Collections Platform/i.test(text)
    && /\bCompany\b/i.test(text)
    && /support@credgenics\.com/i.test(text)
    && /Analog Legalhub Technology Solutions Pvt\. Ltd\.\s*All Rights Reserved\./i.test(text)
}

export const hasCurrentHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)
  return /<title>\s*Credgenics\s*\|\s*Customer Experience Management\s*\|/i.test(page)
    && /Supercharge debt collections with AI-driven full-stack platform/i.test(text)
    && /Analog Legalhub Technology Solutions Pvt\. Ltd\. All Rights Reserved\./i.test(text)
    && extractZappyhireBoardUrl(page) === ZAPPYHIRE_BOARD_URL
}

export const extractZappyhireBoardUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    try {
      const url = new URL(decodeHtmlEntities(match[1]))
      if (url.origin === new URL(ZAPPYHIRE_BOARD_URL).origin
        && url.pathname.replace(/\/$/, '') === '/en/credgenics') return ZAPPYHIRE_BOARD_URL
    } catch {
      // Ignore unrelated relative links.
    }
  }
  return null
}

export const hasZappyhireBoardShell = (html) =>
  /<title>\s*Careers\s*<\/title>/i.test(String(html ?? ''))
  && /<base\s+href=["']\/en\/["']/i.test(String(html ?? ''))
  && /<app-root><\/app-root>/i.test(String(html ?? ''))

export const buildZappyhireJobsUrl = (page, pageSize) =>
  `${ZAPPYHIRE_API_BASE}jobs/jobsearch/?page=${page}&page_size=${pageSize}`

export const buildZappyhireJobDetailUrl = (id) =>
  `${ZAPPYHIRE_API_BASE}careers/jobs/${id}/`

const parseZappyhireLocations = (locations) => (Array.isArray(locations) ? locations : [])
  .map((item) => ({
    city: normalizeWhitespace(String(item?.city ?? '').split('-')[0]),
    countryCode: String(item?.country_code ?? 'IN').toUpperCase(),
  }))
  .filter((item) => item.city)

export const extractZappyhireJob = (record, detail, verifiedCities, scrapedAt) => {
  const item = record?._source
  const id = Number(item?.job)
  const locations = parseZappyhireLocations(detail?.location)
  const careerLink = detail?.job_board_urls?.find((link) => link?.name === 'Career Page')?.url
  let applyUrl
  try {
    applyUrl = new URL(careerLink)
  } catch {
    throw new Error(`Credgenics Zappyhire detail has no valid application URL for job ${id}`)
  }
  if (item?.client !== 'credgenics'
    || !/^credgenics$/i.test(String(item?.entity ?? ''))
    || !Number.isInteger(id)
    || detail?.id !== id
    || normalizeWhitespace(detail?.title) !== normalizeWhitespace(item?.title)
    || locations.length === 0
    || !locations.every((location) => location.countryCode === 'IN' && verifiedCities.has(location.city))
    || applyUrl.origin !== 'https://recruitcareers.zappyhire.com'
    || !/^\/credgenics\/apply\/?$/.test(applyUrl.pathname)
    || applyUrl.searchParams.get('job') !== String(id)) {
    throw new Error(`Credgenics Zappyhire job ${id} no longer matches the verified public listing and detail`)
  }

  const location = `${locations.map((entry) => entry.city).join(', ')}, India`
  const experience = Number.isFinite(detail.experience) && Number.isFinite(detail.max_experience)
    ? `${detail.experience}-${detail.max_experience} years` : null
  const sourceUrl = applyUrl.toString()
  return {
    title: normalizeWhitespace(detail.title),
    company: COMPANY,
    department: normalizeWhitespace(detail.department),
    location,
    city: locations[0].city,
    country: 'India',
    jobId: `${SOURCE}-${id}`,
    requisitionId: String(id),
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: normalizeWhitespace(detail.job_type),
    experienceRequired: experience,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: Array.isArray(detail.skills) ? detail.skills.map(normalizeWhitespace).filter(Boolean) : [],
    postingDate: detail.job_publish_date || null,
    closingDate: null,
    jobDescription: stripTags(detail.description),
    source: SOURCE,
    link: sourceUrl,
    scrapedAt,
    companyCareerPage: ZAPPYHIRE_BOARD_URL,
    companyDomain: 'credgenics.com',
    atsPlatform: 'official-zappyhire-board',
  }
}

export const extractLinkedInJobsUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
    const linkedInUrl = normalizeLinkedInJobsUrl(match[1])
    if (linkedInUrl) return linkedInUrl
  }

  return null
}

export const pageExposesFirstPartyJobsSignal = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl) continue

    const url = new URL(absoluteUrl)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    if (hostname !== 'credgenics.com') continue
    if (/\/(?:careers?|jobs?)(?:\/|$)/i.test(url.pathname)) return true
  }

  return false
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
  headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createCredgenicsScraper = ({ pageSize = 100 } = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, now = () => new Date().toISOString() } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (hasCurrentHomepageSignal(homepageHtml)) {
      if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        throw new Error('Credgenics Zappyhire page size must be between 1 and 100')
      }
      const boardHtml = await fetchText(ZAPPYHIRE_BOARD_URL)
      if (!hasZappyhireBoardShell(boardHtml)) {
        throw new Error('Credgenics Zappyhire board no longer matches the official careers shell')
      }
      const [config, filters] = await Promise.all([
        fetchJson(`${ZAPPYHIRE_API_BASE}careers/configurations/`),
        fetchJson(`${ZAPPYHIRE_API_BASE}careers/filter-params/`),
      ])
      if (config?.status !== 1
        || !/^credgenics$/i.test(String(config.results?.name ?? ''))
        || config.results?.website !== HOMEPAGE_URL
        || !/^credgenics careers$/i.test(String(config.results?.career_text_heading ?? ''))
        || config.results?.other_organization_settings?.country !== 'in'
        || filters?.status !== 1
        || !Array.isArray(filters.results?.locations)) {
        throw new Error('Credgenics Zappyhire configuration no longer matches the verified India organization')
      }

      const verifiedCities = new Set(filters.results.locations.map(normalizeWhitespace).filter(Boolean))
      const records = []
      let total = null
      for (let page = 1; total === null || records.length < total; page += 1) {
        if (page > 100) throw new Error('Credgenics Zappyhire jobs exceeded the pagination limit')
        const payload = await fetchJson(buildZappyhireJobsUrl(page, pageSize))
        const count = payload?.results?.total?.value
        const hits = payload?.results?.hits
        if (payload?.status !== 1 || !Number.isInteger(count) || count < 0
          || !Array.isArray(hits) || (total !== null && total !== count)
          || (count > 0 && hits.length === 0)) {
          throw new Error('Credgenics Zappyhire jobs pagination no longer matches the public API')
        }
        total = count
        records.push(...hits)
      }
      if (records.length !== total || new Set(records.map((record) => record?._source?.job)).size !== total) {
        throw new Error('Credgenics Zappyhire jobs pagination returned duplicate or missing roles')
      }
      const scrapedAt = now()
      return Promise.all(records.map(async (record) => {
        const detailPayload = await fetchJson(buildZappyhireJobDetailUrl(record?._source?.job))
        if (detailPayload?.status !== 1) throw new Error('Credgenics Zappyhire job detail is unavailable')
        return extractZappyhireJob(record, detailPayload.results, verifiedCities, scrapedAt)
      }))
    }

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Credgenics official homepage changed; refusing to assume the verified surface still applies')
    }

    if (pageExposesFirstPartyJobsSignal(homepageHtml)) {
      throw new Error('Credgenics homepage now appears to expose a first-party public jobs surface')
    }

    const linkedInJobsUrl = extractLinkedInJobsUrl(homepageHtml)
    if (linkedInJobsUrl && linkedInJobsUrl !== VERIFIED_LINKEDIN_JOBS_URL) {
      throw new Error('Credgenics careers handoff changed; refusing to assume the verified external route still applies')
    }

    return []
  },
})

export const run = async (options = {}) => createCredgenicsScraper().run(options)

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
