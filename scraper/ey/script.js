import path from 'path'
import { fileURLToPath } from 'url'
import { createHash } from 'node:crypto'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { loadNativePaginationDefaults, nativePaginationLimits, createNativePagination, readNativeWithSignal, NATIVE_PAGINATION_EVIDENCE } from '../../scraper-support/utils/nativePagination.js'
import { createEySessionFetchText } from './sessionReader.js'
import { createEyInventoryContract, isExecutableEyClassicScript } from './inventoryProof.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { readNativeDocument, decodeNativeEntities } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)
const nativeDefaults = loadNativePaginationDefaults(currentDir)

const BASE_URL = 'https://careers.ey.com'
const SEARCH_PATH = '/ey/search/?createNewAlert=false&q=&locationsearch=&optionsFacetsDD_country=IN&optionsFacetsDD_customfield1=&locale=en_GB&sortColumn=referencedate&sortDirection=desc'
const DEFAULT_DETAIL_CONCURRENCY = 10
// The retained 1,200-second run fetched all 2,879 detail pages in 1,189 seconds
// but completed only18 of116 closing pages. Reserve23 minutes for the full
// closing pass, below the24-minute recovery/25-minute parent limits; keep10workers.
const DEFAULT_COLLECTION_BUDGET_MS = 1380000
const countryNames = new Intl.DisplayNames(['en'], { type: 'region' })
const identityTitle = value => String(value || '').normalize('NFC').replace(/\s+/g, ' ').replace(/[\u2010-\u2015]/g, '-').trim()
const boundNativeRoleUrl = (value, postingId) => {
  try {
    const url = new URL(value)
    return url.origin === BASE_URL && !url.username && !url.password && !url.search && !url.hash
      && /^\/ey\/job\/[^/]+\/\d+\/$/.test(url.pathname) && extractJobIdFromUrl(url.href) === postingId ? url : null
  } catch { return null }
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&hellip;/gi, '…')
  .replace(/&ndash;|&#8211;|â€“/gi, '-')
  .replace(/&mdash;|&#8212;|â€”/gi, '-')
  .replace(/â€™/g, "'")
  .replace(/â€œ|â€/g, '"')
  .replace(/Â/g, '')

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null
  try {
    return new URL(value, BASE_URL).toString()
  } catch {
    return null
  }
}

const extractFirst = (pattern, value, transform = (match) => match[1]) => {
  const match = pattern.exec(String(value ?? ''))
  return match ? transform(match) : null
}

export const buildIndiaSearchUrl = (startRow = null) => {
  const url = new URL(SEARCH_PATH, BASE_URL)
  if (Number.isInteger(startRow) && startRow > 0) {
    url.searchParams.set('startrow', String(startRow))
  }
  return url.toString()
}

export const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

export const extractJobIdFromUrl = (value) =>
  extractFirst(/\/(\d+)\/?(?:[#?].*)?$/i, value, (match) => match[1])

const normalizeLocation = (value) => normalizeWhitespace(value)
  ?.replace(/\s*\+\d+\s+more…?$/i, '')
  ?.trim() || null

export const extractSearchResults = (html) => {
  const rows = [...String(html).matchAll(/<tr class="data-row">([\s\S]*?)<\/tr>/gi)]

  return rows
    .map((rowMatch) => {
      const rowHtml = rowMatch[1]
      const title = normalizeWhitespace(
        extractFirst(/<a[^>]*class="jobTitle-link"[^>]*>([\s\S]*?)<\/a>/i, rowHtml),
      )
      const relativeLink = normalizeWhitespace(
        extractFirst(/<a(?=[^>]*class="jobTitle-link")(?=[^>]*href="([^"]+)")[^>]*>/i, rowHtml),
      )
      const locationHtml = extractFirst(
        /<span class="jobLocation">\s*([\s\S]*?)\s*<\/span>/i,
        rowHtml,
      )
      const location = normalizeLocation(stripTags(locationHtml))
      const sourceUrl = toAbsoluteUrl(relativeLink)
      const jobId = extractJobIdFromUrl(sourceUrl)

      if (!title || !location || !sourceUrl || !jobId) return null

      return {
        title,
        location,
        city: extractCity(location),
        jobId,
        requisitionId: null,
        sourceUrl,
        postingDate: null,
      }
    })
    .filter(Boolean)
}

export const extractResultsSummary = (html) => {
  const label = stripTags(extractFirst(
    /<span class="paginationLabel"[^>]*>([\s\S]*?)<\/span>/i,
    html,
  ))
  const helpText = stripTags(extractFirst(
    /<span class="srHelp"[^>]*>([\s\S]*?)<\/span>/i,
    html,
  ))

  const pageMatch = /Page\s+(\d+)\s+of\s+(\d+)/i.exec(helpText || '')
  const labelNumbers = [...String(label ?? '').matchAll(/\d[\d,]*/g)]
    .map((match) => Number.parseInt(match[0].replace(/,/g, ''), 10))
    .filter(Number.isFinite)

  const [start, end, totalResults] = labelNumbers
  const currentPage = pageMatch ? Number.parseInt(pageMatch[1], 10) : null
  const totalPages = pageMatch ? Number.parseInt(pageMatch[2], 10) : null

  return {
    totalResults: Number.isInteger(totalResults) ? totalResults : null,
    currentPage: Number.isInteger(currentPage) ? currentPage : null,
    totalPages: Number.isInteger(totalPages) ? totalPages : null,
    pageSize: Number.isInteger(start) && Number.isInteger(end) ? end - start + 1 : null,
  }
}

const extractListItems = (value) => [...String(value ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const normalizeExperienceEvidence = (value) => normalizeWhitespace(value)
  ?.replace(
    /^(?:minimum|at\s+least)\s+(\d+(?:\.\d+)?)\s+(years?|months?)$/i,
    (_, minimum, unit) => `${minimum}+ ${unit.toLowerCase()}`,
  )
  ?.replace(
    /(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)\s+(years?|months?)$/i,
    (_, minimum, maximum, unit) => `${minimum}-${maximum} ${unit.toLowerCase()}`,
  )

const extractExperienceRequired = ({ title, jobDescription }) => (
  normalizeExperienceEvidence(
    extractJobFilterSignals({
      title,
      jobDescription,
      experienceRequired: null,
    }).experienceProfile?.evidence,
  ) || null
)

const extractDescriptionHtml = (html) => (
  extractFirst(
    /<span[^>]*class="jobdescription"[^>]*>([\s\S]*?)<\/span>\s*<\/span>(?=\s*<\/div>\s*<\/div>)/i,
    html,
  )
  || extractFirst(
    /itemprop="description"[^>]*>([\s\S]*?)<\/span>\s*<\/span>/i,
    html,
  )
  || extractFirst(/itemprop="description"[^>]*>([\s\S]*?)<\/span>/i, html)
)

const extractNativeClosure = (html, listing, jobDescription) => {
  if (jobDescription || !listing.title || !listing.sourceUrl || !listing.jobId) return null
  try {
    const requested = new URL(listing.sourceUrl)
    if (requested.origin !== BASE_URL || requested.username || requested.password || requested.search || requested.hash
      || !/^\/ey\/job\/[^/]+\/\d+\/$/.test(requested.pathname)
      || extractJobIdFromUrl(requested.href) !== listing.jobId) return null
    let visibleHtml = String(html)
    const native = readNativeDocument(visibleHtml)
    const reveal = native.nodes(node => isExecutableEyClassicScript(node) && !Object.hasOwn(node.attrs, 'src')
      && node.attrs.id === 'antiClickJackScript')
    // The retained EY shell hides the body until this exact top-level script
    // removes its own anti-clickjack style. Recognize only that reviewed pair;
    // every other inline/stylesheet/ancestor hiding declaration still applies.
    const topLevelReveal = 'if (self === top) { var antiClickjack = document.getElementById("antiClickjack"); antiClickjack.parentNode.removeChild(antiClickjack); } else { top.location = self.location; }'
    if (reveal.length === 1 && normalizeWhitespace(reveal[0].raw) === topLevelReveal) {
      visibleHtml = visibleHtml.replace('<style id="antiClickjack" type="text/css">body{display:none !important;}</style>', '')
    }
    const document = readVisibleNativeDocument(visibleHtml, { strict: true })
    const canonicals = document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')
    const titles = document.nodes(node => node.tag === 'title')
    const roles = document.nodes(node => document.hasClass(node, 'job'))
    const message = 'The Job is no longer available.'
    if (canonicals.length !== 1 || canonicals[0].attrs.href !== requested.href || titles.length !== 1
      || normalizeWhitespace(titles[0].raw) !== `${listing.title} Job Details | EY`
      || roles.length !== 1 || document.text(roles[0]) !== message) return null
    return { method: 'native-role-page-explicit-unavailable', jobId: listing.jobId, sourceUrl: requested.href,
      bodySha256: createHash('sha256').update(String(html)).digest('hex'), message }
  } catch {
    // An unparseable/ambiguous response cannot prove that a role has closed.
    return null
  }
}

const extractNativeRoleFields = (html, listing) => {
  const document = readNativeDocument(String(html))
  const scopes = document.nodes(node => /^https?:\/\/schema\.org\/JobPosting$/.test(node.attrs.itemtype || ''))
  const empty = { requisitionId: null, nativeLocations: [], locations: [], country: null,
    city: null, location: null, sourceCountryScopeUnresolved: true, description: null, employmentType: null,
    evidence: { identityVerified: false, criteriaVerified: false } }
  if (scopes.length !== 1) return empty
  const scope = scopes[0]
  const requisitionFields = document.nodes(node => node.tag === 'div' && node.children.some(child => typeof child !== 'string'
    && document.hasClass(child, 'joblayouttoken-label') && document.text(child) === 'Requisition ID:'), scope)
  const requisitions = requisitionFields.flatMap(field => document.nodes(node => node.attrs['data-careersite-propertyid'] === 'customfield5', field))
    .map(node => document.text(node)).filter(value => /^\d+$/.test(value))
  const requisitionIds = [...new Set(requisitions)]
  const descriptions = document.nodes(node => node.attrs.itemprop === 'description', scope)
  const description = descriptions.length === 1 ? document.text(descriptions[0]) || null : null
  const titles = document.nodes(node => node.attrs.itemprop === 'title', scope)
  const canonicals = document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')
  const headTitles = document.nodes(node => node.tag === 'title')
  const nativeTitle = titles.length === 1 ? document.text(titles[0]) : null
  const requested = boundNativeRoleUrl(listing.sourceUrl, listing.jobId)
  const canonical = canonicals.length === 1 ? boundNativeRoleUrl(canonicals[0].attrs.href, listing.jobId) : null
  const applications = document.nodes(node => node.tag === 'a' && /\/apply\/\d+\//.test(node.attrs.href || '')).map(node => {
    try { return new URL(node.attrs.href, BASE_URL) } catch { return null }
  })
  const applyPostingIds = [...new Set(applications.filter(Boolean).map(url => /\/apply\/(\d+)\//.exec(url.pathname)?.[1]).filter(Boolean))]
  const applicationsBound = applications.length > 0 && applications.every(url => url?.origin === BASE_URL && !url.username && !url.password
    && !url.hash && /^\/talentcommunity\/apply\/\d+\/$/.test(url.pathname))
    && applyPostingIds.length === 1 && applyPostingIds[0] === listing.jobId
  const employmentTypes = document.nodes(node => node.attrs.itemprop === 'employmentType', scope)
    .map(node => normalizeWhitespace(node.attrs.content || document.text(node))).filter(Boolean)
  const evidence = { bodySha256: createHash('sha256').update(String(html)).digest('hex'),
    identityVerified: Boolean(listing.jobId && requisitionIds.length === 1 && requested && canonical && applicationsBound
      && headTitles.length === 1 && nativeTitle
      && identityTitle(decodeNativeEntities(headTitles[0].raw)) === `${identityTitle(nativeTitle)} Job Details | EY`),
    criteriaVerified: descriptions.length === 1 && hasSourceDescription({ sourceDescription: description }),
    descriptionCarriers: descriptions.length, descriptionSha256: description ? createHash('sha256').update(description).digest('hex') : null,
    requisitionIds, requestedUrl: requested?.href || null, canonicalUrl: canonical?.href || null,
    applyPostingIds, listingTitle: listing.title || null, nativeTitle }
  evidence.canonicalAliasVerified = evidence.identityVerified && requested.href !== canonical.href
  const nativeLocations = document.nodes(node => node.attrs.itemprop === 'address', scope).map(address =>
    Object.fromEntries(document.nodes(node => node.tag === 'meta' && node.attrs.itemprop, address)
      .map(node => [node.attrs.itemprop, normalizeWhitespace(node.attrs.content)])))
  const offices = nativeLocations.map(record => {
    const street = normalizeWhitespace(record.streetAddress)
    const segments = street?.split(',').map(value => value.trim()) || []
    const explicitCountry = record.addressCountry?.toUpperCase()
    const streetCountry = segments.length >= 3 && /^[A-Z]{2}$/.test(segments.at(-2)) ? segments.at(-2) : null
    const rawCountry = explicitCountry === 'INDIA' ? 'IN' : explicitCountry || streetCountry
    const country = rawCountry && /^[A-Z]{2}$/.test(rawCountry) && rawCountry !== 'ZZ'
      && countryNames.of(rawCountry) !== rawCountry ? rawCountry : null
    const city = record.addressLocality || (streetCountry ? segments[0] : null)
    const label = street || [record.addressLocality, record.addressRegion, record.addressCountry, record.postalCode].filter(Boolean).join(', ')
    return { record, country, city, label }
  })
  const indiaOffices = offices.filter(office => office.country === 'IN' || office.country === 'INDIA')
  const selected = indiaOffices.find(office => office.city?.toLowerCase() === listing.city?.toLowerCase()) || indiaOffices[0]
  const countries = [...new Set(offices.map(office => office.country).filter(Boolean))]
  const allCountriesKnown = offices.length > 0 && offices.every(office => office.country)
  let country = selected ? 'India' : null
  if (!country && allCountriesKnown && countries.length === 1 && /^[A-Z]{2}$/.test(countries[0])) country = countryNames.of(countries[0])
  return { requisitionId: requisitionIds.length === 1 ? requisitionIds[0] : null, nativeLocations,
    locations: [...new Set(offices.map(office => office.label).filter(Boolean))], country,
    city: selected?.city || null, location: selected?.label || null,
    sourceCountryScopeUnresolved: !selected && (!allCountriesKnown || countries.length !== 1), description, evidence,
    employmentType: new Set(employmentTypes).size === 1 ? employmentTypes[0] : null }
}

export const extractJobDetail = (html, listing = {}) => {
  const native = extractNativeRoleFields(html, listing)
  const title = normalizeWhitespace(
    extractFirst(/itemprop="title"[^>]*>([\s\S]*?)<\/span>/i, html),
  ) || listing.title || null
  const descriptionHtml = extractDescriptionHtml(html)
  const applyPath = normalizeWhitespace(
    extractFirst(/class="btn btn-primary btn-large btn-lg apply dialogApplyBtn "\s+href="([^"]+)"/i, html),
  )
  const jobId = normalizeWhitespace(
    extractFirst(/\/apply\/(\d+)\/\?locale=/i, applyPath),
  ) || normalizeWhitespace(extractFirst(/jobID\s*:\s*(\d+)/i, html)) || listing.jobId || null
  const city = native.city || listing.city || normalizeWhitespace(
    extractFirst(/itemprop="addressLocality" content="([^"]+)"/i, html),
  ) || null
  const jobDescription = native.description || stripTags(descriptionHtml)
  const nativeDetailEvidence = { ...native.evidence, identityVerified: native.evidence.identityVerified && jobId === listing.jobId }

  return {
    title,
    location: native.location || listing.location || null,
    city,
    jobId,
    requisitionId: native.requisitionId,
    country: native.country,
    nativeLocations: native.nativeLocations,
    locations: native.locations,
    sourceCountryScopeUnresolved: native.sourceCountryScopeUnresolved,
    nativeDetailEvidence,
    sourceDetailComplete: nativeDetailEvidence.identityVerified && nativeDetailEvidence.criteriaVerified,
    employmentType: native.employmentType,
    experienceRequired: extractExperienceRequired({
      title,
      jobDescription,
    }) || listing.experienceRequired || null,
    jobDescription,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: extractListItems(descriptionHtml),
    postingDate: normalizeWhitespace(
      extractFirst(/itemprop="datePosted" content="([^"]+)"/i, html),
    ),
    closingDate: normalizeWhitespace(
      extractFirst(/itemprop="validThrough" content="([^"]+)"/i, html),
    ),
    applyUrl: toAbsoluteUrl(applyPath),
    sourceUrl: listing.sourceUrl || null,
    nativeClosure: extractNativeClosure(html, listing, jobDescription),
  }
}

export const createEyScraper = () => {
  const run = async ({
    maxPages,
    maxJobs,
    detailConcurrency = DEFAULT_DETAIL_CONCURRENCY,
    fetchText,
    signal,
    collectionBudgetMs = DEFAULT_COLLECTION_BUDGET_MS,
  } = {}) => {
    signal?.throwIfAborted()
    const readText = fetchText ?? createEySessionFetchText({ config })
    const limits = nativePaginationLimits({ maxPages, maxJobs }, nativeDefaults)
    const pagination = createNativePagination({ surface: buildIndiaSearchUrl(), limits, signal, collectionBudgetMs })
    const contract = createEyInventoryContract({ readText, signal: pagination.signal })
    const jobs = []
    const closureAudit = { closedCount: 0, records: [] }
    Object.defineProperty(jobs, Symbol.for('jobverify.ey-native-closures'), { value: closureAudit })
    const audit = { status: 'coverage-gap', pages: [], closingPages: [], exclusions: closureAudit.records,
      failures: [], listingPaginationComplete: false, closingInventoryMatches: false, sourceScopeComplete: false }
    Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit, configurable: true })
    const completedPageJobs = []
    const pageRecord = (url, html) => ({ url, bodySha256: createHash('sha256').update(String(html)).digest('hex'),
      summary: extractResultsSummary(html), rows: extractSearchResults(html),
      scopeProof: contract.inspectPage(html), advertisedRows: [...String(html).matchAll(/<tr class="data-row">/gi)].length })
    const verifyClosingInventory = async () => {
      const opening = audit.pages[0]
      if (!opening?.summary.pageSize || !Number.isInteger(opening.summary.totalResults)) return
      const terminalOffset = Math.ceil(opening.summary.totalResults / opening.summary.pageSize) * opening.summary.pageSize
      const terminalUrl = buildIndiaSearchUrl(terminalOffset)
      audit.terminal = pageRecord(terminalUrl, await readNativeWithSignal(() => readText(terminalUrl, { signal: pagination.signal }), pagination.signal))
      let closingHtml = null
      audit.closingPages = await mapWithConcurrency(audit.pages, 6, async (page, index) => {
        const html = await readNativeWithSignal(() => readText(page.url, { signal: pagination.signal }), pagination.signal)
        if (index === 0) closingHtml = html
        return pageRecord(page.url, html)
      })
      audit.closingFacet = await contract.readFacet(closingHtml)
      audit.closingInventoryMatches = audit.closingPages.every((page, index) => {
        const before = audit.pages[index]
        return page.summary.totalResults === before.summary.totalResults && page.summary.currentPage === before.summary.currentPage
          && page.advertisedRows === page.rows.length
          && JSON.stringify(page.rows.map(row => [row.jobId, row.sourceUrl])) === JSON.stringify(before.rows.map(row => [row.jobId, row.sourceUrl]))
      })
      const ids = new Set(audit.pages.flatMap(page => page.rows.map(row => row.jobId)))
      audit.listingPaginationComplete = audit.closingInventoryMatches && ids.size === opening.summary.totalResults
        && audit.pages.every(page => page.summary.totalResults === opening.summary.totalResults && page.advertisedRows === page.rows.length)
        && audit.terminal.rows.length === 0 && audit.terminal.advertisedRows === 0
        && audit.terminal.summary.totalResults === opening.summary.totalResults
    }
    const result = await pagination.run(jobs, async () => {
      const seenJobIds = new Set()
      let startRow = 0
      let pageNumber = 1

      while (pageNumber <= limits.maxPages) {
        const listingHtml = await readNativeWithSignal(() => readText(buildIndiaSearchUrl(startRow || null), { signal: pagination.signal }), pagination.signal)
        const listings = extractSearchResults(listingHtml)
        const summary = extractResultsSummary(listingHtml)
        audit.pages.push(pageRecord(buildIndiaSearchUrl(startRow || null), listingHtml))
        if (pageNumber === 1) audit.openingFacet = await contract.readFacet(listingHtml)

        const progress = pagination.page(listings.map(job => job.jobId), summary.totalResults)
        if (!progress) return pagination.finish(jobs, { exhausted: Boolean(summary.totalPages && pageNumber >= summary.totalPages) })

        const freshListings = []
        for (const listing of listings) {
          if (seenJobIds.has(listing.jobId)) continue
          seenJobIds.add(listing.jobId)
          freshListings.push(listing)
        }

        const remainingSlots = Math.max(limits.maxJobs - jobs.length, 0)
        const selectedListings = freshListings.slice(0, remainingSlots)
        const enrichedJobs = await mapWithConcurrency(
          selectedListings,
          detailConcurrency,
          async (listing, index) => {
            const detailHtml = await readNativeWithSignal(() => readText(listing.sourceUrl, { signal: pagination.signal }), pagination.signal)
            const detail = extractJobDetail(detailHtml, listing)
            pagination.throwIfAborted()
            if (detail.nativeClosure) {
              closureAudit.records.push(detail.nativeClosure)
              closureAudit.closedCount += 1
              return null
            }

            const completed = {
              jobId: detail.jobId || listing.jobId,
              requisitionId: detail.requisitionId,
              title: detail.title || listing.title,
              company: 'EY',
              department: null,
              location: detail.location || listing.location,
              city: detail.city || listing.city,
              country: detail.country,
              nativeLocations: detail.nativeLocations,
              locations: detail.locations,
              sourceCountryScopeUnresolved: detail.sourceCountryScopeUnresolved,
              sourceDetailComplete: detail.sourceDetailComplete,
              nativeDetailEvidence: detail.nativeDetailEvidence,
              link: detail.applyUrl || detail.sourceUrl || listing.sourceUrl,
              applyUrl: detail.applyUrl || listing.sourceUrl,
              sourceUrl: detail.sourceUrl || listing.sourceUrl,
              source: 'ey',
              employmentType: detail.employmentType,
              experienceRequired: detail.experienceRequired,
              jobDescription: detail.jobDescription,
              minimumQualification: detail.minimumQualification,
              preferredQualification: detail.preferredQualification,
              requiredSkills: detail.requiredSkills,
              postingDate: detail.postingDate || listing.postingDate,
              closingDate: detail.closingDate || null,
              scrapedAt: new Date().toISOString(),
            }
            pagination.throwIfAborted()
            completedPageJobs[index] = completed
            return completed
          },
        )

        jobs.push(...enrichedJobs.filter(Boolean))
        completedPageJobs.length = 0
        if (jobs.length >= limits.maxJobs) {
          return pagination.finish(jobs)
        }

        if (!summary.totalPages) return pagination.finish(jobs)
        if (pageNumber >= summary.totalPages) {
          await verifyClosingInventory()
          return pagination.finish(jobs, { exhausted: true })
        }
        startRow += summary.pageSize || listings.length
        pageNumber += 1
      }

      return pagination.finish(jobs)
    }, { flushCompleted: () => jobs.push(...completedPageJobs.filter(Boolean)) })
    audit.observedListingCount = new Set(audit.pages.flatMap(page => page.rows.map(row => row.jobId))).size
    audit.candidateDetails = audit.observedListingCount
    audit.parsedDetails = result.length
    audit.publicInventoryProof = { method: 'native-all-locale-IN-country-query-with-full-closing-page-recheck',
      observedPostingIds: audit.observedListingCount, nativeRequisitionIds: new Set(result.map(job => job.requisitionId).filter(Boolean)).size,
      closedPostings: closureAudit.closedCount, reportedTotal: audit.pages[0]?.summary.totalResults ?? null,
      terminalEmpty: audit.terminal?.rows.length === 0, closingPageCount: audit.closingPages.length,
      openingFacet: audit.openingFacet || null, closingFacet: audit.closingFacet || null,
      qualifiedActiveDetails: result.filter(job => job.sourceDetailComplete && job.country === 'India').length,
      nativeCanonicalAliases: result.filter(job => job.nativeDetailEvidence?.canonicalAliasVerified).length }
    const traversal = result[NATIVE_PAGINATION_EVIDENCE]
    const observedIds = new Set(audit.pages.flatMap(page => page.rows.map(row => row.jobId)))
    const accountedIds = new Set([...result.map(job => job.jobId), ...closureAudit.records.map(record => record.jobId)])
    const nativeReqIds = new Set(result.map(job => job.requisitionId).filter(Boolean))
    let reason = null
    if (traversal?.reason === 'native-collection-budget-exhausted') reason = traversal.reason
    else if (!audit.openingFacet?.verified) reason = audit.openingFacet?.reason || 'ey-native-opening-facet-unverified'
    else if (!audit.closingFacet?.verified) reason = audit.closingFacet?.reason || 'ey-native-closing-facet-unverified'
    else if (audit.openingFacet.count !== audit.closingFacet.count) reason = 'ey-native-india-facet-count-drift'
    else if (audit.openingFacet.count !== audit.observedListingCount) reason = 'ey-native-india-facet-count-unreconciled'
    else if (!audit.listingPaginationComplete || !audit.pages.every(page => page.scopeProof.verified)
      || !audit.closingPages.every(page => page.scopeProof.verified) || !audit.terminal?.scopeProof.verified
      || traversal?.reason !== 'native-pagination-exhausted' || traversal?.continuationExhausted !== true) reason = 'ey-native-inventory-closing-unreconciled'
    else if (accountedIds.size !== observedIds.size || [...observedIds].some(id => !accountedIds.has(id))
      || accountedIds.size !== result.length + closureAudit.closedCount || nativeReqIds.size !== result.length
      || result.some(job => !job.nativeDetailEvidence?.identityVerified || !job.requisitionId)) reason = 'ey-native-role-identity-unreconciled'
    else if (result.some(job => !job.nativeDetailEvidence?.criteriaVerified || job.sourceDetailComplete !== true)) reason = 'ey-native-role-criteria-unreconciled'
    else if (result.some(job => job.country !== 'India' || job.sourceCountryScopeUnresolved)) reason = 'ey-native-role-country-unreconciled'
    const complete = reason === null
    audit.status = complete ? 'complete-inventory' : 'coverage-gap'
    audit.sourceScopeComplete = complete
    if (reason) audit.failures.push({ stage: 'source-scope', reason, message: reason })
    for (const job of result) Object.assign(job, { sourceListingComplete: complete, sourceScopeComplete: complete, lifecycleCleanupAllowed: complete })
    return attachInventoryEvidence(result, { ...readInventoryEvidence(result), status: audit.status, firstParty: true,
      surface: buildIndiaSearchUrl(), listingComplete: complete, lifecycleCleanupAllowed: complete,
      indiaFacetCount: audit.openingFacet?.verified ? audit.openingFacet.count : null,
      reason: reason || 'ey-native-all-locale-India-inventory-reconciled' })
  }

  return {
    buildIndiaSearchUrl,
    extractSearchResults,
    extractResultsSummary,
    extractJobDetail,
    run,
  }
}

const scraper = createEyScraper()

export const {
  run,
} = scraper

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running EY scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)
  const cities = [...new Set(jobs.map((job) => job.city).filter(Boolean))].sort()
  console.log(`Cities found: ${cities.join(', ')}`)
  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'ey')
    console.log('DB result:', result)
    process.exit(0)
  }
}
