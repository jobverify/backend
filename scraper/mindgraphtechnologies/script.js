import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mindgraphtechnologies'
export const COMPANY = 'Mindgraph Technologies'
export const HOMEPAGE_URL = 'https://mind-graph.com/'
export const PUBLIC_JOB_ROUTE_URLS = [
  'https://mind-graph.com/careers',
  'https://mind-graph.com/careers/',
  'https://mind-graph.com/jobs',
  'https://mind-graph.com/jobs/',
  'https://mind-graph.com/join-us',
  'https://mind-graph.com/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bview jobs\b/i,
  /\bjob description\b/i,
  /\bapply now\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /zohorecruit/i,
]

const KNOWN_ROUTE_MARKERS = [
  '/aboutUs',
  '/contactUs',
  '/blog',
  '/blog/:slug',
]

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

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&#x27;|\u2019/gi, "'")
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
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Mind Graph\s*<\/title>/i.test(page)
    && /<meta[^>]+property=["']og:title["'][^>]+content=["']AI Enterprises Company \| Innovate with Mind Graph["']/i.test(page)
    && /<meta[^>]+property=["']og:description["'][^>]+content=["']Empower your business with a top AI enterprises company\. Mind Graph delivers cutting-edge IT solutions\.[^"']*["']/i.test(page)
    && /<script[^>]+type=["']module["'][^>]+src=["']\/assets\/index-[^"']+\.js["']/i.test(page)
    && /<div id=["']root["']><\/div>/i.test(page)
}

export const hasBrochureShellSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*Mind Graph\s*<\/title>/i.test(page)
    && /<script[^>]+type=["']module["'][^>]+src=["']\/assets\/index-[^"']+\.js["']/i.test(page)
    && /<div id=["']root["']><\/div>/i.test(page)
}

export const hasSuspendedAccountSignal = (html = '') => {
  const text = normalizeWhitespace(html).toLowerCase()

  return text.includes('account suspended')
    && text.includes('this account has been suspended')
    && text.includes('contact your hosting provider')
    && !hasPublicJobsSignal(html)
}

export const extractBundleUrl = (html = '') => {
  const match = String(html ?? '').match(/<script[^>]+type=["']module["'][^>]+src=["'](?<src>\/assets\/index-[^"']+\.js)["']/i)
  if (!match?.groups?.src) {
    return null
  }

  return new URL(match.groups.src, HOMEPAGE_URL).toString()
}

export const hasPublicJobsSignal = (html = '') =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedRouteTableSignal = (bundleJs = '') => {
  const source = String(bundleJs ?? '')
  return KNOWN_ROUTE_MARKERS.every((marker) => source.includes(marker))
    && !/path:\s*["']\/careers\/?["']/i.test(source)
    && !/path:\s*["']\/jobs\/?["']/i.test(source)
    && !/path:\s*["']\/join-us\/?["']/i.test(source)
    && !hasPublicJobsSignal(source)
}

export const createMindgraphTechnologiesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status === 200 && hasSuspendedAccountSignal(homepage.html)) {
      for (const routeUrl of PUBLIC_JOB_ROUTE_URLS) {
        const routePage = await fetchPage(routeUrl)
        if (routePage.status !== 200 || !hasSuspendedAccountSignal(routePage.html)) {
          throw new Error(`Mindgraph Technologies public jobs route ${routeUrl} no longer matches the verified suspended-site shell`)
        }
      }

      return []
    }

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Mindgraph Technologies verified official homepage no longer matches the trusted first-party surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Mindgraph Technologies homepage now appears to expose public openings')
    }

    const bundleUrl = extractBundleUrl(homepage.html)
    if (!bundleUrl) {
      throw new Error('Mindgraph Technologies verified homepage no longer exposes the trusted application bundle')
    }

    const bundle = await fetchPage(bundleUrl)
    if (bundle.status !== 200 || !hasVerifiedRouteTableSignal(bundle.html)) {
      throw new Error('Mindgraph Technologies verified route table no longer matches the trusted zero-job state')
    }

    for (const routeUrl of PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (routePage.status !== 200 || !hasBrochureShellSignal(routePage.html)) {
        throw new Error(`Mindgraph Technologies public jobs route ${routeUrl} no longer matches the verified brochure-site shell`)
      }

      if (hasPublicJobsSignal(routePage.html)) {
        throw new Error(`Mindgraph Technologies public jobs route ${routeUrl} now appears to expose public openings`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createMindgraphTechnologiesScraper().run(options)

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
