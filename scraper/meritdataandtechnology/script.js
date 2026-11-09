import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'meritdataandtechnology'
export const COMPANY = 'Merit Data & Technology'
export const VERIFIED_ON = '2026-07-13'
export const HOMEPAGE_URL = 'https://meritdata-tech.com/'
export const SITEMAP_URL = 'https://meritdata-tech.com/sitemap.xml'
export const DRAFT_CAREERS_URL = 'https://meritdata-tech.com/draft-templates/careers'
export const CHECKED_ABSENT_ROUTES = [
  'https://meritdata-tech.com/careers',
  'https://meritdata-tech.com/jobs',
  'https://meritdata-tech.com/career',
  'https://meritdata-tech.com/join-us',
  'https://meritdata-tech.com/work-with-us',
  'https://meritdata-tech.com/open-positions',
]
export const VERIFIED_SURFACE_SUMMARY =
  'The live first-party Webflow site existed on July 13, 2026, but it exposed no trustworthy public jobs surface: homepage navigation had no careers link, common careers routes returned 404, the sitemap listed only a placeholder draft careers template, and that draft page contained lorem-ipsum demo job content.'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_TITLE_PATTERN =
  /<title>\s*Merit Data &amp; Technology \| AI &amp; Data Solutions for Business Growth\s*<\/title>/i
const HOMEPAGE_DESCRIPTION_PATTERN =
  /over 20 years of expertise in AI, data collection, and digital transformation/i
const NAV_TECH_PATTERN = /href=["'][^"']*\/tech["']/i
const NAV_DATA_PATTERN = /href=["'][^"']*\/data["']/i
const NAV_TEAM_PATTERN = /href=["'][^"']*\/our-team["']/i
const NAV_WORK_PATTERN = /href=["'][^"']*\/our-work["']/i
const NAV_CONTACT_PATTERN = /href=["'][^"']*\/contact-us["']/i
const CAREERS_LINK_PATTERN =
  /href=["'][^"']*(?:\/careers(?:\/)?|\/career(?:\/)?|\/jobs(?:\/)?|\/join-us(?:\/)?|\/work-with-us(?:\/)?|\/open-positions(?:\/)?|greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|smartrecruiters\.com|indeed\.com)[^"']*["']/i
const PLACEHOLDER_TITLE_PATTERN = /<title>\s*Careers\s*<\/title>/i
const PLACEHOLDER_HEADING_PATTERN = />\s*Jobs\s*&amp;\s*Careers\s*</i
const PLACEHOLDER_LOREM_PATTERN = /lorem ipsum dolor sit amet/i
const PLACEHOLDER_ROLE_PATTERN = />\s*UI Designer\s*</i
const PLACEHOLDER_APPLY_INDEED_PATTERN = />\s*Apply on Indeed\s*</i
const CAREERS_LOC_PATTERN = /<loc>([^<]+)<\/loc>/gi
const REAL_CAREERS_URL_PATTERN =
  /https:\/\/meritdata-tech\.com\/(?:careers|career|jobs|join-us|work-with-us|open-positions)(?:\/)?$/i
const ATS_URL_PATTERN =
  /https?:\/\/(?:[^/]+\.)?(?:greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|smartrecruiters\.com|indeed\.com)\//i

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

const defaultFetchPage = (url) => withRetry(async () => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/xml;q=0.8,*/*;q=0.7',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(15000),
  })

  if (response.status >= 500 || response.status === 429) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return {
    status: response.status,
    text: await response.text(),
  }
}, {
  label: SOURCE,
  attempts: 3,
  baseDelayMs: 2000,
})

const stripHtml = (html) =>
  String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const extractSitemapUrls = (xml) => {
  const urls = []
  const content = String(xml ?? '')

  for (const match of content.matchAll(CAREERS_LOC_PATTERN)) {
    urls.push(match[1].trim())
  }

  return urls
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return HOMEPAGE_TITLE_PATTERN.test(page)
    && HOMEPAGE_DESCRIPTION_PATTERN.test(page)
    && NAV_TECH_PATTERN.test(page)
    && NAV_DATA_PATTERN.test(page)
    && NAV_TEAM_PATTERN.test(page)
    && NAV_WORK_PATTERN.test(page)
    && NAV_CONTACT_PATTERN.test(page)
}

export const hasCareersNavigationLink = (html) =>
  CAREERS_LINK_PATTERN.test(String(html ?? ''))

export const hasOnlyNonPublicCareerUrls = (xml) => {
  const urls = extractSitemapUrls(xml)

  if (!urls.includes(DRAFT_CAREERS_URL)) {
    return false
  }

  return urls.every((url) => {
    if (url === DRAFT_CAREERS_URL) {
      return true
    }

    return !REAL_CAREERS_URL_PATTERN.test(url) && !ATS_URL_PATTERN.test(url)
  })
}

export const isVerifiedPlaceholderCareersPage = (html) => {
  const page = String(html ?? '')
  const text = stripHtml(page)

  return PLACEHOLDER_TITLE_PATTERN.test(page)
    && PLACEHOLDER_HEADING_PATTERN.test(page)
    && PLACEHOLDER_LOREM_PATTERN.test(text)
    && PLACEHOLDER_ROLE_PATTERN.test(page)
    && PLACEHOLDER_APPLY_INDEED_PATTERN.test(page)
}

export const createMeritDataAndTechnologyScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200
      || !hasOfficialHomepageSignal(homepage.text)
      || hasCareersNavigationLink(homepage.text)) {
      throw new Error(
        'Merit Data & Technology homepage no longer matches the verified no-public-jobs surface',
      )
    }

    const sitemap = await fetchPage(SITEMAP_URL)

    if (sitemap.status !== 200 || !hasOnlyNonPublicCareerUrls(sitemap.text)) {
      throw new Error(
        'Merit Data & Technology sitemap no longer matches the verified no-public-jobs surface',
      )
    }

    const draftCareersPage = await fetchPage(DRAFT_CAREERS_URL)

    if (draftCareersPage.status !== 200
      || !isVerifiedPlaceholderCareersPage(draftCareersPage.text)) {
      throw new Error(
        'Merit Data & Technology draft careers page no longer matches the verified placeholder surface',
      )
    }

    for (const route of CHECKED_ABSENT_ROUTES) {
      const response = await fetchPage(route)

      if (response.status !== 404) {
        throw new Error(
          'Merit Data & Technology checked route no longer returns the verified 404 status',
        )
      }
    }

    return []
  },
})

export const run = async () => createMeritDataAndTechnologyScraper().run()

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
