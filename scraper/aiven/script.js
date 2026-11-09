import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

import provider from './provider.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = provider
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
  signal,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*Careers\s*(?:&|&amp;)\s*Jobs\s+at\s+Aiven/i.test(page)
    && /(?:og:url|canonical)["'][^>]+https:\/\/aiven\.io\/careers\/job/i.test(page)
    && />\s*Open positions\s*</i.test(page)
    && /(?:\/careers\/job\/\d+|https:\/\/careers\.aiven\.io\/openings\/\d+)/i.test(page)
}

const isOfficialRoleUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
      && ((url.hostname === 'aiven.io' && /^\/careers\/job\/\d+\/?$/.test(url.pathname))
        || (url.hostname === 'careers.aiven.io' && /^\/openings\/\d+\/?$/.test(url.pathname)))
  } catch { return false }
}

export const extractIndiaJobUrls = (html = '') => {
  const matches = String(html ?? '').matchAll(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )

  const urls = []
  const seen = new Set()

  for (const match of matches) {
    const label = stripTags(match[2]) || ''
    if (!/\bIndia\b/i.test(label)) continue

    const url = toAbsoluteUrl(match[1])
    if (!url || !isOfficialRoleUrl(url) || seen.has(url)) continue

    seen.add(url)
    urls.push(url)
  }

  return urls
}

const extractHeading = (html = '') =>
  stripTags(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1])

const splitHeadingLocation = (heading) => {
  const normalized = normalizeWhitespace(heading)
  const match = normalized?.match(/^(.*)\s+([^,]+),\s*([^,]+),\s*(India)$/i)
  if (!match) return null

  const city = normalizeWhitespace(match[2])
  const state = normalizeWhitespace(match[3])
  const country = normalizeWhitespace(match[4])
  const location = [city, state, country].filter(Boolean).join(', ')
  const title = normalizeWhitespace(match[1])

  if (!title || !location) return null

  return { title, city, state, country, location }
}

const extractJobIdFromUrl = (url) => normalizeWhitespace(String(url ?? '').match(/\/(?:careers\/job|openings)\/(\d+)/i)?.[1])

const extractDetailFragments = (html = '') => {
  const truncated = String(html ?? '').split(/How to Recognize and Avoid Employment Scams:/i)[0]
  return [...truncated.matchAll(/<(p|h2|h3|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((match) => stripTags(match[2]))
    .filter(Boolean)
    .filter((value) => !/^apply now$/i.test(value))
    .filter((value) => !/^see all job listings$/i.test(value))
}

const buildJobDescription = (html = '', heading = null) => {
  const fragments = extractDetailFragments(html)
    .filter((value) => value !== heading)

  return normalizeWhitespace(fragments.join(' '))
}

export const extractJobFromDetail = (url, html = '') => {
  if (!isOfficialRoleUrl(url)) return null
  for (const match of String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let posting
    try { posting = JSON.parse(match[1]) } catch { continue }
    if (posting?.['@type'] !== 'JobPosting') continue
    const address = posting.jobLocation?.address
    const country = address?.addressCountry
    if (posting.hiringOrganization?.name !== 'Aiven' || !/^(?:IN|India)$/i.test(country || '')) return null
    const title = stripTags(posting.title)
    const jobDescription = stripTags(posting.description)
    if (!title || !jobDescription || (posting.url && posting.url !== url)) return null
    const location = [address.addressLocality, address.addressRegion, 'India'].filter(Boolean).join(', ')
    return { title, company: COMPANY, department: null, location, city: address.addressLocality || null,
      state: address.addressRegion || null, country: 'India', jobId: extractJobIdFromUrl(url),
      requisitionId: extractJobIdFromUrl(url), sourceUrl: url, applyUrl: url,
      jobDescription, postingDate: posting.datePosted || null, closingDate: posting.validThrough || null,
      employmentType: posting.employmentType || null }
  }
  const heading = extractHeading(html)
  const parsedHeading = splitHeadingLocation(heading)
  const jobId = extractJobIdFromUrl(url)

  if (!parsedHeading || !jobId) return null

  return {
    title: parsedHeading.title,
    company: COMPANY,
    department: null,
    location: parsedHeading.location,
    city: parsedHeading.city,
    state: parsedHeading.state,
    country: parsedHeading.country,
    jobId,
    requisitionId: jobId,
    sourceUrl: url,
    applyUrl: url,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription(html, heading),
  }
}

export const createAivenScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    const listingHtml = await fetchText(CAREERS_URL, { signal })
    if (!hasOfficialCareersSignal(listingHtml)) {
      throw new Error('Response is not the verified official Aiven careers listing')
    }

    const indiaJobUrls = extractIndiaJobUrls(listingHtml)
    const jobs = []
    const allRoleUrls = new Set([...String(listingHtml).matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)]
      .map(match => toAbsoluteUrl(match[1])).filter(isOfficialRoleUrl))
    const reportedTotal = Number(stripTags(listingHtml)?.match(/\b(\d+)\s+jobs\b/i)?.[1])
    const listingComplete = Number.isInteger(reportedTotal) && reportedTotal === allRoleUrls.size

    for (const url of indiaJobUrls) {
      const detailHtml = await fetchText(url, { signal })
      const job = extractJobFromDetail(url, detailHtml)
      if (!job) throw new Error('Aiven first-party careers surface no longer exposes trusted public Aiven India jobs: ' + url)
      jobs.push(job)
    }

    if (indiaJobUrls.length && !jobs.length) {
      throw new Error('Aiven first-party careers surface no longer exposes trusted public Aiven India jobs')
    }

    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return attachInventoryEvidence(selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    })), { status: listingComplete && selectedJobs.length === jobs.length ? (reportedTotal ? 'complete-inventory' : 'verified-empty') : 'coverage-gap',
      surface: CAREERS_URL, firstParty: true, listingComplete: listingComplete && selectedJobs.length === jobs.length,
      reportedTotal: Number.isInteger(reportedTotal) ? reportedTotal : null, indiaFacetCount: indiaJobUrls.length,
      pagesFetched: 1, verifiedAt: now(), reason: 'employer-published-role-links-reconciled-with-current-listing-count' })
  },
})

export const run = async (options = {}) => createAivenScraper().run(options)

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
