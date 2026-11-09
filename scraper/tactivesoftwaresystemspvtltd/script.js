import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'tactivesoftwaresystemspvtltd'
export const COMPANY = 'Tactive Software Systems Pvt. Ltd.'
export const CAREERS_URL = 'https://www.tactivesoft.com/careers/'
export const APPLY_URL = `${CAREERS_URL}#jobApplyForm`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_TITLE_PATTERN = /<title>\s*Careers\s*-\s*Join Our Team at Tactive Construction ERP Software\s*<\/title>/i
const OFFICIAL_BRAND_PATTERN = /Tactive Software Systems\s+(?:Private Limited|Pvt\.?\s*Ltd\.?)/i
const CURRENT_OPENINGS_PATTERN = /Current(?:\s*<span[^>]*>\s*)?\s*Openings/i
const APPLY_FORM_PATTERN = /id=["']jobApplyForm["']/i
const ACCORDION_BLOCK_PATTERN = /<details\b[^>]*class=["'][^"']*\be-n-accordion-item\b[^"']*["'][^>]*>[\s\S]*?<\/details>/gi
const TITLE_PATTERN = /<div class=["'][^"']*\be-n-accordion-item-title-text\b[^"']*["']>\s*([^<]+?)\s*<\/div>/i
const APPLY_LINK_PATTERN = /href=["']#jobApplyForm["']/i
const DEPARTMENT_FIELD_PATTERN = /^Department\s*:\s*(.*)$/i
const LOCATION_FIELD_PATTERN = /^Location\s*:\s*(.*)$/i
const EXPERIENCE_REQUIRED_FIELD_PATTERN = /^Experience Required\s*:\s*(.*)$/i
const QUALIFICATION_FIELD_PATTERN = /^Experience\s*&\s*Qualification\s*:\s*(.*)$/i
const QUALIFICATION_ONLY_FIELD_PATTERN = /^Qualification\s*:\s*(.*)$/i
const SKILLS_HEADING_PATTERN = /^Skills(?: Required)?\s*:\s*(.*)$/i
const JOB_DESCRIPTION_HEADING_PATTERN = /^JOB Description\s*:\s*(.*)$/i
const GENERIC_HEADING_PATTERN = /^(?:Position|Department|Location|No\.?\s*Of Openings|Experience Required|Experience\s*&\s*Qualification|Qualification|Skills(?: Required)?|JOB Description|Apply)\b/i

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/\r/g, '')
    .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6]|\/a|\/span|\/strong)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|ul|ol|section|article|main|h[1-6]|a|span|strong)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const toLines = (value) => decodeHtml(String(value ?? ''))
  .replace(/\r/g, '')
  .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/h[1-6]|\/a|\/span|\/strong)\b[^>]*>/gi, '\n')
  .replace(/<(p|div|li|ul|ol|section|article|main|h[1-6]|a|span|strong)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const normalizeLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return 'India'

  const withoutCountry = normalized
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*,?\s*India\s*$/i, '')

  return withoutCountry ? `${withoutCountry}, India` : 'India'
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)?.replace(/\s*,?\s*India\s*$/i, '')
  if (!normalized || /[\/|]/.test(normalized) || normalized.includes(',')) return null

  return normalizeCity(normalized)
}

const matchField = (lines, pattern) => {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const match = pattern.exec(line)
    if (!match) continue

    const inlineValue = normalizeWhitespace(match[1])
    if (inlineValue) return inlineValue

    const nextLine = normalizeWhitespace(lines[index + 1])
    if (nextLine && !GENERIC_HEADING_PATTERN.test(nextLine)) {
      return nextLine
    }
  }

  return null
}

const collectSectionLines = (lines, startPattern, stopPatterns = []) => {
  const collected = []
  let inSection = false

  for (const line of lines) {
    if (!inSection) {
      const match = startPattern.exec(line)
      if (!match) continue

      inSection = true
      if (normalizeWhitespace(match[1])) {
        collected.push(normalizeWhitespace(match[1]))
      }
      continue
    }

    if (stopPatterns.some((pattern) => pattern.test(line)) || GENERIC_HEADING_PATTERN.test(line)) {
      break
    }

    collected.push(line)
  }

  return collected.map((line) => normalizeWhitespace(line)).filter(Boolean)
}

const extractExperienceRequired = (explicitExperience, qualificationText) => {
  const formatExperience = (value) => normalizeWhitespace(value)
    ?.replace(/\s*-\s*/g, '-')
    ?.replace(/(\d+\+|\d+-\d+)\s*(years?)\b/i, (_, range, years) => `${range} ${years}`)
    ?? null

  const direct = formatExperience(explicitExperience)
  if (direct) return direct

  const qualification = normalizeWhitespace(qualificationText)
  if (!qualification) return null

  const match = qualification.match(/(\d+\s*-\s*\d+|\d+\+)\s*years?\b/i)
  return match ? formatExperience(match[0]) : null
}

const deriveDepartment = (title, explicitDepartment) => {
  if (explicitDepartment) return explicitDepartment
  if (/\bquality\b/i.test(title)) return 'Quality Assurance'
  if (/\bdelivery\b/i.test(title)) return 'Delivery'
  if (/\b(sql|database|developer|development|\.net)\b/i.test(title)) return 'Development'
  return null
}

const buildJobDescription = ({ qualificationText, skillLines, jobDescriptionLines, fallbackLines }) => {
  const sections = []

  if (qualificationText) {
    sections.push(`Experience & Qualification: ${qualificationText}`)
  }

  if (skillLines.length > 0) {
    sections.push(`Skills: ${skillLines.join(' ')}`)
  }

  if (jobDescriptionLines.length > 0) {
    sections.push(`Job Description: ${jobDescriptionLines.join(' ')}`)
  }

  if (sections.length > 0) {
    return normalizeWhitespace(sections.join(' '))
  }

  return normalizeWhitespace(fallbackLines.join(' '))
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return OFFICIAL_TITLE_PATTERN.test(page)
    && OFFICIAL_BRAND_PATTERN.test(page)
    && CURRENT_OPENINGS_PATTERN.test(page)
    && APPLY_FORM_PATTERN.test(page)
}

export const extractOpenings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Tactive careers page no longer matches the verified official public jobs surface')
  }

  const jobs = []
  const seenJobIds = new Set()

  for (const blockMatch of String(html ?? '').matchAll(ACCORDION_BLOCK_PATTERN)) {
    const block = blockMatch[0]
    if (!APPLY_LINK_PATTERN.test(block)) continue

    const title = normalizeWhitespace(block.match(TITLE_PATTERN)?.[1])
    if (!title) continue

    const lines = toLines(block)
    const explicitDepartment = matchField(lines, DEPARTMENT_FIELD_PATTERN)
    const location = normalizeLocation(matchField(lines, LOCATION_FIELD_PATTERN))
    const qualificationText = matchField(lines, QUALIFICATION_FIELD_PATTERN)
      || matchField(lines, QUALIFICATION_ONLY_FIELD_PATTERN)
    const experienceRequired = extractExperienceRequired(
      matchField(lines, EXPERIENCE_REQUIRED_FIELD_PATTERN),
      qualificationText,
    )
    const skillLines = collectSectionLines(lines, SKILLS_HEADING_PATTERN, [JOB_DESCRIPTION_HEADING_PATTERN])
    const jobDescriptionLines = collectSectionLines(lines, JOB_DESCRIPTION_HEADING_PATTERN)
    const department = deriveDepartment(title, explicitDepartment)
    const city = deriveCity(location)
    const identitySlug = slugify(`${title}-${location}`)

    if (!identitySlug || seenJobIds.has(identitySlug)) continue
    seenJobIds.add(identitySlug)

    jobs.push({
      title,
      company: COMPANY,
      department,
      location,
      city,
      country: 'India',
      jobId: `${SOURCE}-${identitySlug}`,
      requisitionId: `${SOURCE}-${identitySlug}`,
      sourceUrl: CAREERS_URL,
      applyUrl: APPLY_URL,
      employmentType: null,
      experienceRequired,
      minimumQualification: qualificationText,
      preferredQualification: null,
      requiredSkills: skillLines,
      postingDate: null,
      closingDate: null,
      jobDescription: buildJobDescription({
        qualificationText,
        skillLines,
        jobDescriptionLines,
        fallbackLines: lines.filter((line) => !GENERIC_HEADING_PATTERN.test(line) && line !== title),
      }),
      remoteStatus: 'On-site',
    })
  }

  if (jobs.length === 0) {
    throw new Error('Tactive verified public openings changed or disappeared')
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createTactiveSoftwareSystemsPvtLtdScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const html = await fetchText(CAREERS_URL)
    const jobs = extractOpenings(html)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createTactiveSoftwareSystemsPvtLtdScraper().run(options)

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
