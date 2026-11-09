import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { HOPSCOTCH_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = HOPSCOTCH_CATALOG.source
export const COMPANY = HOPSCOTCH_CATALOG.companyName
export const VERIFIED_ON = HOPSCOTCH_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = HOPSCOTCH_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = HOPSCOTCH_CATALOG
export const HOMEPAGE_URL = HOPSCOTCH_CATALOG.homepageUrl
export const SITEMAP_URL = HOPSCOTCH_CATALOG.sitemapUrl
export const NO_PUBLIC_JOB_ROUTE_URLS = HOPSCOTCH_CATALOG.noPublicJobRouteUrls

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_ROUTE_PATTERN = /\/(?:careers?|jobs?|job-openings?|join-us|work-with-us|openings?)(?:\/|$)/i
const ATS_SIGNAL_PATTERN =
  /boards\.greenhouse\.io|jobs\.lever\.co|ashbyhq\.com|myworkdayjobs|workdayjobs|smartrecruiters|jobvite|icims|taleo|darwinbox|successfactors|oraclecloud/i

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

export const hasOfficialShellSignal = (html) => {
  const page = String(html ?? '')

  return /ng-app=["']ngHopscotch["']/i.test(page)
    && /static\.hopscotch\.in\/web2\//i.test(page)
    && /Hopscotch\.India/i.test(page)
    && /@Hopscotchindia/i.test(page)
    && /in\.hopscotch\.android/i.test(page)
}

export const hasPublicJobBoardSignal = (html) => {
  const page = String(html ?? '')

  return ATS_SIGNAL_PATTERN.test(page)
    || /JobPosting/i.test(page)
    || /\b(Current Openings|Open Positions|Vacancies|Explore Careers)\b/i.test(page)
    || /href=["'][^"']*\/(?:careers?|jobs?|job-openings?)\/[^"']+["']/i.test(page)
  }

export const hasExpectedSitemap = (xml) => {
  const urls = [...String(xml ?? '').matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)]
    .map((match) => String(match[1] ?? '').trim())
    .filter(Boolean)

  if (urls.length === 0) {
    return false
  }

  const normalized = urls.map((url) => url.toLowerCase())

  return normalized.includes('https://www.hopscotch.in/')
    && normalized.includes('https://www.hopscotch.in/help')
    && normalized.includes('https://www.hopscotch.in/about/aboutus')
    && normalized.includes('https://www.hopscotch.in/about/terms')
    && normalized.includes('https://www.hopscotch.in/about/privacy')
    && normalized.every((url) => !CAREER_ROUTE_PATTERN.test(new URL(url).pathname))
  }

export const isVerifiedNoPublicJobRoute = (page = {}) =>
  Number(page.status) === 200
  && hasOfficialShellSignal(page.html)
  && !hasPublicJobBoardSignal(page.html)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const createHopscotchScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialShellSignal(homepage.html) || hasPublicJobBoardSignal(homepage.html)) {
      throw new Error('Hopscotch official shell no longer matches the verified first-party no-public-jobs surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || !hasExpectedSitemap(sitemap.html)) {
      throw new Error('Hopscotch sitemap no longer matches the verified first-party no-careers route set')
    }

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedNoPublicJobRoute(routePage)) {
        throw new Error(`Hopscotch common job route changed materially or now exposes public jobs: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createHopscotchScraper().run(options)

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
