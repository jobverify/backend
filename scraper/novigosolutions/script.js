import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { NOVIGO_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = NOVIGO_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value = '') => String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toSlug = (value = '') => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const buildJobDescription = (requirements) => requirements.join(' ')

const parseLocation = (value = '') => ({
  location: value || null,
  city: null,
  state: null,
  country: value ? 'India' : null,
  remoteStatus: /remote work/i.test(value) ? 'Hybrid' : 'On-site',
})

const extractParagraphValues = (html = '') =>
  [...String(html).matchAll(/<p[^>]*>\s*([\s\S]*?)\s*<\/p>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

const extractRoleHeadings = (html = '') => {
  const page = String(html)
  const classedHeadings = [...page.matchAll(
    /<h3[^>]*class=["'][^"']*ns-job-head[^"']*["'][^>]*>([\s\S]*?)<span>\((\d+(?:-\d+)?\s*Years)\)<\/span>[\s\S]*?<\/h3>/gi,
  )]
    .map((match) => ({
      ...match,
      title: normalizeWhitespace(match[1]),
      experienceRequired: normalizeWhitespace(match[2]),
    }))
    .filter((match) => match.title && match.experienceRequired)

  if (classedHeadings.length > 0) {
    return classedHeadings
  }

  return [...page.matchAll(/<h[1-6][^>]*>\s*([\s\S]*?)\s*<\/h[1-6]>/gi)]
    .map((match) => {
      const headingText = normalizeWhitespace(match[1])
      const roleMatch = headingText.match(/^(.*?)\s*\((\d+(?:-\d+)?\s*Years)\)$/i)

      if (!roleMatch) {
        return null
      }

      return {
        ...match,
        title: normalizeWhitespace(roleMatch[1]),
        experienceRequired: normalizeWhitespace(roleMatch[2]),
      }
    })
    .filter(Boolean)
}

const findApplySectionIndex = (html = '') => {
  const match = String(html).match(/<h[1-6][^>]*>\s*Apply Online\s*<\/h[1-6]>/i)
  return match?.index ?? String(html).length
}

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Life @ Novigo')
    && normalized.includes('Opportunities with us')
    && normalized.includes('Apply Online')
    && normalized.includes('.Net Developer (2-5 Years)')
    && normalized.includes('Angular Developer (3-6 Years)')
    && normalized.includes('Bangalore / Mangalore / Remote work during Pandemic.')
  }

export const extractVisibleRoles = (html = '') => {
  const page = String(html)
  const headings = extractRoleHeadings(page)
  const applySectionIndex = findApplySectionIndex(page)

  return headings.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length
    const nextHeadingIndex = index + 1 < headings.length ? (headings[index + 1].index ?? page.length) : page.length
    const end = Math.min(
      nextHeadingIndex,
      applySectionIndex > start ? applySectionIndex : page.length,
    )
    const block = page.slice(start, end)
    const paragraphs = extractParagraphValues(block)
    const location = paragraphs.find((value) => /Bangalore\s*\/\s*Mangalore/i.test(value)) ?? null
    const requirements = paragraphs.filter((value) =>
      value !== location
      && !/^Requirements:?$/i.test(value)
      && !/^See More$/i.test(value)
      && !/^Apply Now$/i.test(value))

    return {
      title: match.title,
      experienceRequired: match.experienceRequired,
      location,
      requirements,
    }
  }).filter((role) => role.title && role.location && role.requirements.length > 0)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createNovigoSolutionsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Novigo Solutions verified first-party careers page no longer matches the trusted contract')
    }

    const roles = extractVisibleRoles(careersHtml)
    if (roles.length === 0) {
      throw new Error('Novigo Solutions first-party careers page no longer exposes trusted inline job sections')
    }

    return roles
      .map((role) => ({
        title: role.title,
        company: COMPANY,
        ...parseLocation(role.location),
        department: null,
        employmentType: null,
        experienceRequired: role.experienceRequired,
        jobId: toSlug(role.title),
        requisitionId: toSlug(role.title),
        sourceUrl: CAREERS_URL,
        applyUrl: CAREERS_URL,
        link: CAREERS_URL,
        jobDescription: buildJobDescription(role.requirements),
        source: SOURCE,
        scrapedAt: now(),
      }))
      .sort((left, right) => left.title.localeCompare(right.title))
  },
})

export const run = async (options = {}) => createNovigoSolutionsScraper(options).run(options)

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
