import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { runPublicCollection } from '../skyscanner/publicBoundary.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const BASE_URL = 'https://group.bnpparibas'
const CAREER_PAGE_URL = `${BASE_URL}/en/careers/all-job-offers/bnp-paribas-india-solutions`

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&gt;/gi, '>')
  .replace(/&lt;/gi, '<')

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
    .replace(/<(br|\/p|\/div|\/li|\/section|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), BASE_URL).toString()
  } catch {
    return null
  }
}

const extractLocationCity = (location) => normalizeWhitespace(location)?.split(',')[0] || null

const normalizeEmploymentType = (jobType, schedule) => {
  const normalizedJobType = normalizeWhitespace(jobType)?.toLowerCase() || ''
  const normalizedSchedule = normalizeWhitespace(schedule)?.toLowerCase() || ''
  const haystack = `${normalizedJobType} ${normalizedSchedule}`.trim()

  if (!haystack) return null
  if (/intern/.test(haystack)) return 'Internship'
  if (/contract|temporary|fixed term/.test(haystack)) return 'Contract'
  if (/part[\s-]*time/.test(haystack)) return null
  if (/full[\s-]*time|permanent/.test(haystack)) return 'Full-time'
  return normalizeWhitespace(jobType || schedule)
}

const parseMetaDescription = (html) => {
  const metaDescription = normalizeWhitespace(
    extractFirst(/<meta name="description" content="([^"]+)"/i, html),
  )

  if (!metaDescription) return {}

  const parts = metaDescription.split(/\s*-\s*/).map((part) => normalizeWhitespace(part))
  const date = parts[0]
  const roleLocationType = parts[1] || ''
  const roleMatch = roleLocationType.match(/Discover our job\s+(.+?),\s+(.+?),\s+(.+)$/i)

  return {
    postingDate: date ? date.split('/').reverse().join('-') : null,
    title: roleMatch?.[1] || null,
    city: roleMatch?.[2] || null,
    jobType: roleMatch?.[3] || null,
  }
}

const extractDataLayerValue = (label, html) => normalizeWhitespace(
  extractFirst(new RegExp(`'${label}':\\s*'([^']*)'`, 'i'), html),
)

const extractDetailParagraphs = (html) => [...String(html ?? '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const extractTitleCatValueMap = (html) => {
  const values = new Map()

  for (const match of String(html ?? '').matchAll(
    /<div class="offer-data-info[^"]*">[\s\S]*?<div class="title-cat">([\s\S]*?)<\/div>[\s\S]*?(?:<a[^>]*>\s*<span>\s*([\s\S]*?)\s*<\/span>\s*<\/a>|<span>\s*([\s\S]*?)\s*<\/span>)/gi,
  )) {
    const label = stripTags(match[1])
    const value = stripTags(match[2] || match[3])
    if (label && value) {
      values.set(label, value)
    }
  }

  return values
}

const extractRequiredSkills = (paragraphs) => {
  const skills = []

  for (const paragraph of paragraphs) {
    const bulletMatch = paragraph.match(/^[·•]\s*(.+)$/)
    if (bulletMatch?.[1]) {
      skills.push(bulletMatch[1].trim())
      continue
    }

    if (/^API Standards:|^API Security:|^Development and Languages:/i.test(paragraph)) {
      skills.push(paragraph)
    }
  }

  return [...new Set(skills)]
}

export const buildSearchUrl = ({ page = 1 } = {}) => {
  const normalizedPage = Math.max(1, Number(page) || 1)
  if (normalizedPage === 1) return CAREER_PAGE_URL
  return `${CAREER_PAGE_URL}?page=${normalizedPage}`
}

export const extractSearchResults = (html) => [...String(html ?? '').matchAll(
  /<article class="card-custom card-offer[\s\S]*?<\/article>/gi,
)]
  .map((match) => {
    const cardHtml = match[0]
    const sourceUrl = toAbsoluteUrl(extractFirst(/<a href="([^"]+)"/i, cardHtml))
    const title = normalizeWhitespace(extractFirst(/<h3 class="title-4">([\s\S]*?)<\/h3>/i, cardHtml))
    const location = normalizeWhitespace(extractFirst(/<div class="offer-location">[\s\S]*?<\/span>\s*([\s\S]*?)<\/div>/i, cardHtml))
    const company = normalizeWhitespace(extractFirst(/<img[^>]*alt="([^"]+)"/i, cardHtml))
    const jobType = normalizeWhitespace(extractFirst(/<div class="offer-type">([\s\S]*?)<\/div>/i, cardHtml))
    const slug = normalizeWhitespace(extractFirst(/\/job-offer\/([^"?]+)/i, sourceUrl || ''))

    if (!sourceUrl || !title || !location || !slug) return null

    return {
      title,
      company: 'BNP Paribas',
      department: company || 'BNP Paribas India Solutions',
      location,
      city: extractLocationCity(location),
      country: 'India',
      jobId: slug,
      requisitionId: slug,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeEmploymentType(jobType, 'Full time'),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

export const extractPaginationSummary = (html) => ({
  nextUrl: toAbsoluteUrl(extractFirst(/<link rel="next" href="([^"]+)"/i, html)),
})

export const extractJobDetail = (html, listing = {}) => {
  const meta = parseMetaDescription(html)
  const dataValues = extractTitleCatValueMap(html)
  const paragraphs = extractDetailParagraphs(html)
  const applyUrl = toAbsoluteUrl(
    extractFirst(/<a class="cta cta-default iconR" href="([^"]+)"/i, html),
  ) || listing.applyUrl || listing.sourceUrl || null
  const requisitionId = normalizeWhitespace(
    extractFirst(/[?&]jobId=(\d+)/i, applyUrl || ''),
  ) || listing.requisitionId || listing.jobId || null
  const location = normalizeWhitespace(
    [...String(html).matchAll(/<li class="info-item">([\s\S]*?)<\/li>/gi)]
      .map((match) => stripTags(match[1]))
      .find((item) => /india$/i.test(item))
  ) || listing.location || null
  const descriptionParagraphs = paragraphs.filter((paragraph) => (
    !/About BNP Paribas Group:/i.test(paragraph)
    && !/Established in 2005, BNP Paribas India Solutions/i.test(paragraph)
    && !/At BNP Paribas, we passionately embrace diversity/i.test(paragraph)
  ))

  return {
    title: normalizeWhitespace(
      extractFirst(/<h1 class="title-1">([\s\S]*?)<\/h1>/i, html),
    ) || meta.title || listing.title || null,
    company: 'BNP Paribas',
    department: dataValues.get('Brand') || listing.department || extractDataLayerValue('NosMarques', html) || null,
    location,
    city: meta.city || extractLocationCity(location),
    country: 'India',
    jobId: requisitionId,
    requisitionId,
    sourceUrl: listing.sourceUrl || null,
    applyUrl,
    employmentType: normalizeEmploymentType(
      dataValues.get('Job type') || meta.jobType,
      dataValues.get('Schedule'),
    ),
    experienceRequired: paragraphs.find((paragraph) => /^Experience Level:/i.test(paragraph))?.replace(/^Experience Level:\s*/i, '') || null,
    minimumQualification: paragraphs.find((paragraph) => /^Education Level:/i.test(paragraph))?.replace(/^Education Level:\s*/i, '') || extractDataLayerValue('NiveauEtude', html) || null,
    preferredQualification: null,
    requiredSkills: extractRequiredSkills(descriptionParagraphs),
    postingDate: meta.postingDate || null,
    closingDate: null,
    jobDescription: descriptionParagraphs.join(' '),
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

export const createBnppScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    return runPublicCollection('bnpparibas', options, async boundary => {
    const fetchText = options.fetchText
      ? url => boundary.read(url, context => options.fetchText(url, { signal: context.signal }))
      : async url => (await boundary.fetchPage(url, options.fetchImpl || globalThis.fetch, { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36' })).html
    const jobs = []
    const seenJobIds = new Set()
    let nextUrl = buildSearchUrl()
    let page = 0

    while (nextUrl && page < maxPages) {
      page += 1
      const listingHtml = await fetchText(nextUrl)
      const listings = extractSearchResults(listingHtml)
      const summary = extractPaginationSummary(listingHtml)

      for (const listing of listings) {
        if (seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        const detailHtml = await fetchText(listing.sourceUrl)
        const detail = extractJobDetail(detailHtml, listing)

        jobs.push({
          jobId: detail.jobId || listing.jobId,
          requisitionId: detail.requisitionId || listing.requisitionId,
          title: detail.title || listing.title,
          company: detail.company || 'BNP Paribas',
          department: detail.department || listing.department,
          location: detail.location || listing.location,
          city: detail.city || listing.city,
          country: detail.country || listing.country,
          link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
          applyUrl: detail.applyUrl || listing.applyUrl,
          sourceUrl: detail.sourceUrl || listing.sourceUrl,
          source: 'bnpparibas',
          employmentType: detail.employmentType || listing.employmentType,
          experienceRequired: detail.experienceRequired,
          jobDescription: detail.jobDescription,
          minimumQualification: detail.minimumQualification,
          preferredQualification: detail.preferredQualification,
          requiredSkills: detail.requiredSkills,
          postingDate: detail.postingDate || listing.postingDate,
          closingDate: detail.closingDate,
          scrapedAt: new Date().toISOString(),
        })

        if (maxJobs && jobs.length >= maxJobs) {
          return jobs
        }
      }

      nextUrl = summary.nextUrl
    }

    return jobs
    })
  },
})

export const run = async (options = {}) => createBnppScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running BNP Paribas scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'bnpparibas')
    console.log('DB result:', result)
    process.exit(0)
  }
}
