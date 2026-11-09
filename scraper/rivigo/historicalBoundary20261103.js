import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createFailClosedSentinelScraper } from '../zwayam/failClosedSentinel.js'
import { RIVIGO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = RIVIGO_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const PARENT_DARWINBOX_URL = PROVIDER_METADATA.officialFirstPartyJobsUrl
export const REDIRECTED_HOMEPAGE_URL = PROVIDER_METADATA.redirectedHomepageUrl
export const PARENT_DARWINBOX_HOME_URL = 'https://nectar.darwinbox.in/ms/candidatev2/main/careers/home'
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': USER_AGENT,
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url || url,
    html: await response.text(),
  }
}

const decodeEntities = (value = '') =>
  String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/[\u2018\u2019]/g, "'")

const normalizeText = (value = '') =>
  decodeEntities(String(value))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const extractTitle = (html = '') =>
  normalizeText(String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')

const extractLinkedUrls = (html = '', pageUrl = CAREERS_URL) => {
  const matches = String(html).matchAll(
    /(?:href|src|action|data-url)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
  )
  const urls = []

  for (const match of matches) {
    const rawValue = match[1] || match[2] || match[3] || ''

    try {
      urls.push(new URL(decodeEntities(rawValue), pageUrl))
    } catch {
      // Ignore malformed URLs and keep the scraper fail-closed.
    }
  }

  return urls
}

export const hasVerifiedRedirectedHomepageSignal = ({ url = '', html = '' } = {}) => {
  const title = extractTitle(html)
  const text = normalizeText(html)

  return String(url).startsWith(REDIRECTED_HOMEPAGE_URL)
    && title === 'B2B Express Services: Fastest Courier & Parcel Deliveries'
    && /\bB2B Express That Delivers/i.test(text)
    && /\bMahindra Logistics\b/i.test(text)
}

export const hasVerifiedParentCareersSignal = ({ url = '', html = '' } = {}) => {
  const title = extractTitle(html)
  const text = normalizeText(html)
  const linkedUrls = extractLinkedUrls(html, url || CAREERS_URL)

  return String(url).startsWith(CAREERS_URL)
    && title === 'Work With Us - Mahindra Logistics'
    && /\bWork With Us: Igniting Mutual Success & Growth\b/i.test(text)
    && linkedUrls.some((linkedUrl) => linkedUrl.toString() === PARENT_DARWINBOX_URL)
}

export const hasVerifiedParentDarwinboxJavascriptShellSignal = ({ url = '', html = '' } = {}) => {
  const page = String(html ?? '')

  return String(url).startsWith(PARENT_DARWINBOX_URL)
    && /<base href="\/ms\/candidate\/">/i.test(page)
    && /<noscript>\s*Please enable Javascript!\s*<\/noscript>/i.test(page)
    && /<app-root\b/i.test(page)
    && /db-components\.esm\.js/i.test(page)
    && /turnstile\/v0\/api\.js/i.test(page)
}

export const hasVerifiedParentDarwinboxSignal = ({ url = '', html = '' } = {}) => {
  const title = extractTitle(html)
  const text = normalizeText(html)

  return hasVerifiedParentDarwinboxJavascriptShellSignal({ url, html })
    || (
      String(url).startsWith(PARENT_DARWINBOX_HOME_URL)
      && title === 'Mahindra Logistics and Subsidiaries'
      && /\bWe Have \d+ Open Jobs\b/i.test(text)
      && /\bOpen Jobs\b/i.test(text)
    )
}

export const createRivigoScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepagePage = await fetchPage(HOMEPAGE_URL)
    if (!hasVerifiedRedirectedHomepageSignal(homepagePage)) {
      throw new Error('Rivigo verified Mahindra Logistics B2B Express landing no longer matches the trusted public surface')
    }

    const parentCareersPage = await fetchPage(CAREERS_URL)
    if (!hasVerifiedParentCareersSignal(parentCareersPage)) {
      throw new Error('Rivigo verified parent-company careers handoff no longer matches the trusted Mahindra Logistics work-with-us surface')
    }

    const parentDarwinboxPage = await fetchPage(PARENT_DARWINBOX_URL)
    if (!hasVerifiedParentDarwinboxSignal(parentDarwinboxPage)) {
      throw new Error('Rivigo verified parent-company Darwinbox board no longer matches the trusted Mahindra Logistics and Subsidiaries surface')
    }

    return createFailClosedSentinelScraper().run()
  },
})

export const run = async (options = {}) => createRivigoScraper().run(options)

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
