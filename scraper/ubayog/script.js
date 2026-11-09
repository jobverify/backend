import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'ubayog'
export const COMPANY = 'Ubayog'
export const HOMEPAGE_URL = 'https://ubayog.com/'
export const ABOUT_URL = 'https://ubayog.com/about'
export const CONTACT_URL = 'https://ubayog.com/contact'
export const NON_LISTING_ROUTE_URLS = [
  'https://ubayog.com/careers',
  'https://ubayog.com/career',
  'https://ubayog.com/jobs',
  'https://ubayog.com/hiring',
  'https://ubayog.com/join-us',
  'https://ubayog.com/openings',
  'https://ubayog.com/work-with-us',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&apos;|&rsquo;|&#39;/gi, "'")
  .replace(/&mdash;|&ndash;/gi, '-')

const normalizeWhitespace = (value) => decodeHtmlEntities(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

const normalizeMarkup = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/\u2019/g, "'")
    .replace(/[\u2013\u2014]/g, '-'),
)

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

export const hasOfficialHomepageSignal = (html) => {
  const markup = normalizeMarkup(html)
  const text = stripTags(html).toLowerCase()

  return /<title>\s*Ubayog\s*\|\s*AI-Native Asset Marketplace\s*<\/title>/i.test(markup)
    && text.includes('turn your unused things into income')
    && text.includes("find what you need. list what you don't.")
    && text.includes('the autonomous ai ecosystem that works 24/7')
    && text.includes("hi! i'm yogu")
    && text.includes('how ubayog works')
    && text.includes('loveall innovations pvt ltd')
}

export const hasOfficialAboutSignal = (html) => {
  const markup = normalizeMarkup(html)
  const text = stripTags(html).toLowerCase()

  return /<title>\s*Ubayog\s*\|\s*AI-Native Asset Marketplace\s*<\/title>/i.test(markup)
    && text.includes('understanding ubayog')
    && text.includes("ubayog is india's first ai-native asset marketplace")
    && text.includes('your personal ai broker, lawyer, negotiator, and logistics manager')
    && text.includes('verified users')
    && text.includes('secure communication')
    && text.includes('multiple business models')
}

export const hasOfficialContactSignal = (html) => {
  const markup = normalizeMarkup(html)
  const text = stripTags(html).toLowerCase()

  return /<title>\s*Ubayog\s*\|\s*AI-Native Asset Marketplace\s*<\/title>/i.test(markup)
    && text.includes("let's connect")
    && text.includes('have questions about ubayog? need help setting up an ai agent?')
    && text.includes('support@ubayog.com')
    && text.includes('+91 8050850580')
    && text.includes('loveall innovations pvt ltd')
}

export const hasVerifiedNotFoundSignal = (html) => {
  const markup = normalizeMarkup(html)
  const text = stripTags(html).toLowerCase()

  return /<title>\s*Ubayog\s*\|\s*AI-Native Asset Marketplace\s*<\/title>/i.test(markup)
    && text.includes('404')
    && text.includes('oops! page not found')
    && text.includes("yogu searched everywhere but couldn't find this page.")
    && text.includes("let's get you back on track.")
    && text.includes('go home')
    && text.includes('explore marketplace')
}

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcareers?\b/i,
  /\bjobs?\b/i,
  /\bhiring\b/i,
  /\bopen(?:ing|ings)\b/i,
  /\bjoin our team\b/i,
  /\bwork with us\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /recruitee/i,
  /zohorecruit/i,
  /freshteam/i,
  /darwinbox/i,
  /apply now/i,
  /current openings/i,
]

export const hasUnexpectedPublicJobsSignal = (html) => {
  const markup = normalizeMarkup(html)
  return PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(markup))
}

const ATS_ONLY_SIGNAL_PATTERNS = [
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /recruitee/i,
  /zohorecruit/i,
  /freshteam/i,
  /darwinbox/i,
  /apply now/i,
  /current openings/i,
  /\bjoin our team\b/i,
  /\bwork with us\b/i,
]

const hasAtsOrApplicationSignal = (html) => {
  const markup = normalizeMarkup(html)
  return ATS_ONLY_SIGNAL_PATTERNS.some((pattern) => pattern.test(markup))
}

const verifyPage = ({ page, matcher, errorMessage }) => {
  if (page.status !== 200 || !matcher(page.html)) {
    throw new Error(errorMessage)
  }

  if (hasUnexpectedPublicJobsSignal(page.html)) {
    throw new Error(`${errorMessage} now appears to expose a public jobs surface`)
  }
}

export const createUbayogScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)
    verifyPage({
      page: homepage,
      matcher: hasOfficialHomepageSignal,
      errorMessage: 'Ubayog verified official homepage no longer matches the verified first-party non-listing surface',
    })

    const aboutPage = await fetchPage(ABOUT_URL)
    verifyPage({
      page: aboutPage,
      matcher: hasOfficialAboutSignal,
      errorMessage: 'Ubayog verified official about page no longer matches the verified first-party non-listing surface',
    })

    const contactPage = await fetchPage(CONTACT_URL)
    verifyPage({
      page: contactPage,
      matcher: hasOfficialContactSignal,
      errorMessage: 'Ubayog verified official contact page no longer matches the verified first-party non-listing surface',
    })

    for (const routeUrl of NON_LISTING_ROUTE_URLS) {
      const page = await fetchPage(routeUrl)

      if (page.status !== 404 || !hasVerifiedNotFoundSignal(page.html) || hasAtsOrApplicationSignal(page.html)) {
        throw new Error(`Ubayog checked non-listing route changed materially or now exposes public jobs: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createUbayogScraper().run(options)

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
