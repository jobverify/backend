import path from 'node:path'
import https from 'node:https'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

import {
  createBrowserNetworkFallback,
  defaultShouldUseBrowserNetworkFallback,
} from '../../scraper-support/shared/browserNetworkFallback.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'innspark'
export const COMPANY = 'Innspark'
export const CAREERS_URL = 'https://innspark.in/careers/'
export const APPLY_URL = 'https://innspark.in/apply/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const DEFAULT_TIMEOUT_MS = 15000
const PROTOCOL_PARSE_ERROR_PATTERN =
  /missing expected cr after header value|response does not match the HTTP\/1\.1 protocol|protocol(?:\s+parse)?\s+error/i

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/section|\/article|\/main)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|h[1-6]|ul|ol|section|article|main)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const stripExperienceSuffix = (value) => normalizeWhitespace(
  String(value ?? '').replace(/\s*\((?:\d+\s*-\s*\d+|\d+\+?)\s+years? of experience\)\s*$/i, ''),
)

const isProtocolParseError = (error) => {
  const combined = `${error?.message ?? error ?? ''} ${error?.cause?.message ?? ''}`
  return PROTOCOL_PARSE_ERROR_PATTERN.test(combined)
}

const buildBrokenHttpSurfaceError = (surfaceLabel, error) => {
  const upstreamError = new Error(
    `Innspark verified ${surfaceLabel} currently returns a broken HTTP/1.1 response`,
    { cause: error },
  )
  upstreamError.softFailure = true
  upstreamError.upstreamOutage = true
  upstreamError.failureKind = 'network_or_timeout'
  upstreamError.abortRetries = true
  return upstreamError
}

const buildJobDescription = (lines) => normalizeWhitespace(
  lines
    .join(' ')
    .replace(/\s+:\s+/g, ': ')
    .replace(/\s+:/g, ':'),
) || 'Apply via the Innspark careers page.'

const extractFieldValue = (lines, label) => {
  const matchingLine = lines.find((line) => new RegExp(`^${label}\\s*:`, 'i').test(line))
  if (!matchingLine) return null
  return normalizeWhitespace(matchingLine.replace(new RegExp(`^${label}\\s*:\\s*`, 'i'), ''))
}

const extractSummaryLines = (lines) => {
  const summary = []

  for (const line of lines) {
    if (/^(Key Responsibilities|Required Qualifications|Experience|Skills|Abilities|Responsibilities|Requirements|Preferred Skills|Preferred qualifications|Educational Background|Cultural Drivers|Notes)\s*:?$/i.test(line)) {
      break
    }

    summary.push(line)
  }

  return summary
}

const splitRoleHeading = (heading) => {
  const normalizedHeading = normalizeWhitespace(heading)
  if (!normalizedHeading) return []

  if (normalizedHeading.includes(' / ')) {
    const parts = []
    let current = ''
    let depth = 0

    for (let index = 0; index < normalizedHeading.length; index += 1) {
      const char = normalizedHeading[index]
      const nextChunk = normalizedHeading.slice(index, index + 3)

      if (char === '(') depth += 1
      if (char === ')' && depth > 0) depth -= 1

      if (depth === 0 && nextChunk === ' / ') {
        parts.push(current)
        current = ''
        index += 2
        continue
      }

      current += char
    }

    if (current) parts.push(current)

    if (parts.length > 1) {
      return parts
        .map((part) => stripExperienceSuffix(part))
        .filter(Boolean)
    }
  }

  return [stripExperienceSuffix(normalizedHeading)].filter(Boolean)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /Career\s*\|\s*Innspark/i.test(page)
    && normalized?.includes('Join the Team!')
    && normalized?.includes('Current Openings')
    && normalized?.includes('Apply here')
    && normalized?.includes('Innspark Solutions Private Limited')
}

export const hasOfficialApplySignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /Innspark Careers\s*\|\s*Apply/i.test(page)
    && normalized?.includes('Innspark Careers')
    && normalized?.includes('Desired Role or Function')
    && normalized?.includes('Embedded Systems Engineer (Drone / UAS development)')
}

export const extractApplyRoleOptions = (html) => {
  const options = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/<option[^>]*>([\s\S]*?)<\/option>/gi)) {
    const option = normalizeWhitespace(stripTags(match[1]))
    if (!option || seen.has(option)) continue
    seen.add(option)
    options.push(option)
  }

  return options
}

export const extractCareerJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Innspark verified official careers surface changed')
  }

  const sections = [...String(html ?? '').matchAll(/<h5[^>]*>([\s\S]*?)<\/h5>([\s\S]*?)(?=<h5[^>]*>|<h2[^>]*>\s*Apply here|<\/main>)/gi)]
  const jobs = []

  for (const [, rawHeading, rawBody] of sections) {
    const heading = stripTags(rawHeading)
    const bodyText = decodeHtml(rawBody)
      .replace(/\r/g, '')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/section|\/article|\/main)\b[^>]*>/gi, '\n')
      .replace(/<(p|div|li|h[1-6]|ul|ol|section|article|main)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/\n+/g, '\n')

    const lines = bodyText
      .split('\n')
      .map((line) => normalizeWhitespace(line))
      .filter(Boolean)

    const locationValue = extractFieldValue(lines, 'Location')
    const employmentType = extractFieldValue(lines, 'Employment Type')
    const experienceRequired = extractFieldValue(lines, 'Experience Level')
      || normalizeWhitespace(lines.find((line) => /^Experience Level\s*:/i.test(line)))
      || normalizeWhitespace(lines.find((line) => /^Experience:\s*/i.test(line))?.replace(/^Experience:\s*/i, ''))
    const roleTitles = splitRoleHeading(heading)
    const description = buildJobDescription(extractSummaryLines(lines))

    for (const roleTitle of roleTitles) {
      const slug = slugify(roleTitle)
      if (!slug) continue

      jobs.push({
        title: roleTitle,
        company: COMPANY,
        department: null,
        location: locationValue ? `${locationValue}, India` : 'India',
        city: locationValue || null,
        country: 'India',
        jobId: `${SOURCE}-${slug}`,
        requisitionId: `${SOURCE}-${slug}`,
        sourceUrl: CAREERS_URL,
        applyUrl: APPLY_URL,
        employmentType,
        experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: description,
      })
    }
  }

  if (jobs.length === 0) {
    throw new Error('Innspark careers page no longer exposes the expected public openings')
  }

  return jobs
}

export const assertApplyFormMatchesJobs = (jobs, applyHtml) => {
  if (!hasOfficialApplySignal(applyHtml)) {
    throw new Error('Innspark verified first-party apply form changed')
  }

  const options = new Set(extractApplyRoleOptions(applyHtml))
  const missingTitles = jobs
    .map((job) => job.title)
    .filter((title) => !options.has(title))

  if (missingTitles.length > 0) {
    throw new Error(`Innspark first-party apply form no longer matches careers jobs: ${missingTitles.join(', ')}`)
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: DEFAULT_TIMEOUT_MS,
})

const buildRequestHeaders = () => ({
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
})

const readResponseStream = async (stream) => {
  const chunks = []

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks).toString('utf8')
}

const createDecodedResponseStream = (response) => {
  const encoding = String(response.headers?.['content-encoding'] ?? '').toLowerCase()

  if (encoding.includes('gzip')) {
    return response.pipe(zlib.createGunzip())
  }

  if (encoding.includes('deflate')) {
    return response.pipe(zlib.createInflate())
  }

  if (encoding.includes('br')) {
    return response.pipe(zlib.createBrotliDecompress())
  }

  return response
}

const fetchTextWithInsecureHttpParser = (url, {
  headers = buildRequestHeaders(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxRedirects = 5,
} = {}) => new Promise((resolve, reject) => {
  const request = https.get(url, {
    headers,
    insecureHTTPParser: true,
  }, async (response) => {
    const statusCode = Number(response.statusCode) || 0

    if (statusCode >= 300 && statusCode < 400 && response.headers?.location) {
      response.resume()

      if (maxRedirects <= 0) {
        reject(new Error(`Too many redirects for ${url}`))
        return
      }

      try {
        const redirectUrl = new URL(response.headers.location, url).toString()
        resolve(await fetchTextWithInsecureHttpParser(redirectUrl, {
          headers,
          timeoutMs,
          maxRedirects: maxRedirects - 1,
        }))
      } catch (error) {
        reject(error)
      }

      return
    }

    try {
      const decodedStream = createDecodedResponseStream(response)
      const body = await readResponseStream(decodedStream)

      if (statusCode < 200 || statusCode >= 300) {
        reject(new Error(`HTTP ${statusCode} for ${url}`))
        return
      }

      resolve(body)
    } catch (error) {
      reject(error)
    }
  })

  request.setTimeout(timeoutMs, () => {
    request.destroy(new Error(`Request timed out after ${timeoutMs}ms for ${url}`))
  })

  request.on('error', reject)
})

export const createInnsparkScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchBrowserText,
    fetchProtocolTolerantText = (url) => fetchTextWithInsecureHttpParser(url),
  } = {}) {
    const browserFallback = createBrowserNetworkFallback({
      fetchText,
      fetchBrowserText,
      userAgent: USER_AGENT,
      shouldUseBrowserFallback: (error) =>
        defaultShouldUseBrowserNetworkFallback(error),
      browserSessionOptions: {
        timeoutMs: 90000,
        settleTimeMs: 4000,
        ignoreHTTPSErrors: false,
      },
    })

    const loadVerifiedPageText = async (url, surfaceLabel) => {
      try {
        return await fetchText(url)
      } catch (error) {
        if (isProtocolParseError(error)) {
          try {
            return await fetchProtocolTolerantText(url)
          } catch (fallbackError) {
            if (isProtocolParseError(fallbackError)) {
              throw buildBrokenHttpSurfaceError(surfaceLabel, fallbackError)
            }
            throw fallbackError
          }
        }

        if (!defaultShouldUseBrowserNetworkFallback(error)) {
          throw error
        }

        return browserFallback.fetchTextInBrowser(url)
      }
    }

    try {
      const careersHtml = await loadVerifiedPageText(CAREERS_URL, 'careers page')
      const jobs = extractCareerJobs(careersHtml)

      const applyHtml = await loadVerifiedPageText(APPLY_URL, 'apply form')
      assertApplyFormMatchesJobs(jobs, applyHtml)

      return jobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
        publicExperienceChecked: true,
      }))
    } finally {
      await browserFallback.close()
    }
  },
})

export const run = async (options = {}) => createInnsparkScraper().run(options)

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
