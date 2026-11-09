import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://www.deducetechnologies.com/'
export const CAREERS_URL = 'https://www.deducetechnologies.com/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const OFFICIAL_TITLE_PATTERN =
  /<title>\s*Deduce\s*(?:-|&mdash;|&#8212;|\u2014)\s*AI-Powered Maps\s*&(?:amp;)?\s*Location Intelligence(?: Platform)?\s*<\/title>/i
const OFFICIAL_DESCRIPTION_PATTERN =
  /<meta[^>]+name=["']description["'][^>]+content=["'][^"']*\bDeduce\b[^"']*(?:AI-powered|mapping|geospatial|location intelligence|navigation)[^"']*["']/i
const OFFICIAL_CANONICAL_PATTERN =
  /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.deducetechnologies\.com\/["']/i
const OFFICIAL_OG_DESCRIPTION_PATTERN =
  /<meta[^>]+property=["']og:description["'][^>]+content=["'][^"']*\bDeduce Technologies\b[^"']*(?:maps|geospatial|computer vision|location intelligence)[^"']*["']/i
const BUNDLE_SRC_PATTERN = /<script[^>]+type=["']module["'][^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/i

const CAREERS_ROUTE_PATTERN = /(?:title|label|children):"Careers"|link:"\/careers"|path:"\/Careers"/i
const OPEN_POSITIONS_PATTERN = /\bOpen Positions\b/i
const APPLY_NOW_PATTERN = /\bApply Now\b/i
const GOOGLE_FORM_PATTERN = /https:\/\/docs\.google\.com\/forms\/d\/e\/[^"'\s]+\/viewform/i

const PUBLIC_JOB_BOARD_PATTERN =
  /jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|workable\.com|smartrecruiters|workdayjobs|\bcurrent openings\b|\bjob openings\b|\bjob[-\s_]?(?:card|listing|result)s?\b|\/careers\/[a-z0-9-]+|view job|apply job/i

export const extractBundleUrl = (html, pageUrl = HOMEPAGE_URL) => {
  const match = String(html ?? '').match(BUNDLE_SRC_PATTERN)
  if (!match) return null

  try {
    return new URL(match[1], pageUrl).href
  } catch {
    return null
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return OFFICIAL_TITLE_PATTERN.test(page)
    && OFFICIAL_DESCRIPTION_PATTERN.test(page)
    && OFFICIAL_CANONICAL_PATTERN.test(page)
    && OFFICIAL_OG_DESCRIPTION_PATTERN.test(page)
    && Boolean(extractBundleUrl(page))
}

export const hasVerifiedApplyOnlyCareersSignal = (bundleText) => {
  const page = String(bundleText ?? '')

  return CAREERS_ROUTE_PATTERN.test(page)
    && OPEN_POSITIONS_PATTERN.test(page)
    && APPLY_NOW_PATTERN.test(page)
    && GOOGLE_FORM_PATTERN.test(page)
}

export const hasPublicJobBoardSignal = (bundleText) =>
  PUBLIC_JOB_BOARD_PATTERN.test(String(bundleText ?? ''))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'deducetechnologies',
  timeoutMs: 15000,
})

export const createDeduceTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Deduce Technologies official public site changed; refusing to assume no public listings')
    }

    const bundleUrl = extractBundleUrl(homepageHtml)
    const careersBundleText = await fetchText(bundleUrl)

    if (!hasVerifiedApplyOnlyCareersSignal(careersBundleText)) {
      throw new Error('Deduce Technologies verified apply-only careers surface changed; refusing to assume no public listings')
    }

    if (hasPublicJobBoardSignal(careersBundleText)) {
      throw new Error('Deduce Technologies careers surface now exposes public job listings and needs a structured scraper')
    }

    return []
  },
})

export const run = async (options = {}) => createDeduceTechnologiesScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'deducetechnologies')
  }
}
