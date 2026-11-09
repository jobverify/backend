import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const OFFICIAL_CAREERS_HANDOFF_URL = 'https://www.fev.com/karriere/'
export const LINKEDIN_COMPANY_URL = 'https://in.linkedin.com/company/fev-india'

const SOURCE = 'fevindia'
const COMPANY = 'FEV India Pvt Ltd'

const decodeHtml = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()

const normalize = (value) => decodeHtml(value) || null

const absoluteUrl = (value) => {
  try {
    return new URL(value, LINKEDIN_COMPANY_URL).toString()
  } catch {
    return null
  }
}

const getField = (text, pattern) => normalize(text.match(pattern)?.[1])

const extractArticleParts = (html) => [...String(html ?? '').matchAll(
  /<article\b[^>]*>([\s\S]*?)<\/article>/gi,
)].map((match) => {
  const block = match[0]
  const descriptionHtml = block.match(
    /<div\b[^>]*feed-shared-update-v2__description[^>]*>([\s\S]*?)<\/div>/i,
  )?.[1] || match[1]
  const links = [...block.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)]
    .map((link) => absoluteUrl(link[1]))
    .filter(Boolean)

  return {
    text: decodeHtml(descriptionHtml),
    sourceUrl: links.find((link) => /linkedin\.com\/posts\//i.test(link)) || null,
  }
})

export const pageIndicatesFevIndiaLinkedinHandoff = (html) =>
  /linkedin\.com\/company\/fev-india/i.test(html || '')

export const extractJobPostings = (html) => extractArticleParts(html)
  .filter(({ text, sourceUrl }) =>
    sourceUrl
    && /\b(hiring|job opening|job opportunity|vacancy)\b/i.test(text)
  )
  .map(({ text, sourceUrl }) => {
    const title = getField(text, /\bposition\s*:\s*(.+?)(?=\s+location\s*:|\s+department\s*:|$)/i)
    const department = getField(text, /\bdepartment\s*:\s*(.+?)$/i)
    const location = getField(text, /\blocation\s*:\s*(.+?)(?=\s+department\s*:|$)/i)

    if (!title || !location || !/\bindia\b/i.test(location)) return null

    return {
      title,
      company: COMPANY,
      department,
      location,
      city: location.split(',')[0]?.trim() || null,
      country: 'India',
      sourceUrl,
      applyUrl: null,
      jobDescription: normalize(text.split(/\bposition\s*:/i)[0]),
    }
  })
  .filter(Boolean)

export const extractJobDetail = (html) => ({
  applyUrl: String(html ?? '').match(/href=["'](mailto:[^"']+)["']/i)?.[1] || null,
  jobDescription: [...String(html ?? '').matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => normalize(match[1]))
    .find(Boolean) || null,
})

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; Jobverify/1.0)',
    Accept: 'text/html,application/xhtml+xml',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createFevIndiaScraper = () => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const handoffHtml = await fetchText(OFFICIAL_CAREERS_HANDOFF_URL)

    if (!pageIndicatesFevIndiaLinkedinHandoff(handoffHtml)) {
      throw new Error('FEV India careers handoff no longer points to the verified public LinkedIn company page')
    }

    const jobs = extractJobPostings(await fetchText(LINKEDIN_COMPANY_URL))

    return Promise.all(jobs.map(async (job) => {
      const detail = extractJobDetail(await fetchText(job.sourceUrl))

      return {
        ...job,
        applyUrl: detail.applyUrl || job.applyUrl,
        jobDescription: detail.jobDescription || job.jobDescription,
        source: SOURCE,
        link: detail.applyUrl || job.applyUrl || job.sourceUrl,
        scrapedAt: new Date().toISOString(),
      }
    }))
  },
})

export const run = async () => createFevIndiaScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const jobs = await run()
  console.log(`FEV India jobs scraped: ${jobs.length}`)
}
