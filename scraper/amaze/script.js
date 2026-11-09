import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AMAZE_CATALOG } from './catalog.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = AMAZE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_ENTRY_URL = 'https://amaze.co/'
export const HOMEPAGE_URL = PROVIDER_METADATA.companyCareerPage
export const ABOUT_PAGE_URL = PROVIDER_METADATA.aboutPageUrl
export const CONTACT_PAGE_URL = PROVIDER_METADATA.contactPageUrl
export const BROKEN_CAREERS_HANDOFF_URL = PROVIDER_METADATA.brokenCareersHandoffUrl
export const NATIVE_POSTINGS_URL = 'https://api.lever.co/v0/postings/amaze?mode=json'
export const CAREERS_ROUTE_URLS = [
  'https://amaze.co/careers',
  'https://amaze.co/jobs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const LIVE_PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bopen roles\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
  /\bjoin our team\b/i,
]

const JOBS_HANDOFF_URL_PATTERN =
  /(jobs\.lever\.co|boards\.greenhouse\.io|job-boards\.greenhouse\.io|ashbyhq\.com|myworkdayjobs|workdayjobs|smartrecruiters|jobvite)/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&ndash;|&mdash;|&#8211;|&#8212;/gi, '-')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

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

const getExpectedRouteFinalUrl = (routeUrl) => {
  if (sameUrl(routeUrl, CAREERS_ROUTE_URLS[0])) return 'https://www.amaze.co/careers'
  if (sameUrl(routeUrl, CAREERS_ROUTE_URLS[1])) return 'https://www.amaze.co/jobs'
  return routeUrl
}

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal,
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

export const extractJobsHandoffUrls = (html = '') => {
  const urls = [...String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => match[1])
    .map((href) => {
      try {
        return new URL(href, HOMEPAGE_URL).toString()
      } catch {
        return null
      }
    })
    .filter((href) => href && JOBS_HANDOFF_URL_PATTERN.test(href))

  return [...new Set(urls)]
}

export const hasUnexpectedLiveJobsSignal = (html = '') =>
  LIVE_PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))
  || extractJobsHandoffUrls(html).some((url) => !sameUrl(url, BROKEN_CAREERS_HANDOFF_URL))

const hasOnlyVerifiedBrokenCareersHandoff = (html = '') => {
  const urls = extractJobsHandoffUrls(html)
  return urls.length === 1
    && sameUrl(urls[0], BROKEN_CAREERS_HANDOFF_URL)
    && !hasUnexpectedLiveJobsSignal(html)
}

export const hasOfficialHomepageSignal = (html = '') => {
  const text = normalizeText(html)

  return text.includes('amaze commerce is live')
    && text.includes('create something amazing')
    && text.includes('helps creators monetize their audiences')
    && text.includes('lifetime fan reach')
    && hasOnlyVerifiedBrokenCareersHandoff(html)
}

export const hasOfficialAboutPageSignal = (html = '') => {
  const text = normalizeText(html)

  return text.includes('ambition can never be boxed in')
    && text.includes("commerce is changing. we're here for the people leading the pack")
    && text.includes('turn their wild ideas into revenue realities')
    && hasOnlyVerifiedBrokenCareersHandoff(html)
}

export const hasOfficialContactPageSignal = (html = '') => {
  const text = normalizeText(html)

  return text.includes('get in touch with us')
    && text.includes("have a question or need support? we're here to help")
    && text.includes('support@amaze.co')
    && hasOnlyVerifiedBrokenCareersHandoff(html)
}

export const hasVerifiedFirstPartyNotFoundRouteSurface = (page = {}) => {
  const title = extractTitle(page.html)
  const text = normalizeText(page.html)

  return Number(page.status) === 404
    && title === 'Not Found'
    && text.includes('page not found')
    && text.includes("the page you are looking for doesn't exist or has been moved")
    && text.includes('go home')
    && !hasUnexpectedLiveJobsSignal(page.html)
}

export const hasVerifiedBrokenLeverBoardSurface = (page = {}) => {
  const title = extractTitle(page.html)
  const text = normalizeText(page.html)

  return Number(page.status) === 404
    && title === 'Not found - 404 error'
    && text.includes("sorry, we couldn't find anything here")
    && text.includes("the job posting you're looking for might have closed, or it has been removed. (404 error).")
    && text.includes('jobs powered by')
    && !hasUnexpectedLiveJobsSignal(page.html)
}

export const createAmazeScraper = () => ({
  async run(options = {}) {
    const signal = AbortSignal.any([AbortSignal.timeout(90000), ...(options.signal ? [options.signal] : [])])
    signal.throwIfAborted()
    let pagesFetched = 0
    const fetchPage = async url => {
      signal.throwIfAborted(); pagesFetched++
      const promise = (options.fetchPage || defaultFetchPage)(url, { signal })
      const page = await new Promise((resolve, reject) => {
        const finish = (fn, value) => { signal.removeEventListener('abort', abort); fn(value) }
        const abort = () => finish(reject, signal.reason)
        signal.addEventListener('abort', abort, { once: true })
        Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error))
        if (signal.aborted) abort()
      })
      signal.throwIfAborted(); return page
    }
    const homepage = await fetchPage(HOMEPAGE_ENTRY_URL)
    if (
      Number(homepage.status) !== 200
      || !sameUrl(homepage.url, HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Amaze verified official homepage surface changed')
    }

    const aboutPage = await fetchPage(ABOUT_PAGE_URL)
    if (
      Number(aboutPage.status) !== 200
      || !sameUrl(aboutPage.url, ABOUT_PAGE_URL)
      || !hasOfficialAboutPageSignal(aboutPage.html)
    ) {
      throw new Error('Amaze verified official about page surface changed')
    }

    const contactPage = await fetchPage(CONTACT_PAGE_URL)
    if (
      Number(contactPage.status) !== 200
      || !sameUrl(contactPage.url, CONTACT_PAGE_URL)
      || !hasOfficialContactPageSignal(contactPage.html)
    ) {
      throw new Error('Amaze verified official contact page surface changed')
    }

    for (const routeUrl of CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (
        !sameUrl(routePage.url, getExpectedRouteFinalUrl(routeUrl))
        || !hasVerifiedFirstPartyNotFoundRouteSurface(routePage)
      ) {
        throw new Error(`Amaze verified no-public-careers route changed: ${routeUrl}`)
      }
    }

    const careersHandoffPage = await fetchPage(BROKEN_CAREERS_HANDOFF_URL)
    if (
      !sameUrl(careersHandoffPage.url, BROKEN_CAREERS_HANDOFF_URL)
      || !hasVerifiedBrokenLeverBoardSurface(careersHandoffPage)
    ) {
      throw new Error('Amaze verified careers handoff changed materially')
    }

    const native = await fetchPage(NATIVE_POSTINGS_URL)
    let payload
    try { payload = JSON.parse(native.html) } catch { throw Error('Amaze native postings API did not publish its expected current response') }
    if (native.status !== 404 || native.url !== NATIVE_POSTINGS_URL || payload?.ok !== false || payload.error !== 'Document not found') {
      throw Error('Amaze current native postings inventory changed and requires native job extraction')
    }
    const closingHome = await fetchPage(HOMEPAGE_ENTRY_URL), closingBoard = await fetchPage(BROKEN_CAREERS_HANDOFF_URL)
    if (closingHome.status !== 200 || !sameUrl(closingHome.url, HOMEPAGE_URL) || !hasOfficialHomepageSignal(closingHome.html)
      || !sameUrl(closingBoard.url, BROKEN_CAREERS_HANDOFF_URL) || !hasVerifiedBrokenLeverBoardSurface(closingBoard)) {
      throw Error('Amaze official careers handoff or board changed during the current check')
    }
    return attachInventoryEvidence([], { firstParty: true, surface: BROKEN_CAREERS_HANDOFF_URL,
      status: 'coverage-gap', listingComplete: false, reportedTotal: null, indiaFacetCount: null, pagesFetched,
      verifiedAt: new Date().toISOString(), reason: 'Current official homepage declares the same Lever tenant at opening and closing; board404 and native API404 prevent observing its native inventory, role countries and full criteria; unknown totals' })
  },
})

export const run = async (options = {}) => createAmazeScraper().run(options)

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
