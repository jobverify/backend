import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readNativeTable, readNativeRole } from './nativeInventory.js'

import { APEXON_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = APEXON_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_AT = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const EXPLORE_JOBS_URL = PROVIDER_METADATA.exploreJobsUrl

const decodeHtmlEntities = (value) =>
  String(value ?? '')
    .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;|&#038;/gi, '&')
    .replace(/&quot;|&#34;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&#8217;|&rsquo;|&#x27;/gi, "'")
    .replace(/&#8211;|&ndash;/gi, '–')
    .replace(/&#8212;|&mdash;/gi, '—')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) =>
  decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const stripTags = (value) =>
  normalizeWhitespace(
    String(value ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|ul|ol|h[1-6])>/gi, '\n')
      .replace(/<li\b[^>]*>/gi, '\n- ')
      .replace(/<[^>]+>/g, ' '),
  )

const extractMatch = (value, pattern) => String(value ?? '').match(pattern)?.[1] ?? null

const toAbsoluteUrl = (value) => {
  try {
    return new URL(decodeHtmlEntities(value), HOMEPAGE_URL).toString()
  } catch {
    return null
  }
}

const getCityFromLocation = (location) => normalizeText(location?.split(',')[0])

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*(?:Apexon - Enterprise AI, Data (?:&amp;|&) Digital Engineering Solutions|Enterprise AI, Data, and Agentic Engineering \| Apexon)\s*<\/title>/i.test(page)
    && text.includes('Peak Ingenuity')
    && (
      /href=["']\/about\/careers\/["']/i.test(page)
      || /href=["']https:\/\/www\.apexon\.com\/about\/careers\/["']/i.test(page)
    )
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Apexon Careers (?:&amp;|&) Work Culture and Values - Apexon\s*<\/title>/i.test(page)
    && text.includes('Careers')
    && text.includes('click here to view')
    && /href=["']\/explore-jobs\/["']/i.test(page)
}

export const extractExploreJobsUrl = (html) =>
  toAbsoluteUrl(
    extractMatch(
      html,
      /<a[^>]+href=["']([^"']*\/explore-jobs\/?)["'][^>]*>\s*click here to view\s*<\/a>/i,
    ),
  )

export const hasOfficialExploreJobsSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)
  let titles
  try {
    const document = readNativeDocument(page)
    const root = document.nodes(node => node.tag === 'root')[0]
    const html = root?.children.find(node => typeof node !== 'string' && node.tag === 'html')
    const heads = html?.children.filter(node => typeof node !== 'string' && node.tag === 'head') || []
    if (heads.length !== 1) return false
    // The first HTML title owns document.title, including hidden/inert titles.
    // Later WordPress SEO titles and body titles do not replace that authority.
    titles = heads[0].children.filter(node => typeof node !== 'string' && node.tag === 'title')
      .map(node => normalizeWhitespace(node.raw || ''))
  } catch { return false }

  return titles.length > 0
    && /^Job Search, Job Opportunities & Openings in (?:India|USA) - Apexon$/i.test(titles[0])
    && text.includes('Explore Jobs')
    && text.includes('Job Title')
    && text.includes('Openings')
    && text.includes('Location')
    && /career-job-detail\/\?id=0&amp;jobid=\d+/i.test(page)
    && text.includes('Find out more')
}

export const extractListingCards = (html, { allLocations = false } = {}) =>
  [...String(html ?? '').matchAll(
    /<div class="table_row">[\s\S]*?<div class="table_small jobTitle">[\s\S]*?<a href="([^"]*career-job-detail\/\?id=\d+&amp;jobid=(\d+))" title="([^"]+)">[\s\S]*?<\/a>[\s\S]*?<div class="table_small openPosiTitle">[\s\S]*?<a [^>]*>(\d+)<\/a>[\s\S]*?<div class="table_small locationTitle">[\s\S]*?<a [^>]*>([^<]+)<\/a>[\s\S]*?Find out more[\s\S]*?<\/div>\s*<\/div>/gi,
  )]
    .map((match) => ({
      title: normalizeText(match[3]),
      requisitionId: normalizeText(match[2]),
      openings: normalizeText(match[4]),
      location: normalizeText(match[5]),
      sourceUrl: toAbsoluteUrl(match[1]),
    }))
    .filter((listing) =>
      listing.title
      && listing.requisitionId
      && listing.openings
      && listing.location
      && listing.sourceUrl && (allLocations || /\bIndia\b/i.test(listing.location)))

export const hasOfficialDetailPageSignal = (html) => {
  const page = String(html ?? '')

  return /Career Job Detail/i.test(page)
    && /<h1 class="jobtitle dtitle text-left">[\s\S]*?<\/h1>/i.test(page)
    && /Job Reference No#:/i.test(page)
    && /Open Positions:/i.test(page)
    && /href=["']https:\/\/apexon\.talentrecruit\.com\/career-page\/apply\/[^"']+["']/i.test(page)
    && /<div class="jobcontent">/i.test(page)
}

const extractDetailPageData = (html, listing) => {
  if (!hasOfficialDetailPageSignal(html)) {
    throw new Error('Apexon detail page no longer matches the verified first-party surface')
  }

  const identity = readNativeRole(html)
  const title = identity.title
  if (identity.requisitionId !== listing.requisitionId || title !== listing.title
    || identity.location !== listing.location || !/\bIndia\b/i.test(identity.location || '')) {
    throw new Error('Apexon native detail requisition, title or country identity changed')
  }
  const applyUrl = identity.applyUrl
  const requiredSkills = identity.requiredSkills

  return {
    title,
    company: COMPANY,
    department: null,
    location: listing.location,
    city: getCityFromLocation(listing.location),
    country: 'India',
    jobId: `${SOURCE}-${listing.requisitionId}`,
    requisitionId: listing.requisitionId,
    sourceUrl: listing.sourceUrl,
    applyUrl,
    employmentType: null,
    workplaceType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    compensation: null,
    postingDate: null,
    closingDate: null,
    jobDescription: identity.description,
    sourceDescription: identity.description,
    sourceDetailComplete: true,
    sourceDetailUrl: listing.sourceUrl,
    nativeSourceRecord: { listing, detail: identity,
      documentSHA256: createHash('sha256').update(html).digest('hex') },
    nativeHiringOrganization: { name: 'Apexon' },
    nativeEmployerBinding: { method: 'explicit-first-party-role-employer-statement',
      statement: identity.employerStatement, legalEmployer: null },
    sourceScopeComplete: false,
    sourceListingComplete: false,
    lifecycleCleanupAllowed: false,
    applicationVisited: false,
    companyCareerPage: CAREERS_URL,
  }
}

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  label: SOURCE,
  timeoutMs: 15000,
  attempts: 1,
  redirect: 'manual',
  signal: options.signal,
  includeResponseMetadata: options.includeResponseMetadata === true,
})

export const createApexonScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow, signal } = {}) {
    const get = async url => {
      signal?.throwIfAborted()
      const response = await fetchText(url, { signal, includeResponseMetadata: true })
      signal?.throwIfAborted()
      if (typeof response === 'string') return response
      if (response?.status !== 200 || response.url !== url) throw new Error('Apexon first-party response identity changed')
      return response.html
    }
    const homepageHtml = await get(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Apexon verified official homepage no longer matches the trusted first-party surface')
    }

    const careersHtml = await get(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Apexon verified careers page no longer matches the trusted first-party surface')
    }

    const exploreJobsUrl = extractExploreJobsUrl(careersHtml)
    if (exploreJobsUrl !== EXPLORE_JOBS_URL) {
      throw new Error('Apexon verified careers page no longer links to the expected explore-jobs surface')
    }

    const exploreJobsHtml = await get(EXPLORE_JOBS_URL)
    if (!hasOfficialExploreJobsSignal(exploreJobsHtml)) {
      throw new Error('Apexon verified explore-jobs page no longer matches the trusted first-party surface')
    }

    const inventory = readNativeTable(exploreJobsHtml, extractListingCards)
    const { listings } = inventory
    if (listings.length === 0) {
      throw new Error('Apexon explore-jobs page no longer exposes verified first-party listing rows')
    }

    const jobs = [], detailFailures = []
    let detailError
    for (const listing of listings) {
      try {
        const detailHtml = await get(listing.sourceUrl)
        jobs.push(extractDetailPageData(detailHtml, listing))
      } catch (error) {
        signal?.throwIfAborted()
        detailError = error
        detailFailures.push({ requisitionId: listing.requisitionId, url: listing.sourceUrl, reason: error.message })
        inventory.reasons.add('native-detail-collection-incomplete')
        // A later unavailable or changed role cannot discard earlier own,
        // fully validated roles. Stop reading after that failure.
        break
      }
    }
    if (!jobs.length && detailError) throw detailError
    let pagesFetched = 1
    if (inventory.complete && !detailFailures.length) {
      const closingHtml = await get(EXPLORE_JOBS_URL)
      pagesFetched++
      if (!hasOfficialExploreJobsSignal(closingHtml)) throw new Error('Apexon closing jobs page identity changed')
      const closing = readNativeTable(closingHtml, extractListingCards)
      if (!closing.complete || closing.total !== inventory.total || closing.identities.size !== inventory.identities.size
        || [...inventory.identities].some(([id, identity]) => closing.identities.get(id) !== identity)) inventory.reasons.add('closing-native-inventory-changed')
    }
    const complete = inventory.reasons.size === 0
    return attachInventoryEvidence(jobs.map((job) => ({
      ...job,
      nativeBoardListingComplete: complete,
      nativeCollectionFailures: detailFailures,
      source: SOURCE,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    })), { status: 'coverage-gap', surface: EXPLORE_JOBS_URL,
      firstParty: true, listingComplete: false, reportedTotal: inventory.total,
      indiaFacetCount: listings.length, pagesFetched, verifiedAt: (overrideNow || now)(),
      reason: complete ? 'native-table-reconciled;company-wide-scope-unverified' : [...inventory.reasons].join(';') })
  },
})

export const run = async (options = {}) => createApexonScraper().run(options)

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
