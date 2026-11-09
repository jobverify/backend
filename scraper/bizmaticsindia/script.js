import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { BIZMATICS_INDIA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BIZMATICS_INDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const SOLD_DOMAIN_URL = PROVIDER_METADATA.soldDomainUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const UNREACHABLE_ERROR_PATTERN = /UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|getaddrinfo|fetch failed|aborted due to timeout|timeout/i

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

export const isUnreachableError = (error) => {
  const message = String(error?.message ?? error ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')

  return UNREACHABLE_ERROR_PATTERN.test(message)
    || UNREACHABLE_ERROR_PATTERN.test(causeCode)
    || UNREACHABLE_ERROR_PATTERN.test(causeMessage)
}

const fetchPageSafely = async (fetchPage, url) => {
  try {
    return await fetchPage(url)
  } catch (error) {
    if (!isUnreachableError(error)) throw error

    return {
      status: null,
      url,
      html: null,
      errorKind: 'unreachable',
    }
  }
}

export const isUnavailableSurface = (page = {}) =>
  page?.status == null
  && page?.errorKind === 'unreachable'

export const hasRedirectShellSignal = (html = '') => (
  /window\.onload=function\(\)\{window\.location\.href="\/lander"\}/i.test(String(html ?? ''))
)

export const extractRedirectTarget = (html = '') => {
  const match = String(html ?? '').match(/window\.location\.href="([^"]+)"/i)
  return match?.[1] || null
}

export const hasForSaleLanderSignal = (html = '') => (
  /bizmatics\.com is for sale/i.test(String(html ?? ''))
    && /GoDaddy/i.test(String(html ?? ''))
    && /forsale\.godaddy\.com/i.test(String(html ?? ''))
)

export const createBizmaticsIndiaScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
  } = {}) {
    try {
      const homepage = await fetchPage(HOMEPAGE_URL)
      if (homepage.status !== 200 || !hasRedirectShellSignal(homepage.html)) {
        throw new Error('Bizmatics verified homepage shell no longer matches the known public surface')
      }

      const careersPage = await fetchPage(CAREERS_URL)
      if (careersPage.status !== 200 || !hasRedirectShellSignal(careersPage.html)) {
        throw new Error('Bizmatics verified careers shell no longer matches the known public surface')
      }

      if (extractRedirectTarget(homepage.html) !== '/lander' || extractRedirectTarget(careersPage.html) !== '/lander') {
        throw new Error('Bizmatics redirect shell no longer points to the verified /lander target')
      }

      const soldDomainPage = await fetchPage(SOLD_DOMAIN_URL)
      if (soldDomainPage.status !== 200 || !hasForSaleLanderSignal(soldDomainPage.html)) {
        throw new Error('Bizmatics /lander no longer matches the verified sold-domain page')
      }

      return []
    } catch (error) {
      if (!isUnreachableError(error)) throw error

      const surfaces = await Promise.all([
        fetchPageSafely(fetchPage, HOMEPAGE_URL),
        fetchPageSafely(fetchPage, CAREERS_URL),
        fetchPageSafely(fetchPage, SOLD_DOMAIN_URL),
      ])

      if (surfaces.every(isUnavailableSurface)) {
        return []
      }

      throw error
    }
  },
})

export const run = async (options = {}) => createBizmaticsIndiaScraper().run(options)

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
