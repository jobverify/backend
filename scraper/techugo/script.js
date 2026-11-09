import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { TECHUGO_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = TECHUGO_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value) => {
  try {
    const url = new URL(value, CAREERS_URL)
    if (url.hostname !== 'www.techugo.com') return null
    return url.toString()
  } catch {
    return null
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const parseListItems = (html, heading) => {
  const match = String(html ?? '').match(new RegExp(`<h4[^>]*>\\s*${heading}\\s*<\\/h4>([\\s\\S]*?)(?:<h[34][^>]*>|$)`, 'i'))
  if (!match) return []

  return [...match[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((item) => normalizeWhitespace(item[1]))
    .filter(Boolean)
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return /<title>\s*Your career journey starts here\s*\|\s*Techugo\s*<\/title>/i.test(String(html ?? ''))
    && normalized.includes('Together At Techugo')
    && normalized.includes('Current Openings')
    && normalized.includes('Join Us To Revolutionize The Future Of Technology')
}

export const extractRoleSummaries = (html = '') =>
  [...String(html ?? '').matchAll(/<li[^>]*>\s*<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<span[^>]*>\s*Exp:\s*([\d+\s to-]+years?)\s*<\/span>\s*<\/li>/gi)]
    .map((match) => {
      const detailUrl = toAbsoluteUrl(match[1])
      const title = normalizeWhitespace(match[2])
      const experienceRequired = normalizeWhitespace(match[3])
      const jobId = new URL(detailUrl).searchParams.get('type')

      if (!detailUrl || !title || !jobId) return null

      return {
        title,
        detailUrl,
        experienceRequired,
        jobId,
        requisitionId: jobId,
      }
    })
    .filter(Boolean)

export const extractRoleDetail = (html = '', summary = {}) => {
  const descriptionMatch = String(html ?? '').match(/<h3[^>]*>\s*Description\s*<\/h3>([\s\S]*?)(?:<h4[^>]*>\s*Skills\s*<\/h4>|$)/i)
  const description = normalizeWhitespace(descriptionMatch?.[1])
  const experienceRequired = normalizeWhitespace(
    String(html ?? '').match(/<h2[^>]*>[\s\S]*?\(([\d+\s-]+years?)\)\s*<\/h2>/i)?.[1],
  ) || summary.experienceRequired || null
  const requiredSkills = [
    ...parseListItems(html, 'Skills'),
    ...parseListItems(html, 'Responsibilities'),
  ]

  return {
    title: summary.title,
    company: COMPANY,
    department: 'Engineering',
    location: 'Remote, India',
    city: 'Remote',
    country: 'India',
    jobId: summary.jobId,
    requisitionId: summary.requisitionId,
    sourceUrl: summary.detailUrl,
    applyUrl: summary.detailUrl,
    employmentType: null,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: description,
    remoteStatus: 'Remote',
  }
}

export const createTechugoScraper = ({ maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Techugo careers surface no longer matches the trusted first-party page')
    }

    const summaries = extractRoleSummaries(careersHtml)
    const selectedSummaries = maxJobs ? summaries.slice(0, maxJobs) : summaries
    const jobs = []

    for (const summary of selectedSummaries) {
      const detailHtml = await fetchText(summary.detailUrl)
      jobs.push({
        ...extractRoleDetail(detailHtml, summary),
        source: SOURCE,
        link: summary.detailUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createTechugoScraper().run(options)

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
