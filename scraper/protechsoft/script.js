import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'protechsoft'
export const COMPANY = 'Protechsoft'
export const HOMEPAGE_URL = 'https://www.protechsoft.in/'
export const CONTACT_URL = 'https://www.protechsoft.in/contactus'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.protechsoft.in/careers',
  'https://www.protechsoft.in/careers/',
  'https://www.protechsoft.in/career',
  'https://www.protechsoft.in/career/',
  'https://www.protechsoft.in/jobs',
  'https://www.protechsoft.in/jobs/',
  'https://www.protechsoft.in/job',
  'https://www.protechsoft.in/job/',
  'https://www.protechsoft.in/join-us',
  'https://www.protechsoft.in/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_PATH_PATTERN =
  /(?:^|\/)(career|careers|job|jobs|opening|openings|vacancy|vacancies|join-us|joinus|work-with-us)(?:\/|$)/i

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

const normalizeWhitespace = (value) => String(value ?? '')
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

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, HOMEPAGE_URL)
  } catch {
    return null
  }
}

const isFirstPartyUrl = (url) => {
  const hostname = String(url?.hostname ?? '').toLowerCase()
  return hostname === 'protechsoft.in' || hostname.endsWith('.protechsoft.in')
}

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

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return rawHtml.includes('https://www.protechsoft.in')
    && rawHtml.includes('const customDomain = "www.protechsoft.in"')
    && normalized.includes('Software Solutions & Computer Education')
    && normalized.includes('Welcome to ProTech Software Institute, a trusted leader in programming and technical education for over 25 years.')
    && normalized.includes('Join us at ProTech Software Institute and take your first step toward a brighter, tech-driven future!')
    && normalized.includes('Contact us')
    && normalized.includes('Refund policy')
    && normalized.includes('Nakul Satone')
}

export const hasOfficialContactSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return rawHtml.includes('https://www.protechsoft.in/contactus')
    && rawHtml.includes('const customDomain = "www.protechsoft.in"')
    && rawHtml.includes('action="/enquiry"')
    && normalized.includes('Contact us')
    && normalized.includes('Refund policy')
    && normalized.includes('Nakul Satone')
}

export const has404ShellSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return rawHtml.includes('<title>Page Not Found</title>')
    && normalized.includes("Oops! The page you're looking for doesn't exist.")
    && normalized.includes('HOMEPAGE')
    && rawHtml.includes('class="gotohome"')
}

export const hasFirstPartyCareerLikeLink = (html) => {
  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1])
    if (!absoluteUrl || !isFirstPartyUrl(absoluteUrl)) {
      continue
    }

    if (CAREER_PATH_PATTERN.test(absoluteUrl.pathname)) {
      return true
    }
  }

  return false
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareersRoute = (page = {}) =>
  Number(page?.status) === 200
  && has404ShellSignal(page?.html)
  && !hasFirstPartyCareerLikeLink(page?.html)
  && !hasPublicJobsSignal(page?.html)

export const createProtechsoftScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Protechsoft verified official homepage no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Protechsoft homepage now exposes public jobs')
    }
    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Protechsoft homepage now exposes a first-party careers or jobs link')
    }

    const contact = await fetchPage(CONTACT_URL)
    if (contact.status !== 200 || !hasOfficialContactSignal(contact.html)) {
      throw new Error('Protechsoft verified contact surface no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(contact.html)) {
      throw new Error('Protechsoft contact surface now exposes public jobs')
    }
    if (hasFirstPartyCareerLikeLink(contact.html)) {
      throw new Error('Protechsoft contact surface now exposes a first-party careers or jobs link')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareersRoute(routePage)) {
        throw new Error(
          'Protechsoft careers routes changed materially or now expose a public careers surface',
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createProtechsoftScraper().run(options)

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
