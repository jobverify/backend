import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'gitait'
export const COMPANY = 'GITA IT'
export const COMPANY_DOMAIN = 'gitait.com'
export const HOMEPAGE_URL = 'https://gitait.com/'
export const CAREERS_URL = 'https://gitait.com/careers.html'
export const DETAIL_URLS = {
  meanstack: 'https://gitait.com/meanstackdev.html',
  react: 'https://gitait.com/reactjsNreactnative.html',
  techLead: 'https://gitait.com/techLead.html',
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/[\u2012\u2013\u2014\u2015]/g, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(value)

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const canonicalText = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const ABSOLUTE_DETAIL_URLS = Object.values(DETAIL_URLS)

const DETAIL_PAGE_RULES = {
  [DETAIL_URLS.meanstack]: {
    title: 'Dotnet Full Stack Developer',
    detailId: 'mean-stack-react',
    titlePatterns: [
      /dotnet[\s-]*full\s*stack/i,
      /mean\s+full\s+stack\s+developer\s+with\s+react\s+js/i,
    ],
  },
  [DETAIL_URLS.react]: {
    title: 'Reactjs and React Native web-developer',
    detailId: 'react-developer',
    titlePatterns: [
      /reactjs\s+and\s+react\s+native\s+web[\s-]*developer/i,
      /reactjs?\s*&\s*react[\s-]*native\s+developer/i,
    ],
  },
  [DETAIL_URLS.techLead]: {
    title: 'Tech Lead',
    detailId: 'react-developer',
    titlePatterns: [
      /tech[\s-]*lead/i,
    ],
  },
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const toAbsoluteUrl = (href) => new URL(href, HOMEPAGE_URL).toString()

const decodeTitleTitleCase = (value) => normalizeWhitespace(value)
  .replace(/-/g, ' ')
  .replace(/\bDotnet\b/i, 'Dotnet')
  .replace(/\bStack\b/i, 'Stack')

const extractTitleTag = (html) => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return stripTags(match?.[1] ?? '')
}

const extractListItems = (block) =>
  Array.from(String(block ?? '').matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi))
    .map((match) => stripTags(match[1]))
    .filter(Boolean)

const extractSectionBlock = (html, heading) => {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = String(html ?? '').match(
    new RegExp(`<h6[^>]*>\\s*${escapedHeading}\\s*<\\/h6>([\\s\\S]*?)(?=<h6\\b|<button\\b|<section\\b|<\\/div>\\s*<\\/div>\\s*<\\/div>)`, 'i'),
  )

  return match?.[1] ?? ''
}

const extractContactEmail = (html) => {
  const match = String(html ?? '').match(/[A-Z0-9._%+-]+@gitait\.com/gi)
  return match?.[0]?.toLowerCase() ?? null
}

const extractExperienceRequired = (items) => {
  for (const item of items) {
    const rangeMatch = item.match(/\b(\d+\s*-\s*\d+)\s+years?\b/i)
    if (rangeMatch) {
      return `${rangeMatch[1].replace(/\s+/g, '')} years`
    }

    const minimumMatch = item.match(/\bMinimum\s+(\d+)\s+years?\b/i)
    if (minimumMatch) {
      return `Minimum ${minimumMatch[1]} years`
    }
  }

  return null
}

const extractLocation = (html) => {
  const locationMatch = String(html ?? '').match(/Work Location:\s*<\/h6>\s*([A-Za-z.\s]+)\s*[\.<]/i)
  const rawLocation = stripTags(locationMatch?.[1] ?? 'Hyderabad').replace(/\.+$/, '')
  const city = normalizeCity(rawLocation)

  return {
    location: `${rawLocation}, Telangana, India`,
    city,
    country: 'India',
  }
}

const extractRequiredSkills = (html) => {
  const keySkillsBlock = extractSectionBlock(html, 'Key Skills')
  const rawSkills = stripTags(keySkillsBlock)
    .split(',')
    .map((skill) => normalizeWhitespace(skill.replace(/\.$/, '')))
    .filter(Boolean)

  return Array.from(new Set(rawSkills))
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*GITA IT Pvt Ltd \| E-Learning\s*<\/title>/i.test(page)
    && text.includes('Current openings')
    && text.includes('We are headquartered in Hyderabad')
    && text.includes('murthy@gitait.com')
    && /href=["']meanstackdev\.html["']/i.test(page)
    && /href=["']reactjsNreactnative\.html["']/i.test(page)
    && /href=["']techLead\.html["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /<title>\s*GITA IT Pvt Ltd \| E-Learning\s*<\/title>/i.test(page)
    && text.includes('Current openings')
    && text.includes('We are headquartered in Hyderabad')
    && text.includes('murthy@gitait.com')
    && /id=["']career-collapse["']/i.test(page)
    && /href=["']meanstackdev\.html["']/i.test(page)
    && /href=["']reactjsNreactnative\.html["']/i.test(page)
    && /href=["']techLead\.html["']/i.test(page)
    && /id=["']applyBtn["']/i.test(page)
}

export const extractCareerListingUrls = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('GITA IT verified official careers page no longer matches the trusted first-party surface')
  }

  const detailUrls = Array.from(String(html ?? '').matchAll(/href=["'](meanstackdev\.html|reactjsNreactnative\.html|techLead\.html)["']/gi))
    .map((match) => toAbsoluteUrl(match[1]))
    .filter((url, index, array) => array.indexOf(url) === index)

  if (detailUrls.length !== ABSOLUTE_DETAIL_URLS.length) {
    throw new Error('GITA IT verified official careers page no longer exposes the trusted detail links')
  }

  if (JSON.stringify(detailUrls) !== JSON.stringify(ABSOLUTE_DETAIL_URLS)) {
    throw new Error('GITA IT verified official careers page no longer matches the trusted detail-link contract')
  }

  return detailUrls
}

export const extractJobDetail = (detailUrl, html) => {
  const rule = DETAIL_PAGE_RULES[detailUrl]
  if (!rule) {
    throw new Error(`Unexpected GITA IT detail URL: ${detailUrl}`)
  }

  const page = String(html ?? '')
  const text = normalizeWhitespace(page)
  const titleTag = extractTitleTag(page)

  if (!titleTag || !/Resume Upload/i.test(page) || !/type=["']file["']/i.test(page) || !/applyBtn/i.test(page)) {
    throw new Error(`Verified GITA IT detail page no longer matches the trusted apply flow for ${detailUrl}`)
  }

  const detailBlockMatch = page.match(
    new RegExp(`<div class=["']career-box-details["'] id=["']${rule.detailId}["']>([\\s\\S]*?)<button type=["']submit["'] class=["']btn btn-primary["'] id=['"]applyBtn['"]>Apply<\\/button>`, 'i'),
  )

  if (!detailBlockMatch?.[1]) {
    throw new Error(`Verified GITA IT detail page no longer exposes the trusted role block for ${detailUrl}`)
  }

  const titleSignals = rule.titlePatterns ?? []
  if (!titleSignals.some((pattern) => pattern.test(`${titleTag} ${text}`))) {
    throw new Error(`Verified GITA IT detail page no longer exposes the trusted role title for ${detailUrl}`)
  }

  const detailBlock = detailBlockMatch[1]
  const summaryItems = extractListItems(extractSectionBlock(detailBlock, 'Job Summary'))
  const responsibilityItems = extractListItems(extractSectionBlock(detailBlock, 'Responsibilities and Duties'))
  const allItems = [...summaryItems, ...responsibilityItems]
  const experienceRequired = extractExperienceRequired(allItems)
  const requiredSkills = extractRequiredSkills(detailBlock)
  const { location, city, country } = extractLocation(detailBlock)
  const contactEmail = extractContactEmail(detailBlock)

  const jobDescriptionParts = [
    `Official GITA IT role on the verified first-party page: ${rule.title}.`,
    summaryItems.length ? `Job summary: ${summaryItems.join(' ')}` : null,
    responsibilityItems.length ? `Responsibilities: ${responsibilityItems.join(' ')}` : null,
    requiredSkills.length ? `Key skills: ${requiredSkills.join(', ')}.` : null,
    contactEmail ? `Hiring contact: ${contactEmail}.` : null,
  ].filter(Boolean)

  return {
    title: rule.title,
    department: 'Engineering',
    location,
    city,
    country,
    sourceUrl: detailUrl,
    applyUrl: detailUrl,
    jobId: `${SOURCE}-${slugify(rule.title)}`,
    requisitionId: `${SOURCE}-${slugify(rule.title)}`,
    employmentType: null,
    experienceRequired,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills,
    postingDate: null,
    closingDate: null,
    jobDescription: jobDescriptionParts.join(' '),
    remoteStatus: null,
    contactEmail,
  }
}

export const createGitaitScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('GITA IT verified official homepage no longer matches the trusted first-party surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const detailUrls = extractCareerListingUrls(careersHtml)

    const jobs = []
    for (const detailUrl of detailUrls) {
      const detailHtml = await fetchText(detailUrl)
      jobs.push(extractJobDetail(detailUrl, detailHtml))
    }

    return jobs.map((job) => ({
      ...job,
      company: COMPANY,
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: COMPANY_DOMAIN,
      atsPlatform: 'official-company-careers',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) => createGitaitScraper().run(options)

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
