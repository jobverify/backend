import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'permiso'
export const COMPANY = 'Permiso'
export const CAREERS_URL = 'https://permiso.io/careers'
export const OPENINGS_URL = 'https://permiso.io/careers/openings/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim() || null

const stripTags = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' '))

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const extractMetadataValue = (html, label) => {
  const match = String(html ?? '').match(new RegExp(`${label}:\\s*([^<\\n]+)`, 'i'))
  return normalizeWhitespace(match?.[1] ?? null)
}

const parsePostingDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized?.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2})$/)
  if (!match) return null

  const [, month, day, year] = match
  return `20${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)
  const prefix = normalized?.split(':')[0]?.trim()
  return prefix || normalized || null
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized || /\bremote\b/i.test(normalized)) return null
  return normalizeCity(normalized)
}

const isIndiaRole = (job) => /\bindia\b/i.test(job.location || '')

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /UNCORPORATE CAREERS ARE MORE FUN/i.test(page)
    && /Current Openings/i.test(page)
    && /href=["'][^"']*\/careers\/openings\/\??[^"']*["']/i.test(page)
}

export const hasOfficialOpeningsSignal = (html) => {
  const page = String(html ?? '')

  return /custom-job-opening-item/i.test(page)
    && /job-opening-form|hs_form_target_form_432811819/i.test(page)
    && /job-opening/i.test(page)
}

export const extractRoleCards = (html) => {
  const page = String(html ?? '')
  const jobs = []

  for (const match of page.matchAll(/<div class="custom-job-opening-item[\s\S]*?custom-job-opening-descrption-form">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/gi)) {
    const cardHtml = match[0]
    const title = stripTags(cardHtml.match(/custom-job-opening-title">([\s\S]*?)<\/h3>/i)?.[1])
    if (!title) continue

    const postingDate = parsePostingDate(
      stripTags(cardHtml.match(/custom-job-opening-date">([\s\S]*?)<\/div>/i)?.[1]?.replace(/^Date posted:\s*/i, '')),
    )
    const fallbackDepartment = stripTags(
      cardHtml.match(/custom-job-opening-catergory-item">([\s\S]*?)<\/span>/i)?.[1],
    )
    const descriptionHtml = cardHtml.match(/custom-job-opening-descrption-form">([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] || ''
    const location = extractMetadataValue(descriptionHtml, 'Location')
      || stripTags(cardHtml.match(/custom-job-opening-location">([\s\S]*?)<\/p>/i)?.[1]?.replace(/^Location:\s*/i, ''))
    const department = extractMetadataValue(descriptionHtml, 'Department') || fallbackDepartment
    const employmentType = normalizeEmploymentType(
      stripTags(cardHtml.match(/custom-job-opening-full-time">([\s\S]*?)<\/p>/i)?.[1]),
    )
    const descriptionLines = [...descriptionHtml.matchAll(/<p>([\s\S]*?)<\/p>/gi)]
      .map((lineMatch) => stripTags(lineMatch[1]))
      .filter(Boolean)
      .filter((line) => !/^Location:/i.test(line) && !/^Department:/i.test(line))

    jobs.push({
      title,
      department,
      location,
      city: deriveCity(location),
      employmentType,
      postingDate,
      jobDescription: descriptionLines.join(' ') || null,
      sourceUrl: OPENINGS_URL,
      applyUrl: OPENINGS_URL,
    })
  }

  return jobs
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createPermisoScraper = () => ({
  async run({ fetchText = defaultFetchText } = {}) {
    const careersHtml = await fetchText(CAREERS_URL)
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Permiso careers page no longer matches the verified official careers surface')
    }

    const openingsHtml = await fetchText(OPENINGS_URL)
    if (!hasOfficialOpeningsSignal(openingsHtml)) {
      throw new Error('Permiso openings page no longer matches the verified public openings surface')
    }

    return extractRoleCards(openingsHtml)
      .filter((job) => job.title && job.location && isIndiaRole(job))
      .map((job) => {
        const identitySlug = slugify(`${job.title}-${job.location}`)

        return {
          ...job,
          company: COMPANY,
          country: 'India',
          jobId: `${SOURCE}-${identitySlug}`,
          requisitionId: `${SOURCE}-${identitySlug}`,
          minimumQualification: null,
          preferredQualification: null,
          requiredSkills: [],
          closingDate: null,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: new Date().toISOString(),
        }
      })
  },
})

export const run = async (options = {}) => createPermisoScraper().run(options)

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
