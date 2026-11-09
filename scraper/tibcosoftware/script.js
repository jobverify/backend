import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'

import { TIBCO_SOFTWARE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = TIBCO_SOFTWARE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_HUB_URL = PROVIDER_METADATA.careersHubUrl
export const CAREERS_SEARCH_URL = PROVIDER_METADATA.careersSearchUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/\s+/g, ' ')
  .trim()

const hasAllMarkers = (text, markers = []) => markers.every((marker) => text.includes(marker))

const countMarkers = (text, markers = []) => markers.filter((marker) => text.includes(marker)).length

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
    url: response.url || url,
    html: await response.text(),
  }
}

const defaultFetchText = async (url) => {
  const page = await defaultFetchPage(url)

  if (page.status < 200 || page.status >= 300) {
    throw new Error(`HTTP ${page.status} for ${url}`)
  }

  return page.html
}

const isJavaScriptChallengePage = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('JavaScript is disabled')
    && normalized.includes("we need to verify that you're not a robot")
}

export const isCloudCareersAccessChallengePage = (page = {}) => {
  const normalized = normalizeWhitespace(page?.html).toLowerCase()

  return Number(page?.status) === 202
    && (
      normalized.length === 0
      || (
        normalized.includes('javascript is disabled')
        && normalized.includes("we need to verify that you're not a robot")
      )
    )
}

export const hasOfficialContactPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title>\s*Contact Us \| TIBCO\s*<\/title>/i.test(rawHtml)
    && normalized.includes('find your next job opportunity')
    && /href="https:\/\/careers\.cloud\.com\/"/i.test(rawHtml)
}

export const extractOfficialCareersHubUrl = (html = '') => {
  const match = String(html ?? '').match(/href="(https:\/\/careers\.cloud\.com\/)"/i)
  return match?.[1] || null
}

export const hasGenericCloudCareersHubSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(html).toLowerCase()

  return /<title>\s*Careers Home - Cloud Software Group\s*<\/title>/i.test(rawHtml)
    && hasAllMarkers(normalized, [
      'innovate and grow within cloud software group',
      'search by job title, location, department, category, etc.',
      'inside cloud software group',
    ])
    && countMarkers(normalized, [
      'about us',
      '100 million users around the globe',
      'ready to apply? search for open roles.',
      'see all opportunities',
    ]) >= 2
}

export const hasGenericCloudCareersSearchSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title>\s*Career Search - Cloud Software Group\s*<\/title>/i.test(rawHtml)
    && normalized.includes('find your next career opportunity')
    && normalized.includes('country')
    && normalized.includes('brand')
    && normalized.includes('india')
    && normalized.includes('non-tibco office')
    && normalized.includes('citrix')
    && normalized.includes('cloud software group corporate')
    && normalized.includes('spotfire')
}

export const createTibcoSoftwareScraper = () => ({
  async run({
    fetchText = null,
    fetchPage = null,
    fetchBrowserText = null,
    fetchBrowserPage = null,
  } = {}) {
    let browserSession = null
    const directFetchText = fetchText || defaultFetchText
    const directFetchPage = fetchPage || (async (url) => ({
      status: 200,
      url,
      html: await directFetchText(url),
    }))
    const browserFetchPage = fetchBrowserPage || (async (url) => {
      if (fetchBrowserText) {
        return {
          status: 200,
          url,
          html: await fetchBrowserText(url),
        }
      }

      browserSession ||= await createBrowserFetchSession({
        userAgent: USER_AGENT,
        timeoutMs: 90000,
        settleTimeMs: 5000,
      })

      return browserSession.fetchPage(url)
    })

    const fetchMaybeChallengedPage = async (url) => {
      const page = await directFetchPage(url)
      if (isJavaScriptChallengePage(page.html) || isCloudCareersAccessChallengePage(page)) {
        return browserFetchPage(url)
      }
      return page
    }

    try {
      const contactPage = await directFetchPage(CAREERS_URL)
      if (Number(contactPage?.status) !== 200 || !hasOfficialContactPageSignal(contactPage.html)) {
        throw new Error('TIBCO verified official contact page no longer matches the known public surface')
      }

      if (extractOfficialCareersHubUrl(contactPage.html) !== CAREERS_HUB_URL) {
        throw new Error('TIBCO official contact page no longer points to the verified careers hub')
      }

      const careersHubPage = await fetchMaybeChallengedPage(CAREERS_HUB_URL)
      if (
        !isCloudCareersAccessChallengePage(careersHubPage)
        && !hasGenericCloudCareersHubSignal(careersHubPage.html)
      ) {
        throw new Error('TIBCO linked careers hub no longer matches the verified generic Cloud Software Group surface')
      }

      const careersSearchPage = await fetchMaybeChallengedPage(CAREERS_SEARCH_URL)
      if (
        !isCloudCareersAccessChallengePage(careersSearchPage)
        && !hasGenericCloudCareersSearchSignal(careersSearchPage.html)
      ) {
        throw new Error('TIBCO linked careers search page no longer matches the verified generic multi-brand search surface')
      }

      return []
    } finally {
      if (browserSession) {
        await browserSession.close().catch(() => {})
      }
    }
  },
})

export const run = async (options = {}) => createTibcoSoftwareScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
