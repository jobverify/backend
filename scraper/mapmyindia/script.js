import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MAPMYINDIA_CATALOG } from './catalog.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const PROVIDER_METADATA = MAPMYINDIA_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const PUBLIC_BOARD_URL = PROVIDER_METADATA.publicBoardUrl

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

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<(p|div|section|article|li|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const hasClassName = (tag, className) => {
  const match = String(tag ?? '').match(/\bclass\s*=\s*["']([^"']+)["']/i)
  if (!match?.[1]) return false

  return match[1].split(/\s+/).includes(className)
}

const extractElementsByClass = (html, className) => {
  const source = String(html ?? '')
  const openTagPattern = /<([a-z][\w:-]*)\b[^>]*>/gi
  const elements = []

  for (const openMatch of source.matchAll(openTagPattern)) {
    const [openTag, tagName] = openMatch
    if (!hasClassName(openTag, className) || /\/\s*>$/.test(openTag)) continue

    const tagPattern = new RegExp(`</?${escapeRegExp(tagName)}\\b[^>]*>`, 'gi')
    tagPattern.lastIndex = openMatch.index + openTag.length

    let depth = 1
    let closeMatch

    while ((closeMatch = tagPattern.exec(source))) {
      const tag = closeMatch[0]
      const isClosingTag = tag.startsWith('</')
      const isSelfClosingTag = /\/\s*>$/.test(tag)

      if (isClosingTag) depth -= 1
      else if (!isSelfClosingTag) depth += 1

      if (depth === 0) {
        elements.push(source.slice(openMatch.index + openTag.length, closeMatch.index))
        break
      }
    }
  }

  return elements
}

const normalizeIndiaLocation = (value) => {
  const location = normalizeWhitespace(value)
  if (!location) return null
  if (/\bindia\b/i.test(location)) return location
  return `${location}, India`
}

const inferRemoteStatus = (location) => {
  const normalized = normalizeWhitespace(location)?.toLowerCase() || ''
  if (normalized.includes('remote')) return 'Remote'
  if (normalized.includes('hybrid')) return 'Hybrid'
  return 'On-site'
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /MapmyIndia/i.test(page)
    && text.includes('What brings us to MapmyIndia')
    && text.includes('Join MapmyIndia')
    && text.includes('C.E. Info Systems Ltd.')
    && /mailto:hr@mapmyindia\.com/i.test(page)
    && text.includes('Android Developer')
    && text.includes('Inside Sales Executive')
}

export const extractApplicationContact = (html) => {
  const match = String(html ?? '').match(/mailto:(hr@mapmyindia\.com)/i)
  return normalizeWhitespace(match?.[1] || null)
}

export const extractSearchResults = (html) => {
  const jobs = []
  const seenJobIds = new Set()

  for (const cardHtml of extractElementsByClass(html, 'jobCard')) {
    if (extractElementsByClass(cardHtml, 'apply-bt').length === 0) continue

    const requirements = extractElementsByClass(cardHtml, 'requirement')
      .map((block) => stripTags(block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || block))
      .filter(Boolean)
    const profileDetailHtml = extractElementsByClass(cardHtml, 'profile-detail')[0] || ''

    const title = normalizeWhitespace(cardHtml.match(/<h4\b[^>]*>([\s\S]*?)<\/h4>/i)?.[1])
    const experienceRequired = requirements[0] || null
    const rawLocation = requirements[1] || null
    const jobDescription = stripTags(
      profileDetailHtml.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] || profileDetailHtml,
    )
    const location = normalizeIndiaLocation(rawLocation)
    const city = normalizeWhitespace(rawLocation)
    const jobId = slugify(`${title}-${rawLocation}`)

    if (!title || !experienceRequired || !rawLocation || !location || !jobId) continue
    if (seenJobIds.has(jobId)) continue
    seenJobIds.add(jobId)

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location,
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: null,
      experienceRequired,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
      remoteStatus: inferRemoteStatus(rawLocation),
    })
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'mapmyindia-html',
  timeoutMs: 15000,
})

export const createMapmyIndiaScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const html = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersPageSignal(html)) {
      throw new Error('MapmyIndia verified first-party careers page no longer matches the trusted public job surface')
    }

    if (extractApplicationContact(html) !== 'hr@mapmyindia.com') {
      throw new Error('MapmyIndia verified first-party careers contact changed materially')
    }

    const jobs = extractSearchResults(html).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))

    if (jobs.length === 0) {
      throw new Error('MapmyIndia verified careers page no longer exposes trusted inline public job cards')
    }

    return maxJobs ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createMapmyIndiaScraper(options).run(options)

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
