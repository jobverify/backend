import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createPhenomScraper } from '../../scraper-support/phenom/engine.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

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
  const match = String(html ?? '').match(/window\.__PRELOAD_STATE__\s*=\s*([\s\S]*?);\s*window\.__BUILD__/)
  if (!match || !/<title>\s*Search Jobs at Avantor\s*<\/title>/i.test(html)) {
    throw new Error('Avantor current first-party jobs inventory is missing')
  }
  const search = JSON.parse(match[1])?.jobSearch
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

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36' },
  label: 'avantor', timeoutMs: 15000, signal,
})

export const run = async ({ fetchText = defaultFetchText, signal, maxPages = MAX_PAGES, maxJobs = Infinity } = {}) => {
  signal?.throwIfAborted()
  const listings = []
  const seenIds = new Set()
  let total = null
  let complete = false
  for (let page = 1; page <= Math.min(maxPages, MAX_PAGES); page += 1) {
    signal?.throwIfAborted()
    const search = extractSearchPayload(await fetchText(buildSearchResultsPageUrl(page), { signal }), page)
    signal?.throwIfAborted()
    if (total === null) total = search.totalJob
    if (search.totalJob !== total || total > MAX_PAGES * PAGE_SIZE || maxJobs < total
      || search.jobs.length !== Math.min(PAGE_SIZE, total - listings.length)) {
      throw new Error('Avantor current India inventory is incomplete or changed during pagination')
    }
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
  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'avantor')
}
