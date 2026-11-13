import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

import { MUVI_ENTERTAINMENT_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOB_LISTINGS_URL = 'https://www.muvi.com/career/job-listings/'

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

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  if (/<title>\s*Career\s*-\s*Muvi\s*<\/title>/i.test(page)
    && /href=["']https:\/\/www\.muvi\.com\/career\/job-listings\/["']/i.test(page)) return true

  return /Muvi - Build your Career with us! View current job openings at our various offices/i.test(page)
    && /Current Openings/i.test(page)
    && /career\/?/i.test(page)
}

export const extractJobCards = (html = '') => [...String(html ?? '').matchAll(
  /<div class="list-data">([\s\S]*?)<div class="clearfix"><\/div>/gi,
)]
  .map((match) => {
    const block = match[1]
    const href = toAbsoluteUrl(block.match(/href="([^"]+\/jobs\/[^"]+)"/i)?.[1])
    const title = normalizeText(block.match(/class="job-title">([\s\S]*?)<\/span>/i)?.[1])
    const city = normalizeText(block.match(/class="job-location"[^>]*>[\s\S]*?<\/i>\s*([^<]+)</i)?.[1])
    const slug = getSlugFromUrl(href)
    const description = normalizeText(
      block.match(/<div class="job-description">\s*<p>([\s\S]*?)<\/p>/i)?.[1],
    )

    if (!title || !slug || !href) return null

    return {
      title,
      company: COMPANY,
      department: null,
      location: city || 'India',
      city,
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
      jobDescription: description || title,
    }
  })
  .filter(Boolean)

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const isIndiaLocation = (value) => /\bindia\b|\bbhubaneswar\b/i.test(value)

const isTrustedCurrentDetailUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
      && url.hostname === 'www.muvi.com'
      && !url.search
      && !url.hash
      && (/^\/career\/jobs\/[a-z0-9-]+\/?$/i.test(url.pathname)
        || /^\/career\/job-listings\/[a-z0-9-]+\/[a-z0-9-]+\/?$/i.test(url.pathname))
  } catch {
    return false
  }
}

const extractCurrentCards = (html) => {
  const blocks = String(html).split(/<div\b[^>]*class=["']job-card["'][^>]*>/i).slice(1)
  const cards = blocks.map(block => {
    const sourceUrl = block.match(/<a\b[^>]*href=["']([^"']+)["']/i)?.[1]
    const title = normalizeText(block.match(/<h6\b[^>]*>([\s\S]*?)<\/h6>/i)?.[1])
    const tags = [...(block.match(/class=["']job-card-tags["'][^>]*>([\s\S]*?)<\/div>/i)?.[1] || '').matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)].map(m => normalizeText(m[1]))
    if (!isTrustedCurrentDetailUrl(sourceUrl) || !title || tags.length !== 4 || !/^\d+ Openings$/i.test(tags[2] || '') || !tags[3]) throw new Error('Muvi incomplete listing: malformed role card')
    return { title, sourceUrl, experienceRequired: tags[0], location: tags[3] }
  })
  if (!cards.length) throw new Error('Muvi incomplete listing: empty jobs page')
  if (new Set(cards.map(card => card.sourceUrl)).size !== cards.length) throw new Error('Muvi duplicate job card')
  return cards
}

const getPageLinks = (html, requestedPage) => {
  const links = [...String(html).matchAll(/<a\b[^>]*class=["']([^"']*\bpage-link\b[^"']*)["'][^>]*href=["']([^"']+)["'][^>]*>/gi)]
  if (!links.length) {
    if (requestedPage !== 1) throw new Error('Muvi incomplete pagination controls')
    return [1]
  }
  const pages = new Set()
  let activePage = null
  for (const link of links) {
    const match = link[2].match(/^https:\/\/www\.muvi\.com\/career\/job-listings\/(?:page\/(\d+)\/)?$/)
    if (!match) throw new Error('Muvi unexpected pagination URL')
    const page = Number(match[1] || 1)
    if (!Number.isSafeInteger(page) || page < 1 || page > 50) throw new Error('Muvi pagination limit exceeded')
    pages.add(page)
    if (/\bactive\b/.test(link[1])) {
      if (activePage !== null && activePage !== page) throw new Error('Muvi conflicting active pagination page')
      activePage = page
    }
  }
  if (activePage !== requestedPage) throw new Error('Muvi repeated or mismatched pagination page')
  return [...pages].sort((a,b) => a-b)
}

const readCurrentDetail = (html, card) => {
  const doc = readNativeDocument(html), cls = (node, name) => (node.attrs.class || '').split(/\s+/).includes(name)
  const only = predicate => { const nodes = doc.nodes(predicate); return nodes.length === 1 ? nodes[0] : null }
  const text = node => node ? doc.text(node).replace(/\s+/g, ' ').trim() : null
  const title = text(only(node => node.tag === 'h3' && cls(node, 'details-title')))
  const location = text(only(node => node.tag === 'div' && cls(node, 'location')))
  // Read the whole active authored container, including nested role sections.
  const jobDescription = text(only(node => node.tag === 'div' && cls(node, 'job-abt')))
  const id = only(node => node.tag === 'input' && node.attrs.name === 'job_id')?.attrs.value
  const applicationAvailable = /^\d+$/.test(id || '') && Boolean(only(node => node.tag === 'form' && node.attrs.id === 'careerform'))
  // The current Jobs template also publishes a complete role rendition without
  // the application form or numeric application ID. Retain that advertised URL
  // as an observation; its hiring/application status cannot be qualified.
  const applicationless = !doc.nodes(node => node.tag === 'form' || node.tag === 'input' && node.attrs.name === 'job_id').length
    && normalizeText(only(node => node.tag === 'title')?.raw) === 'Jobs - Muvi'
    && Boolean(only(node => node.tag === 'link' && node.attrs.rel === 'canonical' && node.attrs.href === 'https://www.muvi.com/career/jobs/'))
    && Boolean(only(node => node.tag === 'meta' && node.attrs.property === 'og:site_name' && node.attrs.content === 'Muvi'))
  if (title !== card.title || location !== card.location || !jobDescription || jobDescription.length < 40
    || !applicationAvailable && !applicationless) throw new Error('Muvi incomplete or mismatched public job detail')
  const india = isIndiaLocation(location)
  return { ...card, jobDescription, sourceDescription: jobDescription, sourceNativeCriteriaComplete: true,
    sourceDetailComplete: applicationAvailable, sourceDetailFailureKind: applicationAvailable ? null : 'native-application-unavailable',
    jobId: SOURCE + '-' + getSlugFromUrl(card.sourceUrl), requisitionId: id ?? null,
    sourceNativeApplicationId: id ?? null, sourceNativeJobUrlIdentity: card.sourceUrl,
    sourceNativeApplicationHandoffAvailable: applicationAvailable, activeApplyVerified: false, applicationVisited: false,
    sourceCurrentNativeRoleQualified: applicationAvailable && india,
    applyUrl: card.sourceUrl, company: COMPANY,
    country: india ? 'India' : null, sourceCountryScopeUnresolved: !india,
    city: /bhubaneswar/i.test(location) ? 'Bhubaneswar' : null, closingDate: null, postingDate: null }
}

const readCurrentInventory = async (read) => {
  const cards = []
  const seen = new Set()
  const pending = [1]
  const visited = new Set()
  while (pending.length) {
    const page = pending.shift()
    const url = page === 1 ? JOB_LISTINGS_URL : JOB_LISTINGS_URL + 'page/' + page + '/'
    const html = await read(url)
    if (!/<title>\s*Job Listings\s*-\s*Muvi\s*<\/title>/i.test(html)) throw new Error('Muvi unexpected public listings page')
    const pageCards = extractCurrentCards(html)
    const pageLinks = getPageLinks(html, page)
    visited.add(page)
    for (const linked of pageLinks) if (!visited.has(linked) && !pending.includes(linked)) pending.push(linked)
    for (const card of pageCards) {
      if (seen.has(card.sourceUrl)) throw new Error('Muvi duplicate job across pagination')
      seen.add(card.sourceUrl)
      cards.push(card)
    }
  }
  if (Math.max(...visited) !== visited.size) throw new Error('Muvi incomplete pagination coverage')
  const jobs = []
  for (const card of cards) {
    const detail = readCurrentDetail(await read(card.sourceUrl), card)
    jobs.push(detail)
  }
  if (new Set(jobs.map(job => job.jobId)).size !== jobs.length) throw new Error('Muvi duplicate detail job identifier')
  return jobs.map(job => ({ ...job, sourceListingComplete: false, sourceScopeComplete: false,
    lifecycleCleanupAllowed: false }))
}

export const createMuviEntertainmentScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow, signal } = {}) {
    signal?.throwIfAborted()
    const read = async (url) => {
      signal?.throwIfAborted()
      const html = await fetchText(url, { signal })
      signal?.throwIfAborted()
      return html
    }
    const careersHtml = await read(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Muvi Entertainment verified careers page no longer matches the trusted first-party surface')
    }

    const current = /href=["']https:\/\/www\.muvi\.com\/career\/job-listings\/["']/i.test(careersHtml)
    const jobs = current
      ? await readCurrentInventory(read)
      : extractJobCards(careersHtml)
    if (jobs.length === 0) {
      throw new Error('Muvi Entertainment careers page no longer exposes the verified current openings links')
    }

    const mapped = jobs.map((job) => ({
      ...job,
      source: SOURCE,
      company: COMPANY,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      link: job.applyUrl,
      scrapedAt: (overrideNow || now)(),
    }))
    if (!current) return mapped
    const qualified = mapped.filter(job => job.sourceCurrentNativeRoleQualified === true)
    const observation = { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: mapped.length,
      observedVacancyCount: mapped.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null }
    attachSourceObservationEvidence(qualified, observation)
    Object.defineProperty(qualified, 'nativeCollectionEvidence', { value: { ...observation,
      observations: mapped, returnedQualifiedRecords: qualified.length, companyCareerPage: CAREERS_URL,
      sourceListingComplete: false, lifecycleCleanupAllowed: false }, configurable: true })
    return attachInventoryEvidence(qualified, { status: 'coverage-gap',
      surface: JOB_LISTINGS_URL, firstParty: true, listingComplete: false,
      reportedTotal: null, indiaFacetCount: null,
      verifiedAt: (overrideNow || now)(),
      reason: `Retained ${mapped.length} advertised native role observations and full descriptions; company scope and closing cohort are unverified; ${mapped.filter(job => job.sourceCountryScopeUnresolved).length} countries unresolved; ${mapped.filter(job => !job.sourceNativeApplicationHandoffAvailable).length} native applications unavailable` })
  },
})

export const run = async (options = {}) => createMuviEntertainmentScraper().run(options)

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
