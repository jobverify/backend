import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'lgbalakrishnanandbrosltd'
export const COMPANY = 'L.G.Balakrishnan & Bros Ltd'
export const HOMEPAGE_URL = 'https://www.lgb.co.in/'
export const CAREERS_URL = 'https://careers.lgbportal.co.in/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  decodeHtmlEntities(String(value ?? '')).replace(/<[^>]+>/g, ' '),
)

const escapeRegExp = (value) => String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractListItems = (html = '') => [...String(html ?? '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
  .map((match) => stripTags(match[1]))
  .filter(Boolean)

const buildAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const cleanTitle = (value) => normalizeWhitespace(String(value ?? '').replace(/\s+-\s*$/u, ''))

const inferCity = (location) => {
  const normalized = normalizeWhitespace(location)
  const cityMatch = normalized.match(/,\s*([A-Z ]+)-\d{6}$/)
  if (cityMatch) return cityMatch[1].trim()

  const trailingSegment = normalized.match(/([A-Z ]+)-\d{6}$/)
  return trailingSegment?.[1]?.trim() || null
}

const extractDivBlock = (html, startIndex) => {
  let depth = 0
  let cursor = startIndex

  while (cursor < html.length) {
    const nextOpen = html.indexOf('<div', cursor)
    const nextClose = html.indexOf('</div>', cursor)

    if (nextClose === -1) return null

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1
      cursor = nextOpen + 4
      continue
    }

    depth -= 1
    cursor = nextClose + 6

    if (depth === 0) {
      return html.slice(startIndex, cursor)
    }
  }

  return null
}

const extractListValuesAfterHeading = (html, heading) => {
  const match = String(html ?? '').match(
    new RegExp(
      `<h[56][^>]*>\\s*${escapeRegExp(heading)}\\s*<\\/h[56]>\\s*<\\/li>\\s*<ul[^>]*>([\\s\\S]*?)<\\/ul>`,
      'i',
    ),
  )

  if (!match) return []
  return extractListItems(match[1])
}

const normalizeExperience = (value) => normalizeWhitespace(value)?.replace(/\byears?\b/gi, 'years') || null

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*Home\s*-\s*L\.G\.Balakrishnan\s*&amp;\s*Bros Ltd\s*<\/title>/i.test(page)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']L\.G\.Balakrishnan\s*&amp;\s*Bros Ltd["']/i.test(page)
    && /href=["']https:\/\/careers\.lgbportal\.co\.in\/["'][^>]*>\s*Careers\s*<\/a>/i.test(page)
    && text.includes('A Heritage of 8 decades')
    && text.includes('LGB founded in 1937 as a Transport Operator')
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const text = stripTags(page)

  return /<title>\s*LGB Careers\s*<\/title>/i.test(page)
    && text.includes('Your LGB journey starts here')
    && text.includes("Use below Search to find the next step in your career. We can't wait to meet you.")
    && /class=["'][^"']*\bjob-card\b[^"']*["']/i.test(page)
    && /class=["'][^"']*\bapply-btn\b[^"']*["'][^>]*>\s*Apply Now\s*<\/a>/i.test(page)
    && /mailto:careers@lgb\.co\.in/i.test(page)
}

export const extractPublicJobs = (html) => {
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('L.G.Balakrishnan & Bros Ltd verified official careers portal no longer matches the known public surface')
  }

  const source = String(html ?? '')
  const jobs = []
  const starts = [...source.matchAll(/<div class="row job-card\b/gi)]

  for (const start of starts) {
    const blockHtml = extractDivBlock(source, start.index)
    if (!blockHtml) {
      throw new Error('L.G.Balakrishnan & Bros Ltd verified public job cards changed shape')
    }

    const title = cleanTitle(blockHtml.match(/<div class="col-lg-6 fw-bold">([\s\S]*?)<span class="mprf-no">/i)?.[1] ?? '')
    const jobId = normalizeWhitespace(blockHtml.match(/<span class="mprf-no">([^<]+)<\/span>/i)?.[1] ?? '')
    const rawLocation = normalizeWhitespace(blockHtml.match(/<div class="col-lg-6 job-address">([\s\S]*?)<\/div>/i)?.[1] ?? '')
    const applyUrl = buildAbsoluteUrl(
      blockHtml.match(/<a href="([^"]+)"[^>]*class="[^"]*\bapply-btn\b[^"]*"[^>]*>\s*Apply Now\s*<\/a>/i)?.[1] ?? null,
    )
    const city = inferCity(rawLocation)

    if (!title || !jobId || !rawLocation || !applyUrl) {
      throw new Error('L.G.Balakrishnan & Bros Ltd verified public job cards changed shape')
    }

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: `${rawLocation}, India`,
      city,
      country: 'India',
      jobId,
      requisitionId: jobId,
      sourceUrl: applyUrl,
      applyUrl,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    })
  }

  if (jobs.length === 0) {
    throw new Error('L.G.Balakrishnan & Bros Ltd careers portal no longer exposes the verified public job cards')
  }

  return jobs
}

export const extractPublicJobDetail = (html) => {
  const qualifications = extractListValuesAfterHeading(html, 'Qualifications')
  const requiredExperience = extractListValuesAfterHeading(html, 'Required Experience')[0] || null
  const descriptionMatch = String(html ?? '').match(
    /<h5>\s*Description\s*:\s*<\/h5>[\s\S]*?<div[^>]*>\s*<ul>([\s\S]*?)<\/ul>/i,
  )

  return {
    experienceRequired: normalizeExperience(requiredExperience),
    minimumQualification: qualifications.join(', ') || null,
    jobDescription: descriptionMatch
      ? extractListItems(descriptionMatch[1]).join(' ') || null
      : null,
  }
}

const enrichJobWithDetail = (job, detail) => ({
  ...job,
  experienceRequired: detail.experienceRequired || job.experienceRequired,
  minimumQualification: detail.minimumQualification || job.minimumQualification,
  jobDescription: detail.jobDescription || job.jobDescription,
})

const resolveHttpStatus = (error) => {
  const directStatus = Number(error?.status)
  if (Number.isFinite(directStatus)) return directStatus

  const causeStatus = Number(error?.cause?.status)
  if (Number.isFinite(causeStatus)) return causeStatus

  return null
}

const isUnavailableJobDetailError = (error) => {
  const status = resolveHttpStatus(error)
  return status === 400 || status === 404
}

export const enrichPublicJobs = async (jobs, fetchText = defaultFetchText) => {
  const enrichedJobs = await Promise.all(
    jobs.map(async (job) => {
      try {
        const detail = extractPublicJobDetail(await fetchText(job.applyUrl))
        return enrichJobWithDetail(job, detail)
      } catch (error) {
        if (isUnavailableJobDetailError(error)) {
          return null
        }

        throw error
      }
    }),
  )

  return enrichedJobs.filter(Boolean)
}

export const createLgbalakrishnanAndBrosLtdScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    const homepageHtml = await fetchText(HOMEPAGE_URL)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('L.G.Balakrishnan & Bros Ltd verified official homepage no longer matches the known public surface')
    }

    const careersHtml = await fetchText(CAREERS_URL)
    const jobs = await enrichPublicJobs(extractPublicJobs(careersHtml), fetchText)
    if (jobs.length === 0) {
      throw new Error('L.G.Balakrishnan & Bros Ltd careers portal no longer exposes any live public job apply pages')
    }

    return jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: (overrideNow || now)(),
      companyCareerPage: CAREERS_URL,
      companyDomain: 'lgb.co.in',
      atsPlatform: 'official-first-party-candidate-portal',
    }))
  },
})

export const run = async (options = {}) => createLgbalakrishnanAndBrosLtdScraper().run(options)

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
