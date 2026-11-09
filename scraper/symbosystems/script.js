import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'symbosystems'
export const COMPANY = 'Symbo Systems'
export const HOMEPAGE_URL = 'https://www.symbosystems.com/'
export const CHECKED_ROUTE_URLS = [
  'https://www.symbosystems.com/careers',
  'https://www.symbosystems.com/careers/',
  'https://www.symbosystems.com/career',
  'https://www.symbosystems.com/career/',
  'https://www.symbosystems.com/jobs',
  'https://www.symbosystems.com/jobs/',
  'https://www.symbosystems.com/join-us',
  'https://www.symbosystems.com/join-us/',
  'https://www.symbosystems.com/openings',
  'https://www.symbosystems.com/openings/',
  'https://www.symbosystems.com/apply',
  'https://www.symbosystems.com/apply/',
  'https://www.symbosystems.com/work-with-us',
  'https://www.symbosystems.com/work-with-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_LIKE_LINK_PATTERN =
  /href=["'](?:https?:\/\/www\.symbosystems\.com)?\/(?:careers?|jobs?|join-us|openings|apply|work-with-us)(?:[\/#?][^"']*)?["']/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcareers at symbo systems\b/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /\bview jobs\b/i,
  /\bwe(?:'|&apos;|&#39;|&rsquo;)?re hiring\b/i,
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
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
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

export const hasOfficialHomepageSignal = (html) => {
  const raw = String(html ?? '')
  const normalized = normalizeWhitespace(raw)

  return raw.includes('https://cdn.tailwindcss.com')
    && raw.includes("tailwind.config = {")
    && raw.includes("'700': '#003366'")
    && raw.includes("'600': '#C00000'")
    && raw.includes("font-family: 'Inter', sans-serif;")
    && normalized.includes('SymboSystems LLC')
    && normalized.includes('Innovative Real Estate Solutions')
    && normalized.includes('Experience seamless transactions and expert guidance for buyers and sellers from start to finish.')
    && normalized.includes('About SymboSystems LLC')
    && normalized.includes('At SymboSystems LLC, we are redefining the real estate experience.')
    && normalized.includes('Our Mission')
    && normalized.includes('Our Values')
    && normalized.includes('Empowering Home Buyers')
    && normalized.includes('Terms of Service')
}

export const hasFirstPartyCareerLikeLink = (html) =>
  CAREER_LIKE_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedBlockedCareersRoute = (page = {}) => {
  if (Number(page?.status) !== 403) {
    return false
  }

  if (hasPublicJobsSignal(page?.html)) {
    return false
  }

  const normalized = normalizeWhitespace(page?.html)
  return /<Code>\s*AccessDenied\s*<\/Code>/i.test(String(page?.html ?? ''))
    && /<Message>\s*Access Denied\s*<\/Message>/i.test(String(page?.html ?? ''))
    && normalized === 'AccessDenied Access Denied'
}

export const createSymboSystemsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Symbo Systems verified official homepage no longer matches the known public surface')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Symbo Systems homepage now exposes a first-party careers or jobs link')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Symbo Systems homepage now exposes a public jobs surface')
    }

    for (const routeUrl of CHECKED_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isVerifiedBlockedCareersRoute(routePage)) {
        throw new Error('Symbo Systems careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createSymboSystemsScraper().run(options)

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
