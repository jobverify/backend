import {runCurrentAllied} from './currentNative.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { ALLIED_DIGITAL_SERVICES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ALLIED_DIGITAL_SERVICES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const ROOT_URL = 'https://www.allieddigital.net/'
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const HIRING_NOW_URL = PROVIDER_METADATA.hiringNowPageUrl
export const JOBS_API_URL = PROVIDER_METADATA.jobsApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const PAGE_SIZE = 100
const MAX_PAGES = 100

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|\u00a0/gi, ' ')
  .replace(/&amp;|&#0*38;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim() || null

const attribute = (tag, name) => String(tag ?? '')
  .match(new RegExp('\\b' + name + '\\s*=\\s*["\\\']([^"\\\']*)["\\\']', 'i'))?.[1] ?? null

const canonicalUrl = (html) => {
  const tag = [...String(html).matchAll(/<link\b[^>]*>/gi)]
    .find(([link]) => attribute(link, 'rel') === 'canonical')?.[0]
  return attribute(tag, 'href')
}
const pageTitle = (html) => normalizeWhitespace(String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])
const hasCanonicalTitle = (html, url, title) => canonicalUrl(html) === url && pageTitle(html) === title

export const hasOfficialRootSignal = (html = '') => canonicalUrl(html) === ROOT_URL
  && /^(?:Home - Allied Digital|Allied Digital \| AI-Led Technology Transformation & IT Services)$/.test(pageTitle(html) || '')
  && [...String(html).matchAll(/<a\b[^>]*>/gi)].some(([tag]) => attribute(tag, 'href') === CAREERS_URL)

export const hasOfficialCareersSignal = (html = '') => hasCanonicalTitle(html, CAREERS_URL, 'Careers - Allied Digital')
  && (normalizeWhitespace(html) || '').includes('Hiring Now')
  && (normalizeWhitespace(html) || '').includes('careers@allieddigital.net')

export const hasHiringNowSignal = (html = '') => hasCanonicalTitle(html, HIRING_NOW_URL, 'Jobs - Allied Digital')
  && /class=["'][^"']*\bawsm-job-listings\b/i.test(html)
  && /data-listings=["']\d+["']/i.test(html)
  && (normalizeWhitespace(html) || '').includes('Hiring Now')

const requestOptions = {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
}
const defaultFetchText = (url) => fetchTextWithRetry(url, requestOptions)

export const createWordPressJobsPageFetch = ({ fetchImpl = fetch } = {}) => async (url) => {
  let response
  const text = await fetchTextWithRetry(url, {
    ...requestOptions,
    fetchImpl: async (...args) => {
      response = await fetchImpl(...args)
      return response
    },
  })
  const total = response.headers.get('x-wp-total')
  const totalPages = response.headers.get('x-wp-totalpages')
  if (!/^\d+$/.test(total ?? '') || !/^\d+$/.test(totalPages ?? '')) {
    throw new Error('Allied Digital Services WordPress inventory count headers missing')
  }
  if (response.url && new URL(response.url).origin !== new URL(JOBS_API_URL).origin) {
    throw new Error('Allied Digital Services WordPress inventory redirected off the official host')
  }
  return { records: JSON.parse(text), total: Number(total), totalPages: Number(totalPages) }
}
const defaultFetchJobsPage = createWordPressJobsPageFetch()

const officialJobUrl = (value) => {
  try {
    const url = new URL(value)
    return url.origin === new URL(ROOT_URL).origin
      && /^\/jobs\/[^/]+\/$/.test(url.pathname)
      && !url.search && !url.hash && !url.username && !url.password
  } catch {
    return false
  }
}

const extractListingCards = (html) => {
  const cards = [...String(html).matchAll(/<div\b[^>]*\bid=["']awsm-(?:grid|list)-item-(\d+)["'][^>]*>\s*(<a\b[^>]*>)/gi)]
    .map((match) => ({ id: Number(match[1]), link: attribute(match[2], 'href') }))
  const capacity = Number(String(html).match(/data-listings=["'](\d+)["']/i)?.[1])
  if (!cards.length || !Number.isInteger(capacity) || capacity <= 0) {
    throw new Error('Allied Digital Services verified opening listing changed')
  }
  return { cards, capacity }
}

const fetchCompleteInventory = async (fetchJobsPage, listingHtml) => {
  const { cards, capacity } = extractListingCards(listingHtml)
  const records = []
  const ids = new Set()
  let total
  let totalPages
  for (let page = 1; ; page += 1) {
    const result = await fetchJobsPage(JOBS_API_URL + '?per_page=' + PAGE_SIZE + '&page=' + page)
    if (!Number.isInteger(result.total) || result.total <= 0
      || !Number.isInteger(result.totalPages) || result.totalPages <= 0
      || !Array.isArray(result.records)) {
      throw new Error('Allied Digital Services WordPress inventory count or records changed')
    }
    if (page === 1) {
      total = result.total
      totalPages = result.totalPages
      if (totalPages !== Math.ceil(total / PAGE_SIZE) || totalPages > MAX_PAGES) {
        throw new Error('Allied Digital Services WordPress inventory pagination page count changed')
      }
    } else if (result.total !== total || result.totalPages !== totalPages) {
      throw new Error('Allied Digital Services WordPress inventory changed during pagination')
    }
    const expectedCount = Math.min(PAGE_SIZE, total - (page - 1) * PAGE_SIZE)
    if (result.records.length !== expectedCount) {
      throw new Error('Allied Digital Services incomplete WordPress inventory page ' + page)
    }
    for (const record of result.records) {
      if (!Number.isInteger(record.id) || record.id <= 0 || record.type !== 'awsm_job_openings'
        || record.status !== 'publish' || !normalizeWhitespace(record.title?.rendered)
        || !officialJobUrl(record.link)) {
        throw new Error('Allied Digital Services WordPress inventory record changed')
      }
      if (ids.has(record.id)) throw new Error('Allied Digital Services duplicate WordPress inventory job ' + record.id)
      ids.add(record.id)
      records.push(record)
    }
    if (page === totalPages) break
  }
  if (records.length !== total || cards.length !== Math.min(capacity, total)
    || new Set(cards.map((card) => card.id)).size !== cards.length
    || cards.some((card) => !records.some((record) => record.id === card.id && record.link === card.link))) {
    throw new Error('Allied Digital Services incomplete WordPress inventory or opening listing mismatch')
  }
  return records
}

const extractSpecification = (html, name) => {
  const block = String(html).match(new RegExp('<div\\b[^>]*class=["\\\'][^"\\\']*\\bawsm-job-specification-job-' + name + '\\b[^"\\\']*["\\\'][^>]*>([\\s\\S]*?)<\\/div>', 'i'))?.[1]
  return normalizeWhitespace(block?.match(/<span\b[^>]*class=["'][^"']*\bawsm-job-specification-term\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1])
}

const extractVerifiedDetail = (html, record) => {
  const fail = () => { throw new Error('Allied Digital Services verified job detail changed: ' + record.link) }
  if (canonicalUrl(html) !== record.link || !/\bawsm-job-form\b/.test(html)) fail()
  const input = [...String(html).matchAll(/<input\b[^>]*>/gi)]
    .find(([tag]) => attribute(tag, 'name') === 'awsm_job_id')?.[0]
  if (attribute(input, 'value') !== String(record.id)) fail()
  let postings
  try {
    postings = [...String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
      .flatMap((match) => {
        const json = JSON.parse(match[1])
        return Array.isArray(json) ? json : json['@graph'] || [json]
      })
      .filter((item) => item['@type'] === 'JobPosting')
  } catch {
    fail()
  }
  const posting = postings?.[0]
  if (postings?.length !== 1 || normalizeWhitespace(posting.title) !== normalizeWhitespace(record.title.rendered)
    || !/^Allied Digital(?: Services(?: Ltd\.?)?)?$/.test(posting.hiringOrganization?.name || '')) fail()
  try {
    if (new URL(posting.hiringOrganization.sameAs).origin !== new URL(ROOT_URL).origin) fail()
  } catch {
    fail()
  }
  const address = posting.jobLocation?.address
  const location = typeof address === 'string' ? normalizeWhitespace(address)
    : normalizeWhitespace([address?.addressLocality, address?.addressRegion, address?.addressCountry].filter(Boolean).join(', '))
  const country = typeof address === 'object' ? address?.addressCountry : null
  const department = extractSpecification(html, 'category')
  if (!location || !department) fail()
  if (/^remote$/i.test(location) && !/^(?:India|IN|IND)$/i.test(country || '')) return null
  if (!isIndiaJob({ location, country })) return null
  const indiaLocation = /\bindia\b/i.test(location) ? location : location + ', India'
  return {
    title: normalizeWhitespace(posting.title), company: COMPANY, department,
    location: indiaLocation, city: normalizeCity(location), country: 'India',
    jobId: String(record.id), requisitionId: String(record.id),
    sourceUrl: record.link, applyUrl: record.link,
    employmentType: extractSpecification(html, 'type'),
    experienceRequired: null, minimumQualification: null, preferredQualification: null,
    requiredSkills: [], postingDate: posting.datePosted || null, closingDate: posting.validThrough || null,
    jobDescription: normalizeWhitespace(posting.description),
    remoteStatus: 'On-site',
  }
}

export const createAlliedDigitalServicesScraper = (defaults = {}) => ({run:(options = {})=>runCurrentAllied({...defaults,...options})})

export const run = async (options = {}) => createAlliedDigitalServicesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
