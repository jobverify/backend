import { execFile as execFileCallback } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

import { fetchPageWithRetry } from '../../scraper-support/utils/fetchPageWithRetry.js'

import { CLARION_TECHNOLOGIES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const execFile = promisify(execFileCallback)

export const PROVIDER_METADATA = CLARION_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const FEATURED_JOBS_URL = PROVIDER_METADATA.featuredJobsUrl
export const OPENINGS_URL = PROVIDER_METADATA.openingsUrl
export const JOBS_LIST_URL = new URL('/get-jobs-listing', FEATURED_JOBS_URL).toString()
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

export const defaultFetchPage = (url, {
  fetchPageImpl = fetchPageWithRetry,
} = {}) => fetchPageImpl(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const isClarionJobsUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
      && url.hostname === 'jobs.clariontechnologies.co.in'
      && url.port === '444'
  } catch {
    return false
  }
}

const isLeafSignatureError = (error) => {
  const visited = new Set()
  let current = error

  while (current && !visited.has(current)) {
    visited.add(current)
    if (current.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') return true
    if (/unable to verify (?:the )?(?:first certificate|leaf signature)/i.test(current.message || '')) {
      return true
    }
    current = current.cause
  }

  return false
}

export const fetchClarionJobsText = async (url, {
  fetchPage = defaultFetchPage,
  execFile: runExecFile = execFile,
  signal,
} = {}) => {
  try {
    const page = await fetchPage(url)
    return page.html
  } catch (error) {
    if (!isClarionJobsUrl(url) || !isLeafSignatureError(error)) throw error

    const { stdout } = await runExecFile(process.platform === 'win32' ? 'curl.exe' : 'curl', [
      '--disable',
      '--fail-with-body',
      '--silent',
      '--show-error',
      '--location',
      '--max-redirs', '5',
      '--connect-timeout', '10',
      '--max-time', '30',
      '--user-agent', USER_AGENT,
      '--header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      '--proto', '=https',
      '--proto-redir', '=https',
      url,
    ], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      signal,
      windowsHide: true,
    })

    return stdout
  }
}

export const defaultFetchText = async (url, options = {}) => {
  if (isClarionJobsUrl(url)) {
    return fetchClarionJobsText(url, options)
  }

  const page = await defaultFetchPage(url, options)
  return page.html
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return extractTitle(page) === 'Careers | Clarion Technologies'
    && text.includes('Permanent Work From Home Opportunity')
    && page.includes(FEATURED_JOBS_URL)
}

export const hasFeaturedJobsSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return extractTitle(page) === 'Careers | Clarion Technologies'
    && text.includes('Featured Jobs')
    && text.includes('Apply Now')
    && /open-position-detail\?jobid=\d+/i.test(page)
}

export const hasJobsListingSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return extractTitle(page) === 'Careers | Clarion Technologies'
    && /Openings \[\d+\]/i.test(text)
    && text.includes('Apply Now')
    && /open-position-detail\?jobid=\d+/i.test(page)
}

export const extractFeaturedJobs = (html = '', {
  now = () => new Date().toISOString(),
} = {}) => {
  const rows = [...String(html ?? '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]

  return rows.flatMap(([, row]) => {
    const titleMatch = row.match(
      /<a\b[^>]*href=["']([^"']*open-position-detail\?jobid=\d+[^"']*)["'][^>]*class=["'][^"']*\bh2\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i,
    ) || row.match(
      /<a\b[^>]*class=["'][^"']*\bh2\b[^"']*["'][^>]*href=["']([^"']*open-position-detail\?jobid=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/i,
    )

    if (!titleMatch) return []

    const sourceUrl = new URL(titleMatch[1], CAREERS_URL).toString()
    const requisitionId = new URL(sourceUrl).searchParams.get('jobid')
    const title = normalizeWhitespace(titleMatch[2])
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1])
    const location = normalizeWhitespace(cells[1]?.match(/<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1]) || null
    const experienceRequired = normalizeWhitespace(cells[2]) || null
    const positionCount = Number.parseInt(cells[3]?.match(/<b\b[^>]*>\s*(\d+)\s*<\/b>/i)?.[1] || '', 10)
    const isRemote = /\b(?:permanent\s+)?wfh\b|\bremote\b/i.test(location || '')

    return [{
      title,
      company: COMPANY,
      department: null,
      location,
      city: isRemote ? null : location,
      state: null,
      country: 'India',
      jobId: `${SOURCE}-${requisitionId}`,
      requisitionId,
      sourceUrl,
      applyUrl: sourceUrl,
      link: sourceUrl,
      employmentType: null,
      workplaceType: isRemote ? 'Remote' : null,
      remoteStatus: isRemote ? 'Remote' : null,
      experienceRequired,
      numberOfPositions: Number.isFinite(positionCount) ? positionCount : null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      compensation: null,
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      companyCareerPage: CAREERS_URL,
      companyDomain: 'clariontech.com',
      atsPlatform: 'official-company-careers',
      source: SOURCE,
      scrapedAt: now(),
    }]
  })
}

export const createClarionTechnologiesScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Clarion Technologies official careers page no longer matches the verified first-party surface')
    }

    const featuredJobsHtml = await fetchText(FEATURED_JOBS_URL)
    if (!hasFeaturedJobsSignal(featuredJobsHtml)) {
      throw new Error('Clarion Technologies featured jobs iframe no longer matches the verified public surface')
    }

    const jobsListingHtml = await fetchText(JOBS_LIST_URL)
    if (!hasJobsListingSignal(jobsListingHtml)) {
      throw new Error('Clarion Technologies jobs listing no longer matches the verified public surface')
    }

    const jobs = extractFeaturedJobs(jobsListingHtml, { now })
    if (jobs.length === 0) {
      throw new Error('Clarion Technologies featured jobs iframe no longer yields normalized openings')
    }

    return jobs
  },
})

export const run = async (options = {}) => createClarionTechnologiesScraper().run(options)

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
