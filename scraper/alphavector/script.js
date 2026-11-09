import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ALPHAVECTOR_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ALPHAVECTOR_CATALOG.source
export const COMPANY = ALPHAVECTOR_CATALOG.companyName
export const HOMEPAGE_URL = ALPHAVECTOR_CATALOG.companyCareerPage
export const LANDER_PATH = '/lander'
export const ROBOTS_TXT_URL = ALPHAVECTOR_CATALOG.robotsTxtUrl
export const SITEMAP_URL = ALPHAVECTOR_CATALOG.sitemapUrl
export const VERIFIED_ON = ALPHAVECTOR_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = ALPHAVECTOR_CATALOG.verifiedSurfaceSummary
export const CAREERS_ROUTE_URLS = [
  'https://alphavector.co/careers',
  'https://alphavector.co/career',
  'https://alphavector.co/jobs',
  'https://alphavector.co/join-us',
  'https://alphavector.co/work-with-us',
  'https://alphavector.co/openings',
  'https://alphavector.co/current-openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const UNREACHABLE_ERROR_PATTERN = /UND_ERR_CONNECT_TIMEOUT|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|getaddrinfo|fetch failed|aborted due to timeout|timeout/i

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bcareer opportunities\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
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
  /peoplestrong/i,
]

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

export const isUnreachableError = (error) => {
  const message = String(error?.message ?? error ?? '')
  const causeCode = String(error?.cause?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')

  return UNREACHABLE_ERROR_PATTERN.test(message)
    || UNREACHABLE_ERROR_PATTERN.test(causeCode)
    || UNREACHABLE_ERROR_PATTERN.test(causeMessage)
}

const fetchPageSafely = async (fetchPage, url) => {
  try {
    return await fetchPage(url)
  } catch (error) {
    if (!isUnreachableError(error)) throw error

    return {
      status: null,
      url,
      html: null,
      errorKind: 'unreachable',
    }
  }
}

export const isUnavailableSurface = (page = {}) =>
  page?.status == null
  && page?.errorKind === 'unreachable'

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasParkedHomepageSignal = (html) =>
  /window\.onload\s*=\s*function\s*\(\)\s*\{\s*window\.location\.href\s*=\s*["']\/lander["']\s*\}/i.test(String(html ?? ''))
  && /<!DOCTYPE html>[\s\S]*<html>[\s\S]*<head>[\s\S]*<script>/i.test(String(html ?? ''))

export const hasExpectedRobotsTxtSignal = (text) => {
  const normalized = String(text ?? '')

  return /User-agent:\s*\*/i.test(normalized)
    && /Allow:\s*\/\s*$/im.test(normalized)
    && /LLM-Policy:\s*\/llms\.txt/i.test(normalized)
    && /Sitemap:\s*\/sitemap\.xml/i.test(normalized)
}

export const extractSitemapUrls = (xml) =>
  [...String(xml ?? '').matchAll(/<loc>(.*?)<\/loc>/gi)].map((match) => match[1])

export const hasExpectedSitemapSignal = (xml) => {
  const urls = extractSitemapUrls(xml)
  return urls.length === 1 && urls[0] === 'https://alphavector.co/lander'
}

export const createAlphavectorScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    try {
      const homepage = await fetchPage(HOMEPAGE_URL)
      if (homepage.status !== 200 || !hasParkedHomepageSignal(homepage.html)) {
        throw new Error('Alphavector verified parked homepage no longer matches the known public surface')
      }

      if (hasPublicJobsSignal(homepage.html)) {
        throw new Error('Alphavector homepage now appears to expose public jobs')
      }

      const robotsTxt = await fetchPage(ROBOTS_TXT_URL)
      if (robotsTxt.status !== 200 || !hasExpectedRobotsTxtSignal(robotsTxt.html)) {
        throw new Error('Alphavector verified robots.txt no longer matches the known public surface')
      }

      const sitemap = await fetchPage(SITEMAP_URL)
      if (sitemap.status !== 200 || !hasExpectedSitemapSignal(sitemap.html)) {
        throw new Error('Alphavector verified sitemap no longer matches the known public surface')
      }

      for (const routeUrl of CAREERS_ROUTE_URLS) {
        const routePage = await fetchPage(routeUrl)

        if (routePage.status !== 200 || !hasParkedHomepageSignal(routePage.html) || hasPublicJobsSignal(routePage.html)) {
          throw new Error(`Alphavector verified no-public-careers route changed: ${routePage.url || routeUrl}`)
        }
      }

      return []
    } catch (error) {
      if (!isUnreachableError(error)) throw error

      const surfaces = await Promise.all([
        fetchPageSafely(fetchPage, HOMEPAGE_URL),
        fetchPageSafely(fetchPage, ROBOTS_TXT_URL),
        fetchPageSafely(fetchPage, SITEMAP_URL),
        ...CAREERS_ROUTE_URLS.map((url) => fetchPageSafely(fetchPage, url)),
      ])

      if (surfaces.every(isUnavailableSurface)) {
        return []
      }

      throw error
    }
  },
})

export const run = async (options = {}) => createAlphavectorScraper().run(options)

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
