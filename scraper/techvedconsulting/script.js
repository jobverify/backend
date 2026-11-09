import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import TECHVED_CONSULTING_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = TECHVED_CONSULTING_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')

const stripTags = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(div|p|li|ul|ol|h[1-6])>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => stripTags(value) || null

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return CAREERS_URL
  }
}

const normalizeLocation = (value) => {
  const cleaned = normalizeText(value)?.replace(/\.$/, '') ?? null
  if (!cleaned) return { location: null, city: null }

  const parts = cleaned.split(',').map((part) => part.trim()).filter(Boolean)
  const city = parts.length > 1 ? parts[parts.length - 1] : parts[0]
  return {
    location: `${parts.join(', ')}, India`,
    city,
  }
}

const findDetailBlock = (html = '', detailId) => {
  const escapedId = String(detailId ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(html ?? '').match(
    new RegExp(`<div id=["']${escapedId}["'][\\s\\S]*?<div class=["']career-jd-main["'][^>]*>([\\s\\S]*?)<\\/div>[\\s\\S]*?<\\/div>`, 'i'),
  )
  return match?.[1] ?? ''
}

const buildJobDescription = (summary, detailBlock) => {
  const parts = [normalizeText(summary), normalizeText(detailBlock)].filter(Boolean)
  return parts.join(' ') || null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /Techved Careers \| Shape Your Future In Digital Transformation Company/i.test(page)
    && /All Jobs/i.test(page)
    && /career-opening-box/i.test(page)
    && /Apply Now/i.test(page)
}

export const extractJobs = (html = '') => {
  const jobs = []
  const page = String(html ?? '')
  const matches = page.matchAll(
    /<div class="career-opening-box"[^>]*data-opening="([^"]+)"[^>]*data-job-category="([^"]+)"[\s\S]*?<h3>([\s\S]*?)<\/h3>[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?career-location\.png[\s\S]*?<\/span>\s*([^<]+?)<\/li>[\s\S]*?career-experience\.png[\s\S]*?<\/span>\s*([^<]+?)<\/li>[\s\S]*?career-role\.png[\s\S]*?<\/span>\s*([^<]+?)<\/li>[\s\S]*?data-target="([^"]+)"/gi,
  )

  for (const match of matches) {
    const department = normalizeText(match[2])
    const title = normalizeText(match[3])
    const summary = normalizeText(match[4])
    const role = normalizeText(match[7])
    const detailId = normalizeText(match[8])
    if (!title || !detailId) continue

    const { location, city } = normalizeLocation(match[5])
    const detailBlock = findDetailBlock(page, detailId)
    const sourceUrl = toAbsoluteUrl(`#${detailId}`)

    jobs.push({
      title,
      company: COMPANY,
      department,
      location,
      city,
      country: 'India',
      jobId: detailId,
      requisitionId: detailId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: normalizeText(match[6]),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: role ? [role] : [],
      postingDate: null,
      closingDate: null,
      jobDescription: buildJobDescription(summary, detailBlock),
    })
  }

  return jobs
}

export const createTechvedConsultingScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Techved Consulting careers page no longer matches the trusted first-party surface')
    }

    const jobs = extractJobs(careersHtml)
    if (jobs.length === 0) {
      throw new Error('Techved Consulting careers page no longer exposes the verified same-page opening cards')
    }

    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createTechvedConsultingScraper().run(options)

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
