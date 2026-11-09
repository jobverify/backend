import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { TATVASOFT_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const APPLICATION_EMAIL = PROVIDER_METADATA.applicationEmail
export const APPLICATION_URL = PROVIDER_METADATA.applicationUrl

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTagsWithLineBreaks = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/main|\/nav|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<(p|div|section|article|li|ul|ol|main|nav|h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const toTextLines = (html) =>
  stripTagsWithLineBreaks(html)
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1])
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const extractApplicationEmail = (html = '') => {
  const match = String(html ?? '').match(/\bcareer@tatvasoft\.com\b/i)
  return normalizeWhitespace(match?.[0])
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = (normalizeWhitespace(stripTagsWithLineBreaks(page)) || '').toLowerCase()

  return /(?:TatvaSoft Career and Culture|Careers at TatvaSoft)/i.test(extractTitle(page) || '')
    && text.includes('technology evolves, challenges grow')
    && (text.includes('jobs at tatvasoft') || text.includes('current openings'))
    && text.includes('business development executive')
    && text.includes('java developer')
    && text.includes('@tatvasoft.com')
  }

export const extractOpeningLinks = (html = '') => {
  const links = []
  const seen = new Set()

  const patterns = [
    /<h3>\s*<a href=["'](https:\/\/www\.tatvasoft\.com\/career\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h3>/gi,
    /<h3>([^<]+)<\/h3>[\s\S]*?<a href=["'](https:\/\/www\.tatvasoft\.com\/career\/[^"']+)["'][^>]*>\s*Read More\s*<\/a>/gi,
  ]

  for (const pattern of patterns) {
    for (const match of String(html ?? '').matchAll(pattern)) {
      const url = normalizeWhitespace(patterns.indexOf(pattern) === 0 ? match[1] : match[2])
      const rawTitle = patterns.indexOf(pattern) === 0 ? match[2] : match[1]
      const title = normalizeWhitespace(stripTagsWithLineBreaks(rawTitle))
      if (!title || !url || seen.has(url)) continue
      seen.add(url)
      links.push({ title, url })
    }
  }

  return links
}

export const hasOfficialDetailSignal = (html = '') => {
  const title = extractTitle(html) || ''
  const text = (normalizeWhitespace(stripTagsWithLineBreaks(html)) || '').toLowerCase()

  return /(?:TatvaSoft Career and Culture|Careers at TatvaSoft)/i.test(title)
    && Boolean(extractApplicationEmail(html))
    && text.includes('to apply for this position mail your updated resume on career@tatvasoft.com')
    && (
      text.includes('qualification:')
      || text.includes('required specifications and qualifications')
    )
  }

const inferDepartment = (title) => {
  const normalized = normalizeWhitespace(title)?.toLowerCase() || ''
  if (normalized.includes('business development')) return 'Business Development'
  if (normalized.includes('developer')) return 'Engineering'
  return null
}

const extractFieldValue = (lines, prefixPattern) => {
  const line = lines.find((item) => prefixPattern.test(item))
  if (!line) return null
  return normalizeWhitespace(line.replace(prefixPattern, ''))
}

const extractExperience = (lines) => {
  const explicit = extractFieldValue(lines, /^Required Experience:\s*/i)
  if (explicit) return explicit

  const inferredLine = lines.find((line) => /^Required experience\s*[-–]/i.test(line))
  if (!inferredLine) return null
  const normalized = normalizeWhitespace(inferredLine.replace(/^Required experience\s*[-–]\s*/i, ''))
  return normalized
}

export const extractJobFromDetailPage = (html = '', { title, url, scrapedAt } = {}) => {
  const lines = toTextLines(html)
  const detailTitle = normalizeWhitespace(title) || lines[0] || null
  const titleIndex = detailTitle ? lines.indexOf(detailTitle) : -1
  const applyIndex = lines.findIndex((line) =>
    /To apply for this position mail your updated Resume on career@tatvasoft\.com/i.test(line),
  )
  const relevantLines = lines.slice(titleIndex >= 0 ? titleIndex + 1 : 0, applyIndex >= 0 ? applyIndex : undefined)
  const minimumQualification = extractFieldValue(relevantLines, /^Qualification:\s*/i)
  const experienceRequired = extractExperience(relevantLines)
  const jobDescriptionLines = relevantLines.filter((line) =>
    !/^Qualification:\s*/i.test(line)
    && !/^Required Experience:\s*/i.test(line)
    && !/^Required experience\s*[-–]/i.test(line),
  )
  const requisitionId = normalizeWhitespace(url?.split('/').filter(Boolean).pop()) || null

  return {
    jobId: `tatvasoft-${slugify(detailTitle)}`,
    requisitionId,
    title: detailTitle,
    company: COMPANY,
    department: inferDepartment(detailTitle),
    location: 'India',
    city: null,
    country: 'India',
    link: APPLICATION_URL,
    applyUrl: APPLICATION_URL,
    sourceUrl: url,
    source: SOURCE,
    employmentType: null,
    experienceRequired,
    jobDescription: jobDescriptionLines.join('\n'),
    minimumQualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    scrapedAt,
  }
}

export const createTatvaSoftScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersPageSignal(careersPage.html)) {
      throw new Error('TatvaSoft verified first-party career page no longer matches the trusted public surface')
    }

    const openingLinks = extractOpeningLinks(careersPage.html)
    if (openingLinks.length === 0) {
      throw new Error('TatvaSoft verified first-party career page no longer exposes trusted role detail links')
    }

    const selectedLinks = maxJobs ? openingLinks.slice(0, maxJobs) : openingLinks
    const scrapedAt = now()
    const jobs = []

    for (const opening of selectedLinks) {
      const detailPage = await fetchPage(opening.url)
      if (detailPage.status !== 200 || !hasOfficialDetailSignal(detailPage.html)) {
        throw new Error(`TatvaSoft verified first-party role detail page no longer matches trusted public surface: ${opening.url}`)
      }

      jobs.push(extractJobFromDetailPage(detailPage.html, {
        title: opening.title,
        url: opening.url,
        scrapedAt,
      }))
    }

    return jobs
  },
})

export const run = async (options = {}) => createTatvaSoftScraper(options).run(options)

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
