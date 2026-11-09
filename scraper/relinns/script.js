import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import provider from './provider.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = provider
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8217;|&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const titleCase = (value) => normalizeWhitespace(value)
  ?.replace(/\b\w/g, (match) => match.toUpperCase()) || null

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const toAbsoluteUrl = (href) => new URL(href, CAREERS_URL).toString()

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return /<title>\s*Explore Exciting Career Opportunities\s*\|\s*Relinns Careers\s*<\/title>/i.test(page)
    && /placeholder=["'][^"']*Search your job here/i.test(page)
    && text.includes('Engagement Type')
}

export const extractOpenings = (html = '') => {
  const pattern = /<button[^>]*class="[^"]*job-title[^"]*"[^>]*>([\s\S]*?)<\/button>\s*<p[^>]*class="[^"]*job-experience[^"]*"[^>]*>[\s\S]*?<span>([^<]+)<\/span>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<a[^>]*href="([^"]+)"/gi
  const jobs = []

  for (const match of String(html ?? '').matchAll(pattern)) {
    const title = normalizeWhitespace(match[1])
    const employmentType = normalizeWhitespace(match[2])
    const experienceRequired = normalizeWhitespace(match[3])
    const relativeUrl = normalizeWhitespace(match[4])
    const sourceUrl = relativeUrl ? toAbsoluteUrl(relativeUrl) : null
    const [, departmentSlug] = String(relativeUrl ?? '').match(/^\/apply\/([^/]+)/i) || []

    jobs.push({
      title,
      employmentType,
      experienceRequired,
      sourceUrl,
      applyUrl: sourceUrl,
      department: titleCase(String(departmentSlug ?? '').replace(/-/g, ' ')),
    })
  }

  return jobs.filter((job) => job.title && job.sourceUrl)
}

export const run = async ({ fetchText = defaultFetchText } = {}) => {
  const html = await fetchText(CAREERS_URL)
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Relinns Technologies verified careers board no longer matches the trusted first-party surface')
  }

  return extractOpenings(html).map((job) => ({
    title: job.title,
    company: COMPANY,
    department: job.department,
    location: 'India',
    city: null,
    state: null,
    country: 'India',
    jobId: null,
    requisitionId: null,
    sourceUrl: job.sourceUrl,
    applyUrl: job.applyUrl,
    employmentType: job.employmentType,
    experienceRequired: job.experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: null,
    source: SOURCE,
    companyCareerPage: CAREERS_URL,
    companyDomain: provider.companyDomain,
    atsPlatform: provider.atsPlatform,
    link: job.applyUrl,
    scrapedAt: new Date().toISOString(),
  }))
}

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
