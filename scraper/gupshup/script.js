import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { GUPSHUP_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000
const PUBLIC_JOBS_SURFACE_PATTERN =
  /\b(apply now|search jobs|current openings|open positions|jobs\.lever\.co|greenhouse|workday|darwinbox|ashby|jobvite|smartrecruiters|recruitee)\b/i

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const ABOUT_US_URL = PROVIDER_METADATA.aboutUsUrl
export const WHATSAPP_HANDOFF_URL = PROVIDER_METADATA.officialCareersHandoffUrl
export const BUSINESS_CONTACT_EMAIL = PROVIDER_METADATA.businessContactEmail

const stripTags = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => stripTags(value)
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrlish = (value) => String(value ?? '')
  .replace(/&#038;|&amp;/gi, '&')
  .trim()

const extractTitle = (html = '') => normalizeWhitespace(
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
)

const matchesExpectedHandoffUrl = (actual, expected) => {
  try {
    const actualUrl = new URL(normalizeUrlish(actual))
    const expectedUrl = new URL(normalizeUrlish(expected))

    if (
      actualUrl.origin !== expectedUrl.origin
      || actualUrl.pathname.replace(/\/+$/, '') !== expectedUrl.pathname.replace(/\/+$/, '')
    ) {
      return false
    }

    const serializeParams = (url) => (
      [...url.searchParams.entries()]
        .sort(([leftKey, leftValue], [rightKey, rightValue]) => (
          leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue)
        ))
        .map(([key, value]) => `${key}=${value}`)
        .join('&')
    )

    return serializeParams(actualUrl) === serializeParams(expectedUrl)
  } catch {
    return false
  }
}

const defaultFetchPage = async (url) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
    }
  } catch (error) {
    clearTimeout(timeout)
    throw error
  }
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)
  const title = extractTitle(page)

  return title.startsWith('Careers at Gupshup')
    && text.includes('Join Gupshup')
    && text.includes('Your Next Career Move Is Just a Message Away')
    && text.includes('Explore Opportunities')
    && text.includes('sales@gupshup.ai')
}

export const hasOfficialAboutPageSignal = (html = '') => {
  const text = normalizeWhitespace(html)

  return text.includes('Born in India')
    && text.includes('900 Strong global team')
    && text.includes('12 Global offices')
    && text.includes('India Offices')
}

export const extractWhatsAppHandoffUrl = (html = '') => {
  const match = String(html ?? '').match(/https:\/\/api\.whatsapp\.com\/send\?[^"' <]+/i)
  return match ? normalizeUrlish(match[0]) : null
}

export const pageExposesPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SURFACE_PATTERN.test(String(html ?? ''))
  || PUBLIC_JOBS_SURFACE_PATTERN.test(normalizeWhitespace(html))

export const createGupshupScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage?.status !== 200 || !hasOfficialCareersPageSignal(careersPage?.html)) {
      throw new Error('Gupshup verified careers page no longer matches the trusted first-party surface')
    }

    const handoffUrl = extractWhatsAppHandoffUrl(careersPage?.html)

    if (!matchesExpectedHandoffUrl(handoffUrl, WHATSAPP_HANDOFF_URL)) {
      const combinedSignals = `${String(careersPage?.html ?? '')} ${normalizeUrlish(handoffUrl)}`

      if (PUBLIC_JOBS_SURFACE_PATTERN.test(combinedSignals)) {
        throw new Error('Gupshup public jobs surface now appears on the verified careers page')
      }

      throw new Error('Gupshup verified careers handoff no longer matches the trusted WhatsApp flow')
    }

    const aboutPage = await fetchPage(ABOUT_US_URL)

    if (aboutPage?.status !== 200 || !hasOfficialAboutPageSignal(aboutPage?.html)) {
      throw new Error('Gupshup verified about page no longer matches the trusted first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createGupshupScraper().run(options)

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
