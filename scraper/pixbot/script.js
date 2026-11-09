import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'pixbot'
export const COMPANY = 'Pixbot'
export const COMPANY_DOMAIN = 'pixbot.co'
export const HOMEPAGE_URL = 'https://pixbot.co/'
export const ABOUT_URL = 'https://pixbot.co/about/'
export const CONTACT_URL = 'https://pixbot.co/contact/'
export const PAGE_SITEMAP_URL = 'https://pixbot.co/page-sitemap.xml'
export const CAREERS_ROUTE_URLS = [
  'https://pixbot.co/careers/',
  'https://pixbot.co/career/',
  'https://pixbot.co/jobs/',
  'https://pixbot.co/join-us/',
  'https://pixbot.co/work-with-us/',
  'https://pixbot.co/openings/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const EXPECTED_PAGE_SITEMAP_URLS = [
  HOMEPAGE_URL,
  'https://pixbot.co/services/',
  'https://pixbot.co/portfolio/',
  ABOUT_URL,
  'https://pixbot.co/blog-posts/',
  CONTACT_URL,
  'https://pixbot.co/lets-talk-branding-marketing/',
  'https://pixbot.co/mission/',
  'https://pixbot.co/home-2/',
]

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bcareer opportunities\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'|&#0*39;)?re hiring\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /successfactors/i,
]

const CAREER_LIKE_LINK_PATTERN =
  /href=["'](?:https:\/\/pixbot\.co)?\/(?:careers?|jobs?|join-us|work-with-us|openings?)(?:[/?#][^"']*)?["']/i

const SITEMAP_CAREER_URL_PATTERN =
  /<loc>\s*https:\/\/pixbot\.co\/(?:careers?|jobs?|join-us|work-with-us|openings?)\/?\s*<\/loc>/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&#8217;|&#39;|&#039;|&apos;|&rsquo;/gi, "'")
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&nbsp;/gi, ' ')
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
    headers: {
      location: response.headers.get('location'),
    },
    html: await response.text(),
  }
}

const pageIncludesNavigationLinks = (html) => {
  const rawHtml = String(html ?? '')

  return /href=["']https:\/\/pixbot\.co\/["']/i.test(rawHtml)
    && /href=["']https:\/\/pixbot\.co\/services\/["']/i.test(rawHtml)
    && /href=["']https:\/\/pixbot\.co\/portfolio\/["']/i.test(rawHtml)
    && /href=["']https:\/\/pixbot\.co\/blog-posts\/["']/i.test(rawHtml)
    && /href=["']https:\/\/pixbot\.co\/about\/["']/i.test(rawHtml)
    && /href=["']https:\/\/pixbot\.co\/contact\/["']/i.test(rawHtml)
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Home\s*-\s*Pixbot\s*<\/title>/i.test(rawHtml)
    && pageIncludesNavigationLinks(rawHtml)
    && normalized.includes('Video Production Company Central Florida')
    && normalized.includes('Build Brand Awareness | Showcase Products | Promote Services | Tell Your Story')
    && normalized.includes('CONTACT US')
}

export const hasOfficialAboutSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*About\s*-\s*Pixbot\s*<\/title>/i.test(rawHtml)
    && pageIncludesNavigationLinks(rawHtml)
    && normalized.includes('WHO WE ARE?')
    && normalized.includes('pixbot is a full service video production company based out of Central Florida.')
    && normalized.includes('We create content that helps businesses connect with viewers, build brand awareness and promote products and services.')
    && normalized.includes('Our Mission is to help businesses use their story to connect with audiences and build their brand awareness')
}

export const hasOfficialContactSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Contact\s*-\s*Pixbot\s*<\/title>/i.test(rawHtml)
    && pageIncludesNavigationLinks(rawHtml)
    && normalized.includes("We're Ready, Let's Talk.")
    && normalized.includes('Email Us: cs@pixbotad.com')
    && normalized.includes('Call Us: 609 712 8804')
}

export const hasFirstPartyCareerLikeLink = (html) =>
  CAREER_LIKE_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const extractPageSitemapUrls = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => match[1].trim())

export const hasOfficialPageSitemapSignal = (xml) => {
  const urls = extractPageSitemapUrls(xml)

  return EXPECTED_PAGE_SITEMAP_URLS.every((url) => urls.includes(url))
}

export const pageSitemapExposesCareerSurface = (xml) =>
  SITEMAP_CAREER_URL_PATTERN.test(String(xml ?? ''))

export const isVerifiedMissingCareersRoute = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Page not found\s*-\s*Pixbot\s*<\/title>/i.test(rawHtml)
    && normalized.includes("This page doesn't seem to exist.")
    && normalized.includes('It looks like the link pointing here was faulty. Maybe try searching?')
    && !hasFirstPartyCareerLikeLink(rawHtml)
    && !hasPublicJobsSignal(rawHtml)
}

export const isModSecurityAccessBlock = (page = {}) =>
  Number(page?.status) === 406
  && /Not Acceptable!/i.test(String(page?.html ?? ''))
  && /Mod_Security/i.test(String(page?.html ?? ''))

const markUpstreamAccessBlock = (error) => {
  error.softFailure = true
  error.upstreamOutage = true
  return error
}

const assertStablePage = ({
  page,
  hasOfficialSignal,
  label,
}) => {
  if (!hasOfficialSignal(page?.html)) {
    throw new Error(`Pixbot verified ${label} no longer matches the trusted first-party surface`)
  }

  if (hasFirstPartyCareerLikeLink(page?.html) || hasPublicJobsSignal(page?.html)) {
    throw new Error(`Pixbot ${label} now exposes a public careers surface`)
  }
}

export const createPixbotScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (isModSecurityAccessBlock(homepage)) {
      throw markUpstreamAccessBlock(
        new Error('Pixbot first-party surface is currently blocking this worker with ModSecurity (HTTP 406)'),
      )
    }
    assertStablePage({
      page: homepage,
      hasOfficialSignal: hasOfficialHomepageSignal,
      label: 'homepage',
    })

    const aboutPage = await fetchPage(ABOUT_URL)
    if (isModSecurityAccessBlock(aboutPage)) {
      throw markUpstreamAccessBlock(
        new Error('Pixbot first-party surface is currently blocking this worker with ModSecurity (HTTP 406)'),
      )
    }
    assertStablePage({
      page: aboutPage,
      hasOfficialSignal: hasOfficialAboutSignal,
      label: 'about page',
    })

    const contactPage = await fetchPage(CONTACT_URL)
    if (isModSecurityAccessBlock(contactPage)) {
      throw markUpstreamAccessBlock(
        new Error('Pixbot first-party surface is currently blocking this worker with ModSecurity (HTTP 406)'),
      )
    }
    assertStablePage({
      page: contactPage,
      hasOfficialSignal: hasOfficialContactSignal,
      label: 'contact page',
    })

    const pageSitemap = await fetchPage(PAGE_SITEMAP_URL)
    if (isModSecurityAccessBlock(pageSitemap)) {
      throw markUpstreamAccessBlock(
        new Error('Pixbot first-party surface is currently blocking this worker with ModSecurity (HTTP 406)'),
      )
    }
    if (!hasOfficialPageSitemapSignal(pageSitemap?.html)) {
      throw new Error('Pixbot verified page sitemap no longer matches the trusted first-party surface')
    }

    if (pageSitemapExposesCareerSurface(pageSitemap?.html)) {
      throw new Error('Pixbot sitemap now exposes a public careers surface')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)
      if (isModSecurityAccessBlock(careersRoute)) {
        throw markUpstreamAccessBlock(
          new Error('Pixbot first-party surface is currently blocking this worker with ModSecurity (HTTP 406)'),
        )
      }

      if (!isVerifiedMissingCareersRoute(careersRoute)) {
        throw new Error('Pixbot careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createPixbotScraper().run(options)

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
