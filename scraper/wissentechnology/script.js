import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { WISSEN_TECHNOLOGY_CATALOG } from './catalog.js'
import {runCurrentZohoSource} from '../uniqus/currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = WISSEN_TECHNOLOGY_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CONTACT_URL = PROVIDER_METADATA.contactPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const buildAbsoluteUrl = (value, baseUrl = HOMEPAGE_URL) => {
  try {
    return new URL(value, baseUrl).href
  } catch {
    return null
  }
}

const decodeHtmlEntities = (value = '') => String(value)
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")

const normalizeWhitespace = (value = '') => decodeHtmlEntities(String(value))
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractVisibleText = (value = '') => decodeHtmlEntities(String(value))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/section|\/article)\b[^>]*>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '- ')
  .replace(/<p\b[^>]*>/gi, '\n')
  .replace(/<div\b[^>]*>/gi, '\n')
  .replace(/<section\b[^>]*>/gi, '\n')
  .replace(/<article\b[^>]*>/gi, '\n')
  .replace(/<h[1-6]\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\r\n?/g, '\n')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{2,}/g, '\n')
  .split('\n')
  .map((line) => line.replace(/\s+/g, ' ').trim())
  .filter(Boolean)
  .join('\n')

const extractTextLines = (value = '') => extractVisibleText(value)
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const parseLocation = (value = '') => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      state: null,
      country: null,
    }
  }

  if (normalized.includes('/')) {
    return {
      location: normalized,
      city: null,
      state: null,
      country: 'India',
    }
  }

  return {
    location: normalized,
    city: normalized,
    state: null,
    country: 'India',
  }
}

const toSlug = (value = '') => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const execPatternFromIndex = (pattern, value, startIndex = 0) => {
  const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`
  const scopedPattern = new RegExp(pattern.source, flags)
  scopedPattern.lastIndex = startIndex
  return scopedPattern.exec(String(value ?? ''))
}

const extractBalancedTagInnerHtml = (value, openingTagStartIndex, tagName) => {
  if (!Number.isInteger(openingTagStartIndex) || openingTagStartIndex < 0) return null

  const source = String(value ?? '')
  const openingTagEndIndex = source.indexOf('>', openingTagStartIndex)
  if (openingTagEndIndex < 0) return null

  const tagPattern = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi')
  tagPattern.lastIndex = openingTagEndIndex + 1

  let depth = 1
  let match = tagPattern.exec(source)

  while (match) {
    depth += match[0].startsWith('</') ? -1 : 1
    if (depth === 0) {
      return source.slice(openingTagEndIndex + 1, match.index)
    }
    match = tagPattern.exec(source)
  }

  return source.slice(openingTagEndIndex + 1) || null
}

const extractLabeledDetailValue = (label, html = '') => normalizeWhitespace(
  String(html).match(
    new RegExp(
      `<p[^>]*class="job-salary-title"[^>]*>${label}<\\/p>\\s*<p[^>]*class="job-salary-number[^"]*"[^>]*>([\\s\\S]*?)<\\/p>`,
      'i',
    ),
  )?.[1] || '',
) || null

const buildJobId = ({ title, city, requisitionId }) =>
  [toSlug(title), toSlug(city), toSlug(requisitionId)].filter(Boolean).join('-')

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html)
  const normalized = normalizeWhitespace(html)
  return (
    normalized.includes('Careers in Wissen Technology | Best Place to Work | Wissen')
    || normalized.includes('Opportunities at Wissen Technology')
  )
    && normalized.includes('Important Notice - Fraudulent Job Offers in the Name of Wissen Technology Pvt. Ltd.')
    && normalized.includes('All legitimate job openings are published only on our official website www.wissen.com in the career section.')
    && /class="cms-job-item w-dyn-item"|class="job-title-1"|\/job\//i.test(page)
}

export const extractVisibleJobs = (html = '') => {
  const page = String(html)
  const jobsByKey = new Map()

  for (const segment of page.split(/<div role="listitem" class="cms-job-item w-dyn-item">/i).slice(1)) {
    const item = segment.split(/<div class="job-background"><\/div>/i)[0]
    const title = normalizeWhitespace(item.match(/class="job-title-1">([\s\S]*?)<\/p>/i)?.[1] || '')
    const sourcePath = normalizeWhitespace(item.match(/<a href="(\/job\/[^"]+)"/i)?.[1] || '')
    const summary = normalizeWhitespace(item.match(/class="job-paragraph">([\s\S]*?)<\/p>/i)?.[1] || '')
    const employmentType = normalizeWhitespace(
      item.match(/<p class="job-salary-title">Job Type<\/p>\s*<p class="job-salary-number">([\s\S]*?)<\/p>/i)?.[1]
      || item.match(/class="job-salary-number">([\s\S]*?)<\/p>/i)?.[1]
      || '',
    )
    const location = normalizeWhitespace(
      item.match(/<p class="job-salary-title">Location<\/p>\s*<p class="job-salary-number">([\s\S]*?)<\/p>/i)?.[1]
      || '',
    )
    const sourceUrl = buildAbsoluteUrl(sourcePath)

    if (!title || !summary || !employmentType || !location || !sourceUrl) {
      continue
    }

    if (jobsByKey.has(sourceUrl)) {
      continue
    }

    jobsByKey.set(sourceUrl, {
      title,
      summary,
      employmentType,
      ...parseLocation(location),
      sourceUrl,
      applyUrl: CONTACT_URL,
      link: sourceUrl,
      jobId: buildJobId({
        title,
        city: location,
        requisitionId: sourceUrl.split('/').filter(Boolean).pop() || sourcePath,
      }),
      requisitionId: sourceUrl.split('/').filter(Boolean).pop() || toSlug(`${title}-${location}`),
    })
  }

  return [...jobsByKey.values()]
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const normalizeExperience = (value = '') => {
  const normalized = normalizeWhitespace(value)
    .replace(/\bexperience\s*[:-]?\s*/i, '')
    .replace(/\brelevant experience\b/gi, 'experience')
    .replace(/[.]+$/g, '')

  if (!normalized) return null
  if (/\bno experience\b/i.test(normalized)) return 'No experience required'

  let match = normalized.match(/\b(\d+)\s*(?:-|to)\s*(\d+)\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]} - ${match[2]} years`

  match = normalized.match(/\b(\d+)\s*\+\s*(?:years?|yrs?)\b/i)
  if (match) return `${match[1]}+ years`

  match = normalized.match(/\b(\d+)\s*(?:years?|yrs?)\b/i)
  if (match && /\bexperience\b/i.test(normalized)) return `${match[1]} years`

  return null
}

const extractExperienceFromLines = (lines = []) => {
  const prioritized = [
    ...lines.filter((line) => /\bexperience\b/i.test(line)),
    ...lines.filter((line) => /\b(?:years?|yrs?)\b/i.test(line) && !/\bexperience\b/i.test(line)),
  ]

  for (const line of prioritized) {
    const normalized = normalizeExperience(line)
    if (normalized) {
      return normalized
    }
  }

  return null
}

const extractPrimaryDetailSection = (html = '') => {
  const match = execPatternFromIndex(/<div\b[^>]*class="rich-text w-richtext"[^>]*>/i, html)
  return match ? extractBalancedTagInnerHtml(html, match.index, 'div') : null
}

export const extractJobDetail = (html = '') => {
  const title = normalizeWhitespace(
    String(html).match(/<h1[^>]*class="heading job-title-2"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '',
  ) || null
  const summary = normalizeWhitespace(
    String(html).match(/<p[^>]*class="paragraph medium"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '',
  ) || null
  const detailSectionHtml = extractPrimaryDetailSection(html)
  const detailLines = extractTextLines(detailSectionHtml || '')
  const experienceRequired = extractExperienceFromLines([
    summary,
    ...detailLines,
  ].filter(Boolean))
  const employmentType = extractLabeledDetailValue('Job Type', html)
  const detailLocation = extractLabeledDetailValue('Location', html)
  const requiredSkills = detailLines.filter((line) =>
    !/^(?:skills required|required skills|job type|location)$/i.test(line),
  )
  const jobDescription = normalizeWhitespace([
    summary,
    detailLines.join(' '),
  ].filter(Boolean).join(' ')) || null
  const hasPublicDetailEvidence = Boolean(summary || detailSectionHtml || employmentType || detailLocation)

  return {
    title,
    employmentType,
    ...parseLocation(detailLocation),
    jobDescription,
    experienceRequired,
    requiredSkills,
    publicExperienceChecked: hasPublicDetailEvidence,
  }
}

const mergeJobDetail = (job, detail) => ({
  ...job,
  title: detail.title || job.title,
  location: detail.location || job.location,
  city: detail.city || job.city,
  state: detail.state || job.state,
  country: detail.country || job.country,
  employmentType: detail.employmentType || job.employmentType,
  jobDescription: detail.jobDescription || job.jobDescription,
  experienceRequired: detail.experienceRequired || job.experienceRequired || null,
  requiredSkills: detail.requiredSkills?.length ? detail.requiredSkills : job.requiredSkills,
  publicExperienceChecked: detail.publicExperienceChecked === true,
})

export const createWissenTechnologyScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Wissen Technology verified openings page no longer matches the trusted first-party contract')
    }

    const jobs = []

    for (const listing of extractVisibleJobs(careersHtml)) {
      const baseJob = {
        title: listing.title,
        company: COMPANY,
        location: listing.location,
        city: listing.city,
        state: listing.state,
        country: listing.country,
        employmentType: listing.employmentType,
        remoteStatus: null,
        jobDescription: listing.summary,
        experienceRequired: extractExperienceFromLines([listing.summary]),
        sourceUrl: listing.sourceUrl,
        applyUrl: CONTACT_URL,
        link: listing.link,
        jobId: listing.jobId,
        requisitionId: listing.requisitionId,
        source: SOURCE,
        scrapedAt: now(),
        publicExperienceChecked: false,
      }

      try {
        jobs.push(mergeJobDetail(baseJob, extractJobDetail(await fetchText(listing.sourceUrl))))
      } catch {
        jobs.push(baseJob)
      }
    }

    const sortedJobs = jobs.sort((left, right) => left.title.localeCompare(right.title))
    if (sortedJobs.length === 0) {
      throw new Error('Wissen Technology openings page no longer exposes trusted visible jobs')
    }

    return sortedJobs
  },
})

export const run = async (options = {}) => runCurrentZohoSource(SOURCE,options)

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
