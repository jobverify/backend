import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { OYO_CATALOG } from './catalog.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bopen jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\bview all open positions\b/i,
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

export const SOURCE = OYO_CATALOG.source
export const COMPANY = OYO_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = OYO_CATALOG.officialBrandName
export const VERIFIED_ON = OYO_CATALOG.verifiedOn
export const PROVIDER_METADATA = OYO_CATALOG
export const HOMEPAGE_URL = OYO_CATALOG.homepageUrl
export const CAREERS_PAGE_URL = OYO_CATALOG.companyCareerPage
export const LINKEDIN_CAREERS_URL = OYO_CATALOG.linkedinCareersUrl

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

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return String(value ?? '').replace(/\/$/, '')
  }
}

const isOyoHost = (value) => {
  try {
    const url = new URL(String(value ?? ''))
    return url.hostname.replace(/^www\./i, '').toLowerCase() === 'oyorooms.com'
  } catch {
    return false
  }
}

export const pageExposesPublicJobListings = (html = '') =>
  PUBLIC_JOB_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasConsumerBookingSurfaceSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('List your property')
    && (
      normalized.includes('Over 174,000+ hotels and homes across 35+ countries')
      || normalized.includes('From Stays to Experiences - Your Trusted Hotel Partner')
      || normalized.includes('From Stays to Experiences — Your Trusted Hotel Partner')
      || (normalized.includes('Top rated value stays across 35+ countries')
        && normalized.includes('175k+ hotels and homes')
        && normalized.includes('35+ countries'))
    )
}

export const extractVerifiedLinkedInCareersUrl = (html = '') => {
  const match = String(html ?? '').match(
    /href=["'](https:\/\/www\.linkedin\.com\/company\/oyo-rooms\/jobs\/?)["'][^>]*>\s*Teams\s*\/\s*Careers\s*</i,
  )

  if (!match?.[1]) return null
  return match[1].replace(/\/?$/, '/')
}

export const hasOfficialHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return hasConsumerBookingSurfaceSignal(html)
    && /OYO for Business/i.test(normalized)
    && normalized.includes('Teams / Careers')
}

export const isAcceptedCareersRedirect = (url = '', html = '') => {
  if (!isOyoHost(url)) return false

  try {
    const parsedUrl = new URL(String(url))
    if (normalizeComparableUrl(parsedUrl.toString()) === normalizeComparableUrl(CAREERS_PAGE_URL)) {
      return false
    }
  } catch {
    return false
  }

  return hasConsumerBookingSurfaceSignal(html)
}

export const createOyoScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (
      Number(homepage.status) !== 200
      || !isOyoHost(homepage.url)
      || !hasOfficialHomepageSignal(homepage.html)
    ) {
      throw new Error('The verified official OYO homepage changed materially')
    }

    if (pageExposesPublicJobListings(homepage.html)) {
      throw new Error('The OYO homepage now appears to expose public jobs')
    }

    const verifiedLinkedInUrl = extractVerifiedLinkedInCareersUrl(homepage.html)
    if (verifiedLinkedInUrl !== LINKEDIN_CAREERS_URL) {
      throw new Error('The verified OYO careers handoff changed materially')
    }

    const careersPage = await fetchPage(CAREERS_PAGE_URL)
    if (pageExposesPublicJobListings(careersPage.html)) {
      throw new Error('The OYO careers route now appears to expose public jobs')
    }

    if (!isAcceptedCareersRedirect(careersPage.url, careersPage.html)) {
      throw new Error('The verified OYO exact-name careers route changed materially')
    }

    return attachInventoryEvidence([], {
      status: 'discovery-only', surface: LINKEDIN_CAREERS_URL, firstParty: false,
      listingComplete: false, pagesFetched: 2, reportedTotal: null, indiaFacetCount: null,
      verifiedAt: new Date().toISOString(),
      reason: 'OYO first-party careers handoff points to LinkedIn; linked public inventory has not been fully enumerated.',
    })
  },
})

export const run = async (options = {}) => createOyoScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  const evidence = readInventoryEvidence(jobs)
  if (evidence?.listingComplete === false) {
    if (isDryRun) {
      const { writeFile } = await import('node:fs/promises')
      await writeFile(path.join(currentDir, 'inventory-evidence.json'), JSON.stringify(evidence, null, 2))
    }
    console.error(evidence.reason)
    process.exitCode = 1
  } else if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
