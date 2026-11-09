import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SMARTSTREAM_TECHNOLOGIES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const PUBLIC_JOBS_LINK_PATTERN =
  /(jobs?\.jobvite\.com|boards?\.greenhouse\.io|job-boards\.greenhouse\.io|jobs\.lever\.co|ashbyhq\.com|myworkdayjobs|workdayjobs|smartrecruiters|workable\.com|recruitee|darwinbox|breezy\.hr)/i

const getPageHtml = (page = {}) => String(page.html ?? page.body ?? '')

const getFinalUrl = (page, fallbackUrl) => page?.url || page?.finalUrl || fallbackUrl

const getHeader = (page = {}, name) => {
  const normalizedName = String(name ?? '').toLowerCase()
  const headers = page?.headers
  if (!headers) return ''
  if (typeof headers.get === 'function') {
    return String(headers.get(normalizedName) || headers.get(name) || '')
  }
  return String(headers[normalizedName] || headers[name] || '')
}

export const hasForbiddenShellSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*Error 403 Forbidden\s*<\/title>/i.test(page)
    && text.includes('403 Forbidden')
}

export const hasPublicJobsCatalogSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /Job Title:/i.test(text)
    || /Location:/i.test(text)
    || /Experience:/i.test(text)
    || PUBLIC_JOBS_LINK_PATTERN.test(page)
}

export const isVerifiedCloudflareBlockedPage = (page = {}, requestedUrl) => {
  const html = getPageHtml(page)

  return Number(page.status) === 403
    && getFinalUrl(page, requestedUrl) === requestedUrl
    && /cloudflare/i.test(getHeader(page, 'server'))
    && getHeader(page, 'cf-ray').trim().length > 0
    && hasForbiddenShellSignal(html)
    && !hasPublicJobsCatalogSignal(html)
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })

  return {
    status: response.status,
    url: response.url || url,
    headers: Object.fromEntries(response.headers.entries()),
    html: await response.text(),
  }
}

export const createSmartStreamTechnologiesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (!isVerifiedCloudflareBlockedPage(homepage, HOMEPAGE_URL)) {
      throw new Error('SmartStream Technologies homepage no longer matches the verified Cloudflare-blocked first-party state')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    const careersHtml = getPageHtml(careersPage)
    if (hasPublicJobsCatalogSignal(careersHtml)) {
      throw new Error('SmartStream Technologies careers route now appears to expose a public jobs catalog')
    }

    if (!isVerifiedCloudflareBlockedPage(careersPage, CAREERS_URL)) {
      throw new Error('SmartStream Technologies careers route no longer matches the verified Cloudflare-blocked first-party state')
    }

    return []
  },
})

export const run = async (options = {}) => createSmartStreamTechnologiesScraper().run(options)

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
