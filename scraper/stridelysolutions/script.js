import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'stridelysolutions'
export const COMPANY = 'Stridely Solutions'
export const HOMEPAGE_URL = 'https://www.stridelysolutions.com/'
export const CAREERS_URL = 'https://www.stridelysolutions.com/insights/blog/jobs/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'Stridely Solutions',
  adapter: 'script',
  modulePath: '../../scraper/stridelysolutions/script.js',
  homepageUrl: HOMEPAGE_URL,
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'awsm-job-archive-load-more-shell',
  extractionStrategy: 'verified-first-party-jobs-archive+awsm-job-listing-cards+same-domain-detail-links',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'stridelysolutions.com',
  verifiedOn: '2026-07-18',
  verifiedSurfaceSummary:
    'Verified on Saturday, July 18, 2026 that https://www.stridelysolutions.com/insights/blog/jobs/ was the live first-party Stridely Solutions jobs archive and that it exposed public listing cards such as Rebar and SAP SD with same-domain More Details links.',
  dryRunFile: 'stridelysolutions/jobs.json',
}

const normalizeWhitespace = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const toTitleCase = (value) => String(value ?? '')
  .split('-')
  .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : '')
  .join(' ')

const defaultFetchText = (url, options = {}) => fetchTextWithRetry(url, {
  ...options,
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

export const hasOfficialCareersSignal = (html) => {
  const page = String(html ?? '')
  if (/<title>\s*Current Job Openings\s*-\s*Stridely Solutions\s*<\/title>/i.test(page)) {
    return /<link[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/www\.stridelysolutions\.com\/careers\/current-openings\/?["']/i.test(page)
      && /<h1[^>]*>\s*Job Openings\s*<\/h1>/i.test(page) && /\bawsm_job_openings\b/i.test(page)
  }
  return /<title>\s*Job Openings Archive\s*-\s*Stridely Solutions\s*<\/title>/i.test(page)
    && /<h1[^>]*>\s*Job Openings\s*<\/h1>/i.test(page)
    && /awsm-job-listing-item/i.test(page)
}


const decodeText = (value) => normalizeWhitespace(String(value ?? '').replace(/<[^>]+>/g, ' ')
  .replace(/&amp;|&#038;/gi, '&').replace(/&nbsp;/gi, ' ').replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"'))

const getSafeJobUrl = (value) => {
  try {
    const url = new URL(value, HOMEPAGE_URL)
    if (url.protocol !== 'https:' || url.hostname !== 'www.stridelysolutions.com'
      || !/^\/(?:insights\/blog\/)?jobs\/[^/]+\/?$/.test(url.pathname)) return null
    return url.href
  } catch { return null }
}

const FOREIGN_COUNTRIES = new Map([
  ['canada', 'Canada'], ['ca', 'Canada'], ['usa', 'United States'], ['us', 'United States'],
  ['united states', 'United States'], ['united kingdom', 'United Kingdom'], ['gb', 'United Kingdom'],
])

const scopeFromLabels = (labels) => {
  const knownIndia = labels.map(value => {
    const key = value.toLowerCase()
    if (['india', 'in', 'ind'].includes(key)) return 'India'
    const city = CANONICAL_CITIES[key]
    return city && city !== 'Remote' && city !== 'None' ? city : null
  }).filter(Boolean)
  if (knownIndia.length) {
    const cities = [...new Set(knownIndia.filter(value => value !== 'India'))]
    return { country: 'India', location: cities.length ? cities.join(', ') + ', India' : 'India', city: cities[0] || null }
  }
  const countries = labels.map(value => FOREIGN_COUNTRIES.get(value.toLowerCase()))
  return { country: labels.length && countries.every(Boolean) ? countries[0] : null,
    location: labels.length ? labels.join(', ') : null, city: null }
}

const parseCardDate = (value) => {
  const match = decodeText(value).match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/)
  if (!match) return null
  const month = 'January February March April May June July August September October November December'.split(' ').indexOf(match[1])
  const day = Number(match[2])
  const date = new Date(Date.UTC(Number(match[3]), month, day))
  return month >= 0 && date.getUTCMonth() === month && date.getUTCDate() === day ? date.toISOString() : null
}

const extractDetailScope = (html, listing) => {
  const canonical = String(html).match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1]
  const title = decodeText(String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  if (!/<title[^>]*>[\s\S]*?Stridely Solutions\s*<\/title>/i.test(html)
    || !canonical || getSafeJobUrl(canonical)?.replace(/\/$/, '') !== listing.sourceUrl.replace(/\/$/, '')
    || title !== listing.title) throw new Error('Stridely detail employer or job identity mismatch')

  const structured = [...String(html).matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap(([, value]) => {
      const record = JSON.parse(value)
      return Array.isArray(record) ? record : record['@graph'] || [record]
    }).find(record => record?.['@type'] === 'JobPosting')
  if (structured) {
    if (structured.hiringOrganization?.name !== COMPANY || structured.title !== listing.title
      || (structured.url && getSafeJobUrl(structured.url)?.replace(/\/$/, '') !== listing.sourceUrl.replace(/\/$/, ''))) {
      throw new Error('Stridely structured detail employer or job identity mismatch')
    }
    const entries = (Array.isArray(structured.jobLocation) ? structured.jobLocation : [structured.jobLocation])
      .map(place => {
        const address = place?.address || {}
        const countryValue = String(address.addressCountry?.name || address.addressCountry || '').trim()
        const country = /^(India|IN|IND)$/i.test(countryValue) ? 'India'
          : FOREIGN_COUNTRIES.get(countryValue.toLowerCase()) || null
        const local = decodeText(address.addressLocality)
        if (country) return { country, location: [local, decodeText(address.addressRegion), country].filter(Boolean).join(', '), city: country === 'India' ? local || null : null }
        return countryValue ? { country: null } : scopeFromLabels([local].filter(Boolean))
      })
    const india = entries.filter(entry => entry.country === 'India')
    if (india.length) return { country: 'India', location: india.map(entry => entry.location).join(' / '), city: india[0].city }
    return entries.length && entries.every(entry => entry.country) ? entries[0] : { country: null }
  }
  const locationPanel = String(html).match(/awsm-job-specification-job-location[\s\S]*?<\/div>/i)?.[0] || ''
  const labels = [...locationPanel.matchAll(/awsm-job-specification-term["'][^>]*>([\s\S]*?)<\//gi)].map(([, value]) => decodeText(value)).filter(Boolean)
  return scopeFromLabels(labels)
}

export const extractJobCards = (html) => {
  const page = String(html ?? '')
  const jobs = []
  const currentCards = [...page.matchAll(
    /<article\b([^>]*\bawsm_job_openings\b[^>]*)>([\s\S]*?)<\/article>/gi,
  )]

  const currentCardCount = [...page.matchAll(/<article\b[^>]*\bawsm_job_openings\b[^>]*>/gi)].length
  if (currentCards.length !== currentCardCount) throw new Error('Stridely incomplete or malformed current card boundaries')

  if (currentCards.length > 0) {
    for (const [, attributes, cardHtml] of currentCards) {
      const anchor = cardHtml.match(/elementor-post__title[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>\s*([\s\S]*?)\s*<\/a>/i)
      const title = decodeText(anchor?.[2])
      const sourceUrl = getSafeJobUrl(anchor?.[1])
      if (!title || !sourceUrl) throw new Error('Stridely incomplete current card or job domain identity mismatch')
      const labels = [...String(attributes).matchAll(/\bjob-location-([a-z0-9-]+)/gi)].map(([, slug]) => toTitleCase(slug))
      jobs.push({ title, sourceUrl, applyUrl: sourceUrl, ...scopeFromLabels(labels),
        jobId: new URL(sourceUrl).pathname.split('/').filter(Boolean).at(-1),
        postingDate: parseCardDate(cardHtml.match(/class=["']elementor-post-date["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]) })
    }
    if (new Set(jobs.map(job => job.sourceUrl)).size !== jobs.length) throw new Error('Stridely incomplete duplicate current role identity')
    return jobs
  }

  const cardStarts = [...page.matchAll(/<div class="awsm-job-listing-item\b/gi)].map((match) => match.index)
  const cards = cardStarts.map((start, index) => {
    const end = cardStarts[index + 1] ?? page.length
    return page.slice(start, end)
  })

  for (const card of cards) {
    const sourceUrl = normalizeWhitespace(
      card.match(/<a[^>]+href="([^"]+)"[^>]+class="awsm-job-item"/i)?.[1]
      || card.match(/<a[^>]+class="awsm-job-item"[^>]+href="([^"]+)"/i)?.[1]
      || card.match(/class="awsm-job-more"[^>]*href="([^"]+)"/i)?.[1]
      || card.match(/awsm-job-post-title">\s*<a href="([^"]+)"/i)?.[1],
    )
    const title = normalizeWhitespace(
      card.match(/awsm-job-post-title">\s*<a[^>]*>([^<]+)<\/a>/i)?.[1]
      || card.match(/awsm-job-post-title">\s*([^<]+)</i)?.[1],
    )
    const locationTerms = [...card.matchAll(
      /awsm-job-specification-job-location[\s\S]*?<\/div>/gi,
    )]
      .flatMap((match) => [...match[0].matchAll(/awsm-job-specification-term">([^<]+)</gi)])
      .map((item) => normalizeWhitespace(item[1]))
      .filter(Boolean)
    const fallbackTerms = [...card.matchAll(/awsm-job-specification-term">([^<]+)</gi)]
      .map((item) => normalizeWhitespace(item[1]))
      .filter(Boolean)
    const location = locationTerms.length > 0
      ? locationTerms.join(' ')
      : fallbackTerms.at(-1)

    if (!title || !sourceUrl || !location) continue

    jobs.push({
      title,
      location,
      sourceUrl,
      applyUrl: sourceUrl,
    })
  }

  return jobs
}

export const run = async ({ fetchText = defaultFetchText, now = () => new Date().toISOString(), signal } = {}) => {
  const request = async (url, options = {}) => {
    signal?.throwIfAborted()
    const value = await fetchText(url, { ...options, signal })
    signal?.throwIfAborted()
    return value
  }
  const page = await request(CAREERS_URL)
  if (!hasOfficialCareersSignal(page)) throw new Error('Stridely Solutions verified jobs archive changed materially')
  const candidates = extractJobCards(page)
  if (!candidates.length) throw new Error('Stridely Solutions jobs archive no longer exposes trusted job cards')
  let incomplete = /<(?:a|button|span)\b[^>]*(?:e-load-more-anchor|awsm(?:-b)?-load-more|rel=["']next["'])/i.test(page)
  const jobs = []
  for (const candidate of candidates) {
    signal?.throwIfAborted()
    let job = candidate
    if (Object.hasOwn(job, 'country') && !job.country) {
      let detailHtml
      try {
        detailHtml = await request(job.sourceUrl, { attempts: 1 })
      } catch (error) {
        signal?.throwIfAborted()
        incomplete = true
        console.log('[stridelysolutions] Required location detail unavailable for ' + job.sourceUrl + ': ' + error.message)
        continue
      }
      const scope = extractDetailScope(detailHtml, job)
      if (!scope.country) { incomplete = true; continue }
      job = { ...job, ...scope }
    }
    if (job.country && job.country !== 'India') continue
    jobs.push({ ...job, company: COMPANY, country: 'India', link: job.applyUrl, source: SOURCE, scrapedAt: now() })
  }
  if (incomplete) {
    if (!jobs.length) throw new Error('Stridely incomplete location scope with no verified India jobs')
    console.log('[stridelysolutions] Returning ' + jobs.length + ' verified India jobs from an incomplete source listing; previous vacancies must be preserved.')
    for (const job of jobs) job.sourceListingComplete = false
  }
  return jobs
}

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

