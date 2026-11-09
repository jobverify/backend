import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FIVE_STAR_BUSINESS_FINANCE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FIVE_STAR_BUSINESS_FINANCE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREER_PAGE_URL = PROVIDER_METADATA.careerPageUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /smartrecruiters/i,
  /jobvite/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /darwinbox/i,
  /peoplestrong/i,
  /successfactors/i,
  /oraclecloud/i,
  /linkedin\.com\/jobs/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&nbsp;|&#160;/gi, ' ')

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(decodeHtmlEntities(match?.[1])) || null
}

const extractLinks = (html = '') => (
  [...String(html ?? '').matchAll(/href=["']([^"'#]+)["']/gi)]
    .map((match) => match[1].trim())
    .filter(Boolean)
)

const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeUrl = (value) => {
  try {
    return new URL(value).toString()
  } catch {
    return null
  }
}

const defaultFetchPage = async (url, { signal } = {}) => {
  signal?.throwIfAborted()
  const response = await fetch(url, {
    signal,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  signal?.throwIfAborted()
  const html = await response.text()
  signal?.throwIfAborted()
  return { status: response.status, url: response.url, html }
}

export const extractHomepageCareersUrl = (html = '') => {
  for (const link of extractLinks(html)) {
    const absoluteUrl = toAbsoluteUrl(link, HOMEPAGE_URL)
    if (/\/careers\/?$/i.test(absoluteUrl || '')) {
      return absoluteUrl
    }
  }

  return null
}

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === 'Five Star Group'
    && normalized.includes('Financial Solutions For Your Business Needs')
    && normalized.includes('Five Star at a Glance')
    && normalized.includes('Branches')
    && normalized.includes('Employees')
    && normalized.includes('Five-Star Business Finance Limited')
    && normalized.includes('customercare@fivestargroup.in')
    && normalized.includes('info@fivestargroup.in')
    && normalized.includes('CIN: L65991TN1984PLC010844')
    && extractHomepageCareersUrl(rawHtml) === CAREER_PAGE_URL
    && !hasPublicJobsSignal(rawHtml)
}

export const hasOfficialCareersShellSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === 'Careers - Five Star Group'
    && normalized.includes('Careers')
    && normalized.includes('Company Culture')
    && normalized.includes('Interested in partnering with market leader for Small Business Loans?')
    && normalized.includes('Contact us')
    && normalized.includes('Five-Star Business Finance Limited')
    && normalized.includes('info@fivestargroup.in')
    && !hasPublicJobsSignal(rawHtml)
}

export const createFiveStarBusinessFinanceScraper = () => ({
  async run({ fetchPage: rawFetchPage = defaultFetchPage, signal } = {}) {
    signal?.throwIfAborted()
    const fetchPage = async (url, options = {}) => {
      signal?.throwIfAborted()
      try {
        const page = await rawFetchPage(url, { ...options, signal: signal || options.signal })
        signal?.throwIfAborted()
        return page
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    }
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (
      Number(homepage.status) !== 200
      || normalizeUrl(homepage.url) !== HOMEPAGE_URL
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error(
        'Five Star Business Finance verified official homepage no longer matches the known first-party surface',
      )
    }

    const careerPage = await fetchPage(CAREER_PAGE_URL)

    if (
      Number(careerPage.status) !== 200
      || normalizeUrl(careerPage.url) !== CAREER_PAGE_URL
      || !hasOfficialCareersShellSignal(careerPage.html)
    ) {
      throw new Error(
        'Five Star Business Finance verified careers page no longer matches the known first-party surface',
      )
    }

    if (hasPublicJobsSignal(careerPage.html)) {
      throw new Error('Five Star Business Finance careers page now exposes a public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createFiveStarBusinessFinanceScraper().run(options)

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
