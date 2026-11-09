import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { DOODLEBLUE_INNOVATION_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DOODLEBLUE_INNOVATION_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeText = (value = '') => String(value)
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => normalizeText(
  String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '',
)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialOpeningsSignal = (html = '') => {
  const rawHtml = String(html)
  const normalized = rawHtml.replace(/\s+/g, ' ')
  const normalizedText = normalizeText(rawHtml)
  const title = extractTitle(rawHtml)

  return (
    (
      title === 'Career at doodleblue | openings at chennai | doodleblue | India'
      || title === 'Careers at doodleblue | Current Job Openings'
    )
    && normalizedText.includes('Join our Team')
    && normalizedText.includes('Browse our open positions and pick the challenge that excites you the most')
    && (
      normalized.includes('/careers/openings/view/?position=')
      || normalized.includes('/careers/apply-now/')
    )
  )
}

const extractSharedApplyUrl = (html = '') => {
  const match = String(html).match(/<a[^>]*href=["']([^"']*\/careers\/apply-now\/[^"']*)["'][^>]*>\s*Apply Now\s*<\/a>/i)
  return match ? new URL(match[1], CAREERS_URL).toString() : null
}

const parseMetaLine = (value = '') => {
  const normalized = normalizeText(value)
  const match = normalized.match(/^(.*?India)\s+(Full time)\s+(experienced)$/i)

  if (!match) {
    return { location: normalized, employmentType: null, seniority: null }
  }

  return {
    location: match[1],
    employmentType: match[2],
    seniority: match[3],
  }
}

const extractJobsFromCurrentRoleRows = (html = '') => {
  const jobs = []
  const rowPattern = /<div\b(?=[^>]*class=["'][^"']*\btitle\b[^"']*\brow\b[^"']*\balign-items-center\b[^"']*["'])[^>]*>[\s\S]*?<h2>([\s\S]*?)<\/h2>[\s\S]*?<h4>([\s\S]*?)<\/h4>[\s\S]*?<a[^>]*href=["']([^"']*\/careers\/openings\/view\/\?position=[^"']*)["'][^>]*>/gi

  for (const match of String(html).matchAll(rowPattern)) {
    const title = normalizeText(match[1])
    const meta = parseMetaLine(match[2])
    const detailUrl = new URL(match[3], CAREERS_URL).toString()

    if (!title || !meta.location || !detailUrl) {
      continue
    }

    jobs.push({
      title,
      location: meta.location,
      employmentType: meta.employmentType,
      seniority: meta.seniority,
      detailUrl,
      applyUrl: detailUrl,
    })
  }

  return jobs
}

export const parseOpenings = (html = '') => {
  const currentRoleJobs = extractJobsFromCurrentRoleRows(html)
  if (currentRoleJobs.length > 0) {
    return currentRoleJobs
  }

  const applyUrl = extractSharedApplyUrl(html)
  const jobs = []
  const articlePattern = /<article\b[^>]*class=["'][^"']*opening-card[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi
  let articleMatch

  while ((articleMatch = articlePattern.exec(String(html)))) {
    const block = articleMatch[1]
    const titleMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)
    const metaMatch = block.match(/<p[^>]*class=["'][^"']*meta[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)

    if (!titleMatch || !metaMatch || !applyUrl) {
      continue
    }

    const meta = parseMetaLine(metaMatch[1])
    jobs.push({
      title: normalizeText(titleMatch[1]),
      location: meta.location,
      employmentType: meta.employmentType,
      seniority: meta.seniority,
      detailUrl: applyUrl,
      applyUrl,
    })
  }

  return jobs
}

export const createDoodleblueInnovationScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const html = await fetchText(CAREERS_URL)
    if (!hasOfficialOpeningsSignal(html)) {
      throw new Error('The verified doodleblue openings page no longer matches the trusted first-party contract')
    }

    const jobs = parseOpenings(html)
    if (jobs.length === 0) {
      throw new Error('The verified doodleblue openings page no longer exposes parseable role cards')
    }

    return jobs
  },
})

export const run = async (options = {}) => createDoodleblueInnovationScraper().run(options)

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
