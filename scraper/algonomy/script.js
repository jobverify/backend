import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import { ALGONOMY_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const PAYCOR_SCRIPT_URL = PROVIDER_METADATA.paycorScriptUrl
export const PAYCOR_BOARD_URL = PROVIDER_METADATA.paycorBoardUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const GROUP_HEADER_PATTERN = /<div class="gnewtonCareerGroupHeaderClass">\s*([\s\S]*?)\s*<\/div>/i
const PAYCOR_TOKEN_PATTERN = /<div class="gnewtonCareerGroupHeaderClass">\s*([\s\S]*?)\s*<\/div>|<div class="gnewtonCareerGroupRowClass">\s*<div class="gnewtonCareerGroupJobTitleClass">\s*<a href="([^"]+)"[^>]*>\s*([\s\S]*?)\s*<\/a>[\s\S]*?<\/div>\s*<div class="gnewtonCareerGroupJobDescriptionClass">\s*([\s\S]*?)\s*<\/div>\s*<\/div>/gi

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const normalizeComparableUrl = (value) => String(value ?? '').replace(/^\/\//, 'https://').replace(/\/$/, '')

const toAbsoluteUrl = (value) => {
  try {
    return new URL(String(value ?? '').replace(/^\/\//, 'https://'), PAYCOR_BOARD_URL).toString()
  } catch {
    return PAYCOR_BOARD_URL
  }
}

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const extractJobRecordId = (href) => {
  try {
    return new URL(href).searchParams.get('id')
  } catch {
    return null
  }
}

const inferCountry = (location) => {
  const normalized = normalizeText(location)
  if (!normalized) return null
  if (/india/i.test(normalized)) return 'India'
  if (/united states|usa|oklahoma|philadelphia|\bpa\b|\bny\b|\bnj\b|\bde\b/i.test(normalized)) {
    return 'United States'
  }
  return normalized.split(',').pop()?.trim() || null
}

const inferCity = (location) => {
  const normalized = normalizeText(location)
  if (!normalized) return null
  const token = normalized.split(',')[0]?.trim()
  if (!token) return null
  return normalizeCity(token) || token
}

export const extractPaycorScriptUrl = (html = '') => {
  const match = String(html ?? '').match(/<script[^>]+src="([^"]*recruitingbypaycor\.com\/career\/iframe\.action\?clientId=[^"]+)"[^>]*><\/script>/i)
  if (!match?.[1]) return null
  return toAbsoluteUrl(match[1])
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Search Job Openings')
    && normalized.includes('Why Algonomy')
    && /Working at Algonomy is more than just a job\.\s*(?:It's|It’s)\s*a mission\./i.test(normalized)
    && normalized.includes('Algonomy is now part of ADA')
}

export const hasOfficialPaycorBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return /homeUrl\s*=\s*'https:\/\/algonomy\.com\/careers\/'/i.test(page)
    && GROUP_HEADER_PATTERN.test(page)
    && /gnewtonCareerGroupRowClass/i.test(page)
    && /JobIntroduction\.action\?clientId=8a7883c6606d030901607ae3719c71a6/i.test(page)
}

export const extractJobsFromPaycorBoard = (html = '') => {
  const jobs = []
  let currentDepartment = null

  for (const match of String(html ?? '').matchAll(PAYCOR_TOKEN_PATTERN)) {
    const [,
      headerValue,
      hrefValue,
      titleValue,
      locationValue,
    ] = match

    if (headerValue) {
      currentDepartment = normalizeText(headerValue)
      continue
    }

    const title = normalizeText(titleValue)
    const sourceUrl = toAbsoluteUrl(hrefValue)
    if (!title || !sourceUrl) continue

    const recordId = extractJobRecordId(sourceUrl) || slugify(title)
    const location = normalizeText(locationValue)

    jobs.push({
      title,
      jobId: `${SOURCE}-${recordId}`,
      requisitionId: recordId,
      sourceUrl,
      applyUrl: sourceUrl,
      location,
      city: inferCity(location),
      country: inferCountry(location),
      department: currentDepartment,
      employmentType: null,
      workplaceType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      compensation: null,
      postingDate: null,
      closingDate: null,
      openingsCount: null,
      jobDescription: null,
      companyCareerPage: CAREERS_URL,
    })
  }

  return jobs
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createAlgonomyScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow, signal } = {}) {
    signal?.throwIfAborted()
    const careersHtml = await fetchText(CAREERS_URL, { signal })
    signal?.throwIfAborted()
    if (/<title[^>]*>[^<]*ADA Global<\/title>/i.test(careersHtml)
      && String(careersHtml).includes('https://adaglobal.darwinbox.com/ms/candidatev2/main/careers/allJobs')) {
      return attachInventoryEvidence([], {
        status: 'discovery-only',
        surface: CAREERS_URL,
        firstParty: true,
        listingComplete: false,
        pagesFetched: 1,
        reportedTotal: null,
        indiaFacetCount: null,
        verifiedAt: (overrideNow || now)(),
        reason: 'Algonomy careers migrated to ADA Global Darwinbox; a complete Algonomy-specific inventory is not verified. Parent-company jobs cannot establish an Algonomy snapshot.',
      })
    }
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Algonomy verified first-party careers page changed materially')
    }

    const embeddedPaycorScriptUrl = extractPaycorScriptUrl(careersHtml)
    if (
      !embeddedPaycorScriptUrl
      || normalizeComparableUrl(embeddedPaycorScriptUrl) !== normalizeComparableUrl(PAYCOR_SCRIPT_URL)
    ) {
      throw new Error('Algonomy verified Paycor handoff changed materially')
    }

    const boardHtml = await fetchText(PAYCOR_BOARD_URL, { signal })
    signal?.throwIfAborted()
    if (!hasOfficialPaycorBoardSignal(boardHtml)) {
      throw new Error('Algonomy verified Paycor board changed materially')
    }

    const jobs = extractJobsFromPaycorBoard(boardHtml)
    if (jobs.length === 0) {
      throw new Error('Algonomy verified Paycor board no longer exposes visible public openings')
    }

    return jobs.map((job) => ({
      ...job,
      company: COMPANY,
      source: SOURCE,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createAlgonomyScraper().run(options)

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
