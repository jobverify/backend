import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const CAREER_PAGE_URL = 'https://exa-ag.com/career/jobs/'

const SOURCE = 'exaag'
const COMPANY = 'EXA AG'
const LOCATION = 'Bangalore, India'
const CITY = 'Bangalore'
const COUNTRY = 'India'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()
const INNER_HEADING_PATTERN = '(?:(?!<\\/h[1-6]>)[\\s\\S])*?'
const BANGALORE_HEADING_PATTERN = new RegExp(
  `<h[1-6][^>]*>${INNER_HEADING_PATTERN}Bangalore${INNER_HEADING_PATTERN}India${INNER_HEADING_PATTERN}<\\/h[1-6]>`,
  'i',
)
const REMOTE_AMERICAS_HEADING_PATTERN = new RegExp(
  `<h[1-6][^>]*>${INNER_HEADING_PATTERN}Remote${INNER_HEADING_PATTERN}Americas${INNER_HEADING_PATTERN}<\\/h[1-6]>`,
  'i',
)
const LEGACY_BANGALORE_SECTION_PATTERN =
  /<h[1-6][^>]*>\s*Bangalore\s*<\/h[1-6]>\s*<p[^>]*>\s*India\s*<\/p>/i

const SECTION_END_PATTERNS = [
  /<h[1-6][^>]*>\s*West Chester\s*<\/h[1-6]>/i,
  /<p[^>]*>\s*USA\s*<\/p>/i,
  REMOTE_AMERICAS_HEADING_PATTERN,
  />\s*Contact EXA Experts\s*</i,
  />\s*back to top\s*</i,
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&ndash;|&#8211;/gi, '-')
  .replace(/&mdash;|&#8212;/gi, '-')
  .replace(/\u00a0/g, ' ')

const stripHtml = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? '').replace(/<[^>]+>/g, ' ')),
)

const slugify = (value) => normalizeWhitespace(decodeHtmlEntities(value))
  .normalize('NFKD')
  .replace(/[^\w\s-]/g, '')
  .toLowerCase()
  .replace(/[\s_-]+/g, '-')
  .replace(/^-+|-+$/g, '')

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value).toLowerCase().replace(/,\s*$/g, '').trim()

  if (!normalized) return null
  if (/^[a-z]+\s+\d{4}$/i.test(normalized)) return null
  if (normalized === 'fulltime' || normalized === 'full time') return 'Full-time'
  if (normalized === 'parttime' || normalized === 'part time') return 'Part-time'
  if (
    normalized === 'full time/ part time'
    || normalized === 'fulltime/ parttime'
    || normalized === 'full time / part time'
  ) {
    return 'Full-time / Part-time'
  }

  return null
}

const normalizeRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value).toLowerCase().replace(/,\s*$/g, '').trim()

  if (!normalized) return null
  if (normalized === 'hybrid') return 'Hybrid'
  if (normalized === 'remote') return 'Remote'
  if (normalized === 'onsite' || normalized === 'on-site') return 'On-site'

  return null
}

const toTextLines = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(p|div|section|article|ul|ol|li|h1|h2|h3|h4|h5|h6|a)>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const findSectionEndIndex = (html, startIndex) => {
  const indices = SECTION_END_PATTERNS
    .map((pattern) => {
      const matchIndex = String(html).slice(startIndex).search(pattern)
      return matchIndex >= 0 ? startIndex + matchIndex : -1
    })
    .filter((index) => index >= 0)

  return indices.length ? Math.min(...indices) : String(html).length
}

const extractIndiaSectionHtml = (html) => {
  const page = String(html ?? '')
  const positionsIndex = page.search(/>\s*Open Positions\s*</i)

  if (positionsIndex < 0) {
    throw new Error('EXA AG jobs archive shape changed: missing Open Positions section')
  }

  const bangaloreMatch = page.slice(positionsIndex).match(BANGALORE_HEADING_PATTERN)
    || page.slice(positionsIndex).match(LEGACY_BANGALORE_SECTION_PATTERN)

  if (!bangaloreMatch || typeof bangaloreMatch.index !== 'number') {
    throw new Error('EXA AG jobs archive shape changed: missing Bangalore section')
  }

  const startIndex = positionsIndex + bangaloreMatch.index
  const endIndex = findSectionEndIndex(page, startIndex)
  return page.slice(startIndex, endIndex)
}

const extractDetailUrls = (sectionHtml) => [...String(sectionHtml ?? '').matchAll(
  /href=["']([^"']*\/career\/jobs\/[^"']+)["'][^>]*>\s*Details\s*<\/a>/gi,
)]
  .map((match) => {
    const rawUrl = normalizeWhitespace(match[1])
    return rawUrl.startsWith('http') ? rawUrl : new URL(rawUrl, CAREER_PAGE_URL).href
  })

const isMetaLine = (line) => {
  const normalized = normalizeWhitespace(line).toLowerCase().replace(/,\s*$/g, '')
  return normalized.endsWith('2026')
    || normalized.endsWith('2025')
    || normalized === 'fulltime'
    || normalized === 'full time'
    || normalized === 'parttime'
    || normalized === 'part time'
    || normalized === 'full time/ part time'
    || normalized === 'fulltime/ parttime'
    || normalized === 'hybrid'
    || normalized === 'remote'
    || normalized === 'onsite'
    || normalized === 'on-site'
}

export const hasOfficialExaAgJobsPageShape = (html) => {
  const page = String(html ?? '')
  const text = toTextLines(page).join('\n')

  return /<title>\s*Jobs Archive\s*-\s*EXA AG\s*<\/title>/i.test(page)
    && /Join EXA AG/i.test(text)
    && /Open Positions/i.test(text)
    && (
      BANGALORE_HEADING_PATTERN.test(page)
      || LEGACY_BANGALORE_SECTION_PATTERN.test(page)
      || /\bBangalore\b[\s\S]{0,40}\bIndia\b/i.test(text)
    )
}

export const isTemporaryExaAgJobsArchiveError = (error) => {
  const message = String(error?.message ?? error ?? '')

  return message.includes(CAREER_PAGE_URL)
    && /HTTP 50[0-4]\b/i.test(message)
}

export const extractIndiaJobs = (html) => {
  if (!hasOfficialExaAgJobsPageShape(html)) {
    throw new Error('EXA AG jobs archive shape changed; refusing to scrape unverified content')
  }

  const indiaSectionHtml = extractIndiaSectionHtml(html)
  const detailUrls = extractDetailUrls(indiaSectionHtml)
  const lines = toTextLines(indiaSectionHtml)
  const bangaloreIndex = lines.findIndex((line) => (
    /^Bangalore(?:\s+|,\s*)India$/i.test(line)
    || /^Bangalore$/i.test(line)
  ))
  const firstJobIndex = bangaloreIndex >= 0
    ? (() => {
      const nextIndex = bangaloreIndex + 1
      return /^India$/i.test(lines[nextIndex] || '') ? nextIndex + 1 : nextIndex
    })()
    : -1

  if (bangaloreIndex < 0 || firstJobIndex < 0) {
    throw new Error('EXA AG jobs archive shape changed: Bangalore section could not be parsed')
  }

  const jobs = []
  let detailIndex = 0

  for (let index = firstJobIndex; index < lines.length; index += 1) {
    const line = lines[index]

    if (/^(West Chester|USA|back to top)$/i.test(line)) break
    if (line === 'Details') continue
    if (isMetaLine(line)) continue

    const title = stripHtml(line)
    const metaLines = []
    let cursor = index + 1

    while (cursor < lines.length && lines[cursor] !== 'Details') {
      if (/^(West Chester|USA|back to top)$/i.test(lines[cursor])) {
        throw new Error(`EXA AG jobs archive shape changed near ${title}`)
      }

      metaLines.push(lines[cursor])
      cursor += 1
    }

    if (lines[cursor] !== 'Details') {
      throw new Error(`EXA AG jobs archive shape changed near ${title}`)
    }

    const detailUrl = detailUrls[detailIndex]
    if (!detailUrl) {
      throw new Error(`EXA AG jobs archive shape changed: missing detail URL for ${title}`)
    }

    const employmentType = metaLines
      .map(normalizeEmploymentType)
      .find(Boolean) || null

    const remoteStatus = metaLines
      .map(normalizeRemoteStatus)
      .find(Boolean) || null

    const jobId = slugify(detailUrl.split('/').filter(Boolean).at(-1) || title)

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: LOCATION,
      city: CITY,
      country: COUNTRY,
      jobId,
      requisitionId: jobId,
      sourceUrl: detailUrl,
      applyUrl: detailUrl,
      employmentType,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus,
    })

    detailIndex += 1
    index = cursor
  }

  if (jobs.length === 0) {
    throw new Error('EXA AG jobs archive shape changed: no Bangalore jobs were extracted')
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

export const createExaAgScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    let html
    try {
      html = await fetchText(CAREER_PAGE_URL)
    } catch (error) {
      if (isTemporaryExaAgJobsArchiveError(error)) {
        return []
      }

      throw error
    }
    const jobs = extractIndiaJobs(html)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createExaAgScraper().run()
