import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { FRONTROW_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export { PROVIDER_METADATA }
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const OFFICIAL_BRAND_NAME = PROVIDER_METADATA.officialBrandName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const SHUTDOWN_UPDATE_URL = PROVIDER_METADATA.shutdownUpdateUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bview openings\b/i,
  /\bjoin our team\b/i,
  /\bwe(?:'re| are)\s+hiring\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
  /\bjob description\b/i,
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
  /darwinbox/i,
  /icims/i,
  /taleo/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;|\u2019/gi, '\'')
  .replace(/&quot;|&ldquo;|&rdquo;|\u201c|\u201d/gi, '"')
  .replace(/&#8211;|&ndash;|\u2013|\u2014/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => normalizeWhitespace(value).toLowerCase()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    ok: response.ok,
    status: response.status,
    url: response.url,
    text: await response.text(),
  }
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedShutdownUpdateSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeText(rawHtml)

  return /<title>\s*FrontRow Update\s*-\s*FrontRow\s*-\s*Medium\s*<\/title>/i.test(rawHtml)
    && normalized.includes('frontrow update')
    && normalized.includes('unfortunately, frontrow shut down a few months ago')
    && normalized.includes('written by frontrow')
    && normalized.includes('sep 13, 2023')
}

export const hasCloudflareBlockSignal = (page = {}) => {
  const rawHtml = String(page?.text ?? '')
  const normalized = normalizeText(rawHtml)

  return Number(page?.status) === 403
    && String(page?.url || '') === SHUTDOWN_UPDATE_URL
    && /<title>\s*Attention Required!\s*\|\s*Cloudflare\s*<\/title>/i.test(rawHtml)
    && normalized.includes('please enable cookies.')
    && normalized.includes('sorry, you have been blocked')
    && normalized.includes('unable to access medium.com')
}

export const isExpectedHomepageRedirect = (page = {}) =>
  Boolean(page?.ok)
  && Number(page?.status) === 200
  && String(page?.url || '') === SHUTDOWN_UPDATE_URL
  && hasVerifiedShutdownUpdateSignal(page?.text)

const isExpectedShutdownSurface = (page = {}) =>
  isExpectedHomepageRedirect(page) || hasCloudflareBlockSignal(page)

export const createFrontRowScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (!isExpectedShutdownSurface(homepage)) {
      throw new Error('FrontRow homepage no longer redirects to the verified shutdown update')
    }
    if (!hasCloudflareBlockSignal(homepage) && hasPublicJobsSignal(homepage.text)) {
      throw new Error('FrontRow homepage redirect target now appears to expose public jobs')
    }

    const shutdownUpdate = await fetchPage(SHUTDOWN_UPDATE_URL)
    if (
      !isExpectedShutdownSurface(shutdownUpdate)
    ) {
      throw new Error('FrontRow verified shutdown update no longer matches the known public surface')
    }
    if (!hasCloudflareBlockSignal(shutdownUpdate) && hasPublicJobsSignal(shutdownUpdate.text)) {
      throw new Error('FrontRow shutdown update now appears to expose public jobs')
    }

    return []
  },
})

export const run = async (options = {}) => createFrontRowScraper().run(options)

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
