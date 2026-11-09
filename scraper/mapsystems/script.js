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

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/â/g, "'")

const normalizeLine = (value) => decodeHtml(value).replace(/\s+/g, ' ').trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const slugify = (value) => normalizeLine(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const htmlToMultilineText = (html = '') => decodeHtml(String(html ?? ''))
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>/gi, '\n')
  .replace(/<\/div>/gi, '\n')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .split('\n')
  .map((line) => normalizeLine(line))
  .filter(Boolean)
  .join('\n')

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const text = htmlToMultilineText(page)
  return /Job Opening in MAPSystems/i.test(page)
    && /career-page/i.test(page)
    && /career@mapsystems\.in/i.test(text)
}

export const extractJobSections = (html = '') => {
  const boxes = String(html ?? '').match(/<div class=["']job-box["'][^>]*>[\s\S]*?<\/div>/gi) || []
  const sections = []

  for (const box of boxes) {
    const text = htmlToMultilineText(box)
    const splitSections = text.split(/(?=\d+\)\s)/g).map((section) => section.trim()).filter(Boolean)
    sections.push(...splitSections)
  }

  return sections
}

const extractTitle = (section) => section.match(/^\d+\)\s*([^\n]+)/)?.[1]?.trim() || null

const extractField = (section, label, stops) => {
  const pattern = new RegExp(`${label}\\s*:?\\s*([\\s\\S]*?)(?:${stops.join('|')})`, 'i')
  return normalizeLine(section.match(pattern)?.[1] || '')
}

const extractDescription = (section) => {
  const pattern = /(Job Description|Job Summary)\s*([\s\S]*?)(?:Roles and responsibilities|Roles & Responsibilities|Requirements|Required qualifications|Skills|Interested applicants|Email:|$)/i
  return normalizeLine(section.match(pattern)?.[2] || '')
}

const inferLocation = (section) => {
  if (/office in Bangalore/i.test(section)) {
    return { location: 'Bangalore, India', city: 'Bangalore', country: 'India' }
  }

  return { location: 'India', city: null, country: 'India' }
}

const mapJobSection = (section) => {
  const title = extractTitle(section)
  const email = section.match(/[A-Za-z0-9._%+-]+@mapsystems\.in/i)?.[0]?.toLowerCase() || null
  if (!title || !email) return null

  const department = normalizeLine(section.match(/Department\s*:?\s*([^|\n]+)/i)?.[1] || '') || null
  const experienceRequired = extractField(
    section,
    'Experience',
    ['Education', 'Job Description', 'Job Summary', 'Roles and responsibilities', 'Roles & Responsibilities', 'Requirements', 'Skills', 'Interested applicants', 'Email:', '$'],
  ) || null
  const minimumQualification = extractField(
    section,
    'Education',
    ['Job Description', 'Job Summary', 'Roles and responsibilities', 'Roles & Responsibilities', 'Requirements', 'Skills', 'Interested applicants', 'Email:', '$'],
  ) || null
  const description = extractDescription(section) || null
  const { location, city, country } = inferLocation(section)

  return {
    title,
    company: COMPANY,
    department,
    location,
    city,
    country,
    jobId: slugify(title),
    requisitionId: slugify(title),
    sourceUrl: CAREERS_URL,
    applyUrl: `mailto:${email}`,
    employmentType: null,
    experienceRequired,
    minimumQualification,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: description,
  }
}

export const run = async ({
  fetchText = defaultFetchText,
  now = () => new Date().toISOString(),
} = {}) => {
  const careersHtml = await fetchText(CAREERS_URL)
  if (!hasOfficialCareersSignal(careersHtml)) {
    throw new Error('MAP Systems careers page no longer matches the verified first-party static surface')
  }

  const jobs = extractJobSections(careersHtml)
    .map((section) => mapJobSection(section))
    .filter(Boolean)

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
