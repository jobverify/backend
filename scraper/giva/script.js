import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'giva'
export const COMPANY = 'GIVA'
export const OFFICIAL_BRAND_NAME = 'GIVA Jewellery'
export const HOMEPAGE_URL = 'https://www.giva.co/'
export const CAREERS_URL = 'https://www.giva.co/pages/careers'
export const COMPANY_DOMAIN = 'giva.co'
export const ATS_PLATFORM = 'official-company-site-no-public-careers'
export const COUNTRY_FILTER = 'India'
export const VERIFIED_ON = '2026-07-16'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 16, 2026 that the GIVA homepage still includes Quick links, Join Us, and Indiejewel Fashions Private Limited, and that the careers page remains a first-party shell with Why GIVA? and Hear from the #GemsofGIVA but no public job listings.'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /\bapply now\b/i,
  /\bapply here\b/i,
  /\bjob openings?\b/i,
  /\bopen positions?\b/i,
  /\bcurrent openings?\b/i,
  /\bsearch jobs\b/i,
  /\bview openings\b/i,
  /\bjob description\b/i,
  /"@type"\s*:\s*"JobPosting"/i,
  /\bjobposting\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
]

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x2019;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#8211;|&#x2013;|&ndash;|&#8212;|&#x2014;|&mdash;/gi, '-')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const extractTitle = (html) => normalizeWhitespace(
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return response.text()
}

export const hasVerifiedGivaHomepageSignals = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()
  const title = extractTitle(page)

  return title === 'Buy Gold & Lab Grown Diamond Jewellery | Silver Jewellery - GIVA'
    && normalized.includes('quick links')
    && /<a[^>]+href=["']\/pages\/careers["'][^>]*>\s*Join Us\s*<\/a>/i.test(page)
    && normalized.includes('indiejewel fashions private limited')
}

export const hasVerifiedGivaCareersSignals = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()
  const title = extractTitle(page)

  return title === 'Careers at GIVA | Explore Job Opportunities & Join Our Team - GIVA'
    && normalized.includes('why giva?')
    && normalized.includes('hear from the #gemsofgiva')
    && normalized.includes('indiejewel fashions private limited')
}

export const hasPublicGivaJobSignals = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(page) || pattern.test(normalized))
}

export const createGivaScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasVerifiedGivaHomepageSignals(homepageHtml)) {
      throw new Error('GIVA verified homepage no longer matches the known first-party surface')
    }
    if (hasPublicGivaJobSignals(homepageHtml)) {
      throw new Error('GIVA homepage now appears to expose a public jobs surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedGivaCareersSignals(careersHtml)) {
      throw new Error('GIVA verified careers shell no longer matches the known first-party surface')
    }
    if (hasPublicGivaJobSignals(careersHtml)) {
      throw new Error('GIVA careers page now appears to expose a public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createGivaScraper().run(options)

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
