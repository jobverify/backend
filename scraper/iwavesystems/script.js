import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { runIWaveNativeDiscovery } from './nativeDiscovery.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'iwavesystems'
export const COMPANY = 'iWave Systems'
export const HOMEPAGE_URL = 'https://www.iwavesystems.com/'
export const CAREERS_URL = 'https://www.iwavesystems.com/career/'
export const APPLICATION_EMAIL = 'career@iwavesystems.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\u2019/g, "'")

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article)\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toTextLines = (html) => decodeHtml(String(html ?? ''))
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article)\b[^>]*>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split(/\r?\n/)
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const createManualFetchSignal = () =>
  typeof AbortSignal?.timeout === 'function'
    ? AbortSignal.timeout(15000)
    : undefined

const findErrorInChain = (error, predicate) => {
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    if (predicate(current)) {
      return current
    }
    current = current?.cause
  }

  return null
}

const hasHttpStatus = (error, status) =>
  Boolean(findErrorInChain(error, (candidate) => Number(candidate?.status) === status))

const fetchTextWithCapturedHttpBody = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'manual',
    signal: createManualFetchSignal(),
  })
  const html = await response.text()

  if (response.ok) {
    return html
  }

  const error = new Error(`HTTP ${response.status} for ${url}`)
  error.status = response.status
  error.responseBody = html
  throw error
}

const absoluteUrl = (value, base = CAREERS_URL) => {
  if (!value) return null
  try {
    return new URL(value, base).href
  } catch {
    return null
  }
}

const isGenericLine = (line) => /^(?:Career|Careers|Keywords|Apply Now|View less|View more|Contact Us|Locations|Partners|Support|Newsletter)$/i.test(line)
  || /^Posted\s+/i.test(line)
  || /^iWave Systems is a technology-oriented organization/i.test(line)
  || /^If you believe you have the right talent/i.test(line)
  || /^iWave is an embedded systems engineering/i.test(line)
  || /^mktg@iwave-global\.com$/i.test(line)

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*System on Modules - Single Board Computers - iWave Systems\s*<\/title>/i.test(page)
    && /href=["'](?:https?:\/\/www\.iwavesystems\.com)?\/career\/["']/i.test(page)
    && /iWave Systems/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Career - iWave Systems\s*<\/title>/i.test(page)
    && /iWave Systems/i.test(page)
    && /career@iwavesystems\.com/i.test(page)
    && /Keywords/i.test(page)
}

export const hasBlockedHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  return /<title>\s*You are being redirected\.\.\.\s*<\/title>/i.test(page)
    && /Javascript is required\./i.test(page)
    && /sucuri_cloudproxy_js/i.test(page)
}

const hasVerifiedBlockedHomepageError = (error) =>
  Boolean(
    findErrorInChain(
      error,
      (candidate) =>
        Number(candidate?.status) === 307
        && hasBlockedHomepageSignal(candidate?.responseBody),
    ),
  )

const hasVerifiedBlockedCareersError = (error) =>
  Boolean(
    findErrorInChain(
      error,
      (candidate) =>
        Number(candidate?.status) === 307
        && hasBlockedHomepageSignal(candidate?.responseBody),
    ),
  )

const extractApplyUrl = (html) => {
  const page = String(html ?? '')
  return page.match(/href=["'](mailto:[^"']+)["']/i)?.[1]
    || (page.includes('career@iwavesystems.com') ? `mailto:${APPLICATION_EMAIL}` : null)
}

const parseLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
    }
  }

  const city = normalizeCity(normalized.split(',')[0]?.trim() || null)
  return {
    location: normalized,
    city,
  }
}

const extractField = (text, pattern) => normalizeWhitespace(text.match(pattern)?.[1]) || null

const buildJobDescription = (lines) => normalizeWhitespace(lines.join(' '))

const parseJobBlock = (html, blockLines) => {
  const title = stripTags(blockLines[0])
  const text = normalizeWhitespace(blockLines.join(' '))
  const applyUrl = extractApplyUrl(html)
  const locationText = extractField(text, /(?:Work Location|Location)\s*:\s*([^]+?)(?=\s+Educational Qualification\s*:|\s+Experience\s*:|$)/i)
  const minimumQualification = extractField(text, /Educational Qualification\s*:\s*([^]+?)(?=\s+Experience\s*:|$)/i)
  const experienceRequired = extractField(text, /Experience\s*:\s*([^]+?)(?=\s+View less|$)/i)
  const postingDate = extractField(text, /Posted\s+([^]+?)(?=\s+We are looking\b|$)/i)
  const { location, city } = parseLocation(locationText)
  const jobId = `${SOURCE}-${slugify(title)}`

  if (!title || !locationText || !minimumQualification || !experienceRequired || !applyUrl) {
    throw new Error('Expected verified iWave Systems careers surface with first-party public listings')
  }

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city,
    country: null,
    jobId,
    requisitionId: jobId,
    sourceUrl: `${CAREERS_URL}#${slugify(title)}`,
    applyUrl,
    employmentType: null,
    experienceRequired,
    minimumQualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate,
    closingDate: null,
    jobDescription: buildJobDescription(
      blockLines.filter((line, index) => index > 0 && !/^Apply Now$/i.test(line) && !/^View less$/i.test(line)),
    ),
  }
}

export const extractPublicListings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Expected verified iWave Systems careers surface with public listings')
  }

  const lines = toTextLines(html)
  const startIndex = lines.findIndex((line) => line === 'Keywords')
  if (startIndex < 0) {
    throw new Error('Expected verified iWave Systems careers surface with public listings')
  }

  const jobs = []

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const title = lines[index]
    const nextLine = lines[index + 1]

    if (!title || isGenericLine(title) || nextLine !== 'Apply Now') {
      continue
    }

    const blockLines = [title]
    let cursor = index + 1

    while (cursor < lines.length) {
      const line = lines[cursor]
      if (cursor > index + 1 && !isGenericLine(line) && lines[cursor + 1] === 'Apply Now') {
        break
      }
      blockLines.push(line)
      cursor += 1
      if (line === 'View less') {
        break
      }
    }

    jobs.push(parseJobBlock(String(html ?? ''), blockLines))
    index = cursor - 1
  }

  if (jobs.length === 0) {
    throw new Error('Expected verified iWave Systems careers surface with public listings')
  }

  return jobs
}

const defaultFetchText = async (url) => {
  try {
    return await fetchTextWithRetry(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      label: SOURCE,
      timeoutMs: 15000,
    })
  } catch (error) {
    if (!hasHttpStatus(error, 307)) {
      throw error
    }

    return fetchTextWithCapturedHttpBody(url)
  }
}

const createLegacyIWaveSystemsParser = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    let homepageHtml = null
    try {
      homepageHtml = await fetchText(HOMEPAGE_URL)
    } catch (error) {
      if (!hasVerifiedBlockedHomepageError(error)) {
        throw error
      }
    }

    if (
      homepageHtml != null
      && !hasOfficialHomepageSignal(homepageHtml)
      && !hasBlockedHomepageSignal(homepageHtml)
    ) {
      throw new Error('Expected verified iWave Systems homepage with first-party careers handoff')
    }

    let careersHtml = null
    try {
      careersHtml = await fetchText(CAREERS_URL)
    } catch (error) {
      if (hasVerifiedBlockedCareersError(error)) {
        return []
      }
      throw error
    }

    if (hasBlockedHomepageSignal(careersHtml)) {
      return []
    }

    return extractPublicListings(careersHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const createIWaveSystemsScraper = () => ({ run: runIWaveNativeDiscovery })
export const run = runIWaveNativeDiscovery

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  console.log(`Total iWave Systems jobs scraped: ${jobs.length}`)
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
