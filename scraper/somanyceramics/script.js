import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { SOMANY_CERAMICS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CARD_PATTERN =
  /Designation[\s\S]{0,500}?<h3[^>]*>\s*([^<]+?)\s*<\/h3>[\s\S]{0,300}?Job Location[\s\S]{0,200}?(?:<p[^>]*>|<div[^>]*>|<span[^>]*>)\s*([^<]+?)\s*(?:<\/p>|<\/div>|<\/span>)[\s\S]{0,300}?Work Type[\s\S]{0,200}?(?:<p[^>]*>|<div[^>]*>|<span[^>]*>)\s*([^<]+?)\s*(?:<\/p>|<\/div>|<\/span>)[\s\S]{0,500}?<a[^>]+href=["'](https:\/\/v2\.app\.goodfit\.so\/jobs\/[^"']+)["'][^>]*>[\s\S]{0,300}?Know More[\s\S]{0,300}?<\/a>/gi

export const PROVIDER_METADATA = SOMANY_CERAMICS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const GOODFIT_HOST = PROVIDER_METADATA.officialHandoffHost

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'somanyceramics-html',
  timeoutMs: 15000,
})

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtmlEntities(String(value))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTitle = (html) =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null)

const toTitleCase = (value) =>
  String(value ?? '')
    .split(/[\s-]+/)
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : '')
    .join(' ')
    .trim()

const deriveDepartmentFromUrl = (url) => {
  try {
    const [, boardSlug = ''] = new URL(url).pathname.split('/jobs/')
    const departmentSlug = boardSlug.split('/')[0].replace(/^somany-ceramics-/, '')
    return departmentSlug ? toTitleCase(departmentSlug) : null
  } catch {
    return null
  }
}

const buildLocation = (rawLocation) => {
  const normalized = normalizeWhitespace(rawLocation)
  if (!normalized) {
    return { location: null, city: null }
  }

  if (/^remote$/i.test(normalized)) {
    return { location: 'Remote', city: null }
  }

  const city = normalizeWhitespace(normalized.split(',')[0]) || null
  return {
    location: /\bindia\b/i.test(normalized) ? normalized : `${normalized}, India`,
    city,
  }
}

const extractJobId = (url) => {
  try {
    const parsedUrl = new URL(url)
    return normalizeWhitespace(parsedUrl.searchParams.get('id'))
  } catch {
    return null
  }
}

export const hasOfficialCareersPageSignal = (html) => {
  const title = extractTitle(html) || ''
  const normalized = normalizeWhitespace(html) || ''

  return (title === 'Careers - Somany Ceramics' || title === 'Careers at Somany Ceramics | Work With Us')
    && normalized.includes('Opportunities that grow with you.')
    && normalized.includes('Work With Us')
    && normalized.includes('What are you looking for today? Begin your exploration below.')
}

export const extractJobCards = (html) => {
  const cards = []
  const page = String(html ?? '')

  for (const match of page.matchAll(CARD_PATTERN)) {
    const title = normalizeWhitespace(match[1])
    const rawLocation = normalizeWhitespace(match[2])
    const workType = normalizeWhitespace(match[3])
    const applyUrl = normalizeWhitespace(match[4])

    if (!title || !applyUrl) continue

    const { location, city } = buildLocation(rawLocation)

    cards.push({
      title,
      company: COMPANY_NAME,
      department: deriveDepartmentFromUrl(applyUrl),
      location,
      city,
      workType,
      employmentType: null,
      jobId: extractJobId(applyUrl),
      sourceUrl: applyUrl,
      applyUrl,
      jobDescription: null,
    })
  }

  return cards
}

export const createSomanyCeramicsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersPageSignal(html)) {
      throw new Error('Somany Ceramics verified careers page changed materially')
    }

    const jobs = extractJobCards(html)
    if (jobs.length === 0) {
      throw new Error('Somany Ceramics public job cards are missing from the verified careers page')
    }

    const seenJobIds = new Set()

    return jobs
      .filter((job) => {
        const dedupeKey = job.jobId || job.applyUrl
        if (!dedupeKey || seenJobIds.has(dedupeKey)) return false
        seenJobIds.add(dedupeKey)
        return true
      })
      .map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      }))
  },
})

export const run = async (options = {}) => createSomanyCeramicsScraper().run(options)

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
