import {runCurrentInnspark} from './currentNative20261117.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'innspark'
export const COMPANY = 'Innspark'
export const CAREERS_URL = 'https://innspark.in/careers/'
export const APPLY_URL = 'https://innspark.in/apply/'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/section|\/article|\/main)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|h[1-6]|ul|ol|section|article|main)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const stripExperienceSuffix = (value) => normalizeWhitespace(
  String(value ?? '').replace(/\s*\((?:\d+\s*-\s*\d+|\d+\+?)\s+years? of experience\)\s*$/i, ''),
)

const extractFieldValue = (lines, label) => {
  const matchingLine = lines.find((line) => new RegExp(`^${label}\\s*:`, 'i').test(line))
  if (!matchingLine) return null
  return normalizeWhitespace(matchingLine.replace(new RegExp(`^${label}\\s*:\\s*`, 'i'), ''))
}

const splitRoleHeading = (heading) => {
  const normalizedHeading = normalizeWhitespace(heading)
  if (!normalizedHeading) return []

  if (normalizedHeading.includes(' / ')) {
    const parts = []
    let current = ''
    let depth = 0

    for (let index = 0; index < normalizedHeading.length; index += 1) {
      const char = normalizedHeading[index]
      const nextChunk = normalizedHeading.slice(index, index + 3)

      if (char === '(') depth += 1
      if (char === ')' && depth > 0) depth -= 1

      if (depth === 0 && nextChunk === ' / ') {
        parts.push(current)
        current = ''
        index += 2
        continue
      }

      current += char
    }

    if (current) parts.push(current)

    if (parts.length > 1) {
      return parts
        .map((part) => stripExperienceSuffix(part))
        .filter(Boolean)
    }
  }

  return [stripExperienceSuffix(normalizedHeading)].filter(Boolean)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /Career\s*\|\s*Innspark/i.test(page)
    && normalized?.includes('Join the Team!')
    && normalized?.includes('Current Openings')
    && normalized?.includes('Apply here')
    && normalized?.includes('Innspark Solutions Private Limited')
}

export const hasOfficialApplySignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /Innspark Careers\s*\|\s*Apply/i.test(page)
    && normalized?.includes('Innspark Careers')
    && normalized?.includes('Desired Role or Function')
    && normalized?.includes('Embedded Systems Engineer (Drone / UAS development)')
}

export const extractApplyRoleOptions = (html) => {
  const options = []
  const seen = new Set()

  for (const match of String(html ?? '').matchAll(/<option[^>]*>([\s\S]*?)<\/option>/gi)) {
    const option = normalizeWhitespace(stripTags(match[1]))
    if (!option || seen.has(option)) continue
    seen.add(option)
    options.push(option)
  }

  return options
}

export const extractCareerJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Innspark verified official careers surface changed')
  }

  const sections = [...String(html ?? '').matchAll(/<h5[^>]*>([\s\S]*?)<\/h5>([\s\S]*?)(?=<h5[^>]*>|<h2[^>]*>\s*Apply here|<\/main>)/gi)]
  const jobs = []

  for (const [, rawHeading, rawBody] of sections) {
    const heading = stripTags(rawHeading)
    const bodyText = decodeHtml(rawBody)
      .replace(/\r/g, '')
      .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/section|\/article|\/main)\b[^>]*>/gi, '\n')
      .replace(/<(p|div|li|h[1-6]|ul|ol|section|article|main)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/\n+/g, '\n')

    const lines = bodyText
      .split('\n')
      .map((line) => normalizeWhitespace(line))
      .filter(Boolean)

    const locationValue = extractFieldValue(lines, 'Location')
    const employmentType = extractFieldValue(lines, 'Employment Type')
    const experienceRequired = extractFieldValue(lines, 'Experience Level')
      || normalizeWhitespace(lines.find((line) => /^Experience Level\s*:/i.test(line)))
      || normalizeWhitespace(lines.find((line) => /^Experience:\s*/i.test(line))?.replace(/^Experience:\s*/i, ''))
    const roleTitles = splitRoleHeading(heading)

    for (const roleTitle of roleTitles) {

      jobs.push({
        title: roleTitle,
        company: COMPANY,
        department: null,
        location: null,
        city: null,
        country: null,
        jobId: null,
        requisitionId: null,
        nativePublishedLocation: locationValue,
        nativePublishedDescription: lines.join(' '),
        sourceDetailComplete: false,
        sourceEmployerQualified: false,
        sourceUrl: CAREERS_URL,
        applyUrl: APPLY_URL,
        employmentType,
        experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
      })
    }
  }

  if (jobs.length === 0) {
    throw new Error('Innspark careers page no longer exposes the expected public openings')
  }

  return jobs
}

export const assertApplyFormMatchesJobs = (jobs, applyHtml) => {
  if (!hasOfficialApplySignal(applyHtml)) {
    throw new Error('Innspark verified first-party apply form changed')
  }

  const options = new Set(extractApplyRoleOptions(applyHtml))
  const missingTitles = jobs
    .map((job) => job.title)
    .filter((title) => !options.has(title))

  if (missingTitles.length > 0) {
    throw new Error(`Innspark first-party apply form no longer matches careers jobs: ${missingTitles.join(', ')}`)
  }
}

export const createInnsparkScraper = () => ({run:runCurrentInnspark})

export const run = async (options = {}) => createInnsparkScraper().run(options)

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
