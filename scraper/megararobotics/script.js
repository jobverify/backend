import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'megararobotics'
export const COMPANY = 'Megara Robotics'
export const HOMEPAGE_URL = 'https://megararobotics.com/'
export const CAREERS_ROUTE_URLS = [
  'https://megararobotics.com/careers',
  'https://megararobotics.com/career',
  'https://megararobotics.com/jobs',
  'https://megararobotics.com/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_SIGNAL_PATTERNS = [
  /<title>\s*Megara Robotics(?: \| Intelligent Robotics Solutions)?\s*<\/title>/i,
  /href="\/megaraLogo\.png"/i,
  /hero-poster_kgvbtu\.webp/i,
  /<div id="root"><\/div>/i,
  /<script[^>]+src="\/assets\/index-[^"]+\.js"/i,
  /<link rel="stylesheet"[^>]+href="\/assets\/index-[^"]+\.css"/i,
]

const BUNDLE_IDENTITY_PATTERNS = [
  /Megara Robotics/i,
  /Periyar Salai/i,
  /Ayanavaram/i,
  /Chennai,\s*India/i,
  /linkedin\.com\/company\/megararobotics/i,
  /Get in Touch/i,
]

const BUNDLE_ROUTE_PATTERNS = [
  /\/products/i,
  /\/about/i,
  /\/contact/i,
]

const PUBLIC_CAREERS_SIGNAL_PATTERNS = [
  /path:\s*"\/careers"/i,
  /path:\s*"\/career"/i,
  /path:\s*"\/jobs"/i,
  /href:\s*"\/careers"/i,
  /href:\s*"\/career"/i,
  /href:\s*"\/jobs"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bwe are hiring\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /greenhouse\.io/i,
  /keka\.com\/careers/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/javascript,application/javascript;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const extractBundleAssetUrl = (html, baseUrl = HOMEPAGE_URL) => {
  const match = String(html ?? '').match(/<script[^>]+src="([^"]*\/assets\/index-[^"]+\.js)"/i)
  if (!match) return null

  return new URL(match[1], baseUrl).toString()
}

export const hasOfficialHomepageShellSignal = (html) =>
  HOMEPAGE_SIGNAL_PATTERNS.every((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialBundleSignal = (bundle) => {
  const source = String(bundle ?? '')

  return BUNDLE_IDENTITY_PATTERNS.every((pattern) => pattern.test(source))
    && BUNDLE_ROUTE_PATTERNS.every((pattern) => pattern.test(source))
}

export const bundleHasPublicCareersSignal = (bundle) =>
  PUBLIC_CAREERS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(bundle ?? '')))

export const isVerifiedShellFallback = (pageHtml, homepageHtml) => {
  if (!hasOfficialHomepageShellSignal(pageHtml) || !hasOfficialHomepageShellSignal(homepageHtml)) {
    return false
  }

  const expectedBundleUrl = extractBundleAssetUrl(homepageHtml, HOMEPAGE_URL)
  const actualBundleUrl = extractBundleAssetUrl(pageHtml, HOMEPAGE_URL)

  if (!expectedBundleUrl || !actualBundleUrl || expectedBundleUrl !== actualBundleUrl) {
    return false
  }

  return normalizeWhitespace(pageHtml) === normalizeWhitespace(homepageHtml)
}

export const createMegaraRoboticsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageShellSignal(homepage.html)) {
      throw new Error(
        'Megara Robotics official homepage shell no longer matches the verified first-party surface',
      )
    }

    const bundleUrl = extractBundleAssetUrl(homepage.html, homepage.url || HOMEPAGE_URL)
    if (!bundleUrl) {
      throw new Error('Megara Robotics official homepage shell no longer exposes the verified client bundle asset')
    }

    const bundle = await fetchPage(bundleUrl)
    if (bundle.status !== 200 || !hasOfficialBundleSignal(bundle.html)) {
      throw new Error(
        'Megara Robotics client bundle no longer matches the verified first-party identity and route map',
      )
    }

    if (bundleHasPublicCareersSignal(bundle.html)) {
      throw new Error('Megara Robotics client bundle now appears to expose a public careers surface')
    }

    for (const routeUrl of CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (routePage.status !== 200 || !isVerifiedShellFallback(routePage.html, homepage.html)) {
        throw new Error('Megara Robotics careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createMegaraRoboticsScraper().run(options)

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
