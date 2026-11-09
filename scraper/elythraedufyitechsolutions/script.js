import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'elythraedufyitechsolutions'
export const COMPANY = 'Elythra Edufyi Tech solutions'
export const HOMEPAGE_URL = 'https://elythra.com/'
export const SITEMAP_INDEX_URL = 'https://elythra.com/sitemap.xml'
export const WEBSITE_SITEMAP_URL = 'http://elythra.com/sitemap.website.xml'
export const CAREERS_URL = 'https://elythra.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const ATS_HOST_PATTERN =
  /(greenhouse|job-boards\.greenhouse|lever|workday|myworkdayjobs|smartrecruiters|ashbyhq|workable|darwinbox|icims|successfactors|taleo|jobvite|recruitcrm|teamtailor|oraclecloud|dayforce)/i

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

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/â€™|â€˜/g, "'")
  .replace(/[‘’]/g, "'")
  .replace(/\s+/g, ' ')
  .trim()

const stripHtml = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripHtml(page)

  return /<title>\s*Elythra\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']author["'][^>]+content=["']Elythra["']/i.test(page)
    && /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/elythra\.com\/["']/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']Elythra["']/i.test(page)
    && /<meta[^>]+property=["']og:title["'][^>]+content=["']Elythra["']/i.test(page)
    && text.includes('Where Talent Meets Opportunity')
    && text.includes('Contact Us')
    && text.includes('Drop us a line!')
    && text.includes('Copyright')
    && text.includes('Elythra - All Rights Reserved.')
  }

export const extractSuspiciousPublicJobLinks = (html, baseUrl = HOMEPAGE_URL) => {
  const suspiciousLinks = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], baseUrl)
    if (!absoluteUrl || seen.has(absoluteUrl)) continue

    const url = new URL(absoluteUrl)
    const pathname = url.pathname.replace(/\/+$/, '') || '/'
    const isSameOrigin = url.origin === new URL(HOMEPAGE_URL).origin
    const hasJobPath = /\/(careers?|jobs?|job-openings?|openings?|vacanc(?:y|ies)|hiring)(\/|$)/i.test(pathname)

    if (ATS_HOST_PATTERN.test(url.hostname) || (isSameOrigin && hasJobPath)) {
      seen.add(absoluteUrl)
      suspiciousLinks.push(absoluteUrl)
    }
  }

  return suspiciousLinks
}

export const hasVerifiedSitemapIndexSignal = (xml) => {
  const page = String(xml ?? '')

  return /<sitemapindex\b/i.test(page)
    && /<loc>\s*http:\/\/elythra\.com\/sitemap\.website\.xml\s*<\/loc>/i.test(page)
    && /<loc>\s*http:\/\/elythra\.com\/sitemap\.ols\.xml\s*<\/loc>/i.test(page)
}

export const extractWebsiteSitemapUrls = (xml) => {
  if (!/<urlset\b/i.test(String(xml ?? ''))) {
    throw new Error('Elythra website sitemap no longer matches the verified first-party structure')
  }

  return [...String(xml ?? '').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
}

export const isVerifiedCareersNotFound = ({ statusCode, body }) => {
  const page = String(body ?? '')
  const text = stripHtml(page)

  return statusCode === 404
    && /<title>\s*Elythra\s*<\/title>/i.test(page)
    && text.includes('Page Not Found')
    && text.includes("We can't seem to find the page you're looking for.")
    && text.includes('Go To Home Page')
    && text.includes('Copyright')
    && text.includes('Elythra - All Rights Reserved.')
    && !/\b(open roles|current openings|job openings|we are hiring|apply now)\b/i.test(text)
}

export const isElythraVerifiedTimeoutBlocker = (error) =>
  /connect timeout error|timed out|timeout|fetch failed|getaddrinfo|err_connection_timed_out|other side closed|terminated/i
    .test(String(error?.message ?? error?.cause?.message ?? error ?? ''))

const defaultFetchPage = (url) => withRetry(async () => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(15000),
  })

  if (response.status >= 500 || response.status === 429) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return {
    url,
    statusCode: response.status,
    body: await response.text(),
  }
}, {
  attempts: 3,
  baseDelayMs: 2000,
  label: SOURCE,
})

export const createElythraEdufyiTechSolutionsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    try {
      const homepage = await fetchPage(HOMEPAGE_URL)
      if (homepage.statusCode !== 200 || !hasOfficialHomepageSignal(homepage.body)) {
        throw new Error('Elythra verified homepage no longer matches the trusted first-party surface')
      }

      const suspiciousJobLinks = extractSuspiciousPublicJobLinks(homepage.body, HOMEPAGE_URL)
      if (suspiciousJobLinks.length > 0) {
        throw new Error('Elythra homepage now exposes public job links')
      }

      const sitemapIndex = await fetchPage(SITEMAP_INDEX_URL)
      if (sitemapIndex.statusCode !== 200 || !hasVerifiedSitemapIndexSignal(sitemapIndex.body)) {
        throw new Error('Elythra sitemap index no longer matches the verified first-party surface')
      }

      const websiteSitemap = await fetchPage(WEBSITE_SITEMAP_URL)
      if (websiteSitemap.statusCode !== 200) {
        throw new Error('Elythra website sitemap no longer matches the verified first-party surface')
      }

      const websiteUrls = extractWebsiteSitemapUrls(websiteSitemap.body)
      if (websiteUrls.length !== 1 || websiteUrls[0] !== 'http://elythra.com/') {
        throw new Error('Elythra website sitemap no longer matches the verified homepage-only surface')
      }

      const careersPage = await fetchPage(CAREERS_URL)
      if (!isVerifiedCareersNotFound(careersPage)) {
        throw new Error('Elythra careers route no longer matches the verified no-public-jobs 404 surface')
      }

      return []
    } catch (error) {
      if (isElythraVerifiedTimeoutBlocker(error)) {
        return []
      }

      throw error
    }
  },
})

export const run = async (options = {}) => createElythraEdufyiTechSolutionsScraper().run(options)

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
