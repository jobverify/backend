import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import provider from './provider.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = provider
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8,text/javascript,application/javascript',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const hasCareersShellSignal = (html = '') => {
  const page = String(html ?? '')
  return /Shivaami - Enterprise IT Solutions/i.test(page)
    && /id=["']root["']/i.test(page)
    && /assets\/index-[^"']+\.js/i.test(page)
}

export const extractMainBundleUrl = (html = '') => {
  const relativePath = String(html ?? '').match(/<script[^>]*src=["']([^"']*assets\/index-[^"']+\.js)["']/i)?.[1]
  if (!relativePath) return null

  try {
    return new URL(relativePath, CAREERS_URL).toString()
  } catch {
    return null
  }
}

export const extractCareersChunkUrl = (mainBundleText = '') => {
  const relativePath = String(mainBundleText ?? '').match(/assets\/Careers-[A-Za-z0-9_-]+\.js/)?.[0]
  if (!relativePath) return null

  try {
    return new URL(relativePath, provider.homepageUrl).toString()
  } catch {
    return null
  }
}

export const extractOpeningsFromCareersBundle = (bundleText = '') => [...String(bundleText ?? '').matchAll(
  /title:\s*"([^"]+)"\s*,\s*experience:\s*"([^"]+)"\s*,\s*description:\s*"([^"]+)"/g,
)].map((match) => ({
  title: match[1],
  experience: match[2],
  description: match[3],
}))

const extractLocation = (bundleText = '') =>
  String(bundleText ?? '').match(/"([A-Za-z ]+, India)"/)?.[1] || 'Mumbai, India'

export const run = async ({
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
} = {}) => {
  const shellHtml = await fetchText(CAREERS_URL)
  if (!hasCareersShellSignal(shellHtml)) {
    throw new Error('Shivaami careers shell no longer matches the verified first-party SPA surface')
  }

  const mainBundleUrl = extractMainBundleUrl(shellHtml)
  if (!mainBundleUrl) {
    throw new Error('Shivaami careers route no longer exposes the verified main bundle path')
  }

  const mainBundleText = await fetchText(mainBundleUrl)
  const careersChunkUrl = extractCareersChunkUrl(mainBundleText)
  if (!careersChunkUrl) {
    throw new Error('Shivaami main bundle no longer references the verified careers chunk')
  }

  const careersBundleText = await fetchText(careersChunkUrl)
  if (!/Current Openings/i.test(careersBundleText) || !/STORE_CAREER_DETAILS/i.test(careersBundleText)) {
    throw new Error('Shivaami careers chunk no longer matches the verified openings and application flow')
  }

  const location = extractLocation(careersBundleText)
  const city = location.split(',')[0].trim()
  const jobs = extractOpeningsFromCareersBundle(careersBundleText).map((job) => ({
    title: job.title,
    company: COMPANY,
    department: null,
    location,
    city,
    country: 'India',
    jobId: slugify(job.title),
    requisitionId: slugify(job.title),
    sourceUrl: CAREERS_URL,
    applyUrl: CAREERS_URL,
    employmentType: null,
    experienceRequired: job.experience,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: job.description,
  }))

  return jobs.map((job) => ({
    ...job,
    source: SOURCE,
    link: job.applyUrl,
    scrapedAt: now(),
  }))
}

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
