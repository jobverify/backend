import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { createOkinawaFetchText } from './transport.js'
export { createOkinawaFetchText } from './transport.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'okinawaautotech'
export const COMPANY = 'Okinawa Autotech'
export const CAREERS_URL = 'https://okinawascooters.com/career'
export const OFFICIAL_DOMAIN = 'okinawascooters.com'

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&ndash;|&mdash;/gi, '-')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const extractField = (text, label) => {
  const match = text.match(new RegExp(`${label}\\s*:?[\\s]*([^|]+?)(?=\\s+(?:Department|Location|Experience Required|Job Code)\\s*:?[\\s]|$)`, 'i'))
  return match?.[1]?.trim() || null
}

const toOfficialApplyUrl = (value) => {
  try {
    const applyUrl = new URL(String(value ?? '').replace(/&amp;/gi, '&'), CAREERS_URL)
    if (applyUrl.origin !== 'https://' + OFFICIAL_DOMAIN || applyUrl.username || applyUrl.password || applyUrl.hash || !/^\/applynow\.aspx$/i.test(applyUrl.pathname) || !nativeId(applyUrl)) {
      return null
    }
    return applyUrl.toString()
  } catch {
    return null
  }
}

const nativeId = value => {
 const url = value instanceof URL ? value : new URL(value)
 const values = url.searchParams.getAll('jobid')
 if (values.length !== 1 || !/^\d+$/.test(values[0]) || !Number.isSafeInteger(Number(values[0])) || Number(values[0]) <= 0) return null
 return String(Number(values[0]))
}
const detailUrlOf = (value, applyUrl) => {
 try { const url = new URL(String(value).replace(/&amp;/g, '&'), CAREERS_URL)
  if (url.origin !== 'https://' + OFFICIAL_DOMAIN || url.username || url.password || url.hash || url.pathname.toLowerCase() !== '/careerdetail.aspx' || !nativeId(url) || nativeId(url) !== nativeId(applyUrl)) return null
  return url.href
 } catch { return null }
}
const indiaLocation = value => /^Gurugram(?:,\s*(?:HR|Haryana|India))*$/i.test(normalizeWhitespace(value))
const sameTitle = (a, b) => normalizeWhitespace(a).toLowerCase().replace(/^am\/manager\b/, 'assistant manager/manager').replace(/^asst\.?\s*manager\/manager\b/, 'assistant manager/manager') === normalizeWhitespace(b).toLowerCase().replace(/^am\/manager\b/, 'assistant manager/manager').replace(/^asst\.?\s*manager\/manager\b/, 'assistant manager/manager')
const brand = html => /Okinawa Autotec Private Limited|Okinawa Autotech Internationall? Private Limited/i.test(normalizeWhitespace(html))

export const hasOfficialCareersSignal = (html = '') => {
  const text = normalizeWhitespace(html)

  return text.includes('Careers')
    && text.includes('Current Openings')
    && /Okinawa Autotec Private Limited|Okinawa Autotech Internationall? Private Limited/i.test(text)
}

export const extractJobCards = (html = '') => {
  const rawHtml = String(html ?? '')
  const openingsStart = rawHtml.search(/Current Openings/i)
  const footerStart = rawHtml.search(/Copyright Okinawa Autotec|Copyright Okinawa Autotech/i)
  if (openingsStart < 0) return []

  const openingsHtml = rawHtml.slice(openingsStart, footerStart > openingsStart ? footerStart : undefined)
  const cards = []
  const seenCodes = new Set(), seenIds = new Set()

  for (const match of openingsHtml.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/gi)) {
    const beforeApply = openingsHtml.slice(0, match.index)
    const lastHeadingIndex = Math.max(
      beforeApply.lastIndexOf('<h2'),
      beforeApply.lastIndexOf('<h3'),
      beforeApply.lastIndexOf('<h4'),
    )
    const cardText = normalizeWhitespace(beforeApply.slice(lastHeadingIndex >= 0 ? lastHeadingIndex : 0))
    const title = normalizeWhitespace(beforeApply.slice(lastHeadingIndex).match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/i)?.[1])
    const applyUrl = toOfficialApplyUrl(match[1])

    if (!applyUrl) {
      throw new Error('Okinawa Autotech careers page exposed a non-official first-party apply URL')
    }

    const department = extractField(cardText, 'Department')
    const location = extractField(cardText, 'Location')
    const experienceRequired = extractField(cardText, 'Experience Required')
    const jobId = extractField(cardText, 'Job Code')

    if (!title || !location || !jobId) {
      throw new Error('Okinawa Autotech careers page exposed an incomplete structured job card')
    }

    const id = nativeId(applyUrl)
    if (seenCodes.has(jobId) || seenIds.has(id)) throw new Error('Okinawa duplicate native application identity or job code')
    seenCodes.add(jobId); seenIds.add(id)
    const afterApply = openingsHtml.slice(match.index + match[0].length)
    const nextApply = afterApply.search(/<a\b[^>]*>\s*Apply Now\s*<\/a>/i)
    const detailMatch = afterApply.slice(0, nextApply < 0 ? undefined : nextApply).match(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>\s*View Detail\s*<\/a>/i)
    const detailUrl = detailMatch ? detailUrlOf(detailMatch[1], applyUrl) : null
    if (detailMatch && !detailUrl) throw new Error('Okinawa non-official first-party detail identity')
    cards.push({
      title,
      department,
      location,
      experienceRequired,
      jobId,
      applyUrl,
      ...(detailUrl ? { detailUrl } : {}),
    })
  }

  return cards
}

const fieldFromDetail = (html, label) => normalizeWhitespace(html.match(new RegExp('<p[^>]*>\\s*<b[^>]*>' + label + ':?\\s*<\\/b>([\\s\\S]*?)<\\/p>', 'i'))?.[1])
const detailOf = (html, card) => {
 if (!brand(html)) throw new Error('Okinawa native detail employer identity changed')
 const start = html.search(/<div\b[^>]*class=["'][^"']*\bcareer-detail-box\b/i)
 if (start < 0) throw new Error('Okinawa native detail structure changed')
 const block = html.slice(start, html.indexOf('<footer', start))
 const title = normalizeWhitespace(block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1])
 const location = fieldFromDetail(block, 'Location')
 const heading = block.match(/<h4[^>]*>\s*Job Description\s*<\/h4>/i)
 const ul = heading ? block.slice(heading.index + heading[0].length).match(/<ul[^>]*>([\s\S]*?)<\/ul>/i)?.[1] : null
 const descriptions = [...String(ul || '').matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map(m => normalizeWhitespace(m[1])).filter(Boolean)
 const description = descriptions.join('\n')
 const applyMatches = [...block.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>\s*Apply Now\s*<\/a>/gi)]
 if (!sameTitle(title, card.title) || !indiaLocation(location) || !applyMatches.length || applyMatches.some(m => !toOfficialApplyUrl(m[1]) || nativeId(toOfficialApplyUrl(m[1])) !== nativeId(card.applyUrl))) throw new Error('Okinawa detail identity, application or India location contradicts its listing')
 if (description.length < 150) throw new Error('Okinawa native substantive job description missing')
 return { jobDescription: description, minimumQualification: fieldFromDetail(block, 'Education'), detailLocation: location }
}
const verifyApplication = (html, card) => {
 const code = normalizeWhitespace(html.match(/<span[^>]*id=["']ctl00_ContentPlaceHolder1_lbljobcode["'][^>]*>([\s\S]*?)<\/span>/i)?.[1])
 const location = normalizeWhitespace(html.match(/<span[^>]*id=["']ctl00_ContentPlaceHolder1_lbllocation["'][^>]*>([\s\S]*?)<\/span>/i)?.[1])
 const select = html.match(/<select[^>]*id=["']ctl00_ContentPlaceHolder1_ddljobtitle["'][^>]*>([\s\S]*?)<\/select>/i)?.[1]
 const roles = [...String(select || '').matchAll(/<option[^>]*value=["']([^"']+)["'][^>]*>([\s\S]*?)<\/option>/gi)].filter(m => Number(m[1]) === Number(nativeId(card.applyUrl)))
 const form = html.match(/<form\b[^>]*>/i)?.[0] || ''
 const action = form.match(/\baction=["']([^"']+)["']/i)?.[1]
 if (!/\bmethod=["']post["']/i.test(form) || !/\benctype=["']multipart\/form-data["']/i.test(form) || !brand(html) || code !== card.jobId || !indiaLocation(location) || roles.length !== 1 || normalizeWhitespace(roles[0][2]) !== card.title || !toOfficialApplyUrl(action) || nativeId(toOfficialApplyUrl(action)) !== nativeId(card.applyUrl)) throw new Error('Okinawa application identity or India location changed')
}

export const createOkinawaAutotechScraper = () => ({
 async run({ fetchText, signal, now = () => new Date().toISOString() } = {}) {
  signal?.throwIfAborted()
  const fetchImpl = fetchText || createOkinawaFetchText()
  const read = async url => { signal?.throwIfAborted(); const html = await fetchImpl(url, { signal }); signal?.throwIfAborted(); return html }
  const careersHtml = await read(CAREERS_URL)
  if (!hasOfficialCareersSignal(careersHtml)) throw new Error('Verified Okinawa Autotech careers page no longer matches the trusted first-party surface')
  const cards = extractJobCards(careersHtml)
  if (!cards.length) throw new Error('Okinawa Autotech official careers page exposes no structured public job cards')
  const jobs = []
  for (const card of cards) {
   if (!indiaLocation(card.location)) throw new Error('Okinawa listing country/location is not verified India')
   if (!card.detailUrl) throw new Error('Okinawa published native detail description link is missing')
   const detail = detailOf(await read(card.detailUrl), card)
   verifyApplication(await read(card.applyUrl), card)
   jobs.push({ title: card.title, company: COMPANY, department: card.department, location: card.location, city: card.location, country: 'India', jobId: card.jobId, requisitionId: card.jobId, sourceUrl: card.detailUrl, applyUrl: card.applyUrl, employmentType: null, experienceRequired: card.experienceRequired, minimumQualification: detail.minimumQualification, preferredQualification: null, requiredSkills: [], postingDate: null, closingDate: null, jobDescription: detail.jobDescription, source: SOURCE, link: card.applyUrl, scrapedAt: now(), sourceListingComplete: false })
  }
  return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: CAREERS_URL, firstParty: true, listingComplete: false, pagesFetched: 1 + cards.length * 2, reportedTotal: null, indiaFacetCount: null, verifiedAt: now(), reason: 'uncounted-first-party-careers-listing-with-verified-native-details-and-applications' })
 },
})

export const run = async (options = {}) => createOkinawaAutotechScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/okinawaautotech/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
