import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ARTHAYANTRA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ARTHAYANTRA_CATALOG.source
export const COMPANY = ARTHAYANTRA_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = ARTHAYANTRA_CATALOG.officialBrandName
export const LEGAL_ENTITY_NAME = ARTHAYANTRA_CATALOG.legalEntityName
export const VERIFIED_ON = ARTHAYANTRA_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = ARTHAYANTRA_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = ARTHAYANTRA_CATALOG
export const HOMEPAGE_URL = ARTHAYANTRA_CATALOG.companyCareerPage
export const LIVE_LOGIN_URL = ARTHAYANTRA_CATALOG.homepageRedirectUrl
export const ROBOTS_URL = ARTHAYANTRA_CATALOG.robotsTxtUrl
export const SITEMAP_URL = ARTHAYANTRA_CATALOG.sitemapUrl
export const BROKEN_CAREER_ROUTE_URLS = [
  'https://arthayantra.com/careers',
  'https://arthayantra.com/career',
  'https://arthayantra.com/jobs',
  'https://arthayantra.com/join-us',
  'https://arthayantra.com/work-with-us',
  'https://arthayantra.com/openings',
  'https://www.arthayantra.com/financial-consultant-careers/',
  'https://www.arthayantra.com/career-fa/',
  'https://www.arthayantra.com/career-fp/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECTS = 10

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'re| are)? hiring\b/i,
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
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&rsaquo;/gi, '›')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const stripScriptAndStyle = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const normalizeUrl = (value) =>
  String(value ?? '')
    .trim()
    .replace(/\/+$/, '')
    .toLowerCase()

const isOfficialDomainUrl = (value) => {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === 'arthayantra.com'
      || hostname === 'www.arthayantra.com'
      || hostname === 'arthos.arthayantra.com'
  } catch {
    return false
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasCareerLikeLink = (html) => {
  const rawHtml = stripScriptAndStyle(html)

  return /href=["'](?:https?:\/\/(?:www\.)?arthayantra\.com)?\/(?:career|careers|jobs?|join-us|work-with-us|openings)(?:\/|["'#?])/i.test(
    rawHtml,
  )
    || /href=["']\/(?:career|careers|jobs?|join-us|work-with-us|openings)(?:\/|["'#?])/i.test(rawHtml)
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*ARTHOS Financial Planning:\s*Login Arthos for Best Financial Advisory,\s*AY India\s*\|\s*ArthaYantra\s*<\/title>/i.test(
    rawHtml,
  )
    && /ArthaYantra's proprietary model,\s*ARTHOS provides customized financial planning/i.test(rawHtml)
    && normalized.includes('Welcome Back To ARTHOS')
    && /https:\/\/arthos\.arthayantra\.com\/signup-now\.html/i.test(rawHtml)
    && /https:\/\/arthos\.arthayantra\.com\/corporate-signup\.html/i.test(rawHtml)
    && normalized.includes('Arthayantra Corporation Pvt. Ltd is registered with AMFI as a mutual fund distributor having ARN54840.')
    && normalized.includes('Arthayantra Corp. Pvt. Ltd.All rights reserved.Unauthorized access is prohibited. Usage will be monitored.')
}

export const hasOfficialSitemapSignal = (xml = '') => {
  const text = String(xml ?? '')

  return /<urlset/i.test(text)
    && /created with Free Online Sitemap Generator/i.test(text)
    && /https:\/\/www\.arthayantra\.com\/<\/loc>/i.test(text)
    && /https:\/\/www\.arthayantra\.com\/about-financial-planning\/<\/loc>/i.test(text)
    && /https:\/\/www\.arthayantra\.com\/financial-consultant-careers\/<\/loc>/i.test(text)
    && /https:\/\/www\.arthayantra\.com\/contact-us-investment-planning\/<\/loc>/i.test(text)
    && /https:\/\/www\.arthayantra\.com\/career-fa\/<\/loc>/i.test(text)
    && /https:\/\/www\.arthayantra\.com\/career-fp\/<\/loc>/i.test(text)
    && /https:\/\/www\.arthayantra\.com\/blogs\/<\/loc>/i.test(text)
}

export const isVerifiedBrokenWordPressRoute = (page = {}) => {
  const rawHtml = String(page.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return Number(page.status) === 500
    && isOfficialDomainUrl(page.url || '')
    && /<title>\s*WordPress\s*&rsaquo;\s*Error\s*<\/title>/i.test(rawHtml)
    && /meta[^>]+noindex,\s*follow/i.test(rawHtml)
    && normalized.includes('There has been a critical error on this website.')
    && normalized.includes('Learn more about troubleshooting WordPress.')
    && !hasPublicJobsSignal(rawHtml)
}

const requestPage = (url, redirectCount = 0) =>
  new Promise((resolve, reject) => {
    const targetUrl = new URL(url)
    const transport = targetUrl.protocol === 'http:' ? http : https

    const request = transport.request(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
      },
      rejectUnauthorized: false,
    }, (response) => {
      const chunks = []

      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', async () => {
        const status = response.statusCode ?? 0
        const location = response.headers.location

        if (REDIRECT_STATUSES.has(status) && location && redirectCount < MAX_REDIRECTS) {
          try {
            const nextUrl = new URL(location, targetUrl).toString()
            resolve(await requestPage(nextUrl, redirectCount + 1))
            return
          } catch (error) {
            reject(error)
            return
          }
        }

        resolve({
          status,
          url: targetUrl.toString(),
          headers: response.headers,
          html: Buffer.concat(chunks).toString('utf8'),
        })
      })
    })

    request.on('error', reject)
    request.end()
  })

const defaultFetchPage = async (url) => requestPage(url)

export const createArthaYantraScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || normalizeUrl(homepage.url) !== normalizeUrl(LIVE_LOGIN_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('ArthaYantra verified official homepage no longer matches the known first-party login surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('ArthaYantra homepage now appears to expose public jobs')
    }

    if (hasCareerLikeLink(homepage.html)) {
      throw new Error('ArthaYantra homepage now exposes a first-party careers or jobs link')
    }

    const robotsPage = await fetchPage(ROBOTS_URL)
    if (!isVerifiedBrokenWordPressRoute(robotsPage)) {
      throw new Error('ArthaYantra robots.txt no longer matches the verified broken first-party surface')
    }

    const sitemapPage = await fetchPage(SITEMAP_URL)
    if (sitemapPage.status !== 200 || !hasOfficialSitemapSignal(sitemapPage.html)) {
      throw new Error('ArthaYantra sitemap no longer matches the verified legacy first-party surface')
    }

    for (const routeUrl of BROKEN_CAREER_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedBrokenWordPressRoute(routePage)) {
        throw new Error(`ArthaYantra broken career route changed materially or now exposes public jobs: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createArthaYantraScraper().run(options)

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
