import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'bluetree'
export const COMPANY = 'Blue Tree'
export const HOMEPAGE_URL = 'https://www.getbluetree.com/'
export const ABOUT_URL = 'https://www.getbluetree.com/about-us'
export const CONTACT_URL = 'https://www.getbluetree.com/contact-sales'
export const SITEMAP_URL = 'https://www.getbluetree.com/sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.getbluetree.com/careers',
  'https://www.getbluetree.com/jobs',
  'https://www.getbluetree.com/join-us',
  'https://www.getbluetree.com/openings',
  'https://www.getbluetree.com/work-with-us',
  'https://www.getbluetree.com/careers-at-bluetree',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bjoin our team\b/i,
  /\bopen positions?\b/i,
  /\bcurrent openings?\b/i,
  /\bapply now\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /wellfound\.com/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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

export const isVerifiedTimeoutBlockedSurface = (error) =>
  /fetch failed|timed out|timeout|connect timeout|und_err_connect_timeout|could not connect|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*BeeForce by BlueTree: Labour Management Software\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+BlueTree is India.?s (?:leading|best) labour management software/i.test(page)
    && normalized.includes('beeforce by bluetree')
    && normalized.includes('your companion to external workforce & labour management')
}

export const hasOfficialAboutSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*About Us - Know about BlueTree\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+BlueTree has delivered workforce management solutions since 2010/i.test(page)
    && normalized.includes('Empowering You For The Future Of Work')
    && normalized.includes('Driving innovation for sustainable business growth through state-of-the-art technology')
    && normalized.includes('Platform Products')
    && normalized.includes('Workforce Managed')
}

export const hasOfficialContactSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Contact Us for Queries - BlueTree Team\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+Ready to transform your external workforce management/i.test(page)
    && normalized.includes('Let’s Simplify Workforce Operations Together')
    && normalized.includes('Built for Workforce Operations at Scale')
    && normalized.includes('One Platform to Manage Onboarding, Attendance, Payouts, Compliance, and Offboarding')
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const sitemapHasCareerLikeUrl = (xml) => {
  const matches = String(xml ?? '').match(/<loc>([^<]+)<\/loc>/gi) || []
  return matches.some((entry) => {
    const location = entry.replace(/^<loc>|<\/loc>$/gi, '')
    if (/\/resources\/glossary\//i.test(location)) {
      return false
    }

    return /\b(careers?|jobs?|join-us|work-with-us|openings?)\b/i.test(location)
  })
}

export const isVerifiedMissingCareerRoute = (page = {}) =>
  Number(page?.status) === 404
  && /<title>\s*Page Not Found \| Framer\s*<\/title>/i.test(String(page?.html ?? ''))
  && !hasPublicJobsSignal(page?.html)

export const createBlueTreeScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const fetchVerifiedPage = async (url) => {
      try {
        return await fetchPage(url)
      } catch (error) {
        if (isVerifiedTimeoutBlockedSurface(error)) {
          return null
        }

        throw error
      }
    }

    const homepage = await fetchVerifiedPage(HOMEPAGE_URL)
    if (homepage) {
      if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
        throw new Error('Blue Tree verified official homepage no longer matches the known public surface')
      }
      if (hasPublicJobsSignal(homepage.html)) {
        throw new Error('Blue Tree homepage now appears to expose a public jobs surface')
      }
    }

    const about = await fetchVerifiedPage(ABOUT_URL)
    if (about) {
      if (about.status !== 200 || !hasOfficialAboutSignal(about.html)) {
        throw new Error('Blue Tree verified about page no longer matches the known public surface')
      }
      if (hasPublicJobsSignal(about.html)) {
        throw new Error('Blue Tree about page now appears to expose a public jobs surface')
      }
    }

    const contact = await fetchVerifiedPage(CONTACT_URL)
    if (contact) {
      if (contact.status !== 200 || !hasOfficialContactSignal(contact.html)) {
        throw new Error('Blue Tree verified contact page no longer matches the known public surface')
      }
      if (hasPublicJobsSignal(contact.html)) {
        throw new Error('Blue Tree contact page now appears to expose a public jobs surface')
      }
    }

    const sitemap = await fetchVerifiedPage(SITEMAP_URL)
    if (sitemap) {
      if (sitemap.status !== 200 || sitemapHasCareerLikeUrl(sitemap.html)) {
        throw new Error('Blue Tree verified sitemap no longer matches the no-public-careers surface')
      }
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchVerifiedPage(routeUrl)
      if (routePage && !isVerifiedMissingCareerRoute(routePage)) {
        throw new Error(`Blue Tree verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createBlueTreeScraper().run(options)

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
