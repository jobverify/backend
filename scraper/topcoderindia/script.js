import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { TOPCODER_INDIA_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const GIG_PROGRAM_URL = PROVIDER_METADATA.gigProgramUrl
export const GIG_RESOURCES_URL = PROVIDER_METADATA.gigResourcesUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;|&#038;/gi, '&')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeText = (value) => normalizeWhitespace(value)?.toLowerCase() || ''

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const text = normalizeText(html)

  return text.includes('fueling innovation, delivery, and the future of work')
    && text.includes('scalable human + ai talent')
    && text.includes('crowd-driven innovation')
}

export const hasGigWorkLandingSignal = (html = '') => {
  const text = normalizeText(html)

  return text.includes('welcome to gig work at topcoder')
    && text.includes('freelance gigs are the way to go')
    && text.includes('location does not matter')
    && text.includes('usa and india')
    && text.includes('general intake of gig work form')
}

export const hasGigProgramSignal = (html = '') => {
  const text = normalizeText(html)

  return text.includes('looking for a full time gig or guaranteed income? find it at topcoder.')
    && text.includes('gig work is a full time, freelance position working directly with our customers.')
    && text.includes('being a topcoder member is the first thing you need to do')
    && text.includes('more are being posted daily')
}

export const hasGigTransferSignal = (html = '') => {
  const text = normalizeText(html)

  return text.includes('gig work update')
    && text.includes('transfer of gig work')
    && text.includes('transferred to wipro')
    && text.includes('talent.topcoder@wipro.com')
    && text.includes('gigs will still be available')
}

export const pageExposesExactNameEmployerJobs = (html = '') => {
  const text = normalizeText(html)

  return text.includes('topcoder india')
    && (
      text.includes('apply now')
      || text.includes('company: topcoder india')
      || /"@type"\s*:\s*"JobPosting"/i.test(String(html ?? ''))
    )
}

export const createTopcoderIndiaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      Number(homepage.status) !== 200
      || !sameUrl(homepage.url, HOMEPAGE_URL)
      || pageExposesExactNameEmployerJobs(homepage.html)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Topcoder India verified first-party homepage changed materially')
    }

    const gigLandingPage = await fetchPage(CAREERS_URL)
    if (pageExposesExactNameEmployerJobs(gigLandingPage.html)) {
      throw new Error('Topcoder India exact-name employer jobs surface now appears on the verified first-party pages')
    }
    if (
      Number(gigLandingPage.status) !== 200
      || !sameUrl(gigLandingPage.url, CAREERS_URL)
      || !hasGigWorkLandingSignal(gigLandingPage.html)
    ) {
      throw new Error('Topcoder India verified gig landing page changed materially')
    }

    const gigProgramPage = await fetchPage(GIG_PROGRAM_URL)
    if (pageExposesExactNameEmployerJobs(gigProgramPage.html)) {
      throw new Error('Topcoder India exact-name employer jobs surface now appears on the verified first-party pages')
    }
    if (
      Number(gigProgramPage.status) !== 200
      || !sameUrl(gigProgramPage.url, GIG_PROGRAM_URL)
      || !hasGigProgramSignal(gigProgramPage.html)
    ) {
      throw new Error('Topcoder India verified gig program page changed materially')
    }

    const gigResourcesPage = await fetchPage(GIG_RESOURCES_URL)
    if (pageExposesExactNameEmployerJobs(gigResourcesPage.html)) {
      throw new Error('Topcoder India exact-name employer jobs surface now appears on the verified first-party pages')
    }
    if (
      Number(gigResourcesPage.status) !== 200
      || !sameUrl(gigResourcesPage.url, GIG_RESOURCES_URL)
      || !hasGigTransferSignal(gigResourcesPage.html)
    ) {
      throw new Error('Topcoder India verified gig resources page changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createTopcoderIndiaScraper().run(options)

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
