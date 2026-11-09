import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'airendertechnologypvtltd'
export const COMPANY = 'aiRender Technology Pvt Ltd'
export const HOMEPAGE_URL = 'https://airender.co.in/'
export const CAREERS_ROUTE_URLS = [
  'https://airender.co.in/careers/',
  'https://airender.co.in/career/',
  'https://airender.co.in/jobs/',
  'https://airender.co.in/join-us/',
  'https://airender.co.in/current-openings/',
  'https://airender.co.in/openings/',
  'https://airender.co.in/work-with-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workable\.com/i,
  /smartrecruiters/i,
  /jobvite/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const extractBundlePath = (html) => {
  const match = /<script\b[^>]*\bsrc=["']([^"']*\/static\/js\/main\.[^"']+\.js)["']/i.exec(
    String(html ?? ''),
  )

  return match?.[1] ?? null
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*aiRender\s*<\/title>/i.test(rawHtml)
    && rawHtml.includes('You need to enable JavaScript to run this app.')
    && /<div[^>]+id=["']root["'][^>]*><\/div>/i.test(rawHtml)
    && extractBundlePath(rawHtml) !== null
    && normalized === 'aiRender You need to enable JavaScript to run this app.'
}

export const hasVerifiedClientBundleSignal = (bundleJs) => {
  const rawJs = String(bundleJs ?? '')

  return rawJs.includes('account_name:"Airender Technology Private Limited"')
    && rawJs.includes('company_address:"H-005, Vijetha Elysium, Hagadur Road, Whitefield, Bangalore, Karnataka, India. PIN 560066"')
    && rawJs.includes('children:"Contact Us"')
    && rawJs.includes('children:"Join us"')
}

export const hasPublicJobsSignal = (content) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(content ?? '')))

export const isVerifiedMissingCareerRoute = (page = {}) =>
  Number(page?.status) === 404
  && /<title[^>]*>\s*404 Not Found\s*<\/title>/i.test(String(page?.html ?? ''))
  && normalizeWhitespace(page?.html).toLowerCase() === '404 Not Found 404 Not Found nginx/1.24.0 (Ubuntu)'.toLowerCase()
  && !hasPublicJobsSignal(page?.html)

export const isVerifiedSpaFallbackRoute = (page = {}, routeUrl, homepageHtml) =>
  Number(page?.status) === 200
  && page?.url === routeUrl
  && hasOfficialHomepageSignal(page?.html)
  && String(page?.html ?? '') === String(homepageHtml ?? '')
  && !hasPublicJobsSignal(page?.html)

export const createAiRenderTechnologyPvtLtdScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('aiRender Technology Pvt Ltd verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('aiRender Technology Pvt Ltd homepage now appears to expose public jobs')
    }

    const bundlePath = extractBundlePath(homepage.html)
    if (!bundlePath) {
      throw new Error('aiRender Technology Pvt Ltd homepage no longer exposes the verified client bundle')
    }

    const bundleUrl = new URL(bundlePath, HOMEPAGE_URL).toString()
    const bundlePage = await fetchPage(bundleUrl)

    if (bundlePage.status !== 200 || !hasVerifiedClientBundleSignal(bundlePage.html)) {
      throw new Error('aiRender Technology Pvt Ltd verified client bundle no longer matches the known first-party company identity')
    }

    if (hasPublicJobsSignal(bundlePage.html)) {
      throw new Error('aiRender Technology Pvt Ltd client bundle now appears to expose public jobs')
    }

    for (const routeUrl of CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (
        !isVerifiedMissingCareerRoute(routePage)
        && !isVerifiedSpaFallbackRoute(routePage, routeUrl, homepage.html)
      ) {
        throw new Error(`aiRender Technology Pvt Ltd verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAiRenderTechnologyPvtLtdScraper().run(options)

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
