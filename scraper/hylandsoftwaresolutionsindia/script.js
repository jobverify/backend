import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { HYLAND_SOFTWARE_SOLUTIONS_INDIA_LLP_CATALOG } from './catalog.js'
import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = HYLAND_SOFTWARE_SOLUTIONS_INDIA_LLP_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_SEARCH_URL = PROVIDER_METADATA.jobsSearchUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&amp;/gi, '&')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#8217;|&rsquo;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')

const normalizeWhitespace = (value) => decodeHtml(String(value ?? ''))
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const toAbsoluteUrl = (value, baseUrl = JOBS_SEARCH_URL) => {
  if (!value) return null

  try {
    return new URL(decodeHtml(value), baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeLocation = (value) => normalizeWhitespace(value).replace(/\s+Office$/i, '')

const isIndiaLocation = (value) => /\bIndia\b/i.test(normalizeLocation(value))

const toCity = (location = '') => {
  const normalized = normalizeLocation(location)
  if (!normalized || /remote\s*-\s*india/i.test(normalized)) return null

  const match = normalized.match(/^([A-Za-z][A-Za-z\s-]+?)\s+India\b/i)
  return match ? match[1].trim() : null
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Careers\s*\|\s*Explore Opportunities Across the Globe\s*\|\s*Hyland\s*<\/title>/i.test(page)
    && /Explore opportunities across the globe/i.test(normalized)
    && /Join our team/i.test(normalized)
    && /Fraud alert/i.test(normalized)
    && /careers-hyland\.icims\.com\/jobs\/search\?ss=1(?:&amp;|&|\\u0026)hashed=-435679902/i.test(page)
    && /careers-hyland\.icims\.com\/jobs\/intro\?hashed=-435679902/i.test(page)
}

const requireNative = (condition, message) => {
  if (!condition) throw new Error(`Hyland native listings: ${message}`)
}

const SEARCH_ORIGIN = 'https://careers-hyland.icims.com'
const MAX_LISTING_PAGES = 100
const listingUrl = index => `${SEARCH_ORIGIN}/jobs/search?pr=${index}&in_iframe=1`

const readSearchUrl = (value, { canonical = false } = {}) => {
  requireNative(typeof value === 'string' && !/[\u0000-\u0020\u007f]/.test(value), 'invalid search URL')
  const url = new URL(decodeHtml(value), JOBS_SEARCH_URL)
  requireNative(url.origin === SEARCH_ORIGIN && url.pathname === '/jobs/search'
    && !url.username && !url.password && !url.hash, 'unreviewed search account or route')
  const entries = [...url.searchParams]
  requireNative(entries.length === (canonical ? 1 : 2)
    && entries.every(([key]) => (canonical ? ['pr'] : ['pr', 'in_iframe']).includes(key))
    && url.searchParams.getAll('pr').length === 1
    && /^\d+$/.test(url.searchParams.get('pr'))
    && (canonical || url.searchParams.getAll('in_iframe').length === 1
      && url.searchParams.get('in_iframe') === '1'), 'unreviewed search query')
  const index = Number(url.searchParams.get('pr'))
  requireNative(Number.isSafeInteger(index) && index < MAX_LISTING_PAGES, 'page bound exceeded')
  return { url: url.toString(), index }
}

const nativeLinks = (doc, tag, rel) => doc.nodes(node => node.tag === tag
  && String(node.attrs.rel || '').toLowerCase() === rel)

const readListingsProfile = (html, requestedUrl) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const title = 'Careers at Hyland | Jobs in Software at Hyland | Job Listings at Hyland'
  const doc = readNativeDocument(page, { sourceRanges: true })
  const headings = doc.nodes(node => node.tag === 'h2' && doc.hasClass(node, 'iCIMS_SubHeader_Jobs'))
  if (!headings.length) {
    requireNative(/<title>\s*Careers at Hyland\s*\|\s*Jobs in Software at Hyland\s*\|\s*Job Listings at Hyland\s*<\/title>/i.test(page)
      && normalized.includes('Here are our current job openings.')
      && normalized.includes('Use this form to perform another job search')
      && normalized.includes('Please enable cookies in your browser'), 'unreviewed legacy listing profile')
    return { kind: 'legacy', doc }
  }
  const titles = activeHead(page).titles
  requireNative(titles.length === 1 && titles[0] === title
    && normalized.includes('Use this form to perform another job search')
    && normalized.includes('Please enable cookies in your browser'), 'changed native listing identity')
  requireNative(headings.length === 1, 'ambiguous page declaration')
  const number = doc.text(headings[0]).match(/^Search Results Page ([1-9]\d*) of ([1-9]\d*)$/)
  requireNative(number, 'unreviewed native page declaration')
  const ordinal = Number(number[1]), total = Number(number[2])
  requireNative(Number.isSafeInteger(total) && ordinal <= total && total <= MAX_LISTING_PAGES, 'invalid page count or bound')
  const canonicals = nativeLinks(doc, 'link', 'canonical')
  requireNative(canonicals.length === 1, 'ambiguous native canonical')
  const canonical = readSearchUrl(canonicals[0].attrs.href, { canonical: true })
  requireNative(ordinal === canonical.index + 1, 'canonical and page number disagree')
  if (requestedUrl) requireNative(readSearchUrl(requestedUrl).index === canonical.index, 'requested page and canonical disagree')
  const forms = doc.nodes(node => node.tag === 'form' && node.attrs.id === 'searchForm')
  requireNative(forms.length === 1, 'missing or ambiguous search form')
  const action = new URL(forms[0].attrs.action, JOBS_SEARCH_URL)
  requireNative(action.origin === SEARCH_ORIGIN && action.pathname === '/jobs/search'
    && !action.username && !action.password && !action.hash
    && [...action.searchParams].length === 2 && action.searchParams.getAll('in_iframe').length === 1
    && action.searchParams.get('in_iframe') === '1' && action.searchParams.getAll('hashed').length === 1
    && action.searchParams.get('hashed') === '-435679902', 'changed native search employer binding')
  const relation = (rel, expected) => {
    const nodes = nativeLinks(doc, 'link', rel)
    requireNative(nodes.length === (expected == null ? 0 : 1), `missing or ambiguous ${rel} page declaration`)
    if (!nodes.length) return null
    const value = readSearchUrl(nodes[0].attrs.href)
    requireNative(value.url === listingUrl(expected), `${rel} page is not the declared adjacent page`)
    return value.url
  }
  const previous = relation('prev', ordinal > 1 ? canonical.index - 1 : null)
  const next = relation('next', ordinal < total ? canonical.index + 1 : null)
  const control = (label, expected) => {
    const nodes = doc.nodes(node => node.tag === 'a' && doc.text(node) === label
      && !doc.hasClass(node, 'invisible') && !Object.hasOwn(node.attrs, 'disabled')
      && node.attrs['aria-disabled'] !== 'true')
    requireNative(nodes.length === (expected == null ? 0 : 1), `missing or ambiguous ${label}`)
    if (nodes.length) requireNative(readSearchUrl(nodes[0].attrs.href).url === expected, `${label} disagrees with native page links`)
  }
  control('First page of results', ordinal > 1 ? listingUrl(0) : null)
  control('Previous page of results', previous)
  control('Next page of results', next)
  const tables = doc.nodes(node => node.tag === 'ul' && doc.hasClass(node, 'iCIMS_JobsTable'))
  requireNative(tables.length === 1, 'missing or ambiguous native job table')
  const cards = doc.nodes(node => node.tag === 'li' && doc.hasClass(node, 'iCIMS_JobCardItem'), tables[0])
  requireNative(cards.length > 0 && cards.length <= 100, 'no measured current native job cards')
  return { kind: 'current', doc, cards, ordinal, total, next, first: ordinal > 1 ? listingUrl(0) : listingUrl(canonical.index) }
}

export const hasListingsSignal = (html = '') => {
  try { readListingsProfile(html); return true } catch { return false }
}

export const extractNextPageUrl = (html = '') => {
  const doc = readNativeDocument(String(html ?? ''))
  const nodes = nativeLinks(doc, 'link', 'next')
  requireNative(nodes.length <= 1, 'ambiguous next page URL')
  return nodes.length ? readSearchUrl(nodes[0].attrs.href).url : null
}

const currentObservations = (html, profile) => profile.cards.map(card => {
  const { doc } = profile
  const field = label => {
    const groups = doc.nodes(node => doc.hasClass(node, 'iCIMS_JobHeaderTag'), card)
      .filter(group => doc.nodes(node => node.tag === 'dt', group).some(node => doc.text(node) === label))
    requireNative(groups.length <= 1, `ambiguous native ${label}`)
    if (!groups.length) return null
    const values = doc.nodes(node => node.tag === 'dd', groups[0])
    requireNative(values.length === 1, `ambiguous native ${label} value`)
    return doc.text(values[0]) || null
  }
  const titles = doc.nodes(node => node.tag === 'h3', card)
  const anchors = doc.nodes(node => node.tag === 'a' && node.attrs.href, card)
  const jobId = field('Job ID'), location = field('Job Locations'), additionalLocations = field('Additional Locations')
  requireNative(titles.length === 1 && doc.text(titles[0]) && anchors.length === 1 && /^\d{4}-[1-9]\d*$/.test(jobId || ''), 'unqualified native role identity')
  const sourceUrl = new URL(anchors[0].attrs.href, JOBS_SEARCH_URL)
  const id = sourceUrl.pathname.match(/^\/jobs\/([1-9]\d*)\/[^/]+\/job$/)?.[1]
  requireNative(sourceUrl.origin === SEARCH_ORIGIN && !sourceUrl.username && !sourceUrl.password && !sourceUrl.hash
    && id === jobId.split('-')[1] && [...sourceUrl.searchParams].length === 1
    && sourceUrl.searchParams.get('in_iframe') === '1', 'unreviewed native role employer or route')
  const rawHtml = html.slice(card.sourceStart, card.sourceEnd)
  const descriptions = doc.nodes(node => node.tag === 'div' && doc.hasClass(node, 'description'), card)
  requireNative(descriptions.length <= 1, 'ambiguous native listing excerpt')
  const description = descriptions[0]
  const listingDescriptionHtml = description ? html.slice(description.sourceOpenEnd, description.sourceCloseStart) : null
  const listingDescriptionText = description ? doc.text(description) || null : null
  // These are the two complete native country-bearing labels in the current
  // captured chain. Other or mixed labels stay in the raw observation audit.
  const indiaQualified = ['Remote - India', 'Hyderabad India Office'].includes(location) && !additionalLocations
  const title = doc.text(titles[0])
  const role = indiaQualified ? {
    title, company: COMPANY, department: field('Category'), location: normalizeLocation(location),
    city: toCity(location), country: 'India', jobId, requisitionId: jobId,
    sourceUrl: sourceUrl.toString(), applyUrl: null,
    employmentType: null, experienceRequired: null, minimumQualification: null,
    preferredQualification: null, requiredSkills: [], postingDate: null, closingDate: null,
    jobDescription: listingDescriptionText, publicExperienceChecked: false,
  } : null
  return {
    jobId, title, sourceUrl: sourceUrl.toString(), location,
    additionalLocations, rawHtml, listingDescriptionHtml, listingDescriptionText,
    country: indiaQualified ? 'India' : null, role,
  }
})

export const extractJobs = (html = '') => [...String(html ?? '').matchAll(
  /<li class="iCIMS_JobCardItem">([\s\S]*?)<\/li>/gi,
)]
  .map((match) => {
    const segment = match[1]
    const sourceUrl = toAbsoluteUrl(
      segment.match(/<a[^>]+href=["']([^"']*\/jobs\/\d+\/[^"']+)["'][^>]*>/i)?.[1],
    )
    const title = normalizeWhitespace(segment.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    const jobId = normalizeWhitespace(segment.match(/<dt class="iCIMS_JobHeaderField">Job ID<\/dt>[\s\S]*?<dd class="iCIMS_JobHeaderData"><span[^>]*>\s*([^<]+)\s*<\/span>/i)?.[1])
    const department = normalizeWhitespace(segment.match(/<dt class="iCIMS_JobHeaderField">Category<\/dt>[\s\S]*?<dd class="iCIMS_JobHeaderData"><span[^>]*>\s*([^<]+)\s*<\/span>/i)?.[1])
    const location = normalizeLocation(
      segment.match(/<span class="sr-only field-label">Job Locations<\/span>[\s\S]*?<dd class="iCIMS_JobHeaderData"><span[^>]*>\s*([^<]+)\s*<\/span>/i)?.[1],
    )
    const jobDescription = normalizeWhitespace(
      segment.match(/<div class="col-xs-12 description">([\s\S]*?)<\/div>/i)?.[1],
    )

    if (!sourceUrl || !title || !jobId || !location || !isIndiaLocation(location)) {
      return null
    }

    return {
      title,
      company: COMPANY,
      department,
      location,
      city: toCity(location),
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: jobDescription || null,
      publicExperienceChecked: Boolean(jobDescription),
    }
  })
  .filter(Boolean)

export const createHylandSoftwareSolutionsIndiaScraper = ({
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText: overrideFetchText } = {}) {
    const fetchImpl = overrideFetchText || fetchText
    const careersHtml = await fetchImpl(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Hyland careers page no longer matches the pinned first-party handoff')
    }

    const seedHtml = await fetchImpl(JOBS_SEARCH_URL)
    const seedProfile = readListingsProfile(seedHtml, JOBS_SEARCH_URL)
    const cache = new Map([[JOBS_SEARCH_URL, { html: seedHtml, profile: seedProfile }]])
    const jobs = [], observations = [], pages = [], visited = new Set(), identities = new Set()
    let nextUrl = seedProfile.kind === 'current' ? seedProfile.first : JOBS_SEARCH_URL

    while (nextUrl) {
      requireNative(visited.size < MAX_LISTING_PAGES && !visited.has(nextUrl), 'pagination cycle or page bound exceeded')
      visited.add(nextUrl)
      const entry = cache.get(nextUrl) || { html: await fetchImpl(nextUrl) }
      const profile = entry.profile || readListingsProfile(entry.html, nextUrl)
      requireNative(profile.kind === seedProfile.kind, 'native listing profile changed within page chain')
      pages.push({ url: nextUrl, html: entry.html })
      let roles
      if (profile.kind === 'current') {
        requireNative(profile.total === seedProfile.total && profile.ordinal === pages.length, 'native page chain is incomplete or changed')
        const rows = currentObservations(entry.html, profile)
        for (const row of rows) {
          requireNative(!identities.has(row.jobId), 'duplicate native role identity across pages')
          identities.add(row.jobId)
          const observation = { ...row }
          delete observation.role
          observations.push(observation)
        }
        roles = rows.map(row => row.role).filter(Boolean)
      } else {
        roles = extractJobs(entry.html)
        observations.push(...[...entry.html.matchAll(/<li class="iCIMS_JobCardItem">([\s\S]*?)<\/li>/gi)]
          .map(match => ({ rawHtml: match[0] })))
      }
      for (const job of roles) {
        jobs.push({
          ...job,
          ...(profile.kind === 'current' ? { applyUrl: null, publicExperienceChecked: false } : {}),
          source: SOURCE,
          link: job.sourceUrl,
          scrapedAt: now(),
          sourceDescription: null,
          sourceNativeListingExcerpt: job.jobDescription,
          sourceDetailComplete: false,
          sourceListingComplete: false,
          sourceScopeComplete: false,
          sourceEmployerQualificationComplete: false,
          sourceApplicationQualificationComplete: false,
          activeApplyVerified: false,
          lifecycleCleanupAllowed: false,
          sourceQualificationHolds: ['listing-excerpt-only', 'legal-employer-unproven', 'application-unproven', 'company-inventory-scope-unproven'],
        })
      }
      const following = profile.kind === 'current' ? profile.next : extractNextPageUrl(entry.html)
      if (following) requireNative(readSearchUrl(following).index === readSearchUrl(nextUrl).index + 1, 'non-adjacent next page or cycle')
      nextUrl = following
    }
    if (seedProfile.kind === 'current') requireNative(pages.length === seedProfile.total, 'native page chain ended early')

    const sourceEvidence = {
      source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: observations.length,
      observedVacancyCount: observations.length, sourceScopeComplete: false,
      companyGlobalTotal: null, companyIndiaTotal: null,
    }
    attachSourceObservationEvidence(jobs, sourceEvidence)
    Object.defineProperty(jobs, 'nativeCollectionEvidence', {
      configurable: true,
      value: { ...sourceEvidence, sourceDetailComplete: false, sourceListingComplete: false,
        sourceEmployerQualificationComplete: false, sourceApplicationQualificationComplete: false,
        lifecycleCleanupAllowed: false, careersHtml, pages, observations },
    })
    return attachInventoryEvidence(jobs, {
      status: 'coverage-gap', surface: JOBS_SEARCH_URL, firstParty: true,
      listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched: pages.length,
      reportedTotal: null, indiaFacetCount: null, verifiedAt: now(),
      reason: 'Observed public Hyland listing pages supply excerpts; full criteria, legal employer, application authority and company-wide inventory remain unqualified',
    })
  },
})

export const run = async (options = {}) => createHylandSoftwareSolutionsIndiaScraper().run(options)

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
