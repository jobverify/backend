import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { INDUSFACE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = INDUSFACE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOIN_FORM_ACTION_PATH = '/wp-content/themes/indusface/sentmail/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&hellip;/gi, '...')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#8211;|&#8212;/gi, '-')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;|&rsquo;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/\s+/g, ' ')
  .trim()

const stripTagsToText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|span|a)>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), baseUrl).toString()
  } catch {
    return null
  }
}

const extractJobSlugFromUrl = (value) => {
  try {
    const parts = new URL(value).pathname.split('/').filter(Boolean)
    return parts.at(-1) ?? null
  } catch {
    return null
  }
}

const extractPrimaryCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/[\/&]/.test(normalized)) return null
  if (normalized.includes(',') && normalized.split(',').length > 1) return null
  return normalized
}

const normalizeLocation = (value) => normalizeWhitespace(value).replace(/^>?\s*📍\s*/u, '').trim()

const extractSectionParagraph = (html = '', heading) => {
  const match = String(html ?? '').match(
    new RegExp(`<h3>\\s*${heading}\\s*<\\/h3>\\s*<p>([\\s\\S]*?)<\\/p>`, 'i'),
  )
  return normalizeWhitespace(stripTagsToText(match?.[1])) || null
}

const extractSectionListItems = (html = '', heading) => {
  const match = String(html ?? '').match(
    new RegExp(`<h3>\\s*${heading}\\s*<\\/h3>[\\s\\S]*?<ul>([\\s\\S]*?)<\\/ul>`, 'i'),
  )

  if (!match) return []

  return Array.from(
    match[1].matchAll(/<li>([\s\S]*?)<\/li>/gi),
    (listMatch) => normalizeWhitespace(stripTagsToText(listMatch[1])) || null,
  ).filter(Boolean)
}

export const hasOfficialCurrentOpeningsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTagsToText(page)

  return /<title>\s*Careers and Current Openings - Indusface\s*<\/title>/i.test(page)
    && /id=["']career-filter-form["']/i.test(page)
    && /See Open Position/i.test(page)
    && text.includes('Your Journey to Success Starts Here')
}

export const extractJobCards = (html = '') => Array.from(
  String(html ?? '').matchAll(
    /<div[^>]+class=["'][^"']*\bcard-body d-flex flex-column\b[^"']*["'][^>]*>[\s\S]*?<h5[^>]+class=["'][^"']*\bcard-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h5>[\s\S]*?<span>([\s\S]*?)<\/span>[\s\S]*?<p[^>]+class=["'][^"']*\bcard-text\b[^"']*["'][^>]*>([\s\S]*?)<\/p>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>\s*See Open Position/gi,
  ),
  (match) => {
    const detailUrl = toAbsoluteUrl(match[4], CAREERS_URL)
    return {
      title: normalizeWhitespace(stripTagsToText(match[1])) || null,
      location: normalizeLocation(match[2]) || null,
      summary: normalizeWhitespace(stripTagsToText(match[3])) || null,
      detailUrl,
      jobSlug: extractJobSlugFromUrl(detailUrl),
    }
  },
).filter((job) => job.title && job.location && job.summary && job.detailUrl && job.jobSlug)

export const hasOfficialDetailPageSignal = (html = '', card = {}) => {
  const page = String(html ?? '')
  const hasVisibleRoleTitle = /<h1>\s*[\s\S]+?\s*<\/h1>/i.test(page)
  const matchesExpectedUrl = !card.detailUrl
    || page.includes(`value="${card.detailUrl}"`)
    || page.includes(`href="${card.detailUrl}"`)
    || page.includes(`content="${card.detailUrl}"`)

  return hasVisibleRoleTitle
    && matchesExpectedUrl
    && /class=["'][^"']*\b_positionBox\b[^"']*["']/i.test(page)
    && page.includes(JOIN_FORM_ACTION_PATH)
}

export const extractDetailContext = (html = '', card = {}) => {
  const titleMatch = String(html ?? '').match(/<h1>\s*([\s\S]*?)\s*<\/h1>/i)
  const locationMatch = String(html ?? '').match(
    /<div[^>]+class=["'][^"']*\bop-loc\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  )
  const experienceMatch = String(html ?? '').match(
    /<div[^>]+class=["'][^"']*\bop-exp\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  )
  const responsibilities = extractSectionParagraph(html, 'Responsibilities:')
  const jobDescriptionItems = extractSectionListItems(html, 'Job Description:')
  const descriptionLines = []

  if (responsibilities) {
    descriptionLines.push('Responsibilities:')
    descriptionLines.push(responsibilities)
  }

  if (jobDescriptionItems.length > 0) {
    if (descriptionLines.length > 0) descriptionLines.push('')
    descriptionLines.push('Job Description:')
    descriptionLines.push(...jobDescriptionItems)
  }

  return {
    title: normalizeWhitespace(stripTagsToText(titleMatch?.[1])) || card.title || null,
    location: normalizeLocation(locationMatch?.[1]) || card.location || null,
    experienceRequired: normalizeWhitespace(stripTagsToText(experienceMatch?.[1])) || null,
    applyUrl: card.detailUrl || null,
    jobDescription: descriptionLines.join('\n') || card.summary || null,
  }
}

export const mapJobCardToJob = (
  card,
  detailContext = {},
  { scrapedAt = new Date().toISOString() } = {},
) => {
  const title = detailContext.title || card.title
  const location = detailContext.location || card.location
  const applyUrl = detailContext.applyUrl || card.detailUrl

  if (!title || !location || !applyUrl || !card?.jobSlug) {
    return null
  }

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city: extractPrimaryCity(location),
    country: 'India',
    sourceUrl: card.detailUrl,
    applyUrl,
    jobId: `${SOURCE}-${card.jobSlug}`,
    requisitionId: null,
    employmentType: null,
    workplaceType: null,
    experienceRequired: detailContext.experienceRequired || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    compensation: null,
    postingDate: null,
    closingDate: null,
    jobDescription: detailContext.jobDescription || card.summary || null,
    source: SOURCE,
    companyCareerPage: CAREERS_URL,
    companyDomain: PROVIDER_METADATA.companyDomain,
    atsPlatform: PROVIDER_METADATA.atsPlatform,
    link: applyUrl,
    scrapedAt,
  }
}

const countRawCardBlocks = (html = '') =>
  (String(html ?? '').match(/<div[^>]+class=["'][^"']*\bcard-body d-flex flex-column\b[^"']*["'][^>]*>/gi) || []).length

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createIndusfaceScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const currentOpeningsHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCurrentOpeningsSignal(currentOpeningsHtml)) {
      throw new Error('Indusface verified current-openings page no longer matches the trusted public jobs surface')
    }

    const jobCards = extractJobCards(currentOpeningsHtml)
    if (jobCards.length === 0 || jobCards.length !== countRawCardBlocks(currentOpeningsHtml)) {
      throw new Error('Indusface official current-openings page exposes no public job cards')
    }

    const scrapedAt = now()
    const jobs = []

    for (const card of jobCards) {
      const detailHtml = await fetchText(card.detailUrl)

      if (!hasOfficialDetailPageSignal(detailHtml, card)) {
        throw new Error('Indusface verified detail page no longer matches the known first-party join form surface')
      }

      const detailContext = extractDetailContext(detailHtml, card)
      const job = mapJobCardToJob(card, detailContext, { scrapedAt })

      if (!job) {
        throw new Error('Indusface verified detail page no longer exposes the expected public job fields')
      }

      jobs.push(job)
    }

    return jobs
  },
})

export const run = async (options = {}) => createIndusfaceScraper(options).run(options)

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
