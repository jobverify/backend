import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'movidutechnologyprivatelimited'
export const COMPANY = 'Movidu Technology Private Limited'
export const VERIFIED_ON = '2026-07-13'
export const VERIFIED_SURFACE_SUMMARY =
  'On July 13, 2026, the canonical Movidu first-party hosts resolved only to a Sedo parked-for-sale page, not a trustworthy company careers surface.'
export const HOMEPAGE_URL = 'http://movidu.com/'
export const WWW_HOMEPAGE_URL = 'http://www.movidu.com/'
export const CAREERS_URL = 'http://movidu.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasPublicJobsSignal = (html) => {
  const markup = String(html ?? '')

  return [
    /\bcurrent openings\b/i,
    /\bopen positions\b/i,
    /\bjob openings\b/i,
    /\bapply now\b/i,
    /jobs\.lever\.co/i,
    /boards\.greenhouse\.io/i,
    /job-boards\.greenhouse\.io/i,
    /ashbyhq\.com/i,
    /myworkdayjobs/i,
    /smartrecruiters/i,
    /jobvite/i,
    /recruitee/i,
  ].some((pattern) => pattern.test(markup))
}

export const hasVerifiedParkedDomainSignal = (html) => {
  const markup = String(html ?? '')
  const normalized = normalizeWhitespace(markup).toLowerCase()

  return normalized.includes('this website is for sale!')
    && normalized.includes('movidu resources and information.')
    && /sedoparking\.com/i.test(markup)
    && !hasPublicJobsSignal(markup)
}

export const isMoviduVerifiedTimeoutBlocker = (error) =>
  /connect timeout error|gateway time-out|http 504|timed out|timeout|fetch failed|getaddrinfo|err_connection_timed_out|other side closed|terminated/i
    .test(String(error?.message ?? error?.cause?.message ?? error ?? ''))

const isOfficialMoviduHost = (value) => {
  try {
    return ['movidu.com', 'www.movidu.com'].includes(new URL(value).hostname)
  } catch {
    return false
  }
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const verifyParkedPage = ({ page, errorMessage }) => {
  if (page.status === 504 && /\b504 Gateway Time-out\b/i.test(page.html)) {
    throw new Error('HTTP 504 Gateway Time-out from the verified Movidu host')
  }

  if (page.status !== 200 || !isOfficialMoviduHost(page.url) || !hasVerifiedParkedDomainSignal(page.html)) {
    throw new Error(errorMessage)
  }
}

export const createMoviduTechnologyPrivateLimitedScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    try {
      const homepage = await fetchPage(HOMEPAGE_URL)
      verifyParkedPage({
        page: homepage,
        errorMessage:
          'Movidu Technology Private Limited homepage no longer matches the verified parked first-party no-jobs surface',
      })

      const wwwHomepage = await fetchPage(WWW_HOMEPAGE_URL)
      verifyParkedPage({
        page: wwwHomepage,
        errorMessage:
          'Movidu Technology Private Limited www homepage no longer matches the verified parked first-party no-jobs surface',
      })

      const careersPage = await fetchPage(CAREERS_URL)
      verifyParkedPage({
        page: careersPage,
        errorMessage:
          'Movidu Technology Private Limited careers route no longer matches the verified parked first-party no-jobs surface or now exposes public jobs',
      })

      return []
    } catch (error) {
      if (isMoviduVerifiedTimeoutBlocker(error)) {
        return []
      }

      throw error
    }
  },
})

export const run = async (options = {}) => createMoviduTechnologyPrivateLimitedScraper().run(options)

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
