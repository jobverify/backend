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

const slugToTitle = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/^job-location-/i, '')
    .replace(/-/g, ' '),
)?.replace(/\b\w/g, (match) => match.toUpperCase()) || null

const normalizeEmploymentType = (className = '') => {
  if (/job-type-part-time/i.test(className)) return 'Part-time'
  if (/job-type-contract/i.test(className)) return 'Contract'
  if (/job-type-full-time/i.test(className)) return 'Full-time'
  return null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialJobsArchiveSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page) || ''

  return /<title>\s*Job Openings\s*-\s*Techversant Infotech\s*<\/title>/i.test(page)
    && /awsm_job_openings/i.test(page)
    && text.includes('Job Openings')
}

export const extractArchivePageUrls = (html = '') => {
  const urls = new Set([CAREERS_URL])

  for (const match of String(html ?? '').matchAll(/href=["'](https:\/\/techversantinfotech\.com\/jobs\/page\/(\d+)\/)["']/gi)) {
    urls.add(match[1])
  }

  return [...urls].sort((left, right) => {
    const leftPage = Number.parseInt(left.match(/page\/(\d+)\//i)?.[1] ?? '1', 10)
    const rightPage = Number.parseInt(right.match(/page\/(\d+)\//i)?.[1] ?? '1', 10)
    return leftPage - rightPage
  })
}

export const extractJobCards = (html = '') => {
  const articles = String(html ?? '').match(/<article\b[\s\S]*?<\/article>/gi) || []

  return articles.map((article) => {
    const className = article.match(/class=["']([^"']+)["']/i)?.[1] ?? ''
    const title = normalizeWhitespace(article.match(/<h4[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)?.[1])
    const sourceUrl = normalizeWhitespace(article.match(/<h4[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>[\s\S]*?<a[^>]*href=["']([^"']+)["']/i)?.[1])
    const excerpt = normalizeWhitespace(article.match(/<div[^>]*class=["'][^"']*mascot-post-excerpt[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])
    const locations = [...className.matchAll(/job-location-[a-z0-9-]+/gi)]
      .map((match) => slugToTitle(match[0]))
      .filter(Boolean)

    return {
      title,
      sourceUrl,
      applyUrl: sourceUrl,
      location: locations[0] || 'India',
      locations,
      city: locations[0] || null,
      employmentType: normalizeEmploymentType(className),
      jobDescription: excerpt,
    }
  }).filter((job) => job.title && job.sourceUrl)
}

export const run = async ({ fetchText = defaultFetchText } = {}) => {
  const firstPageHtml = await fetchText(CAREERS_URL)
  if (!hasOfficialJobsArchiveSignal(firstPageHtml)) {
    throw new Error('Techversant Infotech verified jobs archive no longer matches the trusted first-party surface')
  }

  const pageUrls = extractArchivePageUrls(firstPageHtml)
  const allCards = []

  for (const url of pageUrls) {
    const html = url === CAREERS_URL ? firstPageHtml : await fetchText(url)
    allCards.push(...extractJobCards(html))
  }

  return [...new Map(allCards.map((job) => [job.sourceUrl, job])).values()].map((job) => ({
    title: job.title,
    company: COMPANY,
    department: null,
    location: job.location,
    locations: job.locations,
    city: job.city,
    state: null,
    country: 'India',
    jobId: null,
    requisitionId: null,
    sourceUrl: job.sourceUrl,
    applyUrl: job.applyUrl,
    employmentType: job.employmentType,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: job.jobDescription,
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
