import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'systecherp'
export const COMPANY = 'Systech ERP'
export const HOMEPAGE_URL = 'https://www.systecherp.com/'
export const CAREERS_PAGE_URL = 'https://www.systecherp.com/company/careers'
export const JOBS_EMAIL = 'joinus@systecherp.com'

const USER_AGENT = 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)'
const EMPLOYMENT_TYPE_PATTERN = /(Full-time|Part-time|Contract|Internship|Temporary|Freelance)$/i

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#8211;|&#x2013;/gi, '–')
  .replace(/&#8212;|&#x2014;/gi, '—')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeNumericRanges = (value) => normalizeWhitespace(value)?.replace(/(\d)\s*[–—]\s*(\d)/g, '$1-$2') || null

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[–—]/g, '-')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const htmlToLines = (html) => decodeHtml(String(html ?? ''))
  .replace(/\r/g, '')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol|\/section|\/article|\/main|\/footer)\b[^>]*>/gi, '\n')
  .replace(/<(p|div|li|h[1-6]|ul|ol|section|article|main|footer)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/[ \t\f\v]+/g, ' ')
  .replace(/\n+/g, '\n')
  .split('\n')
  .map((line) => normalizeWhitespace(line))
  .filter(Boolean)

const buildJobDescription = (summary, requiredSkills) => {
  const cleanSummary = normalizeWhitespace(summary)
  if (!cleanSummary && requiredSkills.length === 0) return null
  if (requiredSkills.length === 0) return cleanSummary

  return `${cleanSummary}\n\nRequirements:\n- ${requiredSkills.join('\n- ')}`
}

const formatLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null
  return /\bindia\b/i.test(normalized) ? normalized : `${normalized}, India`
}

const getCity = (value) => normalizeWhitespace(value)
  ?.split('/')[0]
  .split(',')[0]
  .trim() || null

const getRemoteStatus = (value) => {
  const normalized = normalizeWhitespace(value) || ''
  if (/remote/i.test(normalized)) return 'Remote'
  if (/hybrid/i.test(normalized)) return 'Hybrid'
  return 'On-site'
}

const getTitle = (html) => normalizeWhitespace(String(html ?? '').match(/<title>([\s\S]*?)<\/title>/i)?.[1])

const includesAll = (haystack, needles) => needles.every((needle) => haystack.includes(needle))

export const isOfficialHomepage = (html) => {
  const title = getTitle(html)
  const visibleText = htmlToLines(html).join(' ')
  const page = String(html ?? '')

  return title === 'AI-Driven ERP, CRM & HRMS Software India — Systech'
    && includesAll(visibleText, [
      'Complete ERP Solutions for Every Industry',
      'Why Choose Systech ERP Solutions?',
      'Enterprise software from India, built for the world.',
      'info@systecherp.com',
    ])
    && /href=["'][^"']*\/company\/careers["']/i.test(page)
}

export const isOfficialCareersPage = (html) => {
  const title = getTitle(html)
  const visibleText = htmlToLines(html).join(' ')

  return title === 'Careers at Systech — ERP Developer & Consulting Jobs in Coimbatore'
    && includesAll(visibleText, [
      "We're Hiring",
      'Build Software That Runs Real Businesses',
      'Open Positions',
      'Find a role that fits your skills and ambitions',
      "Don't See Your Role?",
      JOBS_EMAIL,
    ])
}

const extractQualificationParts = (requiredSkills) => {
  const qualificationLine = requiredSkills.find((line) =>
    /\bdegree\b|B\.Com|M\.Com|MBA|BBA|BCA|MCA/i.test(line || ''),
  )

  if (!qualificationLine) {
    return {
      minimumQualification: null,
      preferredQualification: null,
    }
  }

  const [beforeSemicolon] = qualificationLine.split(/\s*;\s*/)
  const [head, tail] = beforeSemicolon.split(/\s+[—-]\s+/)
  const parenMatch = head?.match(/^(.+?)\s*\((.+)\)$/)

  if (parenMatch) {
    return {
      minimumQualification: normalizeWhitespace(parenMatch[1]),
      preferredQualification: normalizeWhitespace(parenMatch[2]),
    }
  }

  return {
    minimumQualification: normalizeWhitespace(head),
    preferredQualification: tail
      ? normalizeWhitespace(tail)?.replace(/^[a-z]/, (char) => char.toUpperCase()) || null
      : null,
  }
}

const extractExperienceRequired = (requiredSkills) => {
  const matchingLine = requiredSkills.find((line) => /\bfreshers?\b|\byears?\b/i.test(line || ''))
  if (!matchingLine) return null

  const normalizedLine = normalizeNumericRanges(matchingLine)
  const qualificationAndExperienceLine = /\bdegree\b|B\.Com|M\.Com|MBA|BBA|BCA|MCA/i.test(matchingLine || '')

  if (qualificationAndExperienceLine && /;/.test(matchingLine)) {
    const trailingSegment = matchingLine.split(/\s*;\s*/).at(-1)
    return normalizeNumericRanges(trailingSegment)?.replace(/^[a-z]/, (char) => char.toUpperCase()) || null
  }

  return normalizedLine?.replace(/^[a-z]/, (char) => char.toUpperCase()) || null
}

const parseMetadataLine = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    throw new Error('Systech ERP official careers page no longer exposes the expected role metadata')
  }

  const match = normalized.match(/^(.*)\s+(Full-time|Part-time|Contract|Internship|Temporary|Freelance)$/i)
  if (!match) {
    throw new Error('Systech ERP official careers page no longer exposes the expected role metadata')
  }

  return {
    location: normalizeWhitespace(match[1]),
    employmentType: normalizeWhitespace(match[2]),
  }
}

const getOpenPositionsLines = (html) => {
  const lines = htmlToLines(html)
  const startIndex = lines.indexOf('Open Positions')
  const endIndex = lines.indexOf("Don't See Your Role?")

  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new Error('Systech ERP official careers page no longer matches the verified page structure')
  }

  return lines.slice(startIndex + 2, endIndex)
}

export const extractCareerJobs = (html) => {
  if (!isOfficialCareersPage(html)) {
    throw new Error('Systech ERP official careers page no longer matches the verified public page')
  }

  const lines = getOpenPositionsLines(html)
  const jobs = []

  for (let index = 0; index < lines.length; index += 1) {
    const title = lines[index]
    const department = lines[index + 1]
    const metadataLine = lines[index + 2]
    const summary = lines[index + 3]

    if (
      !title
      || !department
      || !summary
      || !EMPLOYMENT_TYPE_PATTERN.test(metadataLine || '')
    ) {
      continue
    }

    const requiredSkills = []
    let cursor = index + 4

    while (cursor < lines.length && lines[cursor] !== 'Apply Now') {
      requiredSkills.push(normalizeNumericRanges(lines[cursor]))
      cursor += 1
    }

    if (lines[cursor] !== 'Apply Now' || lines[cursor + 1] !== JOBS_EMAIL) {
      throw new Error('Systech ERP official careers page no longer matches the verified public page')
    }

    const slug = slugify(title)
    const { location, employmentType } = parseMetadataLine(metadataLine)
    const { minimumQualification, preferredQualification } = extractQualificationParts(requiredSkills)
    const applyUrl = `mailto:${JOBS_EMAIL}`

    jobs.push({
      title: normalizeWhitespace(title),
      company: COMPANY,
      department: normalizeWhitespace(department),
      location: formatLocation(location),
      city: getCity(location),
      country: 'India',
      jobId: slug,
      requisitionId: slug,
      sourceUrl: `${CAREERS_PAGE_URL}#${slug}`,
      applyUrl,
      employmentType,
      experienceRequired: extractExperienceRequired(requiredSkills),
      minimumQualification,
      preferredQualification,
      requiredSkills,
      postingDate: null,
      closingDate: null,
      jobDescription: buildJobDescription(summary, requiredSkills),
      remoteStatus: getRemoteStatus(location),
    })

    index = cursor + 1
  }

  if (jobs.length === 0) {
    throw new Error('Systech ERP official careers page no longer exposes the expected public openings')
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createSystechErpScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!isOfficialHomepage(homepageHtml)) {
      throw new Error('Systech ERP official homepage no longer matches the verified public page')
    }

    const careersHtml = await fetchText(CAREERS_PAGE_URL)
    const jobs = extractCareerJobs(careersHtml)

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createSystechErpScraper().run(options)

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
