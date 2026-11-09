import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { INDWEALTH_CATALOG } from './catalog.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = INDWEALTH_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const OFFICIAL_REDIRECT_SOURCE_URL = PROVIDER_METADATA.officialRedirectSourceUrl
export const OFFICIAL_BRAND_HOMEPAGE_URL = PROVIDER_METADATA.officialBrandHomepageUrl
export const OFFICIAL_ABOUT_URL = PROVIDER_METADATA.officialAboutUrl
export const LINKEDIN_COMPANY_JOBS_URL = PROVIDER_METADATA.linkedinCompanyJobsUrl
export const LINKEDIN_COMPANY_PAGE_URL = PROVIDER_METADATA.linkedinCompanyPageUrl
export const LINKEDIN_PUBLIC_JOBS_URL = PROVIDER_METADATA.publicLinkedInJobsUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(value)
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = OFFICIAL_ABOUT_URL) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const extractTitleText = (html) => normalizeWhitespace(
  /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(html ?? ''))?.[1] || null,
)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full_time' || normalized === 'full time') return 'Full-time'
  if (normalized === 'part_time' || normalized === 'part time') return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('intern')) return 'Internship'
  return normalizeWhitespace(value)
}

const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/, '')

const parseLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const city = parts[0] || null
  const country = parts.at(-1) === 'India' ? 'India' : parts.at(-1) || null

  return {
    location: normalized,
    city,
    country,
  }
}

const parseJobPostingJsonLd = (html) => {
  const scripts = [...String(html ?? '').matchAll(
    /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/gi,
  )]

  for (const [, rawJson] of scripts) {
    try {
      const parsed = JSON.parse(rawJson)
      if (parsed?.['@type'] === 'JobPosting') return parsed
    } catch {
      // Skip malformed JSON-LD payloads until the public JobPosting blob is found.
    }
  }

  return null
}

const isVerifiedLinkedInCompanyPageUrl = (value) => {
  try {
    const url = new URL(value)
    return /(^|\.)linkedin\.com$/i.test(url.hostname)
      && /^\/company\/indmoney\/?$/i.test(url.pathname)
  } catch {
    return false
  }
}

export const hasVerifiedRedirectHomepageSignal = ({ url, html } = {}) => {
  if (normalizeUrl(url) !== normalizeUrl(OFFICIAL_BRAND_HOMEPAGE_URL)) return false

  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)?.toLowerCase() || ''
  const title = extractTitleText(rawHtml)?.toLowerCase() || ''

  return title.includes('indmoney: online trading & investing app for indian & us markets')
    && normalized.includes('trade & invest in indian & us markets from one app')
    && normalized.includes('about us')
    && normalized.includes('blog')
    && normalized.includes('learn')
    && normalized.includes('customer service')
    && normalized.includes('fraud awareness')
    && normalized.includes('sitemap')
}

const normalizeLinkedInCompanyJobsUrl = (value) => {
  const absoluteUrl = toAbsoluteUrl(value, OFFICIAL_ABOUT_URL)
  if (!absoluteUrl) return null

  try {
    const url = new URL(absoluteUrl)
    const hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    if (hostname !== 'linkedin.com' && hostname !== 'in.linkedin.com') return null

    if (/^\/company\/indmoney\/jobs\/?$/i.test(url.pathname)) {
      return LINKEDIN_COMPANY_JOBS_URL
    }

    if (/^\/authwall\/?$/i.test(url.pathname)) {
      const redirected = url.searchParams.get('sessionRedirect')
      return redirected ? normalizeLinkedInCompanyJobsUrl(redirected) : null
    }
  } catch {
    return null
  }

  return null
}

export const extractLinkedInCompanyJobsUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
    const normalizedUrl = normalizeLinkedInCompanyJobsUrl(match[1])
    if (normalizedUrl) return normalizedUrl
  }

  return null
}

export const hasVerifiedAboutPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)?.toLowerCase() || ''

  return normalized.includes('our company')
    && normalized.includes('super finance app')
    && normalized.includes('join us')
    && normalized.includes('join our team')
}

export const hasVerifiedLinkedInCompanySignal = ({ url, html } = {}) => {
  if (!isVerifiedLinkedInCompanyPageUrl(url)) return false

  const normalized = normalizeWhitespace(html)?.toLowerCase() || ''

  return normalized.includes('indmoney')
    && normalized.includes('financial services')
    && (normalized.includes('invest in india and us markets from one app')
      || (normalized.includes('global investment and trading app')
        && normalized.includes('trade across us, india and the world from india')
        && normalized.includes('manage your networth - in one place')))
    && normalized.includes('https://www.indmoney.com')
    && /(gurgaon|gurugram), haryana/.test(normalized)
}

export const hasPublicLinkedInJobsSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)?.toLowerCase() || ''

  return /<title>\s*\d+\s*Indmoney jobs in India\s*<\/title>/i.test(rawHtml)
    && normalized.includes('indmoney jobs in india')
    && /job-search-card/i.test(rawHtml)
    && normalized.includes('indmoney')
}

export const extractSearchResults = (html) => {
  const page = String(html ?? '')
  const cards = [...page.matchAll(/<div class="base-card[^"<]*\bjob-search-card"[^>]*>/gi)]
  return cards.map((card, index) => {
    // Bound extraction to this card; incomplete cards cannot borrow another employer's fields.
    const section = page.slice(card.index, cards[index + 1]?.index ?? page.length)
    const jobId = card[0].match(/data-entity-urn="urn:li:jobPosting:([0-9]+)"/i)?.[1]
    const sourceUrl = toAbsoluteUrl(section.match(/<a class="base-card__full-link[^"<]*" href="([^"]+)"/i)?.[1]?.replace(/&amp;/g, '&'))
    const title = stripTags(section.match(/<h3 class="base-search-card__title">\s*([\s\S]*?)\s*<\/h3>/i)?.[1])
    const companyBlock = section.match(/<h4 class="base-search-card__subtitle">([\s\S]*?)<\/h4>/i)?.[1]
    const company = stripTags(companyBlock?.match(/<a[^>]*>\s*([\s\S]*?)\s*<\/a>/i)?.[1])
    const locationData = parseLocation(stripTags(section.match(/<span class="job-search-card__location">\s*([\s\S]*?)\s*<\/span>/i)?.[1]))
    const postingDate = section.match(/<time class="job-search-card__listdate(?:--new)?" datetime="([^"]+)"/i)?.[1]
    let verifiedSourceUrl = false
    try {
      const url = new URL(sourceUrl)
      verifiedSourceUrl = /(^|\.)linkedin\.com$/i.test(url.hostname) && /^\/jobs\/view\//i.test(url.pathname)
    } catch { /* An incomplete card is discarded below. */ }
    if (!title || !jobId || !verifiedSourceUrl || !postingDate || locationData.country !== 'India'
      || normalizeWhitespace(company)?.toLowerCase() !== OFFICIAL_BRAND_NAME.toLowerCase()) return null
    return {
      title, company, department: null, location: locationData.location, city: locationData.city,
      country: locationData.country, jobId, requisitionId: jobId, sourceUrl, applyUrl: sourceUrl,
      employmentType: null, experienceRequired: null, minimumQualification: null,
      preferredQualification: null, requiredSkills: [], postingDate: normalizeWhitespace(postingDate),
      closingDate: null, jobDescription: null,
    }
  }).filter(Boolean)
}

export const extractJobDetail = (html) => {
  const jobPosting = parseJobPostingJsonLd(html)
  if (!jobPosting) return {}

  const address = jobPosting?.jobLocation?.address || {}
  const country = address.addressCountry === 'IN'
    ? 'India'
    : normalizeWhitespace(address.addressCountry)
  const parts = [
    normalizeWhitespace(address.addressLocality),
    normalizeWhitespace(address.addressRegion),
    country,
  ].filter(Boolean)

  return {
    title: normalizeWhitespace(jobPosting?.title) || null,
    company: normalizeWhitespace(jobPosting?.hiringOrganization?.name) || null,
    location: parts.join(', ') || null,
    city: normalizeWhitespace(address.addressLocality),
    country,
    employmentType: normalizeEmploymentType(jobPosting?.employmentType),
    postingDate: normalizeWhitespace(jobPosting?.datePosted)?.slice(0, 10) || null,
    jobDescription: stripTags(jobPosting?.description) || null,
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

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 1,
  label: 'indwealth-html',
  timeoutMs: 15000,
})

export const hasCloudflareChallengePageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)?.toLowerCase() || ''

  return /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(rawHtml)
    && normalized.includes('enable javascript and cookies to continue')
    && (
      normalized.includes('security verification')
      || normalized.includes('cloudflare')
      || /\bindmoney\.com\b/i.test(rawHtml)
      || /\bindwealth\.in\b/i.test(rawHtml)
    )
}

const isVerifiedBlockedRedirectSurface = ({ status, url, html } = {}) =>
  Number(status) === 403
  && normalizeUrl(url) === normalizeUrl(OFFICIAL_BRAND_HOMEPAGE_URL)
  && hasCloudflareChallengePageSignal(html)

const isVerifiedBlockedAboutSurface = ({ status, url, html } = {}) =>
  Number(status) === 403
  && normalizeUrl(url) === normalizeUrl(OFFICIAL_ABOUT_URL)
  && hasCloudflareChallengePageSignal(html)

const shouldIgnoreLinkedInDetailError = (error) =>
  /HTTP 429\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const createIndwealthScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const fetchVerifiedPage = async (url) => {
      try {
        return await fetchPage(url)
      } catch (error) {
        throw new Error(`INDwealth API-only migration could not fetch ${url}: ${error.message}`)
      }
    }

    const fetchApiOnlyText = async (url) => {
      try {
        return await fetchText(url)
      } catch (error) {
        throw new Error(`INDwealth API-only migration could not fetch ${url}: ${error.message}`)
      }
    }

      const homepage = await fetchVerifiedPage(OFFICIAL_REDIRECT_SOURCE_URL)
      const hasVerifiedAccessibleRedirectSurface =
        homepage.status === 200 && hasVerifiedRedirectHomepageSignal(homepage)
      const hasVerifiedBlockedRedirect =
        isVerifiedBlockedRedirectSurface(homepage)

      if (!hasVerifiedAccessibleRedirectSurface && !hasVerifiedBlockedRedirect) {
        throw new Error('The official INDwealth redirect no longer matches the verified INDmoney homepage surface')
      }

      const aboutPage = await fetchVerifiedPage(OFFICIAL_ABOUT_URL)
      const hasVerifiedAccessibleAboutPage =
        aboutPage.status === 200 && hasVerifiedAboutPageSignal(aboutPage.html)
      const hasVerifiedBlockedAboutPage =
        isVerifiedBlockedAboutSurface(aboutPage)

      if (!hasVerifiedAccessibleAboutPage && !hasVerifiedBlockedAboutPage) {
        throw new Error('The official INDmoney about page no longer matches the verified public surface')
      }

      if (
        hasVerifiedAccessibleAboutPage
        && normalizeUrl(extractLinkedInCompanyJobsUrl(aboutPage.html)) !== normalizeUrl(LINKEDIN_COMPANY_JOBS_URL)
      ) {
        throw new Error('The official INDmoney about-page LinkedIn handoff changed materially')
      }

      const linkedInCompanyPage = await fetchVerifiedPage(LINKEDIN_COMPANY_JOBS_URL)
      if (hasCloudflareChallengePageSignal(linkedInCompanyPage.html)) {
        throw new Error(`INDwealth API-only migration could not fetch ${LINKEDIN_COMPANY_JOBS_URL}: Cloudflare challenge`)
      }
      if (linkedInCompanyPage.status !== 200 || !hasVerifiedLinkedInCompanySignal(linkedInCompanyPage)) {
        throw new Error('The verified LinkedIn company page changed materially')
      }

      const listingsHtml = await fetchApiOnlyText(LINKEDIN_PUBLIC_JOBS_URL)
      const listings = extractSearchResults(listingsHtml)
      if (!hasPublicLinkedInJobsSignal(listingsHtml) && listings.length === 0) {
        throw new Error('The public INDmoney LinkedIn jobs surface changed materially')
      }

      const selectedJobs = maxJobs ? listings.slice(0, maxJobs) : listings
      const enrichedJobs = []
      const shouldFetchLinkedInDetails = fetchText !== defaultFetchText

      for (const listing of selectedJobs) {
        let detail = {}

        if (shouldFetchLinkedInDetails) {
          try {
            detail = extractJobDetail(await fetchApiOnlyText(listing.sourceUrl))
          } catch (error) {
            if (!shouldIgnoreLinkedInDetailError(error)) {
              throw error
            }
          }
        }

        enrichedJobs.push({
          ...listing,
          ...Object.fromEntries(
            Object.entries(detail).filter(([, value]) => value != null),
          ),
        })
      }

      return enrichedJobs.map((job) => ({
        ...job,
        source: SOURCE,
        sourceListingComplete: false,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      }))
  },
})

export const run = async (options = {}) => createIndwealthScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
