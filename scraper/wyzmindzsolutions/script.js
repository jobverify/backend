import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { WYZMINDZ_SOLUTIONS_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = WYZMINDZ_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CONTACT_URL = PROVIDER_METADATA.contactPageUrl
export const NO_PUBLIC_CAREER_ROUTE_URLS = [
  'https://wyzmindz.com/careers/',
  'https://wyzmindz.com/jobs/',
  'https://wyzmindz.com/career/',
  'https://wyzmindz.com/join-us/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = page.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')

  return /WyzMindz/i.test(page)
    && /AI\s*Powered Workflow Automation/i.test(text)
    && /Get in touch/i.test(text)
    && /Srinivasa Industrial Estate/i.test(text)
  }

export const hasVerifiedContactSignal = (html = '') => {
  const page = String(html ?? '')
  const text = page.replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')

  return /WyzMindz/i.test(page)
    && /Get in touch/i.test(text)
    && /Srinivasa Industrial Estate/i.test(text)
}

export const hasPublicJobBoardSignal = (html = '') => {
  const page = String(html ?? '')

  return /\bCurrent Openings\b/i.test(page)
    || /\bOpen Role\b/i.test(page)
    || /\bApply Now\b/i.test(page)
    || /<a[^>]+href="[^"]*(?:\/careers?\/|\/jobs?\/|greenhouse|lever|ashbyhq|smartrecruiters|workdayjobs|myworkdayjobs|zohorecruit)[^"]*"[^>]*>/i.test(page)
  }

export const isVerifiedMissingCareerRoute = ({ status, html } = {}) =>
  status === 404
  && (
    /Page not found(?:\s*-\s*WyzMindz)?/i.test(String(html ?? ''))
    || /class="[^"]*error404[^"]*"/i.test(String(html ?? ''))
  )

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })

  return {
    status: response.status,
    url,
    finalUrl: response.url || url,
    html: await response.text(),
  }
}

export const createWyzmindzSolutionsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepagePage = await fetchPage(HOMEPAGE_URL)
    if (hasPublicJobBoardSignal(homepagePage.html)) {
      throw new Error('Wyzmindz Solutions public jobs surface changed; re-verify before enabling enumeration')
    }

    if (!hasOfficialHomepageSignal(homepagePage.html)) {
      throw new Error('Wyzmindz Solutions homepage no longer matches the verified first-party marketing site')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    if (!hasVerifiedContactSignal(contactPage.html)) {
      throw new Error('Wyzmindz Solutions contact page no longer matches the verified first-party contact surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREER_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingCareerRoute(routePage)) {
        throw new Error('Wyzmindz Solutions public jobs surface changed; re-verify before enabling enumeration')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createWyzmindzSolutionsScraper().run(options)

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
