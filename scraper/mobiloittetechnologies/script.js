import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { MOBILOITTE_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = MOBILOITTE_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value = '') => String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&#x27;|&apos;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Careers at Mobiloitte That Build Your Future')
    && normalized.includes('Current Openings')
    && normalized.includes('Search Jobs')
    && normalized.includes("Didn't find the right position?")
    && normalized.includes('careers@mobiloitte.com')
  }

export const hasNoJobsFoundState = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('No Jobs Found')
    && normalized.includes("We couldn't find any jobs matching your criteria.")
  }

const extractRoleCards = (html) => {
  const page = String(html ?? '')
  const starts = [...page.matchAll(/<div[^>]*class=["'][^"']*CurrentOpenings_jobCard__[^"']*["'][^>]*>/gi)]
    .map((match) => match.index)
  const cards = starts.map((start, index) => page.slice(start, starts[index + 1] ?? page.indexOf('CurrentOpenings_ctaSection__', start)))
  const roles = cards.map((card) => {
    const title = normalizeWhitespace(card.match(/<h3[^>]*CurrentOpenings_jobTitle__[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    const descriptionMatch = card.match(/<p[^>]*CurrentOpenings_jobDescription__[^>]*>([\s\S]*?)<\/p>/i)
    const description = normalizeWhitespace(descriptionMatch?.[1])
    const afterDescription = descriptionMatch ? card.slice(card.indexOf(descriptionMatch[0]) + descriptionMatch[0].length) : ''
    const location = normalizeWhitespace(afterDescription.match(/<span[^>]*>([^<]+)<\/span>/i)?.[1])
    const link = card.match(/<a\b[^>]*href=["'](\/careers\/JOB\d+)["'][^>]*CurrentOpenings_viewLink__/i)?.[1]
    if (!title || !description || location !== 'Mobiloitte Delhi Office' || !link) {
      throw new Error('Mobiloitte Technologies role card or first-party detail link changed')
    }
    return { title, description, location, url: new URL(link, CAREERS_URL).toString(), jobId: link.split('/').at(-1) }
  })
  if (roles.length !== new Set(roles.map((role) => role.jobId)).size) {
    throw new Error('Mobiloitte Technologies duplicate role cards on careers page')
  }
  return roles
}

const hasVerifiedRoleDetail = (html, role) => {
  const page = String(html ?? '')
  const title = normalizeWhitespace(page.match(/<title>\s*Apply For ([\s\S]*?) At Mobiloitte Technologies India Pvt\. Ltd\.\s*<\/title>/i)?.[1])
  const canonical = page.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
  return title === role.title && canonical === role.url
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const createMobiloitteTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchBrowserText, now = () => new Date().toISOString() } = {}) {
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({ userAgent: USER_AGENT })
      }

      return browserSession
    }

    const browserTextFetcher = fetchBrowserText || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchText(url)
    })

    const fetchPageText = async (url) => {
      try {
        return await fetchText(url)
      } catch (error) {
        if (!isBrowserFallbackError(error)) {
          throw error
        }

        return browserTextFetcher(url)
      }
    }

    try {
      const careersHtml = await fetchPageText(CAREERS_URL)

      if (!hasOfficialCareersSignal(careersHtml)) {
        throw new Error('Mobiloitte Technologies verified careers page no longer matches the trusted first-party contract')
      }

      if (hasNoJobsFoundState(careersHtml)) {
        return []
      }

      const roles = extractRoleCards(careersHtml)
      if (roles.length === 0) {
        throw new Error('Mobiloitte Technologies careers page exposes neither verified jobs nor the empty state')
      }

      const scrapedAt = now()
      const jobs = []
      for (const role of roles) {
        const detailHtml = await fetchPageText(role.url)
        if (!hasVerifiedRoleDetail(detailHtml, role)) {
          throw new Error('Mobiloitte Technologies first-party role detail changed')
        }
        jobs.push({
          company: COMPANY,
          title: role.title,
          location: 'Delhi, India',
          city: 'Delhi',
          country: 'India',
          link: role.url,
          applyUrl: role.url,
          sourceUrl: role.url,
          source: SOURCE,
          jobId: role.jobId,
          department: null,
          employmentType: null,
          experienceRequired: null,
          jobDescription: role.description,
          minimumQualification: null,
          preferredQualification: null,
          requiredSkills: [],
          postingDate: null,
          remoteStatus: 'On-site',
          sourceListingComplete: false,
          scrapedAt,
        })
      }
      return jobs
    } finally {
      if (browserSession) {
        await browserSession.close()
      }
    }
  },
})

export const run = async (options = {}) => createMobiloitteTechnologiesScraper().run(options)

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
