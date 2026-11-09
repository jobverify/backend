import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'mercermettl'
export const COMPANY = 'Mercer | Mettl'
export const TALENT_EMAIL = 'talentacquisition_mettl@mmc.com'
export const LINKEDIN_HANDOFF_TEXT = 'search for relevant openings on our linkedin page'

export const MERCER_METTL_SITE = {
  key: 'mercermettl.com',
  homepageUrl: 'https://mercermettl.com/',
  careersUrl: 'https://mercermettl.com/careers/',
  missingRouteUrls: [
    'https://mercermettl.com/jobs',
    'https://mercermettl.com/openings',
    'https://mercermettl.com/current-openings',
  ],
}

export const METTL_SITE = {
  key: 'mettl.com',
  homepageUrl: 'https://mettl.com/',
  careersUrl: 'https://mettl.com/careers/',
  missingRouteUrls: [
    'https://mettl.com/jobs',
    'https://mettl.com/openings',
    'https://mettl.com/current-openings',
  ],
}

export const SITE_DEFINITIONS = [MERCER_METTL_SITE, METTL_SITE]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(String(value ?? ''))
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const toAbsoluteUrl = (value, baseUrl) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const extractAnchorUrls = (html = '', baseUrl) => [
  ...String(html ?? '').matchAll(/<a[^>]+href=["']([^"']+)["']/gi),
]
  .map((match) => toAbsoluteUrl(match[1], baseUrl))
  .filter(Boolean)

export const hasUnexpectedPublicJobsSignal = (html = '') => {
  const page = String(html ?? '')

  return /"@type"\s*:\s*"JobPosting"/i.test(page)
    || /https?:\/\/[^"' ]*(jobs\.lever\.co|greenhouse|myworkdayjobs|workdayjobs|darwinbox|ashbyhq|smartrecruiters|jobvite)/i.test(page)
}

export const hasOfficialHomepageSignal = (html = '', site = MERCER_METTL_SITE) => {
  const page = String(html ?? '')
  const title = extractTitle(page)

  if (site.key === MERCER_METTL_SITE.key) {
    return title === 'Mercer | Mettl: Best Online Talent Assessment Company - Assessments, Platform, and Proctoring'
      && /Mercer \| Mettl/i.test(page)
      && !hasUnexpectedPublicJobsSignal(page)
  }

  return title === 'Best Talent Assessment Company - Online Tools & Software Platform | Mercer | Mettl'
    && /Mercer \| Mettl/i.test(page)
    && !hasUnexpectedPublicJobsSignal(page)
}

export const hasOfficialCareersSignal = (html = '') => {
  const text = normalizeWhitespace(html)?.toLowerCase() || ''
  const title = extractTitle(html)

  return title === "Careers Mercer | Mettl's Paint your future"
    && text.includes(LINKEDIN_HANDOFF_TEXT)
    && text.includes(TALENT_EMAIL)
    && !hasUnexpectedPublicJobsSignal(html)
}

const isVerifiedHomepageFallback = ({ status, url, html }, site) => {
  return status === 200
    && url === site.homepageUrl
    && hasOfficialHomepageSignal(html, site)
  }

const isVerifiedMissingRoute = ({ status, url, html }, routeUrl) => {
  const normalizedUrl = String(url || '')
  const normalizedRouteUrl = String(routeUrl || '')

  return status === 404
    && (
      normalizedUrl === normalizedRouteUrl
      || normalizedUrl === `${normalizedRouteUrl}/`
    )
    && /\bnot found\b/i.test(html)
    && !hasUnexpectedPublicJobsSignal(html)
}

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

const verifySiteSurface = async (site, { fetchPage }) => {
  const homepage = await fetchPage(site.homepageUrl)
  if (!isVerifiedHomepageFallback(homepage, site)) {
    throw new Error(`${site.key} verified homepage no longer matches the known first-party surface`)
  }

  const careersPage = await fetchPage(site.careersUrl)
  if (careersPage.status !== 200 || !hasOfficialCareersSignal(careersPage.html)) {
    if (hasUnexpectedPublicJobsSignal(careersPage.html)) {
      throw new Error(`${site.key} careers page now appears to expose a public jobs surface`)
    }

    throw new Error(`${site.key} verified careers page no longer matches the LinkedIn handoff surface`)
  }

  for (const routeUrl of site.missingRouteUrls) {
    const routePage = await fetchPage(routeUrl)
    if (
      !isVerifiedHomepageFallback(routePage, site)
      && !isVerifiedMissingRoute(routePage, routeUrl)
    ) {
      throw new Error(`${site.key} route ${routeUrl} no longer falls back to the verified homepage surface`)
    }
  }
}

export const createMercerMettlScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    for (const site of SITE_DEFINITIONS) {
      await verifySiteSurface(site, { fetchPage })
    }

    return []
  },
})

export const run = async (options = {}) => createMercerMettlScraper().run(options)

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
