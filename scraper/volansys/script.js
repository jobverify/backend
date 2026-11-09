import path from 'node:path'
import { fileURLToPath } from 'node:url'

import provider from './provider.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = provider
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const HOMEPAGE_URL = provider.homepageUrl
export const CAREERS_URL = provider.companyCareerPage
export const PARENT_CAREERS_URL = provider.parentCareersPage
export const BLOCKED_ROUTE_URLS = [
  CAREERS_URL,
  'https://www.volansys.com/careers',
  'https://www.volansys.com/jobs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
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
    html: await response.text(),
  }
}

export const hasAclDigitalRecruitmentSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*acl digital\s*<\/title>/i.test(page)
    && text.includes('acl digital job portal')
    && text.includes('search jobs')
    && text.includes('job seekers/ new hire')
    && text.includes('looking for a job?')
}

export const isBlockedVolansysResponse = (response = {}) => {
  const status = Number(response?.status)
  const text = normalizeWhitespace(response?.html).toLowerCase()

  return status === 522 || text.includes('error code: 522')
}

export const run = async ({ fetchPage = defaultFetchPage } = {}) => {
  const parentCareers = await fetchPage(PARENT_CAREERS_URL)

  if (parentCareers.status !== 200 || !hasAclDigitalRecruitmentSignal(parentCareers.html)) {
    throw new Error('Volansys generic ACL Digital parent careers surface no longer matches the verified public contract')
  }

  for (const url of BLOCKED_ROUTE_URLS) {
    const response = await fetchPage(url)
    if (!isBlockedVolansysResponse(response)) {
      throw new Error(`Volansys blocked official route changed materially: ${url}`)
    }
  }

  return []
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
