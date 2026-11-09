import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  fetchJsonWithRetry,
  fetchTextWithRetry,
} from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const COMPANY_NAME = 'Innova Solutions'
export const SOURCE = 'innovasolutions'
export const COMPANY_CODE = 'INNVIND'
export const CAREERS_PAGE_URL = 'https://innovasolutions.com/careers/'
export const PORTAL_URL = 'https://innovaindia.workllama.com/atsuser/'
export const PORTAL_ORIGIN = 'https://innovaindia.workllama.com'
export const COMPANY_METADATA_URL = `${PORTAL_ORIGIN}/wl-jobs-svc/api/anon/job-posting/companycode/${COMPANY_CODE}`
export const JOBS_API_URL = `${PORTAL_ORIGIN}/wl-jobs-svc/api/anon/job-posting`
export const DEFAULT_PAGE_SIZE = 20
export const DEFAULT_SEARCH_BODY = {
  companyCode: COMPANY_CODE,
  pageNumber: 1,
  pageSize: DEFAULT_PAGE_SIZE,
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

export const hasOfficialCareersSignal = (html) => /Welcome to Innova Solutions|India Careers|IT Solutions Careers[\s\S]*innovaindia\.workllama\.com/i
  .test(String(html ?? ''))

export const hasPortalBootstrapSignal = (html) => /Welcome to Innova Solutions India|companyCode:\s*['"]INNVIND['"]/i
  .test(String(html ?? ''))

export const hasMetadataSignal = (payload = {}) =>
  Array.isArray(payload.candidatePlacementTypes) && payload.candidatePlacementTypes.length > 0

export const extractPublishedJobs = (payload = {}) =>
  Array.isArray(payload.publishedJobs) ? payload.publishedJobs : []

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    Accept: 'application/json,text/plain,*/*',
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createInnovaSolutionsScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The official Innova careers page no longer matches the verified public handoff')
    }

    const portalHtml = await fetchText(PORTAL_URL)
    if (!hasPortalBootstrapSignal(portalHtml)) {
      throw new Error('The official Innova WorkLLama portal no longer matches the verified public bootstrap')
    }

    const metadataPayload = await fetchJson(COMPANY_METADATA_URL)
    if (!hasMetadataSignal(metadataPayload)) {
      throw new Error('The Innova WorkLLama metadata endpoint no longer matches the verified public tenant')
    }

    const jobsPayload = await fetchJson(JOBS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(DEFAULT_SEARCH_BODY),
    })

    const jobs = extractPublishedJobs(jobsPayload)
    if (jobs.length > 0) {
      throw new Error(
        'The verified Innova public WorkLLama feed now contains jobs; field mapping must be re-verified before ingestion is enabled',
      )
    }

    return []
  },
})

export const run = async () => createInnovaSolutionsScraper().run()

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
