import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const COMPANY_NAME = 'Payatu'
export const COUNTRY_FILTER = 'India'
export const OFFICIAL_CAREERS_URL = 'https://payatu.ai/career'
export const LISTING_URL = 'https://payatu.freshteam.com/jobs'
export const DETAIL_URL_PATTERN = 'https://payatu.freshteam.com/jobs/{opaque_id}/{slug}'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const firstMatch = (source, patterns) => {
  for (const pattern of patterns) {
    const match = String(source ?? '').match(pattern)
    const value = normalizeWhitespace(match?.[1])
    if (value) return value
  }

  return null
}

const toAbsoluteUrl = (value, baseUrl = LISTING_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractDetailPathParts = (value) => {
  try {
    const pathname = new URL(value).pathname.replace(/\/+$/, '')
    const match = pathname.match(/\/jobs\/([^/]+)\/([^/]+)$/i)
    if (!match) return { opaqueId: null, slug: null }

    return {
      opaqueId: match[1],
      slug: match[2],
    }
  } catch {
    return { opaqueId: null, slug: null }
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase() || ''
  if (!normalized) return null
  if (normalized.includes('full time')) return 'Full-time'
  if (normalized.includes('part time')) return 'Part-time'
  if (normalized.includes('intern')) return 'Internship'
  if (normalized.includes('contract')) return 'Contract'
  return normalizeWhitespace(value)
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return COUNTRY_FILTER
  if (/remote|work from home/i.test(normalized)) return `Remote, ${COUNTRY_FILTER}`
  if (/,\s*india$/i.test(normalized)) return normalized
  return `${normalized}, ${COUNTRY_FILTER}`
}

const extractCity = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized || /remote|work from home/i.test(normalized)) return null
  return normalized.split(',')[0]?.trim() || null
}

const inferRemoteStatus = (...values) => {
  const normalizedValues = values
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)

  const joined = normalizedValues.join(' ').toLowerCase()
  if (normalizedValues.some((value) => /^true$/i.test(value))) return 'Remote'
  if (joined.includes('hybrid')) return 'Hybrid'
  if (joined.includes('remote') || joined.includes('work from home')) return 'Remote'
  return 'On-site'
}

const extractExperienceRequired = (value) =>
  normalizeWhitespace((normalizeWhitespace(value) || '').match(/\b\d+\s*(?:\+|-\s*\d+)?\s*years\b/i)?.[0])

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /\bPayatu\b/i.test(page)
    && /View Open Positions|OPEN POSITIONS/i.test(page)
    && /<iframe[^>]+src="[^"]+"/i.test(page)
}

export const extractFreshteamJobsUrl = (html) =>
  toAbsoluteUrl(firstMatch(html, [
    /<iframe[^>]+src="([^"]*freshteam\.com\/jobs[^"]*)"/i,
  ]), OFFICIAL_CAREERS_URL)

export const buildDetailUrl = (opaqueId, slug) =>
  DETAIL_URL_PATTERN
    .replace('{opaque_id}', opaqueId)
    .replace('{slug}', slug)

const extractLocationParts = (value) => {
  const parts = decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .split('\n')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  return {
    locationText: parts[0] || null,
    employmentType: parts[1] || null,
  }
}

export const extractListingJobs = (html) => {
  const jobs = []
  const rolePattern = /<li[^>]*data-portal-role="[^"]+"[^>]*>([\s\S]*?)<\/li>/gi

  for (const roleMatch of String(html ?? '').matchAll(rolePattern)) {
    const roleBlock = roleMatch[1]
    const department = firstMatch(roleBlock, [
      /<h5[^>]*>\s*([^<]+?)\s*(?:<span|<\/h5>)/i,
    ])

    const cardPattern = /<a[^>]+href="([^"]*\/jobs\/[^"/?#]+\/[^"/?#]+)"([^>]*)>([\s\S]*?)<\/a>/gi
    for (const cardMatch of roleBlock.matchAll(cardPattern)) {
      const detailUrl = toAbsoluteUrl(cardMatch[1])
      if (!detailUrl) continue

      const attrs = cardMatch[2]
      const body = cardMatch[3]
      const { opaqueId, slug } = extractDetailPathParts(detailUrl)
      const remoteFlag = firstMatch(attrs, [
        /data-portal-remote-location="([^"]+)"/i,
        /data-portal-remote-location=([^\s>]+)/i,
      ])
      const summary = firstMatch(body, [
        /<div[^>]*class="[^"]*\bjob-desc\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      ])
      const title = firstMatch(body, [
        /<div[^>]*class="[^"]*\bjob-title\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      ]) || firstMatch(body, [
        />([^<]+)<\/a>$/i,
      ])
      const locationInfoMatch = body.match(
        /<div[^>]*class="[^"]*\blocation-info\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      )
      const { locationText, employmentType } = extractLocationParts(locationInfoMatch?.[1] || '')

      jobs.push({
        title,
        summary,
        department,
        detailUrl,
        jobId: opaqueId,
        requisitionId: opaqueId,
        slug,
        locationText,
        employmentType,
        remoteFlag,
      })
    }
  }

  return jobs
}

const extractDescriptionHtml = (source) => {
  const html = String(source ?? '')

  const betweenMarkers = html.match(
    /<a[^>]*>\s*Apply Now\s*<\/a>([\s\S]*?)(?:<h[1-6][^>]*>\s*Submit Your Application|Submit Your Application)/i,
  )
  if (betweenMarkers?.[1]) return betweenMarkers[1]

  return firstMatch(html, [
    /"description"\s*:\s*"((?:\\.|[^"])*)"/i,
  ]) || html
}

export const extractJobDetail = (html, listing = {}) => {
  const source = String(html ?? '')
  const detailUrl = listing.detailUrl || listing.sourceUrl || buildDetailUrl(listing.jobId, listing.slug)
  const { opaqueId, slug } = extractDetailPathParts(detailUrl)
  const title = firstMatch(source, [
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
  ]) || listing.title
  const department = listing.department || firstMatch(source, [
    /<i[^>]*icon-arrow-left[^>]*><\/i>\s*([^<]+)/i,
  ])
  const locationText = listing.locationText || firstMatch(source, [
    /<meta[^>]+property="og:title"[^>]+content="\s*Hiring for [^"]+ for ([^-"]+?)\s*-\s*/i,
  ])
  const descriptionHtml = extractDescriptionHtml(source)
  const jobDescription = normalizeWhitespace(descriptionHtml)

  return {
    title,
    company: COMPANY_NAME,
    department,
    location: normalizeLocation(locationText),
    city: extractCity(locationText),
    country: COUNTRY_FILTER,
    jobId: listing.jobId || opaqueId || slug,
    requisitionId: listing.requisitionId || opaqueId || slug,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    employmentType: normalizeEmploymentType(listing.employmentType),
    experienceRequired: extractExperienceRequired(jobDescription),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
    remoteStatus: inferRemoteStatus(listing.remoteFlag, locationText, jobDescription),
  }
}

export const extractSearchResults = ({
  listingHtml = '',
  listingJobs = null,
  detailHtmlByUrl = {},
} = {}) => {
  const listings = Array.isArray(listingJobs) ? listingJobs : extractListingJobs(listingHtml)
  const hasDetails = Object.keys(detailHtmlByUrl).length > 0
  const selectedListings = hasDetails
    ? listings.filter((listing) => detailHtmlByUrl[listing.detailUrl] != null)
    : listings

  return selectedListings.map((listing) =>
    extractJobDetail(detailHtmlByUrl[listing.detailUrl] || '', listing))
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'payatu',
  timeoutMs: 15000,
})


export const CURRENT_PUBLIC_BOARD_URL = 'https://bandit.fit/'
const hasCurrentPayatuSignal = html => /<title>\s*Career - Payatu\s*<\/title>/i.test(html)
  && /data-wf-domain=["']payatu\.ai["']/i.test(html)
  && /Cybersecurity jobs in India at a CERT-In empanelled firm/i.test(html)
  && /Open roles, right now\./i.test(html)
  && /href=["']https:\/\/bandit\.fit\/[a-z0-9-]+#apply["']/i.test(html)
const currentLocation = value => {
  const raw = normalizeWhitespace(value)
  if (/^Delhi$/i.test(raw || '')) return { location: 'Delhi, India', city: 'Delhi', country: 'India', remoteStatus: 'On-site' }
  if (/^Delhi\/BLR$/i.test(raw || '')) return { location: 'Delhi / Bangalore, India', city: 'Delhi', country: 'India', remoteStatus: 'On-site' }
  if (/^Pune\/Delhi\/BLR$/i.test(raw || '')) return { location: 'Pune / Delhi / Bangalore, India', city: 'Pune', country: 'India', remoteStatus: 'On-site' }
  if (/^Pune\/BLR$/i.test(raw || '')) return { location: 'Pune / Bangalore, India', city: 'Pune', country: 'India', remoteStatus: 'On-site' }
  if (/^Pune$/i.test(raw || '')) return { location: 'Pune, India', city: 'Pune', country: 'India', remoteStatus: 'On-site' }
  if (/^(Bengaluru|Bangalore)$/i.test(raw || '')) return { location: 'Bangalore, India', city: 'Bangalore', country: 'India', remoteStatus: 'On-site' }
  if (/^Pune\/BLR\/Remote$/i.test(raw || '')) return { location: 'Pune / Bangalore / Remote, India', city: 'Pune', country: 'India', remoteStatus: 'Remote' }
  if (/^Remote\s*\/\s*India$/i.test(raw || '')) return { location: 'Remote, India', city: null, country: 'India', remoteStatus: 'Remote' }
  throw new Error('Payatu public role location geography is unverified: ' + raw)
}
const extractCurrentBoard = html => {
  if (!/<title>\s*Careers · Payatu Careers\s*<\/title>/i.test(html)
    || !/<h1>\s*Open roles at Payatu\s*<\/h1>/i.test(html)
    || !/<div class=["']grid["']>/i.test(html)) throw new Error('Payatu public board listing identity changed')
  const inventoryHtml = String(html).replace(/<script\b[^>]*src=["']https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js\/[a-z0-9]+["'][^>]*>\s*<\/script>/gi, '')
  if (/<script\b|\brel=["']next["']|[?&](?:page|offset)=|class=["'][^"']*pagination/i.test(inventoryHtml)) {
    throw new Error('Payatu public board inventory pagination changed')
  }
  const openings = [...String(html).matchAll(/<a\b[^>]*class=["']card["'][^>]*>/gi)]
  const cards = [...String(html).matchAll(/<a\b[^>]*class=["']card["'][^>]*>([\s\S]*?)<\/a>/gi)]
  if (!cards.length || cards.length !== openings.length) throw new Error('Payatu public board role inventory is incomplete')
  const seen = new Set()
  return cards.map(match => {
    const href = match[0].match(/\bhref=["']([^"']+)["']/)?.[1]
    const title = normalizeWhitespace(match[1].match(/<h2[^>]*>([\s\S]*?)<\/h2>/)?.[1])
    const meta = normalizeWhitespace(match[1].match(/<div class=["']meta["']>([\s\S]*?)<\/div>/)?.[1])?.split(' · ')
    const department = normalizeWhitespace(match[1].match(/<span class=["']pill[^"']*["']>([\s\S]*?)<\/span>\s*<\/div>/)?.[1])
    if (!/^[a-z0-9-]+$/.test(href || '') || seen.has(href) || !title || meta?.length !== 2 || !department || !meta[1]
      || /test.*(?:do.?n.?t|not).*apply/i.test(title)) throw new Error('Payatu public role inventory contains an invalid or duplicate role')
    seen.add(href)
    return { slug: href, title, department, family: meta[1], rawLocation: meta[0], ...currentLocation(meta[0]), url: new URL(href, CURRENT_PUBLIC_BOARD_URL).href }
  })
}
const extractCurrentDetail = (html, card) => {
  const page = String(html)
  const expectedTitle = card.title + ' · Payatu Careers'
  const title = normalizeWhitespace(page.match(/<title[^>]*>([^<]*)<\/title>/)?.[1])
  const header = page.match(/<header\b[^>]*>([\s\S]*?)<\/header>/)?.[1] || ''
  const heading = normalizeWhitespace(header.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1])
  const meta = normalizeWhitespace(header.match(/<div class=["']sub["'][^>]*>([\s\S]*?)<\/div>/)?.[1])?.split(' · ')
  const descriptionHtml = page.match(/<div class=["']desc["']>([\s\S]*?)<\/div>\s*<form\b/)?.[1]
  const form = page.match(/<form\b[^>]*id=["']apply-form["'][^>]*>/)?.[0] || ''
  const action = form.match(/\baction=["']([^"']+)["']/)?.[1]
  if (title !== expectedTitle || heading !== card.title || meta?.length !== 4
    || meta[0] !== card.department || meta[1] !== card.family || meta[2] !== card.rawLocation
    || !/^\d+-\d+ yrs$/.test(meta[3]) || !normalizeWhitespace(descriptionHtml)
    || !/\bmethod=["']post["']/.test(form) || new URL(action || '/', card.url).href !== card.url + '/apply'
    || !/<h2\b[^>]*id=["']apply["']/.test(page) || !/href=["']\.\/["'][^>]*>← All open roles/i.test(page)) {
    throw new Error('Payatu public role detail identity, location or application changed: ' + card.url)
  }
  return { title: card.title, company: COMPANY_NAME, department: card.department,
    location: card.location, city: card.city, country: card.country, jobId: card.slug, requisitionId: card.slug,
    sourceUrl: card.url, applyUrl: card.url + '#apply', employmentType: null,
    experienceRequired: meta[3].replace(' yrs', ' Years'), minimumQualification: null, preferredQualification: null,
    requiredSkills: [], postingDate: null, closingDate: null,
    jobDescription: normalizeWhitespace(descriptionHtml), remoteStatus: card.remoteStatus }
}
const runCurrentPayatuBoard = async ({ officialHtml, fetchText, maxJobs, now }) => {
  const linkedSlugs = new Set([...String(officialHtml).matchAll(/href=["']https:\/\/bandit\.fit\/([a-z0-9-]+)#apply["']/g)].map(m => m[1]))
  const cards = extractCurrentBoard(await fetchText(CURRENT_PUBLIC_BOARD_URL))
  if (!cards.some(card => linkedSlugs.has(card.slug))) throw new Error('Payatu official application handoff no longer matches the public board')
  const selected = maxJobs ? cards.slice(0, maxJobs) : cards
  const jobs = []
  for (let start = 0; start < selected.length; start += 3) {
    jobs.push(...await Promise.all(selected.slice(start, start + 3).map(async card => extractCurrentDetail(await fetchText(card.url), card))))
  }
  // The marketing CMS contains stale and test postings; the linked, branded
  // application board and its live form pages establish the active inventory.
  const decorated = jobs.map(job => ({ ...job, source: 'payatu', link: job.applyUrl, scrapedAt: now(),
    ...(selected.length !== cards.length ? { sourceListingComplete: false } : {}) }))
  if (selected.length !== cards.length) return decorated
  return attachInventoryEvidence(decorated, { status: 'complete-inventory', surface: CURRENT_PUBLIC_BOARD_URL,
    firstParty: true, listingComplete: true, pagesFetched: 1, reportedTotal: null, indiaFacetCount: decorated.length,
    verifiedAt: now(), reason: 'employer-linked-active-board-all-cards-and-live-application-details-reconciled' })
}

export const createPayatuScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const suppliedFetchText = options.fetchText || defaultFetchText
    const fetchText = async url => { options.signal?.throwIfAborted(); return suppliedFetchText(url, { signal: options.signal }) }
    const now = options.now || (() => new Date().toISOString())
    const officialHtml = await fetchText(OFFICIAL_CAREERS_URL)
    if (hasCurrentPayatuSignal(officialHtml)) return runCurrentPayatuBoard({ officialHtml, fetchText, maxJobs, now })

    if (!hasOfficialCareersSignal(officialHtml)) {
      throw new Error('Payatu official careers page no longer matches the verified official public surface')
    }

    const listingUrl = extractFreshteamJobsUrl(officialHtml)
    if (listingUrl !== LISTING_URL) {
      throw new Error('Verified official Payatu careers handoff no longer points to the known public Freshteam board')
    }

    const listingHtml = await fetchText(listingUrl)
    const listingJobs = extractListingJobs(listingHtml)
    const selectedListings = maxJobs ? listingJobs.slice(0, maxJobs) : listingJobs
    const detailHtmlByUrl = {}

    await Promise.all(selectedListings.map(async (listing) => {
      detailHtmlByUrl[listing.detailUrl] = await fetchText(listing.detailUrl)
    }))

    const jobs = extractSearchResults({
      listingJobs: selectedListings,
      detailHtmlByUrl,
    })

    return jobs.map((job) => ({
      ...job,
      source: 'payatu',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createPayatuScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Payatu scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'payatu')
    console.log('DB result:', result)
    process.exit(0)
  }
}
