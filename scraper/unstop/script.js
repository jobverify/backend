import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { hydrateSourceDescriptions } from '../../scraper-support/utils/sourceDescriptionHydration.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'unstop'
export const COMPANY = 'Unstop'
export const VERIFIED_ON = '2026-07-25'
export const CAREERS_PAGE_URL = 'https://unstop.com/about/unstop-careers/amp'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;|&#038;/gi, '&')
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = (url, { signal } = {}) => fetchTextWithRetry(url, {
    signal, attempts: 1, timeoutMs: 15000, includeResponseMetadata: true,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

export const hasTrustedCareersSignal = (html = '') => {
  const page = String(html ?? '')
  return /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/unstop\.com\/about\/unstop-careers["']/i.test(page)
    && /Opportunities at Unstop/i.test(normalizeWhitespace(page))
    && /https:\/\/unstop\.com\/jobs\/[^"']+-unstop-\d+/i.test(page)
}

const trustedJobUrl = (value) => {
  try {
    const url = new URL(value, CAREERS_PAGE_URL)
    if (url.protocol !== 'https:' || url.host !== 'unstop.com' || url.username || url.password
      || !/^\/jobs\/[^/]+-unstop-\d+$/i.test(url.pathname)) return null
    return url.origin + url.pathname
  } catch {
    return null
  }
}

const attribute = (tag, name) => tag.match(new RegExp('\\b' + name + '\\s*=\\s*["\']([^"\']*)["\']', 'i'))?.[1] || ''
const divContent = (html, opening) => {
  const tags = /<\/?div\b[^>]*>/gi
  tags.lastIndex = opening.index
  let depth = 0, start
  for (let tag; (tag = tags.exec(html));) {
    if (/^<\/div/i.test(tag[0])) {
      if (--depth === 0) return html.slice(start, tag.index)
    } else { if (depth++ === 0) start = tags.lastIndex }
  }
  return null
}

const visibleDeadline = html => {
  const opening = [...html.matchAll(/<div\b[^>]*>/gi)].find(tag => attribute(tag[0], 'id') === 'dates-tab')
  if (!opening) return null
  const text = normalizeWhitespace(divContent(html, opening))
  const match = text.match(/\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)['’](\d{2}),\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s+IST\b/i)
  if (!match) return new Date(NaN)
  const [, dayText, monthText, yearText, hourText, minuteText, period] = match
  const year = 2000 + Number(yearText), month = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(monthText.toLowerCase())
  const day = Number(dayText), hour = Number(hourText), minute = Number(minuteText)
  if (day < 1 || day > new Date(Date.UTC(year, month + 1, 0)).getUTCDate() || hour < 1 || hour > 12 || minute > 59) return new Date(NaN)
  return new Date(Date.UTC(year, month, day, hour % 12 + (period.toLowerCase() === 'pm' ? 12 : 0), minute) - 330 * 60000)
}

export function recoverUnstopRoleDescription(job, response, { now = new Date() } = {}) {
  const link = trustedJobUrl(job.sourceUrl || job.link || job.applyUrl)
  if (!link || response?.status !== 200 || response?.url !== link + '/amp'
    || typeof response.html !== 'string' || response.html.length > 2000000 || !Number.isFinite(+now)) return null
  const html = response.html
  const canonical = [...html.matchAll(/<link\b[^>]*>/gi)].filter(tag => attribute(tag[0], 'rel').toLowerCase() === 'canonical')
  if (canonical.length !== 1 || attribute(canonical[0][0], 'href') !== link) return null
  const postings = []
  for (const tag of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!/type\s*=\s*["']application\/ld\+json["']/i.test(tag[0])) continue
    try {
      const value = JSON.parse(tag[1])
      for (const item of Array.isArray(value) ? value : value?.['@graph'] || [value]) {
        if (item?.['@type'] === 'JobPosting') postings.push(item)
      }
    } catch { return null }
  }
  if (postings.length !== 1) return null
  const posting = postings[0], same = (left, right) => normalizeWhitespace(left).toLowerCase() === normalizeWhitespace(right).toLowerCase()
  const countries = (Array.isArray(posting.jobLocation) ? posting.jobLocation : [posting.jobLocation])
    .map(location => location?.address?.addressCountry)
  const posted = new Date(posting.datePosted), validThrough = new Date(posting.validThrough)
  if (!same(posting.title, job.title) || !same(posting.hiringOrganization?.name, COMPANY) || posting.url !== link
    || !countries.length || countries.some(country => typeof country !== 'string' || !/^(?:India|IN)$/i.test(country.trim()))
    || !Number.isFinite(+posted)
    || !Number.isFinite(+validThrough)) return null
  const clean = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  const heading = [...clean.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
  if (heading.length !== 1 || !same(heading[0][1], job.title)) return null
  const details = [...clean.matchAll(/<div\b[^>]*>/gi)].find(tag => attribute(tag[0], 'id') === 'detail-tab')
  if (!details) return null
  const section = divContent(clean, details)
  if (!section) return null
  const editors = [...section.matchAll(/<div\b[^>]*>/gi)].filter(tag => attribute(tag[0], 'class').split(/\s+/).includes('default-editor'))
  if (editors.length !== 1) return null
  const body = divContent(section, editors[0])
  if (!body) return null
  const description = body.replace(/<\/(?:p|li|h[1-6]|div|ul|ol)>|<br\s*\/?>/gi, '\n')
    .split(/\n+/).map(normalizeWhitespace).filter(Boolean).join('\n')
  if (description.length < 200 || description === normalizeWhitespace(posting.description)) return null
  const deadline = visibleDeadline(clean)
  if (deadline && !Number.isFinite(+deadline)) return null
  const closing = deadline && deadline < validThrough ? deadline : validThrough
  return { sourceDescription: description, postingDate: posted.toISOString(), closingDate: closing.toISOString(),
    sourceClosingDateIsExact: true, sourceDateEvidence: 'unstop-canonical-amp-jobposting-and-visible-deadline-v1' }
}

export const extractJobs = (html = '') => {
  const jobs = []
  const seen = new Set()
  for (const match of String(html).matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const link = trustedJobUrl(match[1])
    if (!link || seen.has(link)) continue
    const title = normalizeWhitespace(match[2])
    if (!title) continue
    seen.add(link)
    jobs.push({ title, company: COMPANY, location: 'India', link, applyUrl: link, source: SOURCE })
  }
  return jobs
}

export const createUnstopScraper = () => ({
  async run({ fetchPage = defaultFetchPage, signal, detailEnrichmentBudgetMs,
    now = () => new Date().toISOString() } = {}) {
    const careersPage = await fetchPage(CAREERS_PAGE_URL, { signal })
    if (careersPage.status !== 200 || careersPage.url !== CAREERS_PAGE_URL || !hasTrustedCareersSignal(careersPage.html)) {
      throw new Error('Unstop verified careers page no longer matches the trusted first-party surface')
    }
    const details = new Map()
    const jobs = await hydrateSourceDescriptions(extractJobs(careersPage.html), {
      signal, detailEnrichmentBudgetMs, concurrency: 4,
      fetchDetail: async (job, { signal: detailSignal }) => {
        const response = await fetchPage(job.link + '/amp', { signal: detailSignal })
        const detail = recoverUnstopRoleDescription(job, response, { now: new Date(now()) })
        if (detail) details.set(job.link, detail)
        return detail
      },
    })
    return jobs.map(job => ({ ...job, ...(job.sourceDetailComplete === true ? details.get(job.link) : {}),
      sourceUrl: job.link, scrapedAt: now() }))
  },
})

export const run = async (options = {}) => createUnstopScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
