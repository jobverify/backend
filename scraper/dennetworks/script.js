import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'

import { DEN_NETWORKS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DEN_NETWORKS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const CAREER_DETAIL_BASE_URL = PROVIDER_METADATA.careerDetailBaseUrl
export const UPLOAD_RESUME_URL = PROVIDER_METADATA.applyFormActionUrl

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
    return new URL(value, CAREERS_PAGE_URL).toString()
  } catch {
    return null
  }
}

const resolveNowIso = (now = () => new Date().toISOString()) => {
  const value = typeof now === 'function' ? now() : now
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const getDetailIdFromUrl = (detailUrl) => String(detailUrl ?? '').match(/career_detail\/(\d+)/i)?.[1] || 'unknown'

const extractSelectedDepartment = (html = '') => normalizeWhitespace(
  String(html ?? '').match(/<option[^>]*value="[^"]+"[^>]*selected[^>]*>([\s\S]*?)<\/option>/i)?.[1] ?? '',
) || null

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const title = normalizeWhitespace(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const text = stripTags(page)

  return title === 'DEN Networks - Top Cable Service Provider in India'
    && /href=["']https:\/\/dennetworks\.com\/careers["']/i.test(page)
    && /DEN Networks - Top Cable Service Provider/i.test(text)
    && text.includes('DEN Networks Ltd. - All Rights Reserved')
}

export const extractCareerDetailUrls = (html = '') => {
  const urls = [...String(html ?? '').matchAll(/href=["']([^"']*\/home\/career_detail\/\d+)["']/gi)]
    .map((match) => toAbsoluteUrl(match[1]))
    .filter(Boolean)

  return [...new Set(urls)].sort((left, right) => {
    const leftId = Number.parseInt(getDetailIdFromUrl(left), 10)
    const rightId = Number.parseInt(getDetailIdFromUrl(right), 10)
    return leftId - rightId
  })
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const title = normalizeWhitespace(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const text = stripTags(page)
  const detailUrls = extractCareerDetailUrls(page)

  return title === 'Make your Career Brighter with DEN Networks'
    && text.includes('Life @DEN')
    && text.includes('We promote a culture of growth and success')
    && text.includes('Opportunities')
    && text.includes('Drop your CV and we will get back to you.')
    && detailUrls.length === 14
}

export const isNoOpeningDetailPage = (html = '') => (
  /<div class="noopening">\s*There are currently no opening\.\s*<\/div>/i.test(String(html ?? ''))
)

const hasOpeningDetailPageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<div class="joblist">/i.test(page)
    && /Apply for position/i.test(page)
    && page.includes(UPLOAD_RESUME_URL)
    && /Years Experience/i.test(page)
    && /id="loc1"/i.test(page)
}

const buildLocation = (rawLocation) => {
  const city = normalizeCity(rawLocation)

  return {
    city: city || null,
    location: city ? `${city}, India` : 'India',
  }
}

export const extractOpeningsFromDetailPage = (html = '', detailUrl) => {
  if (isNoOpeningDetailPage(html)) {
    return []
  }

  if (!hasOpeningDetailPageSignal(html)) {
    throw new Error('Den Networks career detail page no longer matches the verified public surface')
  }

  const department = extractSelectedDepartment(html)
  const detailId = getDetailIdFromUrl(detailUrl)
  const jobs = []

  for (const match of String(html ?? '').matchAll(
    /<div class="joblist">[\s\S]*?<h5[^>]*>([\s\S]*?)<\/h5>[\s\S]*?<li id="loc1">([\s\S]*?)<\/li>[\s\S]*?<li>([\s\S]*?Years Experience)<\/li>[\s\S]*?<div class="jobdescpt">[\s\S]*?<p>\s*([\s\S]*?)<\/p>[\s\S]*?<a[^>]*class="applybtn"[^>]*>\s*Apply for position\s*<\/a>/gi,
  )) {
    const title = normalizeWhitespace(match[1])
    const rawLocation = normalizeWhitespace(match[2])
    const experienceRequired = normalizeWhitespace(match[3])
    const jobDescription = normalizeWhitespace(match[4]) || null
    const { city, location } = buildLocation(rawLocation)
    const slug = `${SOURCE}-${detailId}-${slugify(title)}-${slugify(city || rawLocation || 'india')}`

    if (!title || !experienceRequired) {
      continue
    }

    jobs.push({
      title,
      company: COMPANY,
      department,
      location,
      city,
      country: 'India',
      jobId: slug,
      requisitionId: slug,
      sourceUrl: detailUrl,
      applyUrl: detailUrl,
      employmentType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
      remoteStatus: null,
    })
  }

  if (jobs.length === 0) {
    throw new Error('Den Networks career detail page no longer matches the verified public surface')
  }

  return jobs
}

export const createDenNetworksScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Den Networks homepage no longer matches the verified official surface')
    }

    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Den Networks careers page no longer matches the verified official surface')
    }

    const detailUrls = extractCareerDetailUrls(careersHtml)
    const scrapedAt = resolveNowIso(now)
    const jobs = []

    for (const detailUrl of detailUrls) {
      const detailHtml = await fetchText(detailUrl)
      const pageJobs = extractOpeningsFromDetailPage(detailHtml, detailUrl)

      for (const job of pageJobs) {
        jobs.push({
          ...job,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          atsPlatform: PROVIDER_METADATA.atsPlatform,
          scrapedAt,
        })
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createDenNetworksScraper().run(options)

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
