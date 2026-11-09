import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PEPPERFRY_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /successfactors/i,
  /oraclecloud/i,
  /icims/i,
  /taleo/i,
]

export const SOURCE = PEPPERFRY_CATALOG.source
export const COMPANY = PEPPERFRY_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = PEPPERFRY_CATALOG.officialBrandName
export const VERIFIED_ON = PEPPERFRY_CATALOG.verifiedOn
export const PROVIDER_METADATA = PEPPERFRY_CATALOG
export const HOMEPAGE_URL = PEPPERFRY_CATALOG.homepageUrl
export const CAREERS_PAGE_URL = PEPPERFRY_CATALOG.companyCareerPage

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)
    const normalizePath = (pathname) => pathname === '/' ? '/' : pathname.replace(/\/+$/g, '')

    return actualUrl.hostname.replace(/^www\./i, '').toLowerCase() === expectedUrl.hostname.replace(/^www\./i, '').toLowerCase()
      && normalizePath(actualUrl.pathname) === normalizePath(expectedUrl.pathname)
      && actualUrl.search === expectedUrl.search
  } catch {
    return false
  }
}

export const pageExposesPublicJobListings = (html = '') =>
  extractCareerListings(html).length > 0
  || PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  const hasCurrentHomepageVariant = normalized.includes('Buy Furniture & Home Decor Online')
    && normalized.includes('Track Your Order')
    && normalized.includes('Find a Store')
    && normalized.includes('Pepperfry in the News')

  const hasLatestHomepageVariant = normalized.includes('Best Furniture & Home Decor Online in India')
    && normalized.includes('Track Your Order')
    && normalized.includes('Find a Store')
    && normalized.includes('Pepperfry in the News')
    && normalized.includes('Sell on pepperfry')

  const hasLegacyHomepageVariant = normalized.includes('Buy Furniture & Home Decor Online')
    && normalized.includes('Browse All Categories')
    && normalized.includes('Partner With Us')
    && normalized.includes('Check Out Bonhomie, Our Blog')

  const hasCommerceHomepageVariant = normalized.includes('Online Furniture Shopping Store')
    && normalized.includes('Online Furniture Shopping Store')
    && normalized.includes('Track Your Order')
    && normalized.includes('Find a Store')
    && normalized.includes('Pepperfry in the News')

  return hasCurrentHomepageVariant || hasLatestHomepageVariant || hasLegacyHomepageVariant || hasCommerceHomepageVariant
}

export const extractVerifiedCareersPageUrl = (html = '') => {
  const match = String(html ?? '').match(
    /https:\/\/www\.pepperfry\.com\/pages\/careers\.html\?type=footer/i,
  )

  return match?.[0] || null
}

export const hasNoPublicCareersFallbackSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  const hasCommerceFallbackVariant = normalized.includes('Online Furniture Shopping Store')
    && normalized.includes('Track Your Order')
    && normalized.includes('Find a Store')
    && normalized.includes('Sell on pepperfry')

  const hasLegacyFallbackVariant = normalized.includes('Online Furniture Shopping Store')
    && normalized.includes('Browse All Categories')
    && normalized.includes('Partner With Us')
    && normalized.includes('Check Out Bonhomie, Our Blog')

  return hasCommerceFallbackVariant || hasLegacyFallbackVariant
}

const normalizeLocation = (value = '') => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean)
  return parts.join(', ') || null
}

const extractCity = (location) => {
  const parts = String(location ?? '').split(',').map((part) => part.trim()).filter(Boolean)
  return parts.length === 1 ? parts[0] : null
}

const buildJobId = (applyUrl) => {
  try {
    return new URL(applyUrl).pathname.split('/').filter(Boolean).pop() || applyUrl
  } catch {
    return applyUrl
  }
}

export const extractCareerListings = (html = '') => [...String(html ?? '').matchAll(
  /<span[^>]*class=["'][^"']*crpg-opn-listitem-ttl[^"']*["'][^>]*>([\s\S]*?)<\/span>[\s\S]*?<span[^>]*class=["'][^"']*crpg-opn-listitem-location[^"']*["'][^>]*>([\s\S]*?)<\/span>[\s\S]*?<a[^>]*href=["'](https:\/\/trendsys\.darwinbox\.in\/ms\/candidate\/careers\/[^"']+)["'][^>]*>/gi,
)].map((match) => ({
  title: normalizeWhitespace(match[1]),
  location: normalizeLocation(match[2]),
  applyUrl: match[3],
})).filter((listing) => listing.title && listing.location && listing.applyUrl)

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

export const createPepperfryScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      Number(homepage.status) !== 200
      || !matchesExpectedUrl(homepage.url, HOMEPAGE_URL)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Pepperfry verified official homepage changed materially')
    }

    const verifiedCareersPageUrl = extractVerifiedCareersPageUrl(homepage.html)
    if (!matchesExpectedUrl(verifiedCareersPageUrl, CAREERS_PAGE_URL)) {
      throw new Error('Pepperfry verified homepage careers handoff changed materially')
    }

    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    const listings = extractCareerListings(careersPage.html)
    if (
      Number(careersPage.status) !== 200
      || !matchesExpectedUrl(careersPage.url, CAREERS_PAGE_URL)
      || listings.length === 0
    ) {
      throw new Error('Pepperfry verified first-party careers listings changed materially')
    }

    return listings.map((listing) => {
      const location = `${listing.location}, India`

      return {
        title: listing.title,
        company: COMPANY,
        department: null,
        location,
        city: extractCity(listing.location),
        country: 'India',
        jobId: buildJobId(listing.applyUrl),
        requisitionId: buildJobId(listing.applyUrl),
        sourceUrl: listing.applyUrl,
        applyUrl: listing.applyUrl,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: `Pepperfry current openings listing. Location: ${listing.location}. Apply via Darwinbox.`,
        publicExperienceChecked: true,
        remoteStatus: 'On-site',
      }
    })
  },
})

export const run = async (options = {}) => createPepperfryScraper().run(options)

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
