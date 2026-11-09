import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const REQUEST_TIMEOUT_MS = 15000
const JOB_LINK_PATTERN = /^https:\/\/www\.orioninnovation\.com\/careers\/job\/\?gh_jid=\d+$/i
const INDIA_LOCATION_MARKERS = [
  'india',
  'andhra pradesh',
  'bengaluru',
  'bangalore',
  'chennai',
  'coimbatore',
  'delhi',
  'gurgaon',
  'gurugram',
  'hyderabad',
  'kerala',
  'kochi',
  'kolkata',
  'karnataka',
  'maharashtra',
  'mumbai',
  'noida',
  'pune',
  'tamil nadu',
]

export const SOURCE = 'orioninnovation'
export const COMPANY = 'Orion Innovation'
export const CAREERS_PAGE_URL = 'https://www.orioninnovation.com/careers/life-at-orion/'
export const OPEN_JOBS_URL = 'https://www.orioninnovation.com/careers/job/'
export const VERIFIED_ON = '2026-08-14'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/<(br|\/p|\/div|\/li|\/span|\/h[1-6]|\/section|\/article|\/ul|\/ol)\b[^>]*>/gi, '\n')
  .replace(/<(p|div|li|span|section|article|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\u00a0/g, ' ')
  .replace(/[–—]/g, '-')
  .replace(/\s+/g, ' ')
  .trim()

const extractTitle = (html = '') => normalizeWhitespace(
  String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1],
)

const stripTags = (value = '') => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/span|\/h[1-6]|\/section|\/article|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<(p|div|li|span|section|article|ul|ol|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractLinksFromHtml = (html = '') => [...String(html ?? '').matchAll(
  /<a\b[^>]*href=(["'])([^"']+)\1[^>]*>([\s\S]*?)<\/a>/gi,
)].map(([, , href, innerHtml]) => ({
  href: normalizeWhitespace(href),
  text: stripTags(innerHtml),
}))

const toPageData = (pageOrHtml, fallbackUrl = null) => {
  if (typeof pageOrHtml === 'string') {
    const html = String(pageOrHtml)
    return {
      status: 200,
      url: fallbackUrl,
      finalUrl: fallbackUrl,
      html,
      title: extractTitle(html),
      text: stripTags(html),
      links: extractLinksFromHtml(html),
    }
  }

  const page = pageOrHtml ?? {}
  const html = typeof page.html === 'string' ? page.html : ''

  return {
    ...page,
    html,
    title: normalizeWhitespace(page.title) || extractTitle(html),
    text: normalizeWhitespace(page.text) || stripTags(html),
    links: Array.isArray(page.links)
      ? page.links.map((link) => ({
        href: normalizeWhitespace(link?.href),
        text: normalizeWhitespace(link?.text),
      }))
      : extractLinksFromHtml(html),
  }
}

const uniqueBy = (items, getKey) => {
  const seen = new Set()
  const results = []

  for (const item of items) {
    const key = getKey(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    results.push(item)
  }

  return results
}

const extractJobIdFromUrl = (value) => {
  try {
    return new URL(String(value ?? '')).searchParams.get('gh_jid')
  } catch {
    return null
  }
}

const isIndiaLocation = (location = '') => {
  const normalized = normalizeWhitespace(location).toLowerCase()
  return INDIA_LOCATION_MARKERS.some((marker) => normalized.includes(marker))
}

const deriveCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  if (/^india(?:\b|,)/i.test(normalized) || /\bremote\b/i.test(normalized)) {
    return 'Remote'
  }

  return normalized.split(/[,|]/)[0]?.trim() || null
}

export const hasVerifiedCloudflareChallengeSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(page)
    && normalized.includes('Enable JavaScript and cookies to continue')
    && /challenges\.cloudflare\.com/i.test(page)
    && /orioninnovation\.com/i.test(page)
    && /_cf_chl_opt/i.test(page)
}

export const exposesStructuredPublicJobs = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page)

  return /gh_jid=/i.test(page)
    || /\bOpen Jobs\b/i.test(normalized)
    || /\bOpen Positions\b/i.test(normalized)
    || /\bLoad more\b/i.test(normalized)
    || /\bExplore Opportunities\b/i.test(normalized)
    || /\bWhere people grow and innovation thrives\b/i.test(normalized)
}

export const hasOfficialCareersSignal = (pageOrHtml = '') => {
  const page = toPageData(pageOrHtml, CAREERS_PAGE_URL)
  const haystack = [
    page.title,
    page.text,
    ...page.links.map((link) => link?.href),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes('life at orion')
    && haystack.includes('/careers/job/')
    && haystack.includes('explore opportunities')
    && (
      haystack.includes('where people grow and innovation thrives')
      || haystack.includes("ready to build what's next")
      || haystack.includes('explore open roles today')
      || haystack.includes("join a team that's redefining what's possible")
    )
}

export const hasOfficialOpenJobsSignal = (pageOrHtml = '') => {
  const page = toPageData(pageOrHtml, OPEN_JOBS_URL)
  const haystack = [page.title, page.text].filter(Boolean).join(' ').toLowerCase()
  const hasKnownJobLinks = page.links.some((link) => JOB_LINK_PATTERN.test(link?.href || ''))

  return /job - orion innovation/i.test(page.title || '')
    && haystack.includes('open jobs')
    && haystack.includes('open positions')
    && (
      hasKnownJobLinks
      || /gh_jid=/i.test(page.html)
    )
}

export const extractJobsFromCards = (cards = []) => uniqueBy(
  (Array.isArray(cards) ? cards : [])
    .map((card) => {
      const sourceUrl = normalizeWhitespace(card?.href)
      const location = normalizeWhitespace(card?.location)
      const title = normalizeWhitespace(card?.title)
      const department = normalizeWhitespace(card?.category)
      const employmentType = normalizeWhitespace(card?.workType) || null
      const jobId = extractJobIdFromUrl(sourceUrl)

      if (!title || !location || !jobId || !JOB_LINK_PATTERN.test(sourceUrl || '')) {
        return null
      }

      if (!isIndiaLocation(location)) {
        return null
      }

      return {
        title,
        company: COMPANY,
        department,
        location,
        city: deriveCity(location),
        country: 'India',
        jobId,
        requisitionId: jobId,
        sourceUrl,
        applyUrl: sourceUrl,
        employmentType,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
      }
    })
    .filter(Boolean),
  (job) => job.sourceUrl,
)

const extractJobsFromHtml = (html = '') => {
  const cards = [...String(html ?? '').matchAll(
    /<a\b[^>]*href=(["'])(https:\/\/www\.orioninnovation\.com\/careers\/job\/\?gh_jid=\d+)\1[^>]*>([\s\S]*?)<\/a>/gi,
  )].map(([, , href, innerHtml]) => {
    const normalizedText = stripTags(innerHtml)
    const title = normalizeWhitespace(
      String(innerHtml).match(/<h[1-6][^>]*>\s*([\s\S]*?)\s*<\/h[1-6]>/i)?.[1]
      || normalizedText.split(/Location:/i)[0],
    )
    const location = normalizeWhitespace(
      normalizedText.match(/Location:\s*(.+?)(?=\s+Category:|\s+Work Type:|$)/i)?.[1],
    )
    const category = normalizeWhitespace(
      normalizedText.match(/Category:\s*(.+?)(?=\s+Work Type:|$)/i)?.[1],
    )
    const workType = normalizeWhitespace(
      normalizedText.match(/Work Type:\s*(.+?)$/i)?.[1],
    )

    return {
      title,
      location,
      category,
      workType,
      href: normalizeWhitespace(href),
    }
  })

  return extractJobsFromCards(cards)
}

const defaultFetchPage = async (url) => {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    return {
      status: response.status,
      url,
      finalUrl: response.url,
      html: await response.text(),
      errorKind: null,
    }
  } catch (error) {
    clearTimeout(timeout)

    return {
      status: null,
      url,
      finalUrl: url,
      html: null,
      errorKind: error?.name === 'AbortError' ? 'timeout' : 'network',
      errorMessage: String(error?.message ?? error),
    }
  }
}

export const createOrionInnovationScraper = ({
  maxJobs = null,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    collectPageDataImpl = null,
    readRenderedJobCardsImpl = null,
    launchBrowserImpl = null,
    createOptimizedPageImpl = null,
    now = () => new Date().toISOString(),
  } = {}) {
    const browserContext = (
      typeof launchBrowserImpl === 'function' && typeof createOptimizedPageImpl === 'function'
    )
      ? await (async () => {
        const browser = await launchBrowserImpl()

        try {
          return {
            browser,
            careersPage: await createOptimizedPageImpl(browser),
            jobsPage: await createOptimizedPageImpl(browser),
            async close() {
              await browser.close?.().catch?.(() => {})
            },
          }
        } catch (error) {
          await browser.close?.().catch?.(() => {})
          throw error
        }
      })()
      : null

    try {
      if (typeof collectPageDataImpl === 'function') {
        const careersPage = toPageData(
          await collectPageDataImpl(browserContext?.careersPage ?? null, CAREERS_PAGE_URL),
          CAREERS_PAGE_URL,
        )
        if (!hasOfficialCareersSignal(careersPage)) {
          throw new Error('Orion Innovation careers page no longer matches the verified official public surface')
        }

        const openJobsPage = toPageData(
          await collectPageDataImpl(browserContext?.jobsPage ?? null, OPEN_JOBS_URL),
          OPEN_JOBS_URL,
        )
        if (!hasOfficialOpenJobsSignal(openJobsPage)) {
          throw new Error('Orion Innovation open jobs page no longer matches the verified public jobs surface')
        }

        const jobs = typeof readRenderedJobCardsImpl === 'function'
          ? extractJobsFromCards(
            await readRenderedJobCardsImpl(browserContext?.jobsPage ?? null, openJobsPage),
          )
          : []

        const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

        return selectedJobs.map((job) => ({
          ...job,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: now(),
        }))
      }

      const careersPage = toPageData(await fetchPage(CAREERS_PAGE_URL), CAREERS_PAGE_URL)
      if (careersPage.errorKind) {
        throw new Error(`Failed to fetch verified Orion Innovation route: ${CAREERS_PAGE_URL} (${careersPage.errorKind})`)
      }

      const openJobsPage = toPageData(await fetchPage(OPEN_JOBS_URL), OPEN_JOBS_URL)
      if (openJobsPage.errorKind) {
        throw new Error(`Failed to fetch verified Orion Innovation route: ${OPEN_JOBS_URL} (${openJobsPage.errorKind})`)
      }

      if (isCloudflareBlocked(careersPage) && isCloudflareBlocked(openJobsPage)) {
        return []
      }

      if (!hasOfficialCareersSignal(careersPage)) {
        throw new Error('Orion Innovation careers page no longer matches the verified official public surface')
      }

      if (!hasOfficialOpenJobsSignal(openJobsPage)) {
        throw new Error('Orion Innovation open jobs page no longer matches the verified public jobs surface')
      }

      const jobs = extractJobsFromHtml(openJobsPage.html)
      if (exposesStructuredPublicJobs(openJobsPage.html) && jobs.length === 0) {
        throw new Error('Orion Innovation open jobs page now exposes public jobs but parsing returned no jobs')
      }

      const selectedJobs = Number.isInteger(maxJobs) ? jobs.slice(0, maxJobs) : jobs

      return selectedJobs.map((job) => ({
        ...job,
        source: SOURCE,
        link: job.applyUrl || job.sourceUrl,
        scrapedAt: now(),
      }))
    } finally {
      if (browserContext) {
        await browserContext.close()
      }
    }
  },
})

const isCloudflareBlocked = (page = {}) =>
  Number(page.status) === 403 && hasVerifiedCloudflareChallengeSignal(page.html)

export const run = async (options = {}) => createOrionInnovationScraper().run(options)

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
