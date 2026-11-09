import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { GAMESKRAFT_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'gameskraft'
export const COMPANY = 'GamesKraft'
export const VERIFIED_AT = '2026-07-15'
export const HOMEPAGE_URL = 'https://gameskraft.com/'
export const WWW_HOMEPAGE_URL = 'https://www.gameskraft.com/'
export const CAREERS_URL = 'https://gameskraft.com/careers'
export const LANDER_URL = 'https://gameskraft.com/lander'
export const ROBOTS_TXT_URL = 'https://gameskraft.com/robots.txt'
export const SITEMAP_URL = 'https://gameskraft.com/sitemap.xml'
export const LLMS_TXT_URL = 'https://gameskraft.com/llms.txt'
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://gameskraft.com/jobs',
  'https://gameskraft.com/current-openings',
]
export const PROVIDER_METADATA = GAMESKRAFT_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bview openings\b/i,
  /\bopen roles\b/i,
  /\bjoin our team\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
]

const normalizeText = (value) => String(value ?? '')
  .replace(/\r/g, '')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractRedirectTarget = (html) => {
  const match = /window\.location\.href\s*=\s*["']([^"']+)["']/i.exec(String(html ?? ''))
  return match?.[1] ?? null
}

export const hasRedirectShellSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /<!DOCTYPE html>/i.test(rawHtml)
    && /window\.onload\s*=\s*function\s*\(\)\s*\{\s*window\.location\.href\s*=\s*["']\/lander["']\s*\}/i.test(rawHtml)
}

export const hasParkedLanderSignal = (html) => {
  const rawHtml = String(html ?? '')

  return /window\.LANDER_SYSTEM\s*=\s*["']PW["']/i.test(rawHtml)
    && /window\._trfd\s*=\s*window\._trfd\s*\|\|\s*\[\]/i.test(rawHtml)
    && /parking-lander\/static\/js\//i.test(rawHtml)
    && /parking-lander\/static\/css\//i.test(rawHtml)
    && /img1\.wsimg\.com\/signals\/js\/clients\/scc-c2\/scc-c2\.min\.js/i.test(rawHtml)
    && /<div id=["']root["']><\/div>/i.test(rawHtml)
}

export const extractSitemapUrls = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1].trim())

export const hasVerifiedSitemapSignal = (xml) => {
  const urls = extractSitemapUrls(xml)
  return urls.length === 1 && urls[0] === LANDER_URL
}

export const hasVerifiedRobotsSignal = (text) =>
  normalizeText(text) === 'User-agent: *\nAllow: /\nLLM-Policy: /llms.txt\nSitemap: /sitemap.xml'

export const hasVerifiedLlmsSignal = (text) =>
  normalizeText(text) === 'User-agent: *\nAllow: /\nDisallow-Training: /\nSitemap: /sitemap.xml'

export const createGamesKraftScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const url of [HOMEPAGE_URL, WWW_HOMEPAGE_URL, CAREERS_URL]) {
      const page = await fetchPage(url)

      if (
        page.status !== 200
        || !hasRedirectShellSignal(page.html)
        || extractRedirectTarget(page.html) !== '/lander'
      ) {
        throw new Error(`GamesKraft verified redirect shell changed: ${page.url || url}`)
      }

      if (hasPublicJobsSignal(page.html)) {
        throw new Error(`GamesKraft verified redirect shell now exposes jobs: ${page.url || url}`)
      }
    }

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (
        routePage.status !== 200
        || !hasRedirectShellSignal(routePage.html)
        || extractRedirectTarget(routePage.html) !== '/lander'
      ) {
        throw new Error(`GamesKraft verified no-public-job route changed: ${routePage.url || routeUrl}`)
      }

      if (hasPublicJobsSignal(routePage.html)) {
        throw new Error(`GamesKraft verified no-public-job route changed: ${routePage.url || routeUrl}`)
      }
    }

    const lander = await fetchPage(LANDER_URL)
    if (lander.status !== 200 || !hasParkedLanderSignal(lander.html) || hasPublicJobsSignal(lander.html)) {
      throw new Error('GamesKraft verified parked lander surface changed or now exposes public jobs')
    }

    const robots = await fetchPage(ROBOTS_TXT_URL)
    if (robots.status !== 200 || !hasVerifiedRobotsSignal(robots.html)) {
      throw new Error('GamesKraft verified robots surface changed')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || !hasVerifiedSitemapSignal(sitemap.html)) {
      throw new Error('GamesKraft verified sitemap surface changed')
    }

    const llms = await fetchPage(LLMS_TXT_URL)
    if (llms.status !== 200 || !hasVerifiedLlmsSignal(llms.html)) {
      throw new Error('GamesKraft verified llms surface changed')
    }

    return []
  },
})

export const run = async (options = {}) => createGamesKraftScraper().run(options)

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
