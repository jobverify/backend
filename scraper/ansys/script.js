import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  extractPaginationSummary,
  extractSearchResults,
} from '../synopsys/script.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { hydrateSourceDescriptions } from '../../scraper-support/utils/sourceDescriptionHydration.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readNativeSearchFrame, readNativeRoleDetail, nativeRoleId } from './nativeInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'ansys'
export const COMPANY = 'Ansys'
export const CAREERS_PAGE_URL = 'https://www.ansys.com/careers'
export const SEARCH_PAGE_URL = 'https://careers.synopsys.com/search-jobs/ansys/44408/1'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(decodeHtmlEntities(value), 'https://careers.synopsys.com').toString()
  } catch {
    return null
  }
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page).toLowerCase()

  return (
    text.includes('ansys')
    && text.includes('careers')
    && text.includes('search for jobs')
    && page.includes('careers.synopsys.com/search-jobs/ansys/44408/1')
  )
}

export const extractVerifiedSearchUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const url = toAbsoluteUrl(match[1])
    if (!url) continue
    const parsed = new URL(url), expected = new URL(SEARCH_PAGE_URL)
    if (parsed.origin === expected.origin && parsed.pathname.replace(/\/$/, '') === expected.pathname && !parsed.search) return SEARCH_PAGE_URL
  }

  return null
}

export const extractNextPageUrl = (html) => {
  const match = String(html ?? '').match(/<a class="next" href="([^"]+)"/i)
  const raw = decodeHtmlEntities(match?.[1] ?? '')
  const url = toAbsoluteUrl(raw)
  if (!url || new URL(url).origin !== new URL(SEARCH_PAGE_URL).origin) return null
  const page = raw.match(/[?&]p=(\d+)/)?.[1]
  if (page && new URL(raw.split(/[?&]/)[0], SEARCH_PAGE_URL).pathname === new URL(SEARCH_PAGE_URL).pathname) {
    const next = new URL(SEARCH_PAGE_URL)
    next.searchParams.set('p', page)
    return next.href
  }
  return url
}

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 20000,
  signal: options.signal,
  includeResponseMetadata: options.includeResponseMetadata === true,
})

export const createAnsysScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run(options = {}) {
    const { fetchText = defaultFetchText, signal } = options
    const get = async url => {
      signal?.throwIfAborted()
      const result = await fetchText(url, { signal, includeResponseMetadata: true })
      signal?.throwIfAborted()
      if (typeof result === 'string') return result
      const corporateBrandRedirect = url === CAREERS_PAGE_URL && result?.url === 'https://ansys.synopsys.com/careers'
      if (result?.status !== 200 || (!corporateBrandRedirect && new URL(result.url).origin !== new URL(url).origin)) throw new Error('Ansys first-party response changed')
      return result.html
    }
    const careersHtml = await get(CAREERS_PAGE_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Ansys careers page no longer matches the verified Synopsys search handoff surface')
    }

    const verifiedSearchUrl = extractVerifiedSearchUrl(careersHtml)
    if (verifiedSearchUrl !== SEARCH_PAGE_URL) {
      throw new Error('Ansys careers page no longer exposes the verified Synopsys search handoff')
    }

    const jobs = []
    const seenJobIds = new Set()
    const opening = new Map(), pageUrls = [], incomplete = new Set(), detailMetadata = new Map()
    let nextPageUrl = verifiedSearchUrl
    let pagesFetched = 0
    let total = null, indiaCount = null
    const pageLimit = options.maxPages ?? maxPages, jobLimit = options.maxJobs ?? maxJobs

    while (nextPageUrl && pageUrls.length < pageLimit) {
      const html = await get(nextPageUrl)
      pageUrls.push(nextPageUrl); pagesFetched++
      const frame = readNativeSearchFrame(html, pageUrls.length)
      const summary = extractPaginationSummary(html)
      const currentTotal = frame?.total ?? summary.totalJobCount
      if (!Number.isSafeInteger(currentTotal) || currentTotal < 0) throw new Error('Ansys native total unavailable')
      if (total === null) { total = currentTotal; indiaCount = frame?.indiaCount ?? null }
      else if (total !== currentTotal || indiaCount !== (frame?.indiaCount ?? null)) incomplete.add('native-counts-changed')
      const listings = extractSearchResults(html).filter(job => /\bIndia\b/i.test(job.location || ''))
      if (!frame) incomplete.add('native-renderer-model-unavailable')
      else {
        if (!frame.geographyComplete) incomplete.add('native-geography-incomplete')
        if (frame.indiaIds.size !== listings.length || listings.some(job => !frame.indiaIds.has(nativeRoleId(job.sourceUrl)))) incomplete.add('native-India-listings-disagree')
        for (const [id, identity] of frame.identities) { if (opening.has(id)) incomplete.add('duplicate-native-role'); opening.set(id, identity) }
      }

      for (const job of listings) {
        if (seenJobIds.has(job.jobId)) { incomplete.add('duplicate-India-role'); continue }
        seenJobIds.add(job.jobId)
        nativeRoleId(job.sourceUrl)
        if (jobLimit != null && jobs.length >= jobLimit) { incomplete.add('caller-cap'); continue }

        jobs.push({
          ...job,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: now(),
        })

      }

      if (jobLimit != null && jobs.length >= jobLimit) break
      if (!summary.hasNext || (summary.totalPages && pagesFetched >= summary.totalPages)) {
        break
      }

      const candidateNextPageUrl = extractNextPageUrl(html)
      if (!candidateNextPageUrl || candidateNextPageUrl === nextPageUrl) {
        incomplete.add('next-page-unavailable'); break
      }

      nextPageUrl = candidateNextPageUrl
    }

    const hydrated = await hydrateSourceDescriptions(jobs, { signal, detailEnrichmentBudgetMs: options.detailEnrichmentBudgetMs,
      fetchDetail: async (job, { signal: detailSignal }) => {
        const response = await fetchText(job.sourceUrl, { signal: detailSignal, includeResponseMetadata: true })
        const detail = readNativeRoleDetail(job, response)
        detailMetadata.set(job.jobId, detail)
        return detail
      } })
    if (total === null || opening.size !== total || indiaCount === null || jobs.length !== indiaCount) incomplete.add('native-inventory-not-reconciled')
    if (hydrated.some(job => job.sourceDetailComplete !== true)) incomplete.add('native-full-details-incomplete')
    if (!incomplete.size) {
      const closing = new Map()
      for (let page = 0; page < pageUrls.length; page++) {
        const frame = readNativeSearchFrame(await get(pageUrls[page]), page + 1); pagesFetched++
        if (!frame || frame.total !== total || frame.indiaCount !== indiaCount || !frame.geographyComplete) { incomplete.add('closing-native-count-or-scope-changed'); continue }
        for (const [id, identity] of frame.identities) { if (closing.has(id)) incomplete.add('duplicate-closing-role'); closing.set(id, identity) }
      }
      if (closing.size !== opening.size || [...opening].some(([id, identity]) => closing.get(id) !== identity)) incomplete.add('closing-native-inventory-changed')
    }
    const complete = incomplete.size === 0
    return attachInventoryEvidence(hydrated.map(job => ({ ...job, ...detailMetadata.get(job.jobId), company: COMPANY,
      nativeEmployer: detailMetadata.get(job.jobId)?.nativeEmployer || null, sourceListingComplete: complete })), {
      status: complete ? 'complete-inventory' : 'coverage-gap', surface: verifiedSearchUrl, firstParty: true,
      listingComplete: complete, pagesFetched, reportedTotal: total, indiaFacetCount: indiaCount, verifiedAt: now(),
      reason: complete ? 'native-global-model-India-facet-full-details-and-closing-inventory-reconciled' : [...incomplete].join(';'),
    })
  },
})

export const run = async (options = {}) => createAnsysScraper().run(options)

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
