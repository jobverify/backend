import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'truestate'
export const COMPANY = 'TruEstate'
export const HOMEPAGE_URL = 'https://truestate.in/'
export const CAREERS_URL = 'https://truestate.in/careers'
export const JOBS_URL = 'https://truestate.in/jobs'
export const SITEMAP_URL = 'https://truestate.in/sitemap-static.xml'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bview openings\b/i,
  /\bview jobs\b/i,
  /\bsearch jobs\b/i,
  /\bjob description\b/i,
  /\bjob postings?\b/i,
  /\b(?:jobs?|openings?|roles?)\b[\s\S]{0,40}\bapply\b/i,
  /\bapply\b[\s\S]{0,40}\b(?:jobs?|openings?|roles?)\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasPublicJobsSignal = (value) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(value ?? '')))

export const extractBundleUrl = (html, pageUrl = HOMEPAGE_URL) => {
  const match = String(html ?? '').match(/<script[^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/i)
  if (!match) return null

  try {
    return new URL(match[1], pageUrl).toString()
  } catch {
    return null
  }
}

export const hasShellSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*TruEstate\s*<\/title>/i.test(page)
    && /id=["']root["']/i.test(page)
    && /href=["']\/trap\/scraper-detected["']/i.test(page)
    && /mailto:bot-trap@truestate\.in/i.test(page)
    && Boolean(extractBundleUrl(page, HOMEPAGE_URL))
}

export const hasHomepageBundleSignal = (js) => {
  const source = String(js ?? '')

  return source.includes("Bangalore's only ")
    && source.includes('fair-price')
    && source.includes('engine.')
    && source.includes('Book a demo')
    && source.includes("Modernizing real estate intelligence with India's first unified property data platform.")
    && /path:\s*"\/"/i.test(source)
  }

export const hasCareersBundleSignal = (js) => {
  const source = String(js ?? '')

  return source.includes('Join the Mission')
    && source.includes('Build the future of ')
    && source.includes('Real Estate Intelligence')
    && source.includes("While we don't have any open roles right now, we're always looking for exceptional talent.")
    && source.includes('Drop your Resume')
    && source.includes('mailto:akshay@truestate.in')
    && source.includes('mailto:contact@truestate.in')
    && /path:\s*"careers"/i.test(source)
  }

export const hasJobsFallbackSignal = (js) => {
  const source = String(js ?? '')

  return /path:\s*"\*"/i.test(source)
    && /path:\s*"\/"/i.test(source)
    && source.includes("Bangalore's only ")
    && source.includes('fair-price')
    && source.includes('engine.')
  }

export const hasVerifiedSitemapSignal = (xml) => {
  const source = String(xml ?? '')

  return source.includes('<loc>https://truestate.in/</loc>')
    && source.includes('<loc>https://truestate.in/careers</loc>')
    && source.includes('<loc>https://truestate.in/contact</loc>')
    && !source.includes('<loc>https://truestate.in/jobs</loc>')
  }

export const createTruEstateScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasShellSignal(homepageHtml)) {
      throw new Error('TruEstate verified homepage no longer matches the official first-party shell')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasShellSignal(careersHtml)) {
      throw new Error('TruEstate verified careers route no longer matches the official first-party shell')
    }

    const jobsHtml = await fetchText(JOBS_URL)
    if (!hasShellSignal(jobsHtml)) {
      throw new Error('TruEstate verified jobs fallback route no longer matches the official first-party shell')
    }

    const sitemapXml = await fetchText(SITEMAP_URL)
    if (!hasVerifiedSitemapSignal(sitemapXml)) {
      throw new Error('TruEstate verified sitemap no longer matches the careers-plus-no-jobs fallback contract')
    }

    const homepageBundleUrl = extractBundleUrl(homepageHtml, HOMEPAGE_URL)
    const careersBundleUrl = extractBundleUrl(careersHtml, CAREERS_URL)
    const jobsBundleUrl = extractBundleUrl(jobsHtml, JOBS_URL)

    if (!homepageBundleUrl || homepageBundleUrl !== careersBundleUrl || homepageBundleUrl !== jobsBundleUrl) {
      throw new Error('TruEstate bundle URL contract changed across the verified first-party routes')
    }

    const bundleJs = await fetchText(homepageBundleUrl)
    if (!hasHomepageBundleSignal(bundleJs)) {
      throw new Error('TruEstate homepage bundle contract no longer matches the verified first-party surface')
    }
    if (!hasCareersBundleSignal(bundleJs)) {
      throw new Error('TruEstate no-openings careers contract no longer matches the verified first-party surface')
    }
    if (!hasJobsFallbackSignal(bundleJs)) {
      throw new Error('TruEstate jobs fallback contract no longer matches the verified first-party surface')
    }
    if (hasPublicJobsSignal(bundleJs)) {
      throw new Error('TruEstate bundle now appears to expose a public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createTruEstateScraper().run(options)

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
