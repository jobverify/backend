import { createHash } from 'node:crypto'
import { readNativeDocument, extractActiveDescription, decodeNativeEntities } from './activeNativeHtml.js'
import { readVisibleNativeDocument } from './visibleNativeHtml.js'
import { normalizeNativeAttributeBoundaries } from './nativeHtmlAttributes.js'
import { nativeCountryName } from '../shared/nativeJobPosting.js'

const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
// These public clients were fetched and reviewed on 2026-11-15. They declare
// the legacy companyinfo -> candidatev2 transition and the v2 company, group,
// allJobs POST, full role GET, and native field transformations. No downloaded
// program is evaluated. Changed deployments require another review.
const clients = Object.freeze({
  legacy: { file: 'main.38495915aab0be25d160.js', sha256: 'fb1c30f3d27ed7ff358db31c20acf465f486befb0f3f2085df5cf0cb6e95fdb7' },
  v2: { file: 'main.819c4120b20f8091.js', sha256: 'ee0926eab1aaa71ffd022d8a0b2898f90b058543b857491c889648cd0ca10b5d' },
})
const need = (condition, message) => { if (!condition) throw Error('Darwinbox recruitment: ' + message) }
const text = value => typeof value === 'string' ? value.trim() : ''
const clean = value => text(value).replace(/\s+/gu, ' ')
const sha = value => createHash('sha256').update(value).digest('hex')
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
const identifier = value => typeof value === 'string' && /^[a-z\d_-]{1,80}$/i.test(value)
const nativeURL = value => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && /^[a-z\d-]+\.darwinbox\.in$/i.test(url.hostname)
      && !url.port && !url.username && !url.password && !url.search && !url.hash ? url : null
  } catch { return null }
}

export function darwinboxRecruitmentBoard(value) {
  const url = nativeURL(value)
  if (!url) return null
  if (/^\/ms\/candidate\/careers\/?$/.test(url.pathname)) {
    return { kind: 'darwinbox', origin: url.origin, url: url.href, mode: 'legacy' }
  }
  const route = url.pathname.match(/^\/ms\/candidatev2\/([a-z\d_-]{1,80})(?:\/careers(?:\/(?:allJobs|home))?)?\/?$/i)
  return route ? { kind: 'darwinbox', origin: url.origin, url: url.href, mode: 'v2', companyId: route[1] } : null
}

const documentOf = page => {
  need(page?.status === 200 && typeof page.html === 'string', 'current public page is unavailable')
  return readNativeDocument(normalizeNativeAttributeBoundaries(page.html))
}
const activeHandoff = (page, url) => {
  const document = readVisibleNativeDocument(normalizeNativeAttributeBoundaries(page.html))
  need(!document.nodes(node => node.tag === 'base').length, 'unreviewed corporate document base')
  return document.nodes(node => node.tag === 'a' && node.attrs.href).some(node => {
    try { return new URL(node.attrs.href, page.url).href === url } catch { return false }
  })
}
const envelope = payload => {
  need(payload && typeof payload === 'object' && !Array.isArray(payload) && payload.status === 'success'
    && !['error', 'errors', 'errorCode', 'exception', 'fault'].some(key => Object.hasOwn(payload, key)), 'native API failure envelope')
  return payload
}
const explicitCountry = value => {
  const label = clean(value).replace(/\s*\([^()]*\)\s*$/, '')
  return nativeCountryName(label.split(',').at(-1)?.trim())
}
const locationFields = ['officelocations_area', 'officelocations_without_area', 'officelocation_show_arr_list', 'tool_tip_locations']
const locationFacts = (listing, detail) => {
  const country = nativeCountryName(listing.country)
  if (country !== 'India' || detail.country != null && (typeof detail.country !== 'string' || text(detail.country) && nativeCountryName(detail.country) !== 'India')) return null
  const labels = []
  for (const record of [listing, detail]) {
    for (const field of locationFields) {
      if (record[field] == null) continue
      if (!Array.isArray(record[field]) || !record[field].length
        || record[field].some(value => typeof value !== 'string' || explicitCountry(value) !== 'India')) return null
      labels.push(...record[field])
    }
    for (const field of ['locations', 'officelocation_show_arr']) {
      if (record[field] == null || clean(record[field]) === 'Multiple Locations') continue
      if (typeof record[field] !== 'string' || explicitCountry(record[field]) !== 'India') return null
    }
  }
  const detailLabels = locationFields.flatMap(field => Array.isArray(detail[field]) ? detail[field] : [])
  return detailLabels.length && labels.length ? { location: clean(detailLabels[0]).replace(/\s+,/g, ','), labels: [...new Set(labels.map(clean))] } : null
}
const epoch = value => {
  if (value == null) return null
  const seconds = typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN
  need(Number.isSafeInteger(seconds) && seconds > 0 && Number.isSafeInteger(seconds * 1000)
    && Number.isFinite(new Date(seconds * 1000).getTime()), 'malformed native publication or closing epoch')
  return new Date(seconds * 1000).toISOString()
}
const datesOf = (listing, detail) => {
  const value = detail.posted_on ?? listing.posted_on
  const numeric = typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value)
  const posted = numeric ? epoch(value) : null
  if (posted && detail.job_posting?.careers?.from != null) need(epoch(detail.job_posting.careers.from) === posted, 'native publication epochs conflict')
  return { posted, closing: epoch(detail.job_posting?.careers?.to) }
}

// This is a source-local, current corporate identity proof, not an employer
// alias. Keep the portal's legal name, corporate statement and role statement
// separate in the output. Other unmatched native account names fail closed.
const fisdomEmployerProof = (publisher, board, company, row, config) => {
  if (config.source !== 'fisdom' || config.companyName !== 'Fisdom' || publisher.url !== 'https://www.fisdom.com/careers/'
    || board.origin !== 'https://fisdom.darwinbox.in' || company.company_name !== 'Finwizard Technology Pvt Ltd'
    || company.subdomain !== 'fisdom' || company.tenant_id !== '119') return null
  const document = readVisibleNativeDocument(normalizeNativeAttributeBoundaries(publisher.html))
  const statement = 'Finwizard Technology Private Limited CIN number : U74900KA2015PTC080747'
  if (!document.nodes(node => ['p', 'div', 'li'].includes(node.tag)).some(node => clean(document.text(node)).includes(statement))) return null
  const description = extractActiveDescription(decodeNativeEntities(row.jd))
  if (!/^About us:\s*Fisdom is an award-winning, Robo-advisory firm operating in the wealth management space\./i.test(clean(description))) return null
  const nativeDocument = readVisibleNativeDocument(normalizeNativeAttributeBoundaries(decodeNativeEntities(row.jd)))
  if (!nativeDocument.nodes(node => node.tag === 'a' && node.attrs.href).some(node => {
    try { const url = new URL(node.attrs.href); return ['http:', 'https:'].includes(url.protocol) && url.hostname === 'www.fisdom.com' && url.pathname === '/' && !url.search && !url.hash } catch { return false }
  })) return null
  return { method: 'current-corporate-legal-statement-and-native-role-employer', officialURL: publisher.url,
    nativeAccountName: company.company_name, corporateStatement: statement,
    nativeRoleEmployerStatement: 'Fisdom is an award-winning, Robo-advisory firm operating in the wealth management space.',
    corporateBodySHA256: sha(publisher.html) }
}

export async function readDarwinboxRecruitment(board, io) {
  const parsed = darwinboxRecruitmentBoard(board?.url), binding = board?.bindingEvidence
  need(parsed && parsed.origin === board.origin && parsed.mode === board.mode && parsed.companyId === board.companyId,
    'unreviewed native board identity')
  need(binding?.verified === true && typeof binding.officialURL === 'string' && binding.bindingMethod === 'runtime-current-careers-link'
    && binding.matchedLinks?.includes(board.url), 'current corporate native handoff is unavailable')
  const { readPage, readRenderer, readJson, permit, matchingEmployer, addJob, inventoryRead, recordRead, unresolved,
    canRead = () => true, maxPages = 12, maxDetails = 20, config = {} } = io
  need(Number.isSafeInteger(maxPages) && maxPages > 0 && maxPages <= 24
    && Number.isSafeInteger(maxDetails) && maxDetails > 0 && maxDetails <= 80, 'invalid public read budget')
  const read = async (callback, url, init = {}) => {
    need(canRead(), 'source request budget reached')
    permit(url, init.method === 'POST' ? ['POST'] : ['GET'])
    return callback(url, { ...init, cache: 'no-store', headers: { 'User-Agent': chrome, ...init.headers } })
  }
  const publisher = await read(readPage, binding.officialURL)
  documentOf(publisher)
  need(publisher.url === binding.officialURL && activeHandoff(publisher, board.url), 'current corporate handoff changed')
  const client = async (url, mode) => {
    const page = await read(readPage, url), document = documentOf(page)
    need(page.url === url, 'native public app response identity changed')
    const bases = document.nodes(node => node.tag === 'base'), basePath = mode === 'legacy' ? '/ms/candidate/' : '/ms/candidatev2/'
    need(bases.length === 1 && bases[0].attrs.href === basePath && document.nodes(node => node.tag === 'app-root').length === 1,
      'native app base identity is unavailable or changed')
    const scripts = document.nodes(node => node.tag === 'script' && node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule'))
      .map(node => new URL(node.attrs.src, board.origin + basePath).href)
    const main = board.origin + basePath + clients[mode].file
    need(scripts.filter(value => value === main).length === 1 && scripts.filter(value => /\/main\.[a-f\d]+\.js$/.test(new URL(value).pathname)).length === 1,
      'native active client deployment is unreviewed')
    const renderer = await read(readRenderer, main)
    need(renderer?.status === 200 && renderer.url === main && typeof renderer.html === 'string'
      && sha(renderer.html) === clients[mode].sha256, 'native active client data flow changed')
    return { page, main }
  }
  const api = board.origin + '/ms/candidateapi/'
  let companyId = parsed.companyId, legacyCompany
  if (parsed.mode === 'legacy') {
    await client(board.url, 'legacy')
    const bridge = envelope(await read(readJson, api + 'companyinfo'))
    legacyCompany = bridge.message?.company
    need(legacyCompany && legacyCompany.new_careers === true && legacyCompany.recruitment_enabled === true
      && text(legacyCompany.company_name) && text(legacyCompany.tenant_id), 'legacy account does not declare the current public app transition')
    // The reviewed legacy client supplies this literal default only when its
    // current route has no companyId. The corporate tenant is never inferred.
    companyId = 'main'
  }
  need(identifier(companyId), 'invalid native company identity')
  const publicBase = board.origin + '/ms/candidatev2/' + companyId
  const active = await client(parsed.mode === 'v2' ? board.url : publicBase, 'v2')
  const companyURL = api + 'getCompanyConfig?is_preview=false&companyId=' + encodeURIComponent(companyId)
  const groupURL = api + 'groupcompanycareersetting?companyId=' + encodeURIComponent(companyId)
  const listURL = api + 'job/alljobs?companyId=' + encodeURIComponent(companyId)
  const companyPayload = envelope(await read(readJson, companyURL)), company = companyPayload.message?.company
  need(company && company.subdomain === new URL(board.origin).hostname.split('.')[0] && text(company.company_name)
    && text(company.tenant_id) && company.recruitment_enabled === true && company.new_careers === true && company.is_preview === false
    && (companyId === 'main' ? company.id === '' : company.id === companyId)
    && Number.isSafeInteger(company.allJobsCount) && company.allJobsCount >= 0, 'native employer account or tenant identity changed')
  if (legacyCompany) need(legacyCompany.tenant_id === company.tenant_id && legacyCompany.company_name === company.company_name,
    'legacy and current native employer accounts conflict')
  const groups = envelope(await read(readJson, groupURL))
  if (groups.message?.code !== 0 || company.group_company_site || company.custom_weblink) unresolved('additional-native-recruiting-channel-unresolved')
  const pages = [], rows = [], seen = new Set()
  let total = null, terminal = false
  for (let page = 1; page <= maxPages; page++) {
    const body = JSON.stringify({ companyId, sort_option: 'new', limit: 10, page })
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept-Language': 'en' }, body }
    const payload = envelope(await read(readJson, listURL, init))
    need(Number.isSafeInteger(payload.job_counts) && payload.job_counts >= 0 && Array.isArray(payload.data), 'malformed native listing total')
    if (total === null) total = payload.job_counts
    need(payload.job_counts === total && total === company.allJobsCount
      && payload.data.length === Math.min(10, total - rows.length), 'native listing pagination or total changed')
    for (const row of payload.data) {
      need(row && identifier(row.id) && text(row.title) && !seen.has(row.id), 'invalid or duplicate native listing role identity')
      need(companyId === 'main' ? row.parent_company_id === '' : row.parent_company_id === companyId, 'native listing changed company account')
      seen.add(row.id); rows.push(row)
    }
    pages.push({ init, snapshot: stable(payload) })
    if (rows.length === total) { terminal = true; break }
  }
  if (!terminal) unresolved('native-listing-budget-reached')
  if (total === 0) unresolved('native-empty-inventory-scope-unverified')
  inventoryRead({ kind: 'darwinbox', surface: listURL, origin: board.origin, companyId, publisher: company.company_name,
    reportedTotal: total, observedRecords: rows.length, pagesFetched: pages.length, nativePaginationComplete: terminal,
    nativeListingTruncated: !terminal, listingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false })
  for (const row of rows) {
    const roleURL = publicBase + '/careers/jobDetails/' + row.id
    recordRead(structuredClone(row), { origin: board.origin, companyId, roleURL })
    if (!nativeCountryName(row.country)) unresolved('native-location-scope-unresolved')
  }
  const candidates = rows.filter(row => nativeCountryName(row.country) === 'India')
  if (candidates.length > maxDetails) unresolved('native-detail-budget-reached')
  const staged = []
  for (const row of candidates.slice(0, maxDetails)) {
    const detailURL = api + 'job/' + row.id + '?companyId=' + encodeURIComponent(companyId)
    const payload = envelope(await read(readJson, detailURL)), values = payload.message?.job
    need(Array.isArray(values) && values.length === 1 && values[0]?.id === row.id && clean(values[0].title) === clean(row.title),
      'native full detail role identity changed')
    const detail = values[0], location = locationFacts(row, detail)
    if (!location) { unresolved('native-location-country-conflict-or-unresolved'); continue }
    const description = typeof detail.jd === 'string' ? decodeNativeEntities(detail.jd) : ''
    const activeDescription = extractActiveDescription(description)
    if (typeof detail.jd !== 'string' || !activeDescription || activeDescription.length < 100
      || /^(?:please\s+)?enter\s+(?:the\s+)?job\s+description[.!]*$/i.test(clean(activeDescription))) {
      unresolved('native-full-description-unavailable'); continue
    }
    const employerBinding = matchingEmployer(company.company_name) ? null : fisdomEmployerProof(publisher, board, company, detail, config)
    need(matchingEmployer(company.company_name) || employerBinding && config.requireNativeEmployerName !== true,
      'native employer lacks current matching corporate legal proof')
    const closing = envelope(await read(readJson, detailURL))
    need(stable(closing) === stable(payload), 'closing native full role criteria changed')
    const roleURL = publicBase + '/careers/jobDetails/' + row.id
    permit(roleURL)
    const dates = datesOf(row, detail)
    staged.push({ id: row.id, title: row.title, url: roleURL, description,
      employer: { name: company.company_name }, ...(employerBinding ? { employerBinding } : {}),
      ...dates, sourcePublicationDateUnavailable: dates.posted === null,
      location: location.location, employmentType: text(detail.emp_type) || text(row.emp_type_name) || null,
      record: { nativeAccount: structuredClone(company), nativeGroupSetting: structuredClone(groups),
        nativeListingRecord: structuredClone(row), nativeDetailPayload: structuredClone(payload),
        nativeOriginalDescription: detail.jd, nativeLocations: location.labels,
        nativeClosingContext: { eachFullRoleRechecked: true, companyScopeComplete: false } } })
  }
  for (const page of pages) need(stable(envelope(await read(readJson, listURL, page.init))) === page.snapshot, 'closing native listing changed')
  need(stable(envelope(await read(readJson, companyURL))) === stable(companyPayload), 'closing native employer account changed')
  need(stable(envelope(await read(readJson, groupURL))) === stable(groups), 'closing native group account context changed')
  const closingPublisher = await read(readPage, binding.officialURL)
  documentOf(closingPublisher)
  need(closingPublisher.url === publisher.url && activeHandoff(closingPublisher, board.url), 'closing current corporate handoff changed')
  for (const job of staged) if (job.employerBinding) need(fisdomEmployerProof(closingPublisher, board, company,
    job.record.nativeDetailPayload.message.job[0], config), 'closing corporate legal employer proof changed')
  const closingClient = await client(parsed.mode === 'v2' ? board.url : publicBase, 'v2')
  need(closingClient.main === active.main, 'closing native active client changed')
  for (const job of staged) {
    Object.assign(job.record.nativeClosingContext, { allSelectedListingPagesRechecked: true, currentPublisherHandoffRechecked: true })
    addJob(job)
  }
}
