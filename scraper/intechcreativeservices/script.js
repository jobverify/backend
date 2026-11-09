import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeCity } from '../../scraper-support/utils/cityNormalizer.js'
import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { INTECH_CREATIVE_SERVICES_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = INTECH_CREATIVE_SERVICES_CATALOG.source
export const COMPANY = INTECH_CREATIVE_SERVICES_CATALOG.companyName
export const CAREERS_URL = INTECH_CREATIVE_SERVICES_CATALOG.companyCareerPage
export const INVENTORY_URL = 'https://theintechgroup.com/wp-json/wp/v2/jobs'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const decode = value => String(value ?? '')
  .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, value) => {
    const point = value[0].toLowerCase() === 'x' ? Number.parseInt(value.slice(1), 16) : Number(value)
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : ''
  })
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
  .replace(/&apos;/gi, "'").replace(/&ndash;/gi, '–').replace(/&mdash;/gi, '—')
const text = value => decode(String(value ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
const comparable = value => text(value).replace(/[–—−]/g, '-')
const slugify = value => text(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const attrs = tag => Object.fromEntries([...String(tag).matchAll(/([\w-]+)\s*=\s*(["'])([\s\S]*?)\2/g)].map(m => [m[1], decode(m[3])]))
const officialJobUrl = value => {
  try {
    const url = new URL(decode(value), CAREERS_URL)
    if (url.protocol !== 'https:' || url.hostname !== 'theintechgroup.com' || url.search || url.hash
      || !/^\/(?:career\/)?jobs\/[a-z0-9-]+\/$/.test(url.pathname)) throw new Error()
    return url.toString()
  } catch { throw new Error('INTECH job application URL identity changed') }
}

// Bound each Elementor widget/card to its own balanced DIV, including nested description DIVs.
const divAt = (html, start) => {
  const tags = /<\/?div\b[^>]*>/gi
  tags.lastIndex = start
  let depth = 0
  let openingEnd
  for (let m; (m = tags.exec(html));) {
    if (m[0].startsWith('</')) depth -= 1
    else { depth += 1; openingEnd ??= tags.lastIndex }
    if (depth === 0) return { inner: html.slice(openingEnd, m.index), end: tags.lastIndex }
  }
  throw new Error('INTECH incomplete Elementor widget')
}
const fieldsFrom = html => {
  const fields = new Map()
  const headings = [...html.matchAll(/<h6\b[^>]*>([\s\S]*?)<\/h6>/gi)]
  for (const [i, h] of headings.entries()) {
    const label = text(h[1]).replace(/:$/, '')
    const region = html.slice(h.index + h[0].length, headings[i + 1]?.index ?? html.length)
    const widget = /<div\b[^>]*class=["'][^"']*\belementor-widget-text-editor\b[^"']*["'][^>]*>/i.exec(region)
    fields.set(label, widget ? text(divAt(region, widget.index).inner) || null : null)
  }
  return fields
}
export const hasOfficialCareersSignal = (html = '') => /Career - The INTECH Group/i.test(html)
  && /At INTECH Creative Services/i.test(html) && /Find Your Perfect Role/i.test(html)
  && /href=["'](?:https:\/\/theintechgroup\.com)?\/(?:career\/)?jobs\//i.test(html)

export const extractLoopGridJobCards = (html = '') => {
  const starts = [...String(html).matchAll(/<div\b[^>]*data-elementor-type=["']loop-item["'][^>]*>/gi)]
  return starts.map(start => {
    const block = divAt(html, start.index).inner
    const title = text(block.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1])
    const apply = [...block.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].find(m => text(m[2]) === 'Apply Now')
    const postId = Number(start[0].match(/\be-loop-item-(\d+)\b/)?.[1])
    if (!title || !apply || !postId || !/\bstatus-publish\b/.test(start[0])) throw new Error('INTECH incomplete published role card')
    const sourceUrl = officialJobUrl(attrs(apply[1]).href)
    const fields = fieldsFrom(block)
    const slug = new URL(sourceUrl).pathname.split('/').filter(Boolean).at(-1)
    const openingsCount = Number(fields.get('Vacancies'))
    if (!fields.get('Experience') || !fields.get('Job Type') || !Number.isInteger(openingsCount) || openingsCount < 1) throw new Error('INTECH incomplete role card fields')
    return {
      title, postId, department: fields.get('Department') || null,
      experienceRequired: fields.get('Experience'), employmentType: fields.get('Job Type'),
      openingsCount, location: fields.get('Location') || null,
      sourceUrl, applyUrl: sourceUrl, jobId: SOURCE+'-'+slugify(slug), requisitionId: slug,
    }
  })
}
const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
  label: SOURCE, timeoutMs: 20000, signal,
})
const defaultFetchInventory = async (url, { signal } = {}) => {
  let total, totalPages
  const rows = await fetchJsonWithRetry(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, label: SOURCE, timeoutMs: 20000, signal,
    fetchImpl: async (request, init) => {
      const response = await fetch(request, init)
      if (response.ok && response.url !== request) throw new Error('INTECH inventory URL identity changed')
      total = response.headers.get('x-wp-total')
      totalPages = response.headers.get('x-wp-totalpages')
      return response
    },
  })
  return { rows, total, totalPages }
}
const positiveInteger = value => /^\d+$/.test(String(value ?? '')) && Number(value) > 0 ? Number(value) : null
const pageUrl = page => page === 1 ? CAREERS_URL : CAREERS_URL+page+'/'
const pagingFrom = (html, page, expectedMax) => {
  const anchors = [...html.matchAll(/<div\b[^>]*class=["'][^"']*\be-load-more-anchor\b[^"']*["'][^>]*>/gi)]
  if (anchors.length !== 1) throw new Error('INTECH pagination anchor missing or ambiguous')
  const a = attrs(anchors[0][0])
  const max = positiveInteger(a['data-max-page'])
  if (Number(a['data-page']) !== page || !max || max > 100 || (expectedMax && max !== expectedMax)
    || a['data-next-page'] !== CAREERS_URL+(page + 1)+'/') throw new Error('INTECH pagination contract changed')
  return max
}
const snapshot = async (fetchText, fetchInventory, signal, countRequest) => {
  const cards = []
  let max, pageSize
  for (let page = 1; page === 1 || page <= max; page += 1) {
    signal?.throwIfAborted()
    countRequest()
    const html = await fetchText(pageUrl(page), { signal })
    signal?.throwIfAborted()
    if (!hasOfficialCareersSignal(html)) throw new Error('The verified Intech Creative Services careers page no longer matches the trusted first-party surface')
    max = pagingFrom(html, page, max)
    const pageCards = extractLoopGridJobCards(html)
    pageSize ??= pageCards.length
    if (!pageCards.length || (page < max && pageCards.length !== pageSize) || pageCards.length > pageSize) throw new Error('INTECH incomplete paginated job inventory count')
    cards.push(...pageCards)
  }
  const rows = []
  let total, totalPages
  for (let page = 1; page === 1 || page <= totalPages; page += 1) {
    countRequest()
    const url = INVENTORY_URL+'?per_page=100&page='+page+'&_fields=id,status,type,link,title'
    const result = await fetchInventory(url, { signal })
    signal?.throwIfAborted()
    const currentTotal = positiveInteger(result.total)
    const currentPages = positiveInteger(result.totalPages)
    if (!Array.isArray(result.rows) || !currentTotal || currentPages !== Math.ceil(currentTotal / 100)
      || currentPages > 100 || (total != null && (currentTotal !== total || currentPages !== totalPages))) throw new Error('INTECH invalid published inventory count headers')
    total ??= currentTotal
    totalPages ??= currentPages
    if (result.rows.length !== Math.min(100, total - (page - 1) * 100)) throw new Error('INTECH published inventory page count mismatch')
    for (const row of result.rows) {
      if (!positiveInteger(row.id) || row.status !== 'publish' || row.type !== 'jobs' || !text(row.title?.rendered)) throw new Error('INTECH invalid published inventory identity')
      rows.push({ postId: Number(row.id), sourceUrl: officialJobUrl(row.link), title: comparable(row.title.rendered) })
    }
  }
  if (cards.length !== total || rows.length !== total
    || new Set(cards.map(c => c.postId)).size !== total || new Set(cards.map(c => c.sourceUrl)).size !== total
    || new Set(rows.map(c => c.postId)).size !== total || new Set(rows.map(c => c.sourceUrl)).size !== total) throw new Error('INTECH incomplete or duplicate published job inventory count')
  const byId = new Map(rows.map(row => [row.postId, row]))
  for (const card of cards) {
    const row = byId.get(card.postId)
    if (!row || row.sourceUrl !== card.sourceUrl || row.title !== comparable(card.title)) throw new Error('INTECH listing and published inventory identity disagree')
  }
  return { cards, rows, total }
}
const locationCountry = location => {
  const normalized = text(location)
  if (/^(?:India|Hyderabad|Mumbai|Gandhinagar|Ahmedabad|Bengaluru|Bangalore)(?:,\s*(?:India|Gujarat|Maharashtra|Karnataka|Telangana))*$/i.test(normalized)) return 'India'
  if (/^(?:London|United Kingdom|UK)$/i.test(normalized)) return 'United Kingdom'
  if (/^(?:USA|United States|United States of America)$/i.test(normalized)) return 'United States'
  return null
}
const detailFrom = (html, card) => {
  const title = text(html.match(/<h1\b[^>]*class=["'][^"']*elementor-heading-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1])
  const pageTitle = text(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1])
  const metadata = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => attrs(m[0]))
  const pageUrl = metadata.find(m => m.property === 'og:url')?.content
  const brand = metadata.find(m => m.property === 'og:site_name')?.content
  const form = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/gi)].find(m => attrs(m[0].split('>')[0]).name === 'Apply Form')?.[0]
  const inputs = new Map([...String(form ?? '').matchAll(/<input\b[^>]*>/gi)].map(m => { const a = attrs(m[0]); return [a.name, a.value] }))
  if (title !== card.title || pageTitle !== card.title+' - The INTECH Group' || pageUrl !== card.sourceUrl
    || brand !== 'The INTECH Group' || inputs.get('queried_id') !== String(card.postId)
    || inputs.get('form_fields[job_id]') !== card.title || !inputs.get('form_fields[rrf_id]')
    || !/name=["']form_fields\[email\]["']/.test(form ?? '') || !/name=["']form_fields\[file\]["']/.test(form ?? '')) throw new Error('INTECH native application or employer identity mismatch')
  const heading = /<h2\b[^>]*>\s*Job Description\s*<\/h2>/i.exec(html)
  const applyHeading = /<h2\b[^>]*>\s*Apply Now\s*<\/h2>/i.exec(html)
  if (!heading || !applyHeading || applyHeading.index <= heading.index) throw new Error('INTECH native description structure changed')
  const beforeDescription = html.slice(html.indexOf('<h1'), heading.index)
  const fields = fieldsFrom(beforeDescription)
  const detailLocation = fields.get('Location') || null
  if (comparable(detailLocation) !== comparable(card.location)) throw new Error('INTECH conflicting native role location')
  for (const [label, value] of [['Experience', card.experienceRequired], ['Job Type', card.employmentType], ['Vacancies', String(card.openingsCount)]]) {
    if (comparable(fields.get(label)) !== comparable(value)) throw new Error('INTECH native role fields conflict')
  }
  const region = html.slice(heading.index + heading[0].length, applyHeading.index)
  const widget = /<div\b[^>]*class=["'][^"']*elementor-widget-text-editor[^"']*["'][^>]*>/i.exec(region)
  const jobDescription = widget ? text(divAt(region, widget.index).inner) : ''
  const descriptionLocation = jobDescription.match(/\bLocation\s*:?\s+(India|USA|United States|United Kingdom|London|Hyderabad|Mumbai|Gandhinagar|Ahmedabad|Bengaluru|Bangalore)\b/i)?.[1]
  const structuredCountry = locationCountry(detailLocation)
  const descriptionCountry = locationCountry(descriptionLocation)
  if (structuredCountry && descriptionCountry && structuredCountry !== descriptionCountry) throw new Error('INTECH conflicting description location country')
  const country = structuredCountry || (/^Work From Home$/i.test(detailLocation ?? '') ? descriptionCountry : null)
  const gaps = []
  if (!country) gaps.push('unverified-country')
  if (jobDescription.length < 100) gaps.push('incomplete-description')
  let postingDate = null
  for (const schema of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const data = JSON.parse(schema[1])
    const webpage = (data['@graph'] ?? [data]).find(node => node['@type'] === 'WebPage' && node.url === card.sourceUrl)
    if (webpage?.datePublished && !Number.isNaN(Date.parse(webpage.datePublished))) postingDate = new Date(webpage.datePublished).toISOString()
  }
  return { ...card, jobDescription, country, postingDate, requisitionId: inputs.get('form_fields[rrf_id]'), gaps }
}

export const createIntechCreativeServicesScraper = ({ now = () => new Date().toISOString(), maxJobs = null } = {}) => ({
  async run({ fetchText = defaultFetchText, fetchInventory = defaultFetchInventory, now: overrideNow, signal, maxJobs: overrideMax } = {}) {
    signal?.throwIfAborted()
    let pagesFetched = 0
    const countRequest = () => { pagesFetched += 1 }
    const initial = await snapshot(fetchText, fetchInventory, signal, countRequest)
    const roles = []
    for (const card of initial.cards) {
      signal?.throwIfAborted()
      countRequest()
      const html = await fetchText(card.sourceUrl, { signal })
      signal?.throwIfAborted()
      roles.push(detailFrom(html, card))
    }
    const final = await snapshot(fetchText, fetchInventory, signal, countRequest)
    if (JSON.stringify(initial) !== JSON.stringify(final)) throw new Error('INTECH published job inventory changed during detail validation')
    const gaps = roles.filter(role => role.gaps.length).map(role => role.postId+':'+role.gaps.join(','))
    const verifiedIndia = roles.filter(role => role.country === 'India' && !role.gaps.length)
      .sort((a, b) => a.title.localeCompare(b.title) || a.experienceRequired.localeCompare(b.experienceRequired) || a.jobId.localeCompare(b.jobId))
    const cap = overrideMax ?? maxJobs
    if (cap != null && (!Number.isInteger(cap) || cap < 1)) throw new Error('INTECH caller maxJobs must be a positive integer')
    const selected = cap ? verifiedIndia.slice(0, cap) : verifiedIndia
    if (selected.length < verifiedIndia.length) gaps.push('caller-cap')
    const scrapedAt = (overrideNow || now)()
    const jobs = selected.map(({ gaps: _gaps, ...job }) => ({
      ...job, city: /^Work From Home$/i.test(job.location) ? null : normalizeCity(job.location) || job.location,
      workplaceType: /^Work From Home$/i.test(job.location) ? 'Remote' : null,
      minimumQualification: null, preferredQualification: null, requiredSkills: [], compensation: null, closingDate: null,
      companyCareerPage: CAREERS_URL, company: COMPANY, source: SOURCE,
      companyDomain: INTECH_CREATIVE_SERVICES_CATALOG.companyDomain, atsPlatform: INTECH_CREATIVE_SERVICES_CATALOG.atsPlatform,
      link: job.applyUrl, scrapedAt, sourceListingComplete: gaps.length === 0,
    }))
    return attachInventoryEvidence(jobs, {
      status: gaps.length ? 'coverage-gap' : 'complete-inventory',
      surface: CAREERS_URL, firstParty: true, listingComplete: gaps.length === 0,
      pagesFetched, reportedTotal: initial.total, indiaFacetCount: roles.some(role => role.gaps.length) ? null : verifiedIndia.length,
      verifiedAt: scrapedAt, reason: gaps.length ? gaps.join('; ') : 'All published identities, paginated cards and native applications agree',
    })
  },
})
export const run = async (options = {}) => createIntechCreativeServicesScraper().run(options)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
