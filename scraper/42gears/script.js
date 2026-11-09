import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { FORTY_TWO_GEARS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = FORTY_TWO_GEARS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const INDIA_LOCATION_PATTERN = /\b(?:india|bengaluru|bangalore|mumbai|rajkot|delhi|new delhi|chennai|pune|hyderabad|gurgaon|gurugram|noida)\b/i

const decodeHtmlEntitiesOnce = (value = '') => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
    const codePoint = Number.parseInt(hex, 16)
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : ''
  })
  .replace(/&#(\d+);/g, (_, decimal) => {
    const codePoint = Number.parseInt(decimal, 10)
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : ''
  })
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/&hellip;/gi, '...')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const decodeHtmlEntities = (value = '') => {
  let decoded = String(value ?? '')
  for (let index = 0; index < 3; index += 1) {
    const next = decodeHtmlEntitiesOnce(decoded)
    if (next === decoded) break
    decoded = next
  }
  return decoded
}

const normalizeWhitespace = (value) => decodeHtmlEntities(
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)
  .replace(/[\u2013\u2014\u2212]/g, '-')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[â€“â€”âˆ’]/g, '-')
  .replace(/[â€™â€˜]/g, "'")
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toAbsoluteUrl = (value) => {
  try {
    const url = new URL(value, CAREERS_URL)
    if (url.hostname !== 'www.42gears.com') return null
    return url.toString()
  } catch {
    return null
  }
}

const getParagraphs = (block) => [...String(block ?? '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

const unique = (values = []) => [...new Set(values.filter(Boolean))]

const getLastPathSegment = (value) => {
  try {
    return new URL(String(value ?? '')).pathname.split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/full.?time/.test(normalized)) return 'Full Time'
  if (/part.?time/.test(normalized)) return 'Part Time'
  if (/contract/.test(normalized)) return 'Contract'
  return normalizeWhitespace(value)
}

const extractExperienceRequired = (description = '') => normalizeWhitespace(
  String(description ?? '').match(
    /Relevant Experience:\s*(.*?)(?:\s+(?:Responsibilities?|Roles and Responsibilities|Core Responsibilities|Role Description|Job Summary|Key Responsibilities?|About the Role|Department:|Location:|Type:|Industry:|We(?:'re|\s+are)|Join)\b|$)/i,
  )?.[1],
) || null

const buildLocationDetails = (jobLocations = []) => {
  const parts = unique(
    (Array.isArray(jobLocations) ? jobLocations : [])
      .map((value) => normalizeWhitespace(value))
      .map((value) => value?.replace(/^,+|,+$/g, '').trim())
      .filter(Boolean),
  )
  if (!parts.some((part) => INDIA_LOCATION_PATTERN.test(part))) return null

  const cityParts = parts.filter((part) => !/^india$/i.test(part))
  const orderedParts = cityParts.length > 0 ? [...cityParts, 'India'] : ['India']
  const location = unique(orderedParts).join(', ')

  return {
    location,
    city: cityParts[0] || 'India',
  }
}

const extractLegacyJobs = (html = '') => {
  const jobs = []

  for (const match of String(html ?? '').matchAll(/<article[^>]*class=["'][^"']*job-card[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)) {
    const block = match[1]
    const title = normalizeWhitespace(block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    const url = toAbsoluteUrl(block.match(/<a[^>]*href=["']([^"']+)["']/i)?.[1])
    const paragraphs = getParagraphs(block)
    const employmentType = normalizeEmploymentType(paragraphs[0] || null)
    const location = paragraphs[1] || null
    const jobDescription = paragraphs[2] || null
    const experienceRequired = extractExperienceRequired(jobDescription)
    const jobId = getLastPathSegment(url) || slugify(title)

    if (!title || !url || !location || !INDIA_LOCATION_PATTERN.test(location) || !jobId) continue

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city: normalizeWhitespace(location.split(',')[0]),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: url,
      applyUrl: url,
      employmentType,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
      remoteStatus: 'On-site',
    })
  }

  return jobs
}

const extractCurrentOpeningsItems = (html = '') => {
  const items = []
  const seen = new Set()

  for (const scriptMatch of String(html ?? '').matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    const scriptText = scriptMatch[1]
    if (!scriptText.includes('self.__next_f.push')) continue

    for (const payloadMatch of scriptText.matchAll(/self\.__next_f\.push\(\[\s*\d+\s*,\s*("(?:[^"\\]|\\.)*")\s*\]\)/g)) {
      let decoded = null
      try {
        decoded = JSON.parse(payloadMatch[1])
      } catch {
        continue
      }

      const separatorIndex = decoded.indexOf(':')
      if (separatorIndex < 0) continue

      let payload = null
      try {
        payload = JSON.parse(decoded.slice(separatorIndex + 1))
      } catch {
        continue
      }

      const currentOpenings = Array.isArray(payload)
        ? payload.find((entry) =>
          entry
          && typeof entry === 'object'
          && entry.model?.heading === 'Current Openings'
          && Array.isArray(entry.items))
        : null

      if (!currentOpenings) continue

      for (const item of currentOpenings.items) {
        const sourceUrl = toAbsoluteUrl(item?.href)
        const dedupeKey = sourceUrl || normalizeWhitespace(item?.title)
        if (!dedupeKey || seen.has(dedupeKey)) continue

        seen.add(dedupeKey)
        items.push(item)
      }
    }
  }

  return items
}

const extractNextFlightJobs = (html = '') => extractCurrentOpeningsItems(html)
  .map((item) => {
    const title = normalizeWhitespace(item?.title)
    const sourceUrl = toAbsoluteUrl(item?.href)
    const locationDetails = buildLocationDetails(item?.jobLocations)
    const jobDescription = normalizeWhitespace(item?.excerpt)
    const jobId = getLastPathSegment(sourceUrl) || slugify(title)

    if (!title || !sourceUrl || !locationDetails || !jobId) return null

    return {
      title,
      company: COMPANY,
      department: null,
      location: locationDetails.location,
      city: locationDetails.city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeEmploymentType(Array.isArray(item?.jobTypes) ? item.jobTypes[0] : item?.jobTypes),
      experienceRequired: extractExperienceRequired(jobDescription),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
      remoteStatus: /(?:^|[\s,])remote(?:[\s,]|$)|hybrid/i.test(`${locationDetails.location} ${jobDescription ?? ''}`)
        ? 'Remote'
        : 'On-site',
    }
  })
  .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const lowerCaseNormalized = normalized.toLowerCase()
  const hasLegacySignal =
    /<title[^>]*>\s*Careers\s*-\s*42Gears Mobility Systems\s*<\/title>/i.test(page)
    && lowerCaseNormalized.includes("let's do something interesting - together.")
    && normalized.includes('Current Openings')
  const hasNextFlightSignal =
    lowerCaseNormalized.includes('join 42gears team.')
    && normalized.includes('Current Openings')
    && /id=["']careers-list["']/i.test(page)
    && /self\.__next_f\.push/i.test(page)
    && /\/careers\/[a-z0-9-]+\/?/i.test(page)

  return hasLegacySignal || hasNextFlightSignal
}

export const extractJobs = (html = '') => {
  const legacyJobs = extractLegacyJobs(html)
  if (legacyJobs.length > 0) return legacyJobs
  return extractNextFlightJobs(html)
}

export const create42GearsScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified 42Gears Mobility Systems careers surface no longer matches the trusted first-party page')
    }

    const jobs = extractJobs(careersHtml)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => create42GearsScraper().run(options)

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
