import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { withRetry } from '../../scraper-support/utils/retry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const SOURCE = 'mode'
export const COMPANY = 'Mode'
export const VERIFIED_ON = '2026-07-25'
export const CAREERS_PAGE_URL = 'https://mode.com/careers'
export const THOUGHTSPOT_CAREERS_URL = 'https://www.thoughtspot.com/careers'
export const MODE_ACQUISITION_PRESS_URL = 'https://mode.com/press/thoughtspot-acquires-mode/'
export const THOUGHTSPOT_ACQUISITION_PRESS_URL =
  'https://www.thoughtspot.com/press-releases/thoughtspot-completes-200m-acquisition-of-mode-analytics'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableUrl = (value) => {
  try {
    const url = new URL(String(value ?? '').trim())
    url.hash = ''
    url.search = ''

    if (!url.pathname || url.pathname === '/') {
      return `${url.origin}/`
    }

    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}

const defaultFetchPage = (url, { signal } = {}) => withRetry(async () => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal,
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return {
    finalUrl: response.url,
    html: await response.text(),
  }
}, {
  attempts: 3,
  baseDelayMs: 2000,
  label: SOURCE,
  signal,
})

export const hasThoughtSpotCareersSurfaceSignal = ({ finalUrl, html } = {}) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)
  const comparableFinalUrl = normalizeComparableUrl(finalUrl)

  return (
    comparableFinalUrl === normalizeComparableUrl(CAREERS_PAGE_URL)
      || comparableFinalUrl === normalizeComparableUrl(THOUGHTSPOT_CAREERS_URL)
  )
    && text.includes('ThoughtSpot')
    && text.includes('Careers')
    && text.includes('©2026 ThoughtSpot Inc.')
    && /href="https:\/\/www\.thoughtspot\.com\/careers"/i.test(page)
}

export const hasModeAcquisitionSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return text.includes('ThoughtSpot acquires Mode')
    && text.includes('$200M acquisition of Mode')
    && text.includes('June 26, 2023')
}

export const hasThoughtSpotCompletionSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return text.includes('ThoughtSpot Completes $200M Acquisition of Mode Analytics')
    && text.includes('July 19, 2023')
    && text.includes('Mode Analytics')
}

export const createModeScraper = () => ({
  async run({ fetchPage = defaultFetchPage, signal } = {}) {
    const careersPage = await fetchPage(CAREERS_PAGE_URL, { signal })
    if (!hasThoughtSpotCareersSurfaceSignal(careersPage)) {
      throw new Error('Verified Mode careers redirect surface changed materially')
    }

    const modeAcquisitionPage = await fetchPage(MODE_ACQUISITION_PRESS_URL, { signal })
    if (!hasModeAcquisitionSignal(modeAcquisitionPage?.html)) {
      throw new Error('Verified Mode acquisition announcement changed materially')
    }

    const thoughtspotAcquisitionPage = await fetchPage(THOUGHTSPOT_ACQUISITION_PRESS_URL, { signal })
    if (!hasThoughtSpotCompletionSignal(thoughtspotAcquisitionPage?.html)) {
      throw new Error('Verified ThoughtSpot acquisition completion announcement changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createModeScraper().run(options)

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
