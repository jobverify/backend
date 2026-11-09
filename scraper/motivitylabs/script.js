import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import MOTIVITYLABS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = MOTIVITYLABS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOB_OPENINGS_URL = PROVIDER_METADATA.officialCareersPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")

const stripScriptsAndStyles = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const htmlToLines = (value) => decodeHtmlEntities(
  stripScriptsAndStyles(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6|a)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)
  .split(/\r?\n/)
  .map((line) => normalizeWhitespace(line))
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

const extractSectionLines = (lines, startLabels, endLabels) => {
  const startIndex = lines.findIndex((line) => startLabels.includes(line))
  if (startIndex < 0) return []

  const values = []
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (endLabels.includes(line)) break
    values.push(line)
  }

  return values
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = htmlToLines(html).join(' ').toLowerCase()

  return normalized.includes('join the circle of motivating innovators')
    && normalized.includes('current roles available')
    && normalized.includes('careers@motivitylabs.com')
}

export const hasCurrentCareersSignal = (html = '') =>
  /<title>\s*Careers\s*·\s*Motivity Labs\s*<\/title>/i.test(String(html))
  && /href=["']\/jobs\/['"]/i.test(String(html))

const readJsonLd = (html, type) => {
  for (const match of String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data
    try { data = JSON.parse(match[1]) } catch { continue }
    if (data?.['@type'] === type) return data
  }
  throw new Error(`Motivity Labs ${type} JSON-LD is missing`)
}


const PUBLIC_JOBS_API = 'https://ml-websites-backend.onrender.com/api/jobs?includeAll=true'
const hasApiCareersSignal = html => {
  if (!/<title>\s*Motivity Labs\s*—\s*AI-First Engineering for Enterprise Transformation\s*<\/title>/i.test(String(html))
    || !/href=["']\/jobs\/["']/i.test(String(html))) return false
  try {
    const data = readJsonLd(html, 'WebPage')
    return data.url === CAREERS_URL && data.name === 'Careers at Motivity Labs'
      && data.isPartOf?.name === 'Motivity Labs' && data.isPartOf?.url === 'https://motivitylabs.com'
  } catch { return false }
}
const verifyPublicJobsClient = async (html, fetchText) => {
  const data = readJsonLd(html, 'CollectionPage')
  if (data.url !== JOB_OPENINGS_URL || data.name !== 'Careers at Motivity Labs' || !Array.isArray(data.hasPart)) {
    throw new Error('Motivity Labs public jobs client listing identity changed')
  }
  const urls = [...new Set([...String(html).matchAll(/<script\b[^>]*src=["'](\/_next\/static\/chunks\/[a-z0-9_-]+\.js)["'][^>]*>/gi)]
    .map(match => new URL(match[1], JOB_OPENINGS_URL).href))]
  if (!urls.length || urls.length > 32) throw new Error('Motivity Labs public jobs client scripts changed')
  let readerVerified = false, loaderVerified = false
  for (let start = 0; start < urls.length && !(readerVerified && loaderVerified); start += 4) {
    for (const js of await Promise.all(urls.slice(start, start + 4).map(url => fetchText(url)))) {
      readerVerified ||= js.includes('https://ml-websites-backend.onrender.com')
        && js.includes('/api/jobs') && js.includes('?includeAll=true')
        && js.includes('fetchJobsFromApi') && js.includes('cache:"no-store"') && js.includes('Accept:"application/json"')
      loaderVerified ||= /fetchJobsFromApi\)\(!0\)/.test(js) && js.includes('isExpired') && js.includes('encodeURIComponent')
    }
  }
  if (!readerVerified || !loaderVerified) throw new Error('Motivity Labs public jobs client API or expiry loader changed')
}
const validPublicDate = (value, dateOnly = false) => {
  if (typeof value !== 'string' || !(dateOnly ? /^\d{4}-\d{2}-\d{2}$/.test(value) : /^\d{4}-\d{2}-\d{2}T/.test(value))) return false
  const parsed = new Date(dateOnly ? value + 'T00:00:00.000Z' : value)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value.slice(0, 10)
}
const runPublicApiJobs = async ({ fetchText, now, listingHtml }) => {
  await verifyPublicJobsClient(listingHtml, fetchText)
  let payload
  try { payload = JSON.parse(await fetchText(PUBLIC_JOBS_API)) } catch (error) { throw new Error('Motivity Labs public jobs API unavailable: ' + error.message) }
  if (payload?.ok !== true || !Number.isInteger(payload.count) || payload.count < 0
    || !Array.isArray(payload.data) || payload.count !== payload.data.length
    || ['hasMore','next','nextPage','total','totalPages','pagination'].some(key => payload[key] != null)) {
    throw new Error('Motivity Labs public API inventory count or pagination changed')
  }
  const ids = new Set(), slugs = new Set(), jobs = []
  let unknownGeography = false
  const scrapedAt = now(), currentTime = new Date(scrapedAt).getTime()
  if (!Number.isFinite(currentTime)) throw new Error('Motivity Labs current scrape time is invalid')
  for (const row of payload.data) {
    if (!row || typeof row !== 'object' || Array.isArray(row)
      || typeof row.jobId !== 'string' || !/^[a-zA-Z0-9-]+$/.test(row.jobId)
      || typeof row.slug !== 'string' || !/^[a-z0-9-]+$/.test(row.slug)
      || !normalizeWhitespace(row.title) || !normalizeWhitespace(row.description)
      || row.status !== 'published' || typeof row.location !== 'string'
      || !['Work from Office','Remote','Hybrid'].includes(row.type)
      || !Array.isArray(row.skills) || row.skills.some(skill => typeof skill !== 'string' || !normalizeWhitespace(skill))
      || !Number.isFinite(row.experienceMin) || row.experienceMin < 0
      || (row.experienceMax !== null && (!Number.isFinite(row.experienceMax) || row.experienceMax < row.experienceMin))
      || !validPublicDate(row.expiresOn, true) || !validPublicDate(row.createdAt)
      || ids.has(row.jobId) || slugs.has(row.slug)) throw new Error('Motivity Labs public API inventory contains an invalid or duplicate role')
    ids.add(row.jobId); slugs.add(row.slug)
    // Match the public client's end-of-day expiry rule in the host timezone.
    if (new Date(row.expiresOn + 'T23:59:59').getTime() < currentTime) continue
    const location = normalizeWhitespace(row.location)
    if (!/^(?:Hyderabad(?:,\s*India)?|India)$/i.test(location || '')) { unknownGeography = true; continue }
    const city = /^India$/i.test(location) ? null : 'Hyderabad'
    const sourceUrl = new URL('/jobs/' + encodeURIComponent(row.slug) + '/', JOB_OPENINGS_URL).href
    jobs.push({ title: normalizeWhitespace(row.title), company: COMPANY, department: null,
      location: city ? city + ', India' : 'India', city, country: 'India', jobId: row.slug,
      requisitionId: row.jobId, sourceUrl, applyUrl: sourceUrl, employmentType: normalizeWhitespace(row.jobType),
      experienceRequired: row.experienceMax === null ? row.experienceMin + '+ Years' : row.experienceMin + '–' + row.experienceMax + ' Years',
      minimumQualification: null, preferredQualification: null, requiredSkills: row.skills.map(normalizeWhitespace),
      postingDate: row.createdAt, closingDate: row.expiresOn, jobDescription: normalizeWhitespace(row.description),
      remoteStatus: row.type === 'Work from Office' ? 'On-site' : row.type, source: SOURCE, link: sourceUrl, scrapedAt })
  }
  if (unknownGeography && !jobs.length) throw new Error('Motivity Labs geography is unverified for every current role')
  return jobs.map(job => ({ ...job, ...(unknownGeography ? { sourceListingComplete: false } : {}) }))
}

export const extractCurrentListing = (html) => {
  if (!/<title>\s*Careers\s*—\s*Open Roles\s*·\s*Motivity Labs\s*<\/title>/i.test(String(html))) {
    throw new Error('Motivity Labs current first-party openings page changed')
  }
  const data = readJsonLd(html, 'CollectionPage')
  if (!Array.isArray(data.hasPart) || !data.hasPart.length) throw new Error('Motivity Labs current job inventory is missing')
  const urls = new Set()
  return data.hasPart.map(row => {
    const url = String(row?.url ?? '')
    if (row?.['@type'] !== 'JobPosting' || !normalizeWhitespace(row.title)
      || !/^https:\/\/motivitylabs\.com\/jobs\/[a-z0-9-]+\/$/.test(url)) {
      throw new Error('Motivity Labs current job inventory contains an invalid role')
    }
    if (urls.has(url)) throw new Error('Motivity Labs current job inventory contains a duplicate URL')
    urls.add(url)
    return { title: normalizeWhitespace(row.title), url }
  })
}

const runCurrentJobs = async ({ fetchText, now, listingHtml }) => {
  const listing = extractCurrentListing(listingHtml)
  const jobs = []
  let unknownGeography = false
  for (let start = 0; start < listing.length; start += 5) {
    const batch = await Promise.all(listing.slice(start, start + 5).map(async row => {
      const detail = readJsonLd(await fetchText(row.url), 'JobPosting')
      if (detail.url !== row.url || normalizeWhitespace(detail.title) !== row.title
        || !normalizeWhitespace(detail.description)) {
        throw new Error(`Motivity Labs current job detail changed: ${row.url}`)
      }
      return { row, detail }
    }))
    for (const { row, detail } of batch) {
      const country = normalizeWhitespace(detail.applicantLocationRequirements?.name)
      if (!country) { unknownGeography = true; continue }
      if (country !== 'India') continue
      const locality = normalizeWhitespace(detail.jobLocation?.address?.addressLocality)
      const city = locality && locality !== 'India' ? locality : null
      const jobId = row.url.split('/').filter(Boolean).at(-1)
      jobs.push({
        title: row.title, company: COMPANY, department: null,
        location: city ? `${city}, India` : 'India', city, country: 'India',
        jobId, requisitionId: jobId, sourceUrl: row.url, applyUrl: row.url,
        employmentType: null, experienceRequired: normalizeWhitespace(detail.experienceRequirements),
        minimumQualification: null, preferredQualification: null, requiredSkills: [],
        postingDate: normalizeWhitespace(detail.datePosted), closingDate: null,
        jobDescription: normalizeWhitespace(detail.description),
        remoteStatus: detail.employmentType === 'WORK_FROM_OFFICE' ? 'On-site' : null,
        source: SOURCE, link: row.url, scrapedAt: now(),
      })
    }
  }
  if (unknownGeography && !jobs.length) throw new Error('Motivity Labs geography is unverified for every current role')
  return jobs.map(job => ({ ...job, ...(unknownGeography ? { sourceListingComplete: false } : {}) }))
}

export const hasJobOpeningsSignal = (html = '') => {
  const normalized = (normalizeWhitespace(stripScriptsAndStyles(html)) || '').toLowerCase()

  return normalized.includes('current openings')
    && normalized.includes('more details')
    && normalized.includes('hyderabad')
}

export const extractJobCards = (html = '') => [...String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
  .map((match) => {
    const href = match[1]
    const anchorHtml = String(match[0] ?? '')
    const text = normalizeWhitespace(match[2])
    if (!href || !text || !text.includes('More Details')) return null

    const structuredTitle = normalizeWhitespace(
      anchorHtml.match(/<h[12]\b[^>]*class=["'][^"']*awsm-job-post-title[^"']*["'][^>]*>([\s\S]*?)<\/h[12]>/i)?.[1],
    )
    const structuredSpecs = [...anchorHtml.matchAll(
      /<span\b[^>]*class=["'][^"']*awsm-job-specification-term[^"']*["'][^>]*>([\s\S]*?)<\/span>/gi,
    )]
      .map((specMatch) => normalizeWhitespace(specMatch[1]))
      .filter(Boolean)

    if (structuredTitle && structuredSpecs.length >= 2) {
      return {
        title: structuredTitle,
        experienceRequired: normalizeWhitespace(structuredSpecs.slice(0, -1).join(' ')),
        location: normalizeWhitespace(structuredSpecs.at(-1)),
        detailUrl: href,
      }
    }

    const cleaned = text.replace(/\s+More Details$/i, '')
    const parts = cleaned.match(/^(.*)\s+(\d+\+\s*(?:Years|years))\s+([A-Za-z]+)$/)
    if (!parts) return null

    return {
      title: normalizeWhitespace(parts[1]),
      experienceRequired: normalizeWhitespace(parts[2]),
      location: normalizeWhitespace(parts[3]),
      detailUrl: href,
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html = '', card = {}, { scrapedAt } = {}) => {
  const lines = htmlToLines(html)
  const title = lines.find((line) => line.startsWith('Job Title:'))?.replace(/^Job Title:\s*/i, '')
    || normalizeWhitespace(card.title)
  const experienceRequired = lines.find((line) => line.startsWith('Experience:'))?.replace(/^Experience:\s*/i, '')
    || normalizeWhitespace(card.experienceRequired)
  const employmentType = lines.find((line) => line.startsWith('Job Type:'))?.replace(/^Job Type:\s*/i, '')
    || null
  const location = lines.find((line) => line.startsWith('Job Location:'))?.replace(/^Job Location:\s*/i, '')
    || normalizeWhitespace(card.location)
  const jobDescription = extractSectionLines(
    lines,
    ['Area Role & Responsibilities'],
    ['Required Competencies', 'Technical Skill Set / Competencies', 'Experience:', 'Job Type:', 'Job Location:'],
  )[0] || null
  const requiredSkills = extractSectionLines(
    lines,
    ['Required Competencies'],
    ['Technical Skill Set / Competencies', 'Please share your references to Talent@motivitylabs.com / referrals@motivitylabs.com', 'Experience:', 'Job Type:', 'Job Location:'],
  ).filter(Boolean)
  const jobId = String(card.detailUrl ?? '').split('/').filter(Boolean).at(-1) || null

  if (!title || !jobId) return null

  return {
    title: normalizeWhitespace(title),
    company: COMPANY,
    department: null,
    location: location ? `${normalizeWhitespace(location)}, India` : 'India',
    city: normalizeWhitespace(location),
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl: card.detailUrl,
    // Applications are submitted by email, with instructions on this canonical job page.
    applyUrl: card.detailUrl,
    employmentType: normalizeWhitespace(employmentType),
    experienceRequired: normalizeWhitespace(experienceRequired),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace(jobDescription),
    remoteStatus: 'On-site',
    source: SOURCE,
    link: card.detailUrl,
    scrapedAt,
  }
}

export const createMotivityLabsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText: suppliedFetchText = defaultFetchText, signal } = {}) {
    const fetchText = async url => { signal?.throwIfAborted(); return suppliedFetchText(url, { signal }) }
    const careersHtml = await fetchText(CAREERS_URL)
    if (hasApiCareersSignal(careersHtml)) {
      return runPublicApiJobs({ fetchText, now, listingHtml: await fetchText(JOB_OPENINGS_URL) })
    }
    if (hasCurrentCareersSignal(careersHtml)) {
      return runCurrentJobs({ fetchText, now, listingHtml: await fetchText(JOB_OPENINGS_URL) })
    }
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Motivity Labs careers page no longer matches the trusted first-party surface')
    }

    const listingsHtml = await fetchText(JOB_OPENINGS_URL)
    if (!hasJobOpeningsSignal(listingsHtml)) {
      throw new Error('The verified Motivity Labs job openings page no longer matches the trusted first-party surface')
    }

    const jobs = []
    for (const card of extractJobCards(listingsHtml)) {
      const detailHtml = await fetchText(card.detailUrl)
      const job = extractJobDetail(detailHtml, card, { scrapedAt: now() })
      if (job) jobs.push(job)
    }

    if (jobs.length === 0) {
      throw new Error('Motivity Labs verified first-party detail pages no longer return normalized jobs')
    }

    return jobs
  },
})

export const run = async (options = {}) => createMotivityLabsScraper().run(options)

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
