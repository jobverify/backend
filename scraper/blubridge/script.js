import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'blubridge'
export const COMPANY = 'Blubridge Technologies Pvt Ltd'
export const CAREER_PAGE_URL = 'https://blubridge.com/careers'

const BLUBRIDGE_HOST = new URL(CAREER_PAGE_URL).hostname
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const SELECTORS = {
  listingJobRow: 'a.job-row',
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/javascript;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const normalizeWhitespace = (value) =>
  String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#8211;|&#8212;|\u2013|\u2014/gi, '-')
    .replace(/&bull;|\u2022|â€¢/gi, '*')
    .replace(/\s+/g, ' ')
    .trim()

const htmlToLines = (html) =>
  String(html ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h1|\/h2|\/h3|\/h4|\/section|\/article)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split('\n')
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

const escapeRegExp = (value) =>
  String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const slugToJobId = (url) => normalizeWhitespace(
  String(url ?? '')
    .replace(/\/+$/, '')
    .split('/')
    .pop(),
)

const getSafeBlubridgeUrl = (value) => {
  try {
    const url = new URL(value, CAREER_PAGE_URL)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    return url.hostname === BLUBRIDGE_HOST ? url.href.split('#')[0] : null
  } catch {
    return null
  }
}

const toTitleCase = (value) =>
  normalizeWhitespace(value)
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase())

const formatDepartment = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  if (normalized.includes('*')) {
    return normalized
      .split('*')
      .map((part) => toTitleCase(part))
      .filter(Boolean)
      .join(' / ')
  }

  if (/[a-z]/.test(normalized)) {
    return normalized
  }

  return toTitleCase(normalized)
}

const formatDepartmentParts = (...values) => {
  const parts = [...new Set(
    values
      .map((value) => formatDepartment(value))
      .filter(Boolean),
  )]

  return parts.length > 0 ? parts.join(' / ') : null
}

const findLineIndex = (lines, label) =>
  lines.findIndex((line) => line.toLowerCase() === String(label).toLowerCase())

const extractSection = (lines, startLabel, endLabels = []) => {
  const startIndex = findLineIndex(lines, startLabel)
  if (startIndex === -1) return []

  const normalizedEndLabels = endLabels.map((label) => String(label).toLowerCase())
  const values = []

  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (normalizedEndLabels.includes(line.toLowerCase())) break
    values.push(line)
  }

  return values
}

const extractTitleFromHtml = (html) => {
  const match = /<title>([\s\S]*?)<\/title>/i.exec(String(html ?? ''))
  return normalizeWhitespace(match?.[1]).replace(/\|\s*Careers[\s\S]*$/i, '').trim() || null
}

const extractHtmlBetweenLabels = (html, startLabel, endLabels = []) => {
  const source = String(html ?? '')
  const startPattern = new RegExp(`<[^>]+>\\s*${escapeRegExp(startLabel)}\\s*<\\/[^>]+>`, 'i')
  const startMatch = startPattern.exec(source)

  if (!startMatch) return null

  const startIndex = startMatch.index + startMatch[0].length
  let endIndex = source.length

  for (const endLabel of endLabels) {
    const endPattern = new RegExp(`<[^>]+>\\s*${escapeRegExp(endLabel)}\\s*<\\/[^>]+>`, 'i')
    const remainder = source.slice(startIndex)
    const endMatch = endPattern.exec(remainder)

    if (endMatch) {
      endIndex = Math.min(endIndex, startIndex + endMatch.index)
    }
  }

  return source.slice(startIndex, endIndex)
}

const buildBundleJobUrl = (slug) => `${CAREER_PAGE_URL}/job/${slug}`

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/remote/i.test(normalized)) return 'Remote'

  const withoutWorkMode = normalized.replace(/\s+(On-site|Hybrid|Remote)\b/gi, '').trim()
  const withoutParenthetical = normalizeWhitespace(withoutWorkMode.replace(/\([^)]*\)/g, ' '))
  const parts = withoutParenthetical
    .split(',')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  if (parts.length >= 3 && /^(india|in|us|usa)$/i.test(parts.at(-1))) {
    return parts[0]
  }

  if (parts.length === 2) {
    return parts[1]
  }

  if (parts.length > 2) {
    return parts[0]
  }

  return withoutParenthetical || normalized
}

const buildJobDescription = (sections) =>
  sections
    .filter((section) => section.value)
    .map((section) => `${section.label}: ${section.value}`)
    .join('\n') || null

const extractBalancedArrayLiteral = (source, startIndex) => {
  let depth = 0
  let inString = false
  let quote = ''
  let escaped = false

  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }

      if (character === '\\') {
        escaped = true
        continue
      }

      if (character === quote) {
        inString = false
        quote = ''
      }

      continue
    }

    if (character === '"' || character === "'") {
      inString = true
      quote = character
      continue
    }

    if (character === '[') {
      depth += 1
      continue
    }

    if (character === ']') {
      depth -= 1
      if (depth === 0) {
        return source.slice(startIndex, index + 1)
      }
    }
  }

  return null
}

const parseObjectArrayLiteral = (arrayLiteral) => {
  if (!arrayLiteral) return []

  let normalized = ''
  let inString = false
  let quote = ''
  let escaped = false

  for (let index = 0; index < arrayLiteral.length; index += 1) {
    const character = arrayLiteral[index]

    if (inString) {
      normalized += character

      if (escaped) {
        escaped = false
        continue
      }

      if (character === '\\') {
        escaped = true
        continue
      }

      if (character === quote) {
        inString = false
        quote = ''
      }

      continue
    }

    if (character === '"' || character === "'") {
      inString = true
      quote = character
      normalized += character
      continue
    }

    if (character === '{' || character === ',') {
      normalized += character

      let cursor = index + 1
      while (cursor < arrayLiteral.length && /\s/.test(arrayLiteral[cursor])) {
        normalized += arrayLiteral[cursor]
        cursor += 1
      }

      const keyMatch = arrayLiteral
        .slice(cursor)
        .match(/^([A-Za-z_$][A-Za-z0-9_$]*)(\s*:)/)

      if (keyMatch) {
        normalized += `"${keyMatch[1]}"${keyMatch[2]}`
        index = cursor + keyMatch[0].length - 1
        continue
      }

      index = cursor - 1
      continue
    }

    normalized += character
  }

  return JSON.parse(normalized)
}

const extractJobArrays = (bundleText) => {
  const source = String(bundleText ?? '')
  const arrays = []

  for (const match of source.matchAll(/\b[A-Za-z_$][\w$]*=\[\s*\{\s*id:/g)) {
    const arrayStartIndex = source.indexOf('[', match.index)
    const preview = source.slice(arrayStartIndex, arrayStartIndex + 350)
    if (!/\bslug:/.test(preview) || !/\btitle:/.test(preview)) continue

    try {
      const records = parseObjectArrayLiteral(
        extractBalancedArrayLiteral(source, arrayStartIndex),
      )
      if (Array.isArray(records) && records.length > 0 && records.every((record) => record.slug && record.title)) {
        arrays.push(records)
      }
    } catch {
      // Other bundled arrays can contain JavaScript expressions instead of job data.
    }
  }

  return arrays
}

const isJobDetail = (record) =>
  ['description', 'responsibilities', 'requirements', 'education', 'experience']
    .some((field) => Object.hasOwn(record, field))

const asStringArray = (value) => [...new Set(
  (Array.isArray(value) ? value : [])
    .map((entry) => normalizeWhitespace(entry))
    .filter(Boolean),
)]

export const extractMainBundleUrl = (html = '') => {
  const match = String(html ?? '').match(
    /<script[^>]+src=["']([^"']*\/static\/js\/main\.[^"']+\.js)["']/i,
  )

  return getSafeBlubridgeUrl(match?.[1])
}

export const extractBundleJobCards = (bundleText = '') =>
  extractJobArrays(bundleText)
    .filter((records) => !isJobDetail(records[0]))
    .flat()
    .map((record) => {
      const slug = normalizeWhitespace(record.slug)
      if (!slug) return null

      return {
        title: normalizeWhitespace(record.title),
        department: formatDepartmentParts(record.department, record.team),
        location: normalizeWhitespace(record.location),
        slug,
        url: buildBundleJobUrl(slug),
      }
    })
    .filter(Boolean)

export const extractBundleJobDetails = (bundleText = '') =>
  extractJobArrays(bundleText)
    .filter((records) => isJobDetail(records[0]))
    .flat()
    .map((record) => {
      const slug = normalizeWhitespace(record.slug || record.id)
      if (!slug) return null

      return {
        title: normalizeWhitespace(record.title),
        company: COMPANY,
        department: formatDepartmentParts(record.department, record.team),
        location: normalizeWhitespace(record.location),
        city: extractCity(record.location),
        jobId: slug,
        requisitionId: null,
        sourceUrl: buildBundleJobUrl(slug),
        applyUrl: buildBundleJobUrl(slug),
        employmentType: normalizeWhitespace(record.employmentType),
        experienceRequired: normalizeWhitespace(record.experience),
        minimumQualification: normalizeWhitespace(record.education),
        preferredQualification: null,
        requiredSkills: asStringArray(record.skills),
        postingDate: null,
        closingDate: null,
        jobDescription: buildJobDescription([
          { label: 'About the Role', value: normalizeWhitespace(record.description) },
          { label: 'Education', value: normalizeWhitespace(record.education) },
          { label: 'Key Responsibilities', value: asStringArray(record.responsibilities).join('; ') || null },
          { label: 'Requirements', value: asStringArray(record.requirements).join('; ') || null },
        ]),
      }
    })
    .filter(Boolean)

export const extractJobCards = (html) => {
  const jobs = []
  const seenUrls = new Set()
  const anchorPattern = /<a[^>]+class=["'][^"']*\bjob-row\b[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi

  for (const match of String(html ?? '').matchAll(anchorPattern)) {
    const url = getSafeBlubridgeUrl(match[1])
    if (!url || seenUrls.has(url)) continue

    const lines = htmlToLines(match[2])
    const [title, department, location] = lines
    if (!title) continue

    seenUrls.add(url)
    jobs.push({
      title,
      department: department || null,
      location: location || null,
      url,
    })
  }

  return jobs
}

export const extractJobDetail = (html, sourceUrl) => {
  const lines = htmlToLines(html)
  const title = extractTitleFromHtml(html)
  const titleIndex = title
    ? lines.findIndex(
      (line) =>
        (line === title || line.endsWith(title) || line.includes(title))
        && !/\|\s*careers/i.test(line),
    )
    : -1
  const titleLine = titleIndex >= 0 ? lines[titleIndex] : null
  const departmentPrefix = titleLine && title
    ? normalizeWhitespace(
      titleLine
        .slice(0, titleLine.indexOf(title))
        .replace(/^Back to Careers\s*/i, ''),
    )
    : null
  const department = formatDepartment(departmentPrefix || (titleIndex > 0 ? lines[titleIndex - 1] : null))
  const location = titleIndex >= 0 ? lines[titleIndex + 1] || null : null
  const experienceRequired = titleIndex >= 0 ? lines[titleIndex + 2] || null : null
  const minimumQualification = extractSection(lines, 'Education', ['Key Responsibilities', 'Requirements'])[0] || null
  const aboutRole = extractSection(lines, 'About the Role', ['Education', 'Key Responsibilities']).join(' ')
  const keyResponsibilities = extractSection(lines, 'Key Responsibilities', ['Requirements', 'Added Advantage', 'Why Join BluBridge?', 'Skills'])
    .filter((value) => !['+', '*'].includes(value))
    .join('; ')
  const requirements = extractSection(lines, 'Requirements', ['Added Advantage', 'Why Join BluBridge?', 'Skills'])
    .filter((value) => !['+', '*'].includes(value))
    .join('; ')
  const requiredSkills = [...new Set(
    [...String(
      extractHtmlBetweenLabels(html, 'Skills', ['Ready to Join Our Team?']) ?? '',
    ).matchAll(/<span[^>]*>([^<]+)<\/span>/gi)]
      .map((match) => normalizeWhitespace(match[1]))
      .filter((value) => value && !['+', '*'].includes(value)),
  )]

  return {
    title,
    company: COMPANY,
    department,
    location,
    city: extractCity(location),
    jobId: slugToJobId(sourceUrl),
    requisitionId: null,
    sourceUrl,
    applyUrl: sourceUrl,
    employmentType: extractSection(
      lines,
      'EMPLOYMENT',
      ['About the Role', 'VACANCIES', 'BATCH'],
    )[0] || null,
    experienceRequired,
    minimumQualification,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: buildJobDescription([
      { label: 'About the Role', value: aboutRole || null },
      { label: 'Education', value: minimumQualification },
      { label: 'Key Responsibilities', value: keyResponsibilities || null },
      { label: 'Requirements', value: requirements || null },
    ]),
  }
}

export const createBlubridgeScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const listingHtml = await fetchText(CAREER_PAGE_URL)
    const bundleUrl = extractMainBundleUrl(listingHtml)

    if (!bundleUrl) {
      throw new Error('Blubridge careers shell no longer exposes the main React bundle')
    }

    const bundleText = await fetchText(bundleUrl)
    const cards = extractBundleJobCards(bundleText)
    const details = extractBundleJobDetails(bundleText)

    if (cards.length === 0) {
      throw new Error('Blubridge careers bundle no longer exposes structured job listings')
    }

    if (details.length === 0) {
      throw new Error('Blubridge careers bundle no longer exposes structured job details')
    }

    const detailByJobId = new Map(
      details.map((detail) => [detail.jobId, detail]),
    )

    return cards
      .map((card) => {
        const detail = detailByJobId.get(card.slug) || {
          title: card.title,
          company: COMPANY,
          department: card.department,
          location: card.location,
          city: extractCity(card.location),
          jobId: card.slug,
          requisitionId: null,
          sourceUrl: card.url,
          applyUrl: card.url,
          employmentType: null,
          experienceRequired: null,
          minimumQualification: null,
          preferredQualification: null,
          requiredSkills: [],
          postingDate: null,
          closingDate: null,
          jobDescription: null,
        }

        return {
          ...detail,
          title: detail.title || card.title,
          department: detail.department || card.department,
          location: detail.location || card.location,
          city: detail.city || extractCity(card.location),
          source: SOURCE,
          link: detail.applyUrl || detail.sourceUrl,
          scrapedAt: (overrideNow || now)(),
        }
      })
      .filter((job) => job.title && job.jobId)
  },
})

export const run = async (options = {}) => createBlubridgeScraper().run(options)

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
