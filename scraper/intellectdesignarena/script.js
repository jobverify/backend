import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'intellectdesignarena'
export const COMPANY = 'Intellect Design Arena'
export const HOMEPAGE_URL = 'https://www.intellectdesign.com/'
export const CAREERS_URL = 'https://www.intellectdesign.com/careers/'
export const TENANT_COMPANY_ID = 'INTELLECT'
export const APPLY_URL = `https://cloud.myadrenalin.com/CandidateMAX/#/?CompanyID=${TENANT_COMPANY_ID}`
export const TENANT_CONFIG_URL = `https://cloud.myadrenalin.com/CandidateMAX/assets/company/${TENANT_COMPANY_ID}/config.json`
export const VACANCY_API_URL = 'https://cloud.myadrenalin.com/CandidateMAX/CPVacancyDetails/GetVacancyInformationWithoutToken'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.intellectdesign\.com\/["']/i.test(page)
    && normalized.includes('enterprise open finance & ai-first banking platform - intellect design arena')
    && normalized.includes('banking, rebuilt from first principles')
    && normalized.includes('emach.ai')
    && /href=["'](?:https:\/\/www\.intellectdesign\.com)?\/careers\/["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page).toLowerCase()

  return /<title>\s*careers\s*(?:-|\|)\s*intellect design arena\s*<\/title>/i.test(page)
    && normalized.includes('work at the heart of change')
    && normalized.includes('our customer-first approach drives us to deliver innovative solutions')
}

export const extractApplyUrl = (html) => {
  for (const match of String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (!/apply\s+now/i.test(match[2])) continue

    try {
      return new URL(match[1], CAREERS_URL).toString()
    } catch {
      return null
    }
  }

  return null
}

export const hasVerifiedTenantConfig = (config) =>
  config?.apiURL === 'https://cloud.myadrenalin.com'
  && config?.apiPath === '/CandidateMAX/'
  && config?.language === 'en'
  && config?.CompanyTitle === 'Candidate Portal'

export const isVerifiedPublicVacancyDenied = (payload) =>
  payload?.IsValid === false
  && payload?.ErrorMessage === 'E001171'
  && Array.isArray(payload?.Data)
  && payload.Data.length === 0

export const isVerifiedPublicVacancyEmptyResponse = (payload) => {
  if (payload?.IsValid !== true || !Array.isArray(payload?.Data) || payload.Data.length === 0) {
    return false
  }

  return payload.Data.every((section) =>
    Array.isArray(section?.VacancyInformation) && section.VacancyInformation.length === 0)
}

const extractVacancyRecords = (payload) => {
  if (!payload?.IsValid || !Array.isArray(payload?.Data)) {
    return []
  }

  const records = []

  for (const section of payload.Data) {
    if (!Array.isArray(section?.VacancyInformation)) continue
    records.push(...section.VacancyInformation.filter(Boolean))
  }

  return records
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    ...(options.headers || {}),
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createIntellectDesignArenaScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, signal } = {}) {
    signal?.throwIfAborted()
    const homepageHtml = await fetchText(HOMEPAGE_URL, { signal })
    signal?.throwIfAborted()
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('Intellect Design Arena homepage no longer matches the verified official careers handoff')
    }

    const careersHtml = await fetchText(CAREERS_URL, { signal })
    signal?.throwIfAborted()
    if (!hasOfficialCareersSignal(careersHtml)) {
      throw new Error('Intellect Design Arena careers page no longer matches the verified official careers surface')
    }

    const applyUrl = extractApplyUrl(careersHtml)
    if (applyUrl !== APPLY_URL) {
      throw new Error('Intellect Design Arena careers page no longer exposes the verified CandidateMAX handoff')
    }

    const tenantConfig = await fetchJson(TENANT_CONFIG_URL, { signal })
    signal?.throwIfAborted()
    if (!hasVerifiedTenantConfig(tenantConfig)) {
      throw new Error('Intellect Design Arena CandidateMAX tenant config no longer matches the verified public tenant')
    }

    const vacancyResponse = await fetchJson(VACANCY_API_URL, {
      signal,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        CompanyID: TENANT_COMPANY_ID,
        Flag: TENANT_COMPANY_ID,
      }),
    })

    signal?.throwIfAborted()
    if (isVerifiedPublicVacancyDenied(vacancyResponse)) {
      throw new Error('Intellect Design Arena public CandidateMAX inventory is unavailable: access denied')
    }
    if (isVerifiedPublicVacancyEmptyResponse(vacancyResponse)) {
      return []
    }

    if (extractVacancyRecords(vacancyResponse).length > 0) {
      throw new Error('Intellect Design Arena public CandidateMAX vacancy API now exposes job records')
    }

    throw new Error('Intellect Design Arena public CandidateMAX vacancy API no longer matches the verified denial sentinel')
  },
})

export const run = async (options = {}) => createIntellectDesignArenaScraper().run(options)

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
