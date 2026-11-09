import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import NXTGEN_DATACENTER_CLOUD_TECHNOLOGIES_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = NXTGEN_DATACENTER_CLOUD_TECHNOLOGIES_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;|&#34;/gi, '"')

const stripTags = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/(div|p|li|ul|ol|h[1-6]|b)>/gi, '\n')
  .replace(/<li\b[^>]*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeText = (value) => stripTags(value) || null

const toAbsoluteUrl = (value) => {
  try {
    return new URL(value, CAREERS_URL).toString()
  } catch {
    return CAREERS_URL
  }
}

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const isTrustedUnavailableFailure = (error) => {
  const message = String(error?.message ?? error).toLowerCase()

  return message.includes('timed out')
    || message.includes('timeout')
    || message.includes('timed_out')
    || message.includes('und_err_connect_timeout')
}

export const hasOfficialCareersSignal = (html = '') => {
  const page = String(html ?? '')

  return /Careers \| NxtGen Datacenter Solutions and Cloud Technologies/i.test(page)
    && /Search Jobs/i.test(page)
    && /Featured Jobs/i.test(page)
    && /featured-box-head/i.test(page)
}

export const extractJobs = (html = '') => {
  const jobs = []
  const matches = String(html ?? '').matchAll(
    /<div class="featured-box pull-left">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi,
  )

  for (const match of matches) {
    const block = match[1]
    const title = normalizeText(block.match(/<div class="featured-box-head">([\s\S]*?)<\/div>/i)?.[1])
    const city = normalizeText(block.match(/<span class="featured-box-head2">([\s\S]*?)<\/span>/i)?.[1])
    const detailPath = normalizeText(block.match(/<a href="([^"]+\.pdf)" download>/i)?.[1])
    const modalId = normalizeText(block.match(/data-target="#([^"]+)"/i)?.[1])
    const listItems = [...block.matchAll(/<li>([\s\S]*?)<\/li>/gi)]
      .map((item) => normalizeText(item[1]))
      .filter(Boolean)

    if (!title || !city || !detailPath || !modalId) continue

    jobs.push({
      title,
      company: COMPANY,
      department: null,
      location: `${city}, India`,
      city,
      country: 'India',
      jobId: modalId,
      requisitionId: modalId,
      sourceUrl: toAbsoluteUrl(detailPath),
      applyUrl: toAbsoluteUrl(`#${modalId}`),
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: listItems.length > 0
        ? `You will be responsible for: ${listItems.join(' ')}`
        : null,
    })
  }

  return jobs
}

export const createNxtgenDatacenterCloudTechnologiesScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow } = {}) {
    let careersHtml

    try {
      careersHtml = await fetchText(CAREERS_URL)
    } catch (error) {
      if (isTrustedUnavailableFailure(error)) {
        return []
      }

      throw error
    }

    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('The verified Nxtgen Datacenter Cloud Technologies careers page no longer matches the trusted first-party surface')
    }

    const jobs = extractJobs(careersHtml)
    if (jobs.length === 0) {
      throw new Error('Nxtgen Datacenter Cloud Technologies careers page no longer exposes the verified featured jobs')
    }

    const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

    return selectedJobs.map((job) => ({
      ...job,
      source: SOURCE,
      companyCareerPage: CAREERS_URL,
      companyDomain: PROVIDER_METADATA.companyDomain,
      atsPlatform: PROVIDER_METADATA.atsPlatform,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    }))
  },
})

export const run = async (options = {}) =>
  createNxtgenDatacenterCloudTechnologiesScraper().run(options)

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
