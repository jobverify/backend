import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PRISTYN_CARE_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&rsquo;|&lsquo;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url) => {
  try {
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
  } catch (error) {
    return {
      status: null,
      url,
      html: null,
      error: String(error),
    }
  }
}

export const SOURCE = PRISTYN_CARE_CATALOG.source
export const COMPANY = PRISTYN_CARE_CATALOG.companyName
export const PROVIDER_METADATA = PRISTYN_CARE_CATALOG
export const CAREERS_URL = PRISTYN_CARE_CATALOG.companyCareerPage
export const SKILLATE_HANDOFF_URL = PRISTYN_CARE_CATALOG.officialJobsHandoffUrl
export const VERIFIED_AT = PRISTYN_CARE_CATALOG.verifiedOn

export const extractSkillateHandoffUrl = (html) =>
  normalizeWhitespace(
    String(html ?? '').match(/href=["'](https:\/\/pristyncare\.skillate\.com\/)["']/i)?.[1] ?? null,
  )

const extractFeaturedPositionsMarkup = (html) =>
  String(html ?? '').match(/<div class=["']featuredPositionsJobsContainer["']>([\s\S]*?)<\/div>/i)?.[1]
  ?? null

export const hasInlineFeaturedJobs = (html) => {
  const markup = extractFeaturedPositionsMarkup(html)
  if (!markup) return false

  return /<a\b|<article\b|<h2\b|View Job|Apply/i.test(markup)
    || normalizeWhitespace(markup).length > 0
}

export const hasOfficialPristynCareersSignal = (html) => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Career Page\s*<\/title>/i.test(page)
    && /Pristyn Care Careers/i.test(normalized)
    && /Featured Positions/i.test(normalized)
    && /featuredPositionsJobsContainer/i.test(page)
    && /VIEW ALL JOBS/i.test(normalized)
    && extractSkillateHandoffUrl(page) === SKILLATE_HANDOFF_URL
}

export const isUnreachableSkillateHandoff = (page) =>
  /fetch failed|could not connect to server|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(
    String(page?.error ?? ''),
  )

export const createPristynCareScraper = () => ({
  async run({ fetchPage = defaultFetchPage } = {}) {
    const careersPage = await fetchPage(CAREERS_URL)
    if (!hasOfficialPristynCareersSignal(careersPage.html)) {
      throw new Error('Pristyn Care official careers page changed materially')
    }

    if (hasInlineFeaturedJobs(careersPage.html)) {
      throw new Error('Pristyn Care official careers page changed materially or now exposes inline featured jobs')
    }

    const skillatePage = await fetchPage(SKILLATE_HANDOFF_URL)
    if (!isUnreachableSkillateHandoff(skillatePage)) {
      throw new Error('Pristyn Care Skillate handoff changed materially or now exposes a reachable public jobs surface')
    }

    return []
  },
})

export const run = async (options = {}) => createPristynCareScraper().run(options)

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
