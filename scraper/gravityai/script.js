import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'gravityai'
export const COMPANY = 'Gravity AI'
export const HOMEPAGE_URL = 'https://www.gravity-ai.com/'
export const ABOUT_URL = 'https://www.gravity-ai.com/about-us/'
export const SITEMAP_INDEX_URL = 'https://www.gravity-ai.com/sitemap.xml'
export const SITEMAP_URL = 'https://www.gravity-ai.com/sitemap-0.xml'
export const ROLE_PAGE_URLS = [
  'https://www.gravity-ai.com/data-scientist/',
  'https://www.gravity-ai.com/platform-engineer/',
]
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.gravity-ai.com/careers',
  'https://www.gravity-ai.com/career',
  'https://www.gravity-ai.com/jobs',
  'https://www.gravity-ai.com/join-us',
]
export const EXPECTED_SITEMAP_URLS = [
  HOMEPAGE_URL,
  ABOUT_URL,
  'https://www.gravity-ai.com/contact/',
  'https://www.gravity-ai.com/pricing/',
  ...ROLE_PAGE_URLS,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bjoin our team\b/i,
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bopen roles\b/i,
  /\bjob openings?\b/i,
  /\bapply now\b/i,
  /\bsubmit (?:your )?resume\b/i,
  /\bupload your resume\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /zohorecruit/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&#x27;|&apos;|&rsquo;|&#8217;|\u2019|â€™/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/Â©/g, '©')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeUrl = (value) => String(value ?? '').trim().replace(/\/+$/, '/') || '/'

const hasGravityCopyright = (normalized, years = []) =>
  years.some((year) => normalized.includes(`© 2019-${year} gravityAI. All rights reserved.`))
  || years.some((year) => normalized.includes(`2019-${year} gravityAI. All rights reserved.`))

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
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

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Build and Deploy AI. Every Team. Every Model. Fully Governed.')
    && normalized.includes('Stop managing AI chaos across tools and teams.')
    && normalized.includes("gravityAI gives everyone a shared workspace, with governance that doesn't slow you down.")
    && normalized.includes('Trusted by 50,000+ developers and enterprises:')
    && normalized.includes('Pricing')
    && normalized.includes('Catalog')
    && normalized.includes('Documentation')
    && normalized.includes('Sign In')
    && normalized.includes('About us')
    && hasGravityCopyright(normalized, ['2026'])
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('gravityAI is an enterprise AI platform for building, deploying, and governing multi-model workflows.')
    && normalized.includes('Securely and at scale.')
    && normalized.includes("We're the team behind gravityAI")
    && normalized.includes('An AI infrastructure platform built by people who got tired of cool models going nowhere.')
    && normalized.includes('We wanted something that adds gravity')
}

export const hasVerifiedSitemapIndexSignal = (xml) =>
  /<sitemapindex[\s\S]*<loc>https:\/\/www\.gravity-ai\.com\/sitemap-0\.xml<\/loc>[\s\S]*<\/sitemapindex>/i.test(
    String(xml ?? ''),
  )

export const extractSitemapUrls = (xml) =>
  (String(xml ?? '').match(/<loc>([^<]+)<\/loc>/gi) || [])
    .map((entry) => entry.replace(/^<loc>|<\/loc>$/gi, '').trim())

const hasUnexpectedCareerLikeSitemapUrl = (xml) =>
  extractSitemapUrls(xml).some((url) => {
    const normalizedUrl = normalizeUrl(url)
    if (ROLE_PAGE_URLS.includes(normalizedUrl)) {
      return false
    }

    return /\/(?:careers?|jobs?|join-us)(?:\/|$)/i.test(normalizedUrl)
  })

export const hasVerifiedSitemapSignal = (xml) => {
  const urls = new Set(extractSitemapUrls(xml).map((url) => normalizeUrl(url)))
  return EXPECTED_SITEMAP_URLS.every((url) => urls.has(normalizeUrl(url)))
    && !hasUnexpectedCareerLikeSitemapUrl(xml)
}

export const hasVerifiedRolePageSignal = (url, html) => {
  const normalizedUrl = normalizeUrl(url)
  const normalized = normalizeWhitespace(html)

  if (normalizedUrl === ROLE_PAGE_URLS[0]) {
    return normalized.includes('Data Scientist')
  }

  if (normalizedUrl === ROLE_PAGE_URLS[1]) {
    return normalized.includes('Standardize AI deployments')
      && normalized.includes('gravityAI gives platform teams a private, internal AI marketplace')
      && normalized.includes('Book a demo')
      && normalized.includes('You package the model as a container.')
      && normalized.includes('Trust that scales')
  }

  return false
}

export const isVerifiedMissingCareerRoute = (page = {}) => {
  const normalized = normalizeWhitespace(page?.html)

  return Number(page?.status) === 404
    && normalized.includes('404: This page could not be found')
    && normalized.includes('This page could not be found')
    && normalized.includes('Sign In')
    && hasGravityCopyright(normalized, ['2025'])
    && !hasPublicJobsSignal(page?.html)
}

export const createGravityAIScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Gravity AI verified official homepage no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Gravity AI homepage now appears to expose a public jobs surface')
    }

    const about = await fetchPage(ABOUT_URL)
    if (about.status !== 200 || !hasOfficialAboutSignal(about.html)) {
      throw new Error('Gravity AI verified about page no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(about.html)) {
      throw new Error('Gravity AI about page now appears to expose a public jobs surface')
    }

    const sitemapIndex = await fetchPage(SITEMAP_INDEX_URL)
    if (sitemapIndex.status !== 200 || !hasVerifiedSitemapIndexSignal(sitemapIndex.html)) {
      throw new Error('Gravity AI verified sitemap index no longer matches the known public surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || !hasVerifiedSitemapSignal(sitemap.html)) {
      throw new Error('Gravity AI verified sitemap no longer matches the known no-public-jobs surface')
    }

    for (const rolePageUrl of ROLE_PAGE_URLS) {
      const rolePage = await fetchPage(rolePageUrl)
      if (rolePage.status !== 200 || !hasVerifiedRolePageSignal(rolePageUrl, rolePage.html)) {
        throw new Error(`Gravity AI verified role page no longer matches the known surface: ${rolePageUrl}`)
      }
      if (hasPublicJobsSignal(rolePage.html)) {
        throw new Error(`Gravity AI verified role page now exposes a public jobs surface: ${rolePageUrl}`)
      }
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareerRoute(routePage)) {
        throw new Error(`Gravity AI verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createGravityAIScraper().run(options)

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
