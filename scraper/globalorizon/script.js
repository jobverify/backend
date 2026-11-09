import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const OUR_DATA_TEAM_URL = 'https://www.globalorizon.com/our-data-team-com'
export const OUR_HIRING_PARTNER_URL = 'https://www.globalorizon.com/the-hiring-partner-com'
export const PUBLIC_ORGANIZATION_URL =
  'https://api.thehiringpartner.com/public/organizations/by-slug/global-orizon-9ma3d'
export const SOURCE = 'globalorizon'
export const COMPANY = 'Global Orizon'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeDomain = (value) => {
  try {
    return new URL(value).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return null
  }
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const makeAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const pageIncludesAll = (html, patterns) => {
  const page = String(html ?? '')
  return patterns.every((pattern) => pattern.test(page))
}

export const hasOfficialOurDataTeamSignal = (html) =>
  pageIncludesAll(html, [
    /Global Orizon/i,
    /Data Engineering Perfected/i,
    /OurDataTeam|Our Data Team/i,
  ])

export const hasOfficialHiringPartnerSignal = (html) =>
  pageIncludesAll(html, [
    /Global Orizon/i,
    /Join Our Team/i,
    /Data Engineers/i,
    /thehiringpartner\.com/i,
  ])

export const extractHiringPartnerJobs = (
  html,
  {
    scrapedAt = new Date().toISOString(),
  } = {},
) => {
  const jobs = []

  for (const match of String(html ?? '').matchAll(
    /<h3[^>]*>\s*(?:<span[^>]*>)?([^<]+?)(?:<\/span>)?\s*<\/h3>[\s\S]{0,1200}?<p[^>]*>\s*(?:<span[^>]*>)?\s*India\s*(?:<\/span>)?\s*<\/p>[\s\S]{0,1200}?<a[^>]+href=["']([^"']*thehiringpartner\.com\/?[^"']*)["'][^>]*>/gi,
  )) {
    const title = normalizeWhitespace(match[1])
    const applyUrl = makeAbsoluteUrl(match[2], OUR_HIRING_PARTNER_URL)
    if (!title || !applyUrl) continue

    const jobId = `${SOURCE}-${slugify(title)}`
    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      link: OUR_HIRING_PARTNER_URL,
      applyUrl,
      sourceUrl: OUR_HIRING_PARTNER_URL,
      source: SOURCE,
      jobId,
      requisitionId: jobId,
      employmentType: null,
      experienceRequired: null,
      jobDescription: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      remoteStatus: null,
      scrapedAt,
    })
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const CURRENT_HOMEPAGE_URL = 'https://www.globalorizon.com/'
const CURRENT_PRODUCT_URL = 'https://www.globalorizon.com/platforms/the-hiring-partner'

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000), headers: { 'User-Agent': USER_AGENT } })
  return { status: response.status, url: response.url, html: await response.text() }
}

const hasPlaceholderCareers = (html) => {
  const anchors = [...String(html).matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .filter(match => /\bcareers?\b/i.test(normalizeWhitespace(match[2])))
  return anchors.length > 0 && anchors.every(match => match[1] === '#')
    && !/"@type"\s*:\s*"JobPosting"|jobs\.lever\.co|job-boards\.greenhouse\.io|boards\.greenhouse\.io|myworkdayjobs\.com|jobs\.ashbyhq\.com/i.test(html)
}

const verifyRetiredPublicListings = async (fetchPage, signal) => {
  const pages = await Promise.all([CURRENT_HOMEPAGE_URL, CURRENT_PRODUCT_URL, OUR_DATA_TEAM_URL, OUR_HIRING_PARTNER_URL, PUBLIC_ORGANIZATION_URL].map(async url => {
    signal?.throwIfAborted()
    const page = await fetchPage(url, { signal })
    if (page.url !== url) throw new Error('GlobalOrizon current public source redirected unexpectedly')
    return page
  }))
  const [home, product, oldData, oldHiring, organization] = pages
  if (home.status !== 200 || !/<title>GlobalOrizon\b[^<]*<\/title>/i.test(home.html)
    || !/<meta\b[^>]*property=["']og:site_name["'][^>]*content=["']GlobalOrizon["']/i.test(home.html)
    || !/href=["']\/platforms\/the-hiring-partner["']/i.test(home.html)
    || !hasPlaceholderCareers(home.html)
    || product.status !== 200 || !/<title>The Hiring Partner \| GlobalOrizon<\/title>/i.test(product.html)
    || !/href=["']https:\/\/(?:www\.)?thehiringpartner\.com\/?["']/i.test(product.html)
    || !hasPlaceholderCareers(product.html)) throw new Error('GlobalOrizon current careers surface changed materially')
  for (const old of [oldData, oldHiring]) {
    if (old.status !== 404 || !/<title>GlobalOrizon\b[^<]*<\/title>/i.test(old.html)
      || !/This page could not be found\./i.test(old.html)) throw new Error('GlobalOrizon retired role page is no longer a verified first-party 404')
  }
  let payload
  try { payload = JSON.parse(organization.html) } catch {}
  if (organization.status !== 404 || payload?.success !== false || payload?.message !== 'Organization not found') {
    throw new Error('GlobalOrizon organization feed is no longer explicitly removed')
  }
  signal?.throwIfAborted()
  return []
}

export const createGlobalOrizonScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchPage = defaultFetchPage, signal, now = () => new Date().toISOString() } = {}) {
    signal?.throwIfAborted()
    let ourDataTeamHtml
    try { ourDataTeamHtml = await fetchText(OUR_DATA_TEAM_URL) }
    catch (error) {
      signal?.throwIfAborted()
      if (error?.status !== 404 && !/HTTP 404\b/.test(error?.message || '')) throw error
      return verifyRetiredPublicListings(fetchPage, signal)
    }
    if (!hasOfficialOurDataTeamSignal(ourDataTeamHtml)) {
      throw new Error('Global Orizon Our Data Team surface changed; refusing to assume zero public jobs')
    }

    const hiringPartnerHtml = await fetchText(OUR_HIRING_PARTNER_URL)
    if (!hasOfficialHiringPartnerSignal(hiringPartnerHtml)) {
      throw new Error('Global Orizon Hiring Partner surface changed; refusing to assume zero public jobs')
    }

    const jobs = extractHiringPartnerJobs(hiringPartnerHtml, {
      scrapedAt: now(),
    }).map((job) => ({
      ...job,
      companyCareerPage: OUR_HIRING_PARTNER_URL,
      companyDomain: normalizeDomain(OUR_DATA_TEAM_URL),
      atsPlatform: 'official-company-careers',
    }))

    if (jobs.length === 0) {
      throw new Error('Global Orizon hiring partner page no longer exposes parseable public roles')
    }

    return jobs
  },
})

export const run = async (options = {}) => createGlobalOrizonScraper().run(options)

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
