import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'neilsoft'
export const COMPANY = 'Neilsoft Ltd'
export const HOMEPAGE_URL = 'https://neilsoft.com/'
export const CAREERS_URL = 'https://neilsoft.com/careers'
export const INDIA_OPENINGS_URL = 'https://neilsoft.com/careers/current-job-openings-india'
export const APPLICATION_EMAIL = 'careers@neilsoft.com'
export const VERIFIED_ON = '2026-08-07'
export const VERIFIED_SURFACE_SUMMARY = 'Verified on Friday, August 7, 2026 that https://neilsoft.com/ remained Neilsoft\'s official homepage, that it now exposes a careers module linking Why Neilsoft, Employee Testimonials, and Current Job Openings-India directly from the homepage, and that the first-party India openings surface at https://neilsoft.com/careers/current-job-openings-india continued to expose public India job detail pages with mailto apply links.'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;|&#8212;|&mdash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const normalizeJobCode = (value) =>
  normalizeWhitespace(String(value ?? '').replace(/^\[|\]$/g, ''))

const parseLocation = (value) => {
  const rawLocation = normalizeWhitespace(value)
  if (!rawLocation) {
    return {
      location: null,
      city: null,
      remoteStatus: 'On-site',
    }
  }

  if (/^any\s*\/\s*wfh$/i.test(rawLocation)) {
    return {
      location: 'Any/WFH, India',
      city: null,
      remoteStatus: 'Remote',
    }
  }

  const remoteStatus = /wfh|remote/i.test(rawLocation)
    ? 'Remote'
    : /hybrid/i.test(rawLocation)
      ? 'Hybrid'
      : 'On-site'

  const parts = rawLocation
    .split(/\s*\/\s*|,\s*/)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)

  const containsIndia = parts.some((part) => /india/i.test(part))
  const normalizedLocation = parts.join(', ')
  const location = containsIndia ? normalizedLocation : `${normalizedLocation}, India`
  const city = remoteStatus === 'Remote'
    ? null
    : parts.find((part) => part && !/^(india|neilsoft india offices)$/i.test(part)) || null

  return {
    location,
    city,
    remoteStatus,
  }
}

const normalizeExperience = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const rangeMatch = normalized.match(/(\d+\s*(?:to|-)\s*\d+\s*years?)/i)
  if (rangeMatch) {
    return normalizeWhitespace(rangeMatch[1])
  }

  const plusMatch = normalized.match(/(\d+\+?\s*years?)/i)
  return plusMatch ? normalizeWhitespace(plusMatch[1]) : null
}

const normalizeTitleForComparison = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim() || null

const DETAIL_SECTION_PATTERNS = [
  /Background\s*(?:&|and)\s*Skills/i,
  /Background\s*(?:&|and)\s*Experience/i,
  /Responsibilities/i,
  /Required Skills\s*\/\s*Abilities/i,
  /Required Skills\s*(?:&|and)\s*Experience/i,
]

const extractArticleBodyHtml = (html) => {
  const page = String(html ?? '')
  const articleBodyStart = /<div[^>]+itemprop=["']articleBody["'][^>]*>/i.exec(page)

  if (!articleBodyStart) {
    return page
  }

  const rest = page.slice(articleBodyStart.index + articleBodyStart[0].length)
  const sharePageMatch = /<h2[^>]*>\s*Share the page\s*<\/h2>/i.exec(rest)

  return sharePageMatch ? rest.slice(0, sharePageMatch.index) : rest
}

const extractFieldValue = (html, fieldNamePattern) => stripTags(
  String(html ?? '').match(new RegExp(
    `<strong>\\s*${fieldNamePattern}\\s*:\\s*<\\/strong>\\s*([\\s\\S]*?)(?:<br\\s*\\/?>|<\\/p>)`,
    'i',
  ))?.[1]
    || String(html ?? '').match(new RegExp(
      `<p[^>]*>\\s*${fieldNamePattern}\\s*:\\s*([\\s\\S]*?)(?:<br\\s*\\/?>|<\\/p>)`,
      'i',
    ))?.[1],
)

const extractListItems = (html) => String(html ?? '')
  .split(/<li[^>]*>/i)
  .slice(1)
  .map((itemHtml) => stripTags(itemHtml.replace(/<\/li>/gi, ' ')))
  .filter(Boolean)

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractSectionListItems = (html, headingPatterns = []) => {
  for (const headingPattern of headingPatterns) {
    const source = typeof headingPattern === 'string' ? escapeRegExp(headingPattern) : headingPattern.source
    const flags = typeof headingPattern === 'string' ? 'i' : headingPattern.flags
    const match = String(html ?? '').match(new RegExp(
      `<h2[^>]*>\\s*(?:${source})\\s*<\\/h2>\\s*<ul[^>]*>([\\s\\S]*?)<\\/ul>`,
      flags,
    ))

    const items = extractListItems(match?.[1] || '')
    if (items.length > 0) {
      return items
    }
  }

  return []
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''
  const hasLegacyHomepageIntro = /global Engineering Services & Solutions company/i.test(text)
  const hasCurrentHomepageCareersModule =
    /Why Neilsoft/i.test(text)
    && /Employee Testimonials/i.test(text)
    && /Current Job Openings-India/i.test(text)

  return /<title>\s*Engineering Services &amp; Design \|Neilsoft/i.test(page)
    && (hasLegacyHomepageIntro || hasCurrentHomepageCareersModule)
    && /<a[^>]+href=["']\/careers["'][^>]*>\s*Careers\s*<\/a>/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Careers at Neilsoft \| Explore Opportunities/i.test(page)
    && /Why Neilsoft \?/i.test(text)
    && /Employee Testimonials/i.test(text)
    && /Current Job Openings-India/i.test(text)
    && /href=["']\/careers\/current-job-openings-india["']/i.test(page)
}

export const hasOfficialIndiaOpeningsSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Current Job Openings in India \| Neilsoft Careers/i.test(page)
    && /Current job openings India/i.test(text)
    && /A list of our current job openings is provided below/i.test(text)
    && /careers@neilsoft\.com/i.test(text)
    && /href=["']\/careers\/current-job-openings-india\/[^"']+["']/i.test(page)
    && (/Job Categories/i.test(text) || /<div class="Currer[^"]*">/i.test(page))
}

export const hasOfficialJobDetailSignal = (html, expectedTitle = null) => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''
  const articleBodyHtml = extractArticleBodyHtml(page)
  const articleText = stripTags(articleBodyHtml) || ''
  const normalizedTitle = normalizeTitleForComparison(expectedTitle)
  const normalizedPageText = normalizeTitleForComparison(text)
  const hasRecognizedSection = DETAIL_SECTION_PATTERNS.some((pattern) => pattern.test(articleText))

  return (/Qualifications?:/i.test(articleText) || /Experience:/i.test(articleText))
    && (hasRecognizedSection || /<ul[^>]*>/i.test(articleBodyHtml))
    && /[a-z0-9._%+-]+@neilsoft\.com/i.test(articleText)
    && (/Current Job Openings-India/i.test(text) || /<meta[^>]+property=["']og:title["']/i.test(page) || /<h1[^>]*>/i.test(page))
    && (!normalizedTitle || normalizedPageText?.includes(normalizedTitle))
}

const isIgnoredDepartmentHeading = (value) => /^(Job Categories|Share the page)$/i.test(String(value ?? ''))

const extractDepartmentTokens = (html) => [...String(html ?? '').matchAll(
  /<h2[^>]*>([\s\S]*?)<\/h2>|<p[^>]*>\s*<strong>\s*([\s\S]*?)\s*<\/strong>\s*<\/p>/gi,
)]
  .map((match) => ({
    type: 'department',
    index: match.index ?? -1,
    value: stripTags(match[1] || match[2]),
  }))
  .filter((token) => token.index >= 0 && token.value && !isIgnoredDepartmentHeading(token.value))

const extractCardTokens = (html) => {
  const sectionHtml = String(html ?? '')
  const cardPattern = /<div[^>]+class=["'][^"']*\bpanel\s+panel-default\b[^"']*["'][^>]*>[\s\S]*?(?=<div[^>]+class=["'][^"']*\bpanel\s+panel-default\b[^"']*["'][^>]*>|<p[^>]*>\s*<strong>|<h2[^>]*>|$)/gi.test(sectionHtml)
    ? /<div[^>]+class=["'][^"']*\bpanel\s+panel-default\b[^"']*["'][^>]*>[\s\S]*?(?=<div[^>]+class=["'][^"']*\bpanel\s+panel-default\b[^"']*["'][^>]*>|<p[^>]*>\s*<strong>|<h2[^>]*>|$)/gi
    : /<div[^>]+class=["'][^"']*\bCurrer\b[^"']*["'][^>]*>[\s\S]*?(?=<div[^>]+class=["'][^"']*\bCurrer\b[^"']*["'][^>]*>|<p[^>]*>\s*<strong>|<h2[^>]*>|$)/gi

  return [...sectionHtml.matchAll(cardPattern)]
    .map((match) => ({
      type: 'card',
      index: match.index ?? -1,
      html: match[0],
    }))
    .filter((token) => token.index >= 0)
}

const extractDetailSectionBullets = (html) => {
  const articleBodyHtml = extractArticleBodyHtml(html)
  const recognizedBullets = [...articleBodyHtml.matchAll(/<ul[^>]*>([\s\S]*?)<\/ul>/gi)]
    .filter((match) => {
      const context = articleBodyHtml.slice(Math.max(0, (match.index ?? 0) - 200), match.index ?? 0)
      const contextText = stripTags(context) || ''
      return DETAIL_SECTION_PATTERNS.some((pattern) => pattern.test(contextText))
    })
    .flatMap((match) => extractListItems(match[1]))

  if (recognizedBullets.length > 0) {
    return recognizedBullets
  }

  const fallbackLists = [...articleBodyHtml.matchAll(/<ul[^>]*>([\s\S]*?)<\/ul>/gi)]
    .flatMap((match) => extractListItems(match[1]))

  return fallbackLists
}

export const extractJobsFromIndiaOpeningsPage = (html) => {
  if (!hasOfficialIndiaOpeningsSignal(html)) {
    throw new Error('Neilsoft official India openings page changed; refusing to scrape')
  }

  const page = String(html ?? '')
  const startAfterJobCategories = /<h2[^>]*>\s*Job Categories\s*<\/h2>/i.exec(page)
  const firstDepartmentHeading = extractDepartmentTokens(page)[0]
  const firstCardIndex = page.search(/<div class="Currer[^"]*">/i)
  const startIndex = startAfterJobCategories
    ? startAfterJobCategories.index + startAfterJobCategories[0].length
    : firstDepartmentHeading?.index ?? firstCardIndex

  if (startIndex == null || startIndex < 0) {
    throw new Error('Neilsoft official India openings page changed; refusing to scrape')
  }

  const rest = page.slice(startIndex)
  const endMatch = /<h2[^>]*>\s*Share the page\s*<\/h2>/i.exec(rest)
  const sectionHtml = endMatch ? rest.slice(0, endMatch.index) : rest

  const tokens = [
    ...extractDepartmentTokens(sectionHtml),
    ...extractCardTokens(sectionHtml),
  ].sort((left, right) => left.index - right.index)
  const jobs = []
  let currentDepartment = null

  for (const token of tokens) {
    if (token.type === 'department') {
      currentDepartment = token.value
      continue
    }

    const cardHtml = token.html
    const title = stripTags(cardHtml.match(/<strong>\s*<a[^>]+>([\s\S]*?)<\/a>\s*<\/strong>/i)?.[1])
    const detailPath = normalizeWhitespace(cardHtml.match(/<strong>\s*<a[^>]+href=["']([^"']+)["']/i)?.[1])
    const summaryText = stripTags(cardHtml.split(/<br\s*\/?>/i).slice(1).join(' ')) || ''
    const summaryMatch = summaryText.match(/^(.*?)\s*-\s*Job code:\s*(\[[^\]]+\])/i)
    const applyUrl = normalizeWhitespace(cardHtml.match(/href=["'](mailto:[^"']+)["']/i)?.[1])
    const detailUrl = detailPath ? toAbsoluteUrl(detailPath, INDIA_OPENINGS_URL) : null
    const locationSummary = normalizeWhitespace(summaryMatch?.[1])
    const jobCode = normalizeJobCode(summaryMatch?.[2])

    if (!currentDepartment || !title || !detailUrl || !locationSummary || !jobCode) {
      throw new Error('Neilsoft official India openings page changed; refusing to scrape')
    }

    const { location, city, remoteStatus } = parseLocation(locationSummary)

    jobs.push({
      title,
      company: COMPANY,
      department: currentDepartment,
      location,
      city,
      country: 'India',
      jobId: jobCode,
      requisitionId: jobCode,
      sourceUrl: detailUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus,
    })
  }

  if (jobs.length === 0) {
    throw new Error('Neilsoft official India openings page changed; refusing to scrape')
  }

  return jobs
}

export const extractJobDetail = (html, sourceUrl) => {
  if (!hasOfficialJobDetailSignal(html)) {
    throw new Error(`Neilsoft job detail page changed for ${sourceUrl}; refusing to scrape`)
  }

  const articleBodyHtml = extractArticleBodyHtml(html)
  const title = stripTags(
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      || html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1],
  )
  const qualificationBullets = extractSectionListItems(articleBodyHtml, [
    /Required Qualifications?/i,
    /Qualifications?/i,
  ])
  const requiredSkillBullets = extractSectionListItems(articleBodyHtml, [
    /Required Skills(?:\s*\/\s*Abilities)?/i,
    /Required Skills\s*(?:&|and)\s*Experience/i,
    /Background\s*(?:&|and)\s*Skills/i,
  ])
  const responsibilityBullets = extractSectionListItems(articleBodyHtml, [
    /Key Responsibilities/i,
    /Responsibilities/i,
  ])
  const detailBullets = extractDetailSectionBullets(html)
  const minimumQualification = extractFieldValue(articleBodyHtml, 'Qualifications?')
    || qualificationBullets[0]
    || null
  const experienceSummary = extractFieldValue(articleBodyHtml, 'Experience')
  const experienceRequired = normalizeExperience(experienceSummary)
    || qualificationBullets.map((item) => normalizeExperience(item)).find(Boolean)
    || requiredSkillBullets.map((item) => normalizeExperience(item)).find(Boolean)
    || responsibilityBullets.map((item) => normalizeExperience(item)).find(Boolean)
    || detailBullets.map((item) => normalizeExperience(item)).find(Boolean)
    || null
  const preferredQualification = null
  const requiredSkillsSource = requiredSkillBullets.length > 0 ? requiredSkillBullets : detailBullets
  const requiredSkills = requiredSkillsSource.filter((item) =>
    item
    && normalizeExperience(item) !== item
    && !/years? of experience/i.test(item))
  const applyUrl = normalizeWhitespace(html.match(/href=["'](mailto:[^"']+)["']/i)?.[1])
  const jobDescriptionParts = [
    minimumQualification ? `Qualification: ${minimumQualification}` : null,
    experienceSummary ? `Experience: ${experienceSummary}` : null,
    ...responsibilityBullets,
    ...qualificationBullets,
    ...requiredSkillBullets,
    ...(requiredSkillBullets.length === 0 ? detailBullets : []),
  ].filter(Boolean)
  const jobDescription = normalizeWhitespace(jobDescriptionParts.join(' '))

  if (
    !title
    || !minimumQualification
    || (detailBullets.length === 0 && qualificationBullets.length === 0 && requiredSkillBullets.length === 0)
  ) {
    throw new Error(`Neilsoft job detail page changed for ${sourceUrl}; refusing to scrape`)
  }

  return {
    title,
    minimumQualification,
    experienceRequired,
    preferredQualification,
    requiredSkills,
    jobDescription,
    applyUrl,
    sourceUrl,
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createNeilsoftScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Neilsoft official homepage changed; refusing to scrape')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Neilsoft official careers landing page changed; refusing to scrape')
    }

    const openingsHtml = await fetchText(INDIA_OPENINGS_URL)
    const baseJobs = extractJobsFromIndiaOpeningsPage(openingsHtml)
    const jobs = []

    for (const baseJob of baseJobs) {
      const detailHtml = await fetchText(baseJob.sourceUrl)
      if (!hasOfficialJobDetailSignal(detailHtml, baseJob.title)) {
        throw new Error(`Neilsoft job detail page changed for ${baseJob.sourceUrl}; refusing to scrape`)
      }

      const detail = extractJobDetail(detailHtml, baseJob.sourceUrl)

      jobs.push({
        ...baseJob,
        ...detail,
        source: SOURCE,
        link: baseJob.sourceUrl,
        scrapedAt: (overrideNow || now)(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createNeilsoftScraper().run(options)

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
