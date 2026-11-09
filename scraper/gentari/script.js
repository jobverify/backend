import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { GENTARI_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = GENTARI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const INDIA_HOMEPAGE_URL = PROVIDER_METADATA.indiaHomepageUrl
export const INDIA_CAREERS_URL = PROVIDER_METADATA.indiaCareersUrl
export const LINKEDIN_JOBS_URL = PROVIDER_METADATA.linkedinJobsUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/, '')

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
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
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const extractLinkTargets = (html = '', baseUrl) => {
  const targets = []

  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], baseUrl)
    if (absoluteUrl) {
      targets.push(absoluteUrl)
    }
  }

  return targets
}

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /Gentari/i.test(normalized)
    && /Putting Clean Energy into Action/i.test(normalized)
    && /Take the next step - join a team of passionate Gentarians/i.test(normalized)
    && extractLinkTargets(rawHtml, HOMEPAGE_URL).includes(CAREERS_URL)
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return /Join Gentari/i.test(normalized)
    && /career (paths|opportunities)/i.test(normalized)
    && /clean energy/i.test(normalized)
}

export const hasTrustedLinkedInJobsHandoff = (html = '') =>
  extractLinkTargets(html, CAREERS_URL).includes(LINKEDIN_JOBS_URL)

export const pageExposesFirstPartyJobsSignal = (html = '', baseUrl = CAREERS_URL) =>
  extractLinkTargets(html, baseUrl).some((target) => {
    const normalized = normalizeUrl(target)
    return normalized.startsWith('https://www.gentari.com/jobs/')
      || normalized.startsWith('https://www.gentari.in/jobs/')
      || normalized.startsWith('https://www.gentari.com/job/')
      || normalized.startsWith('https://www.gentari.in/job/')
  })

export const hasOfficialIndiaHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /Gentari India/i.test(normalized)
    && /Powering a Sustainable Future/i.test(normalized)
    && /Take the next step - join a team of passionate Gentarians/i.test(normalized)
    && extractLinkTargets(rawHtml, INDIA_HOMEPAGE_URL).includes(CAREERS_URL)
}

export const isVerifiedIndiaCareersNotFoundRoute = ({ status, url, html } = {}) => {
  if (Number(status) !== 200) return false
  if (normalizeUrl(url) !== 'https://www.gentari.in/404') return false

  const normalized = normalizeWhitespace(html)
  return /Not Found/i.test(normalized)
    && /404-page-not-found\.webp/i.test(String(html ?? ''))
  }

export const createGentariScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Gentari verified global homepage changed materially')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Gentari verified careers surface changed materially')
    }
    if (!hasTrustedLinkedInJobsHandoff(careersPage.html)) {
      throw new Error('Gentari LinkedIn jobs handoff changed materially')
    }
    if (pageExposesFirstPartyJobsSignal(careersPage.html, CAREERS_URL)) {
      throw new Error('Gentari careers page now appears to expose a first-party jobs surface')
    }

    const indiaHomepage = await fetchPage(INDIA_HOMEPAGE_URL)
    if (indiaHomepage.status !== 200 || !hasOfficialIndiaHomepageSignal(indiaHomepage.html)) {
      throw new Error('Gentari verified India homepage changed materially')
    }

    const indiaCareersPage = await fetchPage(INDIA_CAREERS_URL)
    if (!isVerifiedIndiaCareersNotFoundRoute(indiaCareersPage)) {
      throw new Error('Gentari India careers route no longer matches the verified 404 surface')
    }

    return []
  },
})

export const run = async (options = {}) => createGentariScraper().run(options)

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
