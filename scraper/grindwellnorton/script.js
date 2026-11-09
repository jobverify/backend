import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'grindwellnorton'
export const COMPANY = 'Grindwell Norton'
export const HOMEPAGE_URL = 'https://www.grindwellnorton.co.in/'
export const LINKEDIN_JOBS_URL =
  'https://www.linkedin.com/company/saint-gobain-group-india/jobs/?viewAsMember=true'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const TITLE_PATTERN = /<title>\s*Homepage\s*\|\s*Grindwell Norton Ltd\.\s*<\/title>/i
const DISCOVER_PATTERN = /Discover\s+Grindwell\s+Norton/i
const COMPANY_PATTERN = /Grindwell Norton\s*\(GNO\)/i
const FOUNDED_PATTERN = /Established in 1941/i
const COPYRIGHT_PATTERN = /(?:©|&copy;)\s*Grindwell Norton Ltd\.\s*All Rights Reserved\./i
const SAINT_GOBAIN_PATTERN = /Saint Gobain/i
const VERIFIED_LINKEDIN_PATTERN = new RegExp(
  LINKEDIN_JOBS_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  'i',
)
const FIRST_PARTY_JOBS_PATTERNS = [
  /href=["']https?:\/\/(?:www\.)?grindwellnorton\.co\.in\/(?:careers?|jobs?)(?:\/|["'?#])/i,
  /href=["']\/(?:careers?|jobs?)(?:\/|["'?#])/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bview jobs\b/i,
  /\bapply now\b/i,
]

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: typeof AbortSignal?.timeout === 'function' ? AbortSignal.timeout(15000) : undefined,
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return TITLE_PATTERN.test(page)
    && DISCOVER_PATTERN.test(page)
    && COMPANY_PATTERN.test(page)
    && FOUNDED_PATTERN.test(page)
    && COPYRIGHT_PATTERN.test(page)
    && SAINT_GOBAIN_PATTERN.test(page)
}

export const hasVerifiedLinkedInHandoff = (html) =>
  VERIFIED_LINKEDIN_PATTERN.test(String(html ?? ''))

export const hasFirstPartyJobsSignal = (html) =>
  FIRST_PARTY_JOBS_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasBrowserVerificationBlockSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Verifying your browser/i.test(page)
    && /We're checking your browser before allowing access\./i.test(page)
    && /Enable JavaScript and cookies to continue/i.test(page)
 }

export const createGrindwellNortonScraper = () => ({
  async run({ fetchPage, fetchText } = {}) {
    const effectiveFetchPage = fetchPage
      || (fetchText
        ? async (url) => ({ status: 200, url, html: await fetchText(url) })
        : defaultFetchPage)
    const homepage = await effectiveFetchPage(HOMEPAGE_URL)
    const homepageHtml = homepage.html

    if (
      Number(homepage?.status) === 403
      && hasBrowserVerificationBlockSignal(homepageHtml)
      && !hasFirstPartyJobsSignal(homepageHtml)
    ) {
      return []
    }

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Grindwell Norton official homepage changed; refusing to assume the verified surface still applies')
    }

    if (!hasVerifiedLinkedInHandoff(homepageHtml)) {
      throw new Error('Grindwell Norton careers handoff changed; refusing to assume the verified external route still applies')
    }

    if (hasFirstPartyJobsSignal(homepageHtml)) {
      throw new Error('Grindwell Norton homepage now appears to expose a first-party public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createGrindwellNortonScraper().run(options)

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
