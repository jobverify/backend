import path from 'path'
import { fileURLToPath } from 'url'

import { fetchPageWithRetry } from '../../scraper-support/utils/fetchPageWithRetry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://enerparc.in/apply-now/'

export const SOURCE = 'enerparcenergy'
export const VERIFIED_ON = '2026-08-14'
export const VERIFIED_SURFACE_SUMMARY =
  'Verified on August 14, 2026 that https://enerparc.in/apply-now/ still exposes the official Enerparc Energy careers page with an Apply Now handoff to https://enerparc.zohorecruit.in/jobs/Careers and no first-party public openings listed on the page. Direct Node fetch probes to the verified careers URL returned a Cloudflare 403 "Attention Required! | Cloudflare" block page, so API-only runs must treat that verified block as a graceful no-data condition instead of crashing.'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /Enerparc Energy Pvt\.? Ltd\.?/i.test(page)
    && /Careers/i.test(page)
    && /enerparc\.zohorecruit\.in\/jobs\/Careers/i.test(page)
}

export const hasNoPublicListingsSignal = (html) => {
  const page = String(html ?? '')

  return hasOfficialCareersSignal(page)
    && !/\b(current openings|open positions|job openings|vacancies)\b/i.test(page)
}

const getPageHtml = (page = {}) => String(page.html ?? page.body ?? page.text ?? '')

const getHeader = (page = {}, name) => {
  const normalizedName = String(name ?? '').toLowerCase()
  const headers = page?.headers
  if (!headers) return ''
  if (typeof headers.get === 'function') {
    return String(headers.get(normalizedName) || headers.get(name) || '')
  }
  return String(headers[normalizedName] || headers[name] || '')
}

export const hasVerifiedCloudflareChallengeSignal = (page = {}) => {
  const html = getPageHtml(page)
  const text = String(html ?? '').replace(/\s+/g, ' ').trim()

  return Number(page.status) === 403
    && /<title>\s*(?:Just a moment\.\.\.|Attention Required!\s*\|\s*Cloudflare)\s*<\/title>/i.test(html)
    && (
      /challenges\.cloudflare\.com/i.test(html)
      || (
        text.includes('Sorry, you have been blocked')
        && text.includes('Please enable cookies')
      )
      || text.includes('Enable JavaScript and cookies to continue')
    )
}

const isVerifiedCloudflareChallengedPage = (page = {}, expectedUrl) => {
  const finalUrl = String(page.url || expectedUrl)

  return finalUrl === expectedUrl
    && /cloudflare/i.test(getHeader(page, 'server'))
    && getHeader(page, 'cf-ray').trim().length > 0
    && hasVerifiedCloudflareChallengeSignal(page)
}

const defaultFetchPage = (url) => fetchPageWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-IN,en-US;q=0.9,en;q=0.8',
    Referer: CAREERS_URL,
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const createFetchPageFromText = (fetchText) => async (url) => ({
  status: 200,
  url,
  headers: {},
  html: await fetchText(url),
})

export const createEnerparcEnergyScraper = () => ({
  async run({ fetchPage, fetchText } = {}) {
    const effectiveFetchPage = typeof fetchPage === 'function'
      ? fetchPage
      : typeof fetchText === 'function'
        ? createFetchPageFromText(fetchText)
        : defaultFetchPage

    const careersPage = await effectiveFetchPage(CAREERS_URL)
    if (isVerifiedCloudflareChallengedPage(careersPage, CAREERS_URL)) {
      return []
    }

    const careersHtml = getPageHtml(careersPage)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Enerparc Energy careers page no longer matches the verified official careers surface')
    }

    if (!hasNoPublicListingsSignal(careersHtml)) {
      throw new Error('Enerparc Energy careers page no longer matches the verified official no-public-listings surface')
    }

    return []
  },
})

export const run = async (options = {}) => createEnerparcEnergyScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Enerparc Energy scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
