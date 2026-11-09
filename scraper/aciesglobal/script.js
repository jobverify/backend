import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREER_PAGE_URL = 'https://www.acies.consulting/'
export const CAREERS_ROUTE_URL = 'https://www.acies.consulting/careers'
export const CAREERS_PAGE_URL = 'https://www.acies.consulting/careers.html'
export const APPLICATION_PAGE_URL = 'https://www.acies.consulting/careers-apply.html'
export const CONTRACT_CA_URL = 'https://www.acies.consulting/careers-contract-ca.html'
export const HIRING_DAYS_URL = 'https://www.acies.consulting/hiring-days.html'
export const SOURCE = 'aciesglobal'
export const COMPANY = 'Acies Global'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const HOMEPAGE_TITLE_PATTERN = /<title>\s*Acies\s*\|\s*Democratizing Technology\s*<\/title>/i
const HOMEPAGE_BRAND_PATTERN = />\s*Democratizing Technology\s*</i
const HOMEPAGE_CAREERS_LINK_PATTERN =
  /href=["'][^"']*(?:careers\.html|careers\.php|\/careers\/?)["'][^>]*>(?:[\s\S]*?Careers\s*)?<\/a>/i
const CAREERS_404_PATTERN = /HTTP 404\b/i

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'aciesglobal',
  timeoutMs: 15000,
})

const defaultFetchTextOnce = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return text
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return HOMEPAGE_TITLE_PATTERN.test(page) && HOMEPAGE_BRAND_PATTERN.test(page)
}

export const hasHomepageCareersLink = (html) =>
  HOMEPAGE_CAREERS_LINK_PATTERN.test(String(html ?? ''))

export const isVerifiedCareers404Error = (error) =>
  CAREERS_404_PATTERN.test(String(error?.message ?? error))
  && String(error?.message ?? error).includes(CAREERS_ROUTE_URL)

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u2013\u2014]/g, '-')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const pageText = (html) => normalizeWhitespace(html).toLowerCase()

export const hasOfficialCareersPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = pageText(rawHtml)

  return /<title>\s*Careers \| Acies\s*<\/title>/i.test(rawHtml)
    && normalized.includes("more than a job. it's our mission to surmount the impossible.")
    && normalized.includes('view job openings')
    && normalized.includes('hiring days')
    && normalized.includes('ca/ acca professionals')
    && normalized.includes('apply here')
}

export const hasOfficialApplicationPageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = pageText(rawHtml)

  return /<title>\s*Send us your application \| Careers \| Acies\s*<\/title>/i.test(rawHtml)
    && normalized.includes('send us your application')
    && normalized.includes('careers')
}

export const hasOfficialHiringDaysSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = pageText(rawHtml)

  return /<title>\s*Hiring Days \| Careers \| Acies\s*<\/title>/i.test(rawHtml)
    && normalized.includes('fast track recruitment for select competencies')
    && normalized.includes('current hiring opportunities')
    && normalized.includes('same-day hiring for select competencies')
    && !/"@type"\s*:\s*"JobPosting"/i.test(rawHtml)
    && !/href=["'][^"']*jobdetails\//i.test(rawHtml)
}

export const hasOfficialContractHiringSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = pageText(rawHtml)

  return /<title>\s*CA\/ ACCA Professionals \| Contract Hiring \| Careers \| Acies\s*<\/title>/i.test(rawHtml)
    && normalized.includes('contract hiring program')
    && normalized.includes('ca/ acca professionals')
    && normalized.includes('join us and get to work on high-impact projects')
    && normalized.includes('qualified or semi-qualified ca or acca professional')
    && normalized.includes('qualification requirements')
    && normalized.includes('qualified/ semi-qualified ca/ acca professionals')
    && normalized.includes('area of expertise required')
    && normalized.includes('ia/ orm/ bcm/ tprm/ compliance and controls effectiveness')
    && normalized.includes('financial services (india and other geographies)')
    && normalized.includes('project based')
    && normalized.includes('customer/ client facing')
    && normalized.includes('on-ground and in-person')
}

export const extractContractHiringJobs = (html, { now = () => new Date().toISOString() } = {}) => {
  if (!hasOfficialContractHiringSignal(html)) return []

  const jobDescription = [
    'Join our Contract Hiring Program!',
    'Are you a qualified or semi-qualified CA or ACCA professional looking for exciting, flexible, project-based opportunities?',
    'Qualification requirements Qualified/ semi-qualified CA/ ACCA professionals',
    'Area of expertise required IA/ ORM/ BCM/ TPRM/ compliance and controls effectiveness',
    'Industry of expertise required Financial services (India and other geographies)',
    'Nature of contracting Project based',
    'Nature of role Customer/ client facing',
    'Type of role On-ground and in-person',
  ].join(' ')

  return [{
    title: 'CA/ ACCA Professionals',
    company: COMPANY,
    department: 'Contract Hiring Program',
    location: 'India and other geographies',
    city: null,
    country: 'India',
    jobId: 'ca-acca-professionals-contract-hiring',
    requisitionId: 'ca-acca-professionals-contract-hiring',
    sourceUrl: CONTRACT_CA_URL,
    applyUrl: CONTRACT_CA_URL,
    employmentType: 'Contract',
    experienceRequired: null,
    minimumQualification: 'Qualified/ semi-qualified CA/ ACCA professionals',
    preferredQualification: null,
    requiredSkills: [
      'IA/ ORM/ BCM/ TPRM/ compliance and controls effectiveness',
      'Customer/ client facing',
      'On-ground and in-person',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription,
    source: SOURCE,
    link: CONTRACT_CA_URL,
    scrapedAt: now(),
  }]
}

export const createAciesGlobalScraper = () => ({
  async run(options = {}) {
    const {
      fetchText = defaultFetchText,
      fetchLegacyRoute = fetchText === defaultFetchText ? defaultFetchTextOnce : fetchText,
      now = () => new Date().toISOString(),
    } = options

    const homepageHtml = await fetchText(CAREER_PAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml) || !hasHomepageCareersLink(homepageHtml)) {
      throw new Error('Acies Global homepage no longer matches the verified official site')
    }

    let missingLegacyCareersRoute = false
    try {
      await fetchLegacyRoute(CAREERS_ROUTE_URL)
    } catch (error) {
      if (isVerifiedCareers404Error(error)) {
        missingLegacyCareersRoute = true
      } else {
        throw error
      }
    }

    if (!missingLegacyCareersRoute) {
      throw new Error('Acies Global careers route no longer matches the verified public 404 surface')
    }

    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Acies Global careers page no longer matches the verified public careers surface')
    }

    const applicationHtml = await fetchText(APPLICATION_PAGE_URL)
    if (!hasOfficialApplicationPageSignal(applicationHtml)) {
      throw new Error('Acies Global generic application page no longer matches the verified non-listing surface')
    }

    const hiringDaysHtml = await fetchText(HIRING_DAYS_URL)
    if (!hasOfficialHiringDaysSignal(hiringDaysHtml)) {
      throw new Error('Acies Global hiring days page no longer matches the verified non-listing surface')
    }

    const contractHiringHtml = await fetchText(CONTRACT_CA_URL)
    const jobs = extractContractHiringJobs(contractHiringHtml, { now })
    if (jobs.length === 0) {
      throw new Error('Acies Global contract hiring page no longer matches the verified public profile')
    }

    return jobs
  },
})

export const run = async (options = {}) => createAciesGlobalScraper().run(options)

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
