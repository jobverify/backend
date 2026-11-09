import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_PAGE_URL = 'https://www.cynlr.com/careers/in/sde/sw-eng'

const normalizeText = (value) => String(value ?? '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const slugify = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const getAddressText = (html) => normalizeText(
  String(html ?? '').match(/India\s+Address[\s\S]*?<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1],
)

const getRoleTitle = (html) => {
  const sectionMatch = String(html ?? '').match(
    /<h3[^>]*>\s*Software Development\s*<\/h3>[\s\S]*?<button[^>]*>\s*([^<]+?)\s*<\/button>[\s\S]*?<button[^>]*>\s*Apply\s*<\/button>/i,
  )

  return normalizeText(sectionMatch?.[1])
}

const getDepartment = (html) => normalizeText(
  String(html ?? '').match(/<h3[^>]*>\s*(Software Development)\s*<\/h3>/i)?.[1],
)

const getContactEmail = (html) => String(html ?? '').match(/[A-Z0-9._%+-]+@cynlr\.com/i)?.[0]?.toLowerCase() || null

const normalizeLocation = (addressText) => {
  if (!addressText || !/\bBengaluru\b/i.test(addressText)) {
    return {
      city: null,
      location: 'India',
    }
  }

  return {
    city: 'Bengaluru',
    location: 'Bengaluru, Karnataka, India',
  }
}

export const extractCynlrJobs = (html) => {
  const title = getRoleTitle(html)
  const department = getDepartment(html)
  const addressText = getAddressText(html)
  const email = getContactEmail(html)
  const { city, location } = normalizeLocation(addressText)
  const requisitionId = slugify(title)

  if (!title || !department || !requisitionId) return []

  return [{
    title,
    company: 'CynLr',
    department,
    location,
    city,
    country: 'India',
    jobId: `cynlr-${requisitionId}`,
    requisitionId,
    sourceUrl: CAREERS_PAGE_URL,
    applyUrl: CAREERS_PAGE_URL,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: email
      ? `Apply via the official CynLr careers page or by contacting ${email}.`
      : 'Apply via the official CynLr careers page.',
  }]
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'cynlr',
  timeoutMs: 15000,
})

export const createCynlrScraper = ({ fetchText = defaultFetchText } = {}) => ({
  async run({ fetchText: overrideFetchText } = {}) {
    const jobs = extractCynlrJobs(await (overrideFetchText || fetchText)(CAREERS_PAGE_URL))
    return jobs.map((job) => ({
      ...job,
      source: 'cynlr',
      link: job.applyUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createCynlrScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, 'cynlr')
}
