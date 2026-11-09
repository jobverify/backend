import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'kanodaenergysystemspvtltd'
export const COMPANY = 'Kanoda Energy Systems Pvt. Ltd.'
export const HOMEPAGE_URL = 'https://www.kanoda.com/'
export const CAREERS_URL = 'https://www.kanoda.com/careers.html'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const KNOWN_JOB_TITLES = [
  'Admin Executive | Immediate Joiner | Ahmedabad',
  'Senior Electrical Design Engineer',
  'Data Operator',
  'Junior Design Engineer (Solar Design)',
]

const FIELD_LABELS = [
  'Designation',
  'Company',
  'Department',
  'Reporting to',
  'Location',
  'Pay-scale/ CTC',
  'Key responsibilities',
  'Key accountabilities/ deliverables',
  '1. Key accountabilities/ deliverables',
  'Mandatory requirements skills',
  '2. Mandatory requirements skills',
  'Educational qualification',
  'Minimum relevant experience',
  'Industry to be hired from',
  'Technical skills required',
  'Behavioural skills required',
  'Contact',
]

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&ndash;|&#8211;|&mdash;|&#8212;/gi, '-')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => String(value ?? '')
  .replace(/<(br|\/p|\/div|\/li|\/ul|\/ol|\/section|\/article|\/main|\/form|\/h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<(p|div|li|ul|ol|section|article|main|form|h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')

const toLines = (html) => stripTags(html)
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const isFieldLabel = (line) => {
  const normalized = normalizeWhitespace(line)?.toLowerCase()
  return normalized
    ? FIELD_LABELS.some((label) => normalized.startsWith(label.toLowerCase()))
    : false
}

const isJobTitleLine = (line, nextLine) => KNOWN_JOB_TITLES.includes(line) && /^Designation\b/i.test(nextLine || '')

const findFieldIndex = (lines, label) => lines.findIndex((line) => line.toLowerCase().startsWith(label.toLowerCase()))

const readScalarField = (lines, label) => {
  const index = findFieldIndex(lines, label)

  if (index === -1) return null

  const inlineMatch = lines[index].match(/^[^:]+:\s*(.+)$/)

  if (inlineMatch?.[1]) {
    return normalizeWhitespace(inlineMatch[1])
  }

  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor]

    if (line === ':') continue
    if (isFieldLabel(line)) break

    return line
  }

  return null
}

const readBulletSection = (lines, label) => {
  const index = findFieldIndex(lines, label)

  if (index === -1) return []

  const values = []

  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor]

    if (line === ':') continue
    if (isFieldLabel(line)) break
    values.push(line.replace(/^[*-]\s*/, ''))
  }

  return values.filter(Boolean)
}

const readTrailingSection = (lines, label) => {
  const index = findFieldIndex(lines, label)

  if (index === -1) return []

  const values = []

  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor]

    if (isFieldLabel(line)) break
    if (KNOWN_JOB_TITLES.includes(line)) break
    if (line === 'Job Openings' || line === 'Apply Now') break
    values.push(line.replace(/^[*-]\s*/, ''))
  }

  return values.filter(Boolean)
}

const normalizeLocation = (value) => {
  const location = normalizeWhitespace(value)

  if (!location) {
    return {
      location: 'India',
      city: null,
    }
  }

  const city = location.split(',')[0]?.trim() || null
  const state = city === 'Ahmedabad' ? 'Gujarat' : null

  return {
    location: state ? `${city}, ${state}, India` : `${location}, India`,
    city,
  }
}

const extractJobSections = (html) => {
  const lines = toLines(html)
  const sections = []

  for (let index = 0; index < lines.length; index += 1) {
    if (!isJobTitleLine(lines[index], lines[index + 1])) continue

    const start = index
    let end = lines.length

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      if (isJobTitleLine(lines[cursor], lines[cursor + 1])) {
        end = cursor
        break
      }

      if (lines[cursor] === 'Job Openings' && KNOWN_JOB_TITLES.includes(lines[cursor + 1])) {
        end = cursor
        break
      }
    }

    sections.push(lines.slice(start, end))
    index = end - 1
  }

  return sections
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(stripTags(page)) || ''

  return /Kanoda Energy Systems Pvt\. Ltd\./i.test(text)
    && /Mainstreaming Renewables\./i.test(text)
    && /technology and innovation-driven renewable energy enterprise/i.test(text)
    && /Work With Us/i.test(text)
    && /careers@kanoda\.com/i.test(text)
    && /href=["'](?:https?:\/\/www\.kanoda\.com\/)?careers\.html["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const text = normalizeWhitespace(stripTags(html)) || ''

  return /Careers?\s*\|\s*Kanoda Energy Systems Pvt\. Ltd\./i.test(text)
    && /Job Openings/i.test(text)
    && /Kanoda Energy Systems Pvt\. Ltd\. \(KESPL\)/i.test(text)
    && /Apply Now/i.test(text)
    && /Senior Electrical Design Engineer/i.test(text)
    && /Junior Design Engineer \(Solar Design\)/i.test(text)
}

export const extractJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Kanoda Energy Systems verified careers page no longer matches the known public jobs surface')
  }

  const jobs = extractJobSections(html).map((sectionLines) => {
    const title = sectionLines[0]
    const department = readScalarField(sectionLines, 'Department')
    const qualification = readScalarField(sectionLines, 'Educational qualification')
    const experience = readScalarField(sectionLines, 'Minimum relevant experience')
    const technicalSkills = readBulletSection(sectionLines, 'Technical skills required')
    const responsibilities = readBulletSection(sectionLines, 'Key responsibilities')
    const deliverables = readBulletSection(sectionLines, 'Key accountabilities/ deliverables')
    const trailingDescription = readTrailingSection(sectionLines, 'Minimum relevant experience')
    const { location, city } = normalizeLocation(readScalarField(sectionLines, 'Location'))
    const locationSlug = slugify(city || location)
    const jobId = `${SOURCE}-${slugify(`${title}-${locationSlug}`)}`
    const jobDescriptionSource = responsibilities.length > 0
      ? responsibilities
      : (deliverables.length > 0 ? deliverables : trailingDescription)

    if (!title || !location || !jobId) {
      throw new Error('Kanoda Energy Systems public job listings changed shape')
    }

    return {
      title,
      company: COMPANY,
      department: department || null,
      location,
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: null,
      experienceRequired: experience || null,
      minimumQualification: qualification || null,
      preferredQualification: null,
      requiredSkills: technicalSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: normalizeWhitespace(jobDescriptionSource.join(' ')),
    }
  })

  if (jobs.length < KNOWN_JOB_TITLES.length) {
    throw new Error('Kanoda Energy Systems public job listings no longer match the verified first-party page')
  }

  return jobs.sort((left, right) => left.title.localeCompare(right.title))
}

export const createKanodaEnergySystemsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)

    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Kanoda Energy Systems verified homepage no longer matches the known careers handoff')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = extractJobs(careersHtml)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
      companyCareerPage: CAREERS_URL,
      companyDomain: 'kanoda.com',
      atsPlatform: 'official-company-careers',
    }))
  },
})

export const run = async (options = {}) => createKanodaEnergySystemsScraper().run(options)

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
