import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { readCurrentNumeros } from './currentNative20261117.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'numerosmotors'
export const COMPANY = 'Numeros Motors'
export const COMPANY_DOMAIN = 'numerosmotors.com'
export const HOMEPAGE_URL = 'https://numerosmotors.com/'
export const CAREERS_URL = 'https://numerosmotors.com/careers/'
export const OPEN_POSITIONS_URL = 'https://numerosmotors.com/open-positions/'
export const APPLY_URL = OPEN_POSITIONS_URL
export const APPLY_POPUP_CLASS = 'popmake-14016'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;|[\u2012\u2013\u2014\u2015]/g, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/<[^>]+>/g, ' '),
)

const ensureTrailingSlash = (pathname) => (pathname.endsWith('/') ? pathname : `${pathname}/`)

const toResolvedUrl = (value, base = HOMEPAGE_URL) => {
  try {
    return new URL(value, base).toString()
  } catch {
    return null
  }
}

const normalizeVerifiedUrl = (value, base = HOMEPAGE_URL) => {
  const resolved = toResolvedUrl(value, base)
  if (!resolved) return null

  try {
    const url = new URL(resolved)
    const pathname = url.pathname.replace(/\/+$/, '')

    if (url.origin !== 'https://numerosmotors.com') {
      return url.toString()
    }

    if (!pathname) return HOMEPAGE_URL
    if (pathname === '/careers') return CAREERS_URL
    if (pathname === '/open-positions') return OPEN_POSITIONS_URL

    return `${url.origin}${ensureTrailingSlash(url.pathname)}${url.search}${url.hash}`
  } catch {
    return resolved
  }
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeJobTitle = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .replace(/\s*-\s*/g, ' - ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s+/g, ' ')
    .trim()
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  return normalized
    .replace(/\s*-\s*/g, '-')
    .replace(/-{2,}/g, '-')
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Always Moving,\s*Always Numeros:\s*Cleaner,\s*Smarter Electric\s*\|\s*Numeros Motors\s*<\/title>/i.test(page)
    && /<link rel=["']canonical["'] href=["']https:\/\/numerosmotors\.com\/["']/i.test(page)
    && /Numeros Motors - Innovation is our way of life/i.test(page)
    && /href=["'](?:https:\/\/numerosmotors\.com\/careers\/?|\/careers\/?)["']/i.test(page)
}

export const extractCareersUrlFromHomepage = (html) => {
  const matches = [...String(html ?? '').matchAll(
    /href=["']([^"']*\/careers\/?[^"']*)["']/gi,
  )]

  for (const match of matches) {
    const resolved = normalizeVerifiedUrl(match[1], HOMEPAGE_URL)
    if (resolved === CAREERS_URL) return resolved
  }

  return null
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Careers at Numeros Motors\s*\|\s*Join the EV Revolution\s*<\/title>/i.test(page)
    && /<link rel=["']canonical["'] href=["']https:\/\/numerosmotors\.com\/careers\/["']/i.test(page)
    && /Lead the Change with Us/i.test(text)
    && /250\+\s*team/i.test(text)
    && /Click to See Open Positions\s*&(?:amp;)?\s*Apply/i.test(page)
}

export const extractOpenPositionsUrl = (html) => {
  const page = String(html ?? '')
  const buttonMatch = page.match(
    /<a[^>]+href=["']([^"']*open-positions[^"']*)["'][^>]*>[\s\S]*?Click to See Open Positions/i,
  )

  return normalizeVerifiedUrl(buttonMatch?.[1] ?? null, CAREERS_URL)
}

export const hasOfficialOpenPositionsSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Open Positions at Numeros Motors\s*\|\s*Join the EV Revolution\s*<\/title>/i.test(page)
    && /<link rel=["']canonical["'] href=["']https:\/\/numerosmotors\.com\/open-positions\/["']/i.test(page)
    && /\bOpen Positions\b/i.test(text)
    && /elementor-icon-box-title/i.test(page)
    && new RegExp(`\\b${APPLY_POPUP_CLASS}\\b`).test(page)
    && /<span class=["']elementor-button-text["']>\s*Apply Now\s*<\/span>/i.test(page)
    && /career-form/i.test(page)
}

export const extractOpenings = (html) => {
  if (!hasOfficialOpenPositionsSignal(html)) {
    throw new Error('Numeros Motors verified open positions page no longer matches the trusted first-party public jobs surface')
  }

  const jobs = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(
    new RegExp(
      `<h4 class=["']elementor-icon-box-title["']>\\s*<span[^>]*>\\s*([\\s\\S]*?)\\s*<\\/span>\\s*<\\/h4>[\\s\\S]*?<p class=["']elementor-icon-box-description["']>\\s*([\\s\\S]*?)\\s*<\\/p>[\\s\\S]*?\\b${APPLY_POPUP_CLASS}\\b[\\s\\S]*?<span class=["']elementor-button-text["']>\\s*Apply Now\\s*<\\/span>`,
      'gi',
    ),
  )) {
    const title = normalizeJobTitle(stripTags(match[1]))
    const experienceRequired = normalizeExperience(stripTags(match[2]))

    if (!title || !experienceRequired) {
      throw new Error('Numeros Motors verified open positions page no longer exposes the expected inline role cards')
    }

    const dedupeKey = title
    if (seen.has(dedupeKey)) continue

    seen.add(dedupeKey)

    jobs.push({
      title,
      department: null,
      location: null,
      city: null,
      country: null,
      sourceUrl: OPEN_POSITIONS_URL,
      applyUrl: APPLY_URL,
      jobId: `${SOURCE}-${slugify(title)}`,
      requisitionId: `${SOURCE}-${slugify(title)}`,
      employmentType: /\bintern\b/i.test(title) ? 'Internship' : null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      sourceDetailComplete: false,
      sourceDetailStatus: 'native-title-experience-brief-only',
      lifecycleCleanupAllowed: false,
      remoteStatus: null,
    })
  }

  if (jobs.length === 0) {
    throw new Error('Numeros Motors verified open positions page no longer exposes the expected inline role cards')
  }

  return jobs
}

export const createNumerosMotorsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  run: (options = {}) => readCurrentNumeros({ ...options, now: options.now ?? now }),
})

export const run = async (options = {}) => createNumerosMotorsScraper().run(options)

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
