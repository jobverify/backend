import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { BELZABAR_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = BELZABAR_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const HOMEPAGE_LINKED_CAREERS_URL = PROVIDER_METADATA.homepageLinkedCareersUrl
export const CANONICAL_CAREERS_URL = PROVIDER_METADATA.canonicalCareersUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTagsToText = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const absoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const extractAll = (pattern, value, transform = (match) => match[1]) => [...String(value ?? '').matchAll(pattern)]
  .map((match) => transform(match))
  .filter((item) => item != null)

const uniqueStrings = (values) => {
  const seen = new Set()
  const output = []

  for (const value of values) {
    const normalized = normalizeWhitespace(value)
    if (!normalized || seen.has(normalized)) continue

    seen.add(normalized)
    output.push(normalized)
  }

  return output
}

const extractMetaField = (html, label) => {
  const inlinePattern = new RegExp(
    `<strong>\\s*${escapeRegExp(label)}\\s*:?\\s*([^<]*)<\\/strong>\\s*([^<]*?)(?=<br\\s*\\/?>|<\\/p>)`,
    'i',
  )
  const inlineValue = extractFirst(
    inlinePattern,
    html,
    (match) => normalizeWhitespace(`${match[1]}${match[2]}`),
  )

  if (inlineValue) return inlineValue

  const pattern = new RegExp(
    `<strong>\\s*${escapeRegExp(label)}\\s*:?\\s*<\\/strong>\\s*([\\s\\S]*?)(?:<br\\s*\\/?>\\s*<strong>|<\\/p>)`,
    'i',
  )

  return normalizeWhitespace(extractFirst(pattern, html))
}

const extractBulletsAfterHeading = (html, heading) => {
  const pattern = new RegExp(
    `<strong>\\s*${escapeRegExp(heading)}\\s*:?\\s*<\\/strong>\\s*<\\/p>\\s*<ul>([\\s\\S]*?)<\\/ul>`,
    'i',
  )
  const sectionHtml = extractFirst(pattern, html)

  return uniqueStrings(
    extractAll(/<li[^>]*>([\s\S]*?)<\/li>/gi, sectionHtml, (match) => stripTagsToText(match[1])),
  )
}

const buildLocation = (value) => {
  const city = normalizeWhitespace(value)
  if (!city) return null

  return {
    city,
    country: 'India',
    location: `${city}, India`,
  }
}

const buildJobDescription = ({ requirementBullets, responsibilityBullets }) => {
  const lines = []

  if (requirementBullets.length) {
    lines.push('Requirements')
    for (const bullet of requirementBullets) {
      lines.push(`- ${bullet}`)
    }
  }

  if (responsibilityBullets.length) {
    if (lines.length) lines.push('')
    lines.push('Responsibilities')
    for (const bullet of responsibilityBullets) {
      lines.push(`- ${bullet}`)
    }
  }

  return lines.join('\n')
}

export const extractHomepageCareersUrl = (html = '') => {
  const hrefs = extractAll(
    /href=["']([^"']+)["']/gi,
    html,
    (match) => absoluteUrl(match[1]),
  )

  return hrefs.find((href) => href === HOMEPAGE_LINKED_CAREERS_URL) || null
}

export const hasOfficialHomepageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''
  const hasTrustedBrandShell = /data-wf-domain=["']web\.belzabar\.com["']/i.test(rawHtml)
    || /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/www\.belzabar\.com\/?["']/i.test(rawHtml)

  return /<title>\s*Belzabar Software\s*<\/title>/i.test(rawHtml)
    && (
      normalized.includes('Belzabar Software assists prominent and innovative companies')
      || hasTrustedBrandShell
    )
    && extractHomepageCareersUrl(rawHtml) === HOMEPAGE_LINKED_CAREERS_URL
}

export const isCanonicalCareersRouteProxyError = (page = {}) =>
  Number(page?.status) === 502
  && String(page?.url ?? CANONICAL_CAREERS_URL) === CANONICAL_CAREERS_URL
  && /\b502 Proxy Error\b/i.test(String(page?.html ?? ''))
  && /Error reading from remote server/i.test(String(page?.html ?? ''))

export const hasOfficialCareersPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml) || ''

  return /<title>\s*Life at\s*\|\s*Belzabar Software Design India Pvt Ltd\s*<\/title>/i.test(rawHtml)
    && normalized.includes('Open Positions')
    && rawHtml.includes('/jobs/senior-infrastructure-engineer-linux')
    && rawHtml.includes('/jobs/qa-engineer')
    && rawHtml.includes('/jobs/front-end-developer')
    && rawHtml.includes('/jobs/senior-computer-scientist-java')
}

const buildListingFromMatch = (href, title) => {
  const sourceUrl = absoluteUrl(href)
  const jobId = normalizeWhitespace(extractFirst(/\/jobs\/([a-z0-9-]+)/i, href))

  if (!sourceUrl || !jobId) return null

  return {
    jobId,
    requisitionId: jobId,
    title: normalizeWhitespace(title),
    sourceUrl,
  }
}

export const extractListings = (html = '') => {
  if (!hasOfficialCareersPageSignal(html)) {
    throw new Error('Belzabar verified careers page no longer matches the trusted first-party listing surface')
  }

  const listings = uniqueStrings(
    extractAll(
      /<a[^>]+href=["'](\/jobs\/[a-z0-9-]+)["'][^>]*class=["'][^"']*white-link[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
      html,
      (match) => JSON.stringify({
        href: match[1],
        title: stripTagsToText(match[2]),
      }),
    ),
  ).map((serialized) => {
    const parsed = JSON.parse(serialized)
    return buildListingFromMatch(parsed.href, parsed.title)
  }).filter(Boolean)

  if (listings.length === 0) {
    throw new Error('Belzabar verified careers page no longer exposes public first-party job links')
  }

  return listings
}

const extractJobTitle = (html) => normalizeWhitespace(extractFirst(/<h3>\s*([\s\S]*?)\s*<\/h3>/i, html))

export const hasOfficialJobDetailSignal = (html = '', listing = {}) => {
  const rawHtml = String(html ?? '')
  const title = extractJobTitle(rawHtml)

  return /<title>\s*Careers at\s*\|\s*Belzabar Software Design India Pvt Ltd\s*<\/title>/i.test(rawHtml)
    && title === listing.title
    && /<strong>\s*Experience(?:\s*:\s*[^<]*)?\s*<\/strong>/i.test(rawHtml)
    && /<strong>\s*Qualification:\s*<\/strong>/i.test(rawHtml)
    && /<strong>\s*Job Location:\s*<\/strong>/i.test(rawHtml)
    && /class=["']button w-button["'][^>]*>\s*Apply\s*<\/a>/i.test(rawHtml)
    && /Applying For \*/i.test(rawHtml)
}

export const extractJobDetail = (html = '', listing = {}) => {
  if (!hasOfficialJobDetailSignal(html, listing)) {
    throw new Error('Belzabar verified job detail no longer matches the trusted first-party apply surface')
  }

  const title = extractJobTitle(html) || listing.title
  const locationDetails = buildLocation(extractMetaField(html, 'Job Location'))
  const requirementBullets = extractBulletsAfterHeading(html, 'Requirement')
  const responsibilityBullets = extractBulletsAfterHeading(html, 'Responsibility')

  return {
    jobId: listing.jobId,
    requisitionId: listing.requisitionId,
    title,
    company: COMPANY,
    department: null,
    location: locationDetails?.location || null,
    city: locationDetails?.city || null,
    country: locationDetails?.country || null,
    sourceUrl: listing.sourceUrl,
    applyUrl: listing.sourceUrl,
    employmentType: null,
    experienceRequired: extractMetaField(html, 'Experience'),
    minimumQualification: extractMetaField(html, 'Qualification'),
    preferredQualification: null,
    requiredSkills: requirementBullets,
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription({
      requirementBullets,
      responsibilityBullets,
    }),
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

const waitFor = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs))

export const createBelzabarScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
  homepageRetryAttempts = 3,
  homepageRetryDelayMs = 1000,
} = {}) => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    let homepage
    for (let attempt = 1; attempt <= homepageRetryAttempts; attempt += 1) {
      homepage = await fetchPage(HOMEPAGE_URL)
      if (homepage.status !== 502 || attempt === homepageRetryAttempts) break
      if (homepageRetryDelayMs > 0) await waitFor(homepageRetryDelayMs)
    }

    if (
      homepage.status !== 200
      || homepage.url !== HOMEPAGE_URL
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Belzabar verified official homepage no longer matches the known public surface')
    }

    if (extractHomepageCareersUrl(homepage.html) !== HOMEPAGE_LINKED_CAREERS_URL) {
      throw new Error('Belzabar verified official homepage no longer exposes the known careers link')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersPageSignal(careersPage.html)) {
      throw new Error('Belzabar verified careers page no longer matches the trusted first-party listing surface')
    }

    const listings = extractListings(careersPage.html)
    const limitedListings = maxJobs ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const listing of limitedListings) {
      const detailPage = await fetchPage(listing.sourceUrl)

      if (detailPage.status !== 200 || detailPage.url !== listing.sourceUrl) {
        throw new Error('Belzabar verified job detail redirected away from the trusted first-party route')
      }

      if (!hasOfficialJobDetailSignal(detailPage.html, listing)) {
        throw new Error('Belzabar verified job detail no longer matches the trusted first-party apply surface')
      }

      const job = extractJobDetail(detailPage.html, listing)
      jobs.push({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createBelzabarScraper().run(options)

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
