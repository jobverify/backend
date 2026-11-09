import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'universalautomationsystems'
export const COMPANY = 'Universal Automation Systems Pvt. Ltd.'
export const HOMEPAGE_URL = 'https://www.universalautomation.co.in/'
export const CONTACT_URL = 'https://www.universalautomation.co.in/contact.html'
export const SITEMAP_PAGE_URL = 'https://www.universalautomation.co.in/sitemap.html'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.universalautomation.co.in/careers',
  'https://www.universalautomation.co.in/careers/',
  'https://www.universalautomation.co.in/careers.html',
  'https://www.universalautomation.co.in/career',
  'https://www.universalautomation.co.in/career/',
  'https://www.universalautomation.co.in/career.html',
  'https://www.universalautomation.co.in/jobs',
  'https://www.universalautomation.co.in/jobs/',
  'https://www.universalautomation.co.in/jobs.html',
  'https://www.universalautomation.co.in/current-openings',
  'https://www.universalautomation.co.in/openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIRST_PARTY_CAREER_LINK_PATTERN =
  /href=["'](?:https?:\/\/(?:www\.)?universalautomation\.co\.in\/)?(?:careers?|jobs?|current-openings|openings)(?:\.html)?(?:[/?#][^"']*)?["']/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcareers?\b/i,
  /\bjobs?\b/i,
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bjoin our team\b/i,
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bapply now\b/i,
  /\bsubmit (?:your )?resume\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /jobvite/i,
  /smartrecruiters/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /linkedin\.com\/jobs/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x2019;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title>\s*Universal Automation Systems Pvt\. Ltd\..*Industrial Automation[\s\S]*Machinery Solutions\s*<\/title>/i.test(rawHtml)
    && normalized.includes('universal automation systems pvt. ltd.')
    && normalized.includes('custom machinery & assembly solutions')
    && normalized.includes('special-purpose machines, assembly lines, jigs & fixtures')
    && normalized.includes('request a quote')
    && normalized.includes('assembly lines & stand-alone machines')
    && normalized.includes('info@universalautomation.co.in')
    && normalized.includes('+91 94483 50487')
    && normalized.includes('contact')
    && normalized.includes('sitemap')
}

export const hasOfficialContactSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title>\s*Contact Us\s*\|\s*Universal Automation Systems Pvt\. Ltd\.\s*<\/title>/i.test(rawHtml)
    && normalized.includes('contact us')
    && normalized.includes('universal automation systems pvt. ltd.')
    && normalized.includes('let us build your next automation success')
    && normalized.includes('info@universalautomation.co.in')
    && normalized.includes('visit our facilities, share your requirement')
}

export const hasOfficialSitemapSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title>\s*Sitemap\s*-\s*Universal Automation\s*<\/title>/i.test(rawHtml)
    && normalized.includes('sitemap')
    && normalized.includes('how we evolved')
    && normalized.includes('mission/vision')
    && normalized.includes('vendors')
    && normalized.includes('products')
    && normalized.includes('services')
    && normalized.includes('machinery solutions')
    && normalized.includes('contact us')
}

export const hasFirstPartyCareerLikeLink = (html) =>
  FIRST_PARTY_CAREER_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingRoute = (page = {}) => {
  const normalized = normalizeWhitespace(page?.html).toLowerCase()

  return Number(page?.status) === 404
    && !hasFirstPartyCareerLikeLink(page?.html)
    && !hasPublicJobsSignal(page?.html)
    && normalized.includes('404 not found')
    && normalized.includes('the requested url was not found on this server.')
}

export const createUniversalAutomationSystemsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Universal Automation Systems official homepage no longer matches the verified public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Universal Automation Systems homepage now appears to expose a public jobs surface')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Universal Automation Systems homepage now exposes a first-party careers path')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (contactPage.status !== 200 || !hasOfficialContactSignal(contactPage.html)) {
      throw new Error('Universal Automation Systems contact page no longer matches the verified public surface')
    }

    if (hasPublicJobsSignal(contactPage.html) || hasFirstPartyCareerLikeLink(contactPage.html)) {
      throw new Error('Universal Automation Systems contact page now appears to expose a careers surface')
    }

    const sitemapPage = await fetchPage(SITEMAP_PAGE_URL)
    if (sitemapPage.status !== 200 || !hasOfficialSitemapSignal(sitemapPage.html)) {
      throw new Error('Universal Automation Systems sitemap page no longer matches the verified public surface')
    }

    if (hasPublicJobsSignal(sitemapPage.html) || hasFirstPartyCareerLikeLink(sitemapPage.html)) {
      throw new Error('Universal Automation Systems sitemap page now appears to expose a careers surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingRoute(routePage)) {
        throw new Error(`Universal Automation Systems verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createUniversalAutomationSystemsScraper().run(options)

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
