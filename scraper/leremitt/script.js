import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'leremitt'
export const COMPANY = 'LeRemitt'
export const HOMEPAGE_URL = 'https://www.axodian.com/'
export const PRODUCT_PAGE_URL = 'https://www.axodian.com/leremitt'
export const CAREERS_ROUTE_URLS = [
  'https://www.axodian.com/careers',
  'https://www.axodian.com/career',
  'https://www.axodian.com/jobs',
  'https://www.axodian.com/join-us',
  'https://www.axodian.com/work-with-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_LIKE_LINK_PATTERN = /href=["'](?:https:\/\/www\.axodian\.com)?\/(?:careers?|jobs?|join-us|work-with-us|openings?|vacanc(?:y|ies))(?:[\/#?][^"']*)?["']/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bjoin our team\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /zohorecruit/i,
]

const MISSING_ROUTE_PATTERNS = [
  /<title>\s*404-error\s*<\/title>/i,
  /<h1[^>]*>\s*404-error\s*<\/h1>/i,
  /Page Not Found/i,
  /Your search has ventured beyond the known universe\./i,
  />Back to Home</i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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
    headers: {
      location: response.headers.get('location'),
    },
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()
  const hasHomepageTitle = /<title[^>]*>\s*Axodian\s*\|\s*Global Trade,\s*Simplified\s*<\/title>/i.test(rawHtml)
  const hasHomepageMetaDescription =
    /<meta[^>]+name=["']description["'][^>]+content=["'][^"']*We simplify international Payments, automate global trade Documentation &amp; Compliance[^"']*["']/i.test(rawHtml)

  return hasHomepageTitle
    && /<link rel="canonical" href="https:\/\/www\.axodian\.com\/"/i.test(rawHtml)
    && normalized.includes('documentation, compliance & payments')
    && normalized.includes('all in one trade-verse.')
    && (normalized.includes('we simplify international payments, automate global trade documentation & compliance')
      || hasHomepageMetaDescription)
    && normalized.includes('leremitt for transparent cross-border payouts')
    && /href="\/leremitt"/i.test(rawHtml)
    && normalized.includes('backed by axilor | capital a')
}

export const hasOfficialProductPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title[^>]*>\s*LeRemitt\s*\|\s*Cross Border Payments Platform For Exporters\s*\|\s*Axodian\s*<\/title>/i.test(rawHtml)
    && /<link rel="canonical" href="https:\/\/www\.axodian\.com\/leremitt"/i.test(rawHtml)
    && normalized.includes('seamless cross-border payments for exporters')
    && normalized.includes('leremitt enables exporters to receive international payments at zero-fx margin and economical fees ensuring transparency and ease')
    && normalized.includes('what is leremitt?')
    && normalized.includes('cross-border payments platform to accept international payments for your export business')
    && normalized.includes('leremitt provides exporters with a transparent, secure, and cost-effective alternative to receive payments from your global buyers.')
    && normalized.includes('collect payments from 140+ countries in 33+ currencies')
    && normalized.includes('how does leremitt work?')
    && normalized.includes('request a demo')
}

export const hasFirstPartyCareerLikeLink = (html) =>
  CAREER_LIKE_LINK_PATTERN.test(String(html ?? ''))

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isVerifiedMissingCareersRoute = (page = {}) => {
  if (Number(page?.status) !== 404) {
    return false
  }

  if (hasPublicJobsSignal(page?.html)) {
    return false
  }

  const html = String(page?.html ?? '')
  const matches404Title = /<title[^>]*>\s*404-error\s*<\/title>/i.test(html)
  const matches404Heading = /<h1[^>]*>\s*404-error\s*<\/h1>/i.test(html)

  return (matches404Title || matches404Heading)
    && MISSING_ROUTE_PATTERNS
      .filter((pattern) => !String(pattern).includes('404-error'))
      .every((pattern) => pattern.test(html))
}

export const createLeRemittScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('LeRemitt verified Axodian homepage no longer matches the known first-party surface')
    }

    if (hasFirstPartyCareerLikeLink(homepage.html) || hasPublicJobsSignal(homepage.html)) {
      throw new Error('LeRemitt homepage now exposes a first-party careers or public jobs surface')
    }

    const productPage = await fetchPage(PRODUCT_PAGE_URL)

    if (productPage.status !== 200 || !hasOfficialProductPageSignal(productPage.html)) {
      throw new Error('LeRemitt verified LeRemitt product page no longer matches the known first-party surface')
    }

    if (hasFirstPartyCareerLikeLink(productPage.html) || hasPublicJobsSignal(productPage.html)) {
      throw new Error('LeRemitt product page now exposes a first-party careers or public jobs surface')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)

      if (!isVerifiedMissingCareersRoute(careersRoute)) {
        throw new Error('LeRemitt parent careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createLeRemittScraper().run(options)

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
