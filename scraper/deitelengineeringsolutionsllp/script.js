import {readRoleAreas,verifyHomepage,finish,nativeFetch} from './native.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'deitelengineeringsolutionsllp'
export const COMPANY = 'DEITEL Engineering Solutions LLP'
export const HOMEPAGE_URL = 'https://deitel.in/'
export const CAREERS_URL = 'https://deitel.in/career/'
export const APPLICATION_EMAIL = 'hr@deitel.in'
export const APPLICATION_URL = `mailto:${APPLICATION_EMAIL}`

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decodeHtml = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtml(String(value ?? ''))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  decodeHtml(String(value ?? ''))
    .replace(/<[^>]+>/g, ' '),
)

const slugify = (value) => normalizeWhitespace(value)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || null

const buildJobDescription = () =>
  `Official ${COMPANY} role area published on the first-party careers page. Apply via ${APPLICATION_EMAIL}.`

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*DEITEL\s*(?:&#8211;|&ndash;|-)\s*Engineering\|Resource\|Solutions\s*<\/title>/i.test(page)
    && /Engineering\|Resource\|Solutions/i.test(page)
    && /href=["'](?:https:\/\/deitel\.in)?\/career\/["']/i.test(page)
}

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Career\s*(?:&#8211;|&ndash;|-)\s*DEITEL\s*<\/title>/i.test(page)
    && /<link rel=["']canonical["'] href=["']https:\/\/deitel\.in\/career\/["']/i.test(page)
    && /Candidates with relevant experience in following areas can apply to/i.test(page)
    && /hr@deitel\.in/i.test(page)
}

const extractRoleTitles = (html) => {
  const listHtml = String(html ?? '').match(
    /Candidates with relevant experience in following areas can apply to[\s\S]*?<ul>([\s\S]*?)<\/ul>/i,
  )?.[1]

  return [...String(listHtml ?? '').matchAll(/<li>([\s\S]*?)<\/li>/gi)]
    .map((match) => stripTags(match[1]))
    .filter(Boolean)
}

export const extractOpenings = readRoleAreas

const defaultFetchText = nativeFetch

export const createDeitelEngineeringSolutionsLlpScraper = ({
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ fetchText = defaultFetchText, now: overrideNow, signal } = {}) {
    signal?.throwIfAborted()
    const homepageHtml = await fetchText(HOMEPAGE_URL,{signal})
    verifyHomepage(homepageHtml)
    if (!hasOfficialHomepageSignal(homepageHtml)) {
      throw new Error('DEITEL Engineering Solutions LLP verified official homepage changed')
    }

    const careersHtml = await fetchText(CAREERS_URL,{signal})
    const jobs = extractOpenings(careersHtml)

    return finish(jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: (overrideNow || now)(),
    })),{...jobs.nativeCollectionEvidence,pagesFetched:2,now:overrideNow||now})
  },
})

export const run = async (options = {}) => createDeitelEngineeringSolutionsLlpScraper().run(options)

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
