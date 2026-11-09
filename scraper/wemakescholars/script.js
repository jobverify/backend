import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'wemakescholars'
export const COMPANY = 'WeMakeScholars'
export const CAREERS_URL = 'https://www.wemakescholars.com/hiring'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? ''))
    .replace(/\r/g, '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/h[1-6]|\/a)\b[^>]*>/gi, ' ')
    .replace(/<(p|div|li|ul|ol|h[1-6]|a)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
    ?.replace(/\s*-\s*/g, ', ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\.+$/g, '')
    .replace(/,\s*,/g, ',')

  if (!normalized) return null
  if (/\bIndia\b/i.test(normalized)) return normalized
  return `${normalized}, India`
}

const deriveCity = (location) => {
  const normalized = normalizeLocation(location)
  if (!normalized) return null

  const [firstPart] = normalized.split(',').map((part) => part.trim()).filter(Boolean)
  return normalizeCity(firstPart || normalized)
}

const deriveRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /remote/i.test(normalized) ? 'Remote' : 'On-site'
}

const buildApplyUrl = (jobId) => `${CAREERS_URL}?post_id=${jobId}`
const buildSourceUrl = (jobId) => `${CAREERS_URL}#hiring${jobId}`

const findCategoryForIndex = (categories, index) => {
  let currentCategory = null

  for (const category of categories) {
    if (category.index >= index) break
    currentCategory = category.name
  }

  return currentCategory
}

const extractRoleOptions = (html) => {
  const selectHtml = String(html ?? '').match(
    /<select[^>]*id=["']hiring-position["'][^>]*>([\s\S]*?)<\/select>/i,
  )?.[1] || ''
  const roles = new Map()

  for (const match of selectHtml.matchAll(/<option value="(\d+)">([\s\S]*?)<\/option>/gi)) {
    const jobId = normalizeWhitespace(match[1])
    const title = stripTags(match[2])

    if (!jobId || !title) continue
    roles.set(jobId, title)
  }

  return roles
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Careers at WeMakeScholars\s*<\/title>/i.test(page)
    && /<link[^>]+href="https:\/\/www\.wemakescholars\.com\/hiring"[^>]+rel="canonical"/i.test(page)
    && /Want to work with us\?Apply for the various positions at WeMakeScholars here\./i.test(page)
    && /Positions open/i.test(text)
    && /id=["']application-form["']/i.test(page)
    && /id=["']hiring-position["']/i.test(page)
}

export const extractRoleCards = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('WeMakeScholars hiring page no longer matches the verified official public hiring surface')
  }

  const page = String(html ?? '')
  const categories = [...page.matchAll(/<h4[^>]*class="[^"]*\bcategory\b[^"]*"[^>]*>([\s\S]*?)<\/h4>/gi)]
    .map((match) => ({
      index: match.index ?? 0,
      name: stripTags(match[1]),
    }))
    .filter((item) => item.name)
  const roleOptions = extractRoleOptions(page)
  const jobs = []

  const cardPattern = /<div class="row position panel" id=['"]hiring(\d+)['"]>([\s\S]*?)(?=<div class="row position panel" id=['"]hiring\d+['"]>|<h4[^>]*class="[^"]*\bcategory\b[^"]*"[^>]*>|<\/main>|<div class="col-md-12 col-sm-12 col-xs-12 bgfff">|$)/gi

  for (const match of page.matchAll(cardPattern)) {
    const jobId = normalizeWhitespace(match[1])
    const chunk = String(match[2] ?? '')
    const marker = `position-description-hide-${jobId}`
    const markerIndex = chunk.indexOf(marker)
    const summaryHtml = markerIndex === -1 ? chunk : chunk.slice(0, markerIndex)
    const descriptionHtml = markerIndex === -1 ? '' : chunk.slice(markerIndex)
    const title = normalizeWhitespace(
      summaryHtml.match(/<div[^>]*class="position-title"[^>]*>([\s\S]*?)<\/div>/i)?.[1],
    )
    const optionTitle = roleOptions.get(jobId)
    const spans = [...summaryHtml.matchAll(/<span[^>]*>([\s\S]*?)<\/span>/gi)]
      .map((spanMatch) => stripTags(spanMatch[1]))
      .filter(Boolean)
    const [rawLocation, salary, employmentType] = spans
    const department = findCategoryForIndex(categories, match.index ?? 0)
    const location = normalizeLocation(rawLocation)
    const description = stripTags(
      descriptionHtml.match(/<div[^>]*class="job-overview"[^>]*>([\s\S]*?)<\/div>/i)?.[1]
      || descriptionHtml,
    )

    if (!jobId || !title || !department || !location || !employmentType || !optionTitle) continue
    if (optionTitle !== title) continue

    jobs.push({
      jobId,
      requisitionId: jobId,
      title,
      company: COMPANY,
      department,
      location,
      city: deriveCity(location),
      country: 'India',
      sourceUrl: buildSourceUrl(jobId),
      applyUrl: buildApplyUrl(jobId),
      employmentType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: description,
      remoteStatus: deriveRemoteStatus(employmentType),
      salary: normalizeWhitespace(salary),
    })
  }

  if (jobs.length === 0) {
    throw new Error('WeMakeScholars official public role cards changed or disappeared')
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createWeMakeScholarsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)

    return extractRoleCards(html).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createWeMakeScholarsScraper().run(options)

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
