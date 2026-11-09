import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FINOLEX_CABLES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = FINOLEX_CABLES_CATALOG.source
export const COMPANY = FINOLEX_CABLES_CATALOG.companyName
export const HOMEPAGE_URL = FINOLEX_CABLES_CATALOG.homepageUrl
export const HOMEPAGE_CAREERS_URL = FINOLEX_CABLES_CATALOG.homepageCareersLinkUrl
export const CAREERS_URL = FINOLEX_CABLES_CATALOG.companyCareerPage
export const VERIFIED_ON = FINOLEX_CABLES_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = FINOLEX_CABLES_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = FINOLEX_CABLES_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrl = (value) => {
  try {
    return new URL(value).toString()
  } catch {
    return null
  }
}

const toAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const titleCaseWords = (value) => String(value ?? '')
  .replace(/\b([a-z])([a-z]*)\b/g, (_, first, rest) => `${first.toUpperCase()}${rest.toLowerCase()}`)

const formatLocation = (value) => {
  const normalized = titleCaseWords(normalizeWhitespace(value))
  if (!normalized) {
    return { city: null, location: 'India' }
  }

  const city = normalized.replace(/\s*\([^)]*\)\s*$/u, '').trim() || null

  return {
    city,
    location: `${normalized}, India`,
  }
}

const extractTableRows = (html) => [...String(html ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
  .map((match) => match[1])

const extractCells = (rowHtml) => [...String(rowHtml ?? '').matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
  .map((match) => ({
    html: match[2],
    text: normalizeWhitespace(match[2]),
  }))

const extractApplyUrl = (operationsCellHtml) => {
  const applyMatch = String(operationsCellHtml ?? '').match(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/i,
  )

  if (!applyMatch) return CAREERS_URL

  return toAbsoluteUrl(applyMatch[1], CAREERS_URL) || CAREERS_URL
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const extractHomepageCareersUrl = (html) => {
  const match = String(html ?? '').match(/<a[^>]+href="([^"]*\/View\/Page\/Career[^"]*)"/i)
  return toAbsoluteUrl(match?.[1], HOMEPAGE_URL)
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('welcome to finolex cables')
    && normalized.includes('about finolex')
    && extractHomepageCareersUrl(html) === HOMEPAGE_CAREERS_URL
}

export const hasOfficialCareersPageSignal = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return normalized.includes('careers at finolex cables | finolex cables.')
    && normalized.includes('transform your future')
    && normalized.includes('careers at finolex cables')
    && normalized.includes('application form')
    && normalized.includes('drop your cv at hr@finolex.com')
  }

export const pageExposesPublicJobListings = (html) => {
  const normalized = normalizeWhitespace(html).toLowerCase()

  return /jobtitle\s+function\s+education\s+experience\s+location\s+operations/i.test(normalized)
    && normalized.includes('apply now')
    && normalized.includes('polymer compounding engineer (production)')
}

export const extractSearchResults = (html) => extractTableRows(html)
  .map((rowHtml) => extractCells(rowHtml))
  .filter((cells) => cells.length >= 6)
  .filter((cells) => cells[0].text !== 'JobTitle')
  .filter((cells) => /\bApply Now\b/i.test(cells[5].text))
  .map((cells) => {
    const title = cells[0].text
    const department = cells[1].text || null
    const minimumQualification = cells[2].text || null
    const experienceRequired = cells[3].text || null
    const { city, location } = formatLocation(cells[4].text)
    const requisitionId = slugify(title)

    if (!title || !requisitionId) return null

    return {
      title,
      company: COMPANY,
      department,
      location,
      city,
      country: 'India',
      jobId: `${SOURCE}-${requisitionId}`,
      requisitionId,
      sourceUrl: CAREERS_URL,
      applyUrl: extractApplyUrl(cells[5].html),
      employmentType: null,
      experienceRequired,
      minimumQualification,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Apply via the official Finolex Cables application form on the careers page.',
    }
  })
  .filter(Boolean)

export const createFinolexCablesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      homepage.status !== 200
      || normalizeUrl(homepage.url) !== HOMEPAGE_URL
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('Finolex Cables homepage changed materially or no longer matches the verified official homepage')
    }

    const careersPage = await fetchPage(HOMEPAGE_CAREERS_URL)
    if (
      careersPage.status !== 200
      || normalizeUrl(careersPage.url) !== CAREERS_URL
      || !hasOfficialCareersPageSignal(careersPage.html)
      || !pageExposesPublicJobListings(careersPage.html)
    ) {
      throw new Error('Finolex Cables careers page changed materially or no longer exposes the verified public openings')
    }

    const jobs = extractSearchResults(careersPage.html)
    if (jobs.length === 0) {
      throw new Error('Finolex Cables careers page changed materially or no longer exposes the verified public openings')
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createFinolexCablesScraper().run(options)

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
