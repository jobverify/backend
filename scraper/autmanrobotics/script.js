import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

export const SOURCE = 'autmanrobotics'
export const COMPANY = 'Autman Robotics'
export const COMPANY_DOMAIN = 'aut-man.com'
export const HOMEPAGE_URL = 'https://www.aut-man.com/'
export const CAREERS_URL = 'https://www.aut-man.com/careers'
export const APPLY_EMAIL = 'shini@aut-man.com'
export const ATS_PLATFORM = 'official-company-careers'
export const VERIFIED_ON = '2026-08-07'
export const VERIFIED_SURFACE_SUMMARY = 'Verified on Friday, August 7, 2026 that https://www.aut-man.com/ was Autman Robotics\' live first-party homepage titled "Autman Robotics — Physical AI for Adaptive Manufacturing" and that its current marketing shell still exposed a Careers section on the homepage. Also verified on Friday, August 7, 2026 that https://www.aut-man.com/careers remained the public first-party careers page with the CAREER OPPORTUNITIES heading and a publicly visible Robotics Engineer role in Birmingham, UK exposing a mailto apply link to shini@aut-man.com. The scraper therefore keeps trusting the live first-party careers route for public openings while using the rebuilt homepage only as the official brand and careers-surface handoff.'

const APPLY_MAILTO_PATTERN =
  /<a\b[^>]*href=["'](mailto:shini@aut-man\.com\?subject=[^"']+)["'][^>]*>[\s\S]*?Apply Now[\s\S]*?<\/a>/gi
const APPLY_MAILTO_TEST_PATTERN =
  /<a\b[^>]*href=["']mailto:shini@aut-man\.com\?subject=[^"']+["'][^>]*>[\s\S]*?Apply Now[\s\S]*?<\/a>/i
const APPLY_SUBJECT_PREFIX = 'Interested to join Autman : '
const CAREER_SECTION_HEADING = 'CAREER OPPORTUNITIES'
const CAREER_SECTION_END_LINE = "Don't see a position that matches your skills?"
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2014|\u2013/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTagsToLines = (value) =>
  decodeHtml(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/?(?:h[1-6]|p|div|section|article|main|nav|footer|header|li|ul|ol|a|span|button)\b[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .split(/\n+/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const titleCase = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/\b([a-z])/g, (_, letter) => letter.toUpperCase()) || null

const normalizeCountry = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (normalized === 'uk' || normalized === 'united kingdom') return 'United Kingdom'
  return titleCase(normalized)
}

const parseLocation = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      state: null,
      country: null,
    }
  }

  const parts = normalized.split(',').map((part) => normalizeWhitespace(part)).filter(Boolean)

  if (parts.length === 1) {
    return {
      location: normalized,
      city: titleCase(parts[0]),
      state: null,
      country: null,
    }
  }

  if (parts.length === 2) {
    const city = titleCase(parts[0])
    const country = normalizeCountry(parts[1])

    return {
      location: [city, country].filter(Boolean).join(', ') || null,
      city,
      state: null,
      country,
    }
  }

  const city = titleCase(parts[0])
  const state = titleCase(parts[1])
  const country = normalizeCountry(parts.at(-1))

  return {
    location: [city, state, country].filter(Boolean).join(', ') || null,
    city,
    state,
    country,
  }
}

const decodeSubjectTitle = (applyUrl) => {
  const subjectMatch = String(applyUrl ?? '').match(/[?&]subject=([^&]+)/i)
  if (!subjectMatch) return null

  const subject = normalizeWhitespace(decodeURIComponent(subjectMatch[1].replace(/\+/g, ' ')))
  if (!subject?.startsWith(APPLY_SUBJECT_PREFIX)) return null

  return normalizeWhitespace(subject.slice(APPLY_SUBJECT_PREFIX.length))
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(stripTagsToLines(page).join(' '))?.toLowerCase() || ''
  const hasCareersLink = /href=["']#careers["']/i.test(page)
    || /href=["'](?:https:\/\/www\.aut-man\.com)?\/careers["']/i.test(page)
  const hasCanonicalHomepageUrl =
    /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/aut-man\.com\/?["'][^>]*>/i.test(page)
    || /<link[^>]+href=["']https:\/\/aut-man\.com\/?["'][^>]+rel=["']canonical["'][^>]*>/i.test(page)

  return /<title>\s*Autman Robotics\s*[—-]\s*Physical AI for Adaptive Manufacturing\s*<\/title>/i.test(page)
    && /<meta[^>]+name=["']description["'][^>]+content=["'][^"']*Autman Robotics builds Physical AI that makes any industrial robot adaptive/i.test(page)
    && /<meta[^>]+property=["']og:title["'][^>]+content=["']Autman Robotics\s*[—-]\s*Physical AI for Adaptive Manufacturing["']/i.test(page)
    && hasCanonicalHomepageUrl
    && hasCareersLink
    && text.includes("the future of automation doesn't follow scripts.")
    && text.includes('making every robot adaptable and every product limitless.')
    && text.includes('join the mission')
    && text.includes('drop your cv')
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(stripTagsToLines(page).join(' ')) || ''

  return /<title>\s*Careers\s*\|\s*Autman Robotics\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.aut-man\.com\/careers["']/i.test(page)
    && text.includes('WE MAKE BIG IDEAS HAPPEN')
    && text.includes('Welcome to AUTMAN Robotics - a hub of innovation located in the heart of Birmingham, UK')
    && text.includes(CAREER_SECTION_HEADING)
    && text.includes(CAREER_SECTION_END_LINE)
    && APPLY_MAILTO_TEST_PATTERN.test(page)
}

export const hasVerifiedGeneralApplicationHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(stripTagsToLines(page).join(' '))?.toLowerCase() || ''

  return hasOfficialHomepageSignal(page)
    && /mailto:info@aut-man\.com\?subject=General%20Application(?:%20|\s)*-(?:%20|\s)*Autman%20Careers/i.test(page)
    && text.includes('join the mission')
    && text.includes('drop your cv')
    && text.includes("don't see a role matching your exact specifications?")
    && text.includes('submit application')
}

export const isVerifiedCareersRuntimeUnavailable = (value) => {
  const raw = String(value?.message ?? value ?? '')
  const normalized = normalizeWhitespace(raw)?.toLowerCase() || ''

  return normalized.includes('runtime is unreachable')
    || /\bHTTP 504\b/i.test(raw)
    || /\bgateway timeout\b/i.test(raw)
}

export const extractApplyRoleLinks = (html) => {
  const seen = new Set()

  return [...String(html ?? '').matchAll(APPLY_MAILTO_PATTERN)]
    .map((match) => {
      const applyUrl = normalizeWhitespace(match[1])
      const title = decodeSubjectTitle(applyUrl)

      if (!applyUrl || !title || seen.has(applyUrl)) return null
      seen.add(applyUrl)

      return { title, applyUrl }
    })
    .filter(Boolean)
}

const getCareerSectionLines = (html) => {
  const lines = stripTagsToLines(html)
  const startIndex = lines.findIndex((line) => line === CAREER_SECTION_HEADING)
  const endIndex = lines.findIndex((line) => line.startsWith(CAREER_SECTION_END_LINE))

  if (startIndex === -1) return lines
  if (endIndex === -1 || endIndex <= startIndex) return lines.slice(startIndex)

  return lines.slice(startIndex, endIndex)
}

export const extractPublicOpenings = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Autman Robotics verified first-party careers page no longer matches the trusted public jobs surface')
  }

  const applyRoles = extractApplyRoleLinks(html)
  if (!applyRoles.length) {
    throw new Error('Autman Robotics verified first-party careers page no longer exposes public apply links')
  }

  const lines = getCareerSectionLines(html)
  let searchFrom = 0

  return applyRoles.map((role, index) => {
    const nextTitle = applyRoles[index + 1]?.title ?? null
    const titleIndex = lines.findIndex((line, lineIndex) => lineIndex >= searchFrom && line === role.title)

    if (titleIndex === -1) {
      throw new Error(`Autman Robotics verified careers page no longer exposes the ${role.title} title block`)
    }

    const locationLine = lines[titleIndex + 1]
    const { location, city, state, country } = parseLocation(locationLine)

    if (!location || !city || !country) {
      throw new Error(`Autman Robotics verified careers page no longer exposes a parseable location for ${role.title}`)
    }

    const descriptionLines = []
    let cursor = titleIndex + 2

    while (cursor < lines.length) {
      const line = lines[cursor]

      if (line === 'Apply Now') {
        cursor += 1
        break
      }

      if (nextTitle && line === nextTitle) {
        break
      }

      if (line.startsWith(CAREER_SECTION_END_LINE)) {
        break
      }

      descriptionLines.push(line)
      cursor += 1
    }

    const jobDescription = normalizeWhitespace(descriptionLines.join(' '))
    if (!jobDescription) {
      throw new Error(`Autman Robotics verified careers page no longer exposes a public description for ${role.title}`)
    }

    const jobId = `${SOURCE}-${slugify(role.title)}`
    if (!jobId) {
      throw new Error(`Autman Robotics verified careers page no longer exposes a stable identifier for ${role.title}`)
    }

    searchFrom = titleIndex + 1

    return {
      title: role.title,
      department: null,
      location,
      city,
      state,
      country,
      sourceUrl: CAREERS_URL,
      applyUrl: role.applyUrl,
      jobId,
      requisitionId: jobId,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription,
      remoteStatus: null,
    }
  })
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const normalizeScrapedAt = (value) => {
  if (value instanceof Date) return value.toISOString()

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Invalid now() value supplied to the Autman Robotics scraper')
  }

  return parsed.toISOString()
}

export const createAutmanRoboticsScraper = ({
  maxJobs = null,
  now = () => new Date(),
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    maxJobs: overrideMaxJobs,
    now: overrideNow,
  } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Autman Robotics verified official homepage no longer matches the trusted first-party surface')
    }

    const homepageSupportsGeneralApplications = hasVerifiedGeneralApplicationHomepageSignal(homepageHtml)

    let careersHtml
    try {
      careersHtml = await fetchText(CAREERS_URL)
    } catch (error) {
      if (homepageSupportsGeneralApplications && isVerifiedCareersRuntimeUnavailable(error)) {
        return []
      }

      throw error
    }

    if (homepageSupportsGeneralApplications && isVerifiedCareersRuntimeUnavailable(careersHtml)) {
      return []
    }

    const jobs = extractPublicOpenings(careersHtml)
    const limit = Number.isInteger(overrideMaxJobs) ? overrideMaxJobs : maxJobs
    const selectedJobs = Number.isInteger(limit) ? jobs.slice(0, limit) : jobs
    const scrapedAt = normalizeScrapedAt((overrideNow || now)())

    return selectedJobs.map((job) => ({
      ...job,
      company: COMPANY,
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: ATS_PLATFORM,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createAutmanRoboticsScraper().run(options)

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
