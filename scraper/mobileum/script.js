import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { MOBILEUM_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const RECRUIT_URL = PROVIDER_METADATA.recruitPageUrl
export { PROVIDER_METADATA }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const toAbsoluteUrl = (value) => new URL(value, RECRUIT_URL).href

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  return normalized.includes('Job Opportunities')
    && page.includes(`src="${RECRUIT_URL}"`)
}

export const hasRecruitTableSignal = (html) => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Applicant Portal')
    && normalized.includes('Current Vacancies')
    && normalized.includes('Vacancy Name')
    && normalized.includes('Location Country')
    && normalized.includes('Location City')
  }

export const extractJobsFromRecruitHtml = (html) =>
  Array.from(
    String(html ?? '').matchAll(/<tr class="[^"]*\bdataRow\b[^"]*">([\s\S]*?)<\/tr>/gi),
    (rowMatch) => {
      const rowHtml = rowMatch[1]
      const linkMatch = rowHtml.match(
        /<a href="([^"]+fRecruit__ApplyJob[^"]+vacancyNo=([^"&]+)[^"]*)">([^<]+)<\/a>/i,
      )
      const values = Array.from(
        rowHtml.matchAll(/<td[^>]*>[\s\S]*?<span[^>]*>([^<]*)<\/span>[\s\S]*?<\/td>/gi),
        (match) => normalizeWhitespace(match[1]),
      )

      if (!linkMatch || values.length < 4) {
        return null
      }

      const employmentType = values[1] || null
      const country = values[2] || null
      const city = values[3] || null

      return {
        title: normalizeWhitespace(linkMatch[3]),
        jobId: normalizeWhitespace(linkMatch[2]),
        employmentType,
        country,
        city,
        location: [city, country].filter(Boolean).join(', ') || null,
        applyUrl: toAbsoluteUrl(linkMatch[1]),
      }
    },
  )
    .filter(Boolean)
    .filter((job) => job.title && job.jobId)
    .map((job) => ({
      ...job,
      sourceUrl: job.applyUrl,
      link: job.applyUrl,
    }))

export const createMobileumScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Mobileum first-party careers page changed materially')
    }

    const recruitHtml = await fetchText(RECRUIT_URL)
    if (!hasRecruitTableSignal(recruitHtml)) {
      throw new Error('Mobileum public applicant portal changed materially')
    }

    return extractJobsFromRecruitHtml(recruitHtml)
      .filter((job) => /india/i.test(job.country ?? ''))
      .sort((left, right) => left.title.localeCompare(right.title))
      .map((job) => ({
        title: job.title,
        company: COMPANY,
        location: job.location,
        city: job.city,
        country: job.country,
        jobId: job.jobId,
        sourceUrl: job.sourceUrl,
        applyUrl: job.applyUrl,
        employmentType: job.employmentType,
        jobDescription: null,
        source: SOURCE,
        link: job.link,
        scrapedAt: now(),
      }))
  },
})

export const run = async (options = {}) => createMobileumScraper(options).run(options)

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
