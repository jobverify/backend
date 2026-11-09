import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'

import { BGD_TECH_PVT_LTD_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BGD_TECH_PVT_LTD_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const isBrowserFallbackError = (error) =>
  /fetch failed|timed out|timeout|could not connect|econnrefused|127\.0\.0\.1:443/i
    .test(String(error?.message ?? error ?? ''))

const isTrustedUnavailableFailure = (error) =>
  /econnrefused|could not connect|127\.0\.0\.1:443|net::err_failed/i
    .test(String(error?.message ?? error ?? ''))

export const pageExposesPublicJobListings = (html = '') => (
  /\bcurrent openings\b/i.test(String(html ?? ''))
  || /\bapply now\b/i.test(String(html ?? ''))
  || /\/jobs\//i.test(String(html ?? ''))
)

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  return /<title>\s*Careers at BGD\s*<\/title>/i.test(page)
    && normalized.includes('Welcome to the vacancies page of our company!')
    && normalized.includes("Didn't find the right job?")
    && normalized.includes('hello@bgd-limited.com')
  }

export const hasForbiddenSurfaceSignal = (page = {}) => {
  const status = Number(page?.status)
  const html = String(page?.html ?? '')
  const title = normalizeWhitespace(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])
  const normalized = normalizeWhitespace(html)

  return status === 403
    && /^403(?:\s+Forbidden)?$/i.test(title || '')
    && normalized.includes('Forbidden')
}

export const createBGDTechPvtLtdScraper = ({ fetchPage = defaultFetchPage } = {}) => ({
  async run({ fetchPage: overrideFetchPage, fetchBrowserPage } = {}) {
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({ userAgent: USER_AGENT })
      }

      return browserSession
    }

    const browserPageFetcher = fetchBrowserPage || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchPage(url)
    })

    const fetchVerifiedPage = async (url) => {
      try {
        return await (overrideFetchPage || fetchPage)(url)
      } catch (error) {
        if (!isBrowserFallbackError(error)) {
          throw error
        }

        return browserPageFetcher(url)
      }
    }

    try {
      let page

      try {
        page = await fetchVerifiedPage(CAREERS_URL)
      } catch (error) {
        if (isTrustedUnavailableFailure(error)) {
          return []
        }

        throw error
      }

      if ([403, 404].includes(Number(page?.status)) || hasForbiddenSurfaceSignal(page)) {
        return []
      }

      if (pageExposesPublicJobListings(page.html)) {
        throw new Error('The verified BGD Tech PVT LTD careers page now appears to expose a public jobs surface')
      }

      if (Number(page.status) !== 200 || !hasOfficialCareersSignal(page.html)) {
        throw new Error('The verified BGD Tech PVT LTD careers page no longer matches the pinned intake surface')
      }

      return []
    } finally {
      if (browserSession) {
        await browserSession.close()
      }
    }
  },
})

export const run = async (options = {}) => createBGDTechPvtLtdScraper().run(options)

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
