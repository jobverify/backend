import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { document, decode, norm } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { isIndiaJob } from '../../scraper-support/utils/indiaLocationFilter.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'katalon'
export const COMPANY = 'Katalon'
export const FIRST_PARTY_ROOT_URL = 'https://katalon.com/careers'
export const FIRST_PARTY_LIST_URL = `${FIRST_PARTY_ROOT_URL}/all-jobs`
export const OFFICIAL_ATS_URL = 'https://careers.katalon.com/'
export const JOBS_URL = `${OFFICIAL_ATS_URL}jobs`
export const RSS_URL = `${OFFICIAL_ATS_URL}jobs.rss`

const requireSource = (condition, message) => {
  if (!condition) throw new Error(`Katalon native inventory: ${message}`)
}
const text = value => { const doc = document(decode(value)); return doc.text(doc.root) || null }
const field = (xml, name) => xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1]?.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1') ?? null
const countryCode = name => ({ India: 'IN', Vietnam: 'VN', 'United States': 'US' })[name]
const jobId = url => /^https:\/\/careers\.katalon\.com\/jobs\/([1-9]\d*)-[^/?#]+$/.exec(url || '')?.[1]

const parseInventory = (html, rss) => {
  requireSource(/<title[^>]*>[\s\S]*?Current job openings - Katalon Careers\s*<\/title>/i.test(html)
    && /Teamtailor/.test(html) && html.includes(RSS_URL), 'board identity changed')
  const doc = document(html)
  const containers = doc.nodes(node => node.tag === 'ul' && node.attrs.id === 'jobs_list_container')
  requireSource(containers.length === 1, 'complete jobs list unavailable')
  doc.inner(containers[0])
  requireSource(!doc.nodes(node => node.attrs.rel === 'next' || /pagination/.test(node.attrs['data-controller'] || '')).length, 'pagination requires native verification')
  const urls = doc.nodes(node => node.tag === 'a' && jobId(node.attrs.href), containers[0]).map(node => node.attrs.href)
  const visibleCountries = new Map(doc.nodes(node => node.tag === 'li', containers[0]).flatMap(node => {
    const links = doc.nodes(child => child.tag === 'a' && jobId(child.attrs.href), node)
    const labels = doc.nodes(child => child.tag === 'span' && doc.hasClass(child, 'text-base'), node)
    requireSource(links.length === 1 && labels.length === 1, 'visible job location schema changed')
    return [[links[0].attrs.href, doc.text(labels[0]).split(/·|&middot;/).map(value => value.trim())]]
  }))
  const totals = doc.nodes(node => node.tag === 'h2' && /^\d+ jobs?$/.test(doc.text(node))).map(node => Number(doc.text(node).split(' ')[0]))
  requireSource(totals.length === 1 && totals[0] === urls.length && new Set(urls).size === urls.length, 'board count or duplicate listing mismatch')
  requireSource(/<rss\b[^>]*xmlns:tt="https:\/\/teamtailor.com\/locations"/.test(rss)
    && /<\/channel>\s*<\/rss>\s*$/.test(rss), 'RSS incomplete or schema changed')
  const channel = rss.slice(0, rss.indexOf('<item>') < 0 ? rss.length : rss.indexOf('<item>'))
  requireSource(text(field(channel, 'title')) === 'Katalon Careers' && text(field(channel, 'link')) === JOBS_URL, 'RSS identity changed')
  const records = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(match => {
    const item = match[1], url = text(field(item, 'link')), id = jobId(url), title = text(field(item, 'title'))
    const locations = [...item.matchAll(/<tt:location>([\s\S]*?)<\/tt:location>/g)].map(location => ({
      city: text(field(location[1], 'tt:city')), country: text(field(location[1], 'tt:country')),
    }))
    requireSource(id && title && urls.includes(url) && locations.length && locations.every(location => countryCode(location.country)), 'RSS job identity or country schema changed')
    const boardLabels = visibleCountries.get(url) || []
    requireSource(locations.every(location => boardLabels.includes(({ India: 'India', Vietnam: 'Viet Nam', 'United States': 'US' })[location.country])), 'RSS country disagrees with visible board location')
    return { id, url, title, locations, description: text(field(item, 'description')), department: text(field(item, 'tt:department')) }
  })
  requireSource(records.length === totals[0] && records.length === (rss.match(/<item>/g) || []).length
    && new Set(records.map(record => record.id)).size === records.length, 'RSS inventory count or duplicate mismatch')
  return records
}

const parseIndiaDetail = (record, html) => {
  const doc = document(html)
  const postings = doc.nodes(node => node.tag === 'script' && node.attrs.type === 'application/ld+json')
    .flatMap(node => { const value = JSON.parse(node.raw); return Array.isArray(value) ? value : [value] })
    .filter(posting => posting?.['@type'] === 'JobPosting')
  const posting = postings[0]
  const locations = Array.isArray(posting?.jobLocation) ? posting.jobLocation : [posting?.jobLocation]
  const applications = doc.nodes(node => Boolean(node.attrs['data-careersite--jobs--form-overlay-job-application-url-value']))
    .map(node => node.attrs['data-careersite--jobs--form-overlay-job-application-url-value'])
  requireSource(postings.length === 1 && posting?.identifier?.value === record.id
    && posting?.identifier?.name === 'Katalon Careers' && posting?.hiringOrganization?.name === 'Katalon Careers'
    && posting?.hiringOrganization?.sameAs === 'https://careers.katalon.com'
    && norm(posting?.title) === record.title && applications.includes(record.url + '/applications/new'), 'detail identity or application contract changed')
  requireSource(JSON.stringify(locations.map(location => location?.address?.addressCountry).sort())
    === JSON.stringify(record.locations.map(location => countryCode(location.country)).sort()), 'detail country conflicts with RSS')
  const india = locations.filter(location => location?.address?.addressCountry === 'IN')
  requireSource(india.length && india.every(location => norm(location.address.addressLocality)), 'detail India locality missing')
  const relocation = /\brelocation to\s+(?!india\b)([^)]+)/i.exec(record.title)?.[1]?.trim()
  return {
    title: record.title, company: COMPANY, source: SOURCE, department: record.department,
    jobId: record.id, requisitionId: record.id, country: 'India', city: india[0].address.addressLocality,
    location: india.map(location => `${location.address.addressLocality}, India`).join('; '),
    sourceUrl: record.url, applyUrl: record.url + '/applications/new',
    employmentType: posting.employmentType === 'FULL_TIME' ? 'Full Time' : null,
    postingDate: posting.datePosted && Number.isFinite(Date.parse(posting.datePosted)) ? new Date(posting.datePosted).toISOString().slice(0, 10) : null,
    jobDescription: text(posting.description) || record.description,
    experienceRequired: null, minimumQualification: null, preferredQualification: null, requiredSkills: [], closingDate: null,
    ...(relocation ? { sourceLocationConflict: `Native India recruiting location requires relocation to ${relocation}; work location is unresolved`, sourceScopeComplete: false, sourceListingComplete: false } : {}),
  }
}

export const createKatalonScraper = () => ({
  async run({ signal, fetchText, fetchImpl = fetch, timeoutMs = 15000 } = {}) {
    signal?.throwIfAborted()
    const get = async url => {
      signal?.throwIfAborted()
      const body = fetchText ? await fetchText(url, { signal }) : await fetchTextWithRetry(url, {
        fetchImpl, signal, timeoutMs, attempts: 1, headers: { Accept: 'text/html,application/rss+xml', 'User-Agent': 'Mozilla/5.0' },
      })
      signal?.throwIfAborted()
      requireSource(typeof body === 'string' && body.length < 4 * 1024 * 1024, 'source body missing or exceeds bound')
      return body
    }
    const homepage = await get(FIRST_PARTY_LIST_URL)
    requireSource(/Katalon/i.test(homepage) && homepage.includes(OFFICIAL_ATS_URL), 'first-party ATS handoff missing')
    const records = parseInventory(await get(JOBS_URL), await get(RSS_URL))
    requireSource(records.length <= 200, 'detail request bound exceeded')
    const candidates = records.filter(record => record.locations.some(location => location.country === 'India'))
    requireSource(candidates.every(record => homepage.includes(record.url)), 'India listing no longer matches first-party application handoff')
    const jobs = []
    for (const record of candidates) {
      const job = parseIndiaDetail(record, await get(record.url))
      requireSource(isIndiaJob(job), 'native India candidate rejected by public location policy')
      jobs.push(job)
    }
    const conflict = jobs.some(job => job.sourceLocationConflict)
    if (conflict) for (const job of jobs) job.sourceListingComplete = false
    return attachInventoryEvidence(jobs, {
      status: conflict ? 'discovery-only' : records.length ? 'complete-inventory' : 'verified-empty',
      surface: JOBS_URL, firstParty: true, listingComplete: !conflict,
      pagesFetched: 3 + candidates.length, reportedTotal: records.length, indiaFacetCount: candidates.length,
      verifiedAt: new Date().toISOString(), reason: conflict ? 'native-india-recruiting-location-conflicts-with-required-foreign-relocation' : 'complete-teamtailor-board-rss-reconciliation',
    })
  },
})

export const run = async (options = {}) => createKatalonScraper().run(options)

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/katalon/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
