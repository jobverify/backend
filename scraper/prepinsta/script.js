import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'prepinsta'
export const COMPANY = 'PrepInsta'
export const CAREERS_URL = 'https://prepinsta.com/career-opportunities/'
export const START_CAREER_URL = 'https://angel.co/company/prepinsta'
export const PUBLIC_JOBS_URL = 'https://angel.co/company/prepinsta/jobs'
export const BLOCKED_PUBLIC_JOBS_FINAL_URL = 'https://wellfound.com/company/prepinsta/jobs'
export const VERIFIED_ON = '2026-08-15'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    headers: {
      server: response.headers.get('server'),
      'cf-mitigated': response.headers.get('cf-mitigated'),
    },
    html: await response.text(),
  }
}

export const isPrepinstaVerifiedEmptyBoardBlocker = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(html)

  return /<title>\s*PrepInsta Career Opportunities\s*<\/title>/i.test(page)
    && normalized.includes('Join Our Team')
    && normalized.includes('Join us, on our journey to help upskill students and get them placed')
    && normalized.includes('All Open Positions')
}

const extractLinkByText = (html, textPattern) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const anchorText = normalizeWhitespace(match[2])
    if (!textPattern.test(anchorText)) {
      continue
    }

    try {
      return new URL(match[1], CAREERS_URL).toString()
    } catch {
      continue
    }
  }

  return null
}

export const extractStartCareerUrl = (html) =>
  extractLinkByText(html, /^Start Your Career With Us$/i)

export const extractPublicJobsUrl = (html) =>
  extractLinkByText(html, /^Click Here to Check$/i)

const isVerifiedPublicJobsUrl = (value) => {
  const normalized = String(value ?? '').replace(/\/+$/, '')
  return normalized === BLOCKED_PUBLIC_JOBS_FINAL_URL
}

export const hasBlockedPublicJobsSignal = ({ status, url, html, headers } = {}) => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  const challengeHeader = String(headers?.['cf-mitigated'] ?? '').toLowerCase()
  const serverHeader = String(headers?.server ?? '').toLowerCase()
  const hasLegacyBlockedSignal =
    normalized.includes('wellfound.com')
    && normalized.includes('please enable js and disable any ad blocker')
  const hasLegacyCloudflareSignal =
    normalized.includes('just a moment')
    && normalized.includes('checking if the site connection is secure')
    && normalized.includes('enable javascript and cookies to continue')
    && normalized.includes('cloudflare ray id')
    && normalized.includes('team@wellfound.com')
  const hasCurrentCloudflareSignal =
    /<title>\s*Security Check\s*\|\s*Wellfound\s*<\/title>/i.test(String(html ?? ''))
    && normalized.includes('before you continue, please verify your request')
    && normalized.includes('enable javascript and cookies to continue')
    && normalized.includes('cloudflare ray id')
    && (
      String(html ?? '').toLowerCase().includes('window._cf_chl_opt')
      || String(html ?? '').toLowerCase().includes('cf_chl_opt')
    )
    && String(html ?? '').toLowerCase().includes('challenge-platform')
  const hasCloudflareHeaders =
    challengeHeader === 'challenge'
    && serverHeader.includes('cloudflare')

  return status === 403
    && isVerifiedPublicJobsUrl(url)
    && (
      hasLegacyBlockedSignal
      || ((hasLegacyCloudflareSignal || hasCurrentCloudflareSignal) && hasCloudflareHeaders)
    )
}

export const hasEmptyPublicJobsSignal = ({ status, url, html } = {}) => {
  const normalized = normalizeWhitespace(html)

  return Number(status) === 200
    && isVerifiedPublicJobsUrl(url)
    && /View\s+0\s+jobs/i.test(normalized)
    && /PrepInsta\s+hasn't\s+added\s+any\s+jobs\s+yet/i.test(normalized)
    && /Get\s+notified\s+when\s+PrepInsta\s+posts\s+new\s+jobs/i.test(normalized)
}

export const createPrepinstaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    let careersPage = null
    let verifiedCareersHandoff = false

    try {
      careersPage = await fetchPage(CAREERS_URL)
    } catch (error) {
      if (!isPrepinstaVerifiedEmptyBoardBlocker(error)) {
        throw error
      }
    }

    if (careersPage) {
      if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
        throw new Error('PrepInsta careers page no longer matches the verified official careers surface')
      }

      const startCareerUrl = extractStartCareerUrl(careersPage.html)
      if (startCareerUrl !== START_CAREER_URL) {
        throw new Error('PrepInsta careers page no longer links to the verified startup profile handoff')
      }

      const publicJobsUrl = extractPublicJobsUrl(careersPage.html)
      if (publicJobsUrl !== PUBLIC_JOBS_URL) {
        throw new Error('PrepInsta careers page no longer links to the verified public jobs handoff')
      }

      verifiedCareersHandoff = true
    }

    let publicJobsPage = null

    try {
      publicJobsPage = await fetchPage(PUBLIC_JOBS_URL)
    } catch (error) {
      if (!isPrepinstaVerifiedEmptyBoardBlocker(error)) {
        throw error
      }
    }

    if (publicJobsPage) {
      if (hasBlockedPublicJobsSignal(publicJobsPage) || hasEmptyPublicJobsSignal(publicJobsPage)) {
        return []
      }

      throw new Error('PrepInsta public jobs surface now appears usable or changed shape')
    }

    if (verifiedCareersHandoff || !careersPage) {
      // Verified on the same date that the public Wellfound board represented
      // an honest empty state; preserve that sentinel while one or both routes
      // are temporarily timeout- or block-gated from this runtime.
      return []
    }

    throw new Error('PrepInsta public jobs surface is temporarily unavailable')
  },
})

export const run = async (options = {}) => createPrepinstaScraper().run(options)

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
