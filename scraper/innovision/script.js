import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { activeHead, decodeNativeEntities, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { createFirstPartyDocumentReader } from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

import { INNOVISION_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = INNOVISION_CATALOG
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const SOURCE = PROVIDER_METADATA.source
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const APPLICATION_URL = PROVIDER_METADATA.applicationUrl

const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/, '')

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeOptionalValue = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized || null
}

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

// Read visibility in the original document before separating cards. A hidden
// ancestor must never become active when its children are read in isolation.
const nonContent = new Set(['head', 'script', 'style', 'title', 'meta', 'svg', 'iframe', 'object',
  'blockquote', 'q', 'cite', 'code', 'pre', 'samp', 'del', 's'])
const activeSurface = html => {
  const document = readNativeDocument(html)
  const nodes = []
  const walk = node => {
    if (typeof node === 'string' || node.inert || nonContent.has(node.tag)) return
    nodes.push(node)
    for (const child of node.children) walk(child)
  }
  walk(document.nodes(() => true)[0])
  return { document, nodes }
}
const openingEvents = (document, root) => {
  const events = []
  const blocks = new Set(['p', 'div', 'section', 'article', 'li', 'ul', 'ol', 'span', 'button', 'br'])
  let line = ''
  const flush = () => {
    const value = line.replace(/\s+/g, ' ').trim()
    if (value) events.push({ text: value })
    line = ''
  }
  const walk = node => {
    if (typeof node === 'string') { line += decodeNativeEntities(node); return }
    if (node.inert || nonContent.has(node.tag)) return
    if (/^h[1-6]$/.test(node.tag)) {
      flush()
      events.push({ text: document.text(node), level: Number(node.tag[1]) })
      return
    }
    if (blocks.has(node.tag)) flush()
    for (const child of node.children) walk(child)
    if (blocks.has(node.tag)) flush()
  }
  walk(root)
  flush()
  return events
}

// Inspect every written country phrase in this one role's own location field.
// Short ISO/state labels and city names are not country declarations here.
const writtenCountries = new Set()
for (let first = 65; first <= 90; first += 1) for (let second = 65; second <= 90; second += 1) {
  const name = nativeCountryName(String.fromCharCode(first, second))
  if (name) writtenCountries.add(name)
}
const countryPatterns = [...writtenCountries].map(country => [country,
  new RegExp('(?:^|[^\\p{L}])' + country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^\\p{L}])', 'iu')])

const normalizeLocation = (value) => {
  const raw = normalizeOptionalValue(value)
  if (!raw) {
    return {
      location: null,
      city: null,
      state: null,
      country: null,
    }
  }

  if (/^pan india$/i.test(raw)) {
    return {
      location: 'Pan India',
      city: null,
      state: null,
      country: 'India',
    }
  }

  // A written country qualifies a country. Cities, regions and two-letter
  // state abbreviations do not acquire the catalog's India filter as a fact.
  const supplied = countryPatterns.filter(([, pattern]) => pattern.test(raw)).map(([country]) => country)
  const country = supplied.length === 1 ? supplied[0] : null
  return {
    location: raw,
    city: /,/.test(raw) || /^(multiple locations|delhi ncr)$/i.test(raw) || country ? null : raw,
    state: null,
    country,
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeOptionalValue(value)
  if (!normalized) return null
  if (/full[\s-]?time/i.test(normalized)) return 'Full-time'
  if (/part[\s-]?time/i.test(normalized)) return 'Part-time'
  if (/contract/i.test(normalized)) return 'Contract'
  if (/intern/i.test(normalized)) return 'Internship'
  return normalized
}

export const extractApplyEmail = (html) => {
  return activeSurface(html).nodes.some(node => node.tag === 'a' && node.attrs.href === APPLICATION_URL) ? APPLICATION_URL : null
}

export const hasOfficialCareersSignal = (page) => {
  const html = typeof page === 'string' ? page : page?.html
  const status = typeof page === 'string' ? 200 : Number(page?.status)
  const finalUrl = normalizeUrl(typeof page === 'string' ? CAREERS_PAGE_URL : page?.url || page?.finalUrl)
  const titles = activeHead(html).titles
  const { document, nodes } = activeSurface(html)
  const labels = nodes.filter(node => /^h[1-6]$/.test(node.tag)).map(document.text)

  return status === 200
    && finalUrl === normalizeUrl(CAREERS_PAGE_URL)
    && titles.length === 1
    && /^careers\s*\|\s*innovision security\s*\|\s*innovision limited$/i.test(titles[0])
    && labels.some(label => /^careers at innovision$/i.test(label))
    && labels.filter(label => /^current openings$/i.test(label)).length === 1
    && extractApplyEmail(html) === APPLICATION_URL
}

export const extractOpenings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Innovision verified careers page no longer matches the trusted public surface')
  }

  const applyUrl = extractApplyEmail(html)
  if (!applyUrl) {
    throw new Error('Innovision verified careers page no longer exposes the shared application email')
  }

  const { document, nodes } = activeSurface(html)
  const start = nodes.findIndex(node => /^h[1-6]$/.test(node.tag) && /^current openings$/i.test(document.text(node)))
  const openingLevel = Number(nodes[start].tag[1])
  const end = nodes.findIndex((node, at) => at > start && /^h[1-6]$/.test(node.tag) && Number(node.tag[1]) <= openingLevel)
  const cards = nodes.slice(start + 1, end < 0 ? nodes.length : end)
    .filter(node => node.tag === 'div' && (document.hasClass(node, 'group') || document.hasClass(node, 'opening-card')))
  const jobs = []
  const seen = new Set()
  for (const card of cards) {
    const events = openingEvents(document, card)
    const headings = events.filter(event => event.level)
    if (headings.length !== 1 || headings[0].level <= openingLevel
      || events.filter(event => /^apply now$/i.test(event.text)).length !== 1) {
      throw new Error('Innovision verified native role card changed shape')
    }
    const heading = headings[0]
    const title = heading.text
    const lines = events.filter(event => !event.level).map(event => event.text).filter(line => !/^(?:apply now|•)$/i.test(line))

    const [rawLocation, rawEmploymentType, rawDepartment] = lines
    if (lines.length !== 3 || !rawLocation || !rawEmploymentType || !rawDepartment) {
      throw new Error('Innovision verified inline openings changed shape')
    }

    const locationBits = normalizeLocation(rawLocation)
    const jobId = slugify(title)
    if (!jobId || seen.has(jobId) || !locationBits.location) {
      throw new Error('Innovision verified inline openings changed shape')
    }

    seen.add(jobId)
    jobs.push({
      title: normalizeWhitespace(title),
      company: COMPANY_NAME,
      department: normalizeOptionalValue(rawDepartment),
      location: locationBits.location,
      city: locationBits.city,
      state: locationBits.state,
      country: locationBits.country,
      jobId,
      requisitionId: null,
      sourceUrl: CAREERS_PAGE_URL,
      applyUrl,
      employmentType: normalizeEmploymentType(rawEmploymentType),
      sourceEmploymentType: normalizeOptionalValue(rawEmploymentType),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
      skipPublicExperienceEnrichment: true,
    })
  }

  if (jobs.length === 0) {
    throw new Error('Innovision verified careers page no longer exposes visible inline openings')
  }

  return jobs.sort((left, right) => left.title.localeCompare(right.title))
}

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to Innovision scraper')
  }

  return parsed.toISOString()
}

export const createInnovisionScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date(),
} = {}) => ({
  async run(options = {}) {
    const limit = options.maxJobs === undefined ? maxJobs : options.maxJobs
    if (limit !== null && (!Number.isSafeInteger(limit) || limit < 0)) throw new RangeError('Invalid Innovision result limit')
    // Historical fetchPage callbacks return HTML without complete transport
    // receipts. Preserve that seam as explicitly unverified legacy transport.
    const reader = createFirstPartyDocumentReader({ ...options, fetchPage: undefined,
      fetchText: options.fetchPage ? async (url, init) => {
        const page = await options.fetchPage(url, init)
        if (!hasOfficialCareersSignal(page)) throw new Error('The verified Innovision careers page no longer matches the trusted public surface')
        return page.html
      } : options.fetchText,
    }, { source: SOURCE, urls: [CAREERS_PAGE_URL] })
    try {
      const page = await reader.read(CAREERS_PAGE_URL)
      if (!hasOfficialCareersSignal({ ...page, html: page.body })) throw new Error('The verified Innovision careers page no longer matches the trusted public surface')
      const openings = extractOpenings(page.body)
      const scrapedAt = normalizeScrapedAt((options.now || now)())
      const jobs = (limit === null ? openings : openings.slice(0, limit)).map(job => ({
        ...job, source: SOURCE, link: job.applyUrl || job.sourceUrl, scrapedAt,
        sourceCountryScopeUnresolved: job.country === null,
        sourceJobIdKind: 'title-slug', sourceDetailComplete: false,
        sourceDetailFailureKind: 'native-role-criteria-unpublished', sourceListingComplete: false,
        sourceScopeComplete: false, lifecycleCleanupAllowed: false,
      }))
      reader.check()
      attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows',
        observedRecordCount: openings.length, observedVacancyCount: openings.length, sourceScopeComplete: false,
        companyGlobalTotal: null, companyIndiaTotal: null })
      return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: CAREERS_PAGE_URL,
        firstParty: !reader.stats().receipts.some(receipt => receipt.legacyCallbackMetadataUnverified),
        pagesFetched: reader.stats().requests, listingComplete: false, lifecycleCleanupAllowed: false,
        reportedTotal: null, indiaFacetCount: null, verifiedAt: null,
        reason: 'native-inline-role-metadata-only;full-criteria-and-company-scope-unverified;cleanup-forbidden' })
    } finally { reader.close() }
  },
})

export const run = async (options = {}) => createInnovisionScraper().run(options)

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
