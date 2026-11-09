import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'kodnest'
export const COMPANY = 'KodNest'
export const HOMEPAGE_URL = 'https://www.kodnest.com/'
export const CAREERS_ROUTE_URLS = [
  'https://www.kodnest.com/careers',
  'https://www.kodnest.com/careers/',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const PUBLIC_JOBS_SIGNAL_PATTERNS = [
  /"@type"\s*:\s*"JobPosting"/i,
  /\bcurrent openings\b/i,
  /\bopen positions\b/i,
  /\bjob openings\b/i,
  /\bsearch jobs\b/i,
  /\bapply now\b/i,
  /\bjoin our team\b/i,
  /\bvacanc(?:y|ies)\b/i,
  /jobs\.lever\.co/i,
  /boards\.greenhouse\.io/i,
  /job-boards\.greenhouse\.io/i,
  /ashbyhq\.com/i,
  /myworkdayjobs/i,
  /workdayjobs/i,
  /smartrecruiters/i,
  /jobvite/i,
  /zohorecruit/i,
]

const BUNDLE_REQUIRED_PATTERNS = [
  /\bKodNest\b/i,
  /from\s*:\s*["']\/careers["']\s*,\s*action\s*:\s*["']410["']\s*,\s*note\s*:\s*["']P0:\s*no careers page yet["']/i,
  /from\s*:\s*["']\/privacy-policy["']\s*,\s*to\s*:\s*["']\/legal\/privacy["']\s*,\s*action\s*:\s*["']301["']/i,
]

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
    headers: {
      location: response.headers.get('location'),
    },
    html: await response.text(),
  }
}

const defaultFetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/javascript,text/javascript,text/plain;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  return response.text()
}

export const extractBundleAssetPath = (html) => {
  const match = String(html ?? '').match(
    /<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["']([^"']*\/assets\/index-[^"']+\.js)["']/i,
  )

  return match?.[1] ?? null
}

export const hasOfficialHomepageSignal = (html) => {
  const rawHtml = String(html ?? '')
  const legacyIdentity = /<title>\s*KodNest[^<]*Placement-ready engineering training\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+name=["']description["'][^>]+content=["']KodNest helps freshers become placement-ready with hands-on Java, Python, Data Science (?:&amp;|&) GenAI tracks, real projects, and outcome-driven coaching\.["']/i.test(rawHtml)
    && /<meta[^>]+property=["']og:url["'][^>]+content=["']https:\/\/kodnest\.com["']/i.test(rawHtml)
  const hasOrganizationIdentity = [...rawHtml.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].some(match => {
    try {
      const organization = JSON.parse(match[1])
      return organization['@type'] === 'EducationalOrganization' && organization.name === 'KodNest' && organization.url === 'https://kodnest.com'
    } catch { return false }
  })
  const currentIdentity = /<title>\s*KodNest (?:—|-) We Build Careers \| Career Outcome Engine\s*<\/title>/i.test(rawHtml)
    && /<meta[^>]+name=["']description["'][^>]+content=["']KodNest is a Career Outcome Engine\. We Build Careers\.["']/i.test(rawHtml)
    && /<meta[^>]+property=["']og:site_name["'][^>]+content=["']KodNest["']/i.test(rawHtml)
    && hasOrganizationIdentity
  return (legacyIdentity || currentIdentity)
    && /<meta[^>]+name=["']author["'][^>]+content=["']KodNest["']/i.test(rawHtml)
    && /<meta[^>]+name=["']twitter:site["'][^>]+content=["']@KodNest["']/i.test(rawHtml)
    && /<div id=["']root["']><\/div>/i.test(rawHtml)
    && extractBundleAssetPath(rawHtml) !== null
}

export const hasPublicJobsSignal = (html) =>
  PUBLIC_JOBS_SIGNAL_PATTERNS.some((pattern) => pattern.test(String(html ?? '')))

export const hasVerifiedBundleSignal = (bundleText) =>
  BUNDLE_REQUIRED_PATTERNS.every((pattern) => pattern.test(String(bundleText ?? '')))

export const routeMatchesVerifiedShell = (html, bundlePath) =>
  hasOfficialHomepageSignal(html)
  && extractBundleAssetPath(html) === bundlePath
  && !hasPublicJobsSignal(html)


export const PUBLIC_CAREERS_URL = 'https://kodnest.com/career'
const PUBLIC_CAREERS_BACKEND = 'https://copqjvapsjgzgzxfsrrf.supabase.co'

const extractPublicCareersConfig = (bundle = '') => {
  const hubPath = bundle.match(/assets\/CareerHub-[A-Za-z0-9_-]+\.js/)?.[0]
  if (!hubPath) return null
  const dataPath = bundle.match(/assets\/careers-[A-Za-z0-9_-]+\.js/)?.[0]
  const origin = bundle.match(/https:\/\/[a-z0-9]+\.supabase\.co/)?.[0]
  const keys = [...new Set([...bundle.matchAll(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)].map((match) => match[0]))]
  const publicKeys = keys.filter((key) => {
    try {
      const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
      return claims.role === 'anon' && claims.ref === 'copqjvapsjgzgzxfsrrf'
    } catch {
      return false
    }
  })
  if (!dataPath || origin !== PUBLIC_CAREERS_BACKEND || publicKeys.length !== 1) {
    throw new Error('KodNest verified public careers backend changed materially')
  }
  return { origin, key: publicKeys[0], hubPath, dataPath }
}

const defaultFetchJson = (url, options = {}) => fetchJsonWithRetry(url, {
  ...options, label: SOURCE, timeoutMs: 15000,
})

const readPublicCareers = async ({ config, bundleAssetPath, fetchPage, fetchText, fetchJson, now, pageSize, maxPages }) => {
  const careersPage = await fetchPage(PUBLIC_CAREERS_URL)
  if (careersPage.status !== 200 || !routeMatchesVerifiedShell(careersPage.html, bundleAssetPath)) {
    throw new Error('KodNest verified public careers shell changed materially')
  }
  const hub = await fetchText(new URL(config.hubPath, HOMEPAGE_URL).toString())
  const dataModule = await fetchText(new URL(config.dataPath, HOMEPAGE_URL).toString())
  if (!hub.includes('Careers at KodNest') || !hub.includes(PUBLIC_CAREERS_URL)
    || !hub.includes('/career/')
    || !/\.from\(["']career_jobs["']\)\.select\(["']\*["']\)\.eq\(["']status["'],["']published["']\)/.test(dataModule)) {
    throw new Error('KodNest verified public careers client contract changed materially')
  }
  const scrapedAt = now()
  const currentTime = new Date(scrapedAt).getTime()
  const jobs = new Map()
  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL('/rest/v1/career_jobs', config.origin)
    url.search = new URLSearchParams({ select: '*', status: 'eq.published', order: 'published_at.desc', limit: String(pageSize), offset: String(page * pageSize) }).toString()
    const records = await fetchJson(url.toString(), { headers: { apikey: config.key, Authorization: 'Bearer ' + config.key } })
    if (!Array.isArray(records)) throw new Error('KodNest careers feed no longer returns a jobs array')
    for (const record of records) {
      if (!record?.id || !record.slug || !record.title || record.status !== 'published') {
        throw new Error('KodNest careers feed contains an invalid published job')
      }
      if (record.closes_at && !Number.isFinite(Date.parse(record.closes_at))) {
        throw new Error('KodNest careers feed contains an invalid closing date')
      }
      if (record.closes_at && currentTime >= Date.parse(record.closes_at)) continue
      const location = record.location_label || ''
      if (!/\b(?:India|Bengaluru|Bangalore)\b/i.test(location)) continue
      const sourceUrl = PUBLIC_CAREERS_URL + '/' + encodeURIComponent(record.slug)
      const jobDescription = [record.summary, record.jd_markdown, ...(record.responsibilities || []), ...(record.requirements || []), ...(record.perks || [])].filter(Boolean).join('\n')
      jobs.set(record.id, {
        title: record.title, company: COMPANY, source: SOURCE,
        jobId: SOURCE + '-' + record.id, requisitionId: record.id,
        location, city: /Bengaluru|Bangalore/i.test(location) ? 'Bengaluru' : null, country: 'India',
        employmentType: ({ full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract', intern: 'Internship' })[record.employment_type] || null,
        remoteStatus: /remote/i.test(location) ? 'Remote' : /hybrid/i.test(location) ? 'Hybrid' : 'On-site',
        experienceRequired: record.experience_min == null ? null : String(record.experience_min) + (record.experience_max == null ? '+' : '-' + record.experience_max) + ' years',
        department: null, minimumQualification: null, preferredQualification: null, requiredSkills: [],
        jobDescription: jobDescription || null, postingDate: record.published_at || null, closingDate: record.closes_at || null,
        link: sourceUrl, sourceUrl, applyUrl: sourceUrl, companyCareerPage: PUBLIC_CAREERS_URL, companyDomain: 'kodnest.com',
        atsPlatform: 'official-company-site', scrapedAt,
      })
    }
    if (records.length < pageSize) return [...jobs.values()]
  }
  throw new Error('KodNest careers feed exceeded the verified pagination limit')
}

export const createKodNestScraper = ({ now = () => new Date().toISOString(), pageSize = 100, maxPages = 25 } = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
  } = {}) {
    const homepage = await fetchPage(HOMEPAGE_URL)

    if (homepage.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
      throw new Error('KodNest verified official homepage no longer matches the known public surface')
    }

    if (hasPublicJobsSignal(homepage.html)) {
      throw new Error('KodNest homepage now appears to expose a public jobs surface')
    }

    const bundleAssetPath = extractBundleAssetPath(homepage.html)
    if (!bundleAssetPath) {
      throw new Error('KodNest homepage no longer exposes the verified client bundle')
    }

    const bundleUrl = new URL(bundleAssetPath, HOMEPAGE_URL).toString()
    const bundleText = await fetchText(bundleUrl)
    const publicCareersConfig = extractPublicCareersConfig(bundleText)
    if (publicCareersConfig) {
      return readPublicCareers({ config: publicCareersConfig, bundleAssetPath, fetchPage, fetchText, fetchJson, now, pageSize, maxPages })
    }
    if (!hasVerifiedBundleSignal(bundleText)) {
      throw new Error('KodNest client bundle changed materially or no longer confirms the verified no-careers route contract')
    }

    for (const careersRouteUrl of CAREERS_ROUTE_URLS) {
      const careersRoute = await fetchPage(careersRouteUrl)

      if (careersRoute.status !== 200 || !routeMatchesVerifiedShell(careersRoute.html, bundleAssetPath)) {
        throw new Error('KodNest careers routes changed materially or now expose public jobs')
      }
    }

    return []
  },
})

export const run = async (options = {}) => createKodNestScraper().run(options)

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
