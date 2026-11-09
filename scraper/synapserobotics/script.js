import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'synapserobotics'
export const COMPANY = 'Synapse Robotics'
export const HOMEPAGE_URL = 'https://synapserobotics.ai/'
export const CHECKED_ROUTE_URLS = [
  'https://synapserobotics.ai/careers',
  'https://synapserobotics.ai/careers/',
  'https://synapserobotics.ai/jobs',
  'https://synapserobotics.ai/jobs/',
  'https://synapserobotics.ai/join-us',
  'https://synapserobotics.ai/join-us/',
  'https://synapserobotics.ai/work-with-us',
  'https://synapserobotics.ai/openings',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_TEXT_PATTERNS = [
  /\bjoin our team\b/i,
  /\bwe(?:'|&#8217;|&#x2019;|&rsquo;)?re hiring\b/i,
  /\bcurrent openings?\b/i,
  /\bopen positions?\b/i,
  /\bjob openings?\b/i,
  /\bview jobs?\b/i,
  /\bview openings?\b/i,
  /\bapply now\b/i,
]

const PUBLIC_JOBS_HTML_PATTERNS = [
  /<title[^>]*>[^<]*\b(careers?|jobs?|job openings?)\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /breezy\.hr/i,
  /wellfound\.com/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractVisibleText = (html) => normalizeWhitespace(
  String(html ?? '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
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
  const page = String(html ?? '')
  const text = extractVisibleText(page)

  return /<title[^>]*>\s*Synapse Robotics(?:\s*&(?:amp;)?\s*AI)?[\s\S]*California,\s*USA\s*<\/title>/i.test(page)
    && text.includes('Build. Code. Explore!')
    && text.includes('K through College')
    && text.includes('CMU Robotics Academy Partner')
    && text.includes('VEX Certified')
    && text.includes('Jyothsna J')
    && text.includes('(925) 819-3960')
    && text.includes('jyothsnaj@synapserobotics.net')
    && text.includes('San Ramon, California, USA')
}

export const hasPublicJobsSignal = (html) => {
  const page = String(html ?? '')
  const text = extractVisibleText(page)

  return PUBLIC_JOBS_TEXT_PATTERNS.some((pattern) => pattern.test(text))
    || PUBLIC_JOBS_HTML_PATTERNS.some((pattern) => pattern.test(page))
}

export const isVerifiedRouteFallbackShell = (pageHtml, homepageHtml) =>
  hasOfficialHomepageSignal(pageHtml)
  && !hasPublicJobsSignal(pageHtml)
  && normalizeWhitespace(pageHtml) === normalizeWhitespace(homepageHtml)

export const createSynapseRoboticsScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Synapse Robotics verified official homepage no longer matches the known first-party surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('Synapse Robotics homepage now appears to expose a public jobs surface')
    }

    for (const routeUrl of CHECKED_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (routePage.status !== 200 || !isVerifiedRouteFallbackShell(routePage.html, homepage.html)) {
        throw new Error(
          `Synapse Robotics checked first-party route changed materially or now exposes public jobs: ${routePage.url || routeUrl}`,
        )
      }
    }

    return []
  },
})

export const run = async (options = {}) => createSynapseRoboticsScraper().run(options)

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
