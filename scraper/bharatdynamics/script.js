import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { BHARAT_DYNAMICS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BHARAT_DYNAMICS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const RECRUITMENTS_URL = PROVIDER_METADATA.companyCareerPage
export const NCS_URL = PROVIDER_METADATA.externalVacancyPortalUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const MONTHS = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
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
  String(value ?? '')
    .replace(/<(?:br|\/p|\/div|\/li|\/td|\/tr|\/table|\/tbody|\/main|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    return new URL(value, RECRUITMENTS_URL).toString()
  } catch {
    return null
  }
}

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const parseIssueDate = (value) => {
  const match = normalizeWhitespace(value)?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null

  const [, day, month, year] = match
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString()
}

const resolveNowIso = (now = () => new Date().toISOString()) => {
  const value = typeof now === 'function' ? now() : now
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

const extractFirstAnchor = (html) => {
  const match = String(html ?? '').match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i)
  if (!match) return null

  return {
    url: toAbsoluteUrl(match[1]),
    text: stripTags(match[2]),
  }
}

const toIsoDateOnly = (year, month, day) => `${year}-${month}-${String(day).padStart(2, '0')}`

const extractEventDeadline = (title) => {
  const normalized = normalizeWhitespace(title) || ''

  const multiDay = normalized.match(
    /\bon\s+\d{1,2}(?:st|nd|rd|th)?\s*&\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})\b/i,
  )
  if (multiDay) {
    const [, day, monthName, year] = multiDay
    const month = MONTHS[monthName.toLowerCase()]
    return month ? toIsoDateOnly(year, month, day) : null
  }

  const singleDay = normalized.match(
    /\bon\s+(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})\b/i,
  )
  if (!singleDay) return null

  const [, day, monthName, year] = singleDay
  const month = MONTHS[monthName.toLowerCase()]
  return month ? toIsoDateOnly(year, month, day) : null
}

const isRecruitmentNoticeTitle = (title) => /\b(recruitment|advertisement|notification|walk-?in interview)\b/i.test(title)

const isArchivalNoticeTitle = (title) => /\b(selected|selection|selected candidate|provisionally selected|shortlisted|interview schedule|syllabus|corrigendum|addendum|list of candidates|result)\b/i.test(title)

const getEmploymentType = (title) => {
  if (/contract|walk-?in interview|project engineer/i.test(title)) return 'Contract'
  if (/management trainee|trainee engineer|trainee officer|trainee assistant/i.test(title)) return 'Full-time'
  return null
}

const isRecentIssueDate = (issueDateIso, nowIso, maxAgeDays = 45) => {
  if (!issueDateIso) return false

  const issueMs = Date.parse(issueDateIso)
  const nowMs = Date.parse(nowIso)
  if (Number.isNaN(issueMs) || Number.isNaN(nowMs) || issueMs > nowMs) return false

  const ageDays = (nowMs - issueMs) / (24 * 60 * 60 * 1000)
  return ageDays <= maxAgeDays
}

export const buildRecruitmentsPageUrl = (pageNumber = 1) => (
  Number(pageNumber) <= 1
    ? RECRUITMENTS_URL
    : `${RECRUITMENTS_URL}?page=${Number(pageNumber) - 1}`
)

export const extractRecruitmentUrl = (html) => {
  const match = String(html ?? '').match(/<a\b[^>]*href=["'](\/recruitments)["'][^>]*>\s*Recruitment\s*<\/a>/i)
  return match ? toAbsoluteUrl(match[1]) : null
}

export const extractNcsUrl = (html) => {
  const match = String(html ?? '').match(/<a\b[^>]*href=["'](https:\/\/www\.ncs\.gov\.in\/)["'][^>]*>\s*Click here for vacancies on National Career Service \(NCS\) Portal\s*<\/a>/i)
  return match ? match[1] : null
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const title = normalizeWhitespace(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const text = stripTags(page) || ''

  return title === 'Home | Official Website of Bharat Dynamics Limited (BDL) under the Ministry of Defence, Government of India.'
    && text.includes('Bharat Dynamics Limited')
    && extractRecruitmentUrl(page) === RECRUITMENTS_URL
}

export const hasOfficialRecruitmentsPageSignal = (html) => {
  const page = String(html ?? '')
  const title = normalizeWhitespace(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const text = stripTags(page) || ''

  return /^Recruitments(?: - Page \d+)? \| Official Website of Bharat Dynamics Limited \(BDL\) under the Ministry of Defence, Government of India\.$/i.test(title)
    && text.includes('Title')
    && text.includes('Issue Date')
    && text.includes('Download')
    && text.includes('Location')
    && extractNcsUrl(page) === NCS_URL
    && /<tbody\b[^>]*>[\s\S]*?<tr\b[^>]*class=["']align-top["']/i.test(page)
}

const pageHasNext = (html) => /<a[^>]+href=["']\?page=\d+["'][^>]*(?:title=["']Go to next page["']|rel=["']next["'])/i.test(String(html ?? ''))

const extractNoticeRows = (html) => {
  const tbody = String(html ?? '').match(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i)?.[1]
  if (!tbody) return []

  return [...tbody.matchAll(/<tr\b[^>]*class=["']align-top["'][^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((match) => {
      const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => cell[1])
      if (cells.length < 5) return null

      const downloadAnchor = extractFirstAnchor(cells[3])

      return {
        rowNumber: stripTags(cells[0]),
        title: stripTags(cells[1]),
        issueDate: parseIssueDate(stripTags(cells[2])),
        downloadUrl: downloadAnchor?.url ?? null,
        downloadText: downloadAnchor?.text ?? null,
        location: stripTags(cells[4]) || null,
      }
    })
    .filter(Boolean)
}

export const extractActionableRecruitmentNotices = (html, {
  now = () => new Date().toISOString(),
} = {}) => {
  if (!hasOfficialRecruitmentsPageSignal(html)) {
    throw new Error('Bharat Dynamics recruitments page no longer matches the verified official surface')
  }

  const nowIso = resolveNowIso(now)
  const today = nowIso.slice(0, 10)

  return extractNoticeRows(html)
    .filter((row) => {
      if (!row.title || !row.downloadUrl || !row.issueDate) return false
      if (!isRecruitmentNoticeTitle(row.title) || isArchivalNoticeTitle(row.title)) return false

      const eventDeadline = extractEventDeadline(row.title)
      if (eventDeadline) {
        return eventDeadline >= today
      }

      return isRecentIssueDate(row.issueDate, nowIso)
    })
    .map((row) => ({
      title: row.title,
      company: COMPANY,
      department: null,
      location: row.location || 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: `${SOURCE}-${slugify(row.title)}-${row.issueDate.slice(0, 10)}`,
      requisitionId: slugify(row.downloadText || row.title),
      sourceUrl: row.downloadUrl,
      applyUrl: row.downloadUrl,
      employmentType: getEmploymentType(row.title),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: row.issueDate,
      closingDate: extractEventDeadline(row.title),
      jobDescription: 'Official Bharat Dynamics recruitment notice PDF. Review the advertisement for eligibility, schedule, and application instructions.',
    }))
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createBharatDynamicsScraper = () => ({
  async run({
    fetchText: rawFetchText = defaultFetchText,
    signal,
    now = () => new Date().toISOString(),
    maxPages = 2,
  } = {}) {
    const fetchText = async (url, options = {}) => {
      signal?.throwIfAborted()
      try {
        const value = await rawFetchText(url, { ...options, signal: signal || options.signal })
        signal?.throwIfAborted()
        return value
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    }
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Bharat Dynamics homepage no longer matches the verified official surface')
    }

    if (extractRecruitmentUrl(homepageHtml) !== RECRUITMENTS_URL) {
      throw new Error('Bharat Dynamics homepage no longer exposes the verified recruitments handoff')
    }

    const jobs = []
    const seenJobIds = new Set()
    const scrapedAt = resolveNowIso(now)

    for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
      const pageUrl = buildRecruitmentsPageUrl(pageNumber)
      const html = await fetchText(pageUrl)
      const pageJobs = extractActionableRecruitmentNotices(html, { now })

      for (const job of pageJobs) {
        if (seenJobIds.has(job.jobId)) continue

        seenJobIds.add(job.jobId)
        jobs.push({
          ...job,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt,
        })
      }

      if (!pageHasNext(html)) {
        break
      }
    }

    return jobs
  },
})

export const run = async (options = {}) => createBharatDynamicsScraper().run(options)

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
