import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'terracarb'
export const COMPANY = 'Terracarb'
export const HOMEPAGE_URL = 'https://terracarb.com/'
export const WORK_WITH_US_URL = 'https://terracarb.com/work-with-us/'
export const SITEMAP_URL = 'https://terracarb.com/wp-sitemap-posts-page-1.xml'
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://terracarb.com/careers',
  'https://terracarb.com/careers/',
  'https://terracarb.com/career',
  'https://terracarb.com/career/',
  'https://terracarb.com/jobs',
  'https://terracarb.com/jobs/',
  'https://terracarb.com/openings',
  'https://terracarb.com/openings/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /wellfound\.com/i,
]

const decodeHtml = (value) =>
  String(value ?? '')
    .replace(/&#8211;|&ndash;|[\u2013\u2014]/gi, '-')
    .replace(/&#8216;|&#8217;|&lsquo;|&rsquo;|[\u2018\u2019]/gi, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;|[\u201c\u201d]/gi, '"')
    .replace(/&#8211;|&#8212;/gi, '-')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')

const stripTags = (value) =>
  decodeHtml(
    String(value ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()

const normalizeHtml = (value) =>
  decodeHtml(String(value ?? ''))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

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

export const hasFirstPartyWorkWithUsLink = (html) =>
  /href=["'](?:https?:\/\/(?:www\.)?terracarb\.com)?\/work-with-us\/?(?:[?#][^"']*)?["']/i.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const raw = String(html ?? '')
  const text = stripTags(html)

  return /<title>\s*Terracarb\s*&#8211;\s*Reimagining Graphene\s*<\/title>/i.test(raw)
    && text.includes('Graphene Innovation for Sustainable Development')
    && text.includes('Terracarb Pvt Ltd')
    && /Coimbatore\s*-\s*641018/i.test(text)
    && text.includes('info@terracarb.com')
    && hasFirstPartyWorkWithUsLink(raw)
  }

export const hasOfficialWorkWithUsSignal = (html) => {
  const raw = String(html ?? '')
  const text = stripTags(html)

  return /<title>\s*Work With Us\s*&#8211;\s*Terracarb\s*<\/title>/i.test(raw)
    && text.includes('Work With Us')
    && text.includes('Join Our Team')
    && text.includes('Passionate about what we do?')
    && text.includes('Upload Resume')
    && text.includes('Send Message')
    && text.includes('reimagine@terracarb.com')
    && text.includes('info@terracarb.com')
    && /Coimbatore\s*-\s*641018/i.test(text)
  }

export const sitemapIncludesVerifiedWorkWithUsRoute = (xml) =>
  /<loc>\s*https:\/\/terracarb\.com\/work-with-us\/\s*<\/loc>/i.test(String(xml ?? ''))

export const sitemapHasUnexpectedJobRoute = (xml) =>
  /<loc>\s*https:\/\/terracarb\.com\/(?:careers?|jobs?|openings)\/?\s*<\/loc>/i.test(String(xml ?? ''))

export const isVerifiedMissingJobRoute = (page = {}) => {
  const raw = String(page?.html ?? '')
  const normalized = normalizeHtml(raw)

  return Number(page?.status) === 404
    && /<title>\s*Page not found\s*&#8211;\s*Terracarb\s*<\/title>/i.test(raw)
    && (
      normalized.includes('oops! the page you are looking for does not exist.')
      || normalized.includes('oops! that page can’t be found.')
      || normalized.includes('oops! that page can\'t be found.')
    )
    && (
      normalized.includes('it might have been moved or deleted')
      || normalized.includes('it looks like nothing was found at this location.')
    )
    && !hasPublicJobsSignal(raw)
  }

export const createTerracarbScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Terracarb verified official homepage no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Terracarb homepage now appears to expose a public jobs surface')
    }

    const workWithUs = await fetchPage(WORK_WITH_US_URL)
    if (workWithUs.status !== 200 || !hasOfficialWorkWithUsSignal(workWithUs.html)) {
      throw new Error('Terracarb verified work-with-us page no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(workWithUs.html)) {
      throw new Error('Terracarb work-with-us page now appears to expose a public jobs surface')
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (sitemap.status !== 200 || !sitemapIncludesVerifiedWorkWithUsRoute(sitemap.html) || sitemapHasUnexpectedJobRoute(sitemap.html)) {
      throw new Error('Terracarb verified sitemap no longer matches the known first-party no-public-jobs surface')
    }

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingJobRoute(routePage)) {
        throw new Error(
          `Terracarb verified missing first-party job route changed or now exposes a public jobs surface: ${routePage.url || routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createTerracarbScraper().run(options)

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
