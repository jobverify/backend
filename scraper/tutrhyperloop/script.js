import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'tutrhyperloop'
export const COMPANY = 'Tutr Hyperloop'
export const HOMEPAGE_URL = 'https://tutr.tech/'
export const CAREERS_PAGE_URL = 'https://tutr.tech/career/'
export const CONTACT_US_URL = 'https://tutr.tech/contact-us/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const TLS_HOST_MISMATCH_PATTERN =
  /Hostname\/IP does not match certificate's altnames: Host:\s*tutr\.tech\./i
const TLS_INGRESS_PATTERN = /ingress-daribow\.ewp\.live/i

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&#8211;|&ndash;|\u2013/gi, '-')
  .replace(/&#8212;|&mdash;|\u2014/gi, '-')
  .replace(/&#8216;|&#8217;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&#8220;|&#8221;|&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/\r/g, '')
    .replace(/<(?:br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6]|\/a|\/span)\b[^>]*>/gi, '\n')
    .replace(/<(?:p|div|li|ul|ol|section|article|main|h[1-6]|a|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const escapeRegex = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'role'

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const collectErrorText = (error) => {
  const queue = [error]
  const seen = new Set()
  const fragments = []

  while (queue.length > 0) {
    const current = queue.shift()
    if (current == null) continue

    if (typeof current === 'object' || typeof current === 'function') {
      if (seen.has(current)) continue
      seen.add(current)
    }

    if (typeof current === 'string') {
      fragments.push(current)
      continue
    }

    if (current?.message) fragments.push(String(current.message))
    if (current?.stack) fragments.push(String(current.stack))
    if (current?.cause) queue.push(current.cause)
  }

  return fragments.join('\n')
}

export const isCurrentTlsMismatchError = (error) => {
  const errorText = collectErrorText(error)
  return TLS_HOST_MISMATCH_PATTERN.test(errorText) && TLS_INGRESS_PATTERN.test(errorText)
}

const fetchVerifiedPageOrTlsMismatch = async (url, fetchPage) => {
  try {
    return await fetchPage(url)
  } catch (error) {
    if (isCurrentTlsMismatchError(error)) {
      return { tlsMismatch: true, error }
    }
    throw error
  }
}

export const defaultFetchPage = async (url, {
  fetchImpl = fetch,
  timeoutMs = 15000,
} = {}) => {
  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(timeoutMs),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const extractFieldValue = (html, label) => {
  const pattern = new RegExp(
    `<strong\\b[^>]*>\\s*${escapeRegex(label)}\\s*:\\s*<\\/strong>\\s*([\\s\\S]*?)(?:<br\\b[^>]*\\/?>|<\\/p>)`,
    'i',
  )
  const match = pattern.exec(String(html ?? ''))
  return match ? stripTags(match[1]) : null
}

const extractListSection = (html, label) => {
  const pattern = new RegExp(
    `<h3\\b[^>]*>\\s*${escapeRegex(label)}\\s*<\\/h3>\\s*<ul\\b[^>]*>([\\s\\S]*?)<\\/ul>`,
    'i',
  )
  const match = pattern.exec(String(html ?? ''))
  if (!match) return []

  return [...match[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((item) => stripTags(item[1]))
    .filter(Boolean)
}

const normalizeApplyUrl = (href) => {
  const normalizedHref = normalizeWhitespace(href)
  if (!normalizedHref) return CONTACT_US_URL

  if (/^mailto:/i.test(normalizedHref)) {
    return normalizedHref
  }

  try {
    const url = new URL(normalizedHref, CAREERS_PAGE_URL)
    if (/\.ingress-daribow\.ewp\.live$/i.test(url.hostname)) {
      return CONTACT_US_URL
    }
    return url.toString()
  } catch {
    return CONTACT_US_URL
  }
}

const buildJobDescription = (modalBodyHtml, title) => {
  const withoutApply = String(modalBodyHtml ?? '').replace(/<h3\b[^>]*>\s*Apply Now\s*<\/h3>[\s\S]*$/i, '')
  const description = stripTags(withoutApply)

  return normalizeWhitespace(
    String(description ?? '')
      .replace(new RegExp(`^${escapeRegex(title)}\\s*`, 'i'), ''),
  )
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = stripTags(page) || ''

  return /<title>\s*TuTr Hyperloop\s*\|\s*Revolutionizing High-Speed Transportation\s*<\/title>/i.test(page)
    && normalized.includes('Revolutionizing High-Speed Transportation')
    && /href=["']https:\/\/tutr\.tech\/career\/["']/i.test(page)
}

export const hasOfficialCareersPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = stripTags(page) || ''

  return /<title>\s*Hyperloop Engineering Jobs\s*\|\s*Careers at TuTr Hyperloop\s*<\/title>/i.test(page)
    && normalized.includes('Open Positions')
    && normalized.includes('Build the Future of Mobility. With Us.')
    && normalized.includes('Senior Software Engineer')
    && /mailto:careers@tutr\.tech/i.test(page)
}

export const extractJobsFromCareersHtml = (html) => {
  const jobs = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(
    /<div id="premium-modal-[^"]+" class="premium-modal-box-modal"[\s\S]*?<h3 class="premium-modal-box-modal-title">\s*([\s\S]*?)\s*<\/h3>[\s\S]*?<div class="premium-modal-box-modal-body">\s*([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi,
  )) {
    const title = stripTags(match[1])
    const modalBodyHtml = match[2]
    const employmentType = extractFieldValue(modalBodyHtml, 'Job Type')
    const city = extractFieldValue(modalBodyHtml, 'Location')
    const location = city ? `${city}, India` : 'India'
    const applyHref =
      modalBodyHtml.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/i)?.[1]
      || 'mailto:careers@tutr.tech'
    const requiredSkills = extractListSection(modalBodyHtml, 'Required Skills')
    const preferredQualifications = extractListSection(modalBodyHtml, 'Preferred Qualifications')

    if (!title || !employmentType || !city) continue

    const dedupeKey = `${title}::${employmentType}::${city}`.toLowerCase()
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)

    jobs.push({
      title,
      company: COMPANY,
      location,
      city,
      country: 'India',
      jobId: `${SOURCE}-${slugify(`${title}-${city}`)}`,
      requisitionId: null,
      sourceUrl: CAREERS_PAGE_URL,
      applyUrl: normalizeApplyUrl(applyHref),
      employmentType,
      department: 'Engineering',
      postingDate: null,
      closingDate: null,
      requiredSkills,
      preferredQualification: preferredQualifications.join('; ') || null,
      jobDescription: buildJobDescription(modalBodyHtml, title),
    })
  }

  return jobs.sort((left, right) => left.title.localeCompare(right.title))
}

export const createTutrHyperloopScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchVerifiedPageOrTlsMismatch(HOMEPAGE_URL, fetchPage)
    if (homepage?.tlsMismatch) {
      const careersTlsMismatch = await fetchVerifiedPageOrTlsMismatch(CAREERS_PAGE_URL, fetchPage)
      if (careersTlsMismatch?.tlsMismatch) {
        return []
      }
      throw new Error('Tutr Hyperloop verified first-party site no longer loads consistently across the homepage and careers page')
    }

    if (Number(homepage?.status) !== 200 || !hasOfficialHomepageSignal(homepage?.html)) {
      throw new Error('Tutr Hyperloop verified homepage no longer matches the official first-party site')
    }

    const careersPage = await fetchVerifiedPageOrTlsMismatch(CAREERS_PAGE_URL, fetchPage)
    if (careersPage?.tlsMismatch) {
      throw new Error('Tutr Hyperloop verified first-party site no longer loads consistently across the homepage and careers page')
    }

    if (Number(careersPage?.status) !== 200 || !hasOfficialCareersPageSignal(careersPage?.html)) {
      throw new Error('Tutr Hyperloop verified careers page no longer matches the official first-party site')
    }

    const jobs = extractJobsFromCareersHtml(careersPage.html)
    if (jobs.length === 0) {
      throw new Error('Tutr Hyperloop verified careers page no longer exposes trusted public jobs')
    }

    return jobs
  },
})

export const run = async (options = {}) => createTutrHyperloopScraper().run(options)

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
