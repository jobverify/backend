import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'redanttechnologies'
export const COMPANY = 'RedAnt Technologies'
export const HOMEPAGE_URL = 'https://www.redanttech.com/'
export const MISSING_ROUTE_URLS = [
  'https://www.redanttech.com/careers',
  'https://www.redanttech.com/jobs',
  'https://www.redanttech.com/join-us',
  'https://www.redanttech.com/current-openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_LIKE_LINK_PATTERN =
  /href=["'](?:https?:\/\/www\.redanttech\.com)?\/(?:careers?|jobs?|join-us|current-openings)(?:[\/#?][^"']*)?["']/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bwe(?:'|’)re hiring\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
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
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*RedAnt Technologies Ltd \| Software,\s*Cloud,\s*AI\s*&\s*Digital Solutions\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["']RedAnt Technologies Ltd builds scalable software,\s*mobile,\s*cloud,\s*data,\s*AI and geospatial solutions that help businesses innovate,\s*operate and grow\.["']/i.test(page)
    && /<meta[^>]+name=["']author["'][^>]+content=["']RedAnt Technologies Ltd["']/i.test(page)
    && /<meta[^>]+property=["']og:title["'][^>]+content=["']RedAnt Technologies Ltd \| Software,\s*Cloud,\s*AI\s*&\s*Digital Solutions["']/i.test(page)
    && /<meta[^>]+property=["']og:description["'][^>]+content=["']RedAnt Technologies Ltd builds scalable software,\s*mobile,\s*cloud,\s*data,\s*AI and geospatial solutions that help businesses innovate,\s*operate and grow\.["']/i.test(page)
    && /<meta[^>]+name=["']twitter:site["'][^>]+content=["']@RedAntTech["']/i.test(page)
    && /<script[^>]+src=["']\/assets\/index-[^"']+\.js["']/i.test(page)
    && /<link[^>]+href=["']\/assets\/index-[^"']+\.css["']/i.test(page)
    && /<div[^>]+id=["']root["'][^>]*><\/div>/i.test(page)
    && normalized.includes('RedAnt Technologies Ltd | Software, Cloud, AI & Digital Solutions')
}

export const hasCareerLikeLink = (html) =>
  CAREER_LIKE_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingRoute = (page = {}) => {
  if (Number(page?.status) !== 404) {
    return false
  }

  if (hasPublicJobsSignal(page?.html)) {
    return false
  }

  const normalized = normalizeWhitespace(page?.html)
  return /<title>\s*404 Not Found\s*<\/title>/i.test(String(page?.html ?? ''))
    && normalized.includes('404')
    && normalized.includes('Not Found')
    && normalized.includes('The resource requested could not be found on this server!')
}

export const isTemporaryHomepageUnavailableError = (error) => {
  const message = String(error?.message ?? error ?? '')
  const causeMessage = String(error?.cause?.message ?? '')
  const causeHostname = String(error?.cause?.hostname ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const diagnostic = `${message}\n${causeMessage}\n${causeHostname}\n${causeCode}`

  return diagnostic.includes('redanttech.com')
    && (
      /fetch failed/i.test(diagnostic)
      || /getaddrinfo/i.test(diagnostic)
      || /eai_again/i.test(diagnostic)
      || /enotfound/i.test(diagnostic)
      || /timeout/i.test(diagnostic)
      || /socket hang up/i.test(diagnostic)
    )
}

export const createRedAntTechnologiesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    let homepage
    try {
      homepage = await fetchPage(HOMEPAGE_URL)
    } catch (error) {
      if (isTemporaryHomepageUnavailableError(error)) {
        return []
      }

      throw error
    }

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('RedAnt Technologies verified official homepage no longer matches the known public surface')
    }

    if (hasCareerLikeLink(homepage.html)) {
      throw new Error('RedAnt Technologies homepage now exposes a first-party careers or jobs link')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('RedAnt Technologies homepage now exposes a public jobs surface')
    }

    for (const missingRouteUrl of MISSING_ROUTE_URLS) {
      const missingRoute = await fetchPage(missingRouteUrl)

      if (!isVerifiedMissingRoute(missingRoute)) {
        throw new Error('RedAnt Technologies careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createRedAntTechnologiesScraper().run(options)

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
