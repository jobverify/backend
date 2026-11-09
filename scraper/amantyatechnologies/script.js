import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { AMANTYA_TECHNOLOGIES_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")

const stripTags = (value) => decodeHtml(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/&/g, ' and ')
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

export const hasOfficialAmantyaCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /Career/i.test(page)
    && text.includes('Apply Now')
    && text.includes('Job Type')
    && (text.includes('Join Our Team') || text.includes('View Detail'))
}

const collectSkills = (segment) =>
  [...String(segment ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
    .filter((value) => !/^(experience|location|job type)\b/i.test(value))

const extractFieldValue = (html, labels) => {
  for (const label of labels) {
    const headingPattern = new RegExp(
      `<h6[^>]*>\\s*${label}\\s*<\\/h6>\\s*<p[^>]*>([\\s\\S]*?)<\\/p>`,
      'i',
    )
    const headingMatch = String(html ?? '').match(headingPattern)
    if (headingMatch) {
      const value = stripTags(headingMatch[1])
      if (value) {
        return value
      }
    }

    const inlinePattern = new RegExp(`${label}\\s*:?\\s*([^<]+)`, 'i')
    const inlineMatch = String(html ?? '').match(inlinePattern)
    if (inlineMatch) {
      const value = stripTags(inlineMatch[1])
      if (value) {
        return value
      }
    }
  }

  return ''
}

export const extractJobPanels = (html = '') => {
  const page = String(html ?? '')
  const segments = page.includes('<div class="card mb-3">')
    ? page.split(/<div class="card mb-3">/i).slice(1)
    : page.split(/<h5[^>]*>/i).slice(1)

  return segments.map((segment) => {
    const title = stripTags(segment.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i)?.[1] ?? segment.match(/^([\s\S]*?)<\/h5>/i)?.[1])
    const body = segment.split(/<\/h5>/i).slice(1).join('</h5>')
    const detailArea = body.match(/<div[^>]*toggleDescriptionArea[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? body
    const experienceRequired = extractFieldValue(body, ['Experience'])
    const location = extractFieldValue(body, ['Job Location', 'Location'])
    const employmentType = extractFieldValue(body, ['Job Type'])
    const jobDescription = stripTags(detailArea) || null
    const requiredSkills = collectSkills(detailArea)

    if (!title || !experienceRequired || !location || !employmentType) {
      return null
    }

    return {
      title,
      experienceRequired,
      location,
      employmentType,
      jobDescription: jobDescription || null,
      requiredSkills,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      jobId: `${SOURCE}-${slugify(title)}-${slugify(location)}`,
    }
  }).filter(Boolean)
}

export const createAmantyaTechnologiesScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    if (!hasOfficialAmantyaCareersSignal(html)) {
      throw new Error('Amantya Technologies careers page no longer matches the verified first-party surface')
    }

    const jobs = extractJobPanels(html)
    if (!jobs.length) {
      throw new Error('Amantya Technologies careers page exposes no public inline job panels')
    }

    return jobs.map((job) => ({
      title: job.title,
      company: COMPANY,
      department: null,
      location: job.location,
      city: null,
      state: null,
      country: 'India',
      jobId: job.jobId,
      requisitionId: null,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      employmentType: job.employmentType,
      experienceRequired: job.experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: job.requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: job.jobDescription,
      remoteStatus: null,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createAmantyaTechnologiesScraper(options).run(options)

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
