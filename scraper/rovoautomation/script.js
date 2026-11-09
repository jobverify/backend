import path from 'path'
import { fileURLToPath } from 'url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const BARE_COMPANY_URL = 'https://rovoautomation.com/'
export const WWW_COMPANY_URL = 'https://www.rovoautomation.com/'
export const CAREERS_ROUTE_URL = 'https://rovoautomation.com/careers'
export const ASSET_MANIFEST_URL = 'https://rovoautomation.com/asset-manifest.json'
export const MAIN_JS_PATH = '/static/js/main.73712e12.js'
export const MAIN_CSS_PATH = '/static/css/main.74831a95.css'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const HOMEPAGE_TITLE_PATTERN = /<title>\s*RovoAutomation\s*-\s*IoT\s*&\s*Automation Solutions\s*<\/title>/i
const HOMEPAGE_DESCRIPTION_PATTERN = /<meta[^>]+name=["']description["'][^>]+content=["']RovoAutomation - IoT and Automation Solutions Provider["']/i
const ROOT_NODE_PATTERN = /<div id=["']root["']><\/div>/i
const MAIN_JS_PATTERN = /<script[^>]+src=["']\/static\/js\/main\.73712e12\.js["']/i
const MAIN_CSS_PATTERN = /<link[^>]+href=["']\/static\/css\/main\.74831a95\.css["'][^>]+rel=["']stylesheet["']/i

const EXPECTED_ROUTE_SNIPPETS = [
  'to:"/about"',
  'to:"/product"',
  'to:"/solutions"',
  'to:"/contact"',
  'path:"/rovoconnect"',
  'path:"/rovovision"',
  'path:"/user"',
  'path:"/andon"',
  'path:"/OEE"',
  'path:"/visitech"',
  'path:"/rovopepole"',
]

const HIRING_SIGNAL_PATTERN =
  /\b(career|careers|job opening|job openings|jobs|join us|we are hiring|hiring|apply now|open positions?)\b/i
const OFFICIAL_ATS_SIGNAL_PATTERN =
  /\b(greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|myworkdayjobs\.com|smartrecruiters\.com|jobvite\.com|bamboohr\.com|teamtailor\.com|recruitee\.com)\b/i

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'rovoautomation:text',
  timeoutMs: 15000,
})

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
  },
  label: 'rovoautomation:json',
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return HOMEPAGE_TITLE_PATTERN.test(page)
    && HOMEPAGE_DESCRIPTION_PATTERN.test(page)
    && ROOT_NODE_PATTERN.test(page)
    && MAIN_JS_PATTERN.test(page)
    && MAIN_CSS_PATTERN.test(page)
}

export const isSpaShellWithoutHiringSurface = (html) =>
  hasOfficialHomepageSignal(html) && !HIRING_SIGNAL_PATTERN.test(String(html ?? ''))

export const hasExpectedAssetManifest = (manifest) => {
  const files = manifest?.files ?? {}
  const entrypoints = Array.isArray(manifest?.entrypoints) ? manifest.entrypoints : []

  return files['main.js'] === MAIN_JS_PATH
    && files['main.css'] === MAIN_CSS_PATH
    && entrypoints.includes(MAIN_JS_PATH.slice(1))
    && entrypoints.includes(MAIN_CSS_PATH.slice(1))
}

const hasExpectedBundleSignals = (bundleText) =>
  EXPECTED_ROUTE_SNIPPETS.every((snippet) => String(bundleText ?? '').includes(snippet))

export const lacksHiringSignals = (bundleText) => {
  const bundle = String(bundleText ?? '')
  return !HIRING_SIGNAL_PATTERN.test(bundle) && !OFFICIAL_ATS_SIGNAL_PATTERN.test(bundle)
}

const validateEmptyJobs = (jobs) => {
  if (!Array.isArray(jobs) || jobs.length !== 0) {
    throw new Error('Rovo Automation scraper expected no public listings from the verified official surface')
  }

  return jobs
}

export const createRovoAutomationScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const homepageHtml = await fetchText(BARE_COMPANY_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Rovo Automation homepage no longer matches the verified official first-party site')
    }

    const careersHtml = await fetchText(CAREERS_ROUTE_URL)

    if (!isSpaShellWithoutHiringSurface(careersHtml)) {
      throw new Error('Rovo Automation careers route no longer matches the verified non-listing SPA shell')
    }

    const assetManifest = await fetchJson(ASSET_MANIFEST_URL)

    if (!hasExpectedAssetManifest(assetManifest)) {
      throw new Error('Rovo Automation asset manifest no longer matches the verified non-listing build')
    }

    const bundleText = await fetchText(`https://rovoautomation.com${MAIN_JS_PATH}`)

    if (!hasExpectedBundleSignals(bundleText) || !lacksHiringSignals(bundleText)) {
      throw new Error('Rovo Automation bundle no longer matches the verified non-listing surface')
    }

    return validateEmptyJobs([])
  },
})

export const run = async () => createRovoAutomationScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'rovoautomation')
  }
}
