import path from 'node:path'
import { fileURLToPath } from 'node:url'

import SPRINGWORKS_CATALOG from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SPRINGWORKS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn
export const ABOUT_URL = PROVIDER_METADATA.aboutUrl
export const HANDOFF_URL = PROVIDER_METADATA.handoffUrl
export const JOBS_URL = PROVIDER_METADATA.jobsUrl
export const HANDOFF_FINAL_URL = 'https://jobs.goodfit.so/careers/springworks'
export const JOBS_FALLBACK_URL = 'https://v2.app.goodfit.so/jobs/springworks'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
  .replace(/\s+/g, ' ')
  .trim()

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;|&#x27;/gi, "'")
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#038;|&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const extractTitle = (html = '') => {
  const match = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return normalizeWhitespace(match?.[1]) || null
}

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
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

const sameUrl = (left, right) => String(left ?? '').replace(/\/$/, '') === String(right ?? '').replace(/\/$/, '')
const sameUrlAny = (actual, expectedUrls) => expectedUrls.some((expectedUrl) => sameUrl(actual, expectedUrl))

const stripTags = (value = '') => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' '),
)

export const hasFirstPartyAboutSignal = (html = '') => {
  const normalized = stripTags(html).toLowerCase()
  const title = (extractTitle(html) || '').toLowerCase()

  return title.includes('springworks')
    && normalized.includes('join our team')
    && normalized.includes('work with us')
    && String(html ?? '').includes(HANDOFF_URL)
}

export const hasGoodfitHandoffSignal = (html = '') => {
  const normalized = stripTags(html).toLowerCase()
  const title = (extractTitle(html) || '').toLowerCase()
  const rawHtml = String(html ?? '').toLowerCase()

  return (
    title.includes('springworks at springworks')
      && normalized.includes('goodfit')
      && rawHtml.includes('noindex')
  ) || (
    title.includes('goodfit')
      && normalized.includes('open positions')
      && rawHtml.includes('https://jobs.goodfit.so/jobs/springworks')
      && /\/jobs\/springworks\//i.test(String(html ?? ''))
  )
}

export const hasGoodfitJobsSignal = (html = '') => {
  const normalized = stripTags(html).toLowerCase()
  const rawHtml = String(html ?? '').toLowerCase()

  return rawHtml.includes('https://jobs.goodfit.so/jobs/springworks')
    && normalized.includes('open positions')
    && normalized.includes('remote')
    && /\/jobs\/springworks\//i.test(String(html ?? ''))
}

export const extractSpringworksJobs = (html = '') => {
  const cards = []
  const seen = new Set()
  const pattern = /<a[^>]+href="(\/jobs\/springworks\/[^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*font-medium[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span[^>]*class="[^"]*text-xs[^"]*"[^>]*>([\s\S]*?)<\/span>/gi

  for (const match of String(html ?? '').matchAll(pattern)) {
    const relativeUrl = match[1]
    const sourceUrl = new URL(relativeUrl, JOBS_URL).toString()
    if (seen.has(sourceUrl)) continue
    seen.add(sourceUrl)

    const title = normalizeWhitespace(decodeHtmlEntities(match[2]))
    const locationText = normalizeWhitespace(decodeHtmlEntities(match[3]))
    if (!title || !locationText) continue

    cards.push({
      title,
      company: COMPANY,
      department: null,
      location: locationText,
      city: null,
      country: /india/i.test(locationText) || /remote/i.test(locationText) ? 'India' : null,
      jobId: sourceUrl.split('id=').pop() || relativeUrl,
      requisitionId: sourceUrl.split('id=').pop() || relativeUrl,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: /intern/i.test(title) ? 'Internship' : null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    })
  }

  return cards
}

export const createSpringworksScraper = () => ({
  async run({ fetchPage = defaultFetchPage, now = () => new Date().toISOString(), signal } = {}) {
    signal?.throwIfAborted()
    const aboutPage = await fetchPage(ABOUT_URL, { signal })
    signal?.throwIfAborted()
    if (
      aboutPage.status !== 200
      || !sameUrl(aboutPage.url, ABOUT_URL)
      || !hasFirstPartyAboutSignal(aboutPage.html)
    ) {
      throw new Error('Springworks first-party about page no longer matches the trusted careers handoff surface')
    }

    const handoffPage = await fetchPage(HANDOFF_URL, { signal })
    signal?.throwIfAborted()
    if (
      handoffPage.status !== 200
      || !sameUrlAny(handoffPage.url, [HANDOFF_URL, HANDOFF_FINAL_URL, JOBS_URL])
      || !hasGoodfitHandoffSignal(handoffPage.html)
    ) {
      throw new Error('Springworks Goodfit handoff page no longer matches the trusted goodfit handoff surface')
    }

    const jobsPage = await fetchPage(JOBS_URL, { signal })
    signal?.throwIfAborted()
    if (
      jobsPage.status !== 200
      || !sameUrlAny(jobsPage.url, [JOBS_URL, JOBS_FALLBACK_URL])
      || !hasGoodfitJobsSignal(jobsPage.html)
    ) {
      throw new Error('Springworks Goodfit jobs page no longer matches the verified SSR jobs surface')
    }

    const jobs = extractSpringworksJobs(jobsPage.html)
    if (jobs.length === 0) {
      throw new Error('Springworks verified jobs page no longer exposes trusted public role cards')
    }

    const count = normalizeWhitespace(jobsPage.html.match(/<h2[^>]*>([\s\S]*?Open Positions[\s\S]*?)<\/h2>/i)?.[1]).match(/Open Positions\s+(\d+)/i)
    if (!count || jobs.length !== Number(count[1])) {
      throw new Error('Springworks incomplete jobs snapshot: public role count does not match parsed cards')
    }

    return jobs.filter((job) => job.country === 'India').map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl || job.sourceUrl,
      scrapedAt: now(),
    }))
  },
})

export const run = async (options = {}) => createSpringworksScraper().run(options)

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
