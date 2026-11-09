import { extractLinkedinJobCards } from '../../scraper-support/utils/linkedinJobCards.js'
import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.ab-inbev.com/'
export const LINKEDIN_COMPANY_JOBS_URL = 'https://www.linkedin.com/company/ab-inbev/jobs/'
export const LINKEDIN_INDIA_JOBS_URL = 'https://www.linkedin.com/jobs/search/?f_C=255188&geoId=102713980'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#8211;|&ndash;/gi, '-')
    .replace(/&#8212;|&mdash;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'full_time' || normalized === 'full time') return 'Full-time'
  if (normalized === 'part_time' || normalized === 'part time') return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('intern')) return 'Internship'
  return normalizeWhitespace(value)
}

const parseLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) {
    return {
      location: null,
      city: null,
      country: null,
    }
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)
  const city = parts[0] || null
  const country = parts.at(-1) === 'India' ? 'India' : parts.at(-1) || null

  return {
    location: normalized,
    city,
    country,
  }
}

const detailLocationFromJsonLd = (jobPosting) => {
  const address = jobPosting?.jobLocation?.address || {}
  const parts = [
    normalizeWhitespace(address.addressLocality),
    normalizeWhitespace(address.addressRegion),
    normalizeWhitespace(address.addressCountry),
  ].filter(Boolean)

  return {
    location: parts.join(', ') || null,
    city: normalizeWhitespace(address.addressLocality),
    country: address.addressCountry === 'IN'
      ? 'India'
      : normalizeWhitespace(address.addressCountry),
  }
}

const parseJobPostingJsonLd = (html) => {
  const scripts = [...String(html ?? '').matchAll(
    /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/gi,
  )]

  for (const [, rawJson] of scripts) {
    try {
      const parsed = JSON.parse(rawJson)
      if (parsed?.['@type'] === 'JobPosting') return parsed
    } catch {
      // Skip malformed blobs and keep looking for the public JobPosting payload.
    }
  }

  return null
}

export const buildSearchUrl = () => CAREER_PAGE_URL

export const pageIndicatesLinkedinJobs = (html) => {
  const doc = document(String(html ?? ''))
  return doc.nodes(node => node.tag === 'a' && node.attrs.href === LINKEDIN_COMPANY_JOBS_URL)
    .some(node => /^(?:Search Our Jobs|Grow with us|Work with us)$/i.test(doc.text(node)))
}

export const extractSearchResults = (html) => extractLinkedinJobCards(html)
  .map(({ id: jobId, href: rawHref, title: rawTitle, company: rawCompany, location: rawLocation, datetime: postingDate }) => {
    const sourceUrl = normalizeWhitespace(rawHref)
    const title = stripTags(rawTitle)
    const company = stripTags(rawCompany)
    const locationData = parseLocation(stripTags(rawLocation))

    if (!title || !jobId || !sourceUrl || locationData.country !== 'India') return null

    return {
      title,
      company,
      department: null,
      location: locationData.location,
      city: locationData.city,
      country: locationData.country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeWhitespace(postingDate),
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html) => {
  const jobPosting = parseJobPostingJsonLd(html)
  if (!jobPosting) return {}

  const locationData = detailLocationFromJsonLd(jobPosting)

  return {
    company: normalizeWhitespace(jobPosting?.hiringOrganization?.name) || null,
    location: locationData.location,
    city: locationData.city,
    country: locationData.country,
    employmentType: normalizeEmploymentType(jobPosting?.employmentType),
    postingDate: normalizeWhitespace(jobPosting?.datePosted)?.slice(0, 10) || null,
    jobDescription: stripTags(normalizeWhitespace(jobPosting?.description)) || null,
  }
}

const defaultFetchText = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const createABInBevGccIndiaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const { signal } = options
    signal?.throwIfAborted()
    const careersHtml = await fetchText(buildSearchUrl(), { signal })

    if (!pageIndicatesLinkedinJobs(careersHtml)) {
      throw new Error('AB InBev careers page no longer exposes the expected LinkedIn jobs handoff')
    }

    const searchHtml = await fetchText(LINKEDIN_INDIA_JOBS_URL, { signal })
    signal?.throwIfAborted()
    const search = document(searchHtml)
    const employerFilters = search.nodes(node => node.tag === 'input' && node.attrs.name === 'f_C' && Object.hasOwn(node.attrs, 'checked'))
    const scoped = employerFilters.length === 1 && employerFilters[0].attrs.value === '255188'
      && search.nodes(node => node.tag === 'input' && node.attrs.name === 'location' && node.attrs.value === 'India').length > 0
    if (employerFilters.length && !scoped) throw new Error('AB InBev native employer or India filter changed')
    const counts = search.nodes(node => search.hasClass(node, 'results-context-header__job-count')).map(node => search.text(node))
    const reportedTotal = counts.length === 1 && /^\d+$/.test(counts[0]) ? Number(counts[0]) : null
    const listings = extractSearchResults(searchHtml)
    if (new Set(listings.map(job => job.jobId)).size !== listings.length) throw new Error('AB InBev duplicate native role identity')
    const selectedJobs = maxJobs ? listings.slice(0, maxJobs) : listings
    const enrichedJobs = []

    for (const listing of selectedJobs) {
      signal?.throwIfAborted()
      const detailHtml = await fetchText(listing.sourceUrl, { signal })
      signal?.throwIfAborted()
      const detail = extractJobDetail(detailHtml)
      const posting = parseJobPostingJsonLd(detailHtml)
      const doc = document(detailHtml)
      const canonicals = doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical').map(node => node.attrs.href)
      let canonicalId = null, employerMatches = false
      try {
        const canonical = new URL(canonicals[0])
        if (canonicals.length === 1 && canonical.protocol === 'https:' && /(?:^|\.)linkedin\.com$/.test(canonical.hostname)) canonicalId = canonical.pathname.match(/^\/jobs\/view\/(?:[^/]+-)?(\d+)\/?$/)?.[1]
        const employer = new URL(posting.hiringOrganization.sameAs)
        employerMatches = employer.protocol === 'https:' && /(?:^|\.)linkedin\.com$/.test(employer.hostname)
          && employer.pathname.replace(/\/$/, '') === '/company/ab-inbev'
      } catch { /* Missing identity remains a failed role contract. */ }
      if (canonicalId !== listing.jobId || !employerMatches || detail.company !== 'AB InBev'
        || stripTags(posting?.title) !== listing.title || detail.country !== 'India' || !detail.jobDescription) {
        throw new Error('AB InBev native role identity, country or full content changed')
      }

      enrichedJobs.push({
        ...listing,
        ...Object.fromEntries(
          Object.entries(detail).filter(([, value]) => value != null),
        ),
        sourceDetailComplete: true,
      })
    }

    const jobs = enrichedJobs.map((job) => ({
      ...job,
      source: 'abinbevgccindia',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
    const complete = scoped && reportedTotal !== null && reportedTotal === listings.length && jobs.length === listings.length
    return attachInventoryEvidence(jobs, { status: complete ? (reportedTotal ? 'complete-inventory' : 'verified-empty') : 'coverage-gap',
      surface: LINKEDIN_INDIA_JOBS_URL, firstParty: true, listingComplete: complete, pagesFetched: 1,
      reportedTotal, indiaFacetCount: scoped ? listings.length : null, verifiedAt: new Date().toISOString(),
      reason: complete ? 'corporate-published-exact-employer-India-count-and-role-bound-native-full-details' : 'native-exact-employer-India-count-or-complete-selection-unverified' })
  },
})

export const run = async (options = {}) => createABInBevGccIndiaScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running ABInBev GCC India scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'abinbevgccindia')
    console.log('DB result:', result)
    process.exit(0)
  }
}
