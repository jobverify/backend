import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'winresearchcentre'
export const COMPANY = 'Win Research Centre'
export const HOMEPAGE_URL = 'https://www.winresearchcentre.in/'
export const CAREERS_URL = 'https://www.winresearchcentre.in/careers'
export const CONTACT_URL = 'https://www.winresearchcentre.in/contact-us'
export const SITEMAP_URL = 'https://www.winresearchcentre.in/sitemap.xml'
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://www.winresearchcentre.in/career',
  'https://www.winresearchcentre.in/jobs',
  'https://www.winresearchcentre.in/join-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /recruitcrm/i,
  /linkedin\.com\/jobs/i,
  /bamboohr/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;/gi, "'")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const isFirstPartyUrl = (value) => {
  try {
    const hostname = new URL(value || HOMEPAGE_URL).hostname.toLowerCase()
    return hostname === 'winresearchcentre.in' || hostname === 'www.winresearchcentre.in'
  } catch {
    return false
  }
}

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

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*High-Performance Mobile Applications \| Win Research Centre \| Win Research Centre, WRC\s*<\/title>/i.test(page)
    && /Hostinger Website Builder/i.test(page)
    && normalized.includes("Powering Businesses with Automated APP's, Personalised Software and Data Bases for Companies.")
    && normalized.includes("WIN RESEARCH CENTRE -One stop solution for all your Business Needs")
    && normalized.includes("Market Research Surveys & Data Collection")
    && normalized.includes('Services Offered:')
    && normalized.includes('Phone: +91 8123784727')
    && normalized.includes('ceo@winresearchcentre.in')
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Careers \| Win Research Centre, WRC\s*<\/title>/i.test(page)
    && normalized.includes('Certificate courses offered')
    && normalized.includes('gateway to a world of knowledge and skill development')
    && normalized.includes('Data Science & Prediction Modelling')
    && normalized.includes('Machine Learning & Artificial Intelligence')
    && normalized.includes('Skill Development and Job Consultation')
    && normalized.includes('Mobile App Development and Web Application Development')
    && normalized.includes('Bridge Course for students travelling abroad to pursue masters.')
    && normalized.includes('ceo@winresearchcentre.in')
}

export const hasOfficialContactSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Contact us \| Win Research Centre, WRC\s*<\/title>/i.test(page)
    && normalized.includes('Contact us')
    && normalized.includes('Feel free to contact us with any questions or concerns.')
    && normalized.includes('You can use the form on our website or email us directly.')
    && normalized.includes('Email ceo@winresearchcentre.in')
    && normalized.includes('Phone +91 8123784727')
    && normalized.includes('Address Mysore and Bangalore')
}

export const hasExpectedSitemapEntries = (xml) => {
  const page = String(xml ?? '')

  return page.includes('<loc>https://www.winresearchcentre.in</loc>')
    && page.includes('<loc>https://www.winresearchcentre.in/careers</loc>')
    && page.includes('<loc>https://www.winresearchcentre.in/contact-us</loc>')
    && page.includes('<loc>https://www.winresearchcentre.in/services</loc>')
    && !hasPublicJobsSignal(page)
    && !/<loc>https:\/\/www\.winresearchcentre\.in\/jobs(?:\/|<)/i.test(page)
  }

export const isVerifiedMissingRoute = (page = {}) => {
  const html = String(page?.html ?? '')
  const normalized = normalizeWhitespace(html)

  return Number(page?.status) === 404
    && /<title>\s*Website Builder 404\s*<\/title>/i.test(html)
    && normalized.includes('Website Builder 404')
    && /(?:Page not found|could not be found|does not exist)/i.test(normalized)
    && !hasPublicJobsSignal(html)
}

export const createWinResearchCentreScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !isFirstPartyUrl(homepage.url) || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Win Research Centre verified official homepage no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Win Research Centre homepage now appears to expose a public jobs surface')
    }

    const careersPage = await fetchPage(CAREERS_URL)
    if (careersPage.status !== 200 || !isFirstPartyUrl(careersPage.url) || !hasOfficialCareersSignal(careersPage.html)) {
      throw new Error('Win Research Centre verified careers page no longer matches the known first-party non-listing surface')
    }
    if (hasPublicJobsSignal(careersPage.html)) {
      throw new Error('Win Research Centre careers page now appears to expose a public jobs surface')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (contactPage.status !== 200 || !isFirstPartyUrl(contactPage.url) || !hasOfficialContactSignal(contactPage.html)) {
      throw new Error('Win Research Centre verified contact page no longer matches the known first-party surface')
    }
    if (hasPublicJobsSignal(contactPage.html)) {
      throw new Error('Win Research Centre contact page now appears to expose a public jobs surface')
    }

    const sitemapPage = await fetchPage(SITEMAP_URL)
    if (sitemapPage.status !== 200 || !isFirstPartyUrl(sitemapPage.url) || !hasExpectedSitemapEntries(sitemapPage.html)) {
      throw new Error('Win Research Centre verified sitemap changed materially or now exposes public jobs routes')
    }

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingRoute(routePage)) {
        throw new Error(
          `Win Research Centre verified missing first-party route changed or now exposes a public jobs surface: ${routePage.url || routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createWinResearchCentreScraper().run(options)

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
