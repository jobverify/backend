import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { INNOVAL_DIGITAL_SOLUTIONS_CATALOG } from './catalog.js'
import { composeAbortSignals } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { CANONICAL_CITIES } from '../../scraper-support/utils/cities.js'
import { mapWithConcurrency } from '../../scraper-support/utils/mapWithConcurrency.js'
import { toPlainText } from '../../scraper-support/detailExtractors/shared.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA = INNOVAL_DIGITAL_SOLUTIONS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const COMPANY_PAGE_URL = PROVIDER_METADATA.companyPageUrl
export const VERIFIED_ON = PROVIDER_METADATA.verifiedOn

const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const decode = value => String(value ?? '').replace(/&(#x[\da-f]+|#\d+|amp|nbsp|quot|apos|lt|gt|ndash|mdash|rsquo|lsquo|ldquo|rdquo|bull|hellip);/gi, (entity, key) => {
  if (key.startsWith('#')) return String.fromCodePoint(key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1)))
  return ({ amp: '&', nbsp: ' ', quot: '"', apos: "'", lt: '<', gt: '>', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', bull: '•', hellip: '…' })[key.toLowerCase()]
})
const text = value => toPlainText(decode(value))
const attr = (tag, name) => decode(tag.match(new RegExp('\\b' + name + '=["\\\']([^"\\\']*)["\\\']', 'i'))?.[1] || '')

// The portal nests spans within the description and divs within each card.
// Balance the matching element tag so nested content cannot truncate a public role.
const elements = (html, predicate) => {
  const result = []
  for (const opening of String(html).matchAll(/<([a-z][\w:-]*)\b[^>]*>/gi)) {
    if (!predicate(opening[0], opening[1].toLowerCase())) continue
    const tags = new RegExp('<(\\/?)' + opening[1] + '\\b[^>]*>', 'gi')
    tags.lastIndex = opening.index
    let depth = 0, tag
    while ((tag = tags.exec(html))) {
      depth += tag[1] ? -1 : 1
      if (!depth) break
    }
    if (depth) throw new Error('Innoval incomplete public job inventory: unterminated element')
    result.push({ tag: opening[0], inner: html.slice(opening.index + opening[0].length, tag.index) })
  }
  return result
}
const byId = (html, id) => {
  const found = elements(html, tag => attr(tag, 'id') === id)
  if (found.length !== 1) throw new Error('Innoval job detail or listing field missing or repeated: ' + id)
  return found[0]
}
const hiddenJobIds = html => [...String(html).matchAll(/<input\b[^>]*>/gi)]
  .filter(match => attr(match[0], 'name') === 'id_job' && attr(match[0], 'type') === 'hidden')
  .map(match => attr(match[0], 'value'))
const same = (a, b) => normalize(a).toLowerCase() === normalize(b).toLowerCase()
const parseDate = value => {
  const match = normalize(value).match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!match) throw new Error('Innoval unresolved public job date')
  const [, day, month, year] = match
  const iso = year + '-' + month + '-' + day
  const parsed = new Date(iso + 'T00:00:00.000Z')
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) throw new Error('Innoval invalid public job date')
  return iso
}
const locationCountry = value => {
  const locations = normalize(value).split(/\s*\/\s*/)
  if (locations.length && locations.every(location => CANONICAL_CITIES[location.toLowerCase()]
    && !/^(remote|none)$/i.test(location))) return 'India'
  if (/^(Singapore|Dubai|United Arab Emirates|USA|United States|United Kingdom|London)$/i.test(normalize(value))) return 'foreign'
  throw new Error('Innoval unresolved public location country: ' + value)
}
const appScripts = html => [...String(html).matchAll(/<script\b[^>]*>/gi)]
  .map(match => attr(match[0], 'src')).filter(Boolean)
  .map(src => new URL(src, COMPANY_PAGE_URL))
  .filter(url => url.origin === new URL(COMPANY_PAGE_URL).origin && /^\/_next\/static\/chunks\/[^/]+\.js$/.test(url.pathname))
  .map(url => url.toString())
export const hasVerifiedCareersSignal = html => /<title>[^<]*Innoval Digital[^<]*<\/title>/i.test(html)
  && /href=["']\/company\/\?tab=careers["']/i.test(html) && appScripts(html).length > 0
const portalIdentity = html => /<title>\s*Career\s*\|\s*Innoval Digital Solutions Pvt Ltd\s*<\/title>/i.test(html)
  && /alt=["']Innoval Digital Solutions["']/i.test(html)
const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'JobverifyCareerScraper/1.0', Accept: 'text/html,application/javascript,*/*' },
    signal: composeAbortSignals(signal, AbortSignal.timeout(15000)),
    redirect: 'follow',
  })
  return { status: response.status, url: response.url, html: await response.text() }
}
const getPage = async (fetchPage, url) => {
  const page = await fetchPage(url)
  if (page.status !== 200 || page.url !== url) throw new Error('Innoval public job request failed for ' + url)
  return page.html
}
const parseCards = html => {
  // No paging control is present on the verified server-rendered portal.
  const visible = String(html).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '')
  if (/<(?:a|button|nav|div)\b[^>]*(?:\brel=["']next["']|\bclass=["'][^"']*(?:pagination|load-more|alm-)|[?&](?:page|offset)=)/i.test(visible)
    || /<(?:button|a)\b[^>]*>\s*(?:Load more|Next page|Next)\s*</i.test(visible)) throw new Error('Innoval unsupported public job pagination')
  if (!portalIdentity(html) || !/>\s*Hot Jobs\s*</i.test(html)) throw new Error('Innoval verified careers portal changed materially')
  const listing = byId(visible, 'job-openings').inner
  const cards = elements(listing, tag => attr(tag, 'class').split(/\s+/).includes('job-list-item'))
  const allCards = elements(visible, tag => attr(tag, 'class').split(/\s+/).includes('job-list-item'))
  const links = [...visible.matchAll(/<a\b[^>]*>/gi)].filter(match => /viewDetails\d+\.html/i.test(attr(match[0], 'href')))
  if (!cards.length || cards.length !== allCards.length || cards.length !== links.length || cards.length !== hiddenJobIds(visible).length) throw new Error('Innoval incomplete public job inventory: cards, IDs and detail links disagree')
  const seen = new Set()
  return cards.map(card => {
    const ids = hiddenJobIds(card.inner)
    const title = normalize(text(elements(card.inner, (_, tag) => tag === 'h3')[0]?.inner || ''))
    const field = label => normalize(text(card.inner.match(new RegExp('>\\s*' + label + ':\\s*<\\/span>\\s*<strong\\b[^>]*>([\\s\\S]*?)<\\/strong>', 'i'))?.[1] || ''))
    const location = field('Location'), experience = field('Experience'), closing = field('Last Date')
    const anchors = [...card.inner.matchAll(/<a\b[^>]*>/gi)]
    const url = anchors.length === 1 ? new URL(attr(anchors[0][0], 'href'), CAREERS_URL).toString() : ''
    if (ids.length !== 1 || !/^\d+$/.test(ids[0]) || seen.has(ids[0]) || !title || !location || !experience
      || url !== CAREERS_URL + 'viewDetails' + ids[0] + '.html') throw new Error('Innoval incomplete public job inventory: missing, repeated or mismatched card fields')
    seen.add(ids[0])
    return { id: ids[0], title, location, experience, closingDate: parseDate(closing), country: locationCountry(location), url }
  })
}
const mapDetail = (card, html) => {
  if (!portalIdentity(html)) throw new Error('Innoval verified job detail identity changed')
  const field = id => normalize(text(byId(html, id).inner))
  const title = field('rptjobDesc_ctl00_Label2'), location = field('rptJobDetails_ctl00_Label2'), experience = field('rptJobDetails_ctl00_Label1')
  const postingDate = parseDate(field('lblPostedDate')), closingDate = parseDate(field('rptJobDetails_ctl00_Label8'))
  const jobDescription = text(byId(html, 'rptjobDesc_ctl00_Label1').inner)
  const ids = hiddenJobIds(html)
  const forms = [...html.matchAll(/<form\b[^>]*>/gi)].filter(match => attr(match[0], 'id') === 'apply-details-form')
  if (ids.length !== 1 || ids[0] !== card.id || !same(title, card.title) || !same(location, card.location) || !same(experience, card.experience)
    || closingDate !== card.closingDate || !jobDescription || forms.length !== 1 || attr(forms[0][0], 'method').toLowerCase() !== 'post'
    || new URL(attr(forms[0][0], 'action'), card.url).toString() !== CAREERS_URL + 'index.php?mod=dynpage&req=applyform') throw new Error('Innoval public job detail no longer matches its listing and application form')
  return {
    title, company: COMPANY, location, city: CANONICAL_CITIES[location.split('/')[0].trim().toLowerCase()] || null,
    state: null, country: card.country === 'India' ? 'India' : null,
    jobId: card.id, requisitionId: card.id, sourceUrl: card.url, applyUrl: card.url,
    experienceRequired: experience, publicExperienceChecked: true, jobDescription,
    postingDate, closingDate, employmentType: null, remoteStatus: null,
    minimumQualification: null, preferredQualification: null, requiredSkills: [],
  }
}

export const createInnovalDigitalSolutionsScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchPage, signal } = {}) {
    fetchPage ??= url => defaultFetchPage(url, { signal })
    const company = await getPage(fetchPage, COMPANY_PAGE_URL)
    if (!hasVerifiedCareersSignal(company)) throw new Error('Innoval official careers handoff changed materially')
    const scripts = [...new Set(appScripts(company))]
    if (!scripts.length || scripts.length > 40) throw new Error('Innoval official careers handoff application assets changed')
    const assets = await mapWithConcurrency(scripts, 3, url => getPage(fetchPage, url))
    const targets = new Set(assets.flatMap(asset => [...asset.matchAll(/href:["'](https:\/\/share\.google\/[a-zA-Z0-9]+)["'][^{}]{0,250}children:["']Explore Current Openings["']/g)].map(match => match[1])))
    if (targets.size !== 1) throw new Error('Innoval official careers handoff current-openings CTA changed')
    const portal = await fetchPage([...targets][0])
    if (portal.status !== 200 || portal.url !== CAREERS_URL || !portalIdentity(portal.html)) throw new Error('Innoval verified careers portal handoff changed materially')
    const cards = parseCards(portal.html)
    const details = await mapWithConcurrency(cards, 3, async card => mapDetail(card, await getPage(fetchPage, card.url)))
    const jobs = details.filter((job, index) => cards[index].country === 'India' && job.closingDate >= now().slice(0, 10))
      .map(job => ({ ...job, source: SOURCE, link: job.applyUrl, scrapedAt: now() }))
    return attachInventoryEvidence(jobs, {
      status: jobs.length ? 'complete-inventory' : 'verified-empty', surface: CAREERS_URL,
      firstParty: true, listingComplete: true, pagesFetched: 1, reportedTotal: null, indiaFacetCount: jobs.length,
      verifiedAt: now(), reason: 'official-careers-handoff-complete-inline-listing-' + cards.length + '-cards-and-details-reconciled-active-india',
    })
  },
})
export const run = async (options = {}) => createInnovalDigitalSolutionsScraper().run(options)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
