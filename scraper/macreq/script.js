import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'macreq'
export const COMPANY = 'Macreq Manufacturing Services Private Ltd'
export const HOMEPAGE_URL = 'https://macreq.com/'
export const ABOUT_URL = 'https://macreq.com/about-us/'
export const CONTACT_URL = 'https://macreq.com/contact-us/'
export const PRIVACY_URL = 'https://macreq.com/privacy-policy/'
export const CAREERS_URL = 'https://macreq.com/careers/'
export const CAREER_ALIAS_URL = 'https://macreq.com/career/'
export const PAGE_SITEMAP_URL = 'https://macreq.com/wp-sitemap-posts-page-1.xml'
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://macreq.com/jobs/',
  'https://macreq.com/job/',
  'https://macreq.com/join-us/',
  'https://macreq.com/work-with-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /<a[^>]+href=["'][^"']*\/careers\/[^#"'][^"']*["'][^>]*>\s*[^<]{1,120}\s*<\/a>/i,
  /<a[^>]+href=["'][^"']*\/jobs?\/[^"']*["'][^>]*>\s*[^<]{1,120}\s*<\/a>/i,
  /\bcurrent openings\b/i,
  /\bjob openings\b/i,
  /\bvacanc(?:y|ies)\b/i,
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
  .replace(/&#8211;|&#x2013;/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Macreq Manufacturing\s*<\/title>/i.test(page)
    && normalized.includes('macreq manufacturing')
    && normalized.includes('support@macreq.com')
    && normalized.includes('careers')
    && normalized.includes('linkedin')
}

export const hasOfficialAboutSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*About Us\s*(?:&#8211;|&#x2013;|[\u2013-])\s*Macreq Manufacturing\s*<\/title>/i.test(page)
    && normalized.includes('macreq manufacturing')
    && normalized.includes('support@macreq.com')
    && normalized.includes('contact us')
}

export const hasOfficialContactSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Contact Us\s*(?:&#8211;|&#x2013;|[\u2013-])\s*Macreq Manufacturing\s*<\/title>/i.test(page)
    && normalized.includes('contact company')
    && normalized.includes('support@macreq.com')
    && normalized.includes('+91 422 3500608')
    && normalized.includes('coimbatore')
}

export const hasOfficialPrivacySignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Privacy Policy\s*(?:&#8211;|&#x2013;|[\u2013-])\s*Macreq Manufacturing\s*<\/title>/i.test(page)
    && normalized.includes('privacy policy')
    && normalized.includes('macreq manufacturing')
    && normalized.includes('support@macreq.com')
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Careers\s*(?:&#8211;|&#x2013;|[\u2013-])\s*Macreq Manufacturing\s*<\/title>/i.test(page)
    && /<link\s+rel=["']canonical["']\s+href=["']https:\/\/macreq\.com\/careers\/["']/i.test(page)
    && normalized.includes('Join the Macreq Revolution!')
    && normalized.includes('Open Positions Across All Departments!')
    && normalized.includes('Apply Now!')
}

export const hasZeroJobsApplyOnlySignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return normalized.includes('Ready to embark on a transformative journey with Macreq? Fill out the form below and take the first step towards a rewarding career.')
    && /<form[^>]+action=["']\/careers\/#wpcf7-[^"']+["'][^>]*>/i.test(page)
    && /name=["']your-cv["']/i.test(page)
    && /type=["']file["']/i.test(page)
    && /support@macreq\.com/i.test(page)
    && !PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(page))
}

export const hasVerifiedCareerAlias = (page = {}) =>
  Number(page?.status) === 200
  && String(page?.url ?? '').toLowerCase() === CAREERS_URL.toLowerCase()
  && hasOfficialCareersSignal(page?.html)
  && hasZeroJobsApplyOnlySignal(page?.html)

export const pageSitemapHasExpectedCoreUrls = (xml) => {
  const page = String(xml ?? '')

  return [
    HOMEPAGE_URL,
    CONTACT_URL,
    ABOUT_URL,
    CAREERS_URL,
    PRIVACY_URL,
  ].every((url) => page.includes(`<loc>${url}</loc>`))
}

export const pageSitemapHasUnexpectedCareerLikeUrl = (xml) => {
  const matches = Array.from(
    String(xml ?? '').matchAll(/<loc>([^<]+)<\/loc>/gi),
    (match) => match[1],
  )

  return matches.some((entry) =>
    /\/(?:career|jobs?|join-us|work-with-us)(?:\/|$|[?#])/i.test(entry)
    && entry.toLowerCase() !== CAREERS_URL.toLowerCase()
  )
}

export const isVerifiedMissingCareerRoute = (page = {}) =>
  Number(page?.status) === 404
  && !PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(page?.html ?? '')))

export const createMacreqScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Macreq verified homepage no longer matches the known first-party surface')
    }

    const about = await fetchPage(ABOUT_URL)
    if (about.status !== 200 || !hasOfficialAboutSignal(about.html)) {
      throw new Error('Macreq verified about page no longer matches the known first-party surface')
    }

    const contact = await fetchPage(CONTACT_URL)
    if (contact.status !== 200 || !hasOfficialContactSignal(contact.html)) {
      throw new Error('Macreq verified contact page no longer matches the known first-party surface')
    }

    const privacy = await fetchPage(PRIVACY_URL)
    if (privacy.status !== 200 || !hasOfficialPrivacySignal(privacy.html)) {
      throw new Error('Macreq verified privacy page no longer matches the known first-party surface')
    }

    const careers = await fetchPage(CAREERS_URL)
    if (careers.status !== 200 || !hasOfficialCareersSignal(careers.html)) {
      throw new Error('Macreq verified careers page no longer matches the known first-party surface')
    }
    if (!hasZeroJobsApplyOnlySignal(careers.html)) {
      throw new Error('Macreq verified careers page now appears to expose public job listings')
    }

    const careerAlias = await fetchPage(CAREER_ALIAS_URL)
    if (!hasVerifiedCareerAlias(careerAlias)) {
      throw new Error('Macreq verified career alias no longer resolves to the official careers zero-jobs surface')
    }

    const pageSitemap = await fetchPage(PAGE_SITEMAP_URL)
    if (
      pageSitemap.status !== 200
      || !pageSitemapHasExpectedCoreUrls(pageSitemap.html)
      || pageSitemapHasUnexpectedCareerLikeUrl(pageSitemap.html)
    ) {
      throw new Error('Macreq verified page sitemap no longer matches the known careers-page surface')
    }

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareerRoute(routePage)) {
        throw new Error(`Macreq verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createMacreqScraper().run(options)

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
