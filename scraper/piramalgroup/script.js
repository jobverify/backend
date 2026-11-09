import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'piramalgroup'
export const COMPANY = 'Piramal Group'
export const HOMEPAGE_URL = 'https://www.piramal.com/'
export const NO_PUBLIC_CAREERS_ROUTE_URLS = [
  'https://www.piramal.com/careers',
  'https://www.piramal.com/careers/',
  'https://www.piramal.com/jobs',
  'https://www.piramal.com/jobs/',
  'https://www.piramal.com/join-us',
  'https://www.piramal.com/join-us/',
]
export const EXPECTED_HANDOFF_URLS = [
  '/#Careers',
  '#JoinOurTeam',
  'https://www.piramalpharma.com/careers',
  'https://www.piramalrealty.com/careers',
  'https://www.piramalfinance.com/careers',
  'https://piramalfoundation.org/jobs',
  '#Careers',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob listings?\b/i,
  /\bjob postings?\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /\brequisition\b/i,
  /\breq(?:uisition)?\s*id\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /freshteam/i,
  /zohorecruit/i,
]

const CAREER_HANDOFF_PATTERN = /\b(careers?|jobs?|join our team)\b/i

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/&amp;/gi, '&')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeComparableUrl = (value) => {
  const input = String(value ?? '').trim()
  if (!input) return ''

  if (input.startsWith('#') || input.startsWith('/#')) {
    return input
  }

  try {
    const url = new URL(input)
    const pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '')
    return `${url.origin}${pathname}${url.search}${url.hash}`
  } catch {
    return input.replace(/\/+$/, '')
  }
}

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

const hasSameValues = (actual, expected) =>
  actual.length === expected.length && actual.every((value, index) => value === expected[index])

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title>\s*Welcome to the official website of the Piramal Group\.\s*<\/title>/i.test(rawHtml)
    && /<meta\s+name=["']description["']\s+content=["']Welcome to the official website of the Piramal Group\.["']/i.test(rawHtml)
    && /id=["']Careers["']/i.test(rawHtml)
    && /id=["']JoinOurTeam["']/i.test(rawHtml)
    && /href=["']\/#Careers["']/i.test(rawHtml)
    && /\bLife at Piramal\b/i.test(normalized)
    && /\bJoin Our Team\b/i.test(normalized)
    && normalized.includes(
      'Our people, their growth and continuous learning at the workplace are above everything. With a diverse and inclusive culture, exceed your own expectations everyday.',
    )
}

export const extractCareerHandoffUrls = (html) => {
  const urls = []
  const seen = new Set()
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi

  for (const match of String(html ?? '').matchAll(anchorPattern)) {
    const href = normalizeComparableUrl(match[1])
    const text = normalizeWhitespace(match[2])

    if (!href) continue
    if (!CAREER_HANDOFF_PATTERN.test(`${href} ${text}`)) continue
    if (seen.has(href)) continue

    seen.add(href)
    urls.push(href)
  }

  return urls
}

export const hasUnexpectedPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const isMissingCareerRoute = (page) => Number(page?.status) === 404

export const createPiramalGroupScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Piramal Group verified official homepage no longer matches the known public surface')
    }

    if (hasUnexpectedPublicJobsSignal(homepage.html)) {
      throw new Error('Piramal Group homepage now appears to expose a public jobs surface')
    }

    const handoffUrls = extractCareerHandoffUrls(homepage.html)
    if (!hasSameValues(handoffUrls, EXPECTED_HANDOFF_URLS)) {
      throw new Error('Piramal Group careers handoff no longer matches the verified subsidiary-only surface')
    }

    for (const routeUrl of NO_PUBLIC_CAREERS_ROUTE_URLS) {
      const routePage = await fetchPage(routeUrl)

      if (!isMissingCareerRoute(routePage)) {
        throw new Error(`Piramal Group verified no-public-careers route changed: ${routePage.url || routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createPiramalGroupScraper().run(options)

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
