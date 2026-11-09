import path from 'node:path'
import { fileURLToPath } from 'node:url'

import provider from './provider.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bview job\b/i,
  /\bjoin our team\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return response.text()
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    html: await response.text(),
    text: null,
  }
}

const asText = (value = {}) => String(value?.text ?? value?.html ?? '')

const isTransportTimeoutError = (error) =>
  /connect timeout error|timed out|timeout:/i.test(String(error?.message ?? error ?? ''))

const isBlockedResult = (result = {}) => {
  const status = Number(result?.status)
  const errorText = String(result?.error ?? '')
  const bodyText = asText(result).toLowerCase()

  return result?.ok === false
    || status === 403
    || status === 404
    || status === 429
    || status === 522
    || /forbidden|access denied|ssl|tls secure channel|blocked/i.test(errorText)
    || bodyText === 'forbidden'
    || bodyText.includes('access denied')
    || bodyText.includes('forbidden')
}

export const PROVIDER_METADATA = provider
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const OFFICIAL_BRAND_NAME = provider.officialBrandName
export const HOMEPAGE_URL = provider.homepageUrl
export const CONTACT_URL = provider.contactPageUrl
export const BLOCKED_ROUTE_URLS = [...provider.blockedRouteUrls]

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Ivy Comptech - Leading Solutions for the Online Gaming Industry\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Ivy Comptech')
    && normalized.includes('Ivy is a beacon for open-minded, curious people.')
    && normalized.includes('Are you ready to shine?')
}

export const hasOfficialContactSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Contact - Ivy Comptech\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Ivy Comptech Private Limited')
    && normalized.includes('Ivy Software Development Services Private Limited')
    && normalized.includes('Ivy Global Shared Services Private Limited')
    && normalized.includes('Ivy Mobitech Services Private Limited')
}

export const createBlockedSurfaceScraper = (providerMetadata) => {
  const homepageUrl = providerMetadata.homepageUrl
  const contactUrl = providerMetadata.contactPageUrl
  const blockedRouteUrls = [...providerMetadata.blockedRouteUrls]

  return {
    async run({
      fetchText = defaultFetchText,
      probeUrl,
      fetchBrowserText,
      fetchBrowserPage,
    } = {}) {
      let homepageHtml = null
      let contactHtml = null
      let shouldUseBrowserPageFallback = false

      try {
        homepageHtml = await fetchText(homepageUrl)
        contactHtml = await fetchText(contactUrl)
      } catch (error) {
        if (isTransportTimeoutError(error)) {
          return []
        }

        shouldUseBrowserPageFallback = true

        if (fetchBrowserText) {
          try {
            homepageHtml = await fetchBrowserText(homepageUrl)
          } catch {
            homepageHtml = null
          }

          try {
            contactHtml = await fetchBrowserText(contactUrl)
          } catch {
            contactHtml = null
          }
        }
      }

      if (homepageHtml != null && !hasOfficialHomepageSignal(homepageHtml)) {
        throw new Error(`${providerMetadata.officialBrandName} verified homepage no longer matches the trusted surface`)
      }

      if (contactHtml != null && !hasOfficialContactSignal(contactHtml)) {
        throw new Error(`${providerMetadata.officialBrandName} verified contact page no longer matches the trusted surface`)
      }

      for (const url of blockedRouteUrls) {
        const result = probeUrl
          ? await probeUrl(url)
          : shouldUseBrowserPageFallback && fetchBrowserPage
            ? await fetchBrowserPage(url)
            : await defaultFetchPage(url)

        if (hasPublicJobsSignal(asText(result))) {
          throw new Error(`${providerMetadata.officialBrandName} blocked surface now exposes public job listings`)
        }

        if (!isBlockedResult(result)) {
          throw new Error(`${providerMetadata.officialBrandName} blocked route changed materially: ${url}`)
        }
      }

      return []
    },
  }
}

export const createIvyScraper = () => createBlockedSurfaceScraper(PROVIDER_METADATA)

export const run = async (options = {}) => createIvyScraper().run(options)

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
