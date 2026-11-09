import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "biorad"
export const COMPANY = "Bio-Rad"
export const CAREERS_URL = 'https://careers.bio-rad.com/india'
const ORIGIN = new URL(CAREERS_URL).origin
const SEARCH = `${ORIGIN}/jobs/search?country_codes%5B%5D=IN`
const COMPANY_UID = '8d672184bb3335c103499c3f4bd5a671'
const requireProof = (condition, message) => { if (!condition) throw new Error(`Bio-Rad: ${message}`) }
const decode = value => String(value ?? '').replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&(amp|quot|apos|nbsp|lt|gt|ndash|mdash|hellip);/g, (_, n) => ({amp:'&',quot:'"',apos:"'",nbsp:' ',lt:'<',gt:'>',ndash:'–',mdash:'—',hellip:'…'})[n])
const norm = value => decode(value).replace(/\s+/g, ' ').trim()

// Small source-local tree reader: exact attributes, active elements only, and raw
// script bodies kept separately. Inert markup cannot supply a title or full JD.
const dom = input => {
  const html = String(input), root = {tag:'root', attrs:{}, children:[]}, stack = [root]
  const raw = new Set(['script','style','textarea','title','xmp','iframe','noembed','noframes','plaintext','noscript'])
  const voids = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
  const tags = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?([a-z][a-z0-9:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
  let cursor = 0, match
  while ((match = tags.exec(html))) {
    const parent = stack.at(-1)
    if (match.index > cursor) parent.children.push(html.slice(cursor, match.index))
    cursor = tags.lastIndex
    if (!match[1]) continue
    const tag = match[1].toLowerCase()
    if (match[0].startsWith('</')) {
      const at = stack.findLastIndex(node => node.tag === tag)
      if (at > 0) stack.length = at
      continue
    }
    const attrs = {}
    for (const a of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const key = a[1].toLowerCase()
      requireProof(!Object.hasOwn(attrs, key), 'Duplicate native HTML attribute')
      attrs[key] = decode(a[2] ?? a[3] ?? a[4] ?? '')
    }
    const node = {tag,attrs,children:[],inert:parent.inert || tag === 'template' || (raw.has(tag) && tag !== 'script')}
    parent.children.push(node)
    if (raw.has(tag)) {
      const end = tag === 'plaintext' ? null : new RegExp(`</${tag}\\s*>`, 'ig')
      if (end) end.lastIndex = cursor
      const closing = end?.exec(html)
      node.raw = html.slice(cursor, closing?.index ?? html.length)
      cursor = closing ? end.lastIndex : html.length
      tags.lastIndex = cursor
    } else if (!voids.has(tag)) stack.push(node)
  }
  if (cursor < html.length) stack.at(-1).children.push(html.slice(cursor))
  return root
}
const all = (node, predicate) => node.inert ? [] : [ ...(predicate(node) ? [node] : []), ...node.children.filter(child => typeof child !== 'string').flatMap(child => all(child, predicate)) ]
const text = node => node.inert || node.tag === 'script' ? '' : norm(node.children.map(child => typeof child === 'string' ? child : text(child)).join(' '))
const cls = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const one = (nodes, label) => { requireProof(nodes.length === 1, `Expected one ${label}`); return nodes[0] }
const exactUrl = (value, pathname) => {
  const url = new URL(value, ORIGIN)
  requireProof(url.origin === ORIGIN && !url.username && !url.password && !url.hash && (!pathname || url.pathname === pathname), 'Unexpected native URL')
  return url
}
const verifyCompany = tree => {
  const assignments = []
  for (const node of all(tree, n => n.tag === 'script' && !n.attrs.src && ['', 'text/javascript', 'application/javascript', 'module'].includes(n.attrs.type || ''))) {
    const tokens = [...node.raw.matchAll(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|[a-z_$][\w$]*|[^\s]/gi)].map(m => m[0]).filter(v => !v.startsWith('//') && !v.startsWith('/*'))
    for (let i = 0; i < tokens.length - 8; i++) if (tokens.slice(i, i+5).join(' ') === 'js_vars . company = {') {
      requireProof(tokens[i+5] === '"uid"' && tokens[i+6] === ':' && tokens[i+8] === '}', 'Malformed native company identity')
      assignments.push(JSON.parse(tokens[i+7]))
    }
  }
  requireProof(assignments.length > 0 && assignments.every(uid => uid === COMPANY_UID), 'Native company identity unavailable or conflicting')
}
const indiaLocation = value => {
  requireProof(typeof value === 'string' && /,\s*India$/i.test(norm(value)) && norm(value).split(',').length >= 2, 'Unknown or foreign native location')
  return norm(value)
}
const searchUrl = value => {
  const url = exactUrl(value, '/jobs/search')
  requireProof(url.searchParams.getAll('country_codes[]').length === 1 && url.searchParams.get('country_codes[]') === 'IN'
    && [...url.searchParams.keys()].every(key => ['country_codes[]','page'].includes(key))
    && (!url.searchParams.has('page') || /^[1-9]\d*$/.test(url.searchParams.get('page'))), 'Native pagination scope changed')
  return url
}
export function parseBioRadListing(html, pageUrl = SEARCH) {
  const url = searchUrl(pageUrl), tree = dom(html)
  verifyCompany(tree)
  const form = one(all(tree, n => n.tag === 'form' && cls(n, 'job-search-results-form')), 'native search form')
  exactUrl(form.attrs.action, '/jobs/search')
  requireProof(form.attrs.method?.toLowerCase() === 'get', 'Unexpected search method')
  const filters = all(form, n => n.tag === 'input' && n.attrs.name === 'country_codes[]' && Object.hasOwn(n.attrs, 'checked'))
  requireProof(filters.length === 1 && filters[0].attrs.value === 'IN', 'Native India filter not selected')
  const table = one(all(form, n => n.tag === 'table' && n.attrs['data-controller'] === 'jobs--table-results'), 'native listing table')
  const jobs = all(table, n => n.tag === 'tr' && Object.hasOwn(n.attrs, 'data-job-url')).map(row => {
    const cell = name => one(all(row, n => n.tag === 'td' && cls(n, `job-search-results-${name}`)), name)
    const anchor = one(all(cell('title'), n => n.tag === 'a'), 'native role link')
    const sourceUrl = exactUrl(anchor.attrs.href).href
    requireProof(anchor.attrs.href && sourceUrl === exactUrl(row.attrs['data-job-url']).href && new URL(sourceUrl).pathname.startsWith('/jobs/') && !new URL(sourceUrl).search, 'Native listing URL mismatch')
    const title = text(anchor), requisitionId = text(cell('requisition-identifiers'))
    const locations = all(cell('location'), n => n.tag === 'li').map(n => indiaLocation(text(n)))
    requireProof(title && /^\d{4}-\d+$/.test(requisitionId) && locations.length > 0, 'Native listing identity missing')
    return {jobId:requisitionId,requisitionId,title,company:COMPANY,location:locations.join('; '),locations,country:'India',sourceUrl,applyUrl:sourceUrl,jobDescription:null,sourceDetailComplete:false}
  })
  const count = text(one(all(form, n => cls(n,'table-counts')), 'native total'))
  const whole = count.match(/^Displaying all (\d+) entries$/i), range = count.match(/^Displaying (\d+)\s*-\s*(\d+) of (\d+) in total$/i)
  requireProof(whole || range, 'Explicit native inventory count unavailable')
  const total = Number(whole?.[1] ?? range?.[3]), start = whole ? (total ? 1 : 0) : Number(range[1]), end = whole ? total : Number(range[2])
  requireProof(Number.isSafeInteger(total) && jobs.length === (total ? end-start+1 : 0) && end <= total && (total === 0 || start >= 1), 'Native listing count mismatch')
  requireProof(new Set(jobs.map(j => j.jobId)).size === jobs.length && new Set(jobs.map(j => j.sourceUrl)).size === jobs.length, 'Duplicate native listing identity')
  const next = [...new Set(all(form, n => n.tag === 'a' && (n.attrs.rel || '').split(/\s+/).includes('next')).map(n => searchUrl(n.attrs.href).href))]
  requireProof(next.length <= 1 && (end < total ? next.length === 1 : next.length === 0), 'Native pagination end/count mismatch')
  if (next.length) requireProof(Number(new URL(next[0]).searchParams.get('page')) === Number(url.searchParams.get('page') || 1)+1, 'Native pagination did not advance')
  return {jobs,total,start,end,nextUrl:next[0] || null}
}
const nativeDate = value => {
  requireProof(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value), 'Invalid native date')
  const parsed = new Date(value)
  requireProof(Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,19) === value.slice(0,19), 'Invalid native calendar date')
  return parsed.toISOString()
}
export function parseBioRadDetail(html, listing, {now = new Date()} = {}) {
  const tree = dom(html)
  verifyCompany(tree)
  const canonical = one(all(tree, n => n.tag === 'link' && n.attrs.rel === 'canonical'), 'canonical URL')
  requireProof(canonical.attrs.href && exactUrl(canonical.attrs.href).href === listing.sourceUrl, 'Canonical identity mismatch')
  const models = all(tree, n => n.tag === 'script' && n.attrs.type === 'application/ld+json' && !n.attrs.src).flatMap(n => {
    const parsed = JSON.parse(n.raw)
    return Array.isArray(parsed) ? parsed : parsed['@graph'] || [parsed]
  }).filter(model => model['@type'] === 'JobPosting')
  const model = one(models, 'native JobPosting')
  requireProof(model.hiringOrganization?.name === 'Bio-Rad Laboratories, Inc.' && model.identifier?.name === 'Bio-Rad Laboratories, Inc.', 'Native employer mismatch')
  const uid = model.identifier?.value
  requireProof(typeof uid === 'string' && /^[a-f0-9]{32}$/.test(uid), 'Native job UID unavailable')
  const titles = all(tree, n => /^h[1-6]$/.test(n.tag) && cls(n,'job-title') && (n.attrs.id || '').startsWith('job_title_')).map(text)
  requireProof(typeof model.title === 'string' && norm(model.title) === listing.title && titles.length > 0 && titles.every(t => t === listing.title), 'Native title mismatch')
  const req = all(tree, n => n.tag === 'span' && (n.attrs.id || '').startsWith(`requisition_identifier_icon_text_${uid}_`)).map(text)
  requireProof(req.length > 0 && req.every(id => id === listing.requisitionId), 'Native requisition/UID mismatch')
  const locations = all(tree, n => n.tag === 'span' && (n.attrs.id || '').startsWith(`location_icon_text_${uid}_`)).map(n => indiaLocation(text(n)))
  requireProof(locations.length > 0 && locations.every(value => listing.locations.includes(value)) && listing.locations.every(value => locations.includes(value)), 'Native detail/listing location mismatch')
  requireProof(Array.isArray(model.jobLocation) && model.jobLocation.length === listing.locations.length, 'Native structured location unavailable')
  for (const place of model.jobLocation) {
    const address = place?.address
    requireProof(address?.addressCountry === 'IN' && typeof address.addressLocality === 'string'
      && listing.locations.some(value => value.split(',')[0].trim().toLowerCase() === norm(address.addressLocality).toLowerCase()), 'Native structured country/city mismatch')
  }
  const frames = all(tree, n => n.tag === 'turbo-frame' && (n.attrs.src || '').includes('job_uid='))
  requireProof(frames.length > 0 && frames.every(n => { const u = exactUrl(n.attrs.src); return /^\/pages\/[a-f0-9]{32}\/blocks\/[a-f0-9]{32}$/.test(u.pathname) && u.searchParams.getAll('job_uid').length === 1 && u.searchParams.get('job_uid') === uid }), 'Native application identity mismatch')
  const description = one(all(tree, n => cls(n,'job-description')), 'full native description')
  requireProof(typeof model.description === 'string', 'Native description type unavailable')
  const body = text(dom(model.description)), visibleBody = text(description)
  requireProof(body === visibleBody, 'Native full description disagrees with visible detail')
  const complete = hasSourceDescription({sourceDescription:model.description}) && Boolean(body)
  const postedAt = nativeDate(model.datePosted), checkedAt = new Date(now).getTime()
  requireProof(Number.isFinite(checkedAt) && Date.parse(postedAt) <= checkedAt, 'Native publication is future or check time is invalid')
  return {...listing,nativeJobUid:uid,jobDescription:complete ? body : null,sourceDescription:complete ? model.description : null,
    sourceDetailComplete:complete,sourceDetailReason:complete ? null : 'native-empty-description',
    postedAt,closingDate:nativeDate(model.validThrough),sourceClosingDateIsExact:true}
}
export async function run({fetchText, signal, maxPages = 100, maxJobs = null, now = () => new Date().toISOString()} = {}) {
  signal?.throwIfAborted()
  requireProof(Number.isSafeInteger(maxPages) && maxPages > 0 && (maxJobs === null || Number.isSafeInteger(maxJobs) && maxJobs >= 0), 'Invalid source bounds')
  const get = async url => {
    signal?.throwIfAborted()
    if (fetchText) { const value = await fetchText(url, {signal}); signal?.throwIfAborted(); return value }
    const response = await fetch(url, {signal:signal ? AbortSignal.any([signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000),redirect:'error'})
    if (response.status !== 200 || response.url !== url) {
      const blocked = [202, 401, 403, 429, 451].includes(response.status)
      throw Object.assign(new Error(`Bio-Rad: Native HTTP ${response.status} for ${url}; final URL ${response.url}`),
        {status:response.status,requestUrl:url,finalUrl:response.url,stage:url === CAREERS_URL ? 'landing' : url.startsWith(SEARCH) ? 'listing' : 'detail',
          ...(blocked ? {softFailure:true,upstreamOutage:false,failureKind:'blocked_or_access_denied',abortRetries:true} : {})})
    }
    return response.text()
  }
  const landing = dom(await get(CAREERS_URL))
  requireProof(all(landing, n => n.tag === 'a' && n.attrs.href && new URL(n.attrs.href, ORIGIN).href === `${ORIGIN}/jobs/search`).length > 0, 'Official India/search handoff missing')
  const rows = [], ids = new Set(), urls = new Set()
  let next = SEARCH, total = null, pages = 0, previousEnd = 0
  while (next && pages < maxPages) {
    const page = parseBioRadListing(await get(next), next)
    requireProof((total === null || total === page.total) && page.start === (page.total ? previousEnd+1 : 0), 'Native pagination total/range drift')
    total = page.total; previousEnd = page.end; pages++
    for (const job of page.jobs) {
      requireProof(!ids.has(job.jobId) && !urls.has(job.sourceUrl), 'Duplicate native identity across pages')
      ids.add(job.jobId); urls.add(job.sourceUrl); rows.push(job)
    }
    next = page.nextUrl
  }
  const complete = !next && rows.length === total && (maxJobs === null || maxJobs >= rows.length)
  const jobs = []
  for (const row of rows.slice(0,maxJobs ?? rows.length)) {
    signal?.throwIfAborted()
    try { jobs.push({...parseBioRadDetail(await get(row.sourceUrl),row,{now:now()}),sourceListingComplete:complete,scrapedAt:new Date().toISOString()}) }
    catch (error) { signal?.throwIfAborted(); jobs.push({...row,sourceListingComplete:complete,sourceDetailComplete:false,sourceDetailReason:`detail-unavailable: ${error.message}`,scrapedAt:new Date().toISOString()}) }
  }
  return attachInventoryEvidence(jobs,{status:complete ? total === 0 ? 'verified-empty' : 'complete-inventory' : 'discovery-only',surface:SEARCH,firstParty:true,listingComplete:complete,
    pagesFetched:pages,reportedTotal:total,indiaFacetCount:total,verifiedAt:new Date().toISOString(),reason:complete ? 'native-country-filter-full-inventory' : 'native-inventory-capped'})
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
