import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

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
  const title = normalizeText(String(html).match(/<h3\b[^>]*class=["'][^"']*\bdetails-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1])
  const location = normalizeText(String(html).match(/<div\b[^>]*class=["']location["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])
  const jobDescription = normalizeText(String(html).match(/<div\b[^>]*class=["']job-abt["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])
  const id = String(html).match(/<input\b[^>]*name=["']job_id["'][^>]*value=["'](\d+)["']/i)?.[1]
  if (title !== card.title || location !== card.location || !id || !jobDescription || jobDescription.length < 40 || !/<form\b[^>]*id=["']careerform["']/i.test(html)) throw new Error('Muvi incomplete or mismatched public job detail')
  return { ...card, jobDescription, jobId: SOURCE + '-' + id, requisitionId: id, applyUrl: card.sourceUrl, company: COMPANY, country: 'India', city: /bhubaneswar/i.test(location) ? 'Bhubaneswar' : null, closingDate: null, postingDate: null }
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
  let unknownScope = false
  for (const card of cards) {
    const detail = readCurrentDetail(await read(card.sourceUrl), card)
    if (isIndiaLocation(card.location)) jobs.push(detail)
    else unknownScope = true
  }
  if (unknownScope && !jobs.length) throw new Error('Muvi public roles have unverified India country scope')
  if (new Set(jobs.map(job => job.jobId)).size !== jobs.length) throw new Error('Muvi duplicate detail job identifier')
  return jobs.map(job => ({ ...job, ...(unknownScope ? { sourceListingComplete: false } : {}) }))
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

    const jobs = /href=["']https:\/\/www\.muvi\.com\/career\/job-listings\/["']/i.test(careersHtml)
      ? await readCurrentInventory(read)
      : extractJobCards(careersHtml)
    if (jobs.length === 0) {
      throw new Error('Muvi Entertainment careers page no longer exposes the verified current openings links')
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      company: COMPANY,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      link: job.applyUrl,
      scrapedAt: (overrideNow || now)(),
    }))
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
