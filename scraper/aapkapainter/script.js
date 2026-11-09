import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'aapkapainter'
export const COMPANY = 'Aapka Painter'
export const VERIFIED_AT = '2026-07-14'
export const HOMEPAGE_URL = 'https://aapkapainter.com/'
export const CAREER_URL = 'https://aapkapainter.com/career'
export const WIDGET_SCRIPT_URL = 'https://ats.zimyo.com/assets/js/jobwidget.js'
export const WIDGET_USER_ID = '1476'
export const WIDGET_REDIRECT_URL = 'https://ats.zimyo.work'
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://aapkapainter.com/careers',
  'https://aapkapainter.com/jobs',
  'https://aapkapainter.com/join-us',
  'https://aapkapainter.com/work-with-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /<article\b/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bview details\b/i,
  /\bapply now\b/i,
  /\bapply here\b/i,
  /\bjob description\b/i,
  /data-job-id=/i,
  /job-card/i,
  /job-listing-item/i,
  /ats\.zimyo\.work\/jobs\//i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) return null

  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*AapkaPainter\s*[-–]\s*Expert Painting & Waterproofing Services in India\s*<\/title>/i.test(page)
    && normalized.includes('BOOK SITE VISIT')
    && normalized.includes('Select your property type')
    && normalized.includes('AapkaPainter Solutions Pvt Ltd')
}

export const extractCareerUrl = (html) => {
  const rawHtml = String(html ?? '')

  for (const match of rawHtml.matchAll(/href=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], HOMEPAGE_URL)
    if (absoluteUrl === CAREER_URL) {
      return absoluteUrl
    }
  }

  return null
}

export const extractWidgetUserId = (html) =>
  String(html ?? '').match(/USERID\s*=\s*['"]([^'"]+)['"]/i)?.[1] ?? null

export const extractWidgetScriptUrl = (html) => {
  const rawHtml = String(html ?? '')

  for (const match of rawHtml.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    const absoluteUrl = toAbsoluteUrl(match[1], CAREER_URL)
    if (absoluteUrl === WIDGET_SCRIPT_URL) {
      return absoluteUrl
    }
  }

  return null
}

export const hasOfficialCareerPageSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Career\s*-\s*Jobs at Aapkapainter\s*<\/title>/i.test(page)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/aapkapainter\.com\/career["']/i.test(page)
    && /Apply to jobs at Aapkapainter today\.\s*Learn about careers at Aapkapainter in software,\s*marketing,\s*sales and operations/i.test(page)
    && /<div[^>]+id=["']job-listing["'][^>]*><\/div>/i.test(page)
    && extractWidgetUserId(page) === WIDGET_USER_ID
    && extractWidgetScriptUrl(page) === WIDGET_SCRIPT_URL
    && /value=["']career["']/i.test(page)
    && normalized.includes('BOOK SITE VISIT')
    && normalized.includes('Select your property type')
}

export const hasPublicJobBoardSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasDeadWidgetScriptSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Redirecting\.\.\.\s*<\/title>/i.test(page)
    && /window\.location\.replace\(["']https:\/\/ats\.zimyo\.work["']\)/i.test(page)
}

export const isKnownDeadWidgetScriptTlsFailure = (error) => {
  const code = error?.cause?.code ?? error?.code ?? null
  const message = `${error?.message ?? ''} ${error?.cause?.message ?? ''}`

  return code === 'ERR_TLS_CERT_ALTNAME_INVALID'
    && /ats\.zimyo\.com/i.test(message)
    && /apiserver\.zimyo\.com|hrms\.zimyo\.com|sandbox\.zimyo\.com/i.test(message)
}

export const isVerifiedMissingPublicJobRoute = (page = {}) =>
  Number(page.status) === 404 && !hasPublicJobBoardSignal(page.html)

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8,text/javascript,application/javascript',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const unavailableWidgetError = ({ reason, status = null, cause } = {}) => {
  const error = Object.assign(
    new Error('Aapka Painter public hiring widget is unavailable; an empty jobs inventory is not established'),
    {
      failureType: 'upstream_unavailable',
      upstreamOutage: true,
      source: SOURCE,
      sourceUrl: WIDGET_SCRIPT_URL,
      scopeComplete: false,
      sourceScopeComplete: false,
      cleanupAuthority: false,
      reason,
    },
  )
  if (status !== null) error.status = status
  if (cause !== undefined) error.cause = cause
  return error
}

export const createAapkaPainterScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html) || extractCareerUrl(homepage.html) !== CAREER_URL) {
      throw new Error('Aapka Painter verified official homepage no longer matches the trusted first-party career handoff')
    }

    const careerPage = await fetchPage(CAREER_URL)
    if (careerPage.status !== 200) {
      throw new Error('Aapka Painter verified career page no longer matches the trusted first-party nonlisting shell')
    }

    if (hasPublicJobBoardSignal(careerPage.html)) {
      throw new Error('Aapka Painter career page now appears to expose a public jobs surface')
    }

    if (!hasOfficialCareerPageSignal(careerPage.html)) {
      throw new Error('Aapka Painter verified career page no longer matches the trusted first-party nonlisting shell')
    }

    if (
      extractWidgetUserId(careerPage.html) !== WIDGET_USER_ID
      || extractWidgetScriptUrl(careerPage.html) !== WIDGET_SCRIPT_URL
    ) {
      throw new Error('Aapka Painter embedded Zimyo widget state changed materially')
    }

    let unavailableWidget = null
    try {
      const widgetScript = await fetchPage(WIDGET_SCRIPT_URL)
      if (widgetScript.url !== WIDGET_SCRIPT_URL) {
        throw new Error('Aapka Painter embedded Zimyo widget state changed materially')
      }
      if (widgetScript.status === 404 || widgetScript.status === 410) {
        throw unavailableWidgetError({ reason: 'widget_http_not_found', status: widgetScript.status })
      }
      if (widgetScript.status !== 200 || !hasDeadWidgetScriptSignal(widgetScript.html)) {
        throw new Error('Aapka Painter embedded Zimyo widget state changed materially')
      }
      unavailableWidget = { reason: 'dead_widget_redirect', status: 200 }
    } catch (error) {
      if (!isKnownDeadWidgetScriptTlsFailure(error)) {
        throw error
      }
      unavailableWidget = { reason: 'widget_tls_host_mismatch', cause: error }
    }

    for (const routeUrl of NO_PUBLIC_JOB_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)
      if (!isVerifiedMissingPublicJobRoute(routePage)) {
        throw new Error(`Aapka Painter common job route changed materially or now exposes public jobs: ${routePage.url || routeUrl}`)
      }
    }

    // Missing adjacent routes cannot establish the inaccessible widget inventory.
    throw unavailableWidgetError(unavailableWidget)
  },
})

export const run = async (options = {}) => createAapkaPainterScraper().run(options)

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
