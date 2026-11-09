import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import INDI_IT_SOLUTIONS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const shouldUseBrowserFallback = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const PROVIDER_METADATA = INDI_IT_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const OFFICIAL_CAREERS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const SHARED_APPLY_URL = new URL('#Career', OFFICIAL_CAREERS_URL).toString()
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 1,
  label: SOURCE,
  timeoutMs: 15000,
})

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const hasOfficialIndiItCareerSignals = (html = '') => {
  const page = String(html ?? '')

  return /Join Our Vibrant Team at Indi IT\./i.test(page)
    && /View Open Roles/i.test(page)
    && /Top Opportunities Right Now\./i.test(page)
    && /hr@indiit\.com/i.test(page)
}

export const extractOpportunityCards = (html = '') => {
  const roles = []

  for (const match of String(html ?? '').matchAll(/<article\b[^>]*class=["'][^"']*\bindi-role-card\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)) {
    const articleHtml = match[1]
    const title = normalizeWhitespace(articleHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    const experienceRequired = normalizeWhitespace(articleHtml.match(/class=["'][^"']*\bexperience\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1])
    const vacancies = normalizeWhitespace(articleHtml.match(/class=["'][^"']*\bvacancies\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1])
    const applyUrl = normalizeWhitespace(articleHtml.match(/<a[^>]*href=["']([^"']+)["']/i)?.[1])

    if (!title || !experienceRequired || !vacancies || !applyUrl) continue

    roles.push({
      title,
      location: 'India',
      city: null,
      country: 'India',
      experienceRequired,
      vacancies,
      applyUrl,
      sourceUrl: applyUrl,
      // The live page can reuse the same shared CTA across multiple roles, so derive
      // the identifier from the visible card content instead of the link hash alone.
      jobId: slugify(`${title}-${experienceRequired}-${vacancies}`),
    })
  }

  if (roles.length > 0) {
    return roles
  }

  const normalized = normalizeWhitespace(html)
  const opportunitiesSection = normalized.includes('Top Opportunities Right Now.')
    ? normalized.slice(normalized.indexOf('Top Opportunities Right Now.'))
    : normalized
  const listingsText = opportunitiesSection.includes('Action ')
    ? opportunitiesSection.slice(opportunitiesSection.indexOf('Action ') + 'Action '.length)
    : opportunitiesSection

  for (const match of listingsText.matchAll(
    /([A-Za-z][A-Za-z0-9/&,+\-(). ]*?)\s+(Minimum\s+\d+\+?\s+years?\s+of experience)\s+(\d+\s+Vacancies?)\s+Apply Now/gi,
  )) {
    const title = normalizeWhitespace(match[1])
    const experienceRequired = normalizeWhitespace(match[2])
    const vacancies = normalizeWhitespace(match[3])

    if (!title || !experienceRequired || !vacancies) continue

    roles.push({
      title,
      location: 'India',
      city: null,
      country: 'India',
      experienceRequired,
      vacancies,
      applyUrl: SHARED_APPLY_URL,
      sourceUrl: SHARED_APPLY_URL,
      jobId: slugify(`${title}-${experienceRequired}-${vacancies}`),
    })
  }

  return roles
}

export const createIndiItSolutionsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchBrowserText } = {}) {
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({
          userAgent: USER_AGENT,
          settleTimeMs: 4000,
        })
      }

      return browserSession
    }

    const browserTextFetcher = fetchBrowserText || (async (url) => {
      const session = await getBrowserSession()
      const page = await session.fetchPage(url)

      if (![200, 304].includes(page.status)) {
        throw new Error(`HTTP ${page.status} for ${url}`)
      }

      return page.html
    })

    const fetchTextWithBrowserFallback = async (url) => {
      try {
        return await fetchText(url)
      } catch (error) {
        if (!shouldUseBrowserFallback(error)) {
          throw error
        }

        return browserTextFetcher(url)
      }
    }

    try {
      const careersHtml = await fetchTextWithBrowserFallback(OFFICIAL_CAREERS_URL)

      if (!hasOfficialIndiItCareerSignals(careersHtml)) {
        throw new Error('INDI IT SOLUTIONS verified first-party career page no longer matches the verified public surface')
      }

      const roles = extractOpportunityCards(careersHtml)
      if (roles.length === 0) {
        throw new Error('INDI IT SOLUTIONS verified career page no longer exposes the opportunity cards')
      }

      return roles.map((role) => ({
        title: role.title,
        company: COMPANY_NAME,
        department: null,
        location: role.location,
        city: role.city,
        country: role.country,
        jobId: role.jobId,
        requisitionId: null,
        sourceUrl: role.sourceUrl,
        applyUrl: role.applyUrl,
        employmentType: null,
        experienceRequired: role.experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: role.vacancies,
        source: SOURCE,
        link: role.applyUrl,
        scrapedAt: now(),
      }))
    } finally {
      if (browserSession) {
        await browserSession.close().catch(() => {})
      }
    }
  },
})

export const run = async (options = {}) => createIndiItSolutionsScraper(options).run(options)

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
