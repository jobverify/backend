import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { STERLING_SOFTWARE_PRIVATE_LIMITED_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = STERLING_SOFTWARE_PRIVATE_LIMITED_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const extractHtmlComments = (html = '') => [...String(html ?? '').matchAll(/<!--([\s\S]*?)-->/g)]
  .map((match) => match[1])

const extractActiveJobListTitles = (html = '') => {
  const page = String(html ?? '').replace(/<!--[\s\S]*?-->/g, '')
  const match = page.match(/var\s+joblist\s*=\s*\[([\s\S]*?)\]/i)
  if (!match?.[1]) return []

  return [...match[1].matchAll(/'([^']+)'|"([^"]+)"/g)]
    .map((titleMatch) => normalizeWhitespace(titleMatch[1] || titleMatch[2]))
    .filter(Boolean)
}

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const toAbsoluteUrl = (value) => {
  try {
    return new URL(String(value ?? ''), CAREERS_URL).href
  } catch {
    return null
  }
}

const parsePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const parsed = new Date(`${normalized} UTC`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
}

export const hasVerifiedCareersSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Career\s*\|\s*Sterling\s*\|\s*Financial Technology\.\s*Digital\.\s*Consulting\s*<\/title>/i.test(page)
    && normalized.includes('Work at Sterling')
    && normalized.includes('Current Opening')
    && normalized.includes('stimulating work environment')
    && normalized.includes('Careers')
  }

export const hasOnlyCommentedHistoricalOpenings = (html = '') => {
  const page = String(html ?? '')
  const withoutComments = page.replace(/<!--[\s\S]*?-->/g, '')
  const comments = extractHtmlComments(page).join(' ')

  const hasCommentedRows = /Application Engineer/i.test(comments)
    && /Chennai/i.test(comments)
    && /View more/i.test(comments)

  const exposesLiveRows = /Application Engineer/i.test(withoutComments)
    || /Java/i.test(withoutComments)
    || /View more/i.test(withoutComments)

  return hasCommentedRows && !exposesLiveRows
}

export const extractLiveOpeningRows = (html = '') => {
  const parseRows = (page) => {
    const rows = []

    for (const match of page.matchAll(/<tr[\s\S]*?>([\s\S]*?)<\/tr>/gi)) {
      const rowHtml = match[1]
      const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
        .map((cellMatch) => normalizeWhitespace(cellMatch[1]))
        .filter(Boolean)
      const href = rowHtml.match(/<a[^>]+href=["']([^"']+)["'][^>]*>\s*View more\s*<\/a>/i)?.[1]
      const detailUrl = toAbsoluteUrl(href)

      if (cells.length < 6 || !detailUrl) continue

      const [title, requisitionId, experienceRequired, postingDateRaw, , city] = cells
      if (!title || !city) continue

      rows.push({
        title,
        requisitionId: requisitionId || null,
        experienceRequired: experienceRequired || null,
        postingDate: parsePostingDate(postingDateRaw),
        city,
        location: `${city}, India`,
        country: 'India',
        detailUrl,
      })
    }

    return rows
  }

  const page = String(html ?? '')
  const visiblePage = page.replace(/<!--[\s\S]*?-->/g, '')
  const activeTitles = new Set(extractActiveJobListTitles(page).map((title) => title.toLowerCase()))
  const visibleRows = parseRows(visiblePage)
  const commentedRows = parseRows(extractHtmlComments(page).join('\n'))
  const candidates = [...visibleRows, ...commentedRows]
  const filteredRows = activeTitles.size === 0
    ? candidates
    : candidates.filter((row) => activeTitles.has(row.title.toLowerCase()))

  return filteredRows.filter((row, index, rows) =>
    rows.findIndex((candidate) => candidate.detailUrl === row.detailUrl) === index)
}

const extractSectionItems = (html = '', heading) => {
  const match = String(html ?? '').match(
    new RegExp(`<ul class=["']app-inner["'][\\s\\S]*?<h4>\\s*${escapeRegExp(heading)}\\s*<\\/h4>([\\s\\S]*?)<\\/ul>`, 'i'),
  )
  if (!match?.[1]) return []

  return [...match[1].matchAll(/<li[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi)]
    .map((itemMatch) => normalizeWhitespace(itemMatch[1]))
    .filter(Boolean)
}

export const extractOpeningDetail = (html = '', detailUrl) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)
  const title = normalizeWhitespace(
    page.match(/<title>\s*([\s\S]*?)\s*\|\s*Sterling\s*\|\s*Financial Technology\.?\s*Digital\.?\s*Consulting\s*<\/title>/i)?.[1],
  )
  const city = normalizeWhitespace(
    page.match(/<span class=["']loc["']>\s*(?:Location:\s*)?([^<]+)<\/span>/i)?.[1],
  )
  const responsibilities = extractSectionItems(page, 'Job Responsibilities')
  const keySkills = extractSectionItems(page, 'Key Skills & Experience')
  const desiredSkills = extractSectionItems(page, 'Desired Skills')
  const education = extractSectionItems(page, 'Education')

  if (!normalized.includes('Apply now') || !title || !city || responsibilities.length === 0) {
    return null
  }

  const descriptionParts = [
    responsibilities.length > 0 ? `Job Responsibilities: ${responsibilities.join(' ')}` : null,
    keySkills.length > 0 ? `Key Skills & Experience: ${keySkills.join(' ')}` : null,
    desiredSkills.length > 0 ? `Desired Skills: ${desiredSkills.join(' ')}` : null,
    education.length > 0 ? `Education: ${education.join(' ')}` : null,
  ].filter(Boolean)

  return {
    title,
    city,
    location: `${city}, India`,
    country: 'India',
    minimumQualification: education.join(' ') || null,
    jobDescription: descriptionParts.join(' '),
    detailUrl,
  }
}

export const createSterlingSoftwarePrivateLimitedScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    now = () => new Date().toISOString(),
  } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasVerifiedCareersSignal(careersHtml)) {
      throw new Error('The verified Sterling careers page no longer matches the trusted first-party surface')
    }

    if (hasOnlyCommentedHistoricalOpenings(careersHtml)) {
      return []
    }

    const openings = extractLiveOpeningRows(careersHtml)
    if (openings.length === 0) {
      throw new Error('The verified Sterling careers page no longer exposes parseable public openings')
    }

    const jobs = []

    for (const opening of openings) {
      const detailHtml = await fetchText(opening.detailUrl)
      const detail = extractOpeningDetail(detailHtml, opening.detailUrl)

      if (!detail) {
        throw new Error(`The Sterling opening detail page no longer matches the trusted public surface: ${opening.detailUrl}`)
      }

      jobs.push({
        title: detail.title,
        company: COMPANY,
        department: null,
        location: detail.location,
        city: detail.city,
        state: null,
        country: detail.country,
        jobId: opening.requisitionId || detail.title,
        requisitionId: opening.requisitionId,
        sourceUrl: detail.detailUrl,
        applyUrl: detail.detailUrl,
        employmentType: null,
        experienceRequired: opening.experienceRequired,
        minimumQualification: detail.minimumQualification,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: opening.postingDate,
        closingDate: null,
        jobDescription: detail.jobDescription,
        remoteStatus: 'On-site',
        source: SOURCE,
        link: detail.detailUrl,
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createSterlingSoftwarePrivateLimitedScraper().run(options)

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
