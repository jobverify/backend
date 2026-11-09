import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractTextFromPdfBuffer } from '../../scraper-support/shared/pdfText.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { withRetry } from '../../scraper-support/utils/retry.js'

import { GARDEN_REACH_SHIPBUILDERS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = GARDEN_REACH_SHIPBUILDERS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_APPLY_PORTAL_URLS = PROVIDER_METADATA.verifiedApplyPortalUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const PDF_CONTENT_TYPE_PATTERN = /application\/pdf/i

const MONTH_INDEX = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value) || null

const normalizeNotificationId = (value) => normalizeText(value)
  ?.replace(/\s+/g, '')
  ?.replace(/([0-9])\(([A-Z])\)$/i, '$1($2)')
  || null

const normalizeNoticeTitle = (value) => normalizeText(value)
  ?.replace(/^Apply\s+for\s+Engagement\s+of\s+/i, '')
  ?.replace(/^Apply\s+for\s+/i, '')
  || null

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const parseDashedPortalDate = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) return null

  const match = normalized.match(/(\d{1,2})[-\s]([A-Za-z]+)[-\s,]+(\d{4})/i)
  if (!match) return null

  const day = Number(match[1])
  const month = MONTH_INDEX[match[2].toLowerCase()]
  const year = Number(match[3])
  if (!Number.isInteger(day) || month == null || !Number.isInteger(year)) return null

  return new Date(Date.UTC(year, month, day)).toISOString()
}

const parseHumanDate = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) return null

  const match = normalized.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/i)
  if (!match) return null

  const day = Number(match[1])
  const month = MONTH_INDEX[match[2].toLowerCase()]
  const year = Number(match[3])
  if (!Number.isInteger(day) || month == null || !Number.isInteger(year)) return null

  return new Date(Date.UTC(year, month, day)).toISOString()
}

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(String(value), baseUrl).toString()
  } catch {
    return null
  }
}

const toStartOfDayTimestamp = (value) => {
  if (!value) return null
  if (/\dT\d/.test(String(value))) return Date.parse(value)
  return Date.parse(`${value}T00:00:00.000Z`)
}

export const hasOfficialPortalIndexSignal = (html = '', { portalYear } = {}) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const expectedHeading = portalYear ? `Welcome to Online Application in GRSE - ${portalYear}` : null

  return /<title>\s*Welcome to Online Registration\s*<\/title>/i.test(page)
    && (!expectedHeading || normalized.includes(expectedHeading))
    && /\[Employment Notification No\.\s*:/i.test(page)
    && /window\.location\.assign\(/i.test(page)
    && /Last date to Apply:/i.test(page)
}

export const extractPortalNotices = (html, { portalIndexUrl }) => {
  if (!hasOfficialPortalIndexSignal(html, {
    portalYear: portalIndexUrl?.match(/grse(\d{4})/i)?.[1] || null,
  })) {
    throw new Error('Garden Reach Shipbuilders verified official GRSE apply portal surface changed')
  }

  const notices = []

  for (const match of String(html ?? '').matchAll(
    /<li>\s*<a\b[^>]*href=(["'])javascript:window\.location\.assign\((["'])(.*?)\2\)\s*;?\1[^>]*>([\s\S]*?)<\/a>\s*<br\s*\/?>\s*Last date to Apply:\s*([^<\r\n]+)/gi,
  )) {
    const detailPath = normalizeText(match[3])
    const anchorText = normalizeWhitespace(String(match[4] ?? '').replace(/<[^>]+>/g, ' '))
    const noticeMatch = anchorText.match(/\[Employment Notification No\.\s*:\s*([^\]]+)\]\s*:?\s*(.*)$/i)
    const notificationId = normalizeNotificationId(noticeMatch?.[1])
    const title = normalizeNoticeTitle(noticeMatch?.[2])
    const detailUrl = toAbsoluteUrl(detailPath, portalIndexUrl)
    const closingDate = parseDashedPortalDate(match[5])

    if (!notificationId || !title || !detailUrl || !closingDate) continue

    notices.push({
      title,
      notificationId,
      detailUrl,
      sourceUrl: portalIndexUrl,
      closingDate,
    })
  }

  return notices
}

export const hasOfficialNoticeDetailSignal = (html = '', { notificationId } = {}) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const normalizedNotificationId = normalizeNotificationId(notificationId)

  return /<title>\s*Welcome to Online Registration\s*<\/title>/i.test(page)
    && normalized.includes('Welcome to Online Application for GRSE Recruitment')
    && (!normalizedNotificationId || normalized.includes(`Employment Notification No. : ${normalizedNotificationId.replace(/\(/, ' (')}`) || normalized.includes(`Employment Notification No. : ${normalizedNotificationId}`))
    && normalized.includes('View Advertisement - English version')
    && normalized.includes('Fresh Candidate to create Log In')
    && normalized.includes('To Complete Registration Process')
}

export const extractNoticePdfUrl = (html = '', { detailUrl }) => {
  for (const match of String(html ?? '').matchAll(/<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    const linkText = normalizeWhitespace(String(match[3] ?? '').replace(/<[^>]+>/g, ' '))
    if (/^View Advertisement - English version$/i.test(linkText)) {
      return toAbsoluteUrl(match[2], detailUrl)
    }
  }

  return null
}

export const extractNoticeDetailsFromPdf = (pdfText = '', {
  listingTitle,
  notificationId,
} = {}) => {
  const rawDescription = String(pdfText ?? '').trim()
  const normalized = normalizeWhitespace(pdfText)
  const normalizedNotificationId = normalizeNotificationId(notificationId)
  const compactNormalized = normalized.replace(/\s+/g, '')

  if (!normalized) {
    throw new Error('Garden Reach Shipbuilders active notice PDF is empty')
  }

  if (
    normalizedNotificationId
    && !compactNormalized.includes(`EMPLOYMENTNOTIFICATIONNO.${normalizedNotificationId}`)
  ) {
    throw new Error(`Garden Reach Shipbuilders active notice PDF changed for ${normalizedNotificationId}`)
  }

  const openingDate = parseHumanDate(
    normalized.match(/Opening date for Online registration:\s*([^.]*)/i)?.[1],
  )
  const closingDate = parseHumanDate(
    normalized.match(/Closing date for Online registration:\s*([^.]*)/i)?.[1],
  )
  const minimumQualification = normalizeText(
    normalized.match(/Chartered Accountant \(CA\) OR Cost & Management Accountant \(CMA\)/i)?.[0],
  )
  const experienceRequired = normalizeText(
    normalized
      .match(/(\d+\s+years['’]?\s+post qualification experience)/i)?.[1]
      ?.replace(/['’]/g, ''),
  )

  if (!openingDate || !closingDate) {
    throw new Error(`Garden Reach Shipbuilders active notice PDF no longer exposes dates for ${normalizedNotificationId || listingTitle || 'the current notice'}`)
  }

  return {
    title: listingTitle,
    notificationId: normalizedNotificationId,
    postingDate: openingDate,
    closingDate,
    employmentType: /A PERMANENT EMPLOYMENT/i.test(normalized)
      ? 'Full-time'
      : (/ON CONTRACT BASIS/i.test(`${listingTitle || ''} ${normalized}`) ? 'Contract' : null),
    experienceRequired: experienceRequired || null,
    minimumQualification: minimumQualification || null,
    jobDescription: rawDescription || normalized,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchDocumentText = (url) => withRetry(async () => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  const contentType = response.headers?.get?.('content-type') || ''
  if (PDF_CONTENT_TYPE_PATTERN.test(contentType) || /\.pdf(?:$|\?)/i.test(url)) {
    return extractTextFromPdfBuffer(await response.arrayBuffer())
  }

  return response.text()
}, {
  attempts: 3,
  baseDelayMs: 2000,
  label: SOURCE,
})

const dedupeNotices = (notices) => {
  const noticesById = new Map()

  for (const notice of notices) {
    if (!notice?.notificationId || noticesById.has(notice.notificationId)) continue
    noticesById.set(notice.notificationId, notice)
  }

  return [...noticesById.values()]
}

export const createGardenReachShipbuildersScraper = ({
  now = () => new Date().toISOString(),
  asOfDate = new Date().toISOString().slice(0, 10),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchDocumentText = defaultFetchDocumentText,
    now: overrideNow,
  } = {}) {
    const portalNotices = dedupeNotices(
      (
        await Promise.all(
          VERIFIED_APPLY_PORTAL_URLS.map(async (portalIndexUrl) => extractPortalNotices(
            await fetchText(portalIndexUrl),
            { portalIndexUrl },
          )),
        )
      ).flat(),
    )

    const asOfTimestamp = toStartOfDayTimestamp(asOfDate)
    if (!Number.isFinite(asOfTimestamp)) {
      throw new Error(`Garden Reach Shipbuilders received an invalid as-of date: ${asOfDate}`)
    }

    const candidateNotices = portalNotices.filter((notice) =>
      toStartOfDayTimestamp(notice.closingDate) >= asOfTimestamp,
    )

    if (candidateNotices.length === 0) {
      return []
    }

    const jobs = []

    for (const notice of candidateNotices) {
      const detailHtml = await fetchText(notice.detailUrl)
      if (!hasOfficialNoticeDetailSignal(detailHtml, { notificationId: notice.notificationId })) {
        throw new Error(`Garden Reach Shipbuilders verified active notice detail page changed for ${notice.notificationId}`)
      }

      const noticePdfUrl = extractNoticePdfUrl(detailHtml, { detailUrl: notice.detailUrl })
      if (!noticePdfUrl) {
        throw new Error(`Garden Reach Shipbuilders active notice detail page no longer exposes the official PDF for ${notice.notificationId}`)
      }

      const noticeDetails = extractNoticeDetailsFromPdf(
        await fetchDocumentText(noticePdfUrl),
        {
          listingTitle: notice.title,
          notificationId: notice.notificationId,
        },
      )

      const postingTimestamp = toStartOfDayTimestamp(noticeDetails.postingDate)
      const closingTimestamp = toStartOfDayTimestamp(noticeDetails.closingDate)
      if (
        !Number.isFinite(postingTimestamp)
        || !Number.isFinite(closingTimestamp)
        || postingTimestamp > asOfTimestamp
        || closingTimestamp < asOfTimestamp
      ) {
        continue
      }

      jobs.push({
        title: `${noticeDetails.title} [Employment Notification ${notice.notificationId}]`,
        company: COMPANY,
        department: null,
        location: 'India',
        city: null,
        state: null,
        country: 'India',
        jobId: `${SOURCE}-${slugify(notice.notificationId)}`,
        requisitionId: notice.notificationId,
        sourceUrl: notice.detailUrl,
        applyUrl: notice.detailUrl,
        employmentType: noticeDetails.employmentType,
        experienceRequired: noticeDetails.experienceRequired,
        minimumQualification: noticeDetails.minimumQualification,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: noticeDetails.postingDate,
        closingDate: noticeDetails.closingDate,
        jobDescription: noticeDetails.jobDescription,
        remoteStatus: 'On-site',
        publicExperienceChecked: true,
        source: SOURCE,
        link: notice.detailUrl,
        scrapedAt: (overrideNow || now)(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createGardenReachShipbuildersScraper(options).run(options)

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
