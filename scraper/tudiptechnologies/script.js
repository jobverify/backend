import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { publicPostingDescription, isExactPublicJobUrl } from '../../rewriting/publicPostingDescription.js'
import { visiblePostingDescription } from '../../rewriting/visiblePostingDescription.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'

import { TUDIP_TECHNOLOGIES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&hellip;/gi, '...')

const stripTags = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(stripTags(value))
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return CAREERS_URL
  }
}

const getSlugFromUrl = (value) => {
  try {
    const segments = new URL(value).pathname.split('/').filter(Boolean)
    return segments.at(-1) || SOURCE
  } catch {
    return SOURCE
  }
}

export const hasOfficialJobsSignal = (html = '') => {
  const page = String(html ?? '')
  try {
    const document = readVisibleNativeDocument(page)
    const canonical = document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')
    return /Current Job Openings at Tudip \| Explore Your Career/i.test(page)
      && canonical.length === 1 && isExactPublicJobUrl(canonical[0].attrs.href, CAREERS_URL)
      && document.nodes(node => node.tag === 'button' && document.hasClass(node, 'category-btn')
        && document.hasClass(node, 'active') && node.attrs['data-category'] === 'india-en'
        && document.text(node) === 'India').length === 1
  } catch { return false }
}

const descendants = node => (node.children || []).filter(child => typeof child !== 'string')
  .flatMap(child => [child, ...descendants(child)])

export const extractJobCards = (html = '') => {
  const document = readVisibleNativeDocument(String(html ?? ''))
  const active = new Set(document.nodes(() => true)), jobs = [], identities = new Map(), conflicts = new Set(), issues = []
  for (const card of document.nodes(node => node.tag === 'li' && document.hasClass(node, 'job_listing'))) {
    if (card.attrs['data-category'] !== 'india-en') continue
    const nodes = descendants(card).filter(node => active.has(node))
    const links = nodes.filter(node => node.tag === 'a' && document.hasClass(node, 'apply-btn'))
    const headings = nodes.filter(node => node.tag === 'h3')
    const title = headings.length === 1 ? normalizeText(document.text(headings[0])) : null
    const href = links.length === 1 && links[0].attrs.href ? toAbsoluteUrl(links[0].attrs.href) : null
    if (!title || !href || normalizeText(card.attrs['data-title'])?.toLowerCase() !== title.toLowerCase()) {
      issues.push('unverified-card-identity'); continue
    }
    const slug = getSlugFromUrl(href)
    const roleUrl = new URL(href)
    if (roleUrl.protocol !== 'https:' || roleUrl.hostname !== 'tudip.com' || roleUrl.username || roleUrl.password
      || roleUrl.search || roleUrl.hash || !/^\/jobs?\/(?:india\/)?[a-z0-9-]+\/?$/i.test(roleUrl.pathname)) {
      issues.push('unverified-card-role-url'); continue
    }
    const existing = identities.get(href)
    if (existing) {
      if (existing !== title) { conflicts.add(href); issues.push('conflicting-card-identity') }
      continue
    }
    identities.set(href, title)
    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: `${SOURCE}-${slug}`,
      requisitionId: slug,
      sourceUrl: href,
      applyUrl: href,
      employmentType: null,
      workplaceType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    })
  }
  const verified = jobs.filter(job => !conflicts.has(job.sourceUrl))
  Object.defineProperty(verified, 'coverageIssues', { value: issues })
  return verified
}

// The role's own Key Job Details supplies country and complete workplace text.
// An India listing category alone cannot override a conflicting detail country.
const nativeRoleMetadata = (job, html) => {
  const document = readVisibleNativeDocument(html)
  const containers = document.nodes(node => document.hasClass(node, 'key-job-details'))
  if (containers.length !== 1) return null
  const active = new Set(document.nodes(() => true)), nodes = descendants(containers[0]).filter(node => active.has(node))
  const fields = new Map()
  for (const item of nodes.filter(node => node.tag === 'li')) {
    const children = descendants(item).filter(node => active.has(node))
    const labels = children.filter(node => node.tag === 'strong')
    const values = children.filter(node => document.hasClass(node, 'key-job-meta'))
    if (labels.length !== 1 || values.length !== 1) return null
    const key = document.text(labels[0]).replace(/:$/, '').trim().toLowerCase()
    if (fields.has(key)) return null
    fields.set(key, document.text(values[0]).trim())
  }
  if (fields.get('job title')?.toLowerCase() !== job.title.toLowerCase()
    || fields.get('country')?.toLowerCase() !== 'india' || !fields.get('location')) return null
  const metadata = { country: fields.get('country'), location: fields.get('location'), employmentType: fields.get('type') || null }
  const records = []
  const visit = value => {
    if (Array.isArray(value)) { value.forEach(visit); return }
    if (!value || typeof value !== 'object') return
    if ([value['@type']].flat().includes('JobPosting')) records.push(value)
    if (value['@graph']) visit(value['@graph'])
  }
  for (const node of document.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')) {
    try { visit(JSON.parse(node.raw)) } catch { return null }
  }
  if (!records.length) {
    const description = publicPostingDescription(job, html, job.sourceUrl)?.description
    return description ? { ...metadata, description } : null
  }
  // Current Tudip schema identifies its vacancy by two agreeing role URLs,
  // rather than the optional JobPosting.url supported by the generic reader.
  if (records.length !== 1) return null
  const record = records[0], employer = record.hiringOrganization?.name
  const visible = visiblePostingDescription(job, document, job.sourceUrl, { sameUrl: isExactPublicJobUrl })
  if (!visible || normalizeText(record.title)?.toLowerCase() !== job.title.toLowerCase()
    || !['Tudip Technologies Pvt Ltd', 'Tudip Technologies Pvt. Ltd', 'Tudip Technologies Pvt. Ltd.', COMPANY].includes(employer)
    || !isExactPublicJobUrl(record.mainEntityOfPage?.['@id'], job.sourceUrl)
    || !isExactPublicJobUrl(record.identifier?.value, job.sourceUrl)
    || record.url !== undefined && !isExactPublicJobUrl(record.url, job.sourceUrl)
    || normalizeText(record.jobLocation?.address) !== metadata.location
    || JSON.stringify(record.employmentType) !== '["FULL_TIME"]' || metadata.employmentType !== 'Full Time'
    || !extractActiveDescription(record.description)) return null
  const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    ? Date.parse(value) : NaN
  const checkedAt = Date.parse(job.scrapedAt)
  if (!Number.isFinite(timestamp(record.datePosted)) || timestamp(record.datePosted) > checkedAt
    || !Number.isFinite(timestamp(record.validThrough)) || timestamp(record.validThrough) <= checkedAt) return null
  return { ...metadata, description: record.description, legalEmployer: employer,
    nativeSchemaIdentifier: record.identifier.value, postingDate: record.datePosted, closingDate: record.validThrough }
}

const defaultFetchText = (url, { signal, includeResponseMetadata = false } = {}) => fetchTextWithRetry(url, {
  signal,
  includeResponseMetadata,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createTudipTechnologiesScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow, signal } = {}) {
    signal?.throwIfAborted()
    const careersResponse = await fetchText(CAREERS_URL, { signal })
    signal?.throwIfAborted()
    const careersHtml = typeof careersResponse === 'object' ? careersResponse?.html : careersResponse
    if (!hasOfficialJobsSignal(careersHtml)) {
      throw new Error('Tudip Technologies verified jobs page no longer matches the trusted first-party surface')
    }

    const jobs = extractJobCards(careersHtml)
    if (jobs.length === 0) {
      throw new Error('Tudip Technologies jobs page no longer exposes the verified India job listings')
    }

    let pagesFetched = 1
    const decorated = jobs.map((job) => ({
      ...job,
      source: SOURCE,
      company: COMPANY,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      link: job.applyUrl,
      scrapedAt: (overrideNow || now)(),
    }))
    const detailed = (await mapWithConcurrency(decorated, 4, async job => {
      signal?.throwIfAborted()
      try {
        const response = await fetchText(job.sourceUrl, { signal, includeResponseMetadata: true })
        pagesFetched++
        signal?.throwIfAborted()
        if (!response || typeof response !== 'object' || response.status !== 200
          || !isExactPublicJobUrl(job.sourceUrl, response.url)) return null
        const detail = nativeRoleMetadata(job, response.html)
        if (!detail) return null
        const { description, ...metadata } = detail
        return { ...job, ...metadata, jobDescription: description, sourceDescription: description,
          sourceDetailComplete: true, sourceListingComplete: false, sourceScopeComplete: false,
          lifecycleCleanupAllowed: false }
      } catch (error) {
        signal?.throwIfAborted()
        if ([401, 403, 429].includes(Number(error.status ?? error.statusCode))) throw error
        return null
      }
    })).filter(Boolean)
    const reasons = ['uncounted-native-board']
    if (jobs.coverageIssues.length) reasons.push(`unverified-card-identities:${jobs.coverageIssues.length}`)
    if (detailed.length !== jobs.length) reasons.push(`unverified-role-details:${jobs.length - detailed.length}`)
    let current = detailed
    try {
      const closingResponse = await fetchText(CAREERS_URL, { signal })
      pagesFetched++
      signal?.throwIfAborted()
      const closingHtml = typeof closingResponse === 'object' ? closingResponse?.html : closingResponse
      if (!hasOfficialJobsSignal(closingHtml)) throw new Error('Unverified closing jobs board')
      const closing = extractJobCards(closingHtml)
      const identities = new Set(closing.map(job => `${job.sourceUrl}\n${job.title}`))
      current = detailed.filter(job => identities.has(`${job.sourceUrl}\n${job.title}`))
      if (closing.coverageIssues.length || closing.length !== jobs.length
        || jobs.some(job => !identities.has(`${job.sourceUrl}\n${job.title}`))) reasons.push('closing-board-changed')
    } catch (error) {
      signal?.throwIfAborted()
      if ([401, 403, 429].includes(Number(error.status ?? error.statusCode))) throw error
      reasons.push('closing-board-unverified')
    }
    return attachInventoryEvidence(current, { status: current.length ? 'discovery-only' : 'coverage-gap',
      surface: CAREERS_URL, firstParty: true, listingComplete: false, pagesFetched,
      verifiedAt: (overrideNow || now)(), reason: reasons.join(';') })
  },
})

export const run = async (options = {}) => createTudipTechnologiesScraper().run(options)

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
