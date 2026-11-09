import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import ARYAKA_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ARYAKA_CATALOG.source
export const COMPANY = ARYAKA_CATALOG.companyName
export const HOMEPAGE_URL = ARYAKA_CATALOG.homepageUrl
export const CAREERS_URL = ARYAKA_CATALOG.companyCareerPage
export const JOBVITE_HOME_URL = ARYAKA_CATALOG.officialCareersHandoffUrl
export const JOB_LISTINGS_URL = ARYAKA_CATALOG.jobListingsPageUrl
export const DETAIL_URL_PATTERN = 'https://jobs.jobvite.com/aryaka/job/{jobvite_id}'
export const VERIFIED_AT = ARYAKA_CATALOG.verifiedOn
export const PROVIDER_METADATA = ARYAKA_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u00a0/g, ' ')

const stripTags = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n')
  .replace(/<\/li>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => stripTags(value)
  .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n[ \t]+/g, '\n')
  .replace(/[ \t]+/g, ' ')
  .replace(/\n+/g, '\n')
  .trim()

const firstMatch = (value, patterns) => {
  for (const pattern of patterns) {
    const match = String(value ?? '').match(pattern)
    const normalized = normalizeWhitespace(match?.[1])
    if (normalized) return normalized
  }

  return null
}

const toAbsoluteUrl = (value, baseUrl = JOBVITE_HOME_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const isIndiaLocation = (value) => /\b(india|bengaluru|bangalore|karnataka)\b/i.test(
  normalizeWhitespace(value) || '',
)

const normalizeIndiaLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (!isIndiaLocation(normalized)) return normalized

  const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean)
  const city = normalizeCity(parts[0] || normalized)
  const state = parts[1] || null

  if (state && !/\bindia\b/i.test(state)) {
    return `${city}, ${state}, India`
  }

  if (/\bindia\b/i.test(normalized)) {
    return normalized
  }

  return `${city}, India`
}

const extractCity = (location) => {
  const normalized = normalizeIndiaLocation(location)
  if (!normalized) return null

  return normalizeCity(normalized.split(',')[0]?.trim() || normalized)
}

const extractExperienceRequired = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized.match(/\b\d+\s*(?:-\s*\d+|\+)?\s*years\b/i)
  return match ? match[0].replace(/\s+/g, ' ') : null
}

const extractRequiredSkills = (html) => {
  const skills = []

  for (const match of String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
    const skill = normalizeWhitespace(match[1])
    if (skill) skills.push(skill)
  }

  return skills
}

const buildDetailUrl = (jobviteId) => DETAIL_URL_PATTERN.replace('{jobvite_id}', jobviteId)

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Aryaka Unified SASE:\s*Secure Network Access With Agility And Performance\s*<\/title>/i.test(page)
    && /Unified SASE as a Service/i.test(normalized)
    && /delivers performance, agility, simplicity, and security without tradeoffs/i.test(normalized)
    && /href=["']https:\/\/jobs\.jobvite\.com\/aryaka["']/i.test(page)
}

export const extractJobviteHomeUrl = (html) => {
  const raw = firstMatch(html, [
    /href=["'](https:\/\/jobs\.jobvite\.com\/aryaka\/?)["']/i,
  ])

  return raw ? raw.replace(/\/$/, '') : null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /Check out our current openings!/i.test(normalized)
    && /Join our journey to simplify networking and security/i.test(normalized)
    && /Powered by Jobvite/i.test(normalized)
    && /View Open Positions/i.test(normalized)
}

export const extractJobListingsUrl = (html) => {
  const raw = firstMatch(html, [
    /href=["'](https:\/\/jobs\.jobvite\.com\/aryaka\/jobs\/viewall)["']/i,
  ])

  if (raw) return raw

  return hasOfficialCareersSignal(html) && /View Open Positions/i.test(normalizeWhitespace(html) || '')
    ? JOB_LISTINGS_URL
    : null
}

export const hasOfficialJobListingsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /Featured Jobs/i.test(normalized)
    && /Powered by Jobvite/i.test(normalized)
    && /410-Engineering/i.test(normalized)
    && /Check out our current openings!/i.test(normalized)
}

export const extractJobListings = (html) => {
  const listings = []

  const page = String(html ?? '')
  const categoryBlocks = [
    ...page.matchAll(
      /<section[^>]*class=["'][^"']*\bcategory\b[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi,
    ),
  ].map((match) => ({
    department: firstMatch(match[1], [/<h3[^>]*>([\s\S]*?)<\/h3>/i]),
    html: match[1],
  }))

  for (const match of page.matchAll(
    /<h3[^>]*class=["'][^"']*\bjob-category-header\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[^>]*class=["'][^"']*\bjob-category-header\b|<\/section>|<footer|##### Company Links)/gi,
  )) {
    categoryBlocks.push({
      department: normalizeWhitespace(match[1]),
      html: match[2],
    })
  }

  for (const { department, html: sectionHtml } of categoryBlocks) {
    const rowBlocks = [
      ...String(sectionHtml ?? '').matchAll(
        /<div[^>]*class=["'][^"']*\bjob-row\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
      ),
      ...String(sectionHtml ?? '').matchAll(
        /<a[^>]*href=["'][^"']+["'][^>]*>[\s\S]*?\bjv-job-list-name\b[\s\S]*?\bjv-job-list-location\b[\s\S]*?<\/a>/gi,
      ),
    ]

    for (const rowMatch of rowBlocks) {
      const rowHtml = rowMatch[1] || rowMatch[0]
      const href = firstMatch(rowHtml, [
        /<a[^>]*href=["']([^"']+)["']/i,
        /^<a[^>]*href=["']([^"']+)["']/i,
      ])
      const title = firstMatch(rowHtml, [
        /<div[^>]*class=["'][^"']*\bjv-job-list-name\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
        /<a[^>]*>([\s\S]*?)<\/a>/i,
      ])
      const rawLocation = firstMatch(rowHtml, [
        /<div[^>]*class=["'][^"']*\bjv-job-list-location\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
        /<span[^>]*class=["'][^"']*\bjob-location\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i,
      ])

      if (!href || !title || !rawLocation || !isIndiaLocation(rawLocation)) continue

      const detailUrl = toAbsoluteUrl(href)
      const jobId = detailUrl?.match(/\/job\/([^/?#]+)/i)?.[1] ?? null
      const location = normalizeIndiaLocation(rawLocation)

      if (!detailUrl || !jobId || !location) continue

      listings.push({
        title,
        department,
        location,
        city: extractCity(rawLocation),
        country: 'India',
        detailUrl,
        jobId,
        requisitionId: jobId,
      })
    }
  }

  return listings
}

const extractDescriptionSection = (html) => {
  const source = String(html ?? '')
  const match = source.match(
    /<h3[^>]*>\s*Description\s*<\/h3>([\s\S]*?)(?:<p[^>]*>\s*Powered by Jobvite\s*<\/p>|<\/main>|<\/body>)/i,
  )

  return match?.[1] ?? ''
}

export const extractJobDetail = (html, listing = {}) => {
  const source = String(html ?? '')
  const descriptionHtml = extractDescriptionSection(source)
  const description = normalizeWhitespace(descriptionHtml)
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const detailUrl = listing.detailUrl || buildDetailUrl(listing.jobId)

  return {
    title: firstMatch(source, [
      /<h2[^>]*>([\s\S]*?)<\/h2>/i,
    ]) || listing.title || null,
    company: COMPANY,
    department: firstMatch(source, [
      /<p[^>]*class=["'][^"']*\bjob-meta\b[^"']*["'][^>]*>([\s\S]*?)\s+(?:Bengaluru|Bangalore|India)[\s\S]*?<\/p>/i,
    ]) || listing.department || null,
    location: listing.location || null,
    city: listing.city || null,
    country: listing.country || 'India',
    jobId: listing.jobId || null,
    requisitionId: listing.requisitionId || listing.jobId || null,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: null,
    experienceRequired: extractExperienceRequired(description),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractRequiredSkills(descriptionHtml),
    postingDate: null,
    closingDate: null,
    jobDescription: description,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  redirect: 'follow',
  attempts: 3,
  baseDelayMs: 2000,
  timeoutMs: 20000,
  label: SOURCE,
})

export const createAryakaScraper = ({
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now = defaultNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Aryaka verified official homepage no longer matches the trusted first-party surface')
    }

    if (extractJobviteHomeUrl(homepageHtml) !== JOBVITE_HOME_URL) {
      throw new Error('Aryaka verified homepage careers handoff changed materially')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Aryaka verified careers page no longer matches the trusted first-party surface')
    }

    if (extractJobListingsUrl(careersHtml) !== JOB_LISTINGS_URL) {
      throw new Error('Aryaka verified careers page no longer resolves to the trusted Jobvite listings board')
    }

    const listingsHtml = await fetchText(JOB_LISTINGS_URL)
    if (!hasOfficialJobListingsSignal(listingsHtml)) {
      throw new Error('Aryaka verified Jobvite listings board no longer matches the trusted public jobs surface')
    }

    const listings = extractJobListings(listingsHtml)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.detailUrl)
      jobs.push(extractJobDetail(detailHtml, listing))
    }

    return jobs
      .map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      }))
      .sort((left, right) => left.title.localeCompare(right.title))
  },
})

export const run = async (options = {}) => createAryakaScraper(options).run(options)

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
