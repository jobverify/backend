import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { composeAbortSignals } from '../../scraper-support/utils/fetch.js'

import { SREI_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SREI_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const JOB_LISTINGS_URL = PROVIDER_METADATA.jobListingsUrl
export const PORTAL_ORIGIN = PROVIDER_METADATA.portalOrigin
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url, { signal } = {}) => {
  signal?.throwIfAborted()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const requestSignal = composeAbortSignals(signal, controller.signal)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: requestSignal,
    })

    signal?.throwIfAborted()
    requestSignal.throwIfAborted()
    const html = await response.text()
    signal?.throwIfAborted()
    requestSignal.throwIfAborted()
    return { status: response.status, url: response.url, html }
  } catch (error) {
    signal?.throwIfAborted()
    requestSignal.throwIfAborted()
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export const hasOfficialCareersSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Careers\s*\|\s*Srei\b/i.test(rawHtml)
    && normalized.includes('Careers')
    && normalized.includes('Work with us')
    && normalized.includes('Beyond Work')
    && normalized.includes('Any Queries ?')
    && normalized.includes('Mail Us')
  }

export const extractVerifiedEmployWiseUrl = (html = '') => {
  for (const match of String(html ?? '').matchAll(
    /<a[^>]+href=["']([^"']+)["'][^>]*>\s*Work with us\s*<\/a>/gi,
  )) {
    try {
      return new URL(match[1], CAREERS_URL).toString()
    } catch {
      continue
    }
  }

  return null
}

export const hasBlockedEmployWiseShellSignal = ({ status, url, html } = {}) => {
  const normalized = normalizeWhitespace(html)
  const pleaseWaitMatches = String(html ?? '').match(/Please wait\.{2,}/gi) || []

  return status === 200
    && url === JOB_LISTINGS_URL
    && normalized.includes('Open Positions')
    && normalized.includes('Search by function(s)')
    && pleaseWaitMatches.length >= 2
}

export const hasPublicJobListingsSignal = (html = '') => (
  /Recruitment_PositionS/i.test(String(html ?? ''))
  || /Apply Now/i.test(String(html ?? ''))
  || /job title/i.test(String(html ?? ''))
  || /position_code=/i.test(String(html ?? ''))
)

export const createSreiScraper = () => ({
  async run({ fetchPage: rawFetchPage = defaultFetchPage, signal } = {}) {
    signal?.throwIfAborted()
    const fetchPage = async (url, options = {}) => {
      signal?.throwIfAborted()
      try {
        const page = await rawFetchPage(url, { ...options, signal: signal || options.signal })
        signal?.throwIfAborted()
        return page
      } catch (error) {
        signal?.throwIfAborted()
        throw error
      }
    }
    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('SREI verified first-party careers page no longer matches the known public surface')
    }

    const handoffUrl = extractVerifiedEmployWiseUrl(careersPage.html)
    if (handoffUrl !== JOB_LISTINGS_URL) {
      throw new Error('SREI verified EmployWise handoff no longer matches the known public surface')
    }

    const jobListingsPage = await fetchPage(JOB_LISTINGS_URL)
    if (hasBlockedEmployWiseShellSignal(jobListingsPage)) {
      return []
    }

    if (jobListingsPage.status === 200 && hasPublicJobListingsSignal(jobListingsPage.html)) {
      throw new Error('SREI public jobs surface no longer matches the verified unresolved state')
    }

    throw new Error('SREI public jobs surface no longer matches the verified unresolved state')
  },
})

export const run = async (options = {}) => createSreiScraper().run(options)

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
