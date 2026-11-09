import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { KALEIDOFIN_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = KALEIDOFIN_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_SAMPLE_JOB_URL = PROVIDER_METADATA.verifiedSampleJobUrl
export const VERIFIED_PUBLIC_JOB_COUNT = PROVIDER_METADATA.verifiedPublicJobCount
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/[’‘]/g, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractCanonicalUrl = (html = '') => {
  const tag = String(html ?? '').match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0]
  const href = tag?.match(/href=["']([^"']+)["']/i)?.[1]
  return toAbsoluteUrl(href, CAREERS_URL)
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Careers\s*<\/title>/i.test(page)
    && extractCanonicalUrl(page) === CAREERS_URL
    && normalized.includes('Careers')
    && normalized.includes('Step into the world of opportunities at Kaleidofin')
    && normalized.includes('Apply with Linkedin')
    && normalized.includes('Apply with instahyre')
    && normalized.includes('careers@kaleidofin.com')
  }

export const extractRoleCards = (html = '') => {
  const page = String(html ?? '')
  const roles = []

  for (const sectionMatch of page.matchAll(
    /<div class="div-block-16">\s*<h2>([\s\S]*?)<\/h2>([\s\S]*?)(?=<div class="div-block-16">\s*<h2>|<div class="div-block-16">\s*<h3>|$)/gi,
  )) {
    const department = stripTags(sectionMatch[1])
    const sectionHtml = sectionMatch[2]

    for (const roleMatch of sectionHtml.matchAll(
      /<a href="([^"]*\/careers\/[^"?#]+)" class="link-block-3[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>\s*<p>([\s\S]*?)<\/p>/gi,
    )) {
      const sourceUrl = toAbsoluteUrl(roleMatch[1], CAREERS_URL)
      const pathname = new URL(sourceUrl).pathname
      const jobId = pathname.split('/').filter(Boolean).at(-1) || null

      if (!department || !sourceUrl || !jobId) continue

      roles.push({
        department,
        title: stripTags(roleMatch[2]),
        experienceSummary: stripTags(roleMatch[3]),
        location: stripTags(roleMatch[4]),
        sourceUrl,
        jobId,
      })
    }
  }

  return roles
}

export const hasOfficialRoleDetailSignal = (html = '', roleUrl) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''
  const canonicalUrl = extractCanonicalUrl(page)
  const title = stripTags(page.match(/<div class="dark-blue-bg">[\s\S]*?<h1>([\s\S]*?)<\/h1>/i)?.[1])

  return /<title>\s*Kaleidofin\s*<\/title>/i.test(page)
    && canonicalUrl === roleUrl
    && Boolean(title)
    && normalized.includes('Who we are?')
    && normalized.includes("What you'll do?")
    && normalized.includes('Who you need to be?')
    && normalized.includes('Job location')
    && normalized.includes('careers@kaleidofin.com')
  }

const extractRoleHeaderFields = (html = '') => {
  const match = String(html ?? '').match(
    /<div class="dark-blue-bg">[\s\S]*?<h5>([\s\S]*?)<\/h5>[\s\S]*?<h1>([\s\S]*?)<\/h1>[\s\S]*?<h3>([\s\S]*?)<\/h3>[\s\S]*?<h5>([\s\S]*?)<\/h5>/i,
  )

  return {
    department: stripTags(match?.[1]),
    title: stripTags(match?.[2]),
    experienceSummary: stripTags(match?.[3]),
    location: stripTags(match?.[4]),
  }
}

const extractRoleDescription = (html = '') => {
  const page = String(html ?? '')
  const sectionHtml = page.match(/<div class="full-width-white">([\s\S]*?)<\/div>\s*<script/i)?.[1]
    || page.match(/<div class="full-width-white">([\s\S]*)$/i)?.[1]
  return stripTags(sectionHtml)
}

const extractExperienceRequired = (summary) => {
  const normalized = normalizeWhitespace(summary)
  if (!normalized) return null

  const match = normalized.match(/^(.*?)(?:\s*[|I]\s*\d+\s*Openings?)$/i)
  return normalizeWhitespace(match?.[1] || normalized)
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/[\/,]/.test(normalized) || /\(/.test(normalized)) return null
  return normalizeCity(normalized)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const mapRoleToJob = (role, detailHtml, scrapedAt) => {
  const header = extractRoleHeaderFields(detailHtml)
  const title = header.title || role.title
  const location = header.location || role.location

  if (!title || !location) return null

  return {
    title,
    company: COMPANY_NAME,
    department: header.department || role.department,
    location,
    city: deriveCity(location),
    country: 'India',
    jobId: role.jobId,
    requisitionId: role.jobId,
    sourceUrl: role.sourceUrl,
    applyUrl: role.sourceUrl,
    employmentType: null,
    experienceRequired: extractExperienceRequired(header.experienceSummary || role.experienceSummary),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: extractRoleDescription(detailHtml),
    source: SOURCE,
    link: role.sourceUrl,
    scrapedAt,
  }
}

export const createKaleidofinScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Kaleidofin verified first-party careers page no longer matches the trusted public surface')
    }

    const roles = extractRoleCards(careersHtml)
    if (roles.length === 0) {
      throw new Error('Kaleidofin careers page no longer exposes the verified first-party role cards')
    }

    const jobs = []

    for (const role of roles) {
      const detailHtml = await fetchText(role.sourceUrl)
      if (!hasOfficialRoleDetailSignal(detailHtml, role.sourceUrl)) {
        throw new Error(`Kaleidofin role detail page no longer matches the trusted public surface: ${role.sourceUrl}`)
      }

      const mappedJob = mapRoleToJob(role, detailHtml, now())
      if (mappedJob) jobs.push(mappedJob)
    }

    return jobs
  },
})

export const run = async (options = {}) => createKaleidofinScraper(options).run()

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
