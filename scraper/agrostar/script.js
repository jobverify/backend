import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createDarwinboxScraper } from '../darwinbox/script.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { hydrateSourceDescriptions } from '../../scraper-support/utils/sourceDescriptionHydration.js'

import { AGROSTAR_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY_NAME = AGROSTAR_CATALOG.companyName
export const SOURCE = AGROSTAR_CATALOG.source
export const DARWINBOX_COMPANY_ID = AGROSTAR_CATALOG.darwinboxCompanyId
export const DARWINBOX_ORIGIN = AGROSTAR_CATALOG.darwinboxOrigin
export const OFFICIAL_CAREERS_URL = AGROSTAR_CATALOG.companyCareerPage
export const OFFICIAL_CAREERS_HANDOFF_URL = AGROSTAR_CATALOG.officialCareersHandoffUrl
export const PUBLIC_PORTAL_URL =
  `${DARWINBOX_ORIGIN}/ms/candidatev2/${DARWINBOX_COMPANY_ID}/careers/allJobs`
export const VERIFIED_ON = AGROSTAR_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = AGROSTAR_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = AGROSTAR_CATALOG

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html) => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

export const extractOfficialDarwinboxUrl = (html = '') => {
  const match = String(html ?? '').match(
    /https:\/\/agrostar\.darwinbox\.in\/ms\/candidatev2\/main\/careers\/allJobs/i,
  )

  return normalizeWhitespace(match?.[0])
}

export const hasOfficialAgroStarCareersSignals = (html = '') => {
  const page = String(html ?? '')
  const text = (normalizeWhitespace(page) || '').toLowerCase()
  const hasLegacyTalentCopy = text.includes("we're always looking for great talent")
  const hasCurrentPerksCopy = text.includes('the perks of being an agstar')

  return extractTitle(page) === 'Join Us | Build Your Career at AgroStar & Transform Indian Agriculture'
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/corporate\.agrostar\.in\/join-us["']/i.test(page)
    && text.includes('build an institution that feeds the nation, and saves the planet.')
    && (hasLegacyTalentCopy || hasCurrentPerksCopy)
    && text.includes("if you're ready to make an impact, we'd love to meet you!")
    && extractOfficialDarwinboxUrl(page) === OFFICIAL_CAREERS_HANDOFF_URL
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'agrostar-official',
  timeoutMs: 15000,
  signal,
})

const normalizeDarwinboxJobUrl = (value) => {
  if (!value) return null

  try {
    const url = new URL(value, OFFICIAL_CAREERS_URL)
    url.hash = ''
    url.search = ''

    if (url.hostname !== 'agrostar.darwinbox.in') return null
    if (!url.pathname.startsWith(`/ms/candidatev2/${DARWINBOX_COMPANY_ID}/careers/jobDetails/`)) {
      return null
    }

    return url.toString()
  } catch {
    return null
  }
}

const extractJobIdFromUrl = (value) => {
  try {
    return new URL(value).pathname.split('/').filter(Boolean).pop() || null
  } catch {
    return null
  }
}

const extractInlineLocation = (html) => {
  const details = normalizeWhitespace(html)
  const location = details?.match(/^(.+?)\s+\d+\s*-\s*\d+\s+Years\b/i)?.[1]
  return normalizeWhitespace(location)
}

export const extractInlineJobsFromOfficialCareersPage = (html = '') => {
  const page = String(html ?? '')
  const jobs = []
  const seenJobIds = new Set()
  const pattern = /(?:<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?))?<a[^>]+href=["']([^"']*\/ms\/candidatev2\/main\/careers\/jobDetails\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi

  for (const match of page.matchAll(pattern)) {
    const titleFromHeading = normalizeWhitespace(match[1])
    const location = extractInlineLocation(match[2])
    const titleFromAnchor = normalizeWhitespace(match[4])
    const sourceUrl = normalizeDarwinboxJobUrl(match[3])
    const title = titleFromHeading || (
      /^(apply now|view job|view details|learn more)$/i.test(titleFromAnchor || '')
        ? null
        : titleFromAnchor
    )
    const jobId = extractJobIdFromUrl(sourceUrl)

    if (!sourceUrl || !title || !jobId || seenJobIds.has(jobId)) {
      continue
    }

    seenJobIds.add(jobId)
    jobs.push({
      title,
      company: COMPANY_NAME,
      department: null,
      location,
      city: normalizeCity(location?.split(',')[0]) || null,
      jobId,
      requisitionId: null,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      publicExperienceChecked: true,
      source: SOURCE,
      link: sourceUrl,
    })
  }

  return jobs
}

export const createAgroStarScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
  fetchImpl = fetch,
} = {}) => {
  const darwinboxScraper = createDarwinboxScraper({
    companyName: COMPANY_NAME,
    source: SOURCE,
    companyId: DARWINBOX_COMPANY_ID,
    origin: DARWINBOX_ORIGIN,
    fetchImpl,
  })

  return {
  async run({
    maxPages = config.maxPages,
    fetchText = defaultFetchText,
    fetchListingPage,
    fetchJobDetail = darwinboxScraper.fetchJobDetailFromApi,
    detailEnrichmentBudgetMs = config.detailEnrichmentBudgetMs,
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const careersHtml = await fetchText(OFFICIAL_CAREERS_URL, { signal })
    signal?.throwIfAborted()

    if (!hasOfficialAgroStarCareersSignals(careersHtml)) {
      throw new Error('AgroStar verified official careers page no longer matches the verified public surface')
    }

    const inlineJobs = !fetchListingPage
      ? extractInlineJobsFromOfficialCareersPage(careersHtml)
      : []
    const jobs = inlineJobs.length > 0
      ? await hydrateSourceDescriptions(
        (maxJobs ? inlineJobs.slice(0, maxJobs) : inlineJobs).map(job => ({ ...job, sourceListingComplete: false })),
        { signal, detailEnrichmentBudgetMs, fetchDetail: async (job, { signal: detailSignal }) => {
          const payload = await fetchJobDetail({ jobId: job.jobId, companyId: DARWINBOX_COMPANY_ID, signal: detailSignal })
          // Official inline links prove the selected roles, not their full
          // descriptions or a complete board. Reuse the native detail guard.
          return { sourceDescription: darwinboxScraper.validateJobDetail(payload, job) }
        } },
      )
      : await darwinboxScraper.run({
        maxPages,
        maxJobs,
        fetchListingPage,
        fetchJobDetail,
        detailEnrichmentBudgetMs,
        signal,
      })
    const scrapedAt = now()

    return mapJobsWithInventoryEvidence(jobs, (job) => ({
      ...job,
      // The native detail guard requires explicit India addresses before it
      // accepts source content. Retain that stronger location evidence for
      // cities that are absent from the public city-name allowlist.
      ...(inlineJobs.length > 0 && job.sourceDetailComplete === true ? { country: 'India' } : {}),
      scrapedAt,
    }))
  },
  }
}

export const run = async (options = {}) => createAgroStarScraper().run(options)

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
