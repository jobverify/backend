import path from 'node:path'
import { fileURLToPath } from 'node:url'

import provider from './provider.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = provider
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const CAREERS_URL = provider.companyCareerPage

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'
const APPLY_URL = new URL('/about-us/careers/apply-online', CAREERS_URL).toString()

const HTML_ENTITY_MAP = new Map([
  ['&amp;', '&'],
  ['&apos;', '\''],
  ['&#39;', '\''],
  ['&#160;', ' '],
  ['&nbsp;', ' '],
  ['&ndash;', '-'],
  ['&mdash;', '-'],
  ['&ldquo;', '"'],
  ['&rdquo;', '"'],
  ['&lsquo;', '\''],
  ['&rsquo;', '\''],
  ['&middot;', ' '],
])

const INDIA_CITY_NORMALIZATIONS = [
  [/hyderbad/gi, 'Hyderabad'],
  [/hyderabad/gi, 'Hyderabad'],
  [/indore/gi, 'Indore'],
  [/philippines/gi, 'Philippines'],
]

const NON_INDIA_SIGNAL = /\b(?:united states|u\.s\.|usa|texas|plano,\s*tx|h1b)\b/i
const INDIA_SIGNAL = /\b(?:india|hyderabad|hyderbad|indore)\b/i

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&[a-z#0-9]+;/gi, (entity) => HTML_ENTITY_MAP.get(entity.toLowerCase()) ?? entity)

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const hasOfficialCareersShellSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*Ray Business Technologies Careers - Discover a World of Opportunities\s*<\/title>/i.test(page)
    && text.includes('search jobs')
    && text.includes('careers')
    && text.includes('current openings')
    && text.includes('working with us is not a job. it\'s a journey.')
}

export const hasTrustworthyPublicJobsSignal = (html = '') => {
  const text = normalizeWhitespace(html).toLowerCase()

  return (
    /\bapply now\b/.test(text)
    || /\bapply online\b/.test(text)
    || /\bclick to explore this job\b/.test(text)
    || /class=["'][^"']*job-card/i.test(String(html ?? ''))
    || /<div class="panel panel-default">[\s\S]*?<h4>[\s\S]*?<small>\s*Experience:/i.test(String(html ?? ''))
  )
}

const toSlug = (value) => String(value ?? '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const cleanTitle = (value) => normalizeWhitespace(value)
  .replace(/\s+/g, ' ')
  .trim()

const extractAccordionPanels = (html = '') => {
  const panelPattern = /<div class="panel panel-default">[\s\S]*?<h4>([\s\S]*?)<small>\s*Experience:\s*([\s\S]*?)\s*<\/small><\/h4>[\s\S]*?<div class="panel-body[^"]*">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi
  const panels = []
  let match

  while ((match = panelPattern.exec(String(html ?? ''))) !== null) {
    panels.push({
      title: cleanTitle(match[1]),
      experience: normalizeWhitespace(match[2]),
      body: normalizeWhitespace(match[3]),
    })
  }

  return panels
}

const normalizeLocation = (rawLocation = '') => {
  const normalized = decodeHtmlEntities(rawLocation)
    .replace(/[.]+$/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\(\s*work from office\s*\)/i, '')
    .replace(/\s*&\s*/g, '; ')
    .replace(/\s+\d+\+?\s*(?:years?|yrs?)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return ''

  let result = normalized
  for (const [pattern, replacement] of INDIA_CITY_NORMALIZATIONS) {
    result = result.replace(pattern, replacement)
  }

  if (/^indore$/i.test(result)) return 'Indore, India'
  if (/^hyderabad$/i.test(result)) return 'Hyderabad, India'
  if (/^hyderabad,\s*india$/i.test(result)) return 'Hyderabad, India'
  if (/^hyderabad,\s*india;\s*philippines$/i.test(result)) return 'Hyderabad, India; Philippines'

  return result
}

const extractLocation = (body = '') => {
  const text = normalizeWhitespace(body)
  const explicitMatch = text.match(/\blocation\s*[:\-]\s*(.+?)(?=\s+(?:experience|employment type|work mode|job responsibilities|about the role|role|we are looking|proven experience|apply online|\d+\+?\s*(?:years?|yrs?))\b|$)/i)
  if (explicitMatch) {
    return normalizeLocation(explicitMatch[1])
  }

  if (/\bindore\b/i.test(text)) return 'Indore, India'
  if (/\bhyderbad\b|\bhyderabad\b/i.test(text)) return 'Hyderabad, India'

  return ''
}

const isIndiaEligiblePanel = ({ title = '', body = '', location = '' }) => {
  if (NON_INDIA_SIGNAL.test(title) || NON_INDIA_SIGNAL.test(body) || NON_INDIA_SIGNAL.test(location)) {
    return false
  }

  return INDIA_SIGNAL.test(location) || INDIA_SIGNAL.test(body)
}

export const extractJobs = (html = '') => {
  return extractAccordionPanels(html)
    .map((panel) => {
      const location = extractLocation(panel.body)
      if (!isIndiaEligiblePanel({ ...panel, location })) {
        return null
      }

      const jobIdSuffix = location || 'india'
      const employmentTypeMatch = panel.body.match(/\bemployment type\s*:\s*([^.]+?)(?=\s+(?:role|about the role|job responsibilities|apply online)\b|$)/i)
      const employmentType = normalizeWhitespace(employmentTypeMatch?.[1] || 'Full-time')
      const postedAtMatch = panel.body.match(/\bposted\s*:\s*([a-z]+\s+\d{1,2},\s+\d{4})/i)

      return {
        title: panel.title,
        location,
        jobId: toSlug(`${panel.title}-${jobIdSuffix}`),
        applyUrl: APPLY_URL,
        sourceUrl: CAREERS_URL,
        companyCareerPage: CAREERS_URL,
        company: COMPANY,
        companyDomain: provider.companyDomain,
        atsPlatform: provider.atsPlatform,
        employmentType,
        experienceRequired: panel.experience,
        jobDescription: panel.body,
        postedAt: postedAtMatch?.[1] || undefined,
      }
    })
    .filter(Boolean)
}

export const run = async ({ fetchText = defaultFetchText } = {}) => {
  const html = await fetchText(CAREERS_URL)

  if (!hasOfficialCareersShellSignal(html)) {
    throw new Error('Ray Business Technologies verified careers shell no longer matches the trusted first-party surface')
  }

  if (!hasTrustworthyPublicJobsSignal(html)) {
    throw new Error('Ray Business Technologies careers page no longer exposes the verified public accordion openings')
  }

  return extractJobs(html)
}

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
