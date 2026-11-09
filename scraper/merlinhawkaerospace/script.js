import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'merlinhawkaerospace'
export const COMPANY = 'Merlinhawk Aerospace'
export const HOMEPAGE_URL = 'https://merlinhawkaerospace.com/'
export const CONTACT_PAGE_URL = 'https://merlinhawkaerospace.com/contact'
export const PAGE_SITEMAP_URL = 'https://merlinhawkaerospace.com/page-sitemap.xml'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://merlinhawkaerospace.com/careers',
  'https://merlinhawkaerospace.com/careers/',
  'https://merlinhawkaerospace.com/career',
  'https://merlinhawkaerospace.com/career/',
  'https://merlinhawkaerospace.com/jobs',
  'https://merlinhawkaerospace.com/jobs/',
  'https://merlinhawkaerospace.com/join-us',
  'https://merlinhawkaerospace.com/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREERS_SIGNAL_PATTERN =
  /\b(career|careers|job|jobs|opening|openings|vacancy|vacancies|join-us|joinus|work-with-us)\b/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjob posting\b/i,
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
  /\bjob description\b/i,
  /\bapply now\b/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#8211;/gi, '-')
  .replace(/â€“|â€”/g, '-')
  .replace(/[–—]/g, '-')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasPublicJobsSignal = (content) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(content ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Merlinhawk Aerospace \| Advanced Aerospace Solutions\s*<\/title>/i.test(rawHtml)
    && /Merlin Hawk Aerospace delivers advanced aerospace, defense, avionics, and engineering solutions/i.test(rawHtml)
    && /<link rel="canonical" href="https:\/\/merlinhawkaerospace\.com"\s*\/?>/i.test(rawHtml)
    && normalized.includes('Pioneer In Indigenous Defence Systems')
    && normalized.includes('Merlinhawk Aerospace boasts over 40 years of leadership in the aviation and defense industries.')
    && normalized.includes('Headquartered in dynamic Bengaluru')
    && normalized.includes('SIDM Champion Awards 2024 - Import Substitution')
    && normalized.includes('Sales: sales@merlinhawk.com')
    && normalized.includes('Product Support: service@merlinhawk.com')
    && normalized.includes('Careers: hr@merlinhawk.com')
  }

export const hasOfficialContactSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Contact Merlinhawk Aerospace\s*<\/title>/i.test(rawHtml)
    && /Get in touch with Merlinhawk Aerospace/i.test(rawHtml)
    && /<link rel="canonical" href="https:\/\/merlinhawkaerospace\.com\/contact"\s*\/?>/i.test(rawHtml)
    && normalized.includes('Merlinhawk Aerospace Pvt. Ltd. # 49, Bommasandra Jigani Link Rd, KIADB Industrial Area, Bengaluru 560105')
    && normalized.includes('Merlinhawk Aerospace EMS Unit 82/A Ground Floor, 3rd Cross, Electronics City Phase 1')
    && normalized.includes('Bengaluru 560100')
    && normalized.includes('Merlinhawk Aerospace Pvt. Ltd. #9-6, 2nd Floor, Surya Towers, HMT Nagar, Nacharam, Hyderabad 500076')
    && normalized.includes('Merlinhawk Aerospace Private Limited DSO 709, 7th floor')
    && normalized.includes('DLF Saket')
    && normalized.includes('South Court')
    && normalized.includes('New Delhi 110017')
    && normalized.includes('Sales: sales@merlinhawk.com')
    && normalized.includes('Product Support: service@merlinhawk.com')
    && normalized.includes('Careers: hr@merlinhawk.com')
}

export const sitemapHasCareerLikeUrl = (xml) => {
  const matches = String(xml ?? '').match(/<loc>[\s\S]*?<\/loc>/gi) || []
  return matches.some((entry) => CAREERS_SIGNAL_PATTERN.test(entry))
}

export const isMissingCareerRoute = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return Number(page?.status) === 404
    && /<title>\s*Page not found/i.test(rawHtml)
    && normalized.includes('404 - Not found')
    && normalized.includes('This page could not be found.')
    && normalized.includes('Continue to the Homepage')
    && !hasPublicJobsSignal(rawHtml)
}

export const createMerlinhawkAerospaceScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Merlinhawk Aerospace verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Merlinhawk Aerospace homepage now appears to expose public jobs')
    }

    const contactPage = await fetchPage(CONTACT_PAGE_URL)
    if (contactPage.status !== 200 || !hasOfficialContactSignal(contactPage.html)) {
      throw new Error('Merlinhawk Aerospace verified contact page no longer matches the known first-party company identity')
    }

    if (hasPublicJobsSignal(contactPage.html)) {
      throw new Error('Merlinhawk Aerospace contact page now appears to expose public jobs')
    }

    const sitemap = await fetchPage(PAGE_SITEMAP_URL)
    if (sitemap.status !== 200 || sitemapHasCareerLikeUrl(sitemap.html)) {
      throw new Error('Merlinhawk Aerospace verified page sitemap no longer matches the no-public-careers surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isMissingCareerRoute(routePage)) {
        throw new Error(`Merlinhawk Aerospace verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createMerlinhawkAerospaceScraper().run(options)

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
