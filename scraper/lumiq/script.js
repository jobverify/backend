import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { decodeJavaScriptStringLiteral } from '../../scraper-support/utils/safeLiteral.js'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'

import { LUMIQ_CATALOG as PROVIDER_METADATA } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_PAGE_URL = PROVIDER_METADATA.companyCareerPage
export const CAREERS_PORTAL_URL = PROVIDER_METADATA.officialZohoBoardUrl
export const CAREERS_API_URL = PROVIDER_METADATA.jobsApiUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeEmploymentType = (value) => {
  const normalized = normalizeWhitespace(value)?.toLowerCase()
  if (!normalized) return null
  if (/intern/.test(normalized)) return 'Internship'
  if (/contract|consultant/.test(normalized)) return 'Contract'
  if (/part.?time/.test(normalized)) return 'Part-time'
  if (/full.?time/.test(normalized)) return 'Full-time'
  return normalizeWhitespace(value)
}

const hasInputWithId = (html, id) => new RegExp(
  `<input\\b(?=[^>]*\\bid=["']${id}["'])[^>]*>`,
  'i',
).test(String(html ?? ''))

export const hasOfficialCareersPageSignal = (html = '') =>
  /href=["']https:\/\/lumiq\.zohorecruit\.in\/(?:careers|jobs\/Careers)\/?["']/i.test(html)
  && /LUMIQ|See All Open Positions/i.test(html)

export const hasOfficialPortalSignal = (html = '') =>
  (/<title>Jobs at Lumiq<\/title>/i.test(html) || /https:\/\/lumiq\.zohorecruit\.in\/jobs\/Careers/i.test(html))
  && ['pageJson', 'moduleMeta', 'jobs'].every(id => hasInputWithId(html, id))

const readEmbeddedJobs = (html) => {
  const tag = String(html).match(/<input\b(?=[^>]*\bid=["']jobs["'])[^>]*>/i)?.[0]
  const value = tag?.match(/\bvalue=["']([^"']*)["']/i)?.[1]
  try {
    const records = JSON.parse(normalizeWhitespace(value))
    if (!Array.isArray(records)) throw new Error('array required')
    return records
  } catch { throw new Error('Lumiq invalid embedded board inventory') }
}

const validateRecords = (records) => {
  const ids = new Set()
  for (const record of records) {
    const id = normalizeWhitespace(record?.id)
    if (!id || !normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name) || !normalizeWhitespace(record.Country)) throw new Error('Lumiq invalid record or unknown country scope')
    if (ids.has(id)) throw new Error('Lumiq duplicate job identifier')
    ids.add(id)
  }
  return ids
}

const readDetail = (html, listing) => {
  const literal = String(html).match(/(?:var|let|const)\s+jobs\s*=\s*JSON\.parse\(\s*((?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'))\s*\)/)?.[1]
  let records
  try { records = JSON.parse(decodeJavaScriptStringLiteral(literal)) } catch { throw new Error('Lumiq invalid job detail data') }
  const record = records?.[0]
  if (!Array.isArray(records) || records.length !== 1 || record?.id !== listing.id || record.Country !== listing.Country || record.Posting_Title !== listing.Posting_Title || !normalizeWhitespace(record.Job_Description)) throw new Error('Lumiq incomplete or mismatched job detail')
  return { ...record, $url: listing.$url }
}

const isIndiaJob = (record = {}) => /^india$/i.test(normalizeWhitespace(record.Country) || '')

const buildApplyUrl = (sourceUrl) =>
  sourceUrl?.includes('$apply=true') ? sourceUrl : `${sourceUrl}&$apply=true`

const getLocation = (record = {}) => [record.City, record.State, record.Country]
  .map(normalizeWhitespace)
  .filter(Boolean)
  .join(', ') || null

export const extractIndiaJobs = (payload) => (Array.isArray(payload?.data) ? payload.data : [])
  .filter(isIndiaJob)
  .map((record) => {
    const title = normalizeWhitespace(record.Posting_Title || record.Job_Opening_Name)
    const city = normalizeWhitespace(record.City)
    const state = normalizeWhitespace(record.State)
    const country = normalizeWhitespace(record.Country)
    const jobId = normalizeWhitespace(record.id)
    const sourceUrl = normalizeWhitespace(record.$url)
    const location = getLocation(record)

    if (!title || !country || !jobId || !sourceUrl || !location) return null

    return {
      title,
      company: COMPANY,
      department: null,
      location,
      city,
      state,
      country,
      jobId,
      requisitionId: jobId,
      sourceUrl,
      applyUrl: buildApplyUrl(sourceUrl),
      employmentType: normalizeEmploymentType(record.Job_Type),
      experienceRequired: normalizeWhitespace(record.Work_Experience),
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: String(record.Required_Skills || '')
        .split(',')
        .map(normalizeWhitespace)
        .filter(Boolean),
      postingDate: normalizeWhitespace(record.Date_Opened),
      closingDate: null,
      jobDescription: normalizeWhitespace(record.Job_Description),
      remoteStatus: 'On-site',
    }
  })
  .filter(Boolean)

const defaultFetchText = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.text()
}

const defaultFetchJson = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json,text/plain,*/*',
    },
  })

  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

export const createLumiqScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
    signal,
  } = {}) {
    signal?.throwIfAborted()
    const read = async (url) => {
      signal?.throwIfAborted()
      const html = await fetchText(url, { signal })
      signal?.throwIfAborted()
      return html
    }
    const careersHtml = await read(CAREERS_PAGE_URL)
    if (!hasOfficialCareersPageSignal(careersHtml)) throw new Error('Response is not the verified official Lumiq careers page')
    const portalHtml = await read(CAREERS_PORTAL_URL)
    if (!hasOfficialPortalSignal(portalHtml)) throw new Error('Response is not the verified official Lumiq careers portal')
    const boardRecords = readEmbeddedJobs(portalHtml)
    const boardIds = validateRecords(boardRecords)
    const payload = await fetchJson(CAREERS_API_URL, { signal })
    signal?.throwIfAborted()
    if (payload?.code !== 'success' || !Array.isArray(payload?.data)) throw new Error('Lumiq invalid public jobs API payload')
    if (payload.info?.more_records || (payload.info?.page_name && payload.info.page_name !== 'Careers')) throw new Error('Lumiq incomplete or unexpected pagination contract')
    const ids = validateRecords(payload.data)
    if (boardIds.size !== ids.size || [...ids].some(id => !boardIds.has(id))) throw new Error('Lumiq incomplete API inventory does not match embedded board')
    for (const record of payload.data) {
      const url = new URL(record.$url || 'https://invalid.example/')
      if (url.origin !== 'https://lumiq.zohorecruit.in' || !url.pathname.startsWith('/jobs/Careers/' + record.id + '/')) throw new Error('Lumiq invalid job tenant or identifier URL')
      const board = boardRecords.find(row => row.id === record.id)
      if (board.Country !== record.Country || (board.Posting_Title || board.Job_Opening_Name) !== (record.Posting_Title || record.Job_Opening_Name)) throw new Error('Lumiq incomplete snapshot changed between board and API')
    }
    const indiaRecords = payload.data.filter(isIndiaJob)
    const selectedRecords = Number.isInteger(maxJobs) && maxJobs > 0 ? indiaRecords.slice(0, maxJobs) : indiaRecords
    const detailedRecords = []
    for (const record of selectedRecords) detailedRecords.push(normalizeWhitespace(record.Job_Description) ? record : readDetail(await read(record.$url), record))
    const selectedJobs = extractIndiaJobs({ data: detailedRecords })
    if (selectedJobs.length !== selectedRecords.length) throw new Error('Lumiq incomplete India job normalization')

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
      ...(selectedRecords.length < indiaRecords.length ? { sourceListingComplete: false } : {}),
    }))
  },
})

export const run = async (options = {}) => createLumiqScraper(options).run(options)

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
