import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'outlookpublishingindiapvtltd'
export const COMPANY = 'Outlook Publishing India Pvt. Ltd.'
export const HOMEPAGE_URL = 'https://www.outlookindia.com/'
export const ABOUT_URL = 'https://www.outlookindia.com/about-us'
export const CONTACT_URL = 'https://www.outlookindia.com/contact-us'
export const CAREERS_ROUTE_URLS = [
  'https://www.outlookindia.com/careers',
  'https://www.outlookindia.com/careers/',
  'https://www.outlookindia.com/career',
  'https://www.outlookindia.com/career/',
  'https://www.outlookindia.com/jobs',
  'https://www.outlookindia.com/jobs/',
  'https://www.outlookindia.com/work-with-us',
  'https://www.outlookindia.com/work-with-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIRST_PARTY_CAREER_LINK_PATTERN =
  /href=["'](?:https?:\/\/(?:www\.)?outlookindia\.com)?\/(?:careers?|jobs?|work-with-us)(?:[\/#?][^"']*)?["']/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bjob description\b/i,
  /\bjoin our team\b/i,
  /\bwork with us\b/i,
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
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeHtml = (value) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

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
  const raw = normalizeHtml(html)
  const normalized = normalizeWhitespace(html)

  return raw.includes('property="og:site_name" content="outlook india"')
    && raw.includes('outlook publishing india pvt ltd')
    && raw.includes('266, okhla industrial estate ( phase iii), new delhi, india')
    && raw.includes('href="/about-us">about us</a>')
    && raw.includes('href="/contact-us">contact us</a>')
    && /Copyright[^A-Za-z0-9]*20\d{2}\s*Outlook Publishing India Pvt\. Ltd\./i.test(normalized)
}

export const hasOfficialAboutSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('About Us - Outlook India')
    && normalized.includes('Shaping Public Discourse Since 1995')
    && normalized.includes('Outlook Publishing (India) Pvt. Ltd. started operations in 1995')
    && normalized.includes('The Company is a part of the Rajan Raheja group')
}

export const hasOfficialContactSignal = (html) => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Contact Us: Reach Out to Outlook India for Inquiries, Feedback, Email')
    && normalized.includes('Outlook Publishing (India) Private Limited')
    && normalized.includes('266, Okhla Industrial Estate (Phase III) New Delhi 110020')
    && normalized.includes('yourhelpline@outlookindia.com')
    && normalized.includes('letters@outlookindia.com')
}

export const hasFirstPartyCareerLikeLink = (html) =>
  FIRST_PARTY_CAREER_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareersRoute = (page = {}) =>
  Number(page?.status) === 404
  && !hasFirstPartyCareerLikeLink(page?.html)
  && !hasPublicJobsSignal(page?.html)

export const isVerifiedTrailingSlashRedirect = (page = {}, expectedLocation) =>
  REDIRECT_STATUS_CODES.has(Number(page?.status))
  && String(page?.location ?? '') === String(expectedLocation ?? '')
  && !hasFirstPartyCareerLikeLink(page?.html)
  && !hasPublicJobsSignal(page?.html)

export const createOutlookPublishingIndiaScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Outlook Publishing India verified official homepage no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Outlook Publishing India homepage now exposes public jobs')
    }
    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Outlook Publishing India homepage now exposes a first-party careers path')
    }

    const about = await fetchPage(ABOUT_URL)
    if (about.status !== 200 || !hasOfficialAboutSignal(about.html)) {
      throw new Error('Outlook Publishing India verified about surface no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(about.html)) {
      throw new Error('Outlook Publishing India about surface now exposes public jobs')
    }
    if (hasFirstPartyCareerLikeLink(about.html)) {
      throw new Error('Outlook Publishing India about surface now exposes a first-party careers path')
    }

    const contact = await fetchPage(CONTACT_URL)
    if (contact.status !== 200 || !hasOfficialContactSignal(contact.html)) {
      throw new Error('Outlook Publishing India verified contact surface no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(contact.html)) {
      throw new Error('Outlook Publishing India contact surface now exposes public jobs')
    }
    if (hasFirstPartyCareerLikeLink(contact.html)) {
      throw new Error('Outlook Publishing India contact surface now exposes a first-party careers path')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)
      const isVerifiedRoute = isVerifiedMissingCareersRoute(careersRoute)
        || isVerifiedTrailingSlashRedirect(
          careersRoute,
          new URL(careersRouteUrl).pathname.replace(/\/$/, ''),
        )

      if (!isVerifiedRoute) {
        throw new Error(
          'Outlook Publishing India careers routes changed materially or now expose a public careers surface',
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createOutlookPublishingIndiaScraper().run(options)

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
