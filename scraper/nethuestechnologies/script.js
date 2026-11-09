import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'nethuestechnologies'
export const COMPANY = 'Nethues Technologies'
export const CAREER_PAGE_URL = 'https://www.nethues.com/careers/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|ul|ol|small|span|strong|b)>/gi, ' ')
    .replace(/<li\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&#8211;/gi, '-')
    .replace(/[Â]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeTitle = (value) => normalizeWhitespace(value)?.replace(/\s{2,}/g, ' ') || null

const MONTHS = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
}

const parsePostedOnDate = (value) => {
  const normalized = normalizeWhitespace(value)?.replace(/^Posted On\s+/i, '')
  if (!normalized) return null

  const match = normalized.match(/^(\d{1,2})\s+([A-Za-z]+),\s+(\d{4})$/)
  if (!match) return null

  const [, day, monthName, year] = match
  const month = MONTHS[monthName.toLowerCase()]
  if (!month) return null

  return `${year}-${month}-${day.padStart(2, '0')}`
}

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  const parenMatch = normalized.match(/\(([^)]+)\)/)
  if (parenMatch) return normalizeWhitespace(parenMatch[1])
  return normalizeWhitespace(normalized.split(',')[0])
}

const buildSectionMap = (html) => {
  const sections = new Map()
  const content = String(html ?? '')
  const matches = [...content.matchAll(/<div class="positions (list\d+)\s*[^"]*">/gi)]

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    const sectionId = normalizeWhitespace(match[1])
    const blockStart = match.index + match[0].length
    const blockEnd = index + 1 < matches.length
      ? matches[index + 1].index
      : content.indexOf('</div>\n</div>\n    </div>', blockStart)
    const block = content.slice(blockStart, blockEnd > -1 ? blockEnd : undefined)
    if (!sectionId) continue

    sections.set(sectionId, {
      title: normalizeTitle(block.match(/<strong class="blockTxt">([\s\S]*?)<\/strong>/i)?.[1]),
      location: normalizeWhitespace(
        block.match(/<strong class="blockTxt">[\s\S]*?<\/strong>\s*([\s\S]*?)<small/i)?.[1],
      ),
      postingDate: parsePostedOnDate(
        block.match(/<span class="posdate">([\s\S]*?)<\/span>/i)?.[1] || null,
      ),
      bodyHtml: block.match(/<div class="pos_description">([\s\S]*?)$/i)?.[1] || '',
    })
  }

  return sections
}

const extractSummaryCards = (html) =>
  [...String(html ?? '').matchAll(/<div class="posnav_header[^"]*" id="(list\d+)">[\s\S]*?<strong class="blockTxt">([\s\S]*?)<\/strong>\s*([\s\S]*?)<br>[\s\S]*?<small>([\s\S]*?)<\/small>/gi)]
    .map((match) => ({
      sectionId: normalizeWhitespace(match[1]),
      title: normalizeTitle(match[2]),
      location: normalizeWhitespace(match[3]),
      postingDate: parsePostedOnDate(match[4]),
    }))

const extractDescription = (html) =>
  normalizeWhitespace(
    String(html ?? '')
      .replace(/<p><strong>\s*Minimum Experience:\s*<\/strong>[\s\S]*?<\/p>/gi, '')
      .replace(/<p>&nbsp;<\/p>/gi, ''),
  )

const extractExperience = (html) =>
  normalizeWhitespace(
    String(html ?? '').match(/<p><strong>\s*Minimum Experience:\s*<\/strong>\s*([\s\S]*?)<\/p>/i)?.[1]
      || null,
  )

const buildApplyUrl = () => new URL('#applyNow', CAREER_PAGE_URL).toString()
const buildSourceUrl = (sectionId) => new URL(`#${sectionId}`, CAREER_PAGE_URL).toString()

export const extractSearchResults = (html) => {
  const sections = buildSectionMap(html)

  return extractSummaryCards(html)
    .map((card) => {
      const details = sections.get(card.sectionId)
      if (!card.sectionId || !card.title || !card.location || !details) return null

      return {
        title: card.title,
        company: COMPANY,
        department: null,
        location: `${card.location}, India`,
        city: extractCity(card.location),
        state: null,
        country: 'India',
        jobId: card.sectionId,
        requisitionId: card.sectionId,
        sourceUrl: buildSourceUrl(card.sectionId),
        applyUrl: buildApplyUrl(),
        employmentType: null,
        experienceRequired: extractExperience(details.bodyHtml),
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: details.postingDate || card.postingDate,
        closingDate: null,
        jobDescription: extractDescription(details.bodyHtml),
        remoteStatus: 'On-site',
      }
    })
    .filter(Boolean)
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createNethuesTechnologiesScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const jobs = extractSearchResults(await fetchText(CAREER_PAGE_URL))
    const selectedJobs = Number.isFinite(maxJobs) ? jobs.slice(0, maxJobs) : jobs
    const scrapedAt = (overrideNow || now)()

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt,
    }))
  },
})

export const run = async (options = {}) => createNethuesTechnologiesScraper(options).run(options)

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
