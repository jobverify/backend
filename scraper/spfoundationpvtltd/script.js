import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'spfoundationpvtltd'
export const COMPANY = 'S&P Foundation Pvt. Ltd.'
export const HOMEPAGE_URL = 'https://spfoundation.in/'
export const CONTACT_URL = 'https://spfoundation.in/contact/'
export const PAGES_API_URL = 'https://spfoundation.in/wp-json/wp/v2/pages?per_page=100'
export const PAGE_SITEMAP_URL = 'https://spfoundation.in/page-sitemap.xml'
export const CHECKED_ROUTE_URLS = [
  'https://spfoundation.in/careers',
  'https://spfoundation.in/careers/',
  'https://spfoundation.in/career',
  'https://spfoundation.in/career/',
  'https://spfoundation.in/jobs',
  'https://spfoundation.in/jobs/',
  'https://spfoundation.in/job',
  'https://spfoundation.in/job/',
  'https://spfoundation.in/work-with-us',
  'https://spfoundation.in/work-with-us/',
  'https://spfoundation.in/join-us',
  'https://spfoundation.in/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bsubmit (?:your )?resume\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /zohorecruit/i,
  /<title[^>]*>\s*(?:careers?|jobs?|work with us|join us)\b/i,
  /<h1[^>]*>\s*(?:careers?|jobs?|work with us|join us)\b/i,
]

const FIRST_PARTY_HIRING_LINK_PATTERN =
  /href=["'](?:https?:\/\/spfoundation\.in)?\/(?:careers?|jobs?|job|career|work-with-us|join-us)(?:[/?#][^"']*)?["']/i

const FIRST_PARTY_HIRING_URL_PATTERN =
  /https:\/\/spfoundation\.in\/(?:careers?|jobs?|job|career|work-with-us|join-us)(?:[/?#<"]|$)/i

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/[\u2013\u2014]/g, '-')
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

const defaultFetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.json()
}

export const hasUnexpectedPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Home - SP Foundation\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+name=["']description["'][^>]+SP Foundation, an initiative by SPC intends to cure, serve and care/i.test(rawHtml)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']SP Foundation["']/i.test(rawHtml)
    && /href=["']https:\/\/spfoundation\.in\/about\/["']/i.test(rawHtml)
    && /href=["']https:\/\/spfoundation\.in\/contact\/["']/i.test(rawHtml)
    && normalized.includes('Register to join us as a Volunteer')
    && normalized.includes('Care, Serve and Cure.')
  }

export const hasOfficialContactSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Contact - SP Foundation\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']SP Foundation["']/i.test(rawHtml)
    && normalized.includes('Plot No. 284/1,2 & 3 GIDC Estate, Makarpura, Vadodara - 390010, Gujarat - India.')
    && normalized.includes('info@spfoundation.in')
    && normalized.includes('MONDAY - SATURDAY : 9:00AM TO 6:00PM')
    && normalized.includes('Copyright 2022 by SP Foundation')
}

export const hasVerifiedMissingHiringRoute = (page = {}) => {
  if (Number(page?.status) !== 404) {
    return false
  }

  const rawHtml = String(page?.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Page not found - SP Foundation\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+property=["']og:title["'][^>]+content=["']Page not found - SP Foundation["']/i.test(rawHtml)
    && /class=["'][^"']*error404/i.test(rawHtml)
    && normalized.includes('Ohh! Page Not Found')
    && /<form[^>]+role=["']search["'][^>]+action=["']https:\/\/spfoundation\.in\/["']/i.test(rawHtml)
    && !hasUnexpectedPublicJobsSignal(rawHtml)
    && !FIRST_PARTY_HIRING_LINK_PATTERN.test(rawHtml)
}

export const pageInventoryExposesHiringSurface = (pages) =>
  Array.isArray(pages) && pages.some((page) => {
    const slug = String(page?.slug ?? '')
    const link = String(page?.link ?? '')
    const title = String(page?.title?.rendered ?? '')

    return /^(?:careers?|jobs?|job|career|work-with-us|join-us)$/i.test(slug)
      || FIRST_PARTY_HIRING_URL_PATTERN.test(link)
      || /^(?:careers?|jobs?|job|work with us|join us)$/i.test(title.trim())
  })

export const pageInventoryHasExpectedSurface = (pages) => {
  if (!Array.isArray(pages) || pageInventoryExposesHiringSurface(pages)) {
    return false
  }

  const slugs = new Set(pages.map((page) => String(page?.slug ?? '').toLowerCase()))
  const links = new Set(pages.map((page) => String(page?.link ?? '')))

  return slugs.has('about')
    && slugs.has('contact')
    && slugs.has('projects')
    && slugs.has('financial')
    && links.has('https://spfoundation.in/')
}

export const pageSitemapExposesHiringSurface = (xml) =>
  FIRST_PARTY_HIRING_URL_PATTERN.test(String(xml ?? ''))

export const pageSitemapHasExpectedSurface = (xml) => {
  const rawXml = String(xml ?? '')

  return rawXml.includes('<loc>https://spfoundation.in/</loc>')
    && rawXml.includes('<loc>https://spfoundation.in/projects/</loc>')
    && rawXml.includes('<loc>https://spfoundation.in/contact/</loc>')
    && !pageSitemapExposesHiringSurface(rawXml)
}

export const createSpFoundationScraper = () => ({
  async run({ fetchPage = defaultFetchPage, fetchJson = defaultFetchJson } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('SP Foundation official homepage no longer matches the verified public surface')
    }
    if (hasUnexpectedPublicJobsSignal(homepage.html) || FIRST_PARTY_HIRING_LINK_PATTERN.test(homepage.html)) {
      throw new Error('SP Foundation homepage now exposes public jobs or a first-party hiring path')
    }

    const contact = await fetchPage(CONTACT_URL)
    if (contact.status !== 200 || !hasOfficialContactSignal(contact.html)) {
      throw new Error('SP Foundation official contact page no longer matches the verified public surface')
    }
    if (hasUnexpectedPublicJobsSignal(contact.html) || FIRST_PARTY_HIRING_LINK_PATTERN.test(contact.html)) {
      throw new Error('SP Foundation contact page now exposes public jobs or a first-party hiring path')
    }

    const pages = await fetchJson(PAGES_API_URL)
    if (!pageInventoryHasExpectedSurface(pages)) {
      throw new Error('SP Foundation official page inventory no longer matches the verified public no-listings surface')
    }

    const pageSitemap = await fetchPage(PAGE_SITEMAP_URL)
    if (pageSitemap.status !== 200 || !pageSitemapHasExpectedSurface(pageSitemap.html)) {
      throw new Error('SP Foundation official page sitemap no longer matches the verified public no-listings surface')
    }

    for (const routeUrl of CHECKED_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!hasVerifiedMissingHiringRoute(routePage)) {
        throw new Error(`SP Foundation hiring route no longer matches the verified public 404 surface: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createSpFoundationScraper().run(options)

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
