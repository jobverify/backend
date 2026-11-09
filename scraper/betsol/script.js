import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import { BETSOL_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const BOARD_URL = PROVIDER_METADATA.boardUrl
export const API_URL = 'https://api.smartrecruiters.com/v1/companies/Betsol/postings'
export { PROVIDER_METADATA }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/&amp;/gi, '&')
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

const defaultFetchJson = (url) => fetchJsonWithRetry(url, {
  headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  label: SOURCE,
  timeoutMs: 15000,
})

export const getCurrentBoardCount = (html) => {
  const page = String(html ?? '')
  if (!/<title[^>]*>\s*Careers at BETSOL\s*<\/title>/i.test(page)
    || !/Jobs at Betsol LLC/i.test(page)
    || !/jobs\.smartrecruiters\.com\/Betsol\//i.test(page)) return null
  const counts = [...page.matchAll(/<section\b[^>]*data-qty="(\d+)"[^>]*class="[^"]*openings-section/gi)]
    .map((match) => Number(match[1]))
  return counts.length ? counts.reduce((total, count) => total + count, 0) : null
}

const hasBetsolIdentity = (posting) =>
  posting?.company?.identifier === 'BETSOL' && posting?.company?.name === 'BETSOL'

const getPostingUrl = (value, id) => {
  try {
    const url = new URL(value)
    if (url.hostname !== 'jobs.smartrecruiters.com'
      || !new RegExp(`^/BETSOL/${id}(?:-|$)`, 'i').test(url.pathname)) return null
    return url.toString()
  } catch {
    return null
  }
}

const runCurrentBoard = async ({ boardCount, fetchJson, now }) => {
  const limit = 100
  const first = await fetchJson(`${API_URL}?limit=${limit}&offset=0`)
  const total = first?.totalFound
  if (first?.offset !== 0 || first?.limit !== limit || !Number.isInteger(total)
    || total !== boardCount || total > 1000 || !Array.isArray(first?.content)) {
    throw new Error('BETSOL board and SmartRecruiters inventory counts disagree')
  }
  const postings = [...first.content]
  for (let offset = limit; offset < total; offset += limit) {
    const page = await fetchJson(`${API_URL}?limit=${limit}&offset=${offset}`)
    if (page?.offset !== offset || page?.limit !== limit || page?.totalFound !== total
      || !Array.isArray(page.content)) {
      throw new Error('BETSOL SmartRecruiters inventory page is incomplete')
    }
    postings.push(...page.content)
  }
  if (postings.length !== total || new Set(postings.map((posting) => posting?.id)).size !== total
    || postings.some((posting) => !hasBetsolIdentity(posting) || posting.visibility !== 'PUBLIC')) {
    throw new Error('BETSOL SmartRecruiters inventory is incomplete or changed identity')
  }
  const indiaPostings = postings.filter((posting) => posting.location?.country?.toLowerCase() === 'in')
  const jobs = []
  for (const posting of indiaPostings) {
    const detail = await fetchJson(`${API_URL}/${posting.id}`)
    const sourceUrl = getPostingUrl(detail?.postingUrl, posting.id)
    const applyUrl = getPostingUrl(detail?.applyUrl, posting.id)
    const title = normalizeWhitespace(detail?.name)
    const city = normalizeWhitespace(detail?.location?.city)
    const fullLocation = normalizeWhitespace(detail?.location?.fullLocation)
    if (!hasBetsolIdentity(detail) || detail.id !== posting.id || detail.active !== true
      || detail.visibility !== 'PUBLIC' || detail.location?.country?.toLowerCase() !== 'in'
      || !sourceUrl || !applyUrl || !title || !city || !/india/i.test(fullLocation)) {
      throw new Error(`BETSOL SmartRecruiters inventory has invalid India posting ${posting.id}`)
    }
    const sections = detail.jobAd?.sections ?? {}
    jobs.push({
      title,
      company: COMPANY,
      department: normalizeWhitespace(detail.department?.label) || null,
      location: fullLocation,
      city,
      state: normalizeWhitespace(detail.location.region) || null,
      country: 'India',
      jobId: posting.id,
      requisitionId: normalizeWhitespace(detail.refNumber) || posting.id,
      sourceUrl,
      applyUrl,
      employmentType: normalizeWhitespace(detail.typeOfEmployment?.label) || null,
      experienceLevel: normalizeWhitespace(detail.experienceLevel?.label) || null,
      postingDate: detail.releasedDate?.slice(0, 10) || null,
      jobDescription: normalizeWhitespace([sections.jobDescription?.text, sections.qualifications?.text].filter(Boolean).join(' ')) || null,
      source: SOURCE,
      link: applyUrl,
      scrapedAt: now(),
    })
  }
  return jobs.sort((left, right) => left.title.localeCompare(right.title) || left.jobId.localeCompare(right.jobId))
}

export const hasVerifiedBoardSignal = (html) => {
  const normalized = normalizeWhitespace(html)
  return /<title[^>]*>\s*Careers at BETSOL\s*<\/title>/i.test(String(html ?? ''))
    && normalized.includes('Jobs at Betsol LLC')
    && normalized.includes('Bengaluru, India')
    && /https:\/\/jobs\.smartrecruiters\.com\/Betsol\//i.test(String(html ?? ''))
    && (/href="https:\/\/www\.betsol\.com\/"/i.test(String(html ?? ''))
      || normalized.includes('Home Page'))
}

export const extractBoardJobs = (html) =>
  Array.from(
    String(html ?? '').matchAll(
      /<section[^>]*class="openings-section[^"]*">([\s\S]*?)<\/section>/gi,
    ),
    (sectionMatch) => {
      const sectionHtml = sectionMatch[1]
      const location = normalizeWhitespace(
        sectionHtml.match(/<h3[^>]*>([^<]+)<\/h3>/i)?.[1],
      )
      if (!location) {
        return []
      }

      return Array.from(
        sectionHtml.matchAll(
          /<a href="([^"]+jobs\.smartrecruiters\.com\/Betsol\/([^"]+))"[^>]*>[\s\S]*?<h4[^>]*>([^<]+)<\/h4>[\s\S]*?<span[^>]*>([^<]+)<\/span>/gi,
        ),
        (jobMatch) => ({
          title: normalizeWhitespace(jobMatch[3]),
          jobId: normalizeWhitespace(jobMatch[2]),
          experienceLevel: normalizeWhitespace(jobMatch[4]) || null,
          location,
          city: normalizeWhitespace(location.split(',')[0]) || null,
          country: normalizeWhitespace(location.split(',')[1]) || null,
          applyUrl: jobMatch[1],
          sourceUrl: jobMatch[1],
          link: jobMatch[1],
        }),
      )
    },
  )
    .flat()
    .filter((job) => job.title && job.jobId)

export const createBetsolScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson } = {}) {
    const boardHtml = await fetchText(BOARD_URL)
    const currentBoardCount = getCurrentBoardCount(boardHtml)
    if (currentBoardCount !== null) {
      return runCurrentBoard({ boardCount: currentBoardCount, fetchJson, now })
    }
    if (!hasVerifiedBoardSignal(boardHtml)) {
      throw new Error('BETSOL SmartRecruiters board changed materially')
    }

    return extractBoardJobs(boardHtml)
      .filter((job) => /india/i.test(job.location))
      .sort((left, right) => left.title.localeCompare(right.title))
      .map((job) => ({
        title: job.title,
        company: COMPANY,
        location: job.location,
        city: job.city,
        country: job.country,
        jobId: job.jobId,
        sourceUrl: job.sourceUrl,
        applyUrl: job.applyUrl,
        experienceLevel: job.experienceLevel,
        jobDescription: null,
        source: SOURCE,
        link: job.link,
        scrapedAt: now(),
      }))
  },
})

export const run = async (options = {}) => createBetsolScraper(options).run(options)

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
