import path from 'path'
import { fileURLToPath } from 'url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readPublishedPdf } from '../cdot/pdfDocument.js'
import { nativeMainText, readCaeInventory, readCaeDetails, publishedClosingDate } from './nativeCriteria.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const CAREER_PAGE_URL = 'https://cdac.in/index.aspx?id=current_jobs'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const ANNOUNCEMENT_SECTIONS = ['Current Openings', 'Rolling Advertisements']

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (href) => {
  try {
    return new URL(href, CAREER_PAGE_URL).toString()
  } catch {
    return null
  }
}

const getSectionHtml = (html, heading) => {
  const pattern = new RegExp(
    `<h([1-6])[^>]*>\\s*${heading}\\s*<\\/h\\1>([\\s\\S]*?)(?=<h[1-6][^>]*>|$)`,
    'i',
  )
  return String(html ?? '').match(pattern)?.[2] || ''
}

const extractAnnouncements = (html) => ANNOUNCEMENT_SECTIONS.flatMap((heading) => {
  const sectionHtml = getSectionHtml(String(html || '').replace(/<!--[\s\S]*?-->/g, ''), heading)
  const document = readNativeDocument(sectionHtml)
  return document.nodes(node => node.tag === 'a' && node.attrs.href)
    .map((node) => {
      const applyUrl = toAbsoluteUrl(node.attrs.href)
      const title = document.text(node)
      if (!applyUrl || !title) return null

      const url = new URL(applyUrl)
      const requisitionId = url.searchParams.get('dynamicId') || url.searchParams.get('id')
      if (!requisitionId && url.origin !== 'https://careers.cdac.in') return null
      if (!['https://cdac.in', 'https://careers.cdac.in'].includes(url.origin)) return null

      return { title, applyUrl, requisitionId }
    })
    .filter(Boolean)
})

export const pageIndicatesCurrentOpenings = (html) =>
  /<h[1-6][^>]*>\s*Current Openings\s*<\/h[1-6]>/i.test(String(html ?? ''))

export const extractSearchResults = (html) => extractAnnouncements(html)
  .map(({ title, applyUrl, requisitionId }) => ({
    title,
    company: 'C-DAC',
    department: null,
    location: null,
    city: null,
    country: null,
    jobId: `cdac-${(requisitionId || 'current-careers-portal').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()}`,
    requisitionId,
    sourceUrl: CAREER_PAGE_URL,
    applyUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  }))
  .sort((left, right) => left.title.localeCompare(right.title))

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: 'cdac',
  timeoutMs: 15000,
})

const defaultFetchBinary = async (url, { signal } = {}) => {
  const parsed = new URL(url)
  if (parsed.origin !== 'https://cdac.in' || parsed.pathname !== '/index.aspx' || !/^pdf_hrd/.test(parsed.searchParams.get('id') || '')) throw new Error('C-DAC published PDF URL is outside the declared first-party surface')
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000), headers: { 'User-Agent': USER_AGENT, Accept: 'application/pdf' } })
  if (!response.ok || !/application\/pdf/i.test(response.headers.get('content-type') || '')) throw new Error(`C-DAC native PDF HTTP${response.status} or unexpected content type`)
  return Buffer.from(await response.arrayBuffer())
}

export const createCdacScraper = ({
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : null,
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || defaultFetchText
    const fetchBinary = options.fetchBinary || defaultFetchBinary
    const now = options.now || (() => new Date())
    options.signal?.throwIfAborted()
    let pagesFetched = 0
    const readText = async url => { pagesFetched += 1; options.signal?.throwIfAborted(); return fetchText(url) }
    const html = await readText(CAREER_PAGE_URL)

    if (!pageIndicatesCurrentOpenings(html)) {
      throw new Error('C-DAC careers page no longer exposes the expected Current Openings section')
    }

    const announcements = extractSearchResults(html)
    const jobs = [], gaps = [], closedAdvertisements = [], administrativeRecords = []
    let caeOpening = null
    for (const announcement of announcements) {
      const url = announcement.applyUrl
      if (/Application Form|Interview Application|Select List|Corrigendum|Notice Regarding Advertisement/i.test(announcement.title)) {
        administrativeRecords.push({ url, title: announcement.title, reason: 'native administrative document, not a vacancy' })
        continue
      }
      try {
        if (/job_corp_CAE_2020/.test(url)) {
          const page = await readText(url)
          caeOpening = readCaeInventory(page, url)
          for (const listing of caeOpening.rows) {
            try {
              const details = readCaeDetails(await readText(listing.url), listing, caeOpening.terms)
              jobs.push(...details)
              if (details.some(job => job.sourceNativeVacancyCounts?.conflicting)) gaps.push({ url: listing.url,
                reason: 'Native listing and detail vacancy counts conflict; complete role criteria retained, numberOfOpenings withheld', counts: details[0].sourceNativeVacancyCounts })
            }
            catch (error) { options.signal?.throwIfAborted(); gaps.push({ url: listing.url, reason: error.message }) }
          }
          continue
        }
        let text, pdf = null
        if (/dynamicId=[^&]+\.pdf/i.test(url)) {
          pagesFetched += 1
          const document = await readPublishedPdf(await fetchBinary(url, { signal: options.signal }), { signal: options.signal })
          text = document.text.replace(/\s+/g, ' ')
          pdf = { sha256: document.sha256, pages: document.totalPages, textLength: text.length }
        } else text = nativeMainText(await readText(url))
        const closingDate = publishedClosingDate(text)
        if (closingDate && closingDate < now().toISOString().slice(0, 10)) {
          closedAdvertisements.push({ url, title: announcement.title, closingDate, pdf })
          continue
        }
        gaps.push({ url, title: announcement.title, reason: /job_corp_ADS_2020/.test(url)
          ? 'Native full ADS criteria read; role worksite country is not expressly qualified. Nationality and travel clauses are not workplace evidence.'
          : 'Native advertisement needs a qualified current individual-role inventory and full country/criteria binding' })
      } catch (error) { options.signal?.throwIfAborted(); gaps.push({ url, reason: error.message }) }
    }
    const closingHtml = await readText(CAREER_PAGE_URL)
    const signature = rows => JSON.stringify(rows)
    let closingStable = signature(extractSearchResults(closingHtml)) === signature(announcements)
    if (caeOpening) {
      const caeClosing = readCaeInventory(await readText('https://cdac.in/index.aspx?id=job_corp_CAE_2020'), 'https://cdac.in/index.aspx?id=job_corp_CAE_2020')
      closingStable &&= signature(caeOpening) === signature(caeClosing)
    }
    if (!closingStable) gaps.push({ url: CAREER_PAGE_URL, reason: 'Native opening/closing announcement or CAE role identities/criteria changed' })
    const selectedJobs = (maxJobs ? jobs.slice(0, maxJobs) : jobs).map((job) => ({
      ...job,
      source: 'cdac',
      link: job.applyUrl,
      sourceListingComplete: false,
      scrapedAt: now().toISOString(),
    }))
    const audit = { source: 'cdac', announcedDocuments: announcements.length, linkedCaeDetailPages: caeOpening?.rows.length || 0, fullNativeIndiaRoles: jobs.length, returned: selectedJobs.length, administrativeRecords, closedAdvertisements, gaps, closingStable, capped: selectedJobs.length !== jobs.length }
    if (selectedJobs.length) selectedJobs[0].nativeCollectionEvidence = audit
    options.onAudit?.(audit)
    return attachInventoryEvidence(selectedJobs, { status: 'coverage-gap', firstParty: true, surface: CAREER_PAGE_URL,
      listingComplete: false, pagesFetched, reportedTotal: null, indiaFacetCount: null, verifiedAt: now().toISOString(),
      reason: `C-DAC current first-party announcements and CAE opening/closing checked; ${jobs.length} full identity-bound India CAE roles; unresolved:${gaps.map(gap => `${gap.url}:${gap.reason}`).join(';')}` })
  },
})

export const run = async (options = {}) => createCdacScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running C-DAC scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, 'cdac')
    console.log('DB result:', result)
    process.exit(0)
  }
}
