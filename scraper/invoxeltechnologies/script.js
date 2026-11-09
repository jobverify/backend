import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'invoxeltechnologies'
export const COMPANY = 'Invoxel Technologies'
export const HOMEPAGE_URL = 'https://www.invoxel.com/'
export const CAREERS_URL = 'https://www.invoxel.com/careers/'
export const CAREER_URL = 'https://www.invoxel.com/career/'
export const JOBS_URL = 'https://www.invoxel.com/jobs/'
export const JOIN_US_URL = 'https://www.invoxel.com/join-us/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOB_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /\bapply now\b/i,
  /\bjob description\b/i,
  /boards\.greenhouse\.io/i,
  /jobs\.lever\.co/i,
  /workdayjobs/i,
  /myworkdayjobs/i,
]

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
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

export const extractBundlePath = (html) => {
  const match = /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']*\/reactassets\/index-[^"']+\.js)["']/i.exec(
    String(html ?? ''),
  )

  return match?.[1] ?? null
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const normalized = normalizeWhitespace(rawHtml)

  return /<title[^>]*>\s*Invoxel Technologies\s*<\/title>/i.test(rawHtml)
    && /<div[^>]+id=["']root["'][^>]*>/i.test(rawHtml)
    && /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']\/reactassets\/index-[^"']+\.js["']/i.test(rawHtml)
    && normalized.includes('Invoxel Technologies')
    && extractBundlePath(rawHtml) !== null
}

export const hasVerifiedCareersShellSignal = (bundleJs) => {
  const rawJs = String(bundleJs ?? '')
  const normalized = normalizeWhitespace(rawJs)

  return rawJs.includes('https://forms.gle/DKxYTAfrgm6z9cmw5')
    && /BE A PART OF THE ORGANISATION AND BUILD TOGETHER!/i.test(normalized)
    && /Ready to create impact\?/i.test(normalized)
    && /\bCAREER\b/i.test(normalized)
    && /\bAPPLY\b/i.test(normalized)
}

export const hasPublicJobSignal = (content) =>
  PUBLIC_JOB_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(content ?? '')))

export const createInvoxelTechnologiesScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('Invoxel Technologies verified official homepage no longer matches the known public surface')
    }

    const bundlePath = extractBundlePath(homepage.html)
    if (!bundlePath) {
      throw new Error('Invoxel Technologies homepage no longer exposes the verified client bundle')
    }

    const bundleUrl = new URL(bundlePath, HOMEPAGE_URL).toString()
    const bundle = await fetchPage(bundleUrl)

    if (bundle.status !== 200 || !hasVerifiedCareersShellSignal(bundle.html)) {
      throw new Error('Invoxel Technologies verified careers shell no longer matches the known public surface')
    }

    if (hasPublicJobSignal(bundle.html)) {
      throw new Error('Invoxel Technologies careers surface now appears to expose public job listings')
    }

    for (const routeUrl of [CAREERS_URL, CAREER_URL, JOBS_URL, JOIN_US_URL]) {
      const routePage = await fetchPage(routeUrl)

      if (routePage.status !== 404) {
        throw new Error(`Invoxel Technologies verified no-public-careers route changed: ${routeUrl}`)
      }
    }

    return []
  },
})

export const run = async (options = {}) => createInvoxelTechnologiesScraper().run(options)

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
