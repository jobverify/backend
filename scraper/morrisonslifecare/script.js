import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'morrisonslifecare'
export const COMPANY = 'Morrisons Lifecare Pvt. Ltd.'
export const CAREERS_URL = 'https://www.morrisonslifecare.com/careers/'
export const APPLY_URL = 'https://www.morrisonslifecare.com/careers/morrisonsjobform'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#8211;|&ndash;/gi, '-')
  .replace(/&#8212;|&mdash;/gi, '-')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(value)
    .replace(/<!--[^]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toAbsoluteUrl = (value) => {
  try {
    return new URL(String(value ?? ''), CAREERS_URL).toString()
  } catch {
    return null
  }
}

const toJobId = (value) => {
  try {
    return new URL(value).pathname.replace(/\/+$/, '').split('/').filter(Boolean).at(-1) || null
  } catch {
    return null
  }
}

const extractFirst = (pattern, html) => {
  const match = String(html ?? '').match(pattern)
  return normalizeWhitespace(match?.[1] ?? null)
}

const extractListItemsFromClass = (html, className) => {
  const block = String(html ?? '').match(
    new RegExp(`<ul\\b[^>]*class=["'][^"']*${className}[^"']*["'][^>]*>([\\s\\S]*?)<\\/ul>`, 'i'),
  )?.[1]

  if (!block) return []

  return [...block.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)
}

const buildJobDescription = ({
  description,
  responsibilities,
  qualifications,
} = {}) => [
  description,
  responsibilities.length > 0
    ? `Key Responsibilities: ${responsibilities.join(' ')}`
    : null,
  qualifications.length > 0
    ? `Qualifications: ${qualifications.join(' ')}`
    : null,
].filter(Boolean).join(' ') || null

const extractExperienceRequired = (qualifications = []) =>
  qualifications.find((item) => /\bexperience\b/i.test(item)) || null

const extractNonExperienceQualifications = (qualifications = []) =>
  qualifications.filter((item) => !/\bexperience\b/i.test(item))

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  return /current job openings/i.test(page) && /class=["'][^"']*\bexplore__card\b[^"']*["']/i.test(page)
}

const parseRoleLabel = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  const match = normalized.match(/^(.*?)\s*\(([^)]+)\)\s*$/)
  const title = normalizeWhitespace(match?.[1] || normalized)
  const qualifier = normalizeWhitespace(match?.[2] || null)

  if (!qualifier) {
    return {
      title,
      location: 'India',
      city: null,
      country: 'India',
      remoteStatus: null,
    }
  }

  const onSiteMatch = qualifier.match(/^on-site\s*,\s*(.+)$/i)
  if (onSiteMatch) {
    const city = normalizeWhitespace(onSiteMatch[1])
    return {
      title,
      location: city ? `${city}, India` : 'India',
      city,
      country: 'India',
      remoteStatus: 'On-site',
    }
  }

  if (/^multi-site$/i.test(qualifier)) {
    return {
      title,
      location: 'India',
      city: null,
      country: 'India',
      remoteStatus: null,
    }
  }

  if (/^hybrid\s*,\s*(.+)$/i.test(qualifier)) {
    const city = normalizeWhitespace(qualifier.replace(/^hybrid\s*,/i, ''))
    return {
      title,
      location: city ? `${city}, India` : 'India',
      city,
      country: 'India',
      remoteStatus: 'Hybrid',
    }
  }

  if (/^remote$/i.test(qualifier)) {
    return {
      title,
      location: 'India',
      city: null,
      country: 'India',
      remoteStatus: 'Remote',
    }
  }

  return {
    title,
    location: /india/i.test(qualifier) ? qualifier : `${qualifier}, India`,
    city: null,
    country: 'India',
    remoteStatus: null,
  }
}

const hasCurrentCareersSignal = (html = '') => /<title[^>]*>\s*Morrisons Careers - Be Part of Our Team\s*<\/title>/i.test(html)
  && /Build Your[\s\S]*?Career[\s\S]*?at Morrisons Lifecare/i.test(html)
  && /id=["']openings["']/i.test(html)

const extractCurrentCards = (html = '') => {
  const section = String(html).match(/<section[^>]*id=["']openings["'][^>]*>([\s\S]*?)<\/section>/i)?.[1] || ''
  const total = Number(normalizeWhitespace(section)?.match(/\b(\d+) roles open\b/i)?.[1])
  if (!/based across[\s\S]*?facilities in Chennai/i.test(section)) throw new Error('Morrisons current listing location scope changed')
  const cards = [...section.matchAll(/<a\b([^>]*class=["'][^"']*\bjob-card\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi)]
  const jobs = cards.map(([, attributes, body]) => {
    const title = extractFirst(/<h3[^>]*>([\s\S]*?)<\/h3>/i, body)
    const href = attributes.match(/\bhref=["']([^"']+)["']/i)?.[1]
    const sourceUrl = href && toAbsoluteUrl(href)
    if (!title || !sourceUrl || new URL(sourceUrl).origin !== new URL(CAREERS_URL).origin
      || !/^\/careers\/[a-z0-9_]+\/?$/i.test(new URL(sourceUrl).pathname)) throw new Error('Morrisons incomplete current role identity')
    const jobId = toJobId(sourceUrl)
    return { title, location: 'Chennai, India', city: 'Chennai', country: 'India', sourceUrl, applyUrl: sourceUrl,
      jobId, requisitionId: jobId, jobDescription: extractFirst(/<p[^>]*>([\s\S]*?)<\/p>/i, body),
      remoteStatus: /On-site/i.test(body) ? 'On-site' : null }
  })
  if (!Number.isInteger(total) || total <= 0 || jobs.length !== total || new Set(jobs.map(job => job.jobId)).size !== total) throw new Error('Morrisons incomplete current listing')
  return jobs
}

export const extractJobCards = (html) => {
  if (hasCurrentCareersSignal(html)) return extractCurrentCards(html)
  if (!hasOfficialCareersSignal(html)) {
    throw new Error('Expected verified Morrisons Lifecare careers surface with public job cards')
  }

  const jobs = [...String(html ?? '').matchAll(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*\bexplore__card\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi,
  )]
    .map((match) => {
      const role = parseRoleLabel(extractFirst(/<h4\b[^>]*>([\s\S]*?)<\/h4>/i, match[2]))
      const sourceUrl = toAbsoluteUrl(match[1])
      const jobId = toJobId(sourceUrl)

      if (!role || !role.title || !sourceUrl || !jobId) return null

      return {
        title: role.title,
        location: role.location,
        city: role.city,
        country: 'India',
        sourceUrl,
        applyUrl: APPLY_URL,
        jobId,
        requisitionId: jobId,
        remoteStatus: role.remoteStatus,
      }
    })
    .filter(Boolean)

  if (jobs.length === 0) {
    throw new Error('Expected verified Morrisons Lifecare careers surface with public job cards')
  }

  return jobs
}

export const extractJobDetail = (html, listing = {}) => {
  if (/class=["'][^"']*\bjob-description-text\b[^"']*["']/i.test(html)) {
    const role = parseRoleLabel(extractFirst(/<h1[^>]*>([\s\S]*?)<\/h1>/i, html))
    const canonical = String(html).match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
    if (!/Careers at Morrisons Lifecare/i.test(html) || !role?.title || role.title !== listing.title
      || !canonical || canonical.replace(/\/$/, '') !== String(listing.sourceUrl).replace(/\/$/, '')) throw new Error('Morrisons current detail identity mismatch')
    const panelItems = (heading) => {
      const panel = String(html).match(new RegExp('<h3[^>]*>\\s*'+heading+'\\s*</h3>\\s*<ul[^>]*>([\\s\\S]*?)</ul>', 'i'))?.[1] || ''
      return [...panel.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(([, item]) => normalizeWhitespace(item)).filter(Boolean)
    }
    const description = extractFirst(/<p[^>]*class=["'][^"']*\bjob-description-text\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i, html)
    const responsibilities = panelItems('Key Responsibilities')
    const qualifications = panelItems('Qualifications')
    const application = String(html).match(/<a[^>]*href=["']([^"']+)["'][^>]*>\s*Apply Now[\s\S]*?<\/a>/i)?.[1]
    const applyUrl = application && toAbsoluteUrl(application)
    if (!description || applyUrl !== APPLY_URL) throw new Error('Morrisons current detail application or description incomplete')
    return { ...listing, applyUrl, jobDescription: buildJobDescription({ description, responsibilities, qualifications }),
      experienceRequired: extractExperienceRequired(qualifications), minimumQualification: extractNonExperienceQualifications(qualifications)[0] || null,
      publicExperienceChecked: true }
  }
  if (!/class=["'][^"']*\bjob__description-text\b[^"']*["']/i.test(html)) throw new Error('Morrisons detail identity changed')
  const role = parseRoleLabel(
    extractFirst(/<h2\b[^>]*class=["'][^"']*\bsection__header\b[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i, html)
      || listing.title,
  )
  const description = extractFirst(
    /<p\b[^>]*class=["'][^"']*\bjob__description-text\b[^"']*["'][^>]*>([\s\S]*?)<\/p>/i,
    html,
  )
  const responsibilities = extractListItemsFromClass(html, 'job__responsibilities-list')
  const qualifications = extractListItemsFromClass(html, 'job__qualifications-list')
  const nonExperienceQualifications = extractNonExperienceQualifications(qualifications)
  const applyUrl = toAbsoluteUrl(
    extractFirst(
      /<a\b[^>]*href=["']([^"']+)["'][^>]*class=["'][^"']*\bapply-now\b[^"']*["'][^>]*>/i,
      html,
    ),
  ) || listing.applyUrl || APPLY_URL

  return {
    ...listing,
    title: role?.title || listing.title || null,
    location: role?.location || listing.location || 'India',
    city: role?.city || listing.city || null,
    country: listing.country || 'India',
    applyUrl,
    employmentType: listing.employmentType || null,
    experienceRequired: extractExperienceRequired(qualifications) || listing.experienceRequired || null,
    minimumQualification: nonExperienceQualifications[0] || listing.minimumQualification || null,
    preferredQualification: nonExperienceQualifications[1] || listing.preferredQualification || null,
    requiredSkills: listing.requiredSkills || [],
    postingDate: listing.postingDate || null,
    closingDate: listing.closingDate || null,
    jobDescription: buildJobDescription({
      description,
      responsibilities,
      qualifications,
    }) || listing.jobDescription || null,
    publicExperienceChecked: true,
    remoteStatus: role?.remoteStatus || listing.remoteStatus || null,
  }
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  signal,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const createMorrisonsLifecareScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
} = {}) => ({
  async run({ signal, fetchText = defaultFetchText, now: overrideNow } = {}) {
    const request = async (fetcher, url, options = {}) => {
      signal?.throwIfAborted()
      try { return await fetcher(url, { ...options, signal }) }
      finally { signal?.throwIfAborted() }
    }
    const listings = extractJobCards(await request(fetchText, CAREERS_URL))
    const selected = Number.isInteger(maxJobs) && maxJobs > 0
      ? listings.slice(0, maxJobs)
      : listings
    const jobs = []

    for (const listing of selected) {
      const detailHtml = await request(fetchText, listing.sourceUrl)
      const detail = extractJobDetail(detailHtml, listing)

      jobs.push({
        ...detail,
        applicationUrlIsGeneric: detail.applyUrl === APPLY_URL,
        ...(selected.length < listings.length ? { sourceListingComplete: false } : {}),
        company: COMPANY,
        department: null,
        country: 'India',
        source: SOURCE,
        link: detail.applyUrl || detail.sourceUrl,
        scrapedAt: (overrideNow || now)(),
      })
    }

    return jobs
  },
})

export const run = async (options = {}) => createMorrisonsLifecareScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  console.log(`Running Morrisons Lifecare scraper standalone (${isDryRun ? 'dry-run' : 'live'})...`)
  const jobs = await run()
  console.log(`\nTotal India jobs scraped: ${jobs.length}`)

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
    console.log(`Dry run - wrote ${jobs.length} jobs to jobs.json`)
  } else {
    const result = await saveToDB(jobs, SOURCE)
    console.log('DB result:', result)
    process.exit(0)
  }
}
