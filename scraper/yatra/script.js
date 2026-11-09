import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { filterIndiaJobs } from '../../scraper-support/utils/indiaLocationFilter.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'yatra'
export const COMPANY = 'Yatra'
export const CAREERS_PAGE_URL = 'https://www.yatra.com/career/job-portal'
const REQUEST_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
}

const normalizeText = (value) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()

const decodeHtmlEntities = (value = '') => String(value)
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|\u00a0/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/g, '\'')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')

const stripHtml = (value = '') => normalizeText(
  decodeHtmlEntities(String(value).replace(/<[^>]+>/g, ' ')),
)

const normalizeJobPortalLink = (value) => {
  const href = normalizeText(value)
  if (!href || href === '#' || /^javascript:/i.test(href)) return CAREERS_PAGE_URL

  try {
    return new URL(href, CAREERS_PAGE_URL).toString()
  } catch {
    return CAREERS_PAGE_URL
  }
}

const isIndiaLocation = (location) => filterIndiaJobs([{
  location,
  country: 'India',
}]).length > 0

const toJob = (record, now) => {
  const title = normalizeText(record?.title)
  const location = normalizeText(record?.location)
  if (!title || !location || !isIndiaLocation(location)) return null

  const sourceUrl = record?.sourceUrl || CAREERS_PAGE_URL
  return {
    title,
    company: COMPANY,
    location,
    city: location.split(',')[0]?.trim() || null,
    country: 'India',
    link: sourceUrl,
    sourceUrl,
    applyUrl: record?.applyUrl || sourceUrl,
    jobId: normalizeText(record?.jobId) || null,
    requisitionId: normalizeText(record?.jobId) || null,
    department: normalizeText(record?.department) || null,
    employmentType: null,
    remoteStatus: /remote/i.test(`${location} ${record?.description || ''}`) ? 'Remote' : null,
    jobDescription: normalizeText(record?.description) || null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    source: SOURCE,
    scrapedAt: now(),
  }
}

export const extractYatraJobs = (records = [], now = () => new Date().toISOString()) => {
  const seen = new Set()
  return records.map((record) => toJob(record, now)).filter((job) => {
    if (!job) return false
    const identity = job.jobId || `${job.title}|${job.location}`
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}

export const hasVerifiedYatraJobPortalSignal = (text) => {
  const raw = String(text ?? '')
  const normalized = stripHtml(raw)

  const hasCurrentShell = /Yatra Job Portal|Yatra Careers/i.test(normalized)
    && /Job Openings/i.test(normalized)
    && (
      /Search Job/i.test(normalized)
      || /If you are looking for a exciting role in Yatra/i.test(normalized)
      || /data-jobid=/i.test(raw)
    )

  const hasHistoricalShell = /Job Openings/i.test(normalized)
    && /If you are looking for a exciting role in Yatra/i.test(normalized)
    && /jobs@yatra\.com/i.test(normalized)

  return hasCurrentShell || hasHistoricalShell
}

export const extractYatraJobPortalRecords = (html = '') => {
  const blocks = String(html).match(
    /<div class="job-category"[\s\S]*?(?=<div class="job-category"|<div class="wfull mt20 applyformbox"|<\/section>|$)/gi,
  ) || []

  return blocks.map((block) => {
    const title = stripHtml(block.match(/<span class="title hover">\s*([\s\S]*?)\s*<\/span>/i)?.[1] || '')
    const location = stripHtml(block.match(/<span class="location">\s*([\s\S]*?)\s*<\/span>/i)?.[1] || '')
    const jobId = stripHtml(block.match(/\bdata-jobid="([^"]+)"/i)?.[1] || '')
    const link = normalizeJobPortalLink(block.match(/<a[^>]+class="js_apply"[^>]+href="([^"]+)"/i)?.[1] || '')

    if (!title || !location || !jobId) return null

    return {
      title,
      location,
      jobId,
      sourceUrl: link,
      applyUrl: link,
      description: stripHtml(block),
    }
  }).filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  label: SOURCE,
  timeoutMs: 20000,
  headers: REQUEST_HEADERS,
})

export const renderYatraJobPortal = async ({ fetchText = defaultFetchText } = {}) => {
  const html = await fetchText(CAREERS_PAGE_URL)
  if (!hasVerifiedYatraJobPortalSignal(html)) {
    throw new Error('[yatra] official job portal shell changed materially')
  }

  return extractYatraJobPortalRecords(html)
}

export const run = async ({ renderPage = renderYatraJobPortal, now } = {}) => {
  const records = await renderPage()
  const jobs = extractYatraJobs(records, now)
  if (jobs.length === 0) {
    throw new Error('[yatra] official job portal contained no recognizable India job listings')
  }
  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
