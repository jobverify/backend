import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserTextFallback } from '../../scraper-support/shared/browserTextFallback.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { IMPRESSICO_BUSINESS_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = IMPRESSICO_BUSINESS_SOLUTIONS_CATALOG.source
export const COMPANY = IMPRESSICO_BUSINESS_SOLUTIONS_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = IMPRESSICO_BUSINESS_SOLUTIONS_CATALOG.officialBrandName
export const VERIFIED_ON = IMPRESSICO_BUSINESS_SOLUTIONS_CATALOG.verifiedOn
export const CAREERS_URL = IMPRESSICO_BUSINESS_SOLUTIONS_CATALOG.companyCareerPage
export const PROVIDER_METADATA = IMPRESSICO_BUSINESS_SOLUTIONS_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(value)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || null

const extractListItems = (html) => [...String(html ?? '').matchAll(/<li>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const normalizeLocation = (value) => normalizeWhitespace(value)?.replace(/\s*\/\s*/g, ' / ') || null

const extractPrimaryCity = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized) return null

  const firstSegment = normalized.split('/')[0]?.trim()
  return firstSegment ? normalizeCity(firstSegment) || firstSegment : null
}

const extractSectionBody = (html, heading) =>
  new RegExp(`<h3>\\s*${heading}\\s*<\\/h3>([\\s\\S]*?)(?=<h3>|$)`, 'i').exec(String(html ?? ''))?.[1] || ''

const extractPositionOptions = (html) => [...String(html ?? '').matchAll(/<option value=["']([^"']+)["']>\s*([^<]+?)\s*<\/option>/gi)]
  .map((match) => ({
    id: stripTags(match[1]),
    title: stripTags(match[2]),
  }))
  .filter((option) => option.id && option.title)

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Impressico\s*-\s*Career\s*\|\s*Current Openings\s*<\/title>/i.test(page)
    && /Current Openings/i.test(page)
    && /career-block/i.test(page)
    && /Apply Now/i.test(page)
    && /rel=["']modal:open["']/i.test(page)
    && /No\.\s*Of\s*Openings/i.test(page)
    && /<select[^>]*>/i.test(page)
}

export const extractCareerBlocks = (html) => {
  const optionMap = new Map(
    extractPositionOptions(html).map((option) => [option.title.toLowerCase(), option.id]),
  )

  return String(html ?? '')
    .split('<div class="career-block">')
    .slice(1)
    .map((blockHtml) => {
      const title = stripTags(/<h2[^>]*class=["'][^"']*heading-style3[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i.exec(blockHtml)?.[1])
      const location = normalizeLocation(/Location:\s*<strong[^>]*>([\s\S]*?)<\/strong>/i.exec(blockHtml)?.[1])
      const experienceRequired = stripTags(/Experience:\s*<strong[^>]*>([\s\S]*?)<\/strong>/i.exec(blockHtml)?.[1])
      const openings = stripTags(/No\.\s*Of\s*Openings:\s*<strong>([\s\S]*?)<\/strong>/i.exec(blockHtml)?.[1])
      const modalId = stripTags(/href=["']#([^"']+)["'][^>]*rel=["']modal:open["']/i.exec(blockHtml)?.[1])
      const modalHtml = /<div[^>]+class=["'][^"']*\bcareer-modal-content\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>/i.exec(blockHtml)?.[1] || ''
      const descriptionItems = extractListItems(extractSectionBody(modalHtml, 'Job Description'))
      const requiredSkills = extractListItems(extractSectionBody(modalHtml, 'Job Specification'))

      if (!title || !location || !experienceRequired || !openings) {
        return null
      }

      return {
        title,
        jobId: optionMap.get(title.toLowerCase()) || modalId || slugify(title),
        location,
        experienceRequired,
        openings,
        modalId,
        requiredSkills,
        jobDescription: descriptionItems.join(' '),
      }
    })
    .filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  attempts: 1,
  label: SOURCE,
  timeoutMs: 15000,
})

const shouldUseBrowserFallback = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const createImpressicoBusinessSolutionsScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchBrowserText,
  } = {}) {
    const textFetcher = createBrowserTextFallback({
      fetchText,
      fetchBrowserText,
      userAgent: USER_AGENT,
      shouldUseBrowserFallback,
    })

    try {
      const careersHtml = await textFetcher.fetchText(CAREERS_URL)

      if (!hasOfficialCareersSignal(careersHtml)) {
        throw new Error('Impressico Business Solutions verified Impressico careers surface no longer matches the public contract')
      }

      const cards = extractCareerBlocks(careersHtml)
      if (cards.length === 0) {
        throw new Error('Impressico Business Solutions verified openings surface no longer exposes the expected career blocks')
      }

      const jobs = cards.map((card) => ({
        title: card.title,
        company: COMPANY,
        department: null,
        location: card.location,
        city: extractPrimaryCity(card.location),
        country: 'India',
        jobId: card.jobId,
        requisitionId: card.jobId,
        sourceUrl: card.modalId ? `${CAREERS_URL}#${card.modalId}` : CAREERS_URL,
        applyUrl: CAREERS_URL,
        employmentType: null,
        experienceRequired: card.experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: card.requiredSkills,
        postingDate: null,
        closingDate: null,
        jobDescription: card.jobDescription,
        openings: card.openings,
        remoteStatus: null,
        source: SOURCE,
        link: CAREERS_URL,
        scrapedAt: now(),
      }))

      return maxJobs ? jobs.slice(0, maxJobs) : jobs
    } finally {
      await textFetcher.close()
    }
  },
})

export const run = async (options = {}) => createImpressicoBusinessSolutionsScraper(options).run(options)

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
