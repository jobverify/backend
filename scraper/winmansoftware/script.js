import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { composeAbortSignals, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { readCurrentWinmanCriteria } from './currentCriteria.js'

import { WINMAN_SOFTWARE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = WINMAN_SOFTWARE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const APPLY_URL = PROVIDER_METADATA.applyUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')

const normalizeWhitespace = (value) => decodeHtml(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(li|p|div|tr|td|th|h[1-6]|ul|ol)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripToLines = (value) => decodeHtml(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(li|p|div|tr|td|th|h[1-6]|ul|ol)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const lowerNormalized = normalized.toLowerCase()

  return lowerNormalized.includes('careers for experience candidates - winman software')
    && page.includes('experienced_table')
    && lowerNormalized.includes('designation and job profile')
    && lowerNormalized.includes('apply now')
    && lowerNormalized.includes('senior accountant')
    && lowerNormalized.includes('electrical maintenance supervisor')
    && (page.includes(APPLY_URL) || page.includes('https://winman.in/jobs/resumedetail.aspx'))
}

export const hasCurrentCareersSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*Careers\s*(?:&#8211;|–)\s*Winman Software\s*<\/title>/i.test(page)
    && /<table\b[^>]*id=["']freshers["']/i.test(page)
    && /<table\b[^>]*id=["']experienced["']/i.test(page)
    && page.includes(APPLY_URL)
}

export const extractCurrentListings = (html = '') => {
  const page = String(html ?? '')
  if (!hasCurrentCareersSignal(page)) throw new Error('Winman current first-party careers page changed')
  const freshersTable = page.match(/<table\b[^>]*id=["']freshers["'][\s\S]*?<\/table>/i)?.[0]
  const experiencedTable = page.match(/<table\b[^>]*id=["']experienced["'][\s\S]*?<\/table>/i)?.[0]
  if (!freshersTable || !experiencedTable) throw new Error('Winman current job tables are missing')

  const freshers = [...freshersTable.matchAll(/<a\b[^>]*href=["'](https:\/\/www\.winmansoftware\.com\/more\/careers\/[a-z0-9-]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map(match => ({ title: normalizeWhitespace(match[2]), detailUrl: match[1] }))
  const experienced = [...experiencedTable.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map(match => {
      const cells = [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => cell[1])
      const title = normalizeWhitespace(cells[0]?.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i)?.[1])
      if (!title) return null
      return {
        title,
        experienceRequired: normalizeWhitespace(cells[1]),
        description: stripToLines(cells[0]).filter(line => line !== title).join(' '),
      }
    }).filter(Boolean)
  if (!freshers.length || !experienced.length
    || new Set(freshers.map(job => job.detailUrl)).size !== freshers.length
    || [...freshers, ...experienced].some(job => !job.title)
    || experienced.some(job => !job.experienceRequired || !job.description)) {
    throw new Error('Winman current job inventory is incomplete')
  }
  return { freshers, experienced }
}

// A native city label is an observation, not proof of country/state or public
// India scope. Bind it to the same visible role header without normalizing it.
const readNativeWorkplaceObservation = (html, listing) => {
  const document = readVisibleNativeDocument(String(html ?? ''), { strict: true })
  const hasClass = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
  const within = (node, predicate) => node.inert ? [] : [
    ...(predicate(node) ? [node] : []),
    ...node.children.filter(child => typeof child !== 'string').flatMap(child => within(child, predicate)),
  ]
  const headers = document.nodes(node => hasClass(node, 'job-header'))
  if (headers.length !== 1) return null
  const header = headers[0], titles = within(header, node => node.tag === 'h1' && hasClass(node, 'job-title'))
  if (titles.length !== 1 || document.text(titles[0]) !== listing.title) return null
  const infos = within(header, node => hasClass(node, 'job-info'))
  if (infos.filter(node => document.text(node) === 'Winman Software India LLP').length !== 1) return null
  const labels = infos.filter(node => within(node, child => child.tag === 'img'
    && child.attrs.src === '../../../images/JobDescription-location.png'
    && child.attrs.alt === 'location-icon').length === 1).map(node => document.text(node)).filter(Boolean)
  if (!labels.length) return null
  const literal = labels.length === 1 ? labels[0] : null
  return {
    roleTitle: listing.title, sourceUrl: listing.detailUrl,
    carrier: 'job-header/job-info[location-icon]', roleHeaderText: document.text(header),
    observedLocationLiterals: labels, locationLiteral: literal, cityLiteral: literal,
    country: null, state: null, publicGeographyQualified: false,
    reason: literal ? 'native-country-and-state-not-published' : 'ambiguous-native-location-carrier',
  }
}

export const extractCurrentFresherDetail = (html, listing) => {
  const page = String(html ?? '')
  const criteria = readCurrentWinmanCriteria(page, listing)
  if (criteria) return {
    title: criteria.title, description: criteria.text, qualification: criteria.qualification,
    rawNativeWorkplaceEvidence: readNativeWorkplaceObservation(page, listing),
    nativeCriteriaComplete: true, nativeCriteriaModel: criteria.model,
    nativeMinimumMarksThroughout: criteria.minimumMarks,
  }
  const document = readVisibleNativeDocument(page, { strict: true })
  const titles = document.nodes(node => node.tag === 'h1' && document.hasClass(node, 'job-title'))
  const summaries = document.nodes(node => node.tag === 'ul' && document.hasClass(node, 'job-summary'))
  const qualifications = document.nodes(node => node.tag === 'p' && document.hasClass(node, 'qualification'))
  const title = titles.length === 1 ? document.text(titles[0]) : null
  const description = summaries.length === 1 ? document.text(summaries[0]) : null
  const qualification = qualifications.length === 1 ? document.text(qualifications[0]) : null
  const visibleText = document.text(document.nodes(node => node.tag === 'root')[0])
  if (title !== listing.title || !description || !qualification || !page.includes(APPLY_URL)
    || !/Winman Software India LLP/i.test(visibleText) || !/Mangalore/i.test(visibleText)) {
    throw new Error(`Winman current job detail changed: ${listing.detailUrl}`)
  }
  return { title, description, qualification, rawNativeWorkplaceEvidence: readNativeWorkplaceObservation(page, listing),
    nativeCriteriaComplete: false, nativeCriteriaModel: null, nativeMinimumMarksThroughout: null }
}

const buildCurrentJob = ({ title, description, qualification = null, experienceRequired = null, sourceUrl, scrapedAt, rawNativeWorkplaceEvidence = null, nativeCriteriaComplete = false, nativeCriteriaModel = null, nativeMinimumMarksThroughout = null }) => {
  const jobId = slugify(title)
  if (!jobId) throw new Error('Winman current job ID is missing')
  return {
    title, company: COMPANY, department: null,
    location: null, city: null, state: null, country: null,
    nativeGeographyQualified: false, rawNativeWorkplaceEvidence,
    jobId, requisitionId: jobId, sourceUrl, applyUrl: APPLY_URL,
    employmentType: null, experienceRequired,
    minimumQualification: qualification, preferredQualification: null,
    requiredSkills: [], postingDate: null, closingDate: null,
    jobDescription: description, sourceDescription: description, remoteStatus: 'On-site',
    nativeCriteriaComplete, nativeCriteriaModel, nativeMinimumMarksThroughout,
    source: SOURCE, link: APPLY_URL, scrapedAt,
  }
}

// These are distinct demonstrated literal application routes, not aliases.
const LEGACY_APPLICATION_URLS = new Set([
  'https://winman.in/jobs/resume.aspx',
  'https://winman.in/jobs/resumedetail.aspx',
])

// Opening-attribute provenance only. Visibility belongs to the shared reader.
// Skip comments/raw bodies so JS strings cannot supply or conflict with links.
const legacyAnchorAttributes = (page) => {
  const raw = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'plaintext', 'noscript'])
  const tags = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
  const anchors = []
  let match
  while ((match = tags.exec(page))) {
    if (!match[1] || match[0].startsWith('</')) continue
    const tag = match[1].toLowerCase()
    if (tag === 'a') anchors.push(match[2])
    if (raw.has(tag)) {
      if (tag === 'plaintext') break
      const closing = new RegExp('</' + tag + '\\s*>', 'ig')
      closing.lastIndex = tags.lastIndex
      const end = closing.exec(page)
      tags.lastIndex = end ? closing.lastIndex : page.length
    }
  }
  return anchors
}

const readLegacyApplicationUrl = (html) => {
  const page = String(html ?? ''), document = readVisibleNativeDocument(page, { strict: true })
  const invalid = () => { throw new Error('Winman legacy application binding is missing, ambiguous or unsupported') }
  const root = document.nodes(node => node.tag === 'root')[0]
  if (!root) return invalid()
  const allAnchors = [], parents = new Map()
  const collect = (node, parent = null) => {
    parents.set(node, parent)
    if (node.tag === 'a') allAnchors.push(node)
    for (const child of node.children || []) if (typeof child !== 'string') collect(child, node)
  }
  collect(root)
  const openingAttributes = legacyAnchorAttributes(page)
  if (openingAttributes.length !== allAnchors.length) return invalid()
  const provenance = new Map(allAnchors.map((node, index) => [node, openingAttributes[index]]))
  const isApply = node => /^apply\s+now$/i.test(document.text(node))
  const candidates = document.nodes(node => node.tag === 'a' && (isApply(node) || LEGACY_APPLICATION_URLS.has(node.attrs.href)))
  if (!candidates.length) return invalid()
  // A label child can intercept the click before the anchor default action.
  // Inspect only projected active descendants; never evaluate handler bodies.
  const hasActiveDescendantHandler = node => (node.children || []).some(child =>
    typeof child !== 'string' && !child.inert && (Object.keys(child.attrs || {}).some(key => /^on/i.test(key))
      || hasActiveDescendantHandler(child)))
  const urls = candidates.map(node => {
    if (!isApply(node) || Object.hasOwn(node.attrs, 'download') || hasActiveDescendantHandler(node)) return invalid()
    // An authored link is unqualified if an active ancestor can intercept it.
    // Do not interpret handler bodies or inspect unrelated/inert descendants.
    for (let owner = node; owner; owner = parents.get(owner)) {
      if (Object.keys(owner.attrs || {}).some(key => /^on/i.test(key))) return invalid()
    }
    const raw = provenance.get(node), attributes = []
    const attribute = /([^\t\n\f\r =/>\u0000"'<>`]+)(?:[\t\n\f\r ]*=[\t\n\f\r ]*(?:"([^"]*)"|'([^']*)'|([^\t\n\f\r "'=<>`\u0000]+)))?/y
    let cursor = 0
    while (cursor < raw.length) {
      while (cursor < raw.length && /[\t\n\f\r ]/.test(raw[cursor])) cursor++
      if (cursor === raw.length) break
      attribute.lastIndex = cursor
      const match = attribute.exec(raw)
      // Never search past unsupported input (e.g. =href) to invent a href.
      if (!match) return invalid()
      attributes.push(match)
      cursor = attribute.lastIndex
    }
    const hrefs = attributes.filter(attribute => attribute[1].toLowerCase() === 'href')
    const authored = hrefs[0] && (hrefs[0][2] ?? hrefs[0][3] ?? hrefs[0][4] ?? '')
    // No trimming, URL normalization, entity/query/fragment stripping or guesses.
    if (hrefs.length !== 1 || authored !== node.attrs.href || !LEGACY_APPLICATION_URLS.has(authored)) return invalid()
    return authored
  })
  if (new Set(urls).size !== 1) return invalid()
  return urls[0]
}

export const extractJobs = (html = '') => {
  const applyUrl = readLegacyApplicationUrl(html)
  const jobs = []

  for (const rowMatch of String(html ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => match[1])
    if (cells.length < 2) continue

    const title = normalizeWhitespace(cells[0].match(/<h5[^>]*>([\s\S]*?)<\/h5>/i)?.[1])
    const experienceRequired = normalizeWhitespace(cells[1])
    const description = stripToLines(cells[0])
      .filter((line) => line !== title)
      .join(' ')
      .trim() || null
    const jobId = slugify(title)

    if (!title || !experienceRequired || !jobId) continue

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: null,
      city: null,
      state: null,
      country: null,
      nativeGeographyQualified: false,
      rawNativeWorkplaceEvidence: null,
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: description,
      remoteStatus: 'On-site',
    })
  }

  return jobs
}

const finishNativeObservations = (jobs, { observedListingCount, pagesFetched }) => {
  const audit = {
    source: SOURCE, observedListingCount, sourceScopeComplete: false,
    reportedTotal: null, indiaFacetCount: null, companyGlobalTotal: null, companyIndiaTotal: null,
    listingPaginationComplete: null, closingInventoryMatches: null,
    observedUnknownCountries: jobs.length,
    rawProvenanceLimit: 'Native observations only; role country/state, employer-wide totals and independent closing remain unqualified',
  }
  for (const job of jobs) job.sourceListingComplete = false
  if (jobs.length) jobs[0].nativeCollectionEvidence = audit
  Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit })
  attachSourceObservationEvidence(jobs, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: observedListingCount, observedVacancyCount: observedListingCount, sourceScopeComplete: false })
  return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: CAREERS_URL,
    firstParty: true, listingComplete: false, pagesFetched, reportedTotal: null,
    indiaFacetCount: null, verifiedAt: null, reason: 'role-country-and-employer-scope-unqualified' })
}

// Race the source request so injected noncooperative work can settle on abort.
// Retry policy and per-attempt deadlines remain owned by fetchTextWithRetry.
const withWinmanCancellation = async (fetchText, signal, collect) => {
  signal?.throwIfAborted()
  const stopped = new AbortController()
  const requestSignal = composeAbortSignals(signal, stopped.signal)
  const fail = (error) => {
    const reason = signal?.aborted ? signal.reason : error
    if (!stopped.signal.aborted) stopped.abort(reason)
    throw reason
  }
  const readText = (url) => {
    signal?.throwIfAborted()
    requestSignal.throwIfAborted()
    let work
    try {
      work = Promise.resolve(fetchText(url, { signal: requestSignal }))
      // A fetcher may abort synchronously before returning a rejecting promise.
      // Keep that late settlement observed even when the following check throws.
      work.catch(() => {})
      signal?.throwIfAborted()
      requestSignal.throwIfAborted()
    } catch (error) { return fail(error) }
    let onAbort
    const aborted = new Promise((_, reject) => {
      onAbort = () => reject(requestSignal.reason)
      requestSignal.addEventListener('abort', onAbort, { once: true })
      if (requestSignal.aborted) onAbort()
    })
    return Promise.race([work, aborted]).then(value => {
      signal?.throwIfAborted()
      requestSignal.throwIfAborted()
      return value
    }).catch(fail).finally(() => requestSignal.removeEventListener('abort', onAbort))
  }
  try {
    const jobs = await collect(readText)
    signal?.throwIfAborted()
    requestSignal.throwIfAborted()
    return jobs
  } catch (error) { return fail(error) }
}

export const createWinmanSoftwareScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    signal,
  } = {}) {
    return withWinmanCancellation(fetchText, signal, async (readText) => {
      const careersHtml = await readText(CAREERS_URL)
    if (hasCurrentCareersSignal(careersHtml)) {
      const { freshers, experienced } = extractCurrentListings(careersHtml)
      const scrapedAt = new Date().toISOString()
      const freshJobs = []
      for (let index = 0; index < freshers.length; index += 4) {
        const batch = await Promise.all(freshers.slice(index, index + 4).map(async listing => {
          const detail = extractCurrentFresherDetail(await readText(listing.detailUrl), listing)
          return buildCurrentJob({ title: detail.title, description: detail.description,
            qualification: detail.qualification, sourceUrl: listing.detailUrl, scrapedAt,
            rawNativeWorkplaceEvidence: detail.rawNativeWorkplaceEvidence,
            nativeCriteriaComplete: detail.nativeCriteriaComplete,
            nativeCriteriaModel: detail.nativeCriteriaModel,
            nativeMinimumMarksThroughout: detail.nativeMinimumMarksThroughout })
        }))
        freshJobs.push(...batch)
      }
      const jobs = [...freshJobs, ...experienced.map(job => buildCurrentJob({
        title: job.title, description: job.description, experienceRequired: job.experienceRequired,
        sourceUrl: CAREERS_URL, scrapedAt,
      }))]
      if (new Set(jobs.map(job => job.jobId)).size !== jobs.length) throw new Error('Winman current job IDs are duplicated')
      const selected = maxJobs ? jobs.slice(0, maxJobs) : jobs
      return finishNativeObservations(selected.map(job => ({ ...job, ...(selected.length < jobs.length ? { sourceListingComplete: false } : {}) })),
        { observedListingCount: freshers.length + experienced.length, pagesFetched: 1 + freshers.length })
    }
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Winman Software careers surface no longer matches the trusted first-party page')
      }
  
      const jobs = extractJobs(careersHtml)
      const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs
  
      return finishNativeObservations(selectedJobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      })), { observedListingCount: jobs.length, pagesFetched: 1 })
    })
  },
})

export const run = async (options = {}) => createWinmanSoftwareScraper().run(options)

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
