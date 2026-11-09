import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'agribazaar'
export const COMPANY = 'Agribazaar'
export const OPPORTUNITIES_URL = 'https://m.agribazaar.com/careers-opportunities.html'
export const JOB_OPENINGS_URL = 'https://blog.agribazaar.com/job-openings/'

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

const PUBLIC_LISTING_SIGNAL = /\b(?:apply now|apply here|view (?:job|role|opening)|open positions?|job listings?|job details?|location\s*:|responsibilities|qualifications)\b/i

export const hasOfficialOpportunitiesSignal = (html = '') => {
  const page = String(html)
  const text = normalizeWhitespace(page)

  return /<title>\s*Agribazaar\s*<\/title>/i.test(page)
    && text.includes('Opportunities')
    && text.includes('Let’s transform the agri-commodity marketplace. Together.')
    && text.includes('upload your resume in relevant profile')
    && /hr@agribazaar\.com/i.test(page)
}

export const hasUnstructuredCurrentOpeningsSignal = (html = '') => {
  const page = String(html)
  const text = normalizeWhitespace(page)

  return /<h[1-6][^>]*>\s*Current Openings\s*<\/h[1-6]>/i.test(page)
    && text.includes('Agribazaar')
    && !PUBLIC_LISTING_SIGNAL.test(text)
}

export const isVerifiedMissingJobOpeningsPage = (page = {}) =>
  Number(page.status) === 404
    && /agribazaar/i.test(String(page.url || JOB_OPENINGS_URL))

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok && response.status !== 404) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  return {
    status: response.status,
    url: response.url || url,
    html: await response.text(),
  }
}

export const createAgribazaarScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const opportunitiesResponse = await fetchText(OPPORTUNITIES_URL)
    const opportunitiesHtml = typeof opportunitiesResponse === 'string'
      ? opportunitiesResponse
      : opportunitiesResponse.html
    if (!hasOfficialOpportunitiesSignal(opportunitiesHtml)) {
      throw new Error('Agribazaar official opportunities page changed; refusing to infer public jobs')
    }

    const openingsResponse = await fetchText(JOB_OPENINGS_URL)
    if (isVerifiedMissingJobOpeningsPage(openingsResponse)) return []

    const openingsHtml = typeof openingsResponse === 'string'
      ? openingsResponse
      : openingsResponse.html
    if (!hasUnstructuredCurrentOpeningsSignal(openingsHtml)) {
      throw new Error('Agribazaar official job-openings page changed; structured coverage is required')
    }

    return []
  },
})

export const run = async (options = {}) => createAgribazaarScraper().run(options)

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
