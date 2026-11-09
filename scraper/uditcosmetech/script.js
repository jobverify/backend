import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'uditcosmetech'
export const COMPANY = 'UDITCosmetech'
export const HOMEPAGE_URL = 'https://uditcosmetech.com/'
export const ROBOTS_URL = 'https://uditcosmetech.com/robots.txt'
export const BUNDLE_URL = 'https://uditcosmetech.com/static/js/main.2c565de5.js'
export const NON_LISTING_ROUTE_URLS = [
  'https://uditcosmetech.com/careers',
  'https://uditcosmetech.com/career',
  'https://uditcosmetech.com/jobs',
  'https://uditcosmetech.com/join-us',
  'https://uditcosmetech.com/work-with-us',
  'https://uditcosmetech.com/sitemap.xml',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const SHELL_JOBS_SIGNAL_PATTERNS = [
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /recruitee/i,
  /zohorecruit/i,
  /freshteam/i,
  /darwinbox/i,
]

const BUNDLE_JOBS_SIGNAL_PATTERNS = [
  ...SHELL_JOBS_SIGNAL_PATTERNS,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /"@type"\s*:\s*"JobPosting"/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: url.endsWith('.txt')
        ? 'text/plain,text/*;q=0.9,*/*;q=0.8'
        : 'text/html,application/javascript,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const extractBundlePath = (html = '') => {
  const match = String(html ?? '').match(/<script[^>]+src=["']([^"']*\/static\/js\/main\.[^"']+\.js)["']/i)
  return match?.[1] ?? null
}

export const hasOfficialShellSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*UDIT Cosmetech\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["']UDIT Cosmetech\s*[–-]\s*Empowering Digital Growth through Technology, Creativity, and Innovation\.[^"']*["']/i.test(page)
    && /<meta[^>]+property=["']og:title["'][^>]+content=["']UDIT Cosmetech["']/i.test(page)
    && /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/uditcosmetics\.com["']/i.test(page)
    && /<meta[^>]+name=["']twitter:title["'][^>]+content=["']UDIT Cosmetech["']/i.test(page)
    && /<link[^>]+rel=["']manifest["'][^>]+href=["']\/manifest\.json["']/i.test(page)
    && /<noscript>\s*You need to enable JavaScript to run this app\.\s*<\/noscript>/i.test(page)
    && /<div[^>]+id=["']root["'][^>]*><\/div>/i.test(page)
    && extractBundlePath(page) === '/static/js/main.2c565de5.js'
}

export const hasVerifiedRobotsSignal = (text = '') => {
  const normalized = normalizeWhitespace(text)
  return normalized === '# https://www.robotstxt.org/robotstxt.html User-agent: * Disallow:'
}

export const hasOfficialBundleSignal = (bundleJs = '') => {
  const text = String(bundleJs ?? '')

  return /What We Do/i.test(text)
    && /Healthcare Application Development/i.test(text)
    && /Cloud & DevOps Engineering/i.test(text)
    && /Cosmetic Research & Innovation/i.test(text)
    && /Join Us on Our Journey/i.test(text)
    && /UDIT CosmeTech welcomes you to collaborate and innovate with us/i.test(text)
    && /Drop us a line!?/i.test(text)
    && /support@uditcosmetics\.com/i.test(text)
    && /mail\.google\.com\/mail\/\?view=cm&fs=1&to=support@uditcosmetics\.com/i.test(text)
    && /Coimbatore North,\s*Coimbatore,\s*Tamil Nadu,\s*India\s*-\s*641035/i.test(text)
    && /Open today/i.test(text)
    && /09:00 am/i.test(text)
    && /05:00 pm/i.test(text)
    && /Powered by UditCosmetech/i.test(text)
}

export const hasPublicJobsSignal = (value = '') => {
  const text = String(value ?? '')
  const patterns = text.includes('Drop us a line!') || text.includes('Join Us on Our Journey')
    ? BUNDLE_JOBS_SIGNAL_PATTERNS
    : SHELL_JOBS_SIGNAL_PATTERNS

  return patterns.some((pattern) => pattern.test(text))
}

export const createUDITCosmetechScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialShellSignal(homepageHtml)) {
      throw new Error('UDITCosmetech verified official shell no longer matches the current first-party non-listing surface')
    }
    if (hasPublicJobsSignal(homepageHtml)) {
      throw new Error('UDITCosmetech official shell now appears to expose public jobs')
    }

    const robotsTxt = await fetchText(ROBOTS_URL)
    if (!hasVerifiedRobotsSignal(robotsTxt)) {
      throw new Error('UDITCosmetech robots.txt no longer matches the verified public surface')
    }
    if (hasPublicJobsSignal(robotsTxt)) {
      throw new Error('UDITCosmetech robots.txt now appears to reference public jobs')
    }

    const bundleJs = await fetchText(BUNDLE_URL)
    if (!hasOfficialBundleSignal(bundleJs)) {
      throw new Error('UDITCosmetech verified official bundle no longer matches the current first-party non-listing surface')
    }
    if (hasPublicJobsSignal(bundleJs)) {
      throw new Error('UDITCosmetech bundle now appears to expose public jobs')
    }

    for (const routeUrl of NON_LISTING_ROUTE_URLS) {
      const routeHtml = await fetchText(routeUrl)
      if (!hasOfficialShellSignal(routeHtml) || extractBundlePath(routeHtml) !== extractBundlePath(homepageHtml)) {
        throw new Error(`UDITCosmetech non-listing route changed materially: ${routeUrl}`)
      }
      if (hasPublicJobsSignal(routeHtml)) {
        throw new Error(`UDITCosmetech non-listing route now appears to expose public jobs: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createUDITCosmetechScraper().run(options)

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
