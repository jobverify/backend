import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'boomitra'
export const COMPANY = 'Boomitra'
export const VERIFIED_ON = '2026-08-01'
export const CAREERS_URL = 'https://boomitra.com/careers/'
export const ROLE_URL = 'https://boomitra.com/wp-content/uploads/2025/04/Full-Stack-Developer.pdf'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const hasExpectedPdfHost = (value) => {
  try {
    const url = new URL(value)
    return url.hostname.replace(/^www\./i, '').toLowerCase() === 'boomitra.com'
      && url.pathname.toLowerCase() === '/wp-content/uploads/2025/04/full-stack-developer.pdf'
  } catch {
    return false
  }
}

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html)
  const normalized = normalizeWhitespace(page)

  return /<title[^>]*>[^<]*(?:careers[^<]*boomitra|boomitra[^<]*careers|boomitra)[^<]*<\/title>/i.test(page)
    && /<link[^>]+(?:rel=["']canonical["'][^>]+href=["']https:\/\/boomitra\.com\/careers\/["']|href=["']https:\/\/boomitra\.com\/careers\/["'][^>]+rel=["']canonical["'])/i.test(page)
    && /careers at boomitra/i.test(normalized)
    && /see job openings/i.test(normalized)
    && /explore our open roles/i.test(normalized)
    && /full stack developer/i.test(normalized)
    && /bangalore,?\s*india/i.test(normalized)
    && /careers@boomitra\.com/i.test(normalized)
    && /href=["'](?:https:\/\/boomitra\.com)?\/wp-content\/uploads\/2025\/04\/full-stack-developer\.pdf["']/i.test(page)
}

export const extractSearchResults = (html = '') => {
  if (!hasVerifiedCareersPageSignal(html)) {
    throw new Error('Boomitra verified first-party careers page no longer matches the exact role surface')
  }

  return [{
    title: 'Full Stack Developer',
    company: COMPANY,
    department: null,
    location: 'Bangalore, India',
    city: 'Bangalore',
    state: null,
    country: 'India',
    jobId: 'full-stack-developer-2025-04',
    requisitionId: null,
    sourceUrl: ROLE_URL,
    applyUrl: 'mailto:careers@boomitra.com',
    employmentType: null,
    experienceRequired: '2-4 years',
    minimumQualification: "Bachelor's or Master's Degree in Computer Science or Engineering",
    preferredQualification: null,
    requiredSkills: ['Node.js', 'Express.js', 'JavaScript', 'TypeScript', 'React.js', 'Next.js'],
    postingDate: null,
    closingDate: null,
    jobDescription: normalizeWhitespace(html).match(/Full Stack Developer[\s\S]*?careers@boomitra\.com/i)?.[0] || null,
  }]
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 30000,
})

export const createBoomitraScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    return extractSearchResults(await fetchText(CAREERS_URL)).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createBoomitraScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
