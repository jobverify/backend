import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'alphatechnosolutions'
export const COMPANY = 'Alpha Techno Solutions'
export const HOMEPAGE_URL = 'https://alphatechno.in/'
export const PAGE_SITEMAP_URL = 'https://alphatechno.in/wp-sitemap-posts-page-1.xml'
export const CONTACT_US_URL = 'https://alphatechno.in/contact-us/'
export const CAREERS_ROUTE_URLS = [
  'https://alphatechno.in/careers/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bjob opportunities\b/i,
  /\bcareer opportunities\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'re| are)? hiring\b/i,
  /\bvacan(?:cy|cies)\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /freshteam/i,
  /recruitcrm/i,
  /bamboohr/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#0*39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const isSameOfficialDomain = (value) => {
  try {
    const hostname = new URL(value || HOMEPAGE_URL).hostname.toLowerCase()
    return hostname === 'alphatechno.in' || hostname === 'www.alphatechno.in'
  } catch {
    return false
  }
}

const defaultFetchPage = (url) => withRetry(async () => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}, {
  attempts: 3,
  baseDelayMs: 2000,
  label: SOURCE,
})

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Alpha Techno\s*<\/title>/i.test(page)
    && /alt=["']Alpha Techno["']/i.test(page)
    && /href=["']https:\/\/alphatechno\.in\/about-us\/["']/i.test(page)
    && /href=["']https:\/\/alphatechno\.in\/contact-us\/["']/i.test(page)
    && /href=["']https:\/\/alphatechno\.in\/certificate-verification-2\/["']/i.test(page)
    && normalized.includes('Alpha Techno Education Hub, Narang market, Guru Ravidas Nagar, Nawanshahr, Punjab 144514')
    && normalized.includes('Alpha Techno Provide the best Education in Nawanshahr & Jalandhar')
    && normalized.includes('30+ Professional Courses')
    && /href=["']tel:918291150406["']/i.test(page)
}

export const hasOfficialPageSitemapSignal = (xml) => {
  const page = String(xml ?? '')

  return /<urlset\b/i.test(page)
    && page.includes('<loc>https://alphatechno.in/</loc>')
    && page.includes('<loc>https://alphatechno.in/about-us/</loc>')
    && page.includes('<loc>https://alphatechno.in/contact-us/</loc>')
    && page.includes('<loc>https://alphatechno.in/certificate-verification-2/</loc>')
    && page.includes('<loc>https://alphatechno.in/courses/</loc>')
    && !/https:\/\/alphatechno\.in\/(?:career|careers|jobs|join-us)\/?/i.test(page)
}

export const hasOfficialContactPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Contact Us(?:\s|&[^;]+;|-)+Alpha Techno\s*<\/title>/i.test(page)
    && /rel=["']canonical["'][^>]+href=["']https:\/\/alphatechno\.in\/contact-us\/["']/i.test(page)
    && normalized.includes('Keep In Touch With Alpha Techno')
    && normalized.includes('Alpha Techno Education Hub, Narang market, Guru Ravidas Nagar, Nawanshahr, Punjab 144514')
    && normalized.includes('Alpha Techno, 1st floor Phase 3 Tower Enciave, Nakodar Road, Jalandhar.(144001)')
    && normalized.includes('Contact Us')
    && normalized.includes('© 2024 Alpha Techno All Right Reserved.')
}

export const isVerifiedNoPublicJobsRoute = (page = {}) => {
  if (!isSameOfficialDomain(page.url || HOMEPAGE_URL)) {
    return false
  }

  if (hasPublicJobsSignal(page.html)) {
    return false
  }

  return page.status === 404
}

export const createAlphaTechnoSolutionsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Alpha Techno homepage no longer matches the verified official surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Alpha Techno homepage now appears to expose public jobs')
    }

    const pageSitemap = await fetchPage(PAGE_SITEMAP_URL)
    if (pageSitemap.status !== 200 || !hasOfficialPageSitemapSignal(pageSitemap.html)) {
      throw new Error('Alpha Techno page sitemap no longer matches the verified official surface')
    }

    const contactPage = await fetchPage(CONTACT_US_URL)
    if (contactPage.status !== 200 || !hasOfficialContactPageSignal(contactPage.html)) {
      throw new Error('Alpha Techno contact page no longer matches the verified official surface')
    }
    if (hasPublicJobsSignal(contactPage.html)) {
      throw new Error('Alpha Techno contact page now appears to expose public jobs')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)
      if (!isVerifiedNoPublicJobsRoute(careersRoute)) {
        throw new Error('Alpha Techno careers route changed materially or now exposes public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createAlphaTechnoSolutionsScraper().run(options)

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
