import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'quantumaiglobal'
export const COMPANY = 'Quantum AI Global'
export const VERIFIED_AT = '2026-07-13'
export const HOMEPAGE_URL = 'https://quantumaiglobal.com/'
export const WWW_HOMEPAGE_URL = 'https://www.quantumaiglobal.com/'
export const LANDER_URL = 'https://quantumaiglobal.com/lander'
export const ROBOTS_URL = 'https://quantumaiglobal.com/robots.txt'
export const SITEMAP_URL = 'https://quantumaiglobal.com/sitemap.xml'
export const CHECKED_ROUTE_URLS = [
  'https://quantumaiglobal.com/careers',
  'https://quantumaiglobal.com/career',
  'https://quantumaiglobal.com/jobs',
  'https://quantumaiglobal.com/join-us',
  'https://quantumaiglobal.com/about',
  'https://quantumaiglobal.com/contact',
]

const REDIRECT_SHELL_URLS = [
  HOMEPAGE_URL,
  WWW_HOMEPAGE_URL,
  ...CHECKED_ROUTE_URLS,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen roles?\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bapply now\b/i,
  /\bjoin our team\b/i,
  /\bview jobs\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /recruitcrm/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\r/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const compactMarkup = (value) => normalizeWhitespace(value).replace(/>\s+</g, '><')

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const extractRedirectTarget = (html) => {
  const match = /window\.location\.href\s*=\s*["']([^"']+)["']/i.exec(String(html ?? ''))
  return match?.[1] ?? null
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasRedirectShellSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /<!DOCTYPE html>/i.test(rawHtml)
    && /window\.onload\s*=\s*function\s*\(\)\s*\{\s*window\.location\.href\s*=\s*["']\/lander["']\s*\}/i.test(rawHtml)
    && !hasPublicJobsSignal(rawHtml)
}

export const hasParkedLanderSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /window\.LANDER_SYSTEM\s*=\s*["']PW["']/i.test(rawHtml)
    && /window\._trfd\s*=\s*window\._trfd\s*\|\|\s*\[\]/i.test(rawHtml)
    && /_trfd\.push\(\{ap:\s*["']parking["']\}\)/i.test(rawHtml)
    && /window\._signalsDataLayer\s*=\s*window\._signalsDataLayer\s*\|\|\s*\[\]/i.test(rawHtml)
    && /img1\.wsimg\.com\/signals\/js\/clients\/scc-c2\/scc-c2\.min\.js/i.test(rawHtml)
    && /parking-lander\/static\/js\//i.test(rawHtml)
    && /parking-lander\/static\/css\//i.test(rawHtml)
    && /<div id=["']root["']><\/div>/i.test(rawHtml)
    && !hasPublicJobsSignal(rawHtml)
}

export const hasVerifiedRobotsSignal = (text) =>
  normalizeWhitespace(text).toLowerCase() === 'user-agent: * allow: / llm-policy: /llms.txt sitemap: /sitemap.xml'

export const hasVerifiedSitemapSignal = (xml) =>
  /^<\?xml version=["']1\.0["'] encoding=["']UTF-8["']\?><urlset\b[^>]*><url><loc>https:\/\/quantumaiglobal\.com\/lander<\/loc><\/url><\/urlset>$/i
    .test(compactMarkup(xml))

export const createQuantumAIGlobalScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const url of REDIRECT_SHELL_URLS) {
      const page = await fetchPage(url)

      if (page.status !== 200) {
        throw new Error(`Quantum AI Global verified redirect shell changed: ${page.url || url}`)
      }

      if (hasPublicJobsSignal(page.html)) {
        throw new Error(`Quantum AI Global first-party route now exposes public jobs: ${page.url || url}`)
      }

      if (!hasRedirectShellSignal(page.html) || extractRedirectTarget(page.html) !== '/lander') {
        throw new Error(`Quantum AI Global verified redirect shell changed: ${page.url || url}`)
      }
    }

    const landerPage = await fetchPage(LANDER_URL)

    if (landerPage.status !== 200 || !hasParkedLanderSignal(landerPage.html)) {
      throw new Error('Quantum AI Global verified parked lander changed')
    }

    if (hasPublicJobsSignal(landerPage.html)) {
      throw new Error('Quantum AI Global parked lander now exposes public jobs')
    }

    const robotsPage = await fetchPage(ROBOTS_URL)

    if (robotsPage.status !== 200 || !hasVerifiedRobotsSignal(robotsPage.html)) {
      throw new Error('Quantum AI Global verified robots.txt contract changed')
    }

    if (hasPublicJobsSignal(robotsPage.html)) {
      throw new Error('Quantum AI Global robots.txt now exposes public jobs')
    }

    const sitemapPage = await fetchPage(SITEMAP_URL)

    if (sitemapPage.status !== 200 || !hasVerifiedSitemapSignal(sitemapPage.html)) {
      throw new Error('Quantum AI Global verified sitemap.xml contract changed')
    }

    if (hasPublicJobsSignal(sitemapPage.html)) {
      throw new Error('Quantum AI Global sitemap.xml now exposes public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createQuantumAIGlobalScraper().run(options)

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
