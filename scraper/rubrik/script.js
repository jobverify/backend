import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'rubrik'
export const COMPANY = 'Rubrik'
export const CAREERS_URL = 'https://www.rubrik.com/company/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const DEFAULT_FETCH_TIMEOUT_MS = 15000
const DEPARTMENT_PAGE_CONCURRENCY = 4
const JOB_DETAIL_PAGE_CONCURRENCY = 8

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/\u2019/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const extractTextLines = (html) => String(html ?? '')
  .replace(/\r/g, '')
  .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article|\/main|\/ul|\/ol|\/table|\/tr)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u2019/g, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

export const hasOfficialCareersSignal = (html = '') => {
  const title = normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? null)
  const description = normalizeWhitespace(
    String(html ?? '').match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)?.[1] ?? null,
  )
  const text = normalizeWhitespace(html) || ''

  return /careers at rubrik\s*\|\s*discover the power of you/i.test(title || '')
    && /explore cybersecurity and ai careers at rubrik\./i.test(description || '')
    && /view openings/i.test(text)
}

export const getSafeRubrikUrl = (value) => {
  try {
    const url = new URL(value, CAREERS_URL)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return url.hostname === new URL(CAREERS_URL).hostname ? url.href : null
  } catch {
    return null
  }
}

const humanizeDepartmentSlug = (slug) =>
  normalizeWhitespace(
    slug?.split('-').map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' '),
  )

export const extractDepartmentLinks = (html = '') => {
  const links = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']*\/company\/careers\/departments\/(?!job)[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = getSafeRubrikUrl(match[1])
    const rawName = normalizeWhitespace(match[2])
    const slug = normalizeWhitespace(url?.match(/\/company\/careers\/departments\/([^/?#]+)/i)?.[1]?.replace(/\.\d+$/, '') ?? null)
    const name = rawName && !/^view openings$/i.test(rawName)
      ? rawName
      : humanizeDepartmentSlug(slug)

    if (!url || !name || seen.has(url)) continue

    seen.add(url)
    links.push({ name, url })
  }

  return links
}

export const extractJobLinks = (html = '') => {
  const links = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']*\/company\/careers\/departments\/job[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = getSafeRubrikUrl(match[1])
    const title = normalizeWhitespace(match[2])
    if (!url || !title || seen.has(url)) continue
    seen.add(url)
    links.push({ title, url })
  }

  return links
}

const extractJobId = (link) => {
  try {
    const url = new URL(link)
    const reqId = normalizeWhitespace(url.searchParams.get('reqId'))
    if (reqId) return reqId

    const jobToken = url.pathname.match(/\/job\.([^/?#]+)/i)?.[1]
    return normalizeWhitespace(jobToken)
  } catch {
    return null
  }
}

const isIndiaLocation = (location) => /\bindia\b/i.test(location || '')

const resolvePositiveInteger = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

const throwIfAborted = (signal) => {
  if (!signal?.aborted) return
  throw signal.reason || new DOMException('The operation was aborted', 'AbortError')
}

const mapWithConcurrency = async (items, limit, iteratee) => {
  const concurrency = Math.max(1, Number.isInteger(limit) ? limit : 1)
  const results = new Array(items.length)
  let cursor = 0

  const worker = async () => {
    while (cursor < items.length) {
      const currentIndex = cursor
      cursor += 1
      results[currentIndex] = await iteratee(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )

  return results
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/remote/i.test(normalized)) return 'Remote'

  const city = normalized
    .replace(/\bOffice\b/gi, '')
    .replace(/\bIndia\b/gi, '')
    .replace(/[,:-]+$/g, '')
    .split(',')[0]
    .trim()

  return city || normalized
}

const extractSectionLines = (lines, startPatterns, endPatterns) => {
  const startIndex = lines.findIndex((line) => startPatterns.some((pattern) => pattern.test(line)))
  if (startIndex === -1) return []

  const sectionLines = []
  for (const line of lines.slice(startIndex + 1)) {
    if (endPatterns.some((pattern) => pattern.test(line))) break
    sectionLines.push(line)
  }

  return sectionLines
}

const RUBRIK_DESCRIPTION_END_PATTERNS = [
  /^required skills/i,
  /^experience & qualifications/i,
  /^experience you'll need[:\s]*$/i,
  /^why join us\??$/i,
  /^apply for this job$/i,
  /^join us$/i,
  /^eeo is the law$/i,
]

const RUBRIK_SKILLS_START_PATTERNS = [
  /^required skills/i,
  /^experience & qualifications you'll need$/i,
  /^experience you'll need[:\s]*$/i,
]

const RUBRIK_SKILLS_END_PATTERNS = [
  /^why join us\??$/i,
  /^apply for this job$/i,
  /^join us$/i,
  /^eeo is the law$/i,
]

export const extractJobFromHtml = ({
  html,
  department,
  jobUrl,
  now = () => new Date().toISOString(),
} = {}) => {
  const lines = extractTextLines(html)
  const summaryIndex = lines.findIndex((line) => /^job summary$/i.test(line))
  const headingTitle = [...String(html ?? '').matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .find((heading) => heading && !/^job summary$/i.test(heading))
  const title = normalizeWhitespace(
    headingTitle || (summaryIndex >= 0
      ? lines.slice(summaryIndex + 1).find((line) => !/^location\b/i.test(line) && !/^about\b/i.test(line))
      : lines.find((line) => !/^careers\s*@\s*rubrik/i.test(line))),
  )
  const locationLine = lines.find((line) => /^location[:\s]/i.test(line) || /\bindia\b/i.test(line))
  const location = normalizeWhitespace(locationLine?.replace(/^location[:\s]*/i, ''))

  if (!title || !location) return null

  const descriptionLines = extractSectionLines(
    lines,
    [/^about the role$/i, /^about role$/i, /^about the team$/i, /^about rubrik$/i],
    RUBRIK_DESCRIPTION_END_PATTERNS,
  )
  const narrativeLines = descriptionLines.length > 0
    ? descriptionLines
    : (() => {
        const locationIndex = lines.findIndex((line) => line === locationLine)
        if (locationIndex === -1) return []

        const collectedLines = []
        for (const line of lines.slice(locationIndex + 1)) {
          if (/^location[:\s]/i.test(line)) continue
          if (RUBRIK_DESCRIPTION_END_PATTERNS.some((pattern) => pattern.test(line))) break
          collectedLines.push(line)
        }

        return collectedLines
      })()
  const skillsLines = extractSectionLines(
    lines,
    RUBRIK_SKILLS_START_PATTERNS,
    RUBRIK_SKILLS_END_PATTERNS,
  )
  const fullText = lines.join(' ')
  const experienceRequired = normalizeWhitespace(fullText.match(/\b(\d+\+?(?:\s*-\s*\d+)?)\s+years?\b/i)?.[0] ?? null)

  return {
    jobId: extractJobId(jobUrl),
    title,
    company: COMPANY,
    department: normalizeWhitespace(department),
    location,
    city: extractCity(location),
    country: 'India',
    sourceUrl: jobUrl,
    applyUrl: jobUrl,
    employmentType: null,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: skillsLines.filter(Boolean),
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace(narrativeLines.join('\n')),
    remoteStatus: /remote/i.test(location) ? 'Remote' : 'On-site',
    source: SOURCE,
    link: jobUrl,
    scrapedAt: now(),
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  },
  label: SOURCE,
  signal,
  timeoutMs: config.fetchTimeoutMs || DEFAULT_FETCH_TIMEOUT_MS,
})

export const createRubrikScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
  departmentPageConcurrency = resolvePositiveInteger(
    config.departmentPageConcurrency,
    DEPARTMENT_PAGE_CONCURRENCY,
  ),
  jobDetailPageConcurrency = resolvePositiveInteger(
    config.jobDetailPageConcurrency,
    JOB_DETAIL_PAGE_CONCURRENCY,
  ),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
    signal = undefined,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL, { signal })

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Rubrik careers page no longer matches the verified official public surface')
    }

    const departments = extractDepartmentLinks(careersHtml)
    if (departments.length === 0) {
      throw new Error('Rubrik official careers page no longer exposes department links for browser-free scraping')
    }

    const departmentPages = await mapWithConcurrency(
      departments,
      resolvePositiveInteger(departmentPageConcurrency, DEPARTMENT_PAGE_CONCURRENCY),
      async (department) => {
        throwIfAborted(signal)
        const departmentHtml = await fetchText(department.url, { signal })
        return {
          department,
          jobLinks: extractJobLinks(departmentHtml),
        }
      },
    )

    const jobRequests = []
    const seenJobUrls = new Set()

    for (const { department, jobLinks } of departmentPages) {
      for (const jobLink of jobLinks || []) {
        if (seenJobUrls.has(jobLink.url)) continue
        seenJobUrls.add(jobLink.url)
        jobRequests.push({ department, jobLink })
      }
    }

    const parsedJobs = await mapWithConcurrency(
      jobRequests,
      resolvePositiveInteger(jobDetailPageConcurrency, JOB_DETAIL_PAGE_CONCURRENCY),
      async ({ department, jobLink }) => {
        throwIfAborted(signal)
        const jobHtml = await fetchText(jobLink.url, { signal })
        const job = extractJobFromHtml({
          html: jobHtml,
          department: department.name,
          jobUrl: jobLink.url,
          now,
        })

        return job && isIndiaLocation(job.location) ? job : null
      },
    )

    const jobs = parsedJobs.filter(Boolean)

    return Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs
  },
})

export const run = async (options = {}) => createRubrikScraper(options).run(options)

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
