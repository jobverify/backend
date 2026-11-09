import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { APTECH_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = APTECH_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_API_URL = PROVIDER_METADATA.careersApiUrl
export const SITEMAP_URL = PROVIDER_METADATA.sitemapUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const SHELL_TITLE = 'Aptech Limited | Pioneer in the non-formal vocational training business'
const CAREERS_ROUTE_PATH = '/careers-with-aptech'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#8211;|&#x2013;|&ndash;/gi, '-')
  .replace(/&#8212;|&#x2014;|&mdash;/gi, '-')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|section|article|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const sameUrl = (left, right) => normalizeComparableUrl(left) === normalizeComparableUrl(right)

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(String(value ?? ''), baseUrl).toString()
  } catch {
    return null
  }
}

const formatIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /\bIndia\b/i.test(normalized) ? normalized : `${normalized}, India`
}

const firstCityFromLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return normalizeWhitespace(normalized.split(',')[0])
}

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
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

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
      Origin: 'https://www.aptech-worldwide.com',
      Referer: CAREERS_URL,
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    json: await response.json(),
  }
}

const buildSectionText = (label, value) => {
  const normalized = stripTags(value)
  return normalized ? `${label}: ${normalized}` : null
}

export const hasOfficialShellSignal = (html = '') => {
  const rawHtml = String(html ?? '')

  return extractTitle(rawHtml) === SHELL_TITLE
    && /<div id=["']root["']><\/div>/i.test(rawHtml)
    && /<script defer=["']defer["'] src=["'][^"']*main\.[^"']+\.js["']/i.test(rawHtml)
}

export const extractMainBundleUrl = (html = '', baseUrl = HOMEPAGE_URL) => {
  const match = String(html ?? '').match(
    /<script defer=["']defer["'] src=["']([^"']*main\.[^"']+\.js)["']/i,
  )

  return match?.[1] ? toAbsoluteUrl(match[1], baseUrl) : null
}

export const hasCareersRouteInSitemap = (xml = '') =>
  /https:\/\/www\.aptech-worldwide\.com\/careers-with-aptech(?:\/|<|\?|#|$)/i.test(String(xml ?? ''))

export const extractCareersApiUrl = (bundleJs = '') => {
  const source = String(bundleJs ?? '')
  const fullMatch = source.match(/https:\/\/api\.aptech-worldwide\.com\/careers\/getlist/i)
  if (fullMatch?.[0]) return fullMatch[0]

  const concatenatedMatch = source.match(
    /"https:\/\/api\.aptech-worldwide\.com"\s*,\s*"\/careers\/getlist"/i,
  )
  return concatenatedMatch ? CAREERS_API_URL : null
}

export const hasCareersBundleSignal = (bundleJs = '') => {
  const source = String(bundleJs ?? '')

  return source.includes(CAREERS_ROUTE_PATH)
    && source.includes('Careers with Aptech')
    && source.includes('Aptech is always looking for talented people.')
    && source.includes('No vacancies available')
    && extractCareersApiUrl(source) === CAREERS_API_URL
  }

export const buildApplyUrl = (email, title) => {
  const normalizedEmail = normalizeWhitespace(email)
  const normalizedTitle = normalizeWhitespace(title)

  if (!normalizedEmail || !normalizedTitle) return null

  return `mailto:${normalizedEmail}?subject=${encodeURIComponent(`Ref: Application for ${normalizedTitle}`)}`
}

export const extractCareerListings = (payload = {}) => {
  const careers = Array.isArray(payload?.Careers) ? payload.Careers : []

  return careers
    .filter((item) => Number(item?.status) === 1)
    .map((item) => {
      const title = normalizeWhitespace(item?.title)
      const location = formatIndiaLocation(item?.location)
      const applyTo = normalizeWhitespace(item?.apply_to)
      const postingDate = normalizeWhitespace(item?.publish_date)?.slice(0, 10) || null
      const careerId = item?.careerId != null ? String(item.careerId) : null
      const jobDescription = [
        buildSectionText('Brief Job Description', item?.brief_job_description),
        buildSectionText('Desired Candidate Profile', item?.desired_candidate_profile),
        buildSectionText('Required Skill Set', item?.required_skill_set),
        buildSectionText('Soft Skills', item?.soft_skills),
      ].filter(Boolean).join(' ') || null

      if (!title || !location || !applyTo || !careerId || !postingDate || !jobDescription) {
        return null
      }

      return {
        careerId,
        title,
        location,
        city: firstCityFromLocation(item?.location),
        country: 'India',
        applyTo,
        applyUrl: buildApplyUrl(applyTo, title),
        postingDate,
        jobDescription,
        sourceUrl: CAREERS_URL,
      }
    })
    .filter(Boolean)
}

const hasValidCareerRecordShape = (item) =>
  item != null
  && typeof item === 'object'
  && item.careerId != null
  && normalizeWhitespace(item.title) != null
  && normalizeWhitespace(item.location) != null
  && normalizeWhitespace(item.apply_to) != null
  && normalizeWhitespace(item.publish_date) != null
  && item.status != null

export const createAptechScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || !sameUrl(homepage.url, HOMEPAGE_URL)
      || !hasOfficialShellSignal(homepage.html)
    ) {
      throw new Error('Aptech verified homepage shell no longer matches the trusted first-party surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (
      careersPage.status !== 200
      || !sameUrl(careersPage.url, CAREERS_URL)
      || !hasOfficialShellSignal(careersPage.html)
    ) {
      throw new Error('Aptech verified careers route no longer matches the trusted first-party surface')
    }

    const sitemapPage = await fetchPage(SITEMAP_URL)
    if (
      sitemapPage.status !== 200
      || !hasCareersRouteInSitemap(sitemapPage.html)
    ) {
      throw new Error('Aptech verified sitemap no longer advertises the trusted careers route')
    }

    const mainBundleUrl = extractMainBundleUrl(careersPage.html, careersPage.url)
    if (!mainBundleUrl) {
      throw new Error('Aptech verified careers shell no longer exposes the main bundle handoff')
    }

    const bundlePage = await fetchPage(mainBundleUrl)
    if (
      bundlePage.status !== 200
      || !hasCareersBundleSignal(bundlePage.html)
      || extractCareersApiUrl(bundlePage.html) !== CAREERS_API_URL
    ) {
      throw new Error('Aptech verified careers bundle no longer matches the trusted first-party handoff')
    }

    const careersApi = await fetchJson(CAREERS_API_URL)
    const rawCareers = Array.isArray(careersApi.json?.Careers) ? careersApi.json.Careers : null
    const listings = extractCareerListings(careersApi.json)

    if (
      careersApi.status !== 200
      || !sameUrl(careersApi.url, CAREERS_API_URL)
      || !rawCareers
      || rawCareers.some((item) => !hasValidCareerRecordShape(item))
      || rawCareers.filter((item) => Number(item?.status) === 1).length !== listings.length
    ) {
      throw new Error('Aptech verified careers API no longer matches the trusted first-party public jobs surface')
    }

    return listings.map((job) => ({
      title: job.title,
      company: COMPANY,
      department: null,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.careerId,
      requisitionId: job.careerId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: job.postingDate,
      closingDate: null,
      jobDescription: job.jobDescription,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createAptechScraper(options).run(options)

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
