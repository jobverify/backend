import path from 'node:path'
import { fileURLToPath } from 'node:url'

import SPOTIFY_PROVIDER from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = SPOTIFY_PROVIDER.source
export const COMPANY = SPOTIFY_PROVIDER.companyName
export const JOBS_PAGE_URL = SPOTIFY_PROVIDER.companyCareerPage
export const LOCATIONS_PAGE_URL = 'https://www.lifeatspotify.com/find-your-team/locations'
export const MUMBAI_LOCATION_PAGE_URL = 'https://www.lifeatspotify.com/find-your-team/locations/mumbai'
export const FAQ_PAGE_URL = 'https://www.lifeatspotify.com/start-your-journey'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

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

export const hasJobsPageSignal = (html) => {
  const text = normalizeWhitespace(html)

  return text.includes('All Jobs')
    && text.includes('Latest')
    && text.includes('Location')
    && text.includes('Category')
    && text.includes('Job type')
    && text.includes('Read our FAQ')
    && text.includes('Spotify AB')
}

export const hasLocationsPageSignal = (html) => {
  const text = normalizeWhitespace(html)

  return text.includes('Rock our world?')
    && text.includes('Asia Pacific')
    && text.includes('Mumbai')
}

export const hasMumbaiZeroJobsSignal = (html) => {
  const text = normalizeWhitespace(html)

  return text.includes('Hello Mumbai!')
    && text.includes('We launched in India in 2019')
    && text.includes('Bandra Kurla Complex')
    && text.includes('0 jobs in all categories in all job types')
}

export const hasFaqLegitimacySignal = (html) => {
  const text = normalizeWhitespace(html)

  return text.includes('How do I know if a Spotify email or website is legit?')
    && text.includes('The URL for the Spotify Careers Site is www.lifeatspotify.com')
    && text.includes('https://lifeatspotify.com/jobs')
    && text.includes('https://jobs.lever.co/spotify')
}

export const createSpotifyScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const jobsPage = await fetchPage(JOBS_PAGE_URL)
    if (jobsPage.status !== 200 || !hasJobsPageSignal(jobsPage.html)) {
      throw new Error('Spotify verified first-party jobs page changed materially')
    }

    const locationsPage = await fetchPage(LOCATIONS_PAGE_URL)
    if (locationsPage.status !== 200 || !hasLocationsPageSignal(locationsPage.html)) {
      throw new Error('Spotify verified first-party locations page changed materially')
    }

    const mumbaiPage = await fetchPage(MUMBAI_LOCATION_PAGE_URL)
    if (mumbaiPage.status !== 200 || !hasMumbaiZeroJobsSignal(mumbaiPage.html)) {
      throw new Error('Spotify verified Mumbai first-party zero-jobs page changed materially')
    }

    const faqPage = await fetchPage(FAQ_PAGE_URL)
    if (faqPage.status !== 200 || !hasFaqLegitimacySignal(faqPage.html)) {
      throw new Error('Spotify verified first-party hiring FAQ changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createSpotifyScraper().run(options)

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
