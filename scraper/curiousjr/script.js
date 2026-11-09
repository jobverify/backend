import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'curiousjr'
export const COMPANY = 'CuriousJr'
export const BRAND_HOME_URL = 'https://www.curiousjr.com/'
export const CONTACT_URL = 'https://www.curiousjr.com/contact-us'
export const PARENT_ABOUT_URL = 'https://www.pw.live/about-us'
export const PARENT_CAREERS_HANDOFF_URL = 'https://pwhr.darwinbox.in/ms/candidate/careers'

export const COMMON_CAREER_ROUTE_PROBES = Object.freeze([
  {
    url: 'https://www.curiousjr.com/careers',
    expectedStatus: 404,
  },
  {
    url: 'https://www.curiousjr.com/career',
    expectedStatus: 404,
  },
  {
    url: 'https://www.curiousjr.com/jobs',
    expectedStatus: 404,
  },
])

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SURFACE_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bopen roles\b/i,
  /\bjob openings\b/i,
  /\bapply now\b/i,
  /\bjoin our team\b/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /darwinbox/i,
  /linkedin\.com\/jobs/i,
  /href=["'][^"']*(?:\/career\/[^"']+|\/careers\/[^"']+|\/job\/[^"']+|\/jobs\/[^"']*)["']/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  const response = await fetch(url, {
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

export const extractParentCareersHandoffUrl = (html = '') => {
  const match = String(html ?? '').match(
    /https:\/\/pwhr\.darwinbox\.in\/ms\/candidate\/careers/i,
  )

  return match?.[0] ?? null
}

export const hasUnexpectedPublicJobsSignal = (html = '') =>
  PUBLIC_JOB_SURFACE_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasCuriousJrHomeSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  const hasLegacyShell = /<title[^>]*>\s*CuriousJr\s*\|\s*Online Tuition Classes for 1st to 10th Kids\s*<\/title>/i.test(rawHtml)
    && /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.curiousjr\.com\/["']/i.test(rawHtml)
  const hasCurrentShell = /<title[^>]*>\s*Mute\s*<\/title>/i.test(rawHtml)
    && normalized.includes('after-school')
    && normalized.includes('learn english')
    && normalized.includes('learn maths')

  return (hasLegacyShell || hasCurrentShell)
    && normalized.includes('learning made fun for curious minds')
    && normalized.includes('trusted by olympiad rankers')
    && /href=["']https:\/\/www\.pw\.live\/about-us["']/i.test(rawHtml)
    && normalized.includes('copyright')
}

export const hasCuriousJrContactSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title[^>]*>\s*CuriousJr\s*\|\s*(?:Contact Us|Online Tuition Classes for 1st to 10th Kids)\s*<\/title>/i.test(rawHtml)
    && normalized.includes('welcome to curiousjr powered by')
    && normalized.includes('cjr_support@pw.live')
    && normalized.includes('8448828113')
}

export const hasParentCompanyBridgeSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml).toLowerCase()

  return /<title[^>]*>\s*About Us\s*-\s*[^<]+\s*<\/title>/i.test(rawHtml)
    && normalized.includes('about pw')
    && normalized.includes('curiousjr (3rd - 8th)')
}

const isExpectedMissingCareerRoute = ({ status }) => status === 404

const getVerifiedContactBundleUrl = (html) => {
  const page = String(html ?? '')
  if (!/<title[^>]*>\s*CuriousJr\s*\|\s*(?:Contact Us|Online Tuition Classes for 1st to 10th Kids)\s*<\/title>/i.test(page)) return null
  let data
  try {
    data = JSON.parse(page.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1] || '')
  } catch { return null }
  if (data.page !== '/contact-us' || data.nextExport !== true || data.isFallback !== false) return null
  const bundles = [...page.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
    .map(match => match[1]).filter(src => /^\/_next\/static\/chunks\/pages\/contact-us-[a-f0-9]+\.js$/.test(src))
  return bundles.length === 1 ? new URL(bundles[0], CONTACT_URL).toString() : null
}

const hasVerifiedContactBundleContent = (script) => {
  const text = normalizeWhitespace(script).toLowerCase()
  return /window\.__NEXT_P/.test(script) && /\.push\(\s*\[\s*["']\/contact-us["']/.test(script)
    && text.includes('welcome to curiousjr powered by')
    && text.includes('cjr_support@pw.live') && text.includes('8448828113')
}

export const createCuriousJrScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(BRAND_HOME_URL)
    if (!hasCuriousJrHomeSignal(homepage.html)) {
      throw new Error('Verified CuriousJr homepage no longer matches the known first-party surface')
    }

    if (hasUnexpectedPublicJobsSignal(homepage.html)) {
      throw new Error('CuriousJr homepage now exposes a public jobs surface')
    }

    const contactPage = await fetchPage(CONTACT_URL)
    let contactContent = contactPage.html
    if (!hasCuriousJrContactSignal(contactContent)) {
      const bundleUrl = getVerifiedContactBundleUrl(contactContent)
      if (contactPage.status !== 200 || contactPage.url !== CONTACT_URL || !bundleUrl) {
        throw new Error('CuriousJr verified contact page no longer matches the known first-party surface')
      }
      const bundle = await fetchPage(bundleUrl)
      if (bundle.status !== 200 || bundle.url !== bundleUrl || !hasVerifiedContactBundleContent(bundle.html)) {
        throw new Error('CuriousJr verified contact bundle no longer matches the known first-party surface')
      }
      contactContent += '\n' + bundle.html
    }
    if (hasUnexpectedPublicJobsSignal(contactContent)) {
      throw new Error('CuriousJr contact page now exposes a public jobs surface')
    }

    const parentAboutPage = await fetchPage(PARENT_ABOUT_URL)
    if (!hasParentCompanyBridgeSignal(parentAboutPage.html)) {
      throw new Error('CuriousJr parent-company PW about page no longer matches the verified careers bridge')
    }

    for (const probe of COMMON_CAREER_ROUTE_PROBES) {
      const routePage = await fetchPage(probe.url)

      if (!isExpectedMissingCareerRoute(routePage)) {
        throw new Error(`Common CuriousJr career route changed: ${probe.url} now returns ${routePage.status}`)
      }

      if (hasUnexpectedPublicJobsSignal(routePage.html)) {
        throw new Error(`Common CuriousJr career route changed: ${probe.url} now exposes a public jobs surface`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createCuriousJrScraper().run(options)

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
