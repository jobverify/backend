import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { CYNTEXA_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = CYNTEXA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const absoluteCyntexaUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return null
  }
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value).toLowerCase()
  if (normalized === 'full-time' || normalized === 'full time') return 'Full-time'
  if (normalized === 'part-time' || normalized === 'part time') return 'Part-time'
  if (normalized.includes('remote') && normalized.includes('onsite')) return 'Full-time'
  return normalizeWhitespace(value) || null
}

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  if (/\busa\b/i.test(normalized)) return 'USA'
  if (/\bindia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const detectRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value).toLowerCase()
  if (normalized.includes('remote') && normalized.includes('onsite')) return 'Hybrid'
  if (normalized.includes('remote')) return 'Remote'
  return 'On-site'
}

export const hasVerifiedCareersIndexSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /Career At Cyntexa/i.test(page)
    && normalized.includes('We are Cyntexa')
    && normalized.includes('Job Opportunities')
    && normalized.includes('Software Developer')
    && normalized.includes('Management Trainee')
}

export const extractJobLinks = (html = '') => {
  const links = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const absoluteUrl = absoluteCyntexaUrl(match[1])
    if (!absoluteUrl) continue
    if (!/^https:\/\/cyntexa\.com\/careers\/[^/]+\/$/i.test(absoluteUrl)) continue
    if (/\/careers\/$/i.test(absoluteUrl) || seen.has(absoluteUrl)) continue
    seen.add(absoluteUrl)
    links.push(absoluteUrl)
  }

  return links
}

const hasVerifiedJobDetailSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Job Summary')
    && normalized.includes('Key Responsibilities')
    && normalized.includes('Are you interested?')
}

const extractParagraphs = (html = '') =>
  [...String(html ?? '').matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

const extractSectionText = (normalized, startLabel, endLabel) => {
  const startIndex = normalized.indexOf(startLabel)
  if (startIndex === -1) return null
  const afterStart = normalized.slice(startIndex + startLabel.length).trim()
  if (!endLabel) return afterStart || null
  const endIndex = afterStart.indexOf(endLabel)
  return normalizeWhitespace(endIndex === -1 ? afterStart : afterStart.slice(0, endIndex))
}

const extractJobDetail = (html = '', detailUrl) => {
  const title = normalizeWhitespace(String(html ?? '').match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  const paragraphs = extractParagraphs(html)
  const employmentType = normalizeEmploymentType(paragraphs[0])
  const rawLocation = paragraphs[1] || null
  const experienceRequired = paragraphs[2] || null
  const normalized = normalizeWhitespace(html)

  return {
    jobId: slugify(title || detailUrl),
    title: title || null,
    employmentType,
    location: normalizeLocation(rawLocation),
    experienceRequired,
    department: extractSectionText(normalized, 'Department', 'Key Responsibilities'),
    jobDescription: extractSectionText(normalized, 'Job Summary', 'Industry'),
    remoteStatus: detectRemoteStatus(rawLocation),
  }
}

const isLikelyIndiaRole = (detailUrl, jobDetail) =>
  !/\busa\b/i.test(detailUrl) && !/\busa\b/i.test(jobDetail.location || '')

export const createCyntexaScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasVerifiedCareersIndexSignal(careersHtml)) {
      throw new Error('The verified Cyntexa careers index no longer matches the trusted first-party surface')
    }

    const detailUrls = extractJobLinks(careersHtml)
    const jobs = []

    for (const detailUrl of detailUrls) {
      const detailHtml = await fetchText(detailUrl)

      if (!hasVerifiedJobDetailSignal(detailHtml)) {
        throw new Error('The verified Cyntexa job detail page no longer matches the trusted first-party surface')
      }

      const jobDetail = extractJobDetail(detailHtml, detailUrl)
      if (!isLikelyIndiaRole(detailUrl, jobDetail)) continue

      jobs.push({
        jobId: jobDetail.jobId,
        requisitionId: jobDetail.jobId,
        title: jobDetail.title,
        company: COMPANY,
        department: jobDetail.department,
        location: jobDetail.location,
        city: jobDetail.location?.replace(/, India$/i, '') || null,
        country: 'India',
        link: detailUrl,
        applyUrl: detailUrl,
        sourceUrl: detailUrl,
        employmentType: jobDetail.employmentType,
        experienceRequired: jobDetail.experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        jobDescription: jobDetail.jobDescription,
        postingDate: null,
        closingDate: null,
        remoteStatus: jobDetail.remoteStatus,
        source: SOURCE,
        scrapedAt: now(),
        companyCareerPage: CAREERS_URL,
        companyDomain: PROVIDER_METADATA.companyDomain,
        atsPlatform: PROVIDER_METADATA.atsPlatform,
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createCyntexaScraper(options).run(options)

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
