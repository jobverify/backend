import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://openinapp.com/'
export const CAREERS_ROUTE_URL = 'https://openinapp.com/careers'
export const CAREER_ROUTE_URL = 'https://openinapp.com/career'
export const JOBS_ROUTE_URL = 'https://openinapp.com/jobs'
export const FRESHTEAM_JOBS_URL = 'https://openinapp.freshteam.com/jobs'
export const SOURCE = 'openinapp'
export const COMPANY = 'OpeninApp'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREERS_SIGNAL_PATTERN = /\b(career|careers|job opening|job openings|vacancy|vacancies|join us|we are hiring|hiring)\b/i

export const hasOfficialSiteSignal = (html) => {
  const page = String(html ?? '')

  return /OpeninApp - Best Link Shortener\s*(?:&amp;|&)\s*App Opener/i.test(page)
    && /The ultimate link shortener\./i.test(page)
    && /\bOpeninApp\b/i.test(page)
}

export const hasCareersSignal = (html) => CAREERS_SIGNAL_PATTERN.test(String(html ?? ''))

export const hasOfficialFreshteamBoardSignal = (html) => {
  const page = String(html ?? '')
  const text = page.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

  return /<title>\s*OpeninApp\s*-\s*Careers\s*<\/title>/i.test(page)
    && /\bOpen Positions\b/i.test(text)
    && /data-portal-id=["']job-role-list["']/i.test(page)
}

export const extractFreshteamJobs = (html, { scrapedAt = new Date().toISOString() } = {}) =>
  [...String(html ?? '').matchAll(/<a\b[^>]*href=["']([^"']*\/jobs\/([^/"']+)\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => {
      const sourceUrl = new URL(match[1], FRESHTEAM_JOBS_URL).toString()
      const jobId = match[2]
      const body = match[3]
      const title = body.match(/<div[^>]*class=["'][^"']*job-title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
        ?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const location = match[0].match(/data-portal-location=["']([^"']+)["']/i)?.[1]?.trim() || null
      const employmentType = match[0].match(/data-portal-job-type=["']?(\d+)/i)?.[1]

      if (!title || !location) return null
      return {
        title,
        company: COMPANY,
        department: null,
        location,
        city: location.split(',')[0]?.trim() || null,
        country: 'India',
        jobId: `${SOURCE}-${jobId}`,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType: employmentType === '3' ? 'Internship' : null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: 'On-site',
        source: SOURCE,
        link: sourceUrl,
        scrapedAt,
        companyCareerPage: FRESHTEAM_JOBS_URL,
        companyDomain: 'openinapp.com',
        atsPlatform: 'freshteam',
      }
    })
    .filter(Boolean)

export const isMissingCareerRoute = (html) => {
  const page = String(html ?? '')

  return /OpeninApp\s*\|\s*404 Not found/i.test(page)
    && /og-image\.png/i.test(page)
    && /404/i.test(page)
    && /not found/i.test(page)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'openinapp',
  timeoutMs: 15000,
})

const defaultFetchRoutePage = async (url) => {
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

export const createOpeninAppScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchRoutePage = defaultFetchRoutePage } = {}) {
    const homepageHtml = await fetchText(CAREER_PAGE_URL)

    if (!hasOfficialSiteSignal(homepageHtml)) {
      throw new Error('OpeninApp homepage no longer matches the verified official public surface')
    }

    if (new RegExp(FRESHTEAM_JOBS_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(homepageHtml)) {
      const boardHtml = await fetchText(FRESHTEAM_JOBS_URL)
      if (!hasOfficialFreshteamBoardSignal(boardHtml)) {
        throw new Error('OpeninApp official Freshteam board no longer matches the verified public surface')
      }

      return extractFreshteamJobs(boardHtml)
    }

    if (hasCareersSignal(homepageHtml)) {
      throw new Error('OpeninApp public careers surface changed on the official homepage')
    }

    const routeFetcher = fetchRoutePage || (async (url) => {
      const html = await fetchText(url)
      return {
        status: isMissingCareerRoute(html) ? 404 : 200,
        url,
        html,
      }
    })

    const routePages = await Promise.all([
      routeFetcher(CAREERS_ROUTE_URL),
      routeFetcher(CAREER_ROUTE_URL),
      routeFetcher(JOBS_ROUTE_URL),
    ])

    if (!routePages.every((page) => Number(page?.status) === 404 && isMissingCareerRoute(page?.html))) {
      throw new Error('OpeninApp verified missing careers routes changed on the official site')
    }

    return []
  },
})

export const run = async (options = {}) => createOpeninAppScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'openinapp')
  }
}
