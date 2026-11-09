import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const SOURCE = 'degreed'
export const COMPANY = 'Degreed'
export const CAREERS_URL = 'https://degreed.com/experience/careers/'
export const BOARD_URL = 'https://job-boards.greenhouse.io/degreed'
export const API_URL = 'https://boards-api.greenhouse.io/v1/boards/degreed/jobs?content=true'
const BOARD_ROUTE = 'routes/$url_token'
const DETAIL_ROUTE = 'routes/$url_token_.jobs_.$job_post_id'
const BOT_GATE = /verify you are human|checking your browser|just a moment\.\.\.|access denied|captcha challenge/i
const TALENT_POOL = /talent (?:community|network|pool)|speculative|future opportunities|general application/i
const fail = reason => { throw new Error(`degreed:${reason}`) }
const id = value => /^(?:0|[1-9]\d*)$/.test(String(value)) ? String(value) : fail('invalid-native-id')
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const sorted = values => [...new Set(values)].sort()
const text = value => typeof value === 'string' ? value.trim() : ''
const decode = value => String(value || '').replace(/&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos|nbsp));/gi, (match, decimal, hex, named) => {
  if (decimal || hex) {
    const code = Number.parseInt(decimal || hex, decimal ? 10 : 16)
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match
  }
  return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[named.toLowerCase()]
})
export const plainText = value => decode(decode(value)).replace(/<(script|style)\b[^>]*>[^]*?<\/\1>/gi, '')
  .replace(/<\/(?:p|div|h[1-6]|li|ul|ol)>|<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/[\t\r ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
const compactText = value => plainText(value).replace(/\s+/g, ' ')

function jobUrl(value, expectedId) {
  let url
  try { url = new URL(value) } catch { fail('invalid-native-job-url') }
  if (url.origin !== 'https://job-boards.greenhouse.io' || url.username || url.password
    || url.pathname !== `/degreed/jobs/${id(expectedId)}` || url.hash) fail('foreign-native-job-url')
  return url.href
}

function corporateInventory(body, surface) {
  if (!/<html\b|<a\b/i.test(body)) fail('invalid-corporate-html')
  const links = [...body.matchAll(/<(?:a|iframe)\b[^>]*\b(?:href|src)\s*=\s*["']([^"']+)["']/gi)]
    .flatMap(match => { try { return [new URL(decode(match[1]), surface)] } catch { return [] } })
  const careers = sorted(links.filter(url => url.origin === 'https://degreed.com'
    && /^\/experience\/(?:[a-z]{2}(?:-[a-z0-9]+)?\/)?careers\/$/i.test(url.pathname)).map(url => url.origin + url.pathname))
  const ats = links.filter(url => /greenhouse\.io$|lever\.co$|ashbyhq\.com$|myworkdayjobs\.com$|workable\.com$|jobvite\.com$|recruitee\.com$/i.test(url.hostname))
  const reasons = []
  for (const anchor of body.matchAll(/<a\b([^>]*)>([^]*?)<\/a>/gi)) {
    const href = anchor[1].match(/\bhref\s*=\s*["']([^"']+)["']/i)
    if (!href) continue
    let url
    try { url = new URL(decode(href[1]), surface) } catch { continue }
    if (!['https:', 'http:'].includes(url.protocol)) continue
    const hiringAction = /\b(?:careers?|apply(?: now)?|open (?:roles|positions)|(?:view|search|browse) (?:jobs|roles|positions))\b/i.test(compactText(anchor[2]))
      || /\/(?:careers?|jobs?|apply)(?:\/|$)/i.test(url.pathname)
    if (hiringAction && url.origin !== 'https://degreed.com' && !ats.some(candidate => candidate.href === url.href)) reasons.push('additional-advertised-hiring-channel-unresolved')
    if (hiringAction && url.origin === 'https://degreed.com' && url.pathname !== new URL(surface).pathname
      && !careers.includes(url.origin + url.pathname)) reasons.push('additional-advertised-hiring-channel-unresolved')
  }
  const ids = []
  let bound = false
  for (const url of ats) {
    if (!['job-boards.greenhouse.io', 'boards.greenhouse.io'].includes(url.hostname) || !/^\/degreed(?:\/jobs\/\d+)?\/?$/.test(url.pathname) || url.username || url.password) {
      reasons.push('additional-advertised-hiring-channel-unresolved')
      continue
    }
    bound = true
    const match = url.pathname.match(/\/jobs\/(\d+)/)
    if (match) ids.push(id(match[1]))
  }
  if (!bound) fail('current-corporate-binding-unavailable')
  return { careers, ids: sorted(ids), reasons: sorted(reasons) }
}

function loaderData(body) {
  const match = body.match(/window\.__remixContext\s*=\s*(\{[^]*?\});\s*<\/script>/)
  if (!match) fail('native-remix-loader-unavailable')
  let data
  try { data = JSON.parse(match[1]).state?.loaderData } catch { fail('invalid-native-remix-json') }
  if (!data?.root || data.root.urlToken !== 'degreed' || data.root.internal || data.root.preview) fail('foreign-or-nonpublic-native-board')
  return data
}

function listingPage(body, page) {
  const route = loaderData(body)[BOARD_ROUTE]
  if (route?.urlToken !== 'degreed' || route.board?.name !== COMPANY || route.board?.public_url !== BOARD_URL || route.board?.redirect_to) fail('native-board-employer-mismatch')
  const posts = route.jobPosts
  if (!Array.isArray(posts?.data) || !Number.isInteger(posts.total) || posts.total < 0
    || !Number.isInteger(posts.total_pages) || posts.total_pages < 0 || posts.page !== page
    || posts.count !== posts.data.length || (posts.total > 0 && posts.total_pages < 1)) fail('invalid-native-pagination')
  if (posts.total_pages === 0 && (posts.total !== 0 || posts.data.length)) fail('invalid-native-empty-pagination')
  if (!Array.isArray(route.featuredPosts?.data)) fail('invalid-featured-posts')
  for (const row of [...posts.data, ...route.featuredPosts.data]) {
    id(row.id)
    jobUrl(row.absolute_url, row.id)
    if (!text(row.title) || typeof row.location !== 'string') fail('malformed-native-listing-role')
  }
  return { rows: posts.data, featured: route.featuredPosts.data, total: posts.total, pages: Math.max(1, posts.total_pages) }
}

function apiInventory(body) {
  let payload
  try { payload = JSON.parse(body) } catch { fail('invalid-public-api-json') }
  if (!Array.isArray(payload?.jobs) || payload.error || payload.errors || payload.hasMore
    || !Number.isInteger(payload.meta?.total) || payload.meta.total !== payload.jobs.length) fail('incomplete-public-api-inventory')
  const seen = new Set()
  for (const row of payload.jobs) {
    const key = id(row.id)
    if (seen.has(key)) fail('duplicate-native-api-role')
    seen.add(key)
    jobUrl(row.absolute_url, key)
    if (!text(row.title) || !row.location || typeof row.location.name !== 'string'
      || !Array.isArray(row.offices) || (row.metadata != null && !Array.isArray(row.metadata))) fail('malformed-native-api-role')
  }
  return payload.jobs
}

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const countries = new Map()
const countryCodes = new Map()
for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
  const code = String.fromCharCode(a, b), name = regionNames.of(code)
  if (name && name !== code && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code)) {
    countries.set(name.toLowerCase(), { code, name })
    countryCodes.set(code, { code, name })
  }
}
const aliases = new Map([['in', 'IN'], ['ind', 'IN'], ['us', 'US'], ['usa', 'US'], ['united states of america', 'US'], ['uk', 'GB'], ['gbr', 'GB']])
const country = (value, typed = false) => {
  const label = text(value).toLowerCase()
  if (countries.has(label) && (typed || !['georgia', 'jersey', 'guernsey'].includes(label))) return countries.get(label)
  const code = (typed || !['in', 'ind'].includes(label)) ? aliases.get(label) : null
  return countryCodes.get(code) || (typed ? countryCodes.get(label.toUpperCase()) : null) || null
}
const GLOBAL = /\b(?:worldwide|global|anywhere|APAC|EMEA|AMER|NAMER|LATAM|Asia[- ]Pacific)\b/i
const MODE = /^(?:remote|hybrid|on[- ]site|in[- ]office)$/i
const COUNTRY_FIELD = /^(?:(?:job(?: posting)?|office)\s+)?countr(?:y|ies)(?:\s*\(for website only\))?$/i
const LOCATION_FIELD = /^(?:(?:job(?: posting)?|office)\s+)?(?:locations?|countries|country|offices?)(?:\s*\(for website only\))?$/i

function geography(row) {
  const locations = [{ kind: 'primary', label: row.location.name, sourceField: 'location.name', worksite: 'primary' }]
  const reasons = []
  for (const key of Object.keys(row)) if (/locations?|country|countries|offices?|geograph|address/i.test(key)
    && !['location', 'offices', 'metadata'].includes(key) && row[key] != null) reasons.push('unhandled-native-geography')
  if (Object.keys(row.location).some(key => key !== 'name' && row.location[key] != null)) reasons.push('unhandled-native-geography')
  for (const [index, office] of row.offices.entries()) {
    if (!office || (office.location != null && typeof office.location !== 'string') || (office.name != null && typeof office.name !== 'string')) fail('malformed-native-office')
    for (const key of Object.keys(office)) if (key !== 'location' && /country|countries|address|geograph|region|location|office|geo|coordinate|latitude|longitude|postal|city|state|territor|continent/i.test(key)
      && office[key] != null) reasons.push('unhandled-native-office-geography')
    if (office.child_ids != null && (!Array.isArray(office.child_ids) || office.child_ids.length)) reasons.push('native-office-descendant-scope-unresolved')
    locations.push({ kind: 'office', label: office.location || office.name || '', nativeName: office.name || null, sourceField: `offices[${index}]`, worksite: `office-${index}` })
    if (office.location && text(office.name) && office.name !== office.location) locations.push({ kind: 'office-name', label: office.name, descriptive: true, sourceField: `offices[${index}].name`, worksite: `office-${index}` })
  }
  for (const [index, entry] of (row.metadata || []).entries()) {
    if (!entry || typeof entry.name !== 'string') fail('malformed-native-metadata')
    if (!LOCATION_FIELD.test(entry.name)) {
      if (/location|country|countries|office|region|geograph/i.test(entry.name) && entry.value != null && String(entry.value).trim()) reasons.push('unhandled-native-geography')
      continue
    }
    for (const value of Array.isArray(entry.value) ? entry.value : entry.value == null ? [] : [entry.value]) {
      if (typeof value !== 'string') fail('malformed-native-geography')
      locations.push({ kind: COUNTRY_FIELD.test(entry.name) ? 'country' : 'metadata', label: value, sourceField: `metadata[${index}].${entry.name}` })
    }
  }
  for (const location of locations) {
    const label = text(location.label)
    const found = new Map()
    let unknownSegment = false
    const exact = country(label, location.kind === 'country')
    if (exact) found.set(exact.code, exact)
    if (location.kind !== 'country') {
      for (const part of label.split(/\s*(?:[;|/+]|\s+or\s+)\s*/i)) {
        if (!part || MODE.test(part.trim())) continue
        let segmentKnown = false
        const segmentCodes = new Set()
        const direct = country(part)
        if (direct) { found.set(direct.code, direct); segmentKnown = true; segmentCodes.add(direct.code) }
        for (const [name, candidate] of countries) {
          // A country word in a role location is geographic evidence. Georgia
          // and other city/state homonyms require an explicit country field.
          if (['georgia', 'jersey', 'guernsey'].includes(name)) continue
          const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          if (new RegExp(`(?:^|[^\\p{L}])${escaped}(?=$|[^\\p{L}])`, 'iu').test(part)) { found.set(candidate.code, candidate); segmentKnown = true; segmentCodes.add(candidate.code) }
        }
        if (/\b(?:US|USA)\b/.test(part)) { found.set('US', { code: 'US', name: 'United States' }); segmentKnown = true; segmentCodes.add('US') }
        if (/\bUK\b/.test(part)) { found.set('GB', { code: 'GB', name: 'United Kingdom' }); segmentKnown = true; segmentCodes.add('GB') }
        if (segmentCodes.size > 1) { location.conflicted = true; reasons.push('contradictory-native-worksite-countries') }
        if (!segmentKnown) unknownSegment = true
      }
    }
    location.countryCodes = [...found.keys()].sort()
    location.country = found.size === 1 ? [...found.values()][0].name : null
    location.countries = [...found.values()].map(value => value.name).sort()
    location.known = found.size > 0 && !GLOBAL.test(label) && !unknownSegment && !location.conflicted
  }
  for (const worksite of sorted(locations.map(location => location.worksite).filter(Boolean))) {
    const members = locations.filter(location => location.worksite === worksite)
    if (members.length > 1 && sorted(members.flatMap(location => location.countryCodes)).length > 1) {
      for (const member of members) { member.conflicted = true; member.known = false }
      reasons.push('contradictory-native-worksite-countries')
    }
  }
  const known = locations.filter(location => location.known)
  for (const location of locations) if (!location.known && !(MODE.test(text(location.label)) && known.length)
    && !(location.descriptive && !location.conflicted && !GLOBAL.test(location.label)
      && known.some(candidate => candidate.worksite === location.worksite))) reasons.push('native-role-country-unresolved')
  const all = sorted(known.flatMap(location => location.countryCodes))
  return { locations, reasons: sorted(reasons), codes: all, india: all.includes('IN'), conflicted: reasons.includes('contradictory-native-worksite-countries') }
}

function publication(value) {
  if (!text(value)) return { value: null, precision: 'unknown' }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))) return { value, precision: 'day' }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && !Number.isNaN(Date.parse(value))) return { value: new Date(value).toISOString(), precision: 'instant' }
  fail('invalid-original-publication-date')
}

function roleSchemas(body, key) {
  const result = []
  const visit = node => {
    if (Array.isArray(node)) return node.forEach(visit)
    if (!node || typeof node !== 'object') return
    if ([node['@type']].flat().includes('JobPosting')) {
      if (node.url && jobUrl(node.url, key) !== `${BOARD_URL}/jobs/${key}`) fail('foreign-native-schema-url')
      if (node.hiringOrganization?.name && node.hiringOrganization.name !== COMPANY) fail('foreign-native-schema-employer')
      result.push(node)
    }
    if (node['@graph']) visit(node['@graph'])
  }
  for (const match of body.matchAll(/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([^]*?)<\/script>/gi)) {
    let node
    try { node = JSON.parse(match[1]) } catch { fail('invalid-native-schema-json') }
    visit(node)
  }
  return result
}

function extractRole(row, listing, body) {
  const route = loaderData(body)[DETAIL_ROUTE], detail = route?.jobPost
  const key = id(row.id)
  if (!detail || route.urlToken !== 'degreed' || String(route.jobPostId) !== key || detail.company_name !== COMPANY
    || detail.post_type !== 'job_post' || detail.redirect_to || detail.title !== row.title
    || jobUrl(detail.public_url, key) !== row.absolute_url || String(detail.hiring_plan_id) !== String(row.internal_job_id)
    || detail.job_post_location !== row.location.name) fail('native-detail-identity-mismatch')
  if (!compactText(detail.content)) fail('native-role-full-criteria-unavailable')
  if (!compactText(row.content).includes(compactText(detail.content))) fail('native-api-detail-criteria-mismatch')
  const nativeDescriptionHtml = [detail.introduction, detail.content, detail.conclusion].filter(value => typeof value === 'string').join('\n')
  if (compactText(row.content) !== compactText(nativeDescriptionHtml)) fail('native-api-detail-full-description-mismatch')
  const sourceDescription = plainText(nativeDescriptionHtml)
  const geo = geography(row)
  const schemas = roleSchemas(body, key)
  const schemaDates = sorted(schemas.map(schema => schema.datePosted).filter(value => typeof value === 'string'))
  if (schemaDates.length > 1) geo.reasons.push('contradictory-native-schema-dates')
  // Current Degreed details have no JobPosting schema. Preserve a future schema
  // date independently, and do not silently ignore newly introduced geography.
  if (schemas.some(schema => schema.jobLocation || schema.applicantLocationRequirements || schema.jobLocationType)) geo.reasons.push('native-schema-geography-unresolved')
  for (const field of Object.keys(detail)) if (/location|country|countries|office|address|geograph/i.test(field)
    && field !== 'job_post_location' && detail[field] != null) geo.reasons.push('unhandled-native-detail-geography')
  const date = publication(row.first_published)
  const selected = geo.locations.find(location => location.countryCodes.includes('IN')) || geo.locations[0]
  return {
    job: {
      source: SOURCE, company: COMPANY, companyDomain: 'degreed.com', companyCareerPage: CAREERS_URL,
      atsPlatform: 'greenhouse-native-remix-and-public-api', jobId: key, title: row.title,
      requisitionId: row.requisition_id == null ? null : String(row.requisition_id), nativeInternalJobId: String(row.internal_job_id),
      location: selected?.label || null, country: geo.conflicted ? null : geo.india ? 'India' : geo.codes.length === 1 ? regionNames.of(geo.codes[0]) : null,
      sourceLocations: geo.locations, nativeCountryCodes: geo.codes, nativePrimaryLocation: row.location.name,
      applyUrl: row.absolute_url, sourceUrl: row.absolute_url, link: row.absolute_url,
      postingDate: date.value, postingDatePrecision: date.precision, nativeFirstPublished: row.first_published || null,
      nativeUpdatedAt: row.updated_at || null, nativeBoardUpdatedAt: listing.updated_at || null,
      nativeBoardPublishedAt: listing.published_at || null, nativeDetailPublishedAt: detail.published_at || null,
      schemaDatePosted: schemaDates.length === 1 ? schemaDates[0] : null,
      nativeSchemaDates: schemaDates, nativeSchemaDateModified: schemas.map(schema => schema.dateModified).filter(value => typeof value === 'string'),
      jobType: ['hidden', null, undefined, ''].includes(detail.employment) ? null : detail.employment,
      department: row.departments?.map(department => department.name).filter(Boolean).join(' | ') || null,
      sourceDescription, jobDescription: sourceDescription, description: sourceDescription,
      nativeDescriptionHtml, nativeApiDescriptionHtml: row.content,
      scrapedAt: new Date().toISOString(),
    }, geo, selected: geo.india && !geo.conflicted && !TALENT_POOL.test(row.title),
  }
}

const listingSignature = rows => rows.map(row => ({ id: String(row.id), title: row.title, internal_job_id: row.internal_job_id,
  requisition_id: row.requisition_id, location: row.location, absolute_url: row.absolute_url, published_at: row.published_at, updated_at: row.updated_at, department: row.department })).sort((a, b) => a.id.localeCompare(b.id))
const apiSignature = rows => rows.map(row => ({ id: String(row.id), title: row.title, internal_job_id: row.internal_job_id,
  requisition_id: row.requisition_id, location: row.location, absolute_url: row.absolute_url, first_published: row.first_published,
  updated_at: row.updated_at, offices: row.offices, metadata: row.metadata, content: row.content, departments: row.departments })).sort((a, b) => a.id.localeCompare(b.id))

export async function run({ fetchImpl = globalThis.fetch, signal, maxJobs = Infinity, onAudit } = {}) {
  const reasons = new Set(), selected = [], nativeJobs = [], channels = new Map()
  let pagesFetched = 0, nativeTotal = null, sourceComplete = false, stopped = false
  const get = async url => {
    if (stopped) fail('requests-stopped-after-denial')
    signal?.throwIfAborted()
    const response = await fetchImpl(url, { method: 'GET', signal })
    pagesFetched++
    const body = await response.text()
    if ([401, 403, 429].includes(response.status) || BOT_GATE.test(body.slice(0, 25000))) {
      stopped = true
      fail(`source-access-denied-${response.status}`)
    }
    if (!response.ok) fail(`http-${response.status}`)
    if (response.url && new URL(response.url).origin !== new URL(url).origin) fail('unexpected-cross-origin-redirect')
    return body
  }
  const boardInventory = async () => {
    const first = listingPage(await get(BOARD_URL), 1)
    const rows = [...first.rows], featured = [...first.featured]
    for (let page = 2; page <= first.pages; page++) {
      const next = listingPage(await get(`${BOARD_URL}?page=${page}`), page)
      if (next.total !== first.total || next.pages !== first.pages) fail('native-pagination-drift')
      rows.push(...next.rows)
      featured.push(...next.featured)
    }
    if (rows.length !== first.total || new Set(rows.map(row => String(row.id))).size !== rows.length) fail('native-listing-count-or-identity-mismatch')
    for (const row of featured) if (!rows.some(item => same(listingSignature([item]), listingSignature([row])))) fail('unreconciled-featured-channel')
    return rows
  }
  try {
    const queue = [CAREERS_URL]
    for (let index = 0; index < queue.length; index++) {
      const url = queue[index]
      if (channels.has(url)) continue
      const inventory = corporateInventory(await get(url), url)
      channels.set(url, inventory)
      inventory.reasons.forEach(reason => reasons.add(reason))
      for (const next of inventory.careers) if (!queue.includes(next)) queue.push(next)
    }
    const openingBoard = await boardInventory()
    const openingApi = apiInventory(await get(API_URL))
    if (!same(sorted(openingBoard.map(row => String(row.id))), sorted(openingApi.map(row => String(row.id))))) fail('native-board-api-identity-set-mismatch')
    nativeTotal = openingApi.length
    for (const channel of channels.values()) for (const key of channel.ids) if (!openingApi.some(row => String(row.id) === key)) fail('advertised-role-missing-from-native-inventory')
    for (const row of openingApi) {
      const listing = openingBoard.find(item => String(item.id) === String(row.id))
      if (listing.title !== row.title || listing.location !== row.location.name || listing.absolute_url !== row.absolute_url
        || String(listing.internal_job_id) !== String(row.internal_job_id)
        || String(listing.requisition_id ?? '') !== String(row.requisition_id ?? '')) fail('native-board-api-role-mismatch')
      try {
        const role = extractRole(row, listing, await get(row.absolute_url))
        nativeJobs.push(role.job)
        role.geo.reasons.forEach(reason => reasons.add(reason))
        if (role.selected) selected.push(role.job)
      } catch (error) {
        if (stopped || signal?.aborted) throw error
        reasons.add(error.message)
      }
    }
    for (const [url, opening] of channels) {
      const closing = corporateInventory(await get(url), url)
      if (!same(opening, closing)) reasons.add('corporate-closing-inventory-drift')
    }
    const closingBoard = await boardInventory()
    if (!same(listingSignature(openingBoard), listingSignature(closingBoard))) reasons.add('native-board-closing-inventory-drift')
    const closingApi = apiInventory(await get(API_URL))
    if (!same(apiSignature(openingApi), apiSignature(closingApi))) reasons.add('native-api-closing-inventory-drift')
    if (nativeJobs.length !== nativeTotal) reasons.add('native-role-detail-coverage-gap')
    sourceComplete = reasons.size === 0
  } catch (error) {
    if (signal?.aborted) throw error
    reasons.add(error.message)
  }
  const countKnown = sourceComplete
  const limit = Number.isFinite(maxJobs) && maxJobs >= 0 ? Math.floor(maxJobs) : Infinity
  const jobs = selected.slice(0, limit)
  if (jobs.length < selected.length) reasons.add('output-cap')
  const listingComplete = sourceComplete && jobs.length === selected.length
  for (const job of [...nativeJobs, ...jobs]) {
    job.sourceScopeComplete = sourceComplete
    job.sourceListingComplete = listingComplete
    job.lifecycleCleanupAllowed = listingComplete
  }
  const evidence = {
    status: listingComplete ? nativeTotal === 0 ? 'verified-empty' : 'complete-inventory' : 'discovery-only',
    surface: CAREERS_URL, firstParty: channels.has(CAREERS_URL), listingComplete, pagesFetched,
    reportedTotal: countKnown ? nativeTotal : null, indiaFacetCount: countKnown ? selected.length : null,
    verifiedAt: new Date().toISOString(), reason: listingComplete ? 'degreed-corporate-channels-native-board-api-details-and-closing-inventories-reconciled' : `degreed-incomplete:${[...reasons].sort().join(';')}`,
  }
  onAudit?.({ sourceComplete, nativeTotal: countKnown ? nativeTotal : null, observedNativeTotal: nativeTotal,
    healthyNativeCount: nativeJobs.length, indiaCount: countKnown ? selected.length : null, observedHealthyIndiaCount: selected.length,
    returnedCount: jobs.length, channels: [...channels.keys()], stoppedAfterDenial: stopped, reasons: [...reasons].sort(), nativeJobs })
  return attachInventoryEvidence(jobs, evidence)
}
