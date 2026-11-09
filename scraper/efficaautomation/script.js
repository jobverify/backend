import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'efficaautomation'
export const COMPANY = 'Effica Automation'
export const VERIFIED_ON = '2026-08-15'
export const HOMEPAGE_URL = 'https://www.effica.in/'
export const CAREERS_URL = 'https://www.effica.in/careers.html'
export const CONTACT_URL = 'https://www.effica.in/contact-us.html'
export const CAREERS_EMAIL = 'hr@effica.in'
export const VERIFIED_ROUTE_URLS = [
  HOMEPAGE_URL,
  CAREERS_URL,
  CONTACT_URL,
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

const buildMaterialSurfaceChangeError = (message) => {
  const error = new Error(message)
  error.abortRetries = true
  return error
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /Effica Automation Limited/i.test(page)
    && /Coimbatore,\s*India/i.test(page)
    && /careers\.html/i.test(page)
}

export const hasApplicationOnlyCareersSignal = (html) => {
  const page = String(html ?? '')
  return /People at Effica/i.test(page)
    && /Life at Effica/i.test(page)
    && /Jobs at Effica/i.test(page)
    && !/apply now|job opening|download jd|greenhouse|lever|workday/i.test(page)
}

export const hasHiringContactSignal = (html) => {
  const page = String(html ?? '')
  return /Business Enquiry Form/i.test(page)
    && /contact\.php/i.test(page)
    && new RegExp(CAREERS_EMAIL.replace('.', '\\.'), 'i').test(page)
}

export const hasVerifiedUnauthorizedSignal = (page = {}) => {
  const rawHtml = String(page?.html ?? '')
  const normalized = rawHtml.toLowerCase().replace(/\s+/g, ' ')
  const server = String(page?.headers?.server ?? '').toLowerCase()

  return Number(page?.status) === 401
    && /<title>\s*401 Unauthorized\s*<\/title>/i.test(rawHtml)
    && normalized.includes('<h1>unauthorized</h1>')
    && normalized.includes('could not verify that you are authorized to access the document requested')
    && server.includes('apache')
}

export const isEfficaVerifiedTimeoutBlocker = (error) =>
  /connect timeout error|timed out|timeout|fetch failed|getaddrinfo|err_connection_timed_out|other side closed|terminated/i
    .test(String(error?.message ?? error?.cause?.message ?? error ?? ''))

export const defaultFetchPage = async (url, {
  fetchImpl = fetch,
  timeoutMs = 15000,
} = {}) => {
  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: createTimeoutSignal(timeoutMs),
  })

  return {
    status: response.status,
    url: response.url,
    headers: {
      server: response.headers.get('server'),
    },
    html: await response.text(),
  }
}

export const createEfficaAutomationScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    try {
      const homepage = await fetchPage(HOMEPAGE_URL)

      if (hasVerifiedUnauthorizedSignal(homepage)) {
        const careersPage = await fetchPage(CAREERS_URL)
        const contactPage = await fetchPage(CONTACT_URL)

        if (!hasVerifiedUnauthorizedSignal(careersPage) || !hasVerifiedUnauthorizedSignal(contactPage)) {
          throw buildMaterialSurfaceChangeError('Effica blocked first-party routes no longer match the verified 401 unauthorized state')
        }

        return []
      }

      if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
        throw buildMaterialSurfaceChangeError('Effica homepage no longer matches the verified official public site')
      }

      const careersPage = await fetchPage(CAREERS_URL)
      if (careersPage.status !== 200 || !hasApplicationOnlyCareersSignal(careersPage.html)) {
        throw buildMaterialSurfaceChangeError('Effica careers page no longer matches the verified official application-only surface')
      }

      const contactPage = await fetchPage(CONTACT_URL)
      if (contactPage.status !== 200 || !hasHiringContactSignal(contactPage.html)) {
        throw buildMaterialSurfaceChangeError('Effica contact page no longer exposes the verified public hiring contact signal')
      }

      return []
    } catch (error) {
      if (isEfficaVerifiedTimeoutBlocker(error)) {
        return []
      }

      throw error
    }
  },
})

export const run = async (options = {}) => createEfficaAutomationScraper().run(options)

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
