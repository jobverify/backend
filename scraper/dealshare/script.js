import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { DEAL_SHARE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = DEAL_SHARE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = PROVIDER_METADATA.verifiedSurfaceSummary
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const ABOUT_HUB_URL = PROVIDER_METADATA.aboutHubUrl
export const CAREERS_SPA_URL = PROVIDER_METADATA.companyCareerPage
export const DIRECT_CAREERS_ROUTE_URL = PROVIDER_METADATA.directCareersRouteUrl

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const extractSuspiciousJobLinks = (html = '') => {
  const matches = []

  for (const match of String(html ?? '').matchAll(/href=["']([^"']+)["']/gi)) {
    const href = decodeHtmlEntities(match[1])

    if (
      /(jobs\.lever\.co|boards\.greenhouse\.io|job-boards\.greenhouse\.io|ashbyhq\.com|myworkdayjobs|workdayjobs|smartrecruiters|jobvite|darwinbox|successfactors|oraclecloud|icims|taleo|recruitee|wellfound|jobsoid|peoplestrong)/i.test(href)
      || /\/jobs(?:\/|$)|\/job(?:\/|$)|\/openings(?:\/|$)|\/apply(?:\/|$)/i.test(href)
    ) {
      matches.push(href)
    }
  }

  return [...new Set(matches)]
}

const hasPublicJobTextSignal = (html = '') => {
  const normalized = normalizeWhitespace(html).toLowerCase()
  return normalized.includes('current openings')
    || normalized.includes('job openings')
    || normalized.includes('open positions')
    || normalized.includes('apply now')
    || normalized.includes('job description')
}

export const hasHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Dealshare\s*<\/title>/i.test(page)
    && normalized.includes('Visit Our Store')
    && normalized.includes('About Us')
    && normalized.includes('Careers')
    && normalized.includes('support@dealshare.in')
    && normalized.includes('We Deliver To')
    && page.includes('https://about.dealshare.in/')
}

export const hasAccessDeniedDirectRouteSignal = ({ status, html } = {}) => {
  const normalized = normalizeWhitespace(html)

  return Number(status) === 403
    && normalized.includes('AccessDenied')
    && normalized.includes('Access Denied')
}

export const hasAboutHubSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('About')
    && normalized.includes('Careers')
    && normalized.includes('Media')
    && normalized.includes('Contact')
    && normalized.includes('Watch Our Story')
    && normalized.includes('Crafting extraordinarily simple tech solutions')
    && normalized.includes('Our Impact in numbers')
    && normalized.includes('Build. Innovate. Create Value.')
}

export const hasCareersSpaNoJobsSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return normalized.includes('Building everyday savings for India')
    && normalized.includes('Haq Se Bachao')
    && normalized.includes('Why DealShare')
    && normalized.includes('Our Culture')
    && normalized.includes('Flat Hierarchy')
    && normalized.includes('Growth & Innovation')
    && normalized.includes('Financial Benefits')
    && normalized.includes('Fast Paced')
    && normalized.includes('Testimonials')
    && normalized.includes('Contact')
    && normalized.includes('support@dealshare.in')
    && !hasPublicJobTextSignal(html)
    && extractSuspiciousJobLinks(html).length === 0
}

export const hasAboutHubShellSignal = (html = '') => {
  const page = String(html ?? '')

  return /<title>\s*DealShare\s*<\/title>/i.test(page)
    && /<div id="root"><\/div>/i.test(page)
    && /<script[^>]+src="\/assets\/index-[^"]+\.js"/i.test(page)
    && /<link[^>]+href="\/assets\/index-[^"]+\.css"/i.test(page)
}

const extractJavascriptAssetUrls = (html = '', baseUrl = ABOUT_HUB_URL) => [...String(html ?? '').matchAll(
  /<script[^>]+src="([^"]+\.js)"[^>]*><\/script>/gi,
)]
  .map((match) => new URL(match[1], baseUrl).toString())

export const createDealShareScraper = () => ({
  async run({
    fetchPage = defaultFetchPage,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    if (homepage.status !== 200 || !hasHomepageSignal(homepage.html)) {
      throw new Error('DealShare homepage no longer matches the verified public surface')
    }

    const directCareersRoute = await fetchPage(DIRECT_CAREERS_ROUTE_URL)
    if (!hasAccessDeniedDirectRouteSignal(directCareersRoute)) {
      throw new Error('DealShare direct careers route no longer matches the verified access-denied state')
    }

    const aboutHubShell = await fetchPage(ABOUT_HUB_URL)
    if (aboutHubShell.status !== 200 || !hasAboutHubShellSignal(aboutHubShell.html)) {
      throw new Error('DealShare about hub no longer matches the verified public SPA shell')
    }

    const javascriptAssets = extractJavascriptAssetUrls(aboutHubShell.html)
    if (javascriptAssets.length === 0) {
      throw new Error('DealShare about hub no longer exposes the verified client bundle')
    }

    const bundleTexts = await Promise.all(
      javascriptAssets.map(async (url) => {
        const asset = await fetchPage(url)
        if (asset.status !== 200 || !asset.html) {
          throw new Error(`DealShare client bundle is unavailable: ${url}`)
        }
        return asset.html
      }),
    )
    const careersText = bundleTexts.join('\n')

    if (!hasAboutHubSignal(careersText)) {
      throw new Error('DealShare about hub no longer matches the verified public surface')
    }

    const suspiciousLinks = extractSuspiciousJobLinks(careersText)
    if (suspiciousLinks.length > 0) {
      throw new Error(`DealShare careers page now exposes public jobs links: ${suspiciousLinks.join(', ')}`)
    }

    if (!hasCareersSpaNoJobsSignal(careersText)) {
      throw new Error('DealShare careers page no longer matches the verified no-openings surface')
    }

    return []
  },
})

export const run = async (options = {}) => createDealShareScraper().run(options)

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
