import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBillEaseNativeInventory } from './nativeInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://billease.ph/careers/'
export const CAREERS_BOARD_URL = 'https://billease.careers-page.com/'
export const COMPANY = 'BillEase'
export const SOURCE = 'billease'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&gt;/gi, '>')
  .replace(/&lt;/gi, '<')

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
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = CAREERS_BOARD_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const getAnchors = (html) => [...String(html ?? '').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
  .map((match) => ({
    attrs: match[1] || '',
    innerHtml: match[2] || '',
  }))

const getAttribute = (attrs, name) => {
  const match = String(attrs ?? '').match(new RegExp(`${name}=["']([^"']*)["']`, 'i'))
  return normalizeWhitespace(match?.[1])
}

const getTextListItems = (html) => [...String(html ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const toCity = (location) => normalizeWhitespace(location)?.split(',')[0] || null

const inferCountry = (location) => {
  if (/india/i.test(location || '')) return 'India'
  return null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('full-time') || normalized.includes('full time')) return 'Full-time'
  if (normalized.includes('part-time') || normalized.includes('part time')) return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  if (normalized.includes('intern')) return 'Internship'
  return null
}

const normalizeRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('hybrid')) return 'Hybrid'
  if (normalized.includes('remote')) return 'Remote'
  if (normalized.includes('on-site') || normalized.includes('onsite')) return 'On-site'
  return null
}

const extractJobDetailListItems = (html) => {
  const match = String(html ?? '').match(
    /<div\b[^>]*class=["'][^"']*job-location[^"']*["'][^>]*>[\s\S]*?<ul\b[^>]*>([\s\S]*?)<\/ul>/i,
  )

  return getTextListItems(match?.[1])
}

const extractDescription = (html) => {
  const match = String(html ?? '').match(
    /<div\b[^>]*class=["'][^"']*job-post-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
  )

  return stripTags(match?.[1]) || null
}

const buildEmptyJobShape = ({
  title,
  location,
  city,
  country,
  jobId,
  sourceUrl,
  applyUrl,
} = {}) => ({
  title: title || null,
  company: COMPANY,
  department: null,
  location: location || null,
  city: city || null,
  country: country || null,
  jobId: jobId || null,
  requisitionId: jobId || null,
  sourceUrl: sourceUrl || null,
  applyUrl: applyUrl || null,
  employmentType: null,
  experienceRequired: null,
  minimumQualification: null,
  preferredQualification: null,
  requiredSkills: [],
  postingDate: null,
  closingDate: null,
  jobDescription: null,
  remoteStatus: null,
})

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  return (
    /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/billease\.ph\/careers\/["']/i.test(page)
    || /<script[^>]+src=["'][^"']*\/_nuxt\/pages\/careers\.[^"']+\.js["']/i.test(page)
  )
    && /billease/i.test(page)
    && page.includes(CAREERS_BOARD_URL)
}

export const hasOfficialBoardSignal = (html) => {
  const page = String(html ?? '')
  return /og:site_name["']?\s+content=["']Manatal["']/i.test(page)
    && /data-domain_slug=["']billease["']/i.test(page)
    && /Careers at BillEase/i.test(page)
    && /Jobs at BillEase/i.test(page)
}

export const extractListings = (html) => {
  const jobs = []

  for (const articleMatch of String(html ?? '').matchAll(
    /<article\b[^>]*class=["'][^"']*job-card[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi,
  )) {
    const articleHtml = articleMatch[1]
    const anchors = getAnchors(articleHtml)
    const detailAnchor = anchors.find((anchor) =>
      /\bjob-title-link\b/i.test(anchor.attrs)
      && /\/jobs\/[0-9a-z-]+/i.test(anchor.attrs),
    )
    const applyAnchor = anchors.find((anchor) =>
      /data-type=["']apply["']/i.test(anchor.attrs)
      || /^apply now$/i.test(stripTags(anchor.innerHtml) || ''),
    )

    if (!detailAnchor) continue

    const title = getAttribute(detailAnchor.attrs, 'data-job-title') || stripTags(detailAnchor.innerHtml)
    if (!title || /talent community/i.test(title)) continue

    const jobId = getAttribute(detailAnchor.attrs, 'data-job-id')
    const sourceUrl = toAbsoluteUrl(getAttribute(detailAnchor.attrs, 'href'))
    const applyUrl = toAbsoluteUrl(getAttribute(applyAnchor?.attrs, 'href'))
    const jobDetailsMatch = articleHtml.match(
      /<ul\b[^>]*aria-label=["']Job details["'][^>]*>([\s\S]*?)<\/ul>/i,
    )
    const location = getTextListItems(jobDetailsMatch?.[1])[0] || null
    const city = getAttribute(detailAnchor.attrs, 'data-job-city') || toCity(location)
    const country = getAttribute(detailAnchor.attrs, 'data-job-country') || inferCountry(location)

    if (country !== 'India') continue

    jobs.push(buildEmptyJobShape({
      title,
      location,
      city,
      country,
      jobId,
      sourceUrl,
      applyUrl,
    }))
  }

  return jobs
}

export const extractJobDetail = (html, listing = {}) => {
  const title = stripTags(
    String(html ?? '').match(/<h[1-6]\b[^>]*class=["'][^"']*single-job-title[^"']*["'][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1],
  ) || listing.title || null
  const detailItems = extractJobDetailListItems(html)
  const location = detailItems[0] || listing.location || null
  const employmentType = normalizeEmploymentType(detailItems[1])
  const remoteStatus = normalizeRemoteStatus(detailItems[2])
  const description = extractDescription(html)
  const applyAnchor = getAnchors(html).find((anchor) =>
    /^apply now$/i.test(stripTags(anchor.innerHtml) || ''),
  )
  const applyUrl = listing.applyUrl || toAbsoluteUrl(getAttribute(applyAnchor?.attrs, 'href'), listing.sourceUrl)

  return {
    ...buildEmptyJobShape({
      title,
      location,
      city: listing.city || toCity(location),
      country: listing.country || inferCountry(location),
      jobId: listing.jobId,
      sourceUrl: listing.sourceUrl,
      applyUrl,
    }),
    title,
    location,
    city: listing.city || toCity(location),
    country: listing.country || inferCountry(location),
    employmentType,
    jobDescription: description,
    remoteStatus,
  }
}

export const extractCurrentPayloadReference = (html) => {
  const page = String(html ?? '')
  if (!/<title>\s*Careers at Billease\s*\|\s*Join our team\s*<\/title>/i.test(page)
    || !page.includes(CAREERS_BOARD_URL)) return null
  const count = Number(page.match(/\b(\d+) open roles\b/i)?.[1])
  const path = page.match(/<script\b[^>]*src=["']([^"']*\/careers\/_payload\.json\?[^"']+)["']/i)?.[1]
  if (!Number.isInteger(count) || !path) return null
  return { count, url: new URL(path, CAREERS_URL).toString() }
}

export const verifyCurrentNoIndiaInventory = (payload, expectedCount) => {
  if (!Array.isArray(payload)) throw new Error('BillEase current jobs inventory payload is unavailable')
  const dereference = (index) => Number.isInteger(index) ? payload[index] : undefined
  const reactive = dereference(payload[0]?.data)
  const data = dereference(Array.isArray(reactive) && reactive[0] === 'ShallowReactive' ? reactive[1] : null)
  const state = dereference(data?.['billease-career-jobs'])
  const references = dereference(state?.jobs)
  if (dereference(state?.failed) !== false || !Array.isArray(references)
    || references.length !== expectedCount) {
    throw new Error('BillEase current jobs inventory count or state is incomplete')
  }
  const ids = new Set()
  for (const reference of references) {
    const record = dereference(reference)
    const id = dereference(record?.id)
    const title = dereference(record?.title)
    const location = dereference(record?.location)
    const url = dereference(record?.url)
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)
      || typeof title !== 'string' || !title.trim() || typeof location !== 'string'
      || url !== `https://billease.careers-page.com/jobs/${id}` || ids.has(id)) {
      throw new Error('BillEase current jobs inventory contains an invalid or duplicate role')
    }
    ids.add(id)
    if (/\bindia\b/i.test(location)) {
      throw new Error('BillEase current jobs inventory now contains an India role')
    }
    if (!/\bPhilippines\b/i.test(location)) {
      throw new Error('BillEase current jobs inventory has an unverified location')
    }
  }
  return true
}

export const createBillEaseScraper = (options = {}) => createBillEaseNativeInventory(options)

export const run = async (options = {}) => createBillEaseScraper().run(options)

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
