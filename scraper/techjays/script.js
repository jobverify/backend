export const SOURCE = 'techjays'
export const COMPANY = 'Techjays'
export const HOMEPAGE_URL = 'https://www.techjays.com/'
export const CAREERS_URL = 'https://www.techjays.com/careers'

export const PROVIDER_METADATA = {
  source: SOURCE,
  companyName: COMPANY,
  officialBrandName: 'Techjays',
  adapter: 'script',
  modulePath: '../../scraper/techjays/script.js',
  homepageUrl: HOMEPAGE_URL,
  companyCareerPage: CAREERS_URL,
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'first-party-counted-roles-plus-details',
  extractionStrategy: 'first-party-role-cards-and-details+explicit-india-location+incomplete-scope-preserves-prior-jobs',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'techjays.com',
  verifiedOn: '2026-09-13',
  verifiedSurfaceSummary:
    'Verified on 2026-09-13 that the official Techjays careers page lists six public roles with matching first-party detail pages and hireflow.techjays.com applications. Two roles explicitly identify Coimbatore / Hybrid; four lack role-level location evidence and remain diagnostic-only. Published India jobs carry incomplete-listing metadata so prior vacancies are preserved.',
  dryRunFile: 'techjays/jobs.json',
}

export const hasOfficialHomepageSignal = (html) => {
  const page = String(html ?? '')
  return /Techjays \| The AI Reimagination Company/i.test(page)
    && /The AI Reimagination Company/i.test(page)
}

export const hasPublicCareersLink = (html) =>
  /href=["'][^"']*(careers|career|jobs|job)[^"']*["']/i.test(String(html ?? ''))

export const isExpectedCareersRedirect = (response) => {
  const status = Number(response?.status)
  const location = String(response?.headers?.location ?? '').trim()
  return status === 308 && location === '/about'
}

const createTimeoutSignal = (timeoutMs) => {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return undefined
  }

  if (typeof AbortSignal?.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs)
  }

  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

export const defaultFetchPage = async (url, {
  fetchImpl = fetch,
  timeoutMs = 15000,
} = {}) => {
  const response = await fetchImpl(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: url === CAREERS_URL ? 'manual' : 'follow',
    signal: createTimeoutSignal(timeoutMs),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
    headers: {
      location: response.headers?.get?.('location') || '',
    },
  }
}

const visibleHtml = (html) => String(html ?? '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
const text = (html) => String(html ?? '').replace(/<!--[^]*?-->/g, '').replace(/<[^>]+>/g, ' ')
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
  .replace(/&amp;/gi, '&').replace(/&nbsp;/gi, ' ').replace(/&quot;/gi, '"').replace(/&apos;/gi, "'")
  .replace(/\s+/g, ' ').trim()
const attribute = (attrs, name) => String(attrs ?? '').match(new RegExp('\\b' + name + '=["\\\']([^"\\\']*)["\\\']', 'i'))?.[1] || null
const anchors = (html) => [...String(html ?? '').matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
  .map(match => ({ href: attribute(match[1], 'href'), classes: (attribute(match[1], 'class') || '').split(/\s+/), html: match[2] }))
const requireRoleUrl = (value) => {
  let url
  try { url = new URL(value, CAREERS_URL) } catch { /* Report the scoped URL error below. */ }
  if (!url || url.protocol !== 'https:' || url.hostname !== 'www.techjays.com' || !/^\/careers\/[\w-]+$/.test(url.pathname)) {
    throw new Error('Techjays role link does not match the verified first-party scope')
  }
  return url.toString()
}

export const extractCurrentRoleCards = (html) => {
  const page = visibleHtml(html)
  if (!/<title>\s*Careers\s*\|\s*Techjays\s*<\/title>/i.test(page)
    || !/\bCurrent Openings\b|\bOpen Roles\b/i.test(text(page))) {
    throw new Error('Techjays current careers page does not match the verified public surface')
  }
  const expectedCount = Number(text(page).match(/\b(\d+)\s+open\s+roles?\b/i)?.[1])
  const pageAnchors = anchors(page)
  const detailUrls = new Set(pageAnchors.filter(anchor => /\/careers\/[^/#?]+/.test(anchor.href || '')).map(anchor => requireRoleUrl(anchor.href)))
  const cards = pageAnchors.filter(anchor => anchor.classes.includes('careers-job-card')).map(anchor => {
    const sourceUrl = requireRoleUrl(anchor.href)
    return {
      title: text(anchor.html.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1]),
      sourceUrl, jobId: new URL(sourceUrl).pathname.split('/').at(-1),
      summary: text(anchor.html.match(/<p\b[^>]*class=["'][^"']*careers-job-card__summary[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1]),
      location: text(anchor.html.match(/<span\b[^>]*class=["'][^"']*careers-job-pill[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]) || null,
    }
  })
  if (!Number.isInteger(expectedCount) || expectedCount !== cards.length || detailUrls.size !== cards.length
    || new Set(cards.map(card => card.jobId)).size !== cards.length || cards.some(card => !card.title)) {
    throw new Error('Techjays listing is incomplete: not every advertised role was parsed')
  }
  return cards
}

const extractDescription = (article) => {
  const opening = article.match(/<div\b[^>]*class=["'][^"']*\bblog-content\b[^"']*["'][^>]*>/i)
  if (!opening) return null
  const start = opening.index + opening[0].length
  const tags = /<div\b[^>]*>|<\/div\s*>/gi
  tags.lastIndex = start
  let depth = 1
  for (let match; (match = tags.exec(article));) {
    depth += /^<\//.test(match[0]) ? -1 : 1
    if (depth === 0) return text(article.slice(start, match.index))
  }
  return null
}

export const extractCurrentRoleDetail = (html, card) => {
  const article = visibleHtml(html).match(/<article\b[^>]*>[\s\S]*?<\/article>/i)?.[0] || ''
  const title = text(article.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  const expectedApplyUrl = 'https://hireflow.techjays.com/apply/' + card.jobId
  const application = anchors(article).find(anchor => anchor.href === expectedApplyUrl && /Apply for this role/i.test(text(anchor.html)))
  const jobDescription = extractDescription(article)
  if (title !== card.title || !application || !jobDescription) throw new Error('Techjays detail identity, title, application or description is incomplete')
  // Only role header metadata is geographic evidence. Organization JSON-LD and footer addresses are unrelated.
  const header = article.split(/<h2\b/i)[0]
  const headerPills = [...header.matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)].map(match => text(match[1]))
  const rawLocation = headerPills.find(value => /Coimbatore|\bIndia\b|\b(?:Hybrid|Remote)\b/i.test(value)) || card.location || null
  const indiaPlace = rawLocation?.match(/\b(Coimbatore|Bengaluru|Bangalore|Hyderabad|Chennai|Mumbai|Pune|Noida|Delhi|Gurugram|Gurgaon)\b/i)?.[1]
  const country = indiaPlace || /\bIndia\b/i.test(rawLocation || '') ? 'India' : null
  const city = indiaPlace ? indiaPlace[0].toUpperCase() + indiaPlace.slice(1).toLowerCase() : null
  const experience = jobDescription.match(/\b(\d+)\s*\+\s*years?\b/i)
  const experienceRequired = experience ? experience[1] + '+ years' : null
  return {
    title, company: COMPANY, jobId: card.jobId, requisitionId: card.jobId,
    source: SOURCE, sourceUrl: card.sourceUrl, applyUrl: expectedApplyUrl, link: expectedApplyUrl,
    country, city, location: country ? [city, country].filter(Boolean).join(', ') : rawLocation,
    remoteStatus: /\bHybrid\b/i.test(rawLocation || '') ? 'Hybrid' : /\bRemote\b/i.test(rawLocation || '') ? 'Remote' : null,
    jobDescription, experienceRequired, requiredSkills: [], publicExperienceChecked: !experienceRequired,
    companyDomain: 'techjays.com', companyCareerPage: CAREERS_URL,
  }
}

export const run = async ({ fetchPage = defaultFetchPage, onDiagnostic = diagnostic => console.warn('[techjays] ' + diagnostic.message) } = {}) => {
  const homepage = await fetchPage(HOMEPAGE_URL)
  if (homepage?.status !== 200 || !hasOfficialHomepageSignal(homepage.html)) {
    throw new Error('Techjays verified homepage changed materially')
  }
  const careers = await fetchPage(CAREERS_URL)
  if (careers?.status !== 200) throw new Error('Techjays current careers public surface is unavailable; a redirect is not an empty listing')
  const cards = extractCurrentRoleCards(careers.html)
  const records = []
  for (const card of cards) {
    const detail = await fetchPage(card.sourceUrl)
    if (detail?.status !== 200 || detail.url !== card.sourceUrl) throw new Error('Techjays role detail is unavailable or redirected outside its verified identity')
    records.push({ ...extractCurrentRoleDetail(detail.html, card), scrapedAt: new Date().toISOString() })
  }
  const unknownJobs = records.filter(job => !job.country)
  const jobs = records.filter(job => job.country === 'India')
  if (unknownJobs.length) {
    const diagnostic = { source: SOURCE, code: 'incomplete_location_scope', unknownJobs,
      message: unknownJobs.length + ' public Techjays roles have no verified role location; publishing ' + jobs.length + ' verified India roles while preserving prior vacancies.' }
    onDiagnostic(diagnostic)
    if (!jobs.length) throw Object.assign(new Error(diagnostic.message), { code: diagnostic.code, diagnostic })
    for (const job of jobs) job.sourceListingComplete = false
  }
  return jobs
}
