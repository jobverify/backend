import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'vguardwiresandcablesdivision'
export const COMPANY = 'V-Guard Wires & Cables Division'
export const HOMEPAGE_URL = 'https://www.vguard.in/'
export const APPLY_NOW_URL = 'https://www.vguard.in/careers/apply-now'
export const ATS_LIST_URL = 'https://vguard.mua.hrdepartment.com/hr/ats/JobSearch/viewAll'

const ATS_ORIGIN = 'https://vguard.mua.hrdepartment.com'
const COMPANY_DOMAIN = 'vguard.in'
const ATS_PLATFORM = 'official-company-careers'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const STATE_BY_CODE = {
  AP: 'Andhra Pradesh',
  DL: 'Delhi',
  KA: 'Karnataka',
  KL: 'Kerala',
  MH: 'Maharashtra',
  TN: 'Tamil Nadu',
  TS: 'Telangana',
}

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#8211;|&ndash;|\u2013/gi, '-')
  .replace(/&#8212;|&mdash;|\u2014/gi, '-')
  .replace(/&#8216;|&#8217;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&#8220;|&#8221;|&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/\r/g, '')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(?:p|div|li|ul|ol|section|article|main|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const cleanListItem = (value) => normalizeWhitespace(value?.replace(/^[?*\-•\s]+/, ''))

const normalizeLocationMarkup = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/<br\s*\/?>/gi, '; ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s*;\s*/g, '; '),
)

const toAbsoluteUrl = (value, baseUrl = ATS_LIST_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const isOfficialAtsUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === ATS_ORIGIN && /^\/hr\/ats\/Posting\/view\/\d+/.test(url.pathname)
  } catch {
    return false
  }
}

const parseSlashDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null

  const [, day, month, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

const extractPrimaryLocationLine = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  const parts = normalized.split(/\s*;\s*/).filter(Boolean)
  return parts.find((part) => /\(Primary\)/i.test(part)) || parts[0] || null
}

const extractCityAndState = (location) => {
  const primaryLocation = extractPrimaryLocationLine(location)
  if (!primaryLocation) {
    return { city: null, state: null }
  }

  const match = primaryLocation.match(/-\s*([^,]+),\s*([A-Z]{2})\s+\d/i)
  if (!match) {
    return { city: null, state: null }
  }

  return {
    city: normalizeWhitespace(match[1]),
    state: STATE_BY_CODE[match[2].toUpperCase()] || null,
  }
}

const extractTitle = (html) =>
  stripTags(String(html ?? '').match(/<h2>([\s\S]*?)<\/h2>/i)?.[1] ?? null)
    ?.replace(/\s*-\s*\([^)]+\)\s*$/, '')

const extractFieldMap = (html) => {
  const fields = new Map()
  const pattern = /job-detail-label[\s\S]*?>\s*([\s\S]*?)\s*<\/div>\s*<div[^>]+job-detail-input[^>]*>([\s\S]*?)<\/div>/gi

  for (const match of String(html ?? '').matchAll(pattern)) {
    const label = stripTags(match[1])
    if (!label) continue

    fields.set(label.toLowerCase(), {
      label,
      raw: match[2],
      text: stripTags(match[2]),
    })
  }

  return fields
}

const extractListItems = (html) =>
  [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => cleanListItem(stripTags(match[1])))
    .filter(Boolean)

const buildDescription = (detailFields) => {
  const description = detailFields.get('job description')?.text
  const requirements = detailFields.get('job requirements')?.text
  return normalizeWhitespace([description, requirements].filter(Boolean).join(' '))
}

const extractExperienceRequired = (items = []) =>
  items.find((item) => /\b\d+\+?\s*years?\b|\b\d+\+?\s*year\b/i.test(item)) || null

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<link rel=canonical href=['"]https:\/\/www\.vguard\.in\/['"]/i.test(page)
    && /<title>\s*V-Guard Electrical Appliances\s*<\/title>/i.test(page)
    && normalized.includes('Due to technical upgradation of our system, our website is temporarily not accessible.')
    && normalized.includes('V-GUARD INDUSTRIES LTD. ALL RIGHTS RESERVED.')
    && /href="https:\/\/www\.vguard\.in\/careers\/message-from-the-hr-desk"/i.test(page)
    && normalized.includes('Wires & Cables')
}

export const hasOfficialApplyNowSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<link rel="canonical" href="https:\/\/www\.vguard\.in\/careers\/apply-now"/i.test(page)
    && /<h1>\s*APPLY NOW\s*<\/h1>/i.test(page)
    && normalized.includes('Take the first step towards success. Take a look at all the available job opportunities at V-Guard.')
    && new RegExp(`<iframe[^>]+src="${ATS_LIST_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'i').test(page)
}

export const hasOfficialAtsListingsSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>[\s\S]*Deltek Talent Management[\s\S]*View All Jobs[\s\S]*<\/title>/i.test(page)
    && /id="jobSearchResultsGrid_table"/i.test(page)
    && /Job Search/i.test(normalized)
    && /View All Jobs/i.test(normalized)
    && /<th[^>]*>\s*Location\s*<\/th>/i.test(page)
    && /Req\.\s*#/i.test(page)
    && /href="\/hr\/ats\/Posting\/view\/\d+"/i.test(page)
    && normalized.includes('Last sync:')
}

export const extractListings = (html) => {
  if (!hasOfficialAtsListingsSignal(html)) {
    throw new Error('V-Guard verified official ATS listings no longer match the trusted company hiring surface')
  }

  const listings = []
  const seen = new Set()
  const rows = String(html ?? '').matchAll(
    /<tr>\s*<td><a href="([^"]+)">\s*<span>([\s\S]*?)<\/span>\s*<\/a><\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\d/]+)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<\/tr>/gi,
  )

  for (const match of rows) {
    const sourceUrl = toAbsoluteUrl(match[1], ATS_LIST_URL)
    if (!sourceUrl || !isOfficialAtsUrl(sourceUrl) || seen.has(sourceUrl)) {
      continue
    }

    const title = stripTags(match[2])
    const location = normalizeLocationMarkup(match[3])
    const postingDate = parseSlashDate(match[4])
    const department = stripTags(match[5])
    const requisitionId = stripTags(match[6])

    if (!title || !location || !postingDate || !department || !requisitionId) {
      continue
    }

    seen.add(sourceUrl)
    listings.push({
      title,
      sourceUrl,
      location,
      postingDate,
      department,
      requisitionId,
    })
  }

  return listings
}

export const hasOfficialAtsJobDetailSignal = (html, sourceUrl) => {
  const page = String(html ?? '')
  const postingId = (() => {
    try {
      return new URL(sourceUrl).pathname.match(/\/(\d+)(?:\/|$)/)?.[1] ?? null
    } catch {
      return null
    }
  })()

  return !!sourceUrl
    && !!postingId
    && isOfficialAtsUrl(sourceUrl)
    && /<h1 class="nowrap">\s*Job Details\s*<\/h1>/i.test(page)
    && /value="Apply to this Job"/i.test(page)
    && /job-detail-input/i.test(page)
    && new RegExp(`(?:Posting\\/share|Posting\\/view)\\/${postingId}\\b`, 'i').test(page)
  }

export const extractJobDetail = (html, listing = {}) => {
  if (!hasOfficialAtsJobDetailSignal(html, listing.sourceUrl)) {
    throw new Error('V-Guard verified official ATS job detail no longer matches the trusted company hiring surface')
  }

  const detailFields = extractFieldMap(html)
  const descriptionItems = extractListItems(detailFields.get('job description')?.raw)
  const requirementItems = extractListItems(detailFields.get('job requirements')?.raw)
  const allSkillItems = [...requirementItems, ...descriptionItems]
  const detailLocation = normalizeLocationMarkup(detailFields.get('location')?.raw) || listing.location || null
  const { city, state } = extractCityAndState(detailLocation)
  const jobId = listing.sourceUrl?.match(/\/(\d+)(?:\/|$)/)?.[1] ?? null

  return {
    title: extractTitle(html) || listing.title || null,
    company: COMPANY,
    department: detailFields.get('category')?.text || listing.department || null,
    location: detailLocation,
    city,
    state,
    country: 'India',
    jobId,
    requisitionId: listing.requisitionId || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl: listing.sourceUrl || null,
    employmentType: detailFields.get('job type')?.text || null,
    experienceRequired: extractExperienceRequired(allSkillItems),
    minimumQualification: detailFields.get('education')?.text || null,
    preferredQualification: null,
    requiredSkills: allSkillItems,
    postingDate: listing.postingDate || null,
    closingDate: parseSlashDate(detailFields.get('date needed by')?.text),
    jobDescription: buildDescription(detailFields),
  }
}

export const createVGuardWiresAndCablesDivisionScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('V-Guard verified official homepage no longer matches the trusted company surface')
    }

    const applyNowHtml = await fetchText(APPLY_NOW_URL)
    if (!hasOfficialApplyNowSignal(applyNowHtml)) {
      throw new Error('V-Guard verified official apply-now page no longer matches the trusted company hiring handoff')
    }

    const atsListingsHtml = await fetchText(ATS_LIST_URL)
    const listings = extractListings(atsListingsHtml)
    const jobs = []

    for (const listing of listings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        companyCareerPage: APPLY_NOW_URL,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: ATS_PLATFORM,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createVGuardWiresAndCablesDivisionScraper().run(options)

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
