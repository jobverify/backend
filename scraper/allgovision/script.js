import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://www.allgovision.com/career.php'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&ndash;|&#8211;/gi, '-')
    .replace(/&mdash;|&#8212;/gi, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripComments = (html) => String(html ?? '').replace(/<!--[\s\S]*?-->/g, '')

const decodePanelText = (html) => normalizeWhitespace(html)

const extractPanelMetadata = (html, label) => {
  const match = String(html ?? '').match(
    new RegExp(`<strong>\\s*${label}\\s*:<\\/strong>\\s*([\\s\\S]*?)<br\\s*\\/?>\\s*<br\\s*\\/?>`, 'i'),
  )
  return normalizeWhitespace(match?.[1] || null)
}

const removeMetadataFields = (html) =>
  String(html ?? '')
    .replace(/<strong>\s*Position\s*:<\/strong>[\s\S]*?<br\s*\/?>\s*<br\s*\/?>/gi, '')
    .replace(/<strong>\s*Experience\s*:<\/strong>[\s\S]*?<br\s*\/?>\s*<br\s*\/?>/gi, '')
    .replace(/<strong>\s*Qualification\s*:<\/strong>[\s\S]*?<br\s*\/?>\s*<br\s*\/?>/gi, '')
    .replace(/<strong>\s*(?:Job\s+Location|Location)\s*:<\/strong>[\s\S]*?<br\s*\/?>\s*<br\s*\/?>/gi, '')
    .replace(/<strong>\s*Designation\s*:<\/strong>[\s\S]*?<br\s*\/?>\s*<br\s*\/?>/gi, '')

const extractListItemsAfterLabel = (html, label) => {
  const sectionMatch = String(html ?? '').match(
    new RegExp(`<p>\\s*<strong>\\s*${label}\\s*:?\\s*<\\/strong>\\s*<\\/p>\\s*<ul[^>]*>([\\s\\S]*?)<\\/ul>`, 'i'),
  )

  if (!sectionMatch) return []

  return [...sectionMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split(',')[0]?.trim() || null
}

const buildJobUrl = (collapseId) => {
  const normalized = normalizeWhitespace(collapseId)
  return normalized ? `${CAREER_PAGE_URL}#${normalized}` : CAREER_PAGE_URL
}

const toJobId = (headingId, collapseId) =>
  normalizeWhitespace(headingId) || normalizeWhitespace(collapseId) || null

const extractVisiblePanels = (html) => {
  const visibleHtml = stripComments(html)
  const pattern = /<div class="panel panel-default">[\s\S]*?<div class="panel-heading"[^>]*id="([^"]+)"[\s\S]*?<a[^>]*href="#([^"]+)"[^>]*>\s*Job Title:\s*([\s\S]*?)<\/a>[\s\S]*?<div id="\2" class="panel-collapse collapse">[\s\S]*?<div class="panel-body">([\s\S]*?)<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/gi

  return [...visibleHtml.matchAll(pattern)].map((match) => ({
    headingId: normalizeWhitespace(match[1]),
    collapseId: normalizeWhitespace(match[2]),
    titleText: normalizeWhitespace(match[3]),
    bodyHtml: match[4] || '',
  }))
}

export const extractSearchResults = (html) =>
  extractVisiblePanels(html)
    .map((panel) => {
      const position = extractPanelMetadata(panel.bodyHtml, 'Position')
      const experienceRequired = extractPanelMetadata(panel.bodyHtml, 'Experience')
      const minimumQualification = extractPanelMetadata(panel.bodyHtml, 'Qualification')
      const location = extractPanelMetadata(panel.bodyHtml, 'Job Location')
        || extractPanelMetadata(panel.bodyHtml, 'Location')
      const title = position || panel.titleText?.replace(/^Job Title:\s*/i, '') || null
      const requiredSkills = extractListItemsAfterLabel(panel.bodyHtml, 'Required Skills')
      const fallbackSkills = requiredSkills.length > 0
        ? requiredSkills
        : extractListItemsAfterLabel(panel.bodyHtml, 'Skills')
      const jobDescription = decodePanelText(removeMetadataFields(panel.bodyHtml))
      const jobUrl = buildJobUrl(panel.collapseId)
      const jobId = toJobId(panel.headingId, panel.collapseId)

      if (!title || !location || !jobId) return null

      return {
        title,
        company: 'AllGoVision',
        department: null,
        location: /india/i.test(location) ? location : `${location}, India`,
        city: extractCity(location),
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl: jobUrl,
        applyUrl: jobUrl,
        employmentType: null,
        experienceRequired,
        minimumQualification,
        preferredQualification: null,
        requiredSkills: fallbackSkills,
        postingDate: null,
        closingDate: null,
        jobDescription,
        remoteStatus: 'On-site',
      }
    })
    .filter(Boolean)

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'allgovision',
  timeoutMs: 15000,
})

const markUpstreamOutage = (error) => {
  if (/\bHTTP\s+5\d\d\b/i.test(String(error?.message || error))) {
    error.softFailure = true
    error.upstreamOutage = true
  }

  return error
}

const fetchTextOrThrowUpstream = async (fetchText, url) => {
  try {
    return await fetchText(url)
  } catch (error) {
    throw markUpstreamOutage(error)
  }
}

export const createAllgovisionScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const careersHtml = await fetchTextOrThrowUpstream(fetchText, CAREER_PAGE_URL)
    const jobs = extractSearchResults(careersHtml)
    const selectedJobs = maxJobs ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: 'allgovision',
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: new Date().toISOString(),
    }))
  },
})

export const run = async () => createAllgovisionScraper().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running AllGoVision scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'allgovision')
    console.log('DB result:', result)
    process.exit(0)
  }
}
