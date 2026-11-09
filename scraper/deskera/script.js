import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DESKERA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DESKERA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const LINKEDIN_JOBS_URL = PROVIDER_METADATA.companyCareerPage
export const LINKEDIN_COMPANY_PAGE_URL = PROVIDER_METADATA.linkedinCompanyPageUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(value, HOMEPAGE_URL).toString()
  } catch {
    return null
  }
}

const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/, '')

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /Deskera/i.test(normalized)
    && /Next Generation/i.test(normalized)
    && /Cloud ERP/i.test(normalized)
    && /Payroll and HR/i.test(normalized)
    && /Run & scale your business with Deskera/i.test(normalized)
    && /Sales:\s*888 690 3830/i.test(normalized)
    && /<a[^>]+href=["'][^"']*linkedin\.com\/[^"']*["'][^>]*>\s*Careers\s*<\/a>/i.test(rawHtml)
}

export const extractLinkedInJobsUrl = (html) => {
  const match = String(html ?? '').match(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*Careers\s*<\/a>/i)
  if (!match) return null

  const absoluteUrl = toAbsoluteUrl(match[1])
  return absoluteUrl ? normalizeUrl(absoluteUrl) : null
}

export const pageExposesFirstPartyJobsSignal = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl) continue

    const url = new URL(absoluteUrl)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    if (hostname !== PROVIDER_METADATA.companyDomain) continue

    if (/\/(?:careers?|jobs?|join-us|openings?)(?:\/|$)/i.test(url.pathname)) {
      return true
    }
  }

  return false
}

export const hasVerifiedLinkedInCompanySignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return /Deskera/i.test(normalized)
    && /Technology,\s*Information and Internet/i.test(normalized)
    && /We want to radically change how businesses operate\./i.test(normalized)
    && /https:\/\/www\.deskera\.com/i.test(normalized)
    && /Bengaluru,\s*560066,\s*IN/i.test(normalized)
}

export const isVerifiedMissingLinkedInJobsPage = ({ status, url, html }) => {
  if (Number(status) !== 404) return false
  if (normalizeUrl(url) !== normalizeUrl(LINKEDIN_JOBS_URL)) return false

  return /404/i.test(String(html ?? ''))
    || /This page doesn['’]t exist/i.test(String(html ?? ''))
    || /Page not found/i.test(String(html ?? ''))
}

export const isVerifiedGenericLinkedInJobsSearchPage = ({ status, url, html }) => {
  if (Number(status) !== 200) return false
  if (normalizeUrl(url) !== normalizeUrl(LINKEDIN_JOBS_URL)) return false

  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<meta[^>]+name=["']pageKey["'][^>]+content=["']d_jobs_guest_search["']/i.test(rawHtml)
    && /<meta[^>]+name=["']linkedin:pageTag["'][^>]+content=["']urlType=jserp_canonical_other;emptyResult=false["']/i.test(rawHtml)
    && /\bDeskera jobs\b/i.test(normalized)
    && !/base-search-card__subtitle[^>]*>\s*<a[^>]*>\s*Deskera\s*<\/a>/i.test(rawHtml)
}

export const createDeskeraScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Deskera official homepage changed; refusing to assume the verified careers handoff still applies')
    }

    if (extractLinkedInJobsUrl(homepage.html) !== normalizeUrl(LINKEDIN_JOBS_URL)) {
      throw new Error('Deskera careers handoff changed materially')
    }

    if (pageExposesFirstPartyJobsSignal(homepage.html)) {
      throw new Error('Deskera homepage now appears to expose a first-party public jobs surface')
    }

    const linkedInCompanyPage = await fetchPage(LINKEDIN_COMPANY_PAGE_URL)

    if (linkedInCompanyPage.status !== 200 || !hasVerifiedLinkedInCompanySignal(linkedInCompanyPage.html)) {
      throw new Error('Deskera LinkedIn company page changed materially')
    }

    const linkedInJobsPage = await fetchPage(LINKEDIN_JOBS_URL)

    if (
      !isVerifiedMissingLinkedInJobsPage(linkedInJobsPage)
      && !isVerifiedGenericLinkedInJobsSearchPage(linkedInJobsPage)
    ) {
      throw new Error('Deskera LinkedIn jobs route no longer matches the verified missing-jobs state')
    }

    return []
  },
})

export const run = async (options = {}) => createDeskeraScraper().run(options)

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
