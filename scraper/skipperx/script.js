import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'skipperx'
export const COMPANY = 'SkipperX'
export const HOMEPAGE_URL = 'https://www.skipperx.io/'
export const CAREERS_URL = 'https://www.skipperx.io/careers'
export const JOBS_URL = 'https://www.skipperx.io/jobs'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_TITLE_PATTERN =
  /<title>\s*SkipperX\s*-\s*Built for Innovators,\s*Entrepreneur\s*(?:&|&amp;)\s*Hustlers\s*<\/title>/i
const DESCRIPTION_PATTERN =
  /<meta[^>]+name=["']description["'][^>]+content=["']Your dream skill is,\s*not days,\s*not hours but minutes away\.["']/i
const AUTHOR_PATTERN = /<meta[^>]+name=["']author["'][^>]+content=["']SkipperX Team["']/i
const OG_URL_PATTERN = /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/skipperx\.io["']/i
const ROOT_DIV_PATTERN = /<div[^>]+id=["']root["'][^>]*><\/div>/i
const MAIN_SCRIPT_PATH_PATTERN = /<script[^>]+src=["'](?<src>\/static\/js\/main\.[^"']+\.js)["']/i
const MAIN_STYLE_PATH_PATTERN = /<link[^>]+href=["'](?<href>\/static\/css\/main\.[^"']+\.css)["']/i

const HERO_COPY_PATTERN =
  /Your dream skill is, not days, not hours but[\s\S]{0,120}minutes[\s\S]{0,120}away/i
const TAGLINE_PATTERN = /Built for Innovators,\s*Entrepreneurs?\s*&\s*Hustlers/i
const SUPPORT_EMAIL_PATTERN = /support@skipperx\.io/i
const CAREERS_TEXT_PATTERN = /\bCareers\b/
const ABOUT_TEXT_PATTERN = /\bAbout Us\b/
const CONTACT_TEXT_PATTERN = /\bContact Us\b/
const PUBLIC_CAREER_ROUTE_PATTERN = /(?:path|to|href):"\/(?:careers?|jobs)(?:\/)?"/i
const PUBLIC_JOB_BOARD_PATTERN =
  /\b(open roles|job openings|current openings|available positions|view openings|search jobs|we(?:'|’)re hiring)\b|boards\.greenhouse\.io|jobs\.lever\.co|ashbyhq\.com|myworkdayjobs|workdayjobs|jobvite|smartrecruiters/i

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const extractAssetPath = (html, pattern, groupName) => {
  const match = String(html ?? '').match(pattern)
  return normalizeWhitespace(match?.groups?.[groupName] ?? '')
}

const extractTitle = (html) => {
  const match = String(html ?? '').match(/<title[^>]*>(.*?)<\/title>/i)
  return normalizeWhitespace(match?.[1] ?? '')
}

export const extractMainScriptUrl = (html, baseUrl = HOMEPAGE_URL) => {
  const scriptPath = extractAssetPath(html, MAIN_SCRIPT_PATH_PATTERN, 'src')
  if (!scriptPath) return ''
  return new URL(scriptPath, baseUrl).toString()
}

const extractMainStyleUrl = (html, baseUrl = HOMEPAGE_URL) => {
  const stylePath = extractAssetPath(html, MAIN_STYLE_PATH_PATTERN, 'href')
  if (!stylePath) return ''
  return new URL(stylePath, baseUrl).toString()
}

const getShellFingerprint = (html, baseUrl = HOMEPAGE_URL) => ({
  title: extractTitle(html),
  scriptUrl: extractMainScriptUrl(html, baseUrl),
  styleUrl: extractMainStyleUrl(html, baseUrl),
})

export const hasOfficialHomepageShell = (html) => {
  const page = String(html ?? '')
  const shell = getShellFingerprint(page, HOMEPAGE_URL)

  return OFFICIAL_TITLE_PATTERN.test(page)
    && DESCRIPTION_PATTERN.test(page)
    && AUTHOR_PATTERN.test(page)
    && OG_URL_PATTERN.test(page)
    && ROOT_DIV_PATTERN.test(page)
    && Boolean(shell.scriptUrl)
    && Boolean(shell.styleUrl)
}

export const hasOfficialRouteShell = (html) => {
  const page = String(html ?? '')
  const shell = getShellFingerprint(page, HOMEPAGE_URL)

  return OFFICIAL_TITLE_PATTERN.test(page)
    && DESCRIPTION_PATTERN.test(page)
    && AUTHOR_PATTERN.test(page)
    && OG_URL_PATTERN.test(page)
    && ROOT_DIV_PATTERN.test(page)
    && Boolean(shell.scriptUrl)
    && Boolean(shell.styleUrl)
}

const routeMatchesHomepageShell = (homepageHtml, routeHtml, routeUrl) => {
  const homepageShell = getShellFingerprint(homepageHtml, HOMEPAGE_URL)
  const routeShell = getShellFingerprint(routeHtml, routeUrl)

  return homepageShell.title === routeShell.title
    && homepageShell.scriptUrl === routeShell.scriptUrl
    && homepageShell.styleUrl === routeShell.styleUrl
}

export const hasOfficialBundleSignals = (bundleJs) => {
  const bundle = String(bundleJs ?? '')

  return HERO_COPY_PATTERN.test(bundle)
    && TAGLINE_PATTERN.test(bundle)
    && SUPPORT_EMAIL_PATTERN.test(bundle)
    && CAREERS_TEXT_PATTERN.test(bundle)
    && ABOUT_TEXT_PATTERN.test(bundle)
    && CONTACT_TEXT_PATTERN.test(bundle)
}

export const definesPublicCareerRoute = (bundleJs) =>
  PUBLIC_CAREER_ROUTE_PATTERN.test(String(bundleJs ?? ''))

export const hasPublicJobBoardSignal = (value) =>
  PUBLIC_JOB_BOARD_PATTERN.test(String(value ?? ''))

const defaultFetchText = (url) =>
  fetchTextWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    label: SOURCE,
    timeoutMs: 15000,
  })

export const createSkipperXScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageShell(homepageHtml)) {
      throw new Error('SkipperX verified official homepage shell no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialRouteShell(careersHtml) || !routeMatchesHomepageShell(homepageHtml, careersHtml, CAREERS_URL)) {
      throw new Error('SkipperX verified careers route no longer matches the trusted blank first-party app shell')
    }

    const jobsHtml = await fetchText(JOBS_URL)
    if (!hasOfficialRouteShell(jobsHtml) || !routeMatchesHomepageShell(homepageHtml, jobsHtml, JOBS_URL)) {
      throw new Error('SkipperX verified jobs route no longer matches the trusted blank first-party app shell')
    }

    if (hasPublicJobBoardSignal(homepageHtml) || hasPublicJobBoardSignal(careersHtml) || hasPublicJobBoardSignal(jobsHtml)) {
      throw new Error('SkipperX public surface now appears to expose a public jobs surface')
    }

    const mainScriptUrl = extractMainScriptUrl(homepageHtml, HOMEPAGE_URL)
    const bundleJs = await fetchText(mainScriptUrl)

    if (definesPublicCareerRoute(bundleJs)) {
      throw new Error('SkipperX public careers route now appears to be wired to a first-party page')
    }

    if (hasPublicJobBoardSignal(bundleJs)) {
      throw new Error('SkipperX public surface now appears to expose a public jobs surface')
    }

    if (!hasOfficialBundleSignals(bundleJs)) {
      throw new Error('SkipperX verified frontend bundle no longer matches the trusted first-party no-public-careers state')
    }

    return []
  },
})

export const run = async (options = {}) => createSkipperXScraper().run(options)

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
