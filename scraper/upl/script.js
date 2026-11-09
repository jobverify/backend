import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://careers.upl-ltd.com'
const SEARCH_PATH = '/search/?q=&sortColumn=referencedate&sortDirection=desc'
const PAGE_SIZE = 25
const COMPANY_NAME = 'UPL'
const SOURCE = 'upl'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#x2F;/gi, '/')
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, BASE_URL).toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const extractHighConfidenceExperience = (text) => {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return null

  const experienceProfile = extractJobFilterSignals({
    description: normalized,
  })?.experienceProfile
  const evidence = normalizeWhitespace(experienceProfile?.evidence)

  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0
    && experienceProfile.maximumYears === 0
  )
    ? 'No experience required'
    : evidence
}

const isIndiaLocation = (location) => /(?:\bIndia\b|\bIN\b)/i.test(location ?? '')

export const buildSearchPageUrl = (startRow = 0) => {
  const url = new URL(SEARCH_PATH, BASE_URL)
  if (startRow > 0) {
    url.searchParams.set('startrow', String(startRow))
  }
  return url.toString()
}

export const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

export const extractJobIdFromUrl = (value) =>
  extractFirst(/\/(\d+)\/?(?:[#?].*)?$/i, value, (match) => match[1])

export const extractSearchResults = (html) => {
  const rows = [...String(html).matchAll(/<tr[^>]*class="data-row"[^>]*>([\s\S]*?)<\/tr>/gi)]

  return rows
    .map((rowMatch) => {
      const rowHtml = rowMatch[1]
      const title = normalizeWhitespace(
        extractFirst(/<a[^>]*class="jobTitle-link"[^>]*>([\s\S]*?)<\/a>/i, rowHtml),
      )
      const relativeLink = normalizeWhitespace(
        extractFirst(/<a(?=[^>]*class="jobTitle-link")(?=[^>]*href="([^"]+)")[^>]*>/i, rowHtml),
      )
      const location = normalizeWhitespace(
        extractFirst(/<span class="jobLocation">\s*([\s\S]*?)\s*<\/span>/i, rowHtml),
      )
      const postingDate = normalizeWhitespace(
        extractFirst(/<span class="jobDate">\s*([\s\S]*?)\s*<\/span>/i, rowHtml),
      )
      const sourceUrl = toAbsoluteUrl(relativeLink)
      const jobId = extractJobIdFromUrl(sourceUrl)

      if (!title || !sourceUrl || !jobId) return null

      return {
        title,
        location,
        city: extractCity(location),
        jobId,
        requisitionId: jobId,
        sourceUrl,
        postingDate,
      }
    })
    .filter(Boolean)
}

export const extractJobDetail = (html, listing = {}) => {
  const descriptionHtml = extractFirst(
    /<span[^>]*class="jobdescription"[^>]*>([\s\S]*?)<\/span>/i,
    html,
  )
  const applyPath = normalizeWhitespace(
    extractFirst(/<a[^>]*class="[^"]*\bapply\b[^"]*\bdialogApplyBtn\b[^"]*"[^>]*href="([^"]+)"/i, html),
  )
  const title = normalizeWhitespace(
    extractFirst(/<h1 id="job-title" itemprop="title">([\s\S]*?)<\/h1>/i, html),
  ) || listing.title || null
  const location = normalizeWhitespace(
    extractFirst(/<span class="jobGeoLocation">\s*([\s\S]*?)\s*<\/span>/i, html),
  ) || listing.location || null
  const jobId = normalizeWhitespace(
    extractFirst(/<input type="text" value="(\d+)" name="jobid" id="jobid"/i, html),
  ) || listing.jobId || null
  const jobDescription = stripTags(descriptionHtml)

  return {
    title,
    location,
    city: extractCity(location),
    jobId,
    requisitionId: jobId,
    employmentType: 'Full-time',
    experienceRequired: extractHighConfidenceExperience(jobDescription),
    jobDescription,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: normalizeWhitespace(
      extractFirst(/<p[^>]*class="jobDate"[^>]*id="job-date">[\s\S]*?<strong>\s*Date:\s*<\/strong>\s*([\s\S]*?)\s*<\/p>/i, html),
    ) || listing.postingDate || null,
    closingDate: null,
    applyUrl: toAbsoluteUrl(applyPath) || (jobId ? toAbsoluteUrl(`/talentcommunity/apply/${jobId}/?locale=en_US`) : null),
    sourceUrl: listing.sourceUrl || null,
    publicExperienceChecked: Boolean(jobDescription),
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const run = async ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : Number.POSITIVE_INFINITY,
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
} = {}) => {
  const jobs = []
  const seenJobIds = new Set()

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const listingUrl = buildSearchPageUrl(pageIndex * PAGE_SIZE)
    const listingHtml = await fetchText(listingUrl)
    const listings = extractSearchResults(listingHtml)

    if (listings.length === 0) break

    for (const listing of listings) {
      if (!isIndiaLocation(listing.location)) continue
      if (seenJobIds.has(listing.jobId)) continue
      seenJobIds.add(listing.jobId)

      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)
      if (!isIndiaLocation(detail.location || listing.location)) continue

      jobs.push({
        jobId: detail.jobId || listing.jobId,
        requisitionId: detail.requisitionId || listing.requisitionId,
        title: detail.title || listing.title,
        company: COMPANY_NAME,
        department: null,
        location: detail.location || listing.location,
        city: detail.city || listing.city,
        link: detail.applyUrl || listing.sourceUrl,
        applyUrl: detail.applyUrl || listing.sourceUrl,
        sourceUrl: detail.sourceUrl || listing.sourceUrl,
        source: SOURCE,
        employmentType: detail.employmentType,
        experienceRequired: detail.experienceRequired,
        jobDescription: detail.jobDescription,
        minimumQualification: detail.minimumQualification,
        preferredQualification: detail.preferredQualification,
        requiredSkills: detail.requiredSkills,
        postingDate: detail.postingDate || listing.postingDate,
        closingDate: detail.closingDate,
        publicExperienceChecked: detail.publicExperienceChecked === true,
        scrapedAt: now(),
      })

      if (jobs.length >= maxJobs) return jobs
    }

    if (listings.length < PAGE_SIZE) break
  }

  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running UPL scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
