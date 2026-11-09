import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'wizfrieght'
export const COMPANY = 'Wiz Frieght'
export const VERIFIED_AT = '2026-08-15'
export const HOMEPAGE_URL = 'https://wizfreight.com/'
export const SITEMAP_INDEX_URL = 'https://wizfreight.com/sitemap.xml'
export const WEBSITE_SITEMAP_URL = 'https://wizfreight.com/sitemap.website.xml'
export const CAREERS_ROUTE_URLS = [
  'https://wizfreight.com/careers',
  'https://wizfreight.com/career',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const UNAVAILABLE_ERROR_PATTERN =
  /fetch failed|timed out|timeout|connect timeout|und_err_connect_timeout|could not connect|econnreset|unable to|getaddrinfo|enotfound/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;|\u2019/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

const compactText = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/\s+/g, '')

const normalizeXml = (value) => normalizeWhitespace(value)

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

export const isVerifiedWizFrieghtUnavailableError = (error) => {
  const message = String(error?.message ?? error ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')

  return UNAVAILABLE_ERROR_PATTERN.test(message)
    || UNAVAILABLE_ERROR_PATTERN.test(causeCode)
    || UNAVAILABLE_ERROR_PATTERN.test(causeMessage)
}

const fetchPageSafely = async (fetchPage, url) => {
  try {
    return {
      page: await fetchPage(url),
      error: null,
    }
  } catch (error) {
    if (!isVerifiedWizFrieghtUnavailableError(error)) throw error

    return {
      page: null,
      error,
    }
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const compact = compactText(rawHtml)
  const hasCurrentPlaceholderShell =
    normalized.includes('sign in')
    && normalized.includes('create account')
    && normalized.includes('orders')
    && normalized.includes('shop')

  return /<title[^>]*>\s*wizfreight\.com\s*<\/title>/i.test(rawHtml)
    && /meta[^>]+name=["']author["'][^>]+content=["']wizfreight\.com["']/i.test(rawHtml)
    && /meta[^>]+name=["']generator["'][^>]+content=["']Starfield Technologies; Go Daddy Website Builder 8\.0\.0000["']/i.test(rawHtml)
    && normalized.includes('launching soon')
    && normalized.includes('contact us')
    && normalized.includes('powered by')
    && normalized.includes('copyright © 2026 wizfreight.com - all rights reserved.')
    && compact.includes('coming_soon')
    && (compact.includes('wam_site_ishomepage:true') || hasCurrentPlaceholderShell)
}

export const hasVerifiedSitemapIndexSignal = (xml) => {
  const normalized = normalizeXml(xml)

  return normalized.includes('http://wizfreight.com/sitemap.website.xml')
    && normalized.includes('http://wizfreight.com/sitemap.ols.xml')
    && !/(career|careers|job|jobs|opening|openings|vacancy|vacancies|join-us|work-with-us)/i.test(normalized)
}

export const hasVerifiedWebsiteSitemapSignal = (xml) => {
  const normalized = normalizeXml(xml)

  return normalized.includes('http://wizfreight.com/shop')
    && normalized.includes('http://wizfreight.com/terms-and-conditions')
    && normalized.includes('http://wizfreight.com/')
    && normalized.includes('http://wizfreight.com/privacy-policy')
    && normalized.includes('2026-05-07')
    && normalized.includes('weekly')
    && !/(career|careers|job|jobs|opening|openings|vacancy|vacancies|join-us|work-with-us)/i.test(normalized)
}

export const hasPublicJobsSignal = (html) => /(?:open roles|open positions|current openings|job openings|available positions|apply now|apply here|join our team|vacanc(?:y|ies)|requisition|job description|careers@|workdayjobs|jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|workable\.com|smartrecruiters)/i
  .test(String(html ?? ''))

export const hasVerified404CareersSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)
  const compact = compactText(rawHtml)
  const hasCurrentPlaceholderShell =
    normalized.includes('sign in')
    && normalized.includes('create account')
    && normalized.includes('orders')
    && normalized.includes('shop')

  return /<title[^>]*>\s*wizfreight\.com\s*<\/title>/i.test(rawHtml)
    && /meta[^>]+name=["']generator["'][^>]+content=["']Starfield Technologies; Go Daddy Website Builder 8\.0\.0000["']/i.test(rawHtml)
    && /meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/wizfreight\.com\/404["']/i.test(rawHtml)
    && normalized.includes('page not found')
    && normalized.includes("we can't seem to find the page you're looking for.")
    && normalized.includes('go to home page')
    && (compact.includes('wam_site_ishomepage:false') || hasCurrentPlaceholderShell)
}

export const isVerifiedNoPublicCareersRoute = (page = {}) =>
  Number(page.status) === 404
  && hasVerified404CareersSignal(page.html)
  && !hasPublicJobsSignal(page.html)

export const createWizFrieghtScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepageResult = await fetchPageSafely(fetchPage, HOMEPAGE_URL)
    const homepage = homepageResult.page
    if (homepage && (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html))) {
      throw new Error('Wiz Frieght homepage no longer matches the verified first-party placeholder surface')
    }

    if (homepage && hasPublicJobsSignal(homepage.html)) {
      throw new Error('Wiz Frieght homepage now exposes a public jobs surface')
    }

    const sitemapIndexResult = await fetchPageSafely(fetchPage, SITEMAP_INDEX_URL)
    const sitemapIndex = sitemapIndexResult.page
    if (sitemapIndex && (sitemapIndex.status !== 200 || !hasVerifiedSitemapIndexSignal(sitemapIndex.html))) {
      throw new Error('Wiz Frieght sitemap index no longer matches the verified first-party placeholder surface')
    }

    const websiteSitemapResult = await fetchPageSafely(fetchPage, WEBSITE_SITEMAP_URL)
    const websiteSitemap = websiteSitemapResult.page
    if (websiteSitemap && (websiteSitemap.status !== 200 || !hasVerifiedWebsiteSitemapSignal(websiteSitemap.html))) {
      throw new Error('Wiz Frieght website sitemap no longer matches the verified first-party placeholder surface')
    }

    let sawUnavailableSurface = Boolean(
      homepageResult.error
      || sitemapIndexResult.error
      || websiteSitemapResult.error,
    )

    for (const routeUrl of CAREERS_ROUTE_URLS) {
      const routeResult = await fetchPageSafely(fetchPage, routeUrl)
      const routePage = routeResult.page

      if (!routePage) {
        sawUnavailableSurface = true
        continue
      }

      if (!isVerifiedNoPublicCareersRoute(routePage)) {
        throw new Error(`Wiz Frieght careers route changed materially or now exposes public jobs: ${routePage.url || routeUrl}`)
      }
    }

    if (sawUnavailableSurface) {
      return []
    }

    return []
  },
})

export const run = async (options = {}) => createWizFrieghtScraper().run(options)

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
