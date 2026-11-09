import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { runTechnotreonNativeDiscovery } from './nativeDiscovery.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'technotreon'
export const COMPANY = 'Technotreon'
export const HOMEPAGE_URL = 'https://technotreon.in/'
export const CAREERS_URL = 'https://technotreon.in/careers'
export const COMPANY_DOMAIN = 'technotreon.in'
export const ATS_PLATFORM = 'official-company-careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(value)

const toAbsoluteUrl = (value) => {
  const normalized = normalizeWhitespace(value)
  return normalized ? new URL(normalized, CAREERS_URL).toString() : null
}

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const normalizeDepartment = (title) => normalizeWhitespace(title)
  .replace(/\s*(?:standardised\s+)?aptitude\s+test$/i, '')
  .trim()

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasTransportFailure = (error) => {
  const code = String(error?.cause?.code ?? error?.code ?? '')
  const message = String(error?.cause?.message ?? error?.message ?? error ?? '')

  return [
    'UND_ERR_CONNECT_TIMEOUT',
    'ENOTFOUND',
    'ENOENT',
    'ECONNABORTED',
  ].includes(code)
    || /\bconnect timeout\b/i.test(message)
    || /\bgetaddrinfo\b/i.test(message)
    || /\bdns\b/i.test(message)
    || /\btimeout\b/i.test(message)
}

const buildDiscoveryOnlyEvidence = (now) =>
  attachInventoryEvidence([], {
    status: 'discovery-only',
    surface: CAREERS_URL,
    firstParty: true,
    listingComplete: false,
    pagesFetched: 0,
    reportedTotal: null,
    indiaFacetCount: null,
    verifiedAt: now(),
    reason: 'Technotreon verified careers surface is currently unreachable; first-party job inventory cannot be verified.',
  })

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Technotreon:\s*The Innovation Company\s*<\/title>/i.test(page)
    && /href=["']\/careers["']/i.test(page)
    && normalized.includes('TECHNOTREON: THE INNOVATION COMPANY')
    && normalized.includes('We invent, patent, and commercialize breakthrough technologies')
    && normalized.includes('At Technotreon, we invent the next big thing')
    && normalized.includes('research[at]technotreon[dot]in')
}

const hasCurrentCareersSignal = (html) => {
  const page = String(html ?? '')
  const title = stripTags(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])
  const text = stripTags(page)
  // The title scopes these role cards to Pune, rather than inferring location from a footer.
  return /^Careers at Technotreon\s*\|.*\bJobs in Pune$/i.test(title)
    && text.includes('CAREERS AT TECHNOTREON')
    && text.includes('hr@technotreon.in')
    && /data-ux=["']ContentCard["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const legacy = /<title>\s*CAREERS\s*<\/title>/i.test(page)
    && normalized.includes('DEPARTMENTS AT TECHNOTREON')
    && normalized.includes('STANDARDISED Aptitude Test')
  return (legacy || hasCurrentCareersSignal(page))
    && normalized.includes('Open call for all humans who are not machines')
    && /href=["']https:\/\/forms\.gle\//i.test(page)
}

const extractCurrentListings = (page) => {
  const listings = []
  // Each responsive card contains stale hidden headings. The numbered primary
  // heading, description and button identify the actual role within that card.
  for (const start of page.matchAll(/<div\b[^>]*\bdata-ux=["']ContentCard["'][^>]*>/gi)) {
    const tags = /<\/?div\b[^>]*>/gi
    tags.lastIndex = start.index + start[0].length
    let depth = 1
    let end = null
    for (let tag; (tag = tags.exec(page));) {
      depth += /^<\//.test(tag[0]) ? -1 : 1
      if (depth === 0) { end = tag.index; break }
    }
    if (end === null) throw new Error('Technotreon incomplete role card markup')
    const card = page.slice(start.index + start[0].length, end)
    const hasApplication = /href=["']https:\/\/forms\.gle\//i.test(card)
    const heading = card.match(/<h[2-6]\b[^>]*\bdata-aid=["']CONTENT_HEADLINE(\d+)_RENDERED["'][^>]*>([\s\S]*?)<\/h[2-6]>/i)
    if (!heading) {
      if (hasApplication || /aptitude\s+test/i.test(stripTags(card))) throw new Error('Technotreon incomplete role card heading')
      continue
    }
    const title = stripTags(heading[2])
    if (!/aptitude\s+test$/i.test(title)) {
      if (hasApplication) throw new Error('Technotreon incomplete role card title')
      continue
    }
    const number = heading[1]
    const description = card.match(new RegExp('<div\\b[^>]*\\bdata-aid=["\']CONTENT_DESCRIPTION' + number + '_RENDERED["\'][^>]*>([\\s\\S]*?)<\\/div>', 'i'))?.[1]
    const button = card.match(new RegExp('<a\\b[^>]*\\bdata-aid=["\']CONTENT_CTA_BTN' + number + '_RENDERED["\'][^>]*>([\\s\\S]*?)<\\/a>', 'i'))
    const rawApplyUrl = button?.[0].match(/\bhref=["']([^"']+)["']/i)?.[1]
    const paragraphs = Array.from(String(description || '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi), ([, value]) => stripTags(value)).filter(Boolean)
    let applyUrl = null
    try {
      const url = new URL(rawApplyUrl)
      if (url.protocol === 'https:' && url.hostname === 'forms.gle' && url.pathname !== '/') applyUrl = url.toString()
    } catch {}
    if (!applyUrl || !paragraphs.length || !/^apply$/i.test(stripTags(button?.[1]))) {
      throw new Error('Technotreon incomplete role card ' + number)
    }
    listings.push({ title, applyUrl, department: normalizeDepartment(title),
      description: paragraphs.join(' '), location: 'Pune', city: 'Pune' })
  }
  return listings
}

export const extractListings = (html) => {
  const page = String(html ?? '').replace(/<script[\s\S]*?<\/script>/gi, '')
  if (hasCurrentCareersSignal(page)) return extractCurrentListings(page)
  const pattern = /<h2[^>]*>\s*([^<]*STANDARDISED Aptitude Test)\s*<\/h2>([\s\S]*?)<a[^>]+href=["']([^"']+)["'][^>]*>\s*Apply\s*<\/a>/gi
  const listings = []

  for (const [, rawTitle, content, rawApplyUrl] of page.matchAll(pattern)) {
    const paragraphs = Array.from(
      content.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi),
      ([, paragraph]) => stripTags(paragraph),
    ).filter(Boolean)
    const title = stripTags(rawTitle)
    const applyUrl = toAbsoluteUrl(rawApplyUrl)

    if (!title || !applyUrl || paragraphs.length === 0) {
      continue
    }

    listings.push({
      title,
      applyUrl,
      department: normalizeDepartment(title),
      description: paragraphs.join(' '),
      location: null,
    })
  }

  return listings
}

const createLegacyTechnotreonParser = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString(), signal } = {}) {
    signal?.throwIfAborted()
    let homepageHtml = null

    try {
      homepageHtml = await fetchText(HOMEPAGE_URL, { signal })
      signal?.throwIfAborted()
    } catch (error) {
      signal?.throwIfAborted()
      if (!hasTransportFailure(error)) {
        throw error
      }
    }

    if (homepageHtml && !hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Technotreon verified official homepage changed; refusing to scrape guessed jobs')
    }

    let careersHtml
    try {
      careersHtml = await fetchText(CAREERS_URL, { signal })
    } catch (error) {
      signal?.throwIfAborted()
      if (hasTransportFailure(error)) return buildDiscoveryOnlyEvidence(now)
      throw error
    }

    signal?.throwIfAborted()
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Technotreon verified official careers page changed; refusing to scrape guessed jobs')
    }

    const listings = extractListings(careersHtml)
    if (listings.length === 0) {
      throw new Error('Technotreon verified official careers page no longer exposes parseable public openings')
    }

    return listings.map((listing) => {
      const requisitionId = `${SOURCE}-${slugify(listing.title)}`

      return {
        title: listing.title,
        company: COMPANY,
        location: listing.location,
        city: listing.city || null,
        country: null,
        source: SOURCE,
        sourceUrl: CAREERS_URL,
        applyUrl: listing.applyUrl,
        link: listing.applyUrl,
        companyCareerPage: CAREERS_URL,
        companyDomain: COMPANY_DOMAIN,
        atsPlatform: ATS_PLATFORM,
        jobId: requisitionId,
        requisitionId,
        department: listing.department,
        employmentType: null,
        remoteStatus: null,
        experienceRequired: null,
        jobDescription: listing.description,
        requiredSkills: [],
        preferredQualification: null,
        minimumQualification: null,
        closingDate: null,
        postingDate: null,
        scrapedAt: now(),
      }
    })
  },
})

export const createTechnotreonScraper = () => ({ run: runTechnotreonNativeDiscovery })
export const run = runTechnotreonNativeDiscovery

const isDirectExecution = (() => {
  if (!process.argv[1]) return false

  try {
    return path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  } catch {
    return false
  }
})()

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
