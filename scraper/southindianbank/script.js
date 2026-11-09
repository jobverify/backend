import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { hydrateSourceDescriptions } from '../../scraper-support/utils/sourceDescriptionHydration.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://recruit.southindianbank.bank.in/RDC/'

const SOURCE = 'southindianbank'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&#x27;|&rsquo;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeDate = (value) => {
  const match = String(value ?? '').match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!match) return null

  const [, day, month, year] = match
  return `${year}-${month}-${day}`
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*(?:Current Openings|South Indian Bank Careers)\s*-\s*South Indian Bank\s*<\/title>/i.test(page)
    && /href=["']https:\/\/www\.southindianbank\.bank\.in\/about-us\/careers["']/i.test(page)
    && text.includes('South Indian Bank')
    && (
      text.includes('Current Job Openings')
      || text.includes('Recruitment Drive Portal')
    )
}

export const hasEmptyOpeningsSignal = (html) =>
  /Currently,\s*there are no job openings\./i.test(html || '')

export const extractOpenings = (html, { now = () => new Date().toISOString() } = {}) => {
  const page = String(html ?? '')
  const cards = page.match(/<article class="job-card">[\s\S]*?<\/article>/gi) ?? []

  return cards
    .map((card) => {
      const title = card.match(/data-job-title=["']([^"']+)["']/i)?.[1]?.trim() ?? null
      const jobId =
        card.match(/<button[^>]+id=["'](\d+)["']/i)?.[1]
        ?? card.match(/id=["']pdf_(\d+)["']/i)?.[1]
        ?? card.match(/Notification\/(\d+)\.jpg/i)?.[1]
        ?? null
      const startDate = card.match(/Start Date:\s*<\/span>\s*<span[^>]*>\s*([^<]+)\s*<\/span>/i)?.[1] ?? null
      const endDate = card.match(/End\s*Date:\s*<\/span>\s*<span[^>]*>\s*([^<]+)\s*<\/span>/i)?.[1] ?? null

      if (!title || !jobId) return null

      return {
        title,
        company: 'South Indian Bank',
        department: null,
        location: 'India',
        city: null,
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: CAREERS_URL,
        applyUrl: CAREERS_URL,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: normalizeDate(startDate),
        closingDate: normalizeDate(endDate),
        jobDescription: null,
        source: SOURCE,
        link: CAREERS_URL,
        scrapedAt: now(),
      }
    })
    .filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const successfulExactResponse = (response, expectedUrl) => response?.status >= 200
  && response.status < 300 && response.url === expectedUrl

const notificationScriptUrl = html => {
  const scripts = [...String(html).matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)]
  for (const [, src] of scripts) {
    const url = new URL(src, CAREERS_URL)
    if (url.origin === new URL(CAREERS_URL).origin && url.pathname === '/RDC/js/index.js') return url.href
  }
  return null
}

// The document path is accepted only when the live board's script binds this
// card's notification control to callpdf and exposes its verified URL template.
export const resolveNotificationUrl = (job, html, response) => {
  const scriptUrl = notificationScriptUrl(html)
  if (!scriptUrl || !successfulExactResponse(response, scriptUrl) || !/^\d+$/.test(job.jobId)) return null
  const card = (String(html).match(/<article class="job-card">[\s\S]*?<\/article>/gi) ?? [])
    .find(value => new RegExp(`id=["']pdf_${job.jobId}["']`).test(value))
  if (!card || normalizeWhitespace(card.match(/data-job-title=["']([^"']+)["']/i)?.[1]) !== job.title) return null
  const script = String(response.html ?? '')
  const handler = new RegExp(`\\$\\(['"]#pdf_${job.jobId}['"]\\)\\.on\\(\\s*['"]click['"]\\s*,\\s*function\\s*\\(\\s*\\)\\s*\\{\\s*callpdf\\(\\s*['"]${job.jobId}['"]\\s*\\)\\s*;?\\s*\\}\\s*\\)`)
  const body = script.match(/function\s+callpdf\s*\(appid\)\s*\{([^}]+)\}/)?.[1] ?? ''
  if (!handler.test(script) || !/url\s*=\s*["']Notification\/Notification_["']\s*\+\s*appid\s*\+\s*["']\.PDF["']\s*;\s*window\.open\(url\s*,/.test(body)) return null
  return new URL(`Notification/Notification_${job.jobId}.PDF`, CAREERS_URL).href
}

const notificationDate = value => {
  const match = String(value ?? '').match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null
}

export const recoverNotificationDescription = (job, url, response) => {
  if (!url || !successfulExactResponse(response, url) || typeof response.text !== 'string') return null
  const text = normalizeWhitespace(response.text)
  const documentTitle = text.match(/\b(RECRUITMENT OF.*?)\s+IMPORTANT NOTICE:/i)?.[1]
  if (!/\bThe South Indian Bank (?:Ltd\.?|Limited)\b/i.test(text)
    || documentTitle?.toUpperCase() !== normalizeWhitespace(job.title).toUpperCase()) return null
  const postingDate = notificationDate(text.match(/Online Application\s*-\s*Start Date\s+(\d{2}\.\d{2}\.\d{4})/i)?.[1])
  const closingDate = notificationDate(text.match(/Online Application\s*-\s*End Date\s+(\d{2}\.\d{2}\.\d{4})/i)?.[1])
  // A matching campaign start is required: a reused role title is insufficient.
  if (!postingDate || postingDate !== job.postingDate || !closingDate) return null
  return { sourceDescription: response.text, sourceNotificationDescription: response.text, sourceNotificationUrl: url,
    sourceNotificationDates: { postingDate, closingDate },
    sourceDateConflict: closingDate !== job.closingDate }
}

const defaultFetchNotificationScript = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal, attempts: 1, timeoutMs: 15000, includeResponseMetadata: true,
  headers: { 'User-Agent': USER_AGENT, Accept: 'text/javascript' }, label: SOURCE,
})

export const fetchNotificationPdfText = async (url, { signal, fetchImpl = fetch, timeoutMs = 15000 } = {}) => {
  const boundedSignal = signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs)
  boundedSignal.throwIfAborted()
  const response = await fetchImpl(url, { signal: boundedSignal,
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/pdf' } })
  if (!successfulExactResponse(response, url) || !/application\/pdf/i.test(response.headers.get('content-type') ?? '')) return null
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > 10 * 1024 * 1024 || bytes.subarray(0, 5).toString() !== '%PDF-') return null
  const { extractTextFromPdfBuffer } = await import('../../scraper-support/shared/pdfText.js')
  const text = await extractTextFromPdfBuffer(bytes, { signal: boundedSignal, timeoutMs: 30000 })
  return { status: response.status, url: response.url, text }
}

export const createSouthIndianBankScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchNotificationScript, fetchPdfText,
    signal, detailEnrichmentBudgetMs, now = () => new Date().toISOString() } = {}) {
    signal?.throwIfAborted()
    const html = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('South Indian Bank careers page no longer matches the verified official public surface')
    }

    const jobs = extractOpenings(html, { now })
    if (jobs.length > 0) {
      // Page-only injected transports retain their existing offline contract.
      const scriptReader = fetchNotificationScript || (fetchText === defaultFetchText ? defaultFetchNotificationScript : null)
      const pdfReader = fetchPdfText || (fetchText === defaultFetchText ? fetchNotificationPdfText : null)
      if (!scriptReader || !pdfReader) return jobs
      const scriptUrl = notificationScriptUrl(html)
      let scriptPromise
      const details = new Map()
      const hydrated = await hydrateSourceDescriptions(jobs, { signal, detailEnrichmentBudgetMs,
        fetchDetail: async (job, options) => {
          if (!scriptUrl) return null
          scriptPromise ??= scriptReader(scriptUrl, options)
          const url = resolveNotificationUrl(job, html, await scriptPromise)
          if (!url) return null
          const detail = recoverNotificationDescription(job, url, await pdfReader(url, options))
          if (detail) details.set(job.jobId, detail)
          return detail
        },
      })
      return hydrated.map(job => job.sourceDescription && details.has(job.jobId) ? { ...job, ...details.get(job.jobId),
        // Public visibility checks canonical source content, independently of
        // detail diagnostics. Keep contradictory notification text as evidence
        // until applicability is established, without making it public content.
        ...(details.get(job.jobId).sourceDateConflict ? { sourceDescription: null, jobDescription: null } : {}),
        sourceDetailComplete: false,
        sourceDetailFailureKind: details.get(job.jobId).sourceDateConflict
          ? 'notification-date-conflict' : 'pdf-completeness-unverified' } : job)
    }

    if (hasEmptyOpeningsSignal(html)) return []

    throw new Error('South Indian Bank careers page no longer matches the verified public jobs or no-openings surface')
  },
})

export const run = async (options = {}) => createSouthIndianBankScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running South Indian Bank scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
