import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import PAGERDUTY_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const SEARCH_PROMPT = 'Search by job title, location, department, category, etc.'
const CATEGORY_HEADING = 'Category'
const COUNTRY_HEADING = 'Country'
const DISPLAYED_COUNT_PATTERN = /^Displaying all\s+(\d+)\s+entries$/i

export const SOURCE = PAGERDUTY_CATALOG.source
export const COMPANY = PAGERDUTY_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = PAGERDUTY_CATALOG.officialBrandName
export const VERIFIED_ON = PAGERDUTY_CATALOG.verifiedOn
export const PROVIDER_METADATA = PAGERDUTY_CATALOG
export const CAREERS_PAGE_URL = PAGERDUTY_CATALOG.companyCareerPage

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&#8211;|&#x2013;|&ndash;/gi, '-')
    .replace(/&#8212;|&#x2014;|&mdash;/gi, '-')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

export const extractVisibleLines = (html = '') =>
  String(html ?? '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '\n')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '\n')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#038;|&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
    .replace(/&quot;|&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
    .replace(/&#8211;|&#x2013;|&ndash;/gi, '-')
    .replace(/&#8212;|&#x2014;|&mdash;/gi, '-')
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasVerifiedCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)?.toLowerCase() || ''
  const lines = extractVisibleLines(page)

  return normalized.includes("we're hiring")
    && normalized.includes('pagerduty')
    && normalized.includes(SEARCH_PROMPT.toLowerCase())
    && parseDisplayedRoleCount(lines) != null
}

export const parseDisplayedRoleCount = (lines = []) => {
  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] ?? '')
    const match = String(line).match(DISPLAYED_COUNT_PATTERN)
    if (match) {
      return Number(match[1])
    }

    if (
      /^Displaying$/i.test(line)
      && /^all\s+\d+$/i.test(String(lines[index + 1] ?? ''))
      && /^entries$/i.test(String(lines[index + 2] ?? ''))
    ) {
      return Number(String(lines[index + 1]).match(/\d+/)?.[0] ?? NaN)
    }
  }

  return null
}

const findDisplayedCountIndex = (lines = []) => {
  for (let index = 0; index < lines.length; index += 1) {
    const line = String(lines[index] ?? '')
    if (DISPLAYED_COUNT_PATTERN.test(line)) {
      return index
    }

    if (
      /^Displaying$/i.test(line)
      && /^all\s+\d+$/i.test(String(lines[index + 1] ?? ''))
      && /^entries$/i.test(String(lines[index + 2] ?? ''))
    ) {
      return index
    }
  }

  return -1
}

export const extractDepartmentNames = (lines = []) => {
  const categoryIndex = lines.indexOf(CATEGORY_HEADING)
  const countryIndex = lines.indexOf(COUNTRY_HEADING)
  if (categoryIndex < 0 || countryIndex < 0 || countryIndex <= categoryIndex) {
    return []
  }

  return lines
    .slice(categoryIndex + 1, countryIndex)
    .flatMap((line, index, scopedLines) => {
      const combinedMatch = normalizeWhitespace(line.match(/^(.*?)\s+\(\d+\s+items?\)$/i)?.[1])
      if (combinedMatch) return [combinedMatch]

      if (
        /^[A-Za-z][A-Za-z &'/-]*$/i.test(String(line))
        && /^\(\d+\s+items?\)$/i.test(String(scopedLines[index + 1] ?? ''))
      ) {
        return [line]
      }

      return []
    })
}

export const extractRoleSummaries = (html = '') => {
  const lines = Array.isArray(html) ? html : extractVisibleLines(html)
  const departments = new Set(extractDepartmentNames(lines))
  const searchPromptIndex = lines.lastIndexOf(SEARCH_PROMPT)
  const countIndex = findDisplayedCountIndex(lines)
  const roles = []

  if (departments.size === 0 || searchPromptIndex < 0 || countIndex < 0 || countIndex <= searchPromptIndex) {
    return roles
  }

  let index = searchPromptIndex + 1
  while (index < countIndex - 2) {
    const title = lines[index]
    const department = lines[index + 1]

    if (!departments.has(department)) {
      index += 1
      continue
    }

    const location = lines[index + 2] || null
    const remote = /^Remote$/i.test(lines[index + 3] || '')

    roles.push({
      title,
      department,
      location,
      remote,
    })

    index += remote ? 4 : 3
  }

  return roles
}

export const hasIndiaRole = (roles = []) =>
  roles.some((role) => /\bindia\b/i.test(String(role.location ?? '')))

export const hasVerifiedCurrentNoIndiaBoard = (html = '') => {
  const lines = extractVisibleLines(html)
  const countryIndex = lines.indexOf(COUNTRY_HEADING)
  const stateIndex = lines.indexOf('State')
  const countries = countryIndex >= 0 && stateIndex > countryIndex
    ? lines.slice(countryIndex + 1, stateIndex)
    : []

  return lines.includes('PagerDuty Open Roles')
    && lines.includes("We're Hiring!")
    && lines.includes('Search countries')
    && countries.some((value) => /^(Canada|Chile|Portugal|United Kingdom|United States)$/i.test(value))
    && !countries.some((value) => /^India$/i.test(value))
}

export const createPagerDutyScraper = () => ({
  async run({
    fetchText = defaultFetchText,
  } = {}) {
    const careersHtml = await fetchText(CAREERS_PAGE_URL)

    if (!hasVerifiedCareersPageSignal(careersHtml)) {
      if (hasVerifiedCurrentNoIndiaBoard(careersHtml)) {
        return []
      }
      throw new Error('Verified PagerDuty careers page changed materially')
    }

    const lines = extractVisibleLines(careersHtml)
    const roles = extractRoleSummaries(lines)
    const displayedRoleCount = parseDisplayedRoleCount(lines)

    if (roles.length === 0) {
      throw new Error('Verified PagerDuty role listing changed materially')
    }

    if (displayedRoleCount == null || displayedRoleCount !== roles.length) {
      throw new Error('Verified PagerDuty displayed role count changed materially')
    }

    if (hasIndiaRole(roles)) {
      throw new Error('Verified PagerDuty India slice changed materially')
    }

    return []
  },
})

export const run = async (options = {}) => createPagerDutyScraper(options).run(options)

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
