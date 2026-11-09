import {departmentObservations,collect,nativeFetch} from './native.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'samcosecuritieslimited'
export const COMPANY = 'SAMCO Securities Limited'
export const HOMEPAGE_URL = 'https://www.samco.in/'
export const CAREERS_URL = 'https://www.samco.in/careers'
export const COMPANY_DOMAIN = 'samco.in'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HOMEPAGE_ERROR =
  'SAMCO verified official homepage no longer matches the trusted first-party surface'
const CAREERS_ERROR =
  'SAMCO verified first-party careers page no longer matches the trusted public surface'
const OPTIONS_ERROR = 'SAMCO verified public position options changed shape'

const defaultFetchText = nativeFetch

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/[–—−]+/g, '-')
  .replace(/\s*-\s*/g, ' - ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/['"]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Samco Stock Recommendations\s*&\s*Trading App\s*\|[\s\S]*?Brokerage\s*<\/title>/i.test(page)
    && /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/www\.samco\.in\/["']/i.test(page)
    && /"name"\s*:\s*"Samco Securities Limited"/i.test(page)
    && /href=["']https:\/\/www\.samco\.in\/careers["']/i.test(page)
    && /Open Demat Account/i.test(text)
    && /Scientific Recommendations/i.test(text)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Explore a career at Samco\s*\|\s*Opening Positions\s*&\s*Vacancies\s*<\/title>/i.test(page)
    && /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/www\.samco\.in\/careers["']/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.samco\.in\/careers["']/i.test(page)
    && /"name"\s*:\s*"SAMCO Securities Limited"|"name"\s*:\s*"Samco Securities Limited"/i.test(page)
    && /<form[^>]+id=["']careerForm["'][^>]*>/i.test(page)
    && /<select[^>]+id=["']dep_position["'][^>]*>/i.test(page)
    && /<select[^>]+id=["']depPosition["'][^>]+name=["']depPosition["'][^>]*>/i.test(page)
    && /<input[^>]+type=["']file["'][^>]+id=["']userfile["'][^>]+name=["']userfile["'][^>]*>/i.test(page)
    && /<button[^>]+id=["']careerSubmit["'][^>]*>\s*Submit\s*<\/button>/i.test(page)
    && /SAMCO Securities Limited/i.test(text)
    && /Registered Address:\s*SAMCO Securities Limited/i.test(text)
}

const extractPositionCards = (html) => {
  const cards = [...String(html ?? '').matchAll(
    /<a[^>]+data-value="(\d+)"[^>]+data-id="([^"]+)"[^>]+class="video-listing"[\s\S]*?<div class="v-text">\s*([\s\S]*?)\s*<\/div>[\s\S]*?<div class="apply-txt">\s*Apply now\s*<\/div>[\s\S]*?<\/a>/gi,
  )].map((match) => ({
    requisitionId: match[1],
    title: normalizeWhitespace(match[2]),
    visibleTitle: normalizeWhitespace(stripTags(match[3])),
  }))

  if (cards.length === 0 || new Set(cards.map((card) => card.requisitionId)).size !== cards.length) {
    throw new Error(OPTIONS_ERROR)
  }

  if (cards.some((card) => card.title !== card.visibleTitle)) {
    throw new Error(OPTIONS_ERROR)
  }

  return cards.map(({ requisitionId, title }) => ({ requisitionId, title }))
}

const extractPositionOptions = (html) => {
  const selectHtml = String(html ?? '').match(
    /<select[^>]+id=["']dep_position["'][^>]*>([\s\S]*?)<\/select>/i,
  )?.[1]

  if (!selectHtml) {
    throw new Error(OPTIONS_ERROR)
  }

  const options = [...selectHtml.matchAll(
    /<option[^>]+data-value="(\d+)"[^>]+data-id="([^"]+)"[^>]+value="(\d+)"[^>]*>\s*([\s\S]*?)\s*<\/option>/gi,
  )].map((match) => ({
    requisitionId: match[1],
    title: normalizeWhitespace(match[2]),
    value: match[3],
    label: normalizeWhitespace(stripTags(match[4])),
  }))

  if (
    options.length === 0
    || new Set(options.map((option) => option.requisitionId)).size !== options.length
    || options.some((option) => option.requisitionId !== option.value || option.title !== option.label)
  ) {
    throw new Error(OPTIONS_ERROR)
  }

  return options.map(({ requisitionId, title }) => ({ requisitionId, title }))
}

export const extractPublicJobs = departmentObservations

export const createSamcoSecuritiesLimitedScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run(options = {}) {
    return collect({...options,now:options.now||now,homepageVerifier:hasOfficialHomepageSignal})
  },
})

export const run = async (options = {}) => createSamcoSecuritiesLimitedScraper().run(options)

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
