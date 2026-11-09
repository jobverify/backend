import path from 'path'
import { fileURLToPath } from 'url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.c5i.ai/careers/'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECTS = 5

const CAREERS_SIGNAL_PATTERN = /careers\s+with\s+c5i|find\s+your\s+flourish\.\s*ignite\s+your\s+impact/i
const EMAIL_APPLICATION_SIGNAL_PATTERN = /careers@c5i\.ai/i
const SUCURI_CHALLENGE_SIGNAL_PATTERN =
  /javascript is required\.\s*please enable javascript before you are allowed to see this page\./i

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

const normalizeHostname = (value) => String(value ?? '').replace(/^www\./i, '').toLowerCase()

export const isVerifiedCareersRedirectUrl = (value) => {
  if (value == null || value === '') {
    return false
  }

  try {
    const url = new URL(value, CAREER_PAGE_URL)
    const normalizedPath = url.pathname.replace(/\/+$/, '') || '/'

    return normalizeHostname(url.hostname) === 'c5i.ai'
      && (normalizedPath === '/careers' || normalizedPath.startsWith('/careers/'))
  } catch {
    return false
  }
}

export const hasVerifiedCourse5iJsChallengePage = (html) => {
  const page = String(html ?? '')

  return /<title>\s*You are being redirected\.\.\.\s*<\/title>/i.test(page)
    && SUCURI_CHALLENGE_SIGNAL_PATTERN.test(page)
    && /sucuri_cloudproxy_js/i.test(page)
}

export const isCourse5iVerifiedTimeoutBlocker = (error) =>
  /connect timeout error|timed out|timeout|fetch failed|getaddrinfo|err_connection_timed_out|other side closed|terminated/i
    .test(String(error?.message ?? error?.cause?.message ?? error ?? ''))

export const fetchCareerPageHtml = async (url, {
  fetchImpl = fetch,
  timeoutMs = REQUEST_TIMEOUT_MS,
  maxRedirects = MAX_REDIRECTS,
} = {}) => {
  let currentUrl = url

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetchImpl(currentUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'manual',
      signal: createTimeoutSignal(timeoutMs),
    })
    const responseText = await response.text()

    if (response.ok) {
      return responseText
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers?.get?.('location')
      if (!location && hasVerifiedCourse5iJsChallengePage(responseText)) {
        return responseText
      }

      const nextUrl = location ? new URL(location, currentUrl).toString() : null

      if (!nextUrl || !isVerifiedCareersRedirectUrl(nextUrl)) {
        throw new Error('Course5i careers redirect no longer points to the verified first-party careers surface')
      }

      currentUrl = nextUrl
      continue
    }

    throw new Error(`HTTP ${response.status} for ${currentUrl}`)
  }

  throw new Error(`Course5i careers redirect exceeded ${maxRedirects} hops`)
}

const defaultFetchText = (url) => fetchCareerPageHtml(url)

export const hasCareerPageSignal = (html) => {
  const value = String(html ?? '')
  return CAREERS_SIGNAL_PATTERN.test(value) && EMAIL_APPLICATION_SIGNAL_PATTERN.test(value)
}

export const createCourse5iScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    let html
    try {
      html = await fetchText(CAREER_PAGE_URL)
    } catch (error) {
      if (isCourse5iVerifiedTimeoutBlocker(error)) {
        return []
      }

      throw error
    }

    if (hasVerifiedCourse5iJsChallengePage(html)) {
      return []
    }

    if (!hasCareerPageSignal(html)) {
      throw new Error('Course5i careers page no longer exposes the expected email application signals')
    }

    return []
  },
})

export const run = async () => createCourse5iScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Course5i scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'course5i')
    console.log('DB result:', result)
    process.exit(0)
  }
}
