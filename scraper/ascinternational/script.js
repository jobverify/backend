import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasAscStructuredCareers, assertAscCareersResponse, inspectAscCareers } from './nativeCareers.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'ascinternational'
export const COMPANY = 'ASC International'
export const CAREER_PAGE_URL = 'https://ascinternational.com/careers/'
export const LEGACY_JOB_POSTING_URL = 'https://w2.ascinternational.com/job-posting/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 10000
const TIMEOUT_ERROR_PATTERN = /timed out|timeout|etimedout|connect timeout|und_err_connect_timeout/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const htmlToText = (value) => String(value ?? '')
  .replace(/<br\b[^>]*>/gi, '\n')
  .replace(/<\/li>/gi, '\n')
  .replace(/<\/p>/gi, '\n')
  .replace(/<\/h[1-6]>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)
  .join('\n') || null

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const extractHtmlTitle = (html) => normalizeWhitespace(
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '',
)

const extractJobBlocks = (html) => [...String(html ?? '').matchAll(
  /<h4\b[^>]*>([\s\S]*?)<\/h4>([\s\S]*?)(?=<h4\b|<\/main>|<footer\b|$)/gi,
)]

const extractLocation = (value) => {
  const matches = [...String(value ?? '').matchAll(/([A-Za-z][A-Za-z .'-]+),\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?/g)]
  const lastMatch = matches.at(-1)
  if (!lastMatch) {
    return { location: null, city: null }
  }

  const city = normalizeWhitespace(lastMatch[1])
  const state = normalizeWhitespace(lastMatch[2])
  if (!city || !state) {
    return { location: null, city: null }
  }

  return {
    location: `${city}, ${state}, USA`,
    city,
  }
}

const extractRequirements = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      minimumQualification: null,
      experienceRequired: null,
    }
  }

  const match = normalized.match(/Requirements:\s*(.*?)\s+and\s+(\d+)\s+Years?[â€™']?\s+experience/i)
  if (!match) {
    return {
      minimumQualification: null,
      experienceRequired: null,
    }
  }

  return {
    minimumQualification: normalizeWhitespace(match[1]),
    experienceRequired: `${match[2]} years`,
  }
}

const extractRequiredSkills = (value) => {
  const match = String(value ?? '').match(/including:\s*<\/p>\s*<ul\b[^>]*>([\s\S]*?)<\/ul>/i)
  if (!match) return []

  return [...match[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((item) => normalizeWhitespace(item[1]))
    .filter((item) => item && !/^travel:/i.test(item))
}

export const buildSearchUrl = () => CAREER_PAGE_URL

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const title = extractHtmlTitle(page)
  const text = htmlToText(page)

  return (
    title === 'Careers - ASC International'
    || title === 'Careers - Inspection & Metrology Jobs | ASC International'
    || title === 'Careers - Join the ASC International Team | Inspection & Metrology Jobs | ASC International'
  )
    && text?.includes('Join Our Continuously Growing Team')
    && (
      text?.includes('Current Career Opportunities')
      || text?.includes('Current Openings')
    )
}

export const hasLegacyJobPostingSignal = (html) => {
  const page = String(html ?? '')
  const title = extractHtmlTitle(page)
  const text = htmlToText(page)

  return title === 'Job Posting - ASC International'
    && text?.includes('Automated Optical Inspection (AOI) Engineer')
    && text?.includes('Mail resume to: ATTN:HR, ASC International, Inc 830 Tower Drive Suite 200 Medina, MN 55340')
}

const extractLegacySearchResults = (html) => extractJobBlocks(html)
  .map((match) => {
    const title = normalizeWhitespace(match[1])
    const blockHtml = match[2]
    const blockText = htmlToText(blockHtml)
    const jobId = slugify(title)
    const { location, city } = extractLocation(blockText)
    const { minimumQualification, experienceRequired } = extractRequirements(blockText)

    if (!title || !jobId) return null

    return {
      title,
      company: 'ASC International',
      department: null,
      location,
      city,
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREER_PAGE_URL,
      applyUrl: CAREER_PAGE_URL,
      employmentType: null,
      experienceRequired,
      minimumQualification,
      preferredQualification: null,
      requiredSkills: extractRequiredSkills(blockHtml),
      postingDate: null,
      closingDate: null,
      jobDescription: blockText,
    }
  })
  .filter(Boolean)

export const extractSearchResults = html => hasAscStructuredCareers(html) ? inspectAscCareers(html).jobs : extractLegacySearchResults(html)

const isTimeoutError = (error) => {
  if (error?.name === 'AbortError') return true

  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const message = String(error?.message ?? error ?? '')

  return /UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT/i.test(causeCode)
    || TIMEOUT_ERROR_PATTERN.test(causeMessage)
    || TIMEOUT_ERROR_PATTERN.test(message)
}

export const isExpectedTimedOutSurface = (surface = {}) =>
  surface?.errorKind === 'timeout'
  && !Number.isInteger(surface?.status)
  && surface?.html == null

const defaultFetchPage = async (url) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    return {
      status: response.status,
      url: response.url,
      html: await response.text(),
      errorKind: null,
    }
  } catch (error) {
    clearTimeout(timeout)

    if (isTimeoutError(error)) {
      return {
        status: null,
        url,
        html: null,
        errorKind: 'timeout',
      }
    }

    const cause = String(error?.cause ?? error?.message ?? error)
    if (/ENOTFOUND|getaddrinfo/i.test(cause)) {
      return {
        status: null,
        url,
        html: null,
        errorKind: 'dns',
      }
    }

    return {
      status: null,
      url,
      html: null,
      errorKind: 'network',
      errorMessage: String(error?.message ?? error),
    }
  }
}

export const createAscInternationalScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    options.signal?.throwIfAborted()
    const fetchPage = options.fetchPage
      || (options.fetchText
        ? async (url) => ({
          status: 200,
          url,
          html: await options.fetchText(url),
          errorKind: null,
        })
        : defaultFetchPage)
    const careersPage = await fetchPage(buildSearchUrl())
    options.signal?.throwIfAborted()

    if (careersPage.status === 200) {
      if (!hasOfficialCareersPageSignal(careersPage.html)) {
        throw new Error('ASC International verified first-party careers page no longer matches the trusted public surface')
      }

      const html = careersPage.html
      if (hasAscStructuredCareers(html)) {
        assertAscCareersResponse(careersPage)
        const opening = inspectAscCareers(html)
        const closingPage = await fetchPage(buildSearchUrl())
        options.signal?.throwIfAborted()
        assertAscCareersResponse(closingPage)
        const closing = inspectAscCareers(closingPage.html)
        const india = opening.jobs.filter(job => job.country === 'India')
        const selected = maxJobs ? india.slice(0, maxJobs) : india
        const reasons = [...opening.reasons, ...closing.reasons]
        if (opening.signature !== closing.signature) reasons.push('closing-inventory-changed')
        if (selected.length !== india.length) reasons.push('selected-role-cap')
        if (options.fetchText && !options.fetchPage) reasons.push('native-response-metadata-unavailable')
        const listingComplete = reasons.length === 0
        const jobs = selected.map(job => ({ ...job, source: SOURCE, link: job.applyUrl,
          sourceListingComplete: listingComplete, scrapedAt: new Date().toISOString() }))
        return attachInventoryEvidence(jobs, { status: listingComplete ? 'complete-inventory' : 'discovery-only',
          surface: CAREER_PAGE_URL, firstParty: true, listingComplete, pagesFetched: 2,
          reportedTotal: opening.nativeCount,
          indiaFacetCount: reasons.some(reason => /country|location|hiring-surface|closing/.test(reason)) ? null : india.length,
          verifiedAt: new Date().toISOString(),
          reason: listingComplete ? `asc-native-visible-and-structured-roles-reconciled:${opening.signature}`
            : `asc-native-incomplete:${[...new Set(reasons)].join(';')}`,
        })
      }
      const jobs = extractSearchResults(html)
      const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

      return selectedJobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      }))
    }

    if (isExpectedTimedOutSurface(careersPage)) {
      const legacyPage = await fetchPage(LEGACY_JOB_POSTING_URL)
      if (isExpectedTimedOutSurface(legacyPage)) {
        return []
      }

      if (legacyPage.status === 200 && hasLegacyJobPostingSignal(legacyPage.html)) {
        throw new Error('ASC International first-party job posting surface is reachable again; promote a live parser for the legacy page before trusting it')
      }

      throw new Error('ASC International verified first-party timeout contract changed materially')
    }

    if (Number.isInteger(careersPage.status)) {
      throw new Error(`HTTP ${careersPage.status} for ${careersPage.url || CAREER_PAGE_URL}`)
    }

    if (careersPage.errorKind === 'network' && careersPage.errorMessage) {
      throw new Error(careersPage.errorMessage)
    }

    if (careersPage.errorKind === 'dns') {
      throw new Error(`ASC International official careers host no longer resolves: ${CAREER_PAGE_URL}`)
    }

    throw new Error('ASC International verified first-party careers page no longer matches the trusted public surface')
  },
})

export const run = async (options = {}) => createAscInternationalScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ASC International scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'ascinternational')
    console.log('DB result:', result)
    process.exit(0)
  }
}
