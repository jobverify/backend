import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'innovationincubator'
export const COMPANY = 'Innovation Incubator'
export const CAREERS_PAGE_URL = 'https://innovationincubator.com/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')

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
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const buildAbsoluteUrl = (value) => new URL(String(value ?? ''), CAREERS_PAGE_URL).toString()

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

const extractJobId = (url) => {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, '')
    return pathname.split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/india$/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null

  return normalized
    .replace(/,?\s*India$/i, '')
    .replace(/\s+Remote$/i, '')
    .split(/[\/,]/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)[0] || null
}

const extractDescriptionBlock = (html) => {
  const page = String(html ?? '')
  const start = page.indexOf('<div class="section_content">')
  if (start < 0) return null

  const end = page.search(/<div class="elementor-element[^"]*apply_job/i)
  const block = end > start ? page.slice(start, end) : page.slice(start)
  return stripTags(block)
}

const extractMinimumQualification = (html) => {
  const block = extractFirst(
    /<h3><strong>Required Qualifications(?:\s*&amp;\s*Skills)?<\/strong><\/h3>\s*<ul>([\s\S]*?)<\/ul>/i,
    html,
  )
  const blockText = stripTags(block)
  if (!blockText) return null

  const educationMatch = /Education:\s*([^:]+?)(?=\s+[A-Z][a-z]+:|$)/.exec(blockText)
  return normalizeWhitespace(educationMatch?.[1] || blockText)
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Careers\s*-\s*Innovation Incubator\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/innovationincubator\.com\/careers\/"/i.test(page)
    && /We empower everyone to embark on their own career growth/i.test(normalized)
    && /<article id="post-\d+" class="[^"]*\bjob type-job status-publish\b/i.test(page)
    && /Scan QR code to apply/i.test(normalized)
  }

export const hasVerifiedEmptyCareersSignal = (html) => {
  const page = String(html ?? '')
  const widget = page.match(/id="job-openings--grid"[\s\S]*?<div class="elementor-posts-nothing-found"><\/div>/i)?.[0]
  return /<title>\s*Careers\s*-\s*Innovation Incubator\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/innovationincubator\.com\/careers\/"/i.test(page)
    && /We empower everyone to embark on their own career growth/i.test(page)
    && /<h2[^>]*>Current Openings<\/h2>/i.test(page)
    && Boolean(widget)
    && /data-widget_type="posts\.custom"/i.test(widget)
    && !/<article\b[^>]*\bjob type-job status-publish\b/i.test(page)
    && !/href="https:\/\/innovationincubator\.com\/job\//i.test(page)
}

export const extractJobCards = (html) => {
  const cards = []
  const articlePattern = /<article id="post-\d+" class="[^"]*\bjob type-job status-publish\b[\s\S]*?<\/article>/gi

  for (const articleMatch of String(html ?? '').matchAll(articlePattern)) {
    const articleHtml = articleMatch[0]
    const sourceUrl = buildAbsoluteUrl(
      extractFirst(/<a[^>]+href="(https:\/\/innovationincubator\.com\/job\/[^"]+\/?)"/i, articleHtml),
    )
    const jobId = extractJobId(sourceUrl)
    const title = stripTags(
      extractFirst(/<h1 class="elementor-heading-title elementor-size-default">([\s\S]*?)<\/h1>/i, articleHtml),
    )
    const headings = [...articleHtml.matchAll(
      /<div class="elementor-heading-title elementor-size-default">([\s\S]*?)<\/div>/gi,
    )].map((match) => stripTags(match[1]))
    const employmentType = normalizeWhitespace(headings[0])
    const location = normalizeLocation(headings[1])
    const rawSkills = stripTags(extractFirst(
      /Key Skills<\/span>\s*<\/div>\s*<\/div>\s*<div[^>]*elementor-widget-text-editor[^>]*>[\s\S]*?<div class="elementor-widget-container">\s*([\s\S]*?)\s*<\/div>/i,
      articleHtml,
    ))
    const experienceRequired = stripTags(extractFirst(
      /Experience<\/span>\s*<\/div>\s*<\/div>\s*<div[^>]*elementor-widget-text-editor[^>]*>[\s\S]*?<div class="elementor-widget-container">\s*([\s\S]*?)\s*<\/div>/i,
      articleHtml,
    ))
    const requiredSkills = (rawSkills || '')
      .split(',')
      .map((skill) => normalizeWhitespace(skill))
      .filter(Boolean)

    if (!title || !sourceUrl || !jobId || !location) continue

    cards.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city: extractCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: rawSkills ? `Key Skills: ${rawSkills}` : null,
    })
  }

  return cards
}

export const extractJobDetail = (html, listing = {}) => {
  const title = stripTags(
    extractFirst(/<h2 class="elementor-heading-title elementor-size-default">([\s\S]*?)<\/h2>/i, html),
  ) || listing.title || null
  const detailDescription = extractDescriptionBlock(html)
  const minimumQualification = extractMinimumQualification(html)

  return {
    ...listing,
    title,
    minimumQualification,
    jobDescription: detailDescription || listing.jobDescription || null,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createInnovationIncubatorScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)

    if (hasVerifiedEmptyCareersSignal(careersHtml)) {
      return attachInventoryEvidence([], {
        status: 'verified-empty',
        surface: CAREERS_PAGE_URL,
        firstParty: true,
        listingComplete: true,
        pagesFetched: 1,
        reportedTotal: 0,
        indiaFacetCount: 0,
        verifiedAt: now(),
        reason: 'innovationincubator-current-openings-widget-empty',
      })
    }

    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Innovation Incubator careers page no longer matches the verified first-party jobs surface')
    }

    const listings = extractJobCards(careersHtml)
    const selectedListings = Number.isInteger(maxJobs) ? listings.slice(0, maxJobs) : listings
    const jobs = []

    for (const listing of selectedListings) {
      const detailHtml = await fetchText(listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...detail,
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createInnovationIncubatorScraper().run(options)

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
