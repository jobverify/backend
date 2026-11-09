import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { GATI_CATALOG } from './catalog.js'
import { runCurrentGatiInventory } from './nativeInventory.js'
import { hasBrokenDarwinboxTenantSignal as hasBrokenDarwinboxTenantSignalShared } from '../allcargologistics/script.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = GATI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const REDIRECT_HOMEPAGE_URL = 'https://www.allcargologistics.com/'
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const DARWINBOX_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const LEGACY_DARWINBOX_HANDOFF_URL = 'https://gatikwe.darwinbox.in/ms/candidate/careers'
export const LISTING_API_URL = `${PROVIDER_METADATA.darwinboxOrigin}/ms/candidateapi/job/alljobs?companyId=${PROVIDER_METADATA.darwinboxCompanyId}`

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

const defaultProbeListingApi = async (url) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      companyId: PROVIDER_METADATA.darwinboxCompanyId,
      sort_option: 'new',
      limit: 10,
      page: 1,
    }),
  })

  return {
    status: response.status,
    body: await response.text(),
  }
}

export const extractCareersPageUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    try {
      const absoluteUrl = new URL(match[1], REDIRECT_HOMEPAGE_URL).toString()
      if (normalizeUrl(absoluteUrl) === normalizeUrl(CAREERS_PAGE_URL)) {
        return CAREERS_PAGE_URL
      }
    } catch {
      // Ignore malformed URLs and keep scanning for the verified careers handoff.
    }
  }

  return null
}

export const hasOfficialHomepageSignal = ({ status, url, html } = {}) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return Number(status) === 200
    && normalizeUrl(url) === normalizeUrl(REDIRECT_HOMEPAGE_URL)
    && normalized.includes("india's premier express distribution and supply chain solutions")
    && normalized.includes('driven by precision and experience')
    && extractCareersPageUrl(html) === CAREERS_PAGE_URL
}

export const extractOfficialDarwinboxUrl = (html = '') => {
  const match = String(html ?? '').match(
    /https:\/\/(?:allcargologistics\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/home|gatikwe\.darwinbox\.in\/ms\/candidate\/careers)/i,
  )

  return match?.[0] ?? null
}

const countOfficialDarwinboxLinks = (html = '') =>
  String(html ?? '').match(
    /https:\/\/(?:allcargologistics\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/home|gatikwe\.darwinbox\.in\/ms\/candidate\/careers)/gi,
  )?.length ?? 0

export const hasBrokenDarwinboxTenantSignal = (payload) =>
  hasBrokenDarwinboxTenantSignalShared(payload)

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('spotting future logistics leaders, now')
    && [DARWINBOX_HANDOFF_URL, LEGACY_DARWINBOX_HANDOFF_URL].includes(extractOfficialDarwinboxUrl(html))
    && countOfficialDarwinboxLinks(html) >= 2
}

export const createGatiScraper = () => ({
  async run(options = {}) { return runCurrentGatiInventory(options) },
})

export const run = async (options = {}) => createGatiScraper().run(options)

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
