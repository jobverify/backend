import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

import { createPhenomScraper } from '../../scraper-support/phenom/engine.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readParadoxPreload } from '../../scraper-support/shared/paradoxPublicInventory.js'
import { activeHead } from '../../scraper-support/utils/activeNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const BASE_URL = 'https://careers.avantorsciences.com'
const PAGE_SIZE = 10
const MAX_PAGES = 50

// Reuse the shared JSON-LD description and experience normalization for the new career site.
const { extractJobDetail: normalizeDetail } = createPhenomScraper({
  companyName: 'Avantor', source: 'avantor', baseUrl: BASE_URL, scraperDir: currentDir,
})

export const buildSearchResultsPageUrl = (page = 1) => {
  if (!Number.isSafeInteger(page) || page < 1) throw new Error('Avantor page must be positive')
  return BASE_URL + '/jobs/page/' + page + '?filter[country][0]=India'
}

export const extractSearchPayload = (html, page = 1) => {
  const { titles } = activeHead(html)
  const state = readParadoxPreload(html)
  if (!state || titles.length !== 1 || titles[0] !== 'Search Jobs at Avantor') {
    throw new Error('Avantor current first-party jobs inventory is missing')
  }
  const search = state.jobSearch
  if (!Array.isArray(search?.jobs) || !Number.isSafeInteger(search?.totalJob) || search.totalJob < 0
    || search.isLoading !== false || Number(search.params?.page_number) !== page
    || search.params?.filter?.country?.length !== 1 || search.params.filter.country[0] !== 'India') {
    throw new Error('Avantor current India inventory filter or page contract changed')
  }
  return search
}

export const extractSearchResults = (search) => search.jobs.map((job) => {
  const jobId = job?.requisitionID
  const location = job?.locations?.find((item) => item.country === 'India')
  const sourceUrl = new URL(job?.originalURL || '', BASE_URL + '/').toString()
  const applyUrl = job?.applyURL
  let apply
  try { apply = new URL(applyUrl) } catch { throw new Error('Avantor application URL is missing') }
  if (!/^R-\d+$/.test(jobId || '') || !job.title?.trim() || !location?.locationText
    || new URL(sourceUrl).origin !== BASE_URL || !new URL(sourceUrl).pathname.endsWith('/job/' + jobId)
    || apply.origin !== 'https://olivia.paradox.ai' || apply.pathname !== '/co/Avantor1/Job'
    || !new RegExp('^' + jobId + '_\\d+$').test(apply.searchParams.get('job_id') || '')) {
    throw new Error('Avantor current India listing identity, location or application URL changed')
  }
  return {
    title: job.title, jobId, requisitionId: jobId,
    location: location.locationText, city: location.city || null, state: location.state || null,
    country: 'India', sourceUrl, applyUrl,
    department: job.customFields?.find((field) => field.cfKey === 'cf_job_family')?.value || null,
    remoteStatus: job.isRemote || location.isRemote ? 'Remote' : 'On-site',
  }
})

export const extractJobDetail = (html, listing) => {
  const postings = [...String(html).matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => JSON.parse(match[1])).filter((value) => value?.['@type'] === 'JobPosting')
  const posting = postings.length === 1 ? postings[0] : null
  if (!posting || posting.identifier?.value !== listing.jobId || posting.hiringOrganization?.name !== 'Avantor' || posting.url !== listing.sourceUrl
    || posting.title !== listing.title || !posting.description?.trim()
    || ![].concat(posting.jobLocation || []).some((place) => ['IN', 'India'].includes(place.address?.addressCountry))) {
    throw new Error('Avantor current job detail identity, India scope or description changed')
  }
  const detail = normalizeDetail(html, listing)
  if (!detail.jobDescription) throw new Error('Avantor current job description is missing')
  return { ...listing, ...detail }
}

const defaultFetchText = async (url, { signal } = {}) => {
  const response = await fetchTextWithRetry(url, {
  headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36' },
    label: 'avantor', timeoutMs: 15000, signal, redirect: 'manual', includeResponseMetadata: true,
  })
  signal?.throwIfAborted()
  if (response.status !== 200 || response.url !== new URL(url).href) {
    throw Object.assign(new Error('Avantor native response identity changed: HTTP ' + response.status), {
      softFailure: true, abortRetries: true, failureKind: 'parser_or_contract_error',
      lifecycleCleanupAllowed: false, sourceScopeComplete: false,
    })
  }
  return response.html
}

export const run = async ({ fetchText = defaultFetchText, signal, maxPages = MAX_PAGES, maxJobs = Infinity } = {}) => {
  signal?.throwIfAborted()
  const listings = []
  const openingPages = []
  let pagesFetched = 0
  const seenIds = new Set()
  let total = null
  let complete = false
  for (let page = 1; page <= Math.min(maxPages, MAX_PAGES); page += 1) {
    signal?.throwIfAborted()
    const search = extractSearchPayload(await fetchText(buildSearchResultsPageUrl(page), { signal }), page)
    signal?.throwIfAborted()
    pagesFetched += 1
    if (total === null) total = search.totalJob
    if (search.totalJob !== total || total > MAX_PAGES * PAGE_SIZE || maxJobs < total
      || search.jobs.length !== Math.min(PAGE_SIZE, total - listings.length)) {
      throw new Error('Avantor current India inventory is incomplete or changed during pagination')
    }
    openingPages.push({ page, jobs: structuredClone(search.jobs) })
    for (const listing of extractSearchResults(search)) {
      if (seenIds.has(listing.jobId)) throw new Error('Avantor current India inventory contains duplicate requisitions')
      seenIds.add(listing.jobId)
      listings.push(listing)
    }
    if (listings.length === total) { complete = true; break }
  }
  if (!complete) throw new Error('Avantor current India inventory pagination is incomplete')
  const jobs = []
  for (const listing of listings) {
    signal?.throwIfAborted()
    const detail = extractJobDetail(await fetchText(listing.sourceUrl, { signal }), listing)
    signal?.throwIfAborted()
    jobs.push({ ...detail, company: 'Avantor', source: 'avantor', link: listing.applyUrl, scrapedAt: new Date().toISOString() })
  }
  for (const opening of openingPages) {
    signal?.throwIfAborted()
    const closing = extractSearchPayload(await fetchText(buildSearchResultsPageUrl(opening.page), { signal }), opening.page)
    signal?.throwIfAborted()
    pagesFetched += 1
    if (closing.totalJob !== total || !isDeepStrictEqual(closing.jobs, opening.jobs)) {
      throw new Error('Avantor closing India inventory changed during detail acquisition')
    }
  }
  return attachInventoryEvidence(jobs, {
    status: total === 0 ? 'verified-empty' : 'complete-inventory',
    surface: buildSearchResultsPageUrl(), firstParty: true, listingComplete: true,
    pagesFetched, reportedTotal: total, indiaFacetCount: jobs.length,
    verifiedAt: new Date().toISOString(),
    reason: 'avantor-current-india-filter-unique-requisitions-native-details-and-closing-reconciled',
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'avantor')
}
