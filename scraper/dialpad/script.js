import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DIALPAD_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DIALPAD_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OPEN_OPPORTUNITIES_URL = PROVIDER_METADATA.openOpportunitiesUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  try {
    return new URL(decodeHtmlEntities(value), CAREERS_URL).toString()
  } catch {
    return null
  }
}

const normalizeUrl = (value) => String(value ?? '').replace(/\/+$/, '')

const getScrapedAt = (value) => {
  const resolved = typeof value === 'function' ? value() : value
  const date = resolved instanceof Date ? resolved : new Date(resolved ?? Date.now())
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /CAREERS AT DIALPAD/i.test(text)
    && /Come join our team/i.test(text)
    && /Dream jobs across the planet/i.test(text)
    && /Bengaluru,\s*India/i.test(text)
    && /<a[^>]+href=["'][^"']*\/careers\/[^"']*["'][^>]*>\s*See all jobs/i.test(page)
}

export const extractOpenOpportunitiesUrl = (html = '') => {
  const match = String(html ?? '').match(/<a[^>]+href=["']([^"']*\/careers\/open-opportunities\/)["'][^>]*>\s*See all jobs/si)
  const absoluteUrl = toAbsoluteUrl(match?.[1] ?? '')
  return absoluteUrl || null
}

export const hasVerifiedOpenOpportunitiesSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /Open Opportunities/i.test(text)
    && /All locations/i.test(text)
    && /Bengaluru,\s*India/i.test(text)
    && /\/careers\/open-opportunities\/apply\/\?id=/i.test(page)
}

const isIndiaLocation = (value) => /Bengaluru,\s*India/i.test(String(value ?? ''))

export const extractIndiaJobCards = (html = '') => {
  const cards = []

  for (const match of String(html ?? '').matchAll(
    /<div class="w-full lg:grid lg:grid-cols-10">[\s\S]*?<strong>([\s\S]*?)<\/strong>[\s\S]*?<div class="col-span-3 text-ultra-dark-tan">([\s\S]*?)<\/div>[\s\S]*?<a[^>]+href=["']([^"']*\/careers\/open-opportunities\/apply\/\?id=[^"']+)["'][^>]*>\s*Apply/gi,
  )) {
    const title = stripTags(match[1])
    const location = stripTags(match[2])
    const detailUrl = toAbsoluteUrl(match[3])

    if (!title || !location || !detailUrl || !isIndiaLocation(location)) {
      continue
    }

    cards.push({
      title,
      location,
      detailUrl: normalizeUrl(detailUrl),
    })
  }

  return cards
}

const getJobIdFromUrl = (detailUrl) => {
  const url = new URL(detailUrl)
  return normalizeWhitespace(url.searchParams.get('id'))
}

const parseLocation = (value) => {
  const location = normalizeWhitespace(value)
  const parts = location.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)

  return {
    location,
    city: parts[0] || null,
    state: parts.length > 2 ? parts[1] : null,
    country: parts.at(-1) || null,
  }
}

export const extractJobDetail = (html = '', detailUrl) => {
  const page = String(html ?? '')
  const title = stripTags(page.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? '')
  const department = stripTags(page.match(/<div class="flex">\s*<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '')
  const location = stripTags(
    page.match(/<div class="flex">\s*<span[^>]*>[\s\S]*?<\/span>\s*<span[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '',
  )
  const applyUrl = normalizeWhitespace(
    page.match(/<a[^>]+href=["'](https:\/\/boards\.greenhouse\.io\/dialpad\/jobs\/\d+)["'][^>]*>\s*Apply for this position/i)?.[1] ?? '',
  ) || null
  const descriptionMatch = page.match(/<div class="job-details-wrapper">([\s\S]*?)<\/div>\s*<a/i)
  const jobDescription = descriptionMatch ? stripTags(descriptionMatch[1]) : null
  const jobId = getJobIdFromUrl(detailUrl)
  const locationBits = parseLocation(location)

  if (!title || !department || !location || !jobId || !applyUrl || !jobDescription) {
    throw new Error('Dialpad job detail page no longer matches the verified public surface')
  }

  return {
    title,
    company: COMPANY,
    department,
    location: locationBits.location,
    city: locationBits.city,
    state: locationBits.state,
    country: locationBits.country,
    jobId,
    requisitionId: jobId,
    sourceUrl: normalizeUrl(detailUrl),
    applyUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription,
    remoteStatus: null,
  }
}

export const createDialpadScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)

    if (careersPage.status !== 200 || !hasVerifiedCareersPageSignal(careersPage.html)) {
      throw new Error('Dialpad careers page no longer matches the verified public surface')
    }

    if (normalizeUrl(extractOpenOpportunitiesUrl(careersPage.html)) !== normalizeUrl(OPEN_OPPORTUNITIES_URL)) {
      throw new Error('Dialpad careers handoff changed materially')
    }

    const opportunitiesPage = await fetchPage(OPEN_OPPORTUNITIES_URL)

    if (opportunitiesPage.status !== 200 || !hasVerifiedOpenOpportunitiesSignal(opportunitiesPage.html)) {
      throw new Error('Dialpad open opportunities page no longer matches the verified public surface')
    }

    const cards = extractIndiaJobCards(opportunitiesPage.html)
    const scrapedAt = getScrapedAt(now)
    const jobs = []

    for (const card of cards) {
      const detailPage = await fetchPage(card.detailUrl)
      if (detailPage.status !== 200) {
        throw new Error('Dialpad job detail page no longer matches the verified public surface')
      }

      const job = extractJobDetail(detailPage.html, card.detailUrl)
      jobs.push({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        atsPlatform: PROVIDER_METADATA.atsPlatform,
        scrapedAt,
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createDialpadScraper().run(options)

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
