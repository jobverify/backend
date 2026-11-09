import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = 'openstack'
export const COMPANY = 'OpenStack'
export const VERIFIED_ON = '2026-07-25'
export const HOMEPAGE_URL = 'https://www.openstack.org/'
export const JOBS_BOARD_URL = 'https://www.openstack.org/community/jobs'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&#8211;|&#8212;|&ndash;|&mdash;/gi, '-')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOpenSourceProjectHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''

  return /Open Source Cloud Computing Infrastructure - OpenStack/i.test(normalized)
    && /The Most Widely Deployed Open Source Cloud Software in the World/i.test(normalized)
    && /OpenStack is developed by the community\. For the community\./i.test(normalized)
    && (
      /OpenStack is a top-level open infrastructure project supported by the OpenInfra Foundation/i.test(normalized)
      || /An OpenInfra Foundation Project/i.test(normalized)
    )
}

export const hasCommunityJobsBoardSignal = (html = '') => {
  const normalized = normalizeWhitespace(html) || ''

  return (
    /OpenStack Job Board/i.test(normalized)
    && /OpenStack-related jobs board/i.test(normalized)
    && /Check the latest job postings/i.test(normalized)
  ) || (
    /GitJobs/i.test(normalized)
    && /Discover Open Source job opportunities/i.test(normalized)
    && /Jobs from foundation members/i.test(normalized)
    && /\bOPENINFRA\b/i.test(normalized)
  )
}

export const createOpenStackScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOpenSourceProjectHomepageSignal(homepageHtml)) {
      throw new Error('Verified OpenStack homepage changed materially')
    }

    const jobsBoardHtml = await fetchText(JOBS_BOARD_URL)
    if (!hasCommunityJobsBoardSignal(jobsBoardHtml)) {
      throw new Error('Verified OpenStack community jobs board changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createOpenStackScraper().run(options)

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
