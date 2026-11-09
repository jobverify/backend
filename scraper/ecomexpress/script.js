import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ECOM_EXPRESS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ECOM_EXPRESS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREER_PAGE_URL = PROVIDER_METADATA.careerPageUrl
export const CHECKED_LANDING_PAGE_URLS = [...PROVIDER_METADATA.checkedLandingPageUrls]
export const ROBOTS_TXT_URL = PROVIDER_METADATA.robotsTxtUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl
export const DELHIVERY_CONTINUE_URL = PROVIDER_METADATA.delhiveryContinueUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECTS = 10

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /smartrecruiters/i,
  /jobvite/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /darwinbox/i,
  /icims/i,
  /successfactors/i,
  /oraclecloud/i,
  /\bvacanc(?:y|ies)\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

export const isRecoverableCertificateError = (error) => {
  const message = String(error?.message ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const combined = `${message} ${causeCode} ${causeMessage}`

  return /CERT_HAS_EXPIRED/i.test(combined)
    || /certificate has expired/i.test(combined)
    || /SEC_E_CERT_EXPIRED/i.test(combined)
}

export const fetchPageAllowingExpiredCertificate = (url, redirectCount = 0) => new Promise((resolve, reject) => {
  const targetUrl = new URL(url)
  const transport = targetUrl.protocol === 'http:' ? http : https

  const request = transport.request(targetUrl, {
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    rejectUnauthorized: false,
  }, (response) => {
    const status = response.statusCode ?? 0
    const location = response.headers.location

    if (
      location
      && REDIRECT_STATUSES.has(status)
      && redirectCount < MAX_REDIRECTS
    ) {
      response.resume()
      resolve(fetchPageAllowingExpiredCertificate(new URL(location, targetUrl).toString(), redirectCount + 1))
      return
    }

    let html = ''
    response.setEncoding('utf8')
    response.on('data', (chunk) => {
      html += chunk
    })
    response.on('end', () => {
      resolve({
        status,
        url: targetUrl.toString(),
        html,
      })
    })
  })

  request.setTimeout(15000, () => {
    request.destroy(new Error(`Timed out fetching ${url}`))
  })
  request.on('error', reject)
  request.end()
})

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

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasMergerLandingSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return extractTitle(rawHtml) === 'Delhivery X Ecom Express'
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.ecomexpress\.in\/["'][^>]*\/?>/i.test(rawHtml)
    && normalized.includes('Better Together')
    && normalized.includes('Delhivery and Ecom Express Unite to Serve a Growing India.')
    && normalized.includes('Continue to Delhivery')
    && new RegExp(DELHIVERY_CONTINUE_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(rawHtml)
}

const isVerifiedLandingPage = (page = {}) =>
  Number(page.status) === 200
  && hasMergerLandingSignal(page.html)
  && !hasPublicJobsSignal(page.html)

const fetchVerifiedPage = async (
  url,
  fetchPage,
  fetchPageAllowingExpiredCertificateImpl,
) => {
  try {
    return await fetchPage(url)
  } catch (error) {
    if (!isRecoverableCertificateError(error)) {
      throw error
    }

    return fetchPageAllowingExpiredCertificateImpl(url)
  }
}

export const createEcomExpressScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchPageAllowingExpiredCertificate: fetchPageAllowingExpiredCertificateImpl = fetchPageAllowingExpiredCertificate,
  } = {}) {
    const homepage = await fetchVerifiedPage(
      HOMEPAGE_URL,
      fetchPage,
      fetchPageAllowingExpiredCertificateImpl,
    )

    if (!isVerifiedLandingPage(homepage)) {
      throw new Error('Ecom Express verified homepage no longer matches the known merger landing page')
    }

    for (const routeUrl of CHECKED_LANDING_PAGE_URLS.slice(1)) {
      const routePage = await fetchVerifiedPage(
        routeUrl,
        fetchPage,
        fetchPageAllowingExpiredCertificateImpl,
      )

      if (!isVerifiedLandingPage(routePage)) {
        throw new Error(`Ecom Express verified landing page route changed: ${routeUrl}`)
      }
    }

    const robotsPage = await fetchVerifiedPage(
      ROBOTS_TXT_URL,
      fetchPage,
      fetchPageAllowingExpiredCertificateImpl,
    )

    if (!isVerifiedLandingPage(robotsPage)) {
      throw new Error('Ecom Express verified robots.txt changed')
    }

    const sitemapPage = await fetchVerifiedPage(
      SITEMAP_URL,
      fetchPage,
      fetchPageAllowingExpiredCertificateImpl,
    )

    if (!isVerifiedLandingPage(sitemapPage)) {
      throw new Error('Ecom Express verified sitemap changed')
    }

    return []
  },
})

export const run = async (options = {}) => createEcomExpressScraper().run(options)

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
