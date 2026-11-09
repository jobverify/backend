import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import NEUDESIC_TECHNOLOGIES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA = NEUDESIC_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const decodeHtml = (value) => String(value ?? '')
  .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&nbsp;|&#160;/gi, ' ')
const text = (value) => decodeHtml(value)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)', Accept: 'text/html' },
  label: SOURCE, timeoutMs: 15000, signal,
})

const extractBoardJobs = (html) => {
  const page = String(html ?? '')
  if (!/<title>\s*Neudesic Global Services Careers\s*<\/title>/i.test(page)
    || !/assets\.freshteam\.com/i.test(page) || !/Open Positions/i.test(text(page))) {
    throw new Error('Neudesic jobs board no longer matches the verified first-party Freshteam surface')
  }
  const links = new Map()
  for (const match of page.matchAll(/href=["']([^"']+)["']/gi)) {
    const url = new URL(decodeHtml(match[1]), CAREERS_URL)
    const jobMatch = url.pathname.match(/^\/jobs\/([a-z0-9_-]+)\/(?!applicants(?:\/|$))[^/]+\/?$/i)
    if (url.origin !== new URL(CAREERS_URL).origin || !jobMatch) continue
    url.search = ''
    url.hash = ''
    links.set(jobMatch[1], { jobId: jobMatch[1], url: url.href })
  }
  const counts = [...page.matchAll(/<h5\b[^>]*>([\s\S]*?)<\/h5>/gi)]
    .map((match) => text(match[1]).match(/\b(\d+)\s+Open Roles?\b/i)?.[1])
    .filter((value) => value != null).map(Number)
  const total = counts.reduce((sum, count) => sum + count, 0)
  if (!counts.length || links.size !== total) {
    throw new Error('Incomplete Neudesic jobs board: listing links do not reconcile with department role counts')
  }
  return [...links.values()]
}

const extractJob = ({ html, listing, now }) => {
  let posting
  for (const match of String(html ?? '').matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let parsed
    try { parsed = JSON.parse(match[1]) } catch {
      throw new Error('Invalid Neudesic job posting JSON')
    }
    const candidates = Array.isArray(parsed) ? parsed : [parsed]
    posting = candidates.find((entry) => entry?.['@type'] === 'JobPosting') || posting
  }
  if (!posting?.title || !posting?.description || !posting?.url
    || !/^Neudesic Technologies\b/i.test(posting?.hiringOrganization?.name || '')) {
    throw new Error('Invalid Neudesic job posting: missing details or mismatched hiring organization')
  }
  const canonical = new URL(posting.url, listing.url)
  if (canonical.origin !== new URL(CAREERS_URL).origin
    || canonical.pathname.match(/^\/jobs\/([^/]+)\/[^/]+\/?$/)?.[1] !== listing.jobId) {
    throw new Error('Invalid Neudesic job posting: canonical URL does not match the requested job')
  }
  const places = Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation]
  if (!places.length || places.some((place) => !place?.address?.addressCountry)) {
    throw new Error('Invalid Neudesic job posting: missing country')
  }
  const address = places.find((place) => /^(?:India|IN)$/i.test(
    place.address.addressCountry?.name || place.address.addressCountry,
  ))?.address
  if (!address) return null
  const regions = [address.addressRegion, address.addressLocality].map(text).filter(Boolean)
  const city = regions.find((value) => /^(Bengaluru|Bangalore|Hyderabad|Kochi|Chennai|Pune|Mumbai|Noida|Delhi|Gurugram)$/i.test(value))
    || text(address.addressLocality) || regions[0]
  return {
    title: text(posting.title), company: COMPANY, jobId: listing.jobId, requisitionId: listing.jobId,
    location: [...regions, 'India'].join(', '), city, country: 'India',
    sourceUrl: listing.url, applyUrl: listing.url, link: listing.url, source: SOURCE,
    jobDescription: text(posting.description), employmentType: posting.employmentType || null,
    postingDate: String(posting.datePosted || '').match(/^\d{4}-\d{2}-\d{2}/)?.[0] || null,
    scrapedAt: now(),
  }
}

export const createNeudesicTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText, signal, now = () => new Date().toISOString() } = {}) {
    signal?.throwIfAborted()
    const board = await fetchText(CAREERS_URL, { signal })
    signal?.throwIfAborted()
    const listings = extractBoardJobs(board)
    const jobs = []
    for (const listing of listings) {
      signal?.throwIfAborted()
      const html = await fetchText(listing.url, { signal })
      signal?.throwIfAborted()
      const job = extractJob({ html, listing, now })
      if (job) jobs.push(job)
    }
    return jobs
  },
})
export const run = async (options = {}) => createNeudesicTechnologiesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
