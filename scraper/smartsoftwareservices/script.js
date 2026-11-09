import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SMART_SOFTWARE_SERVICES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SMART_SOFTWARE_SERVICES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const OPEN_POSITIONS_URL = `${CAREERS_URL}#open-positions`
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const MONTH_TO_NUMBER = {
  Jan: '01',
  Feb: '02',
  Mar: '03',
  Apr: '04',
  May: '05',
  Jun: '06',
  Jul: '07',
  Aug: '08',
  Sep: '09',
  Oct: '10',
  Nov: '11',
  Dec: '12',
}

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&middot;|&#183;/gi, ' · ')
  .replace(/&mdash;|&#8212;|&#x2014;/gi, ' - ')
  .replace(/&ndash;|&#8211;|&#x2013;/gi, '-')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x2019;/gi, "'")
  .replace(/&quot;|&#34;|&#x22;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableText = (value) => normalizeWhitespace(value)
  .replace(/[–—]/g, '-')
  .toLowerCase()

const extractTitle = (html = '') =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const titleCaseWords = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/\b[a-z]/g, (match) => match.toUpperCase())

const normalizeExperienceRequired = (value) => titleCaseWords(
  normalizeWhitespace(value).replace(/[–—]/g, '-'),
)

const parsePostingDate = (value) => {
  const normalized = normalizeWhitespace(value).replace(/^posted\s+/i, '')
  const match = normalized.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})$/)
  if (!match) return null

  const [, monthLabel, dayLabel, yearLabel] = match
  const month = MONTH_TO_NUMBER[monthLabel]
  if (!month) return null

  return `${yearLabel}-${month}-${dayLabel.padStart(2, '0')}`
}

const normalizeLocation = (value) => {
  const parts = normalizeWhitespace(value)
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length === 0) return null

  const remoteParts = parts.filter((part) => /^remote$/i.test(part)).map(() => 'Remote')
  const indiaParts = parts.filter((part) => /^india$/i.test(part)).map(() => 'India')
  const middleParts = parts.filter((part) => !/^remote$/i.test(part) && !/^india$/i.test(part))

  return [...remoteParts, ...middleParts, ...indiaParts].join(', ')
}

const inferCityFromLocation = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/\bremote\b/i.test(normalized)) return 'Remote'
  return normalized.split(',')[0]?.trim() || null
}

const extractTagTexts = (html, tagName) => Array.from(
  String(html ?? '').matchAll(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi')),
  (match) => normalizeWhitespace(match[1]),
).filter(Boolean)

const isCompensationSummary = (value) =>
  /\bcompetitive\b/i.test(value) && /\bbased on experience\b/i.test(value)

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const comparableTitle = normalizeComparableText(extractTitle(page))
  const text = normalizeComparableText(page)

  return comparableTitle === 'careers - join smart software services | smart software services'
    && text.includes('build the future with us')
    && text.includes('join our team')
    && text.includes('work on meaningful projects, grow your skills, and build impactful digital solutions.')
    && text.includes('4 open roles')
    && text.includes('qa automation engineer')
    && text.includes('frontend developer (react / next.js)')
    && text.includes('backend developer (node.js)')
    && text.includes('ui/ux designer')
    && page.includes('href="#open-positions"')
}

export const hasTrustworthyPublicApplySignal = (html = '') => {
  const careersUrl = new URL(CAREERS_URL)
  const hrefs = Array.from(
    String(html ?? '').matchAll(/href=["']([^"']+)["']/gi),
    (match) => normalizeWhitespace(match[1]),
  ).filter(Boolean)

  return hrefs.some((href) => {
    let candidate
    try {
      candidate = new URL(href, CAREERS_URL)
    } catch {
      return false
    }

    if (
      candidate.origin === careersUrl.origin
      && candidate.pathname === careersUrl.pathname
      && candidate.search === careersUrl.search
    ) {
      return false
    }

    return /(apply|jobs?|careers?)/i.test(candidate.href)
  })
}

export const extractVisibleRoleCards = (html = '') => Array.from(
  String(html ?? '').matchAll(/<article\b[\s\S]*?<\/article>/gi),
  (match) => {
    const articleHtml = match[0]
    const title = normalizeWhitespace(articleHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    const spans = extractTagTexts(articleHtml, 'span')
    const paragraphs = extractTagTexts(articleHtml, 'p')
    const experienceRequired = normalizeExperienceRequired(spans[0])
    const requiredSkills = spans
      .slice(1)
      .filter((value) => value && !/^(view details|apply now)$/i.test(value))
    const rawLocation = paragraphs.find((value) => /\bindia\b/i.test(value) && !/^posted\b/i.test(value)) || null
    const location = normalizeLocation(rawLocation)
    const postingDate = parsePostingDate(paragraphs.find((value) => /^posted\b/i.test(value)) || null)
    const jobDescription = paragraphs.find((value) =>
      !/\bindia\b/i.test(value)
      && !/^posted\b/i.test(value)
      && !isCompensationSummary(value),
    ) || null

    return {
      title,
      experienceRequired,
      location,
      requiredSkills,
      postingDate,
      jobDescription,
    }
  },
).filter((role) =>
  role.title
  && role.location
  && /\bindia\b/i.test(role.location)
  && role.postingDate
  && role.jobDescription,
)

export const createSmartSoftwareServicesScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Smart Software Services careers page no longer matches the verified first-party surface')
    }

    const visibleRoles = extractVisibleRoleCards(careersHtml)
    if (visibleRoles.length === 0) {
      if (hasTrustworthyPublicApplySignal(careersHtml)) {
        throw new Error('Smart Software Services careers page exposes public job links but the visible role cards could not be parsed')
      }

      throw new Error('Smart Software Services careers page no longer exposes parseable visible role cards')
    }

    const scrapedAt = now()

    return visibleRoles.map((role) => {
      const jobId = slugify(role.title)

      return {
        title: role.title,
        company: COMPANY,
        department: null,
        location: role.location,
        city: inferCityFromLocation(role.location),
        country: 'India',
        sourceUrl: CAREERS_URL,
        applyUrl: OPEN_POSITIONS_URL,
        jobId,
        requisitionId: jobId,
        employmentType: null,
        experienceRequired: role.experienceRequired,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: role.requiredSkills,
        postingDate: role.postingDate,
        closingDate: null,
        jobDescription: role.jobDescription,
        remoteStatus: /\bremote\b/i.test(role.location) ? 'Remote' : null,
        source: SOURCE,
        link: CAREERS_URL,
        scrapedAt,
        companyCareerPage: CAREERS_URL,
        companyDomain: PROVIDER_METADATA.companyDomain,
        atsPlatform: PROVIDER_METADATA.atsPlatform,
      }
    })
  },
})

export const run = async (options = {}) => createSmartSoftwareServicesScraper(options).run(options)

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
