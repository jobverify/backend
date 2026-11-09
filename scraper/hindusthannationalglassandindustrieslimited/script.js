import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'hindusthannationalglassandindustrieslimited'
export const COMPANY = 'Hindusthan National Glass & Industries Limited'
export const HOMEPAGE_URL = 'https://www.hngil.com/'
export const CAREERS_URL = 'https://www.hngil.com/p/current-vacancies-1'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const OFFICIAL_SIGNALS = [
  'At HNG, we are always in search of talented individuals',
  'Download application form here, for job opportunities.',
  'Since HNGIL has recently been acquired by INSCO through the IBC process',
]

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')
  .replace(/\u00a0/g, ' ')

const normalizeWhitespace = (value) => decodeHtml(value)
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(String(value ?? ''))

const slugify = (value) => normalizeWhitespace(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return OFFICIAL_SIGNALS.every((signal) => normalized.includes(signal))
    && /<div class="cureent-vacancy-intro">/i.test(page)
    && /<div class="opeing-list(?:\s+mt-5)?">/i.test(page)
    && /<th[^>]*>\s*Designation\s*<\/th>/i.test(page)
    && /<th[^>]*>\s*Job Code\s*<\/th>/i.test(page)
    && /<a class="btn-view-details">View\/Download Detail<\/a>/i.test(page)
}

export const extractApplicationFormUrl = (html) => {
  const match = String(html ?? '').match(
    /<a\b[^>]*href=(["'])(.*?)\1[^>]*>\s*Download application form here, for job opportunities\.\s*<\/a>/i,
  )

  return match?.[2] ? new URL(match[2], CAREERS_URL).toString() : null
}

export const pageExposesMaterialActionLinkChange = (html) => {
  const page = String(html ?? '')

  if (extractApplicationFormUrl(page)) return true
  if (/<a\b[^>]*class="btn-view-details"[^>]*href=/i.test(page)) return true
  if (/<a\b[^>]*class="btn-view-details"[^>]*onclick=/i.test(page)) return true

  return false
}

const extractOpeningSectionHtml = (html) => {
  const match = String(html ?? '').match(
    /<section class="inside-body-section">([\s\S]*?)<\/section>/i,
  )

  if (!match) {
    throw new Error('HNG verified official current vacancies surface no longer exposes the expected jobs section')
  }

  return match[1]
}

export const extractVacancyRows = (html) => {
  const sectionHtml = extractOpeningSectionHtml(html)
  const sectionMatches = sectionHtml.matchAll(
    /<div class="opeing-list(?:\s+mt-5)?">([\s\S]*?)<\/table>[\s\S]*?<\/div>\s*<\/div>/gi,
  )

  const jobs = []

  for (const sectionMatch of sectionMatches) {
    const blockHtml = sectionMatch[1]
    const department = stripTags(blockHtml.match(/<h4>([\s\S]*?)<\/h4>/i)?.[1])
    const bodyMatch = blockHtml.match(/<tbody>([\s\S]*?)<\/tbody>/i)
    if (!department || !bodyMatch) continue

    for (const rowMatch of bodyMatch[1].matchAll(/<tr>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
        .map((match) => stripTags(match[1]))

      if (cells.length < 4) continue

      const [, title, requisitionId] = cells
      if (!title || !requisitionId) continue

      const slug = slugify(`${department}-${title}-${requisitionId}`)
      if (!slug) continue

      jobs.push({
        title,
        company: COMPANY,
        department,
        location: 'India',
        city: null,
        country: 'India',
        jobId: `${SOURCE}-${slug}`,
        requisitionId,
        sourceUrl: CAREERS_URL,
        applyUrl: CAREERS_URL,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: normalizeWhitespace(
          `Official ${COMPANY} opening for ${title} in ${department}. `
          + `Job code: ${requisitionId}. `
          + 'The current first-party vacancies page lists this role inline and does not expose a public detail or application-form URL in the markup.',
        ),
        publicExperienceChecked: true,
      })
    }
  }

  if (jobs.length === 0) {
    throw new Error('HNG verified official current vacancies surface no longer exposes parsable inline vacancy rows')
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

export const createHindusthanNationalGlassAndIndustriesLimitedScraper = () => ({
  async run({ fetchText = defaultFetchText, now = () => new Date().toISOString() } = {}) {
    const html = await fetchText(CAREERS_URL)

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('HNG verified official current vacancies surface changed')
    }

    if (pageExposesMaterialActionLinkChange(html)) {
      throw new Error('HNG current vacancies page now exposes a material action link change')
    }

    return extractVacancyRows(html).map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createHindusthanNationalGlassAndIndustriesLimitedScraper().run(options)

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
