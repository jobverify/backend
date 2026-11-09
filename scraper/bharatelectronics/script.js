import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { BHARAT_ELECTRONICS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = BHARAT_ELECTRONICS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const JOB_NOTIFICATIONS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(?:br|\/p|\/div|\/li|\/td|\/tr|\/table|\/tbody|\/main|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toAbsoluteUrl = (value) => {
  if (!value) return null

  try {
    const url = new URL(value, JOB_NOTIFICATIONS_URL)

    if (url.hostname.toLowerCase() === 'jobapply.in' && !url.pathname.endsWith('/')) {
      url.pathname = `${url.pathname}/`
    }

    return url.toString()
  } catch {
    return null
  }
}

const formatDateToIso = (value) => {
  const match = String(value ?? '').match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!match) return null

  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

const resolveNowIso = (now = () => new Date().toISOString()) => {
  const value = typeof now === 'function' ? now() : now
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString()
}

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const buildJobId = (title, closingDate) => `${SOURCE}-${slugify(title)}-${closingDate || 'open'}`

const isApplicationFeeLink = (text) => /application fee|payment|sbi collect/i.test(text)
const isSupportingDocumentLink = (text) => /certificate|corrigendum|annexure|format/i.test(text)

const getEmploymentType = (title) => {
  if (/permanent basis/i.test(title)) return 'Full-time'
  if (/fixed tenure|project engineer/i.test(title)) return 'Contract'
  if (/trainee/i.test(title)) return 'Full-time'
  return null
}

const getJobDescription = (applyUrl) => (
  /\.pdf(?:$|\?)/i.test(String(applyUrl ?? ''))
    ? 'Download the official BEL application form PDF and follow the advertisement instructions before the closing date.'
    : 'Review the official BEL advertisement PDF and complete the official online application before the closing date.'
)

export const buildJobNotificationsPageUrl = (pageNumber = 1) => (
  Number(pageNumber) <= 1
    ? JOB_NOTIFICATIONS_URL
    : `${JOB_NOTIFICATIONS_URL}page/${Number(pageNumber)}/`
)

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const title = normalizeWhitespace(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const text = stripTags(page)

  return title === 'BEL – GOVERNMENT OF INDIA, MINISTRY OF DEFENCE , A NAVRATNA COMPANY'
    && text.includes('Bharat Electronics Limited')
    && text.includes('Government of India, Ministry of Defence, A Navratna Company')
    && /href=["']https:\/\/bel-india\.in\/job-notifications\/["']/i.test(page)
    && text.includes('This is the official website of Bharat Electronics Limited (BEL)')
}

export const hasOfficialJobNotificationsPageSignal = (html) => {
  const page = String(html ?? '')
  const title = normalizeWhitespace(page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
  const text = stripTags(page)

  return /^Job Notifications(?: – Page \d+)? – BEL$/i.test(title)
    && text.includes('Recruitment Advertising')
    && text.includes('All recruitments at Bharat Electronics Limited are advertised through this official website')
    && /class=["']career-result-box["']/i.test(page)
    && text.includes('CAUTION NOTICE: FRAUDULENT JOB OFFERS')
}

const extractAnchors = (html) => [...String(html ?? '').matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
  .map((match) => ({
    url: toAbsoluteUrl(match[1]),
    text: stripTags(match[2]),
  }))
  .filter((anchor) => anchor.url && anchor.text)

const classifySourceUrl = (anchors = []) => anchors[0]?.url || null

const classifyApplyUrl = (anchors = []) => {
  for (const anchor of anchors) {
    if (isApplicationFeeLink(anchor.text) || isSupportingDocumentLink(anchor.text)) continue

    if (/click here for online application|click here to apply online|click here to apply|download application form/i.test(anchor.text)) {
      return anchor.url
    }
  }

  return null
}

export const extractActiveJobNotifications = (html, {
  now = () => new Date().toISOString(),
} = {}) => {
  if (!hasOfficialJobNotificationsPageSignal(html)) {
    throw new Error('Bharat Electronics job notifications page no longer matches the verified official surface')
  }

  const today = resolveNowIso(now).slice(0, 10)
  const jobs = []

  for (const block of String(html ?? '').split('<div class="career-result-box">').slice(1)) {
    const title = stripTags(block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? '')
    const location = normalizeWhitespace(block.match(/<p><b>Location:<\/b>\s*([\s\S]*?)<\/p>/i)?.[1] ?? '') || null
    const closingDateRaw = normalizeWhitespace(
      block.match(/<p><b>Last Date to Apply:<\/b>\s*([0-9-]{10})<\/p>/i)?.[1] ?? '',
    )
    const closingDate = formatDateToIso(closingDateRaw)
    const anchors = extractAnchors(block)
    const sourceUrl = classifySourceUrl(anchors)
    const applyUrl = classifyApplyUrl(anchors)

    if (!title || !closingDate || !sourceUrl || !applyUrl || closingDate < today) {
      continue
    }

    jobs.push({
      title,
      company: COMPANY,
      location,
      city: null,
      country: 'India',
      jobId: buildJobId(title, closingDate),
      requisitionId: slugify(title),
      sourceUrl,
      applyUrl: toAbsoluteUrl(applyUrl),
      employmentType: getEmploymentType(title),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate,
      jobDescription: getJobDescription(applyUrl),
      remoteStatus: null,
    })
  }

  return jobs
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to verify the first certificate|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const createBharatElectronicsScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchBrowserText,
    now = () => new Date().toISOString(),
    maxPages = 6,
  } = {}) {
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({ userAgent: USER_AGENT })
      }

      return browserSession
    }

    const browserTextFetcher = fetchBrowserText || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchText(url)
    })

    const fetchVerifiedText = async (url) => {
      try {
        return await fetchText(url)
      } catch (error) {
        if (!isBrowserFallbackError(error)) {
          throw error
        }

        return browserTextFetcher(url)
      }
    }

    try {
      const homepageHtml = await fetchVerifiedText(HOMEPAGE_URL)
      if (!hasOfficialHomepageSignal(homepageHtml)) {
        throw new Error('Bharat Electronics homepage no longer matches the verified official surface')
      }

      const scrapedAt = resolveNowIso(now)
      const jobs = []
      const seenJobIds = new Set()

      for (let page = 1; page <= maxPages; page += 1) {
        const html = await fetchVerifiedText(buildJobNotificationsPageUrl(page))
        const pageJobs = extractActiveJobNotifications(html, { now })
        let newJobsAdded = 0

        for (const job of pageJobs) {
          if (seenJobIds.has(job.jobId)) continue

          seenJobIds.add(job.jobId)
          newJobsAdded += 1
          jobs.push({
            ...job,
            source: SOURCE,
            link: job.applyUrl || job.sourceUrl,
            scrapedAt,
          })
        }

        if (newJobsAdded === 0) break
      }

      return jobs
    } finally {
      if (browserSession) {
        await browserSession.close()
      }
    }
  },
})

export const run = async (options = {}) => createBharatElectronicsScraper().run(options)

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
