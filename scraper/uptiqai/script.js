import path from 'node:path'
import { fileURLToPath } from 'node:url'


import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const CAREERS_URL = 'https://www.uptiq.ai/careers'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const OFFICIAL_BRAND_PATTERN = /<title>\s*Careers at Uptiq\s*\|\s*Join AI in Financial Services\s*<\/title>/i
const CAREERS_PAGE_PATTERN = /Careers at Uptiq/i
const ROLE_FAMILY_PATTERN = /Open Roles - USA & India/i
const CAREER_FORM_PATTERN = /mailto:careers@uptiq\.ai/i
const PUBLIC_JOB_BOARD_PATTERN =
  /jobs\.lever\.co|boards\.greenhouse\.io|ashbyhq\.com|workable\.com|smartrecruiters|job-boards\.greenhouse\.io|myworkdayjobs|job openings\/search|\/jobs\/[a-z0-9-]+/i
const APPLICATION_CTA_PATTERN = /^View (?:job|role)\/Apply$/i

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return OFFICIAL_BRAND_PATTERN.test(page)
    && CAREERS_PAGE_PATTERN.test(page)
    && ROLE_FAMILY_PATTERN.test(page)
    && CAREER_FORM_PATTERN.test(page)
}

export const hasPublicJobBoardSignal = (html) => PUBLIC_JOB_BOARD_PATTERN.test(String(html ?? ''))

const plainText = value => String(value ?? '').replace(/<[^>]+>/g, ' ')
  .replace(/&quot;/gi, '"').replace(/&#x([a-f0-9]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&amp;/gi, '&').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()

const extractPositionsSection = html => {
  const opening = /<section\b[^>]*id=["']Positions["'][^>]*>/i.exec(html)
  if (!opening) return null
  const tags = /<\/?section\b[^>]*>/gi
  tags.lastIndex = opening.index + opening[0].length
  let depth = 1, tag
  while ((tag = tags.exec(html))) {
    depth += /^<\//.test(tag[0]) ? -1 : 1
    if (depth === 0) return html.slice(opening.index + opening[0].length, tag.index)
  }
  throw new Error('Uptiq incomplete Positions section')
}

const hasCurrentPositions = html => /<section\b[^>]*id=["']Positions["']/i.test(html)

export const extractSearchResults = (html = '') => {
  if (!hasCurrentPositions(html)) return []
  const page = String(html)
  const section = extractPositionsSection(page)
  const form = page.match(/<form\b[^>]*id=["']wf-form-Career-Form["'][^>]*>[\s\S]*?<\/form>/i)?.[0]
  const pageId = form?.match(/data-wf-page-id=["']([^"']+)["']/i)?.[1]
  if (!section || !form || !pageId || !/type=["']file["']/i.test(form) || !/type=["']email["']/i.test(form)) {
    throw new Error('Uptiq current career application form is unavailable')
  }
  const applicationLinks = [...section.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)]
    .filter(match => APPLICATION_CTA_PATTERN.test(plainText(match[1])))
  const cards = [...section.matchAll(/<div\b[^>]*class=["'](?:[^"']*\s)?position-card(?:\s[^"']*)?["'][^>]*>/gi)]
  const titles = [...section.matchAll(/<h3\b[^>]*class=["'][^"']*\bposition-card-title\b[^"']*["'][^>]*>/gi)]
  if (!cards.length || cards.length !== titles.length || cards.length !== applicationLinks.length || /w-pagination-next|rel=["']next["']/i.test(section)) throw new Error('Uptiq incomplete current role listing')
  const jobs = cards.map((card, index) => {
    const block = section.slice(card.index + card[0].length, cards[index + 1]?.index ?? section.length)
    const title = plainText(block.match(/<h3\b[^>]*class=["'][^"']*\bposition-card-title\b[^"']*["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1])
    const description = plainText(block.match(/<div\b[^>]*class=["']position-card-text["'][^>]*>([\s\S]*?)<\/div>/i)?.[1])
    const tags = [...block.matchAll(/<div\b[^>]*class=["']position-card-tag["'][^>]*>([\s\S]*?)(?=<div\b[^>]*class=["']position-card-tag["']|<a\b)/gi)]
    const locationFields = [...String(tags[1]?.[1] ?? '').matchAll(/<div>([^<]+)<\/div>/gi)].map(match => plainText(match[1]))
    const location = locationFields[0]
    let target
    try { target = JSON.parse(plainText(block.match(/<a\b[^>]*data-wf-target="([^"]+)"/i)?.[1]))?.[0]?.[0] } catch {}
    const applicationLabel = plainText(block.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1])
    if (!title || !description || !location || tags.length !== 2 || target?.[0] !== pageId || !/^[a-f0-9-]{36}$/i.test(target?.[1] || '') || !APPLICATION_CTA_PATTERN.test(applicationLabel)) throw new Error('Uptiq incomplete current role card')
    const india = /^(?:India|Pune(?:,\s*Maharashtra)?(?:,\s*India)?)$/i.test(location)
    const applyUrl = CAREERS_URL + '#Positions'
    return { title, company: 'Uptiq.ai', source: 'uptiqai', jobId: target[1], requisitionId: target[1],
      department: plainText(tags[0][1]), location, country: india ? 'India' : null,
      employmentType: /^(?:full|part)[- ]time$/i.test(locationFields[1] || '') ? locationFields[1] : null,
      experienceRequired: /years?/i.test(locationFields[1] || '') ? locationFields[1] : null,
      sourceUrl: applyUrl, applyUrl, link: applyUrl, applicationUrlIsGeneric: true,
      jobDescription: description, scrapedAt: new Date().toISOString() }
  })
  if (new Set(jobs.map(job => job.jobId)).size !== jobs.length) throw new Error('Uptiq incomplete duplicate role identity')
  if (jobs.some(job => !job.country)) for (const job of jobs) job.sourceListingComplete = false
  return jobs
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'uptiqai',
  timeoutMs: 15000,
})

export const createUptiqAiScraper = () => ({
  async run({ fetchText = defaultFetchText, signal } = {}) {
    signal?.throwIfAborted()
    let html
    try { html = await fetchText(CAREERS_URL, { signal }) }
    finally { signal?.throwIfAborted() }

    if (hasCurrentPositions(html) && OFFICIAL_BRAND_PATTERN.test(html)) {
      const jobs = extractSearchResults(html)
      const verifiedJobs = jobs.filter(job => job.country === 'India')
      if (!verifiedJobs.length) throw new Error('Uptiq incomplete country scope: no verified India roles')
      return verifiedJobs
    }

    if (!hasOfficialCareersSignal(html)) {
      throw new Error('Uptiq.ai careers page no longer matches the verified email-apply public surface')
    }

    if (hasPublicJobBoardSignal(html)) {
      throw new Error('Uptiq.ai careers page now appears to expose a public job board')
    }

    return extractSearchResults(html)
  },
})

export const run = async (options = {}) => createUptiqAiScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, 'uptiqai')
  }
}
