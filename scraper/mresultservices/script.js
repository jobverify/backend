import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MRESULT_SERVICES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = MRESULT_SERVICES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const CONTACT_URL = PROVIDER_METADATA.contactPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value = '') => String(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#8217;|&rsquo;/gi, "'")
  .replace(/[‘’]/g, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('Transform Complexity Into Competitive Advantage')
    && normalized.includes('Business value begins with a single data point.')
    && normalized.includes('MResult is a leading Data, Analytics & Digital Solutions partner')
    && normalized.includes('The average MResulter spends 7+ years here')
  }

export const hasOfficialCareersSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return normalized.includes('A Place Where Good Work Meets Great People')
    && normalized.includes('An Open Culture Where People Thrive')
    && normalized.includes('View Current Job Openings')
    && normalized.includes('A Work Environment That Values Growth')
    && normalized.includes('Many of our employees have built long-term careers')
  }

export const hasOfficialContactSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)
  return (
    normalized.includes("Let's Collaborate.")
    && normalized.includes('Bangalore')
    && normalized.includes('9th Floor, Nalapad Brigade Centre, Mahadevapura, Whitefield Main Rd, Bengaluru 560048')
    && normalized.includes('Mangalore')
    && normalized.includes('Rama Bhavan Complex, Kodialbail, Mangalore 575003')
  ) || (
    normalized.includes('Contact Us - MResult')
    && normalized.includes('We Are Here To Help')
    && normalized.includes("Let's Collaborate.")
    && normalized.includes('Connecticut')
    && normalized.includes('Bangalore')
    && normalized.includes('Mangalore')
  )
}

const hasCloudflareBlockSignal = (page = {}) =>
  /Attention Required!\s*\|\s*Cloudflare/i.test(String(page?.html ?? ''))
  && /Sorry, you have been blocked/i.test(String(page?.html ?? ''))

const TRUSTWORTHY_PUBLIC_JOBS_INVENTORY_PATTERNS = [
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /zohorecruit/i,
  /darwinbox/i,
  /keka\.com\/careers/i,
  /@type"\s*:\s*"JobPosting"/i,
  /"@type"\s*:\s*"JobPosting"/i,
  /<a[^>]+href="[^"]*(?:\/jobs\/|\/careers\/[^"]+\/[^"]+)"/i,
]

export const hasTrustworthyPublicJobsInventorySignal = (html = '') =>
  TRUSTWORTHY_PUBLIC_JOBS_INVENTORY_PATTERNS.some((pattern) => pattern.test(String(html)))

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

export const createMResultServicesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('MResult Services verified official homepage no longer matches the trusted first-party surface')
    }

    const careers = await fetchPage(CAREERS_URL)
    if (careers.status !== 200 || !hasOfficialCareersSignal(careers.html)) {
      throw new Error('MResult Services verified careers page no longer matches the trusted first-party contract')
    }
    if (hasTrustworthyPublicJobsInventorySignal(careers.html)) {
      throw new Error('MResult Services careers page now exposes a trustworthy public jobs inventory')
    }

    const contact = await fetchPage(CONTACT_URL)
    if ((contact.status !== 200 || !hasOfficialContactSignal(contact.html)) && !hasCloudflareBlockSignal(contact)) {
      throw new Error('MResult Services verified contact page no longer matches the trusted first-party surface')
    }

    return []
  },
})

export const run = async (options = {}) => createMResultServicesScraper().run(options)

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
