import path from 'path'
import { fileURLToPath } from 'url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const HOMEPAGE_URL = 'https://www.efftronics.com/'
export const CAREERS_URL = 'https://www.efftronics.com/careers'
export const APPLY_URL = 'https://www.efftronics.com/resume-upload'

const COMPANY = 'Efftronics'
const SOURCE = 'efftronics'
const DEFAULT_LOCATION = 'Mangalagiri, Andhra Pradesh, India'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const CAREERS_MARKERS = [
  'Join us',
  'Current Vacancies',
  'Walk-in Interviews every Tuesday at 9:00 AM @ Mangalagiri',
  'Career Development with Efftronics',
]

const QUALIFICATION_LINE_PATTERN = /\b(B\.?Tech|M\.?Tech|MCA|M\.Sc|BSC|B\.Sc|Diploma|ITI|Mechanical|Computers|ECE|EEE|EIE|CSE|IT|Freshers preferred)\b/i

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/[\u201C\u201D]/g, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(value)
    .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/ul|\/ol|\/h[1-6]|\/span)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|section|article|ul|ol|h[1-6]|span)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toTextLines = (html) => decodeHtml(String(html ?? ''))
  .replace(/<(br|\/p|\/div|\/li|\/section|\/article|\/ul|\/ol|\/h[1-6]|\/span)\b[^>]*>/gi, '\n')
  .replace(/<(p|div|li|section|article|ul|ol|h[1-6]|span)\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .split(/\r?\n/)
  .map((line) => normalizeWhitespace(line))

const unique = (items) => [...new Set(items.filter(Boolean))]

const looksLikeRoleTitle = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return false
  if (normalized.length > 80) return false
  if (/[.?!:]/.test(normalized)) return false

  return /\b(Engineer|Administrator|Technician|Executive|Associate|Analyst|Designer|Scientist)\b/i.test(normalized)
}

const splitGroups = (lines) => {
  const groups = []
  let current = []

  for (const line of lines) {
    if (!line) {
      if (current.length > 0) {
        groups.push(current)
        current = []
      }
      continue
    }

    current.push(line)
  }

  if (current.length > 0) {
    groups.push(current)
  }

  return groups
}

const extractBetweenMarkers = (lines, startMarker, endMarker) => {
  const startIndex = lines.findIndex((line) => line?.includes(startMarker))
  if (startIndex < 0) return []

  const endIndex = lines.findIndex((line, index) => index > startIndex && line?.includes(endMarker))
  return lines.slice(startIndex + 1, endIndex > startIndex ? endIndex : undefined)
}

const findTitleCandidate = (lines, startIndex) => {
  if (!lines[startIndex]) return null

  const nonEmptyLines = []
  for (let index = startIndex; index < lines.length && nonEmptyLines.length < 3; index += 1) {
    if (lines[index]) {
      nonEmptyLines.push(lines[index])
    }
  }

  for (const length of [1, 2, 3]) {
    const slice = nonEmptyLines.slice(0, length)
    if (slice.length !== length) continue

    const candidate = slice.join(' ')
    if (looksLikeRoleTitle(candidate)) {
      return {
        title: candidate,
        nextIndex: startIndex + nonEmptyLines
          .slice(0, length)
          .reduce((count, _, idx) => {
            let seen = 0
            for (let lineIndex = startIndex; lineIndex < lines.length; lineIndex += 1) {
              if (lines[lineIndex]) {
                seen += 1
              }

              if (seen === idx + 1) {
                count = Math.max(count, lineIndex + 1 - startIndex)
                break
              }
            }

            return count
          }, 0),
      }
    }
  }

  return null
}

const extractVacancyCards = (html) => {
  const sectionLines = extractBetweenMarkers(
    toTextLines(html),
    'Current Vacancies',
    'Career Development with Efftronics',
  )

  const jobs = []

  for (let index = 0; index < sectionLines.length; index += 1) {
    const titleMatch = findTitleCandidate(sectionLines, index)
    if (!titleMatch) continue

    const blockLines = []
    let cursor = titleMatch.nextIndex

    while (cursor < sectionLines.length) {
      const line = sectionLines[cursor]
      if (/^Details$/i.test(line)) break
      blockLines.push(line)
      cursor += 1
    }

    if (cursor >= sectionLines.length || !/^Details$/i.test(sectionLines[cursor])) {
      continue
    }

    index = cursor

    const groups = splitGroups(blockLines)
    const flattenedLines = groups.flat()
    const qualifications = []
    const skills = []

    for (const line of flattenedLines) {
      if (skills.length > 0) {
        skills.push(line)
        continue
      }

      if (QUALIFICATION_LINE_PATTERN.test(line)) {
        qualifications.push(line)
        continue
      }

      skills.push(line)
    }

    jobs.push({
      title: titleMatch.title,
      minimumQualification: qualifications.join(' '),
      requiredSkills: unique(skills.map((skill) => normalizeWhitespace(skill))),
    })
  }

  return jobs
}

const extractDetailSection = (html, title) => {
  const headings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2\s*>/gi)]
  const matching = headings.filter((heading) => stripTags(heading[1]) === title)
  if (matching.length !== 1) return ''

  const heading = matching[0]
  const nextHeading = headings[headings.indexOf(heading) + 1]
  let section = html.slice(heading.index, nextHeading?.index)
  const formOrFooter = section.search(/<(?:form|footer)\b/i)
  if (formOrFooter >= 0) section = section.slice(0, formOrFooter)
  section = section.replace(/<(a|button)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi,
    (markup, _tag, content) => /^Apply Now$/i.test(stripTags(content) || '') ? '\nApply Now\n' : markup)
  return toTextLines(section).join('\n')
}

const extractLabelValue = (sectionText, label) => {
  const lines = sectionText
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line !== null)

  const labelIndex = lines.findIndex((line) => line === label)
  if (labelIndex < 0) return null

  const values = []
  for (let index = labelIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (!line) {
      if (values.length > 0) break
      continue
    }

    if (
      line === 'Apply Now'
      || line === 'SERVICE AGREEMENT'
      || line === 'Responsibilities'
      || line === 'Knowledge & Skills'
      || line === 'Behavioural Attributes'
      || line === 'Qualification'
      || line === 'Job Location'
    ) {
      break
    }

    values.push(line)
  }

  return values.length > 0 ? values.join(' ') : null
}

const extractDescription = (sectionText) => {
  const lines = sectionText
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

  const startIndex = lines.findIndex((line) => /^At Efftronics,/i.test(line)
    || /^(?:Job )?Responsibilities$/i.test(line))
  if (startIndex < 0) return null
  const content = lines.slice(startIndex)
  const endIndex = content.findIndex((line) => /^Apply Now$/i.test(line) || /^If any queries mail to /i.test(line))
  const bodyLines = endIndex >= 0 ? content.slice(0, endIndex) : content
  const sectionHeading = /^(?:(?:Job )?Responsibilities|About Job Role|Knowledge & Skills|Behavioural Attributes|Nature of Job|Eligibility|SERVICE AGREEMENT|Qualification|Job Location)$/i
  let insideResponsibilities = false
  const substantiveResponsibilities = bodyLines.some((line) => {
    if (/^(?:Job )?Responsibilities$/i.test(line)) {
      insideResponsibilities = true
      return false
    }
    if (sectionHeading.test(line)) insideResponsibilities = false
    return insideResponsibilities && !/^At Efftronics,/i.test(line)
  })
  if (!substantiveResponsibilities
    && !bodyLines.some((line) => /^The primary purpose of .+\s+is\s+\S/i.test(line))) return null

  const descriptionLines = []
  for (const line of bodyLines) {
    if (
      line === 'Qualification'
      || line === 'Job Location'
      || line === 'Apply Now'
      || line === 'About Job Role'
      || line === 'Responsibilities'
      || line === 'Knowledge & Skills'
      || line === 'Behavioural Attributes'
      || /^If any queries mail to /i.test(line)
    ) {
      continue
    }

    descriptionLines.push(line)
  }

  return descriptionLines.length > 0 ? descriptionLines.join(' ') : null
}

const buildJob = ({ title, minimumQualification, requiredSkills, detailText }) => {
  const location = extractLabelValue(detailText, 'Job Location') || DEFAULT_LOCATION
  const city = location.split(',')[0]?.trim() || 'Mangalagiri'
  const roleDescription = extractDescription(detailText)
  const detailQualification = extractLabelValue(detailText, 'Qualification')
  const description = roleDescription && detailQualification
    ? `Qualification: ${detailQualification}. ${roleDescription}` : roleDescription
  const requiredExperience = description?.match(/\bExperience\s+Required\s*:\s*(\d+(?:\.\d+)?(?:\s*[-\u2013]\s*\d+(?:\.\d+)?)?\+?\s*(?:years?|months?))\b/i)
    || description?.match(/\b(\d+(?:\.\d+)?(?:\s*[-\u2013]\s*\d+(?:\.\d+)?)?\+?\s*(?:years?|months?))\s+(?:of\s+)?(?:relevant\s+)?(?:work\s+)?experience\b/i)
  const experienceRequired = requiredExperience ? normalizeWhitespace(requiredExperience[1])
    : /\bExperience preferred\b/i.test(description || '') ? 'Experience preferred'
      : /\bFreshers (?:are )?preferred\b/i.test(description || '') ? 'Freshers preferred' : null

  return {
    title,
    company: COMPANY,
    department: null,
    location,
    city,
    country: 'India',
    jobId: slugify(title),
    requisitionId: slugify(title),
    sourceUrl: `${CAREERS_URL}#${slugify(title)}`,
    applyUrl: APPLY_URL,
    employmentType: null,
    experienceRequired,
    minimumQualification: minimumQualification || null,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: description,
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = stripTags(page)
  return /<title>\s*Efftronics Systems Pvt\. Ltd\.\s*<\/title>/i.test(page)
    && /href=["']https:\/\/www\.efftronics\.com\/careers["']/i.test(page)
    && /YOUR ONE-STOP DESTINATION FOR END-TO-END SMART SOLUTIONS/i.test(normalized)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /<title>\s*Careers\s*\|\s*Efftronics Systems Pvt\. Ltd\.\s*<\/title>/i.test(page)
    && CAREERS_MARKERS.every((marker) => page.includes(marker))
    && /Apply Now/i.test(page)
}

export const extractPublicListings = (html) => {
  const page = String(html ?? '').replace(
    /<!--[\s\S]*?(?:-->|$)|<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    ' ',
  )
  const cards = extractVacancyCards(page)

  return cards.map((card) => buildJob({
    ...card,
    detailText: extractDetailSection(page, card.title),
  }))
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  label: SOURCE,
  timeoutMs: 15000,
})

export const createEfftronicsScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Efftronics homepage no longer matches the verified official public site')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Efftronics careers page no longer matches the verified official public jobs surface')
    }

    return extractPublicListings(careersHtml).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async (options = {}) => createEfftronicsScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Efftronics scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
