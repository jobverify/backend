import {readListings,collect,nativeFetch} from './native.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'nitaragormalonellp'
export const COMPANY = 'NITARA Gormalone LLP'
export const HOMEPAGE_URL = 'https://gormalone.com/'
export const CAREERS_URL = 'https://gormalone.com/careers.html'
export const APPLY_EMAIL = 'hr@gormalone.com'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const CAREER_TRACKS = [
  'Early Careers',
  'Mid-Level Careers',
  'Experienced Professionals',
]

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/table|\/section)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|h[1-6]|ul|ol|table|section)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const normalizePageText = (html) => stripTags(String(html ?? '')) || ''

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const buildJobDescription = ({ title, department }) => normalizeWhitespace(
  `Official ${COMPANY} opening for ${title}${department ? ` in ${department}` : ''}. Review the first-party job description PDF and email ${APPLY_EMAIL} to apply.`,
)

const findNearestDepartment = (html, matchIndex) => {
  const window = String(html ?? '')
    .slice(Math.max(0, matchIndex - 800), matchIndex)
    .toLowerCase()

  let bestDepartment = null
  let bestIndex = -1

  for (const department of CAREER_TRACKS) {
    const index = window.lastIndexOf(department.toLowerCase())
    if (index > bestIndex) {
      bestDepartment = department
      bestIndex = index
    }
  }

  return bestDepartment
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const pageText = normalizePageText(page)

  return /<title>\s*Gormalone\s*\|\s*Precision Dairy Farming Technology for India\s*<\/title>/i.test(page)
    && /GormalOne LLP stands as an innovation-driven Agri-tech organization committed to revolutionizing the Dairy Industry through AI-led digital solutions/i.test(pageText)
    && /Nitara,\s*the flagship product which was established in 2020/i.test(pageText)
    && /href=["'](?:https?:\/\/gormalone\.com\/?)?\/?careers\.html["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const pageText = normalizePageText(page)
  const pdfLinkCount = (page.match(/href=["'][^"']*\/?files\/JD\/[^"']+\.pdf["']/gi) || []).length

  return /<title>\s*Careers at Gormalone\s*\|\s*Jobs in Dairy Tech\s*&(?:amp;)?\s*AgriTech India\s*<\/title>/i.test(page)
    && /Find your next job at GormalOne/i.test(pageText)
    && /Send Us Your Resume/i.test(pageText)
    && /hr@gormalone\.com/i.test(pageText)
    && pdfLinkCount >= 1
}

export const extractPublicListings = readListings

const defaultFetchText = nativeFetch

export const createNitaraGormaloneLlpScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run(options={}) { return collect({...options,now:options.now||now,homepageVerifier:hasOfficialHomepageSignal}) },
})

export const run = async (options = {}) => createNitaraGormaloneLlpScraper().run(options)

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
