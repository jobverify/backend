import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ANAR_BUSINESS_CATALOG } from './catalog.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ANAR_BUSINESS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const NO_PUBLIC_JOB_ROUTE_URLS = PROVIDER_METADATA.verifiedMissingCareersUrls
export const REPURPOSED_DOMAIN_URL = 'https://myragems.com/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /darwinbox/i,
  /icims/i,
  /taleo/i,
  /peoplestrong/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const defaultFetchPage = async (url, {signal} = {}) => {
  signal?.throwIfAborted()
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(15000)]),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

const normalizeUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasShutdownExplainerSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  const historicalSignal = /<title>\s*Anar/i.test(rawHtml)
    && /Anar Business App:\s*A Journey Concluded/i.test(normalized)
    && /Why We Shut Down/i.test(normalized)
    && /Anar Business App/i.test(normalized)

  const currentSignal = /<title>\s*Anar\s*[—-]\s*Thank you for being part of our journey\s*<\/title>/i.test(rawHtml)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/anar\.biz\/["']/i.test(rawHtml)
    && /<h1[^>]*>\s*Anar has shut down\.\s*<\/h1>/i.test(rawHtml)
    && /Our journey came to an end in November 2023/i.test(normalized)
    && /Our story, in two chapters/i.test(normalized)
    && /href=["']\/agents["']/i.test(rawHtml)

  return historicalSignal || currentSignal
}

export const hasRepurposedDomainSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  if (
    /<title[^>]*>\s*Myra Gems:/i.test(rawHtml)
    && /myragems\.com/i.test(rawHtml)
    && /gemstone rings/i.test(rawHtml)
    && /Shopify/i.test(rawHtml)
  ) {
    return true
  }

  return /<title>\s*Myra Gems:\s*Buy Certified Gemstone Rings for Men(?:\s|&|&amp;)+Women\s*<\/title>/i.test(rawHtml)
    && /myragems\.com/i.test(rawHtml)
    && /Certified Gemstone Rings/i.test(normalized)
    && (
      /20\+\s*Years Expertise in Gemstone Jewellery/i.test(normalized)
      || /Shop gemstone rings for men and women/i.test(normalized)
    )
}

export const isVerifiedMissingCareersRoute = (page = {}, requestedUrl) => {
  const rawHtml = String(page.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  if (getFinalUrl(page, requestedUrl) !== requestedUrl || pageExposesPublicJobListings(rawHtml)) {
    return false
  }

  return (Number(page.status) === 410 && hasShutdownExplainerSignal(rawHtml))
    || (Number(page.status) === 404
      && /\b404\b|not found|page not found/i.test(normalized)
      && /\bAnar\b/i.test(normalized))
}

export const isVerifiedRepurposedDomainRedirect = (page = {}) =>
  Number(page.status) === 200
  && normalizeUrl(getFinalUrl(page, REPURPOSED_DOMAIN_URL)) === normalizeUrl(REPURPOSED_DOMAIN_URL)
  && hasRepurposedDomainSignal(page.html)
  && !pageExposesPublicJobListings(page.html)

export const createAnarBusinessScraper = () => ({
  async run({ fetchPage = defaultFetchPage, now = () => new Date().toISOString(), signal } = {}) {
    const read = async url => { signal?.throwIfAborted(); const page = await fetchPage(url, {signal}); signal?.throwIfAborted(); return page }
    const homepage = await read(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || (
        !hasShutdownExplainerSignal(homepage.html)
        && !isVerifiedRepurposedDomainRedirect(homepage)
      )
      || (hasShutdownExplainerSignal(homepage.html) && getFinalUrl(homepage, HOMEPAGE_URL) !== HOMEPAGE_URL)
      || pageExposesPublicJobListings(homepage.html)
    ) {
      throw new Error('Anar Business verified shutdown homepage no longer matches the trusted first-party surface')
    }

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await read(routeUrl)
      if (
        !isVerifiedMissingCareersRoute(routePage, routeUrl)
        && !isVerifiedRepurposedDomainRedirect(routePage)
      ) {
        throw new Error(`Anar Business verified missing careers route changed materially or now exposes public jobs: ${getFinalUrl(routePage, routeUrl)}`)
      }
    }

    return attachInventoryEvidence([], {status:'discovery-only',surface:HOMEPAGE_URL,firstParty:true,listingComplete:false,pagesFetched:1+NO_PUBLIC_JOB_ROUTE_URLS.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:'Current publisher shutdown/retired careers route discovery only; no current employer recruiting inventory or complete vacancy count is verified. Prior jobs must be preserved; this is not verified-empty inventory.'})
  },
})

export const run = async (options = {}) => createAnarBusinessScraper().run(options)

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
