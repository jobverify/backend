import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'amrutam'
export const COMPANY = 'Amrutam'
export const VERIFIED_ON = '2026-07-30'
export const HOMEPAGE_URL = 'https://amrutam.co.in/'
export const TEAM_URL = 'https://amrutam.co.in/pages/meet-the-team'
export const STORY_URL = 'https://amrutam.co.in/pages/our-story-the-journey-of-amrutam-1'
export const WORK_WITH_US_URL = 'https://forms.gle/YCyYEZ5BLToeqw7u9'
export const WORK_WITH_US_FINAL_URL_PREFIX =
  'https://docs.google.com/forms/d/e/1FAIpQLSf8eTDw5QUalbBJqZVjtzv-blElhCQgCBI4QNj9tHTZ-VDl-w/viewform'
export const CAREERS_URL = 'https://amrutam.co.in/careers'
export const PAGES_CAREERS_URL = 'https://amrutam.co.in/pages/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bopen roles?\b/i,
  /\bjoin our team\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /successfactors/i,
  /oraclecloud/i,
  /icims/i,
  /taleo/i,
]

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

const decodeEntities = (value = '') =>
  String(value ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
    .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value = '') =>
  decodeEntities(String(value ?? ''))
    .replace(/\s+/g, ' ')
    .trim()

const normalizeText = (value = '') =>
  normalizeWhitespace(
    String(value ?? '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const matchesExpectedUrl = (value, expected) => {
  try {
    const actualUrl = new URL(value)
    const expectedUrl = new URL(expected)
    const normalizePath = (pathname) => pathname === '/' ? '/' : pathname.replace(/\/+$/, '')

    return actualUrl.hostname.toLowerCase() === expectedUrl.hostname.toLowerCase()
      && normalizePath(actualUrl.pathname) === normalizePath(expectedUrl.pathname)
  } catch {
    return false
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /^Amrutam - Authentic Ayurvedic Products for Health & Beauty$/i.test(extractTitle(page) || '')
    && /\bAmrutam\b/i.test(text)
    && /\bAuthentic Ayurvedic Products for Health & Beauty\b/i.test(text)
    && /\bsupport@amrutam\.co\.in\b/i.test(text)
    && /https:\/\/forms\.gle\/YCyYEZ5BLToeqw7u9/i.test(page)
}

export const hasOfficialTeamPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /^Meet the Team - Amrutam$/i.test(extractTitle(page) || '')
    && /\bMEET THE TEAM\b/i.test(text)
    && /\bThe OG Gang of Amrutam\b/i.test(text)
    && /\bAshok Gupta\b/i.test(text)
    && /\bChandrakanta Gupta\b/i.test(text)
}

export const hasOfficialStoryPageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeText(page)

  return /^Our Story - The Journey of Amrutam$/i.test(extractTitle(page) || '')
    && /\bThe Origins of Amrutam\b/i.test(text)
    && /\bGwalior\b/i.test(text)
    && /\bAshok and Smt\. Chandrakanta Gupta\b/i.test(text)
    && /\bElixir of Life\b/i.test(text)
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedWorkWithUsFormPage = (page = {}) => {
  const html = String(page.html ?? page.text ?? '')
  const title = extractTitle(html)
  const text = normalizeText(html)

  return Number(page.status) === 200
    && String(page.url || '').startsWith(WORK_WITH_US_FINAL_URL_PREFIX)
    && /^Work with Amrutam$/i.test(title || '')
    && text.includes('Exciting Opportunities await at Amrutam - Apply Now!')
    && /Location:\s*Gwalior - Heart of India/i.test(text)
    && text.includes('Which role are you interested in?')
}

export const isVerifiedMissingCareerRoute = (page = {}, expectedUrl = '') => {
  const html = String(page.html ?? page.text ?? '')
  const text = normalizeText(html)

  return Number(page.status) === 404
    && matchesExpectedUrl(page.url || '', expectedUrl)
    && /^404 Not Found - Amrutam$/i.test(extractTitle(html) || '')
    && text.includes("Sorry! Page you are looking can't be found.")
    && !pageExposesPublicJobListings(html)
}

const assertVerifiedCompanyPage = ({
  page,
  expectedUrl,
  routeLabel,
  matcher,
}) => {
  if (
    Number(page.status) !== 200
    || !matchesExpectedUrl(page.url || '', expectedUrl)
    || !matcher(page.html)
  ) {
    throw new Error(`The verified ${routeLabel} for Amrutam no longer matches the official company surface`)
  }

  if (pageExposesPublicJobListings(page.html)) {
    throw new Error(`The verified ${routeLabel} for Amrutam now appears to expose public jobs`)
  }
}

export const createAmrutamScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    assertVerifiedCompanyPage({
      page: homepage,
      expectedUrl: HOMEPAGE_URL,
      routeLabel: 'homepage',
      matcher: hasOfficialHomepageSignal,
    })

    const teamPage = await fetchPage(TEAM_URL)
    assertVerifiedCompanyPage({
      page: teamPage,
      expectedUrl: TEAM_URL,
      routeLabel: 'team page',
      matcher: hasOfficialTeamPageSignal,
    })

    const storyPage = await fetchPage(STORY_URL)
    assertVerifiedCompanyPage({
      page: storyPage,
      expectedUrl: STORY_URL,
      routeLabel: 'story page',
      matcher: hasOfficialStoryPageSignal,
    })

    const workWithUsForm = await fetchPage(WORK_WITH_US_URL)
    if (!isVerifiedWorkWithUsFormPage(workWithUsForm)) {
      throw new Error(`The verified Work with Us form for Amrutam no longer matches the trusted public handoff`)
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (!isVerifiedMissingCareerRoute(careersPage, CAREERS_URL)) {
      throw new Error(`Amrutam verified no-public-careers route changed: ${careersPage.url || CAREERS_URL}`)
    }

    const pagesCareersPage = await fetchPage(PAGES_CAREERS_URL)
    if (!isVerifiedMissingCareerRoute(pagesCareersPage, PAGES_CAREERS_URL)) {
      throw new Error(`Amrutam branded pages/careers route changed: ${pagesCareersPage.url || PAGES_CAREERS_URL}`)
    }

    return []
  },
})

export const run = async (options = {}) => createAmrutamScraper().run(options)

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
