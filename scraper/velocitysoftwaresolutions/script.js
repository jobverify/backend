import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { VELOCITY_SOFTWARE_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = VELOCITY_SOFTWARE_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOBS_ARCHIVE_URL = 'https://www.velsof.com/jobs/'
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const JOB_LINK_PATTERN = /<a\b[^>]*href=(['"])(https:\/\/www\.velsof\.com\/jobs\/[^'">]+\/)\1[^>]*>([\s\S]*?)<\/a>/gi

const decodeHtml = (value = '') => String(value)
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")

const stripTags = (value = '') => String(value).replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value = '') => decodeHtml(stripTags(value))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const toSlug = (value = '') => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const parseCareerLinkText = (value = '') => {
  const normalized = normalizeWhitespace(value)
  const match = normalized.match(
    /^(.*?)\s+(Design|Mobile Development|Engineering)\s+(.*?)\s+(\d+(?:-\d+|\+)?\s+years)\s+(Full-time|Part-time|Contract)\s+[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}$/i,
  )

  if (!match) return null

  return {
    title: normalizeWhitespace(match[1]),
    department: normalizeWhitespace(match[2]),
    location: normalizeWhitespace(match[3]),
    experienceRequired: normalizeWhitespace(match[4]),
    employmentType: normalizeWhitespace(match[5]),
  }
}

const parseLocation = (value = '') => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      state: null,
      country: null,
      remoteStatus: null,
    }
  }

  if (/\/\s*remote/i.test(normalized)) {
    const [city] = normalized.split(',')
    return {
      location: normalized,
      city: normalizeWhitespace(city),
      state: null,
      country: 'India',
      remoteStatus: 'Hybrid',
    }
  }

  const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2 && /india/i.test(parts[1])) {
    return {
      location: `${parts[0]}, ${parts[1]}`,
      city: parts[0],
      state: null,
      country: 'India',
      remoteStatus: 'On-site',
    }
  }

  return {
    location: normalized,
    city: null,
    state: null,
    country: /india/i.test(normalized) ? 'India' : null,
    remoteStatus: null,
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html)
  const text = normalizeWhitespace(page)

  return (
    /<h1>\s*Careers\s*<\/h1>/i.test(page)
      && /Join our dynamic team to innovate, create, and excel/i.test(page)
      && /https:\/\/www\.velsof\.com\/jobs\/ui-ux-designer\//i.test(page)
      && /https:\/\/www\.velsof\.com\/jobs\/flutter-mobile-app-developer\//i.test(page)
      && /https:\/\/www\.velsof\.com\/jobs\/senior-laravel-developer\//i.test(page)
  ) || (
    /<title>\s*Careers\s*\|\s*Velocity Software Solutions\s*<\/title>/i.test(page)
      && text.includes('View Open Positions')
  )
}

export const hasOfficialJobsArchiveSignal = (html = '') => {
  const page = String(html)
  return /<title>\s*Jobs\s*\|\s*Velocity Software Solutions\s*<\/title>/i.test(page)
    && /https:\/\/www\.velsof\.com\/jobs\/ui-ux-designer\//i.test(page)
    && /https:\/\/www\.velsof\.com\/jobs\/flutter-mobile-app-developer\//i.test(page)
    && /https:\/\/www\.velsof\.com\/jobs\/senior-laravel-developer\//i.test(page)
}

export const extractJobLinks = (html = '') => {
  const links = []
  const seen = new Set()

  for (const match of String(html).matchAll(JOB_LINK_PATTERN)) {
    const applyUrl = toAbsoluteUrl(match[2])
    const metadata = parseCareerLinkText(match[3])
    if (!applyUrl || !metadata || seen.has(applyUrl)) continue
    seen.add(applyUrl)
    links.push(applyUrl)
  }

  return links
}

export const extractArchiveJobLinks = (html = '') => {
  const links = []
  const seen = new Set()

  for (const match of String(html).matchAll(JOB_LINK_PATTERN)) {
    const applyUrl = toAbsoluteUrl(match[2], JOBS_ARCHIVE_URL)
    if (!applyUrl || applyUrl === JOBS_ARCHIVE_URL || /\/feed\/?$/i.test(applyUrl) || seen.has(applyUrl)) continue
    seen.add(applyUrl)
    links.push(applyUrl)
  }

  return links
}

const extractCareerCards = (html = '') => {
  const cards = []
  const seen = new Set()

  for (const match of String(html).matchAll(JOB_LINK_PATTERN)) {
    const applyUrl = toAbsoluteUrl(match[2])
    const metadata = parseCareerLinkText(match[3])
    if (!applyUrl || !metadata || seen.has(applyUrl)) continue
    seen.add(applyUrl)
    cards.push({
      ...metadata,
      ...parseLocation(metadata.location),
      applyUrl,
      sourceUrl: applyUrl,
    })
  }

  return cards
}

const extractSectionParagraph = (html = '', heading) => {
  const pattern = new RegExp(
    `<h2>\\s*${heading}\\s*<\\/h2>\\s*<p>([\\s\\S]*?)<\\/p>`,
    'i',
  )
  const match = String(html).match(pattern)
  return normalizeWhitespace(match?.[1] || '')
}

const extractRequirements = (html = '') => {
  const listMatch = String(html).match(/<h2>\s*Requirements\s*<\/h2>\s*<ul>([\s\S]*?)<\/ul>/i)
  if (!listMatch) return []

  return [...listMatch[1].matchAll(/<li>([\s\S]*?)<\/li>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
}

const buildJobDescription = ({ summary, requirements }) => {
  const sections = []
  if (summary) sections.push(summary)
  if (requirements.length > 0) {
    sections.push(`Requirements: ${requirements.join('; ')}.`)
  }
  return sections.join(' ')
}

const extractDetailMetadata = (html = '') => {
  const text = normalizeWhitespace(html)
  const match = text.match(
    /(Design|Mobile Development|Engineering)\s+(.*?)\s+(\d+(?:-\d+|\+)?\s+years)\s+(Full-time|Part-time|Contract)\s+About the Role/i,
  )

  if (!match) {
    return {
      department: null,
      location: null,
      city: null,
      state: null,
      country: null,
      remoteStatus: null,
      experienceRequired: null,
      employmentType: null,
    }
  }

  const [, department, location, experienceRequired, employmentType] = match
  return {
    department: normalizeWhitespace(department),
    ...parseLocation(location),
    experienceRequired: normalizeWhitespace(experienceRequired),
    employmentType: normalizeWhitespace(employmentType),
  }
}

const extractDetailTitle = (html = '') => {
  const title = normalizeWhitespace(String(html).match(/<title>\s*([\s\S]*?)\s*<\/title>/i)?.[1] || '')
  if (title) {
    return normalizeWhitespace(title.replace(/\|\s*Velocity\s*$/i, ''))
  }

  return normalizeWhitespace(String(html).match(/<h1[^>]*>\s*([\s\S]*?)\s*<\/h1>/i)?.[1] || '')
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createVelocitySoftwareSolutionsScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Velocity Software Solutions verified careers index no longer matches the trusted first-party contract')
    }

    let cards = extractCareerCards(careersHtml)
    if (cards.length === 0) {
      const archiveHtml = await fetchText(JOBS_ARCHIVE_URL)
      if (!hasOfficialJobsArchiveSignal(archiveHtml)) {
        throw new Error('Velocity Software Solutions jobs archive no longer matches the trusted first-party contract')
      }

      cards = extractArchiveJobLinks(archiveHtml).map((applyUrl) => ({
        applyUrl,
        sourceUrl: applyUrl,
      }))
    }

    if (cards.length === 0) {
      throw new Error('Velocity Software Solutions careers index no longer exposes trusted job links')
    }

    const jobs = []

    for (const card of cards) {
      const detailHtml = await fetchText(card.applyUrl)
      const detailTitle = extractDetailTitle(detailHtml)
      const detailMetadata = extractDetailMetadata(detailHtml)
      const title = card.title || detailTitle

      if (!title || (card.title && detailTitle && detailTitle !== card.title)) {
        throw new Error(`Velocity Software Solutions detail page drifted for ${card.applyUrl}`)
      }

      const summary = extractSectionParagraph(detailHtml, 'About the Role')
      const requirements = extractRequirements(detailHtml)
      if (!summary || requirements.length === 0) {
        throw new Error(`Velocity Software Solutions detail page no longer exposes trusted role sections for ${card.applyUrl}`)
      }

      jobs.push({
        title,
        company: COMPANY,
        department: card.department || detailMetadata.department,
        location: card.location || detailMetadata.location,
        city: card.city || detailMetadata.city,
        state: card.state || detailMetadata.state,
        country: card.country || detailMetadata.country,
        remoteStatus: card.remoteStatus || detailMetadata.remoteStatus,
        employmentType: card.employmentType || detailMetadata.employmentType,
        experienceRequired: card.experienceRequired || detailMetadata.experienceRequired,
        jobId: toSlug(title),
        requisitionId: toSlug(title),
        sourceUrl: card.sourceUrl,
        applyUrl: card.applyUrl,
        link: card.applyUrl,
        jobDescription: buildJobDescription({ summary, requirements }),
        source: SOURCE,
        scrapedAt: now(),
      })
    }

    return jobs.sort((left, right) => left.title.localeCompare(right.title))
  },
})

export const run = async (options = {}) => createVelocitySoftwareSolutionsScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
