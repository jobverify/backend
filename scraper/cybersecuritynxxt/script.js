import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'cybersecuritynxxt'
export const COMPANY = 'Cybersecurity-NxxT'
export const HOMEPAGE_URL = 'https://cybersecurity-nxxt.com/'
export const ROBOTS_URL = 'https://cybersecurity-nxxt.com/robots.txt'
export const SITEMAP_URL = 'https://cybersecurity-nxxt.com/sitemap.xml'
export const CAREERS_ROUTE_URLS = [
  'https://cybersecurity-nxxt.com/careers',
  'https://cybersecurity-nxxt.com/career',
  'https://cybersecurity-nxxt.com/jobs',
  'https://cybersecurity-nxxt.com/career.html',
  'https://cybersecurity-nxxt.com/careers.html',
  'https://cybersecurity-nxxt.com/jobs.html',
  'https://cybersecurity-nxxt.com/career-opportunities.html',
  'https://cybersecurity-nxxt.com/current-openings.html',
  'https://cybersecurity-nxxt.com/open-positions.html',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const FIRST_PARTY_CAREER_LINK_PATTERN =
  /href=["'](?:https?:\/\/(?:www\.)?cybersecurity-nxxt\.com)?\/?(?:careers?|jobs?|career\.html|careers\.html|jobs\.html|career-opportunities\.html|current-openings\.html|open-positions\.html)(?:[\/#?][^"']*)?["']/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bcareer opportunities\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bjob description\b/i,
  /\bsearch jobs\b/i,
  /\bjoin our team\b/i,
  /\bwork with us\b/i,
  /\bapply now\b/i,
  /\bsubmit (?:your )?resume\b/i,
  /\bupload your resume\b/i,
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

const normalizeHtml = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'manual',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
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

  return raw.includes('<title>cybersecurity-nxxt</title>')
    && raw.includes('href="cloud-security.html"')
    && raw.includes('href="managed-security-services.html"')
    && raw.includes('href="security-operations-centre.html"')
    && raw.includes('href="#nxxt-form"')
    && normalized.includes('with Cybersecurity NxxT')
    && normalized.includes('At Cybersecurity Nxxt, we pride ourselves as proactive problem solvers.')
    && normalized.includes('Cybersecurity NXXT Pvt. Ltd.')
    && normalized.includes('Coimbatore - 641021, India.')
    && normalized.includes('Copyright ©2024 Cybersecurity-NXXT. All rights reserved.')
}

export const hasFirstPartyCareerLikeLink = (html) =>
  FIRST_PARTY_CAREER_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingPublicSurface = (page = {}) => {
  const raw = normalizeHtml(page?.html)
  const normalized = normalizeWhitespace(page?.html)

  return Number(page?.status) === 404
    && raw.includes('<title>404 - file or directory not found.</title>')
    && normalized.includes('404 - File or directory not found.')
    && normalized.includes(
      'The resource you are looking for might have been removed, had its name changed, or is temporarily unavailable.',
    )
    && !hasFirstPartyCareerLikeLink(page?.html)
    && !hasPublicJobsSignal(page?.html)
}

export const createCybersecurityNxxtScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Cybersecurity-NxxT verified official homepage no longer matches the known public surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Cybersecurity-NxxT homepage now exposes public jobs')
    }
    if (hasFirstPartyCareerLikeLink(homepage.html)) {
      throw new Error('Cybersecurity-NxxT homepage now exposes a first-party careers path')
    }

    const robots = await fetchPage(ROBOTS_URL)
    if (!isVerifiedMissingPublicSurface(robots)) {
      throw new Error(
        'Cybersecurity-NxxT robots surface no longer matches the verified no-public-careers baseline',
      )
    }

    const sitemap = await fetchPage(SITEMAP_URL)
    if (!isVerifiedMissingPublicSurface(sitemap)) {
      throw new Error(
        'Cybersecurity-NxxT sitemap surface no longer matches the verified no-public-careers baseline',
      )
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)
      if (!isVerifiedMissingPublicSurface(careersRoute)) {
        throw new Error(
          'Cybersecurity-NxxT careers routes changed materially or now expose a public careers surface',
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createCybersecurityNxxtScraper().run(options)

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
