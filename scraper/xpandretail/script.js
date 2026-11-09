import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'xpandretail'
export const COMPANY = 'Xpandretail'
export const HOMEPAGE_URL = 'https://xpandretail.com/'
export const ABOUT_URL = 'https://xpandretail.com/about-us/'
export const CONTACT_URL = 'https://xpandretail.com/contact/'
export const PRIVACY_URL = 'https://xpandretail.com/privacy-policies/'
export const TERMS_URL = 'https://xpandretail.com/terms-and-conditions/'
export const CAREERS_ROUTE_URLS = [
  'https://xpandretail.com/careers',
  'https://xpandretail.com/careers/',
  'https://xpandretail.com/career',
  'https://xpandretail.com/career/',
  'https://xpandretail.com/jobs',
  'https://xpandretail.com/jobs/',
  'https://xpandretail.com/work-with-us',
  'https://xpandretail.com/work-with-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIRST_PARTY_CAREER_LINK_PATTERN =
  /href=["'](?:https?:\/\/xpandretail\.com)?\/(?:careers?|jobs?|work-with-us)(?:[\/#?][^"']*)?["']/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bjob description\b/i,
  /\bjoin our team\b/i,
  /\bupload your resume\b/i,
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
]

const REDIRECT_STATUS_CODES = new Set([301, 302, 307, 308])

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'manual',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    location: response.headers.get('location'),
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Are You Growing Smarter with Data?')
    && normalized.includes('Xpandretail helps businesses transform footfall into strategy.')
    && normalized.includes('With over 25 years of experience in the region')
    && normalized.includes('Privacy Policies')
    && normalized.includes('Terms and Conditions')
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('About - Xpandretail Retail Data Analytics Experts')
    && normalized.includes('Retail Data Analytics Experts')
    && normalized.includes('Xpandretail has been in Retail and Mall Data Analytics for over 2 decades.')
    && normalized.includes('With over 500+ partnerships')
}

export const hasOfficialContactSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Contact Us - Xpandretail')
    && normalized.includes('You See Customers. We Help You See Patterns.')
    && normalized.includes('info@sdsdxb.com')
    && normalized.includes('Kerala 682020, India')
    && normalized.includes('Connect with Data Analytics Expert')
}

export const hasOfficialPrivacySignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Privacy Policies - Xpandretail')
    && normalized.includes('Xpandretail powered by')
    && normalized.includes('Data System L.L.C collects, uses and discloses personal information')
    && normalized.includes('xpandretail.com')
}

export const hasOfficialTermsSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Terms and Conditions - Xpandretail')
    && normalized.includes('Xpandretail powered by')
    && normalized.includes('Redistribute content from Xpandretail powered by')
    && normalized.includes('logo or other artwork will be allowed for linking absent a trademark license agreement')
}

export const hasFirstPartyCareerLikeLink = (html) =>
  FIRST_PARTY_CAREER_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedNoPublicJobsRoute = (page = {}) =>
  Number(page?.status) === 404
  || (
    Number(page?.status) === 200
    && String(page?.url ?? '') === HOMEPAGE_URL
    && !hasFirstPartyCareerLikeLink(page?.html)
    && !hasPublicJobsSignal(page?.html)
  )
  || (
    REDIRECT_STATUS_CODES.has(Number(page?.status))
    && new URL(String(page?.url ?? HOMEPAGE_URL), HOMEPAGE_URL).pathname !== new URL(HOMEPAGE_URL).pathname
    && String(page?.location ?? '').replace(/\/$/, '') === HOMEPAGE_URL.replace(/\/$/, '')
  )

const assertNoPublicJobsSurface = (page, label) => {
  if (hasPublicJobsSignal(page.html)) {
    throw new Error(`Xpandretail ${label} now exposes public jobs`)
  }

  if (hasFirstPartyCareerLikeLink(page.html)) {
    throw new Error(`Xpandretail ${label} now exposes a first-party careers path`)
  }
}

export const createXpandretailScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Xpandretail homepage no longer matches the verified official site')
    }
    assertNoPublicJobsSurface(homepage, 'homepage')

    const about = await fetchPage(ABOUT_URL)
    if (about.status !== 200 || !hasOfficialAboutSignal(about.html)) {
      throw new Error('Xpandretail about page no longer matches the verified official site')
    }
    assertNoPublicJobsSurface(about, 'about page')

    const contact = await fetchPage(CONTACT_URL)
    if (contact.status !== 200 || !hasOfficialContactSignal(contact.html)) {
      throw new Error('Xpandretail contact page no longer matches the verified official site')
    }
    assertNoPublicJobsSurface(contact, 'contact page')

    const privacy = await fetchPage(PRIVACY_URL)
    if (privacy.status !== 200 || !hasOfficialPrivacySignal(privacy.html)) {
      throw new Error('Xpandretail privacy page no longer matches the verified legal surface')
    }
    assertNoPublicJobsSurface(privacy, 'privacy page')

    const terms = await fetchPage(TERMS_URL)
    if (terms.status !== 200 || !hasOfficialTermsSignal(terms.html)) {
      throw new Error('Xpandretail terms page no longer matches the verified legal surface')
    }
    assertNoPublicJobsSurface(terms, 'terms page')

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)
      if (!isVerifiedNoPublicJobsRoute(careersRoute)) {
        throw new Error('Xpandretail careers routes changed materially or now expose a public careers surface')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createXpandretailScraper().run(options)

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
