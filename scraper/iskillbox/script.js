import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ISKILLBOX_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ISKILLBOX_CATALOG.source
export const COMPANY = ISKILLBOX_CATALOG.companyName
export const VERIFIED_ON = ISKILLBOX_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = ISKILLBOX_CATALOG.verifiedSurfaceSummary
export const HOMEPAGE_URL = ISKILLBOX_CATALOG.officialHomepageUrl
export const CAREER_PAGE_URL = ISKILLBOX_CATALOG.companyCareerPage
export const PROVIDER_METADATA = ISKILLBOX_CATALOG

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
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
  /darwinbox/i,
  /icims/i,
  /taleo/i,
  /linkedin\.com\/jobs\/view\//i,
]

const stripTags = (value) => String(value ?? '').replace(/<[^>]+>/g, ' ')

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#8211;|&ndash;|&#x2013;/gi, '-')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")

const normalizeWhitespace = (value) => decodeHtmlEntities(stripTags(value))
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

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title\b[^>]*>\s*iSkillbox Corporate Training\s*<\/title>/i.test(rawHtml)
    && /Welcome to iSkillBox/i.test(normalized)
    && /Your Trusted Partner In Corporate Training/i.test(normalized)
    && /Upskill\. Reskill\. Transform\./i.test(normalized)
    && /iskillbox\.com\/career\//i.test(rawHtml)
}

export const hasOfficialCareerShellSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title\b[^>]*>\s*Career\s*(?:-|&#8211;|&ndash;|&#x2013;|\u2013)\s*iSkillbox Corporate Training\s*<\/title>/i.test(rawHtml)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/iskillbox\.com\/career\/["']/i.test(rawHtml)
    && /\bCareer\b/i.test(normalized)
    && /ISKILLBOX LEARNING TECHNOLOGIES PRIVATE LIMITED/i.test(normalized)
    && /contact with our team/i.test(normalized)
    && /\(\+91\)\s*902\s*800\s*5801/i.test(normalized)
    && /Vasukamal Express/i.test(normalized)
  }

export const createISkillBoxScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('iSkillBox verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('iSkillBox homepage now appears to expose public jobs')
    }

    const careerPage = await fetchPage(CAREER_PAGE_URL)
    if (careerPage.status !== 200) {
      throw new Error('iSkillBox verified first-party career shell no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(careerPage.html)) {
      throw new Error('iSkillBox career shell now appears to expose public jobs')
    }

    if (!hasOfficialCareerShellSignal(careerPage.html)) {
      throw new Error('iSkillBox verified first-party career shell no longer matches the no-public-jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createISkillBoxScraper().run(options)

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
