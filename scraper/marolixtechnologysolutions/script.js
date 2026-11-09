import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MAROLIX_TECHNOLOGY_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = MAROLIX_TECHNOLOGY_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CONTACT_URL = PROVIDER_METADATA.contactPageUrl
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

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
    headers: Object.fromEntries(response.headers.entries()),
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  return /Marolix Technology Solutions Pvt Ltd/i.test(page)
}

export const hasPublicCareersLink = (html = '') =>
  /href=["'][^"']*(careers|career|jobs|job)[^"']*["']/i.test(String(html ?? ''))

export const hasOfficialContactSignal = (html = '') => {
  const page = String(html ?? '')
  return /Contact Us/i.test(page)
    && /hrrecruiter@marolix\.com/i.test(page)
}

export const hasCloudflareOriginOutageSignal = (html = '') => {
  const page = String(html ?? '')
  return /52(?:2|3):\s*(?:Connection timed out|Origin is unreachable)/i.test(page)
    && /marolix\.com/i.test(page)
}

export const hasCloudflareTimeoutSignal = hasCloudflareOriginOutageSignal

export const isExpectedCloudflareOriginOutageRoute = (response = {}) =>
  [522, 523].includes(Number(response?.status)) && hasCloudflareOriginOutageSignal(response?.html)

export const isExpectedCloudflareTimeoutRoute = isExpectedCloudflareOriginOutageRoute

export const isExpectedMissingCareersRoute = (response = {}) => {
  const status = Number(response?.status)
  const html = String(response?.html ?? '')
  return status === 404 && /not found/i.test(html)
}

export const run = async ({ fetchPage = defaultFetchPage } = {}) => {
  const homepage = await fetchPage(HOMEPAGE_URL)
  const homepageTimedOut = isExpectedCloudflareOriginOutageRoute(homepage)
  if (!homepageTimedOut && (!hasOfficialHomepageSignal(homepage?.html) || hasPublicCareersLink(homepage?.html))) {
    throw new Error('Marolix Technology Solutions verified homepage no-public-careers surface changed materially')
  }

  const contactPage = await fetchPage(CONTACT_URL)
  const contactTimedOut = isExpectedCloudflareOriginOutageRoute(contactPage)
  if (!contactTimedOut && !hasOfficialContactSignal(contactPage?.html)) {
    throw new Error('Marolix Technology Solutions verified contact page changed materially')
  }

  const careersPage = await fetchPage(CAREERS_URL)
  const careersTimedOut = isExpectedCloudflareOriginOutageRoute(careersPage)
  if (!careersTimedOut && !isExpectedMissingCareersRoute(careersPage)) {
    throw new Error('Marolix Technology Solutions verified missing careers route changed materially')
  }

  return []
}

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
