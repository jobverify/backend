import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'dhandhaniainfotech'
export const COMPANY = 'Dhandhania Infotech'
export const CAREER_PAGE_URL = 'https://dhaninfo.com/career/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|table|tr|td|details|summary|h[1-6])>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&#8211;|&#8212;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/[Â]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const buildJobUrl = (jobId) => new URL(`#${jobId}`, CAREER_PAGE_URL).toString()

const extractField = (html, label) => {
  const textMatch = String(html ?? '').match(
    new RegExp(`<b>\\s*${label}\\s*<\\/b>\\s*<\\/p>\\s*<\\/td>\\s*<td>\\s*<p>([\\s\\S]*?)<\\/p>`, 'i'),
  )
  if (textMatch) return normalizeWhitespace(textMatch[1])

  const inlineBoldMatch = String(html ?? '').match(
    new RegExp(`<b>\\s*${label}\\s*:?\\s*([\\s\\S]*?)<\\/b>`, 'i'),
  )
  if (inlineBoldMatch) return normalizeWhitespace(inlineBoldMatch[1])

  const paragraphMatch = String(html ?? '').match(
    new RegExp(`<(?:strong|b)>\\s*${label}\\s*<\\/(?:strong|b)>\\s*:?\\s*([\\s\\S]*?)<\\/p>`, 'i'),
  )
  return normalizeWhitespace(paragraphMatch?.[1] || null)
}

const extractLocation = (html) =>
  extractField(html, 'Job Location')
  || extractField(html, 'Location')

const extractExperience = (html) => extractField(html, 'Experience Required')

const extractRequiredSkills = (html) => {
  const labelMatch = String(html ?? '').match(
    /<b>\s*Required Skills\s*<\/b>\s*<\/p>\s*<ul>([\s\S]*?)<\/ul>/i,
  )

  if (!labelMatch) return []

  return [...labelMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
}

const cleanDescription = (html) =>
  normalizeWhitespace(
    String(html ?? '')
      .replace(/<table[\s\S]*?<\/table>/gi, '')
      .replace(/<p><b>\s*Website\s*&#8211;\s*<\/b>[\s\S]*?<\/p>/gi, '')
      .replace(/<p><b>\s*Location\s*<\/b>[\s\S]*?<\/p>/gi, '')
      .replace(/<p><b>\s*Required Skills\s*<\/b><\/p>\s*<ul>[\s\S]*?<\/ul>/gi, '')
      .replace(/<p><strong>\s*About Us\s*:?\s*<\/strong>[\s\S]*?<\/p>/gi, '')
      .replace(/<p><b>\s*About Us\s*:?\s*<\/b>[\s\S]*?<\/p>/gi, ''),
  )

const extractSections = (html) => {
  const pattern = /<details id="([^"]+)" class="e-n-accordion-item"[\s\S]*?<div class="e-n-accordion-item-title-text">\s*([\s\S]*?)\s*<\/div>[\s\S]*?<div role="region"[^>]*>([\s\S]*?)<\/div>\s*<\/details>/gi
  return [...String(html ?? '').matchAll(pattern)].map((match) => ({
    jobId: normalizeWhitespace(match[1]),
    title: normalizeWhitespace(match[2]),
    bodyHtml: match[3] || '',
  }))
}

export const extractSearchResults = (html) =>
  extractSections(html)
    .map(({ jobId, title, bodyHtml }) => {
      const location = extractLocation(bodyHtml)
      if (!jobId || !title || !location) return null

      return {
        title,
        company: COMPANY,
        department: null,
        location: /india/i.test(location) ? location : `${location}, India`,
        city: normalizeWhitespace(location.split(',')[0]),
        state: null,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: buildJobUrl(jobId),
        applyUrl: buildJobUrl(jobId),
        employmentType: null,
        experienceRequired: extractExperience(bodyHtml),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: extractRequiredSkills(bodyHtml),
        postingDate: null,
        closingDate: null,
        jobDescription: cleanDescription(bodyHtml),
        remoteStatus: 'On-site',
      }
    })
    .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createDhandhaniaInfotechScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const jobs = extractSearchResults(await fetchText(CAREER_PAGE_URL))
    const selectedJobs = Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
    const scrapedAt = (overrideNow || now)()

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createDhandhaniaInfotechScraper(options).run(options)

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
