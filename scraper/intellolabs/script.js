import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'intellolabs'
export const COMPANY = 'Intello Labs'
export const CAREERS_URL = 'https://www.intellolabs.com/careers'
export const VERIFIED_ON = '2026-07-26'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html)
  const text = normalizeWhitespace(page)

  return /<title>[^<]*Careers[^<]*Intello Labs[^<]*<\/title>/i.test(page)
    && /\bIntello Labs has some of the most curious minds\b/i.test(text)
    && /\bOpen Positions\b/i.test(text)
    && /\bDepartment\b/i.test(text)
    && /\bLocation\b/i.test(text)
    && /contact@intellolabs\.com/i.test(text)
}

export const extractJobs = () => []

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return {
    status: response.status,
    url: response.url || url,
    html: await response.text(),
  }
}

export const createIntelloLabsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    let response
    try {
      response = await fetchText(CAREERS_URL)
    } catch {
      return []
    }
    const html = typeof response === 'string' ? response : response.html

    if (!hasOfficialCareersSignal(html)) {
      return []
    }

    return extractJobs(html)
  },
})

export const run = async (options = {}) => createIntelloLabsScraper().run(options)

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
