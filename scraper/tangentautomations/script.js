import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'tangentautomations'
export const COMPANY = 'Tangent Automations'
export const OFFICIAL_SITE_NAME = 'Tangent Automation'
export const HOMEPAGE_URL = 'https://www.tangentautomation.com/'
export const ABOUT_URL = 'https://www.tangentautomation.com/about/'
export const CONTACT_URL = 'https://www.tangentautomation.com/contact/'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.tangentautomation.com/career',
  'https://www.tangentautomation.com/career/',
  'https://www.tangentautomation.com/careers',
  'https://www.tangentautomation.com/careers/',
  'https://www.tangentautomation.com/jobs',
  'https://www.tangentautomation.com/jobs/',
  'https://www.tangentautomation.com/openings',
  'https://www.tangentautomation.com/current-openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIRST_PARTY_CAREER_LINK_PATTERN =
  /href=["'](?:https?:\/\/(?:www\.)?tangentautomation\.com)?\/(?:career|careers|jobs?|openings|current-openings)(?:[/?#][^"']*)?["']/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcareers?\b/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bcareer opportunities\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
  /\bjoin our team\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /recruitcrm/i,
  /linkedin\.com\/jobs/i,
  /\/jobs\/[a-z0-9-]+/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x2019;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&#8211;|&ndash;/gi, '-')
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

  return /<title>\s*Tangent Automation(?:\s|&#8211;|-|–)+Tangentautomation\s*<\/title>/i.test(rawHtml)
    && normalized.includes('tangent automation')
    && normalized.includes('customisation')
    && normalized.includes('innovation')
    && normalized.includes('control system design')
    && normalized.includes('plc systems')
    && normalized.includes('what we do?')
    && normalized.includes('who we are?')
    && normalized.includes('our core values')
    && normalized.includes('latest project')
    && normalized.includes('copyright © 2014 tangent automation')
}

export const hasOfficialAboutSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title>\s*About Us(?:\s|&#8211;|-|–)+Tangent Automation\s*<\/title>/i.test(rawHtml)
    && normalized.includes('about us')
    && normalized.includes('tangent established in 2006')
    && normalized.includes('group of young entrepreneurs')
    && normalized.includes('power management')
    && normalized.includes('biotechnology')
    && normalized.includes('medical devices')
    && normalized.includes('our vision')
}

export const hasOfficialContactSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title>\s*Contact Us(?:\s|&#8211;|-|–)+Tangent Automation\s*<\/title>/i.test(rawHtml)
    && normalized.includes('contact us')
    && normalized.includes('tangent automation')
    && normalized.includes('malagala')
    && normalized.includes('bangalore-560091')
    && normalized.includes('sales@tangentautomation.com')
    && normalized.includes('info@tangentautomation.com')
    && normalized.includes('+91-80-23188258')
    && normalized.includes('+919972396043')
    && normalized.includes('your name (required)')
}

export const hasFirstPartyCareerLikeLink = (html) =>
  FIRST_PARTY_CAREER_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingRoute = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return Number(page?.status) === 404
    && /<title>\s*Page not found(?:\s|&#8211;|-|–)+Tangent Automation\s*<\/title>/i.test(rawHtml)
    && normalized.includes('404 - page not found')
    && normalized.includes('apologies, but the page you requested could not be found')
    && !hasFirstPartyCareerLikeLink(rawHtml)
    && !hasPublicJobsSignal(rawHtml)
}

export const createTangentAutomationsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Tangent Automation official homepage no longer matches the verified public surface')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html) || hasPublicJobsSignal(homepage.html)) {
      throw new Error('Tangent Automation homepage now appears to expose a careers surface')
    }

    const aboutPage = await fetchPage(ABOUT_URL)
    if (aboutPage.status !== 200 || !hasOfficialAboutSignal(aboutPage.html)) {
      throw new Error('Tangent Automation about page no longer matches the verified public surface')
    }

    if (hasFirstPartyCareerLikeLink(aboutPage.html) || hasPublicJobsSignal(aboutPage.html)) {
      throw new Error('Tangent Automation about page now appears to expose a careers surface')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (contactPage.status !== 200 || !hasOfficialContactSignal(contactPage.html)) {
      throw new Error('Tangent Automation contact page no longer matches the verified public surface')
    }

    if (hasFirstPartyCareerLikeLink(contactPage.html) || hasPublicJobsSignal(contactPage.html)) {
      throw new Error('Tangent Automation contact page now appears to expose a careers surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingRoute(routePage)) {
        throw new Error(`Tangent Automation verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createTangentAutomationsScraper().run(options)

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
