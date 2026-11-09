import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runAccelerationRoboticsCurrentRead } from './currentRead.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'accelerationrobotics'
export const COMPANY = 'Acceleration Robotics'
export const CAREERS_URL = 'https://recruit.accelerationrobotics.in/'
export const VERIFIED_ON = '2026-08-15'
export const VERIFIED_SURFACE_SUMMARY =
  'Historical verification on August 15, 2026 reported 12 roles at https://recruit.accelerationrobotics.in/ and a runtime UND_ERR_CONNECT_TIMEOUT. Those historical observations establish no current count or geography. Current root and literal role-detail reads reject unavailable or denied responses; company, native and India inventory completeness remains unknown.'
const JOBS_URL = 'https://recruit.accelerationrobotics.in/jobs/'
const UNAVAILABLE_ERROR_PATTERN =
  /fetch failed|timed out|timeout|connect timeout|und_err_connect_timeout|could not connect|econnreset|unable to|getaddrinfo|enotfound|http (?:403|429|5\d\d)\b|cloudflare|site currently unavailable|just a moment/i

const normalizeWhitespace = (value) => {
  if (value == null) return null
  const normalized = String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const absoluteUrl = (value) => {
  if (!value) return null
  return new URL(value, CAREERS_URL).href
}

const getField = (html, className) => stripTags(
  html.match(new RegExp(`<[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/`, 'i'))?.[1],
)

const getPostedDate = (html) => normalizeWhitespace(
  html.match(/<time[^>]*datetime=["']([^"']+)["']/i)?.[1]
    || html.match(/Posted\s+(\d{4}-\d{2}-\d{2})/i)?.[1],
)

export const hasConnectTimeoutFailure = (error) => {
  const message = String(error?.message ?? error ?? '')
  const causeCode = String(error?.cause?.code ?? error?.code ?? '')
  const causeMessage = String(error?.cause?.message ?? '')

  return UNAVAILABLE_ERROR_PATTERN.test(message)
    || UNAVAILABLE_ERROR_PATTERN.test(causeCode)
    || UNAVAILABLE_ERROR_PATTERN.test(causeMessage)
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized.includes('intern')) return 'Internship'
  if (normalized.includes('full')) return 'Full-time'
  if (normalized.includes('part')) return 'Part-time'
  if (normalized.includes('contract')) return 'Contract'
  return normalizeWhitespace(value)
}

const normalizeExperience = (value) => normalizeWhitespace(value)
  ?.replace(/\byrs?\b/gi, 'years')

const parseCard = (match) => {
  const [, href, cardHtml] = match
  const title = stripTags(cardHtml.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1])
  const sourceUrl = absoluteUrl(href)
  const jobId = sourceUrl?.match(/\/jobs\/([^/?#]+)/i)?.[1]
  const location = getField(cardHtml, 'location') || 'Pune'
  const department = getField(cardHtml, 'category')
  const employmentType = normalizeEmploymentType(getField(cardHtml, 'employment-type'))
  const experienceRequired = normalizeExperience(getField(cardHtml, 'experience'))

  if (!title || !sourceUrl || !jobId) return null

  return {
    title,
    location,
    city: location.split(',')[0].trim(),
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: null,
    department,
    employmentType,
    experienceRequired,
    postingDate: getPostedDate(cardHtml),
  }
}

export const extractJobListings = (html) => [...String(html ?? '').matchAll(
  /<a[^>]+href=["']([^"']*\/jobs\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
)].map(parseCard).filter(Boolean)

export const extractJobDetail = (html) => {
  const normalized = String(html ?? '')
  const about = normalized.match(/<h[1-6][^>]*>\s*About the Role\s*<\/h[1-6]>([\s\S]*?)(?=<h[1-6][^>]*>|$)/i)?.[1]
  const applyUrl = absoluteUrl(normalized.match(/<a[^>]+href=["']([^"']*\/apply)["'][^>]*>\s*Apply(?: Now)?/i)?.[1])
  const location = getField(normalized, 'location') || 'Pune'
  const metadata = stripTags(normalized.match(/class=["'][^"']*job-meta[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]) || ''

  return {
    location,
    city: location.split(',')[0].trim(),
    country: 'India',
    employmentType: normalizeEmploymentType(metadata.match(/(Full Time|Part Time|Internship|Contract)/i)?.[1]),
    postingDate: getPostedDate(normalized),
    jobDescription: stripTags(about),
    applyUrl,
  }
}

export const hasOfficialCareersSignal = (html) => {
  const text = stripTags(html) || ''

  return /Careers at Acceleration Robotics/i.test(text)
    && /Build the future of robotics with us/i.test(text)
    && /\bOpen Roles\b/i.test(text)
}

export const createAccelerationRoboticsScraper = (options = {}) => ({
  run: (runOptions = {}) => runAccelerationRoboticsCurrentRead({ ...options, ...runOptions }),
})

export const run = async (options = {}) => createAccelerationRoboticsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
