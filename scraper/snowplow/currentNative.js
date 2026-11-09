import {settingsFor,runtime,bounded,failure} from './nativeRuntime20261107.js'
import {nativeTransport,MAX_BYTES} from './nativeTransport20261107.js'
import fs from 'node:fs'
import {types} from 'node:util'
import {createHash} from 'node:crypto'
import {createHiBobNativeInventory} from '../../scraper-support/hibob/nativeInventory.js'
import {readInventoryEvidence, attachInventoryEvidence, normalizeInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {NATIVE_CONFIG} from './catalog.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const reviewed = JSON.parse(fs.readFileSync(new URL('./reviewedNative.json', import.meta.url), 'utf8'))
const reviewedCurrent = JSON.parse(fs.readFileSync(new URL('./reviewedNative20261105.json', import.meta.url), 'utf8'))
const reviewedNovember6 = JSON.parse(fs.readFileSync(new URL('./reviewedNative20261106.json', import.meta.url), 'utf8'))
const reviewedNovember6Evening = JSON.parse(fs.readFileSync(new URL('./reviewedNative20261106Evening.json', import.meta.url), 'utf8'))
const reviewedDeployments = [reviewed, reviewedCurrent, reviewedNovember6, reviewedNovember6Evening]
const hash = text => createHash('sha256').update(text).digest('hex')
const stable = value => {
  assertSafeNumbers(value)
  return JSON.stringify(value, (_, v) => v && !Array.isArray(v) && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map(k => [k, v[k]])) : v)
}
const keysAre = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k))
const sections = ['description', 'responsibilities', 'requirements', 'benefits', 'payTransparencySalaryAdditionalInfo']
const compensation = ['payTransparencyMinSalary', 'payTransparencyMaxSalary', 'payTransparencySalaryCurrency', 'payTransparencySalaryPayPeriod']
const countries = new Map([['United Kingdom', 'GB'], ['United States', 'US'], ['India', 'IN']])
const requireProof = (ok, message) => { if (!ok) throw new Error('Snowplow native proof: ' + message) }
const assertSafeNumbers = value => {
  const pending = [value]
  while (pending.length) {
    const item = pending.pop()
    if (typeof item === 'number') requireProof(Number.isFinite(item) && (!Number.isInteger(item) || Number.isSafeInteger(item)), 'unsafe native JSON numeric value')
    else if (item && typeof item === 'object') for (const child of Object.values(item)) pending.push(child)
  }
}
const decimalIdentity = literal => {
  const match = literal.match(/^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/)
  requireProof(match, 'unsafe native JSON numeric token')
  const digits = (match[2] + (match[3] || '')).replace(/^0+/, '')
  if (!digits) return '0'
  const coefficient = digits.replace(/0+$/, ''), exponent = Number(match[4] || 0)
  const power = exponent - (match[3]?.length || 0) + digits.length - coefficient.length
  requireProof(Number.isSafeInteger(exponent) && Number.isSafeInteger(power), 'unsafe native JSON numeric exponent')
  return match[1] + coefficient + 'e' + power
}
const parseNativeJSON = text => {
  const value = JSON.parse(text)
  assertSafeNumbers(value)
  // Inspect literal tokens as well as parsed values. JSON.parse can round an
  // unsafe fractional identity to a reviewed integer or underflow a nonzero
  // criterion to zero; JSON.stringify would then conceal the original change.
  const number = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '"') {
      for (index++; index < text.length; index++) {
        if (text[index] === '\\') index++
        else if (text[index] === '"') break
      }
    } else if (text[index] === '-' || /\d/.test(text[index])) {
      number.lastIndex = index
      const literal = number.exec(text)?.[0]
      requireProof(literal && decimalIdentity(literal) === decimalIdentity(String(Number(literal))), 'unsafe native JSON numeric precision loss')
      index = number.lastIndex - 1
    }
  }
  return value
}
const defaultFetchPage = async (url, init) => {
  const response = await fetch(url, init), chunks = []
  let size = 0
  for await (const chunk of response.body) {
    size += chunk.length
    if (size > 8 * 1024 * 1024) { await response.body.cancel().catch(() => {}); throw new Error('Snowplow response byte cap exceeded') }
    chunks.push(chunk)
  }
  // Response.text supplies native BOM/UTF-8 semantics; never Buffer.toString a response.
  return {status: response.status, url: response.url, contentType: response.headers.get('content-type'), body: await new Response(Buffer.concat(chunks)).text()}
}
const calendar = value => {
  if (value == null || value === '') return true
  if (typeof value !== 'string') return false
  const match = value.match(/^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d{1,9})?(Z|[+-]\d\d:\d\d)$/)
  if (!match) return false
  const [, y, m, d, h, min, sec, zone] = match, max = new Date(Date.UTC(+y, +m, 0)).getUTCDate()
  return +m >= 1 && +m <= 12 && +d >= 1 && +d <= max && +h < 24 && +min < 60 && +sec < 60
    && (zone === 'Z' || +zone.slice(1, 3) <= 23 && +zone.slice(4) <= 59) && Number.isFinite(Date.parse(value))
}
const visibleSection = value => {
  if (value == null || value === '') return null
  requireProof(typeof value === 'string', 'section scalar type changed')
  const document = readVisibleNativeDocument(value, {strict: true}), root = document.nodes(n => n.tag === 'root')[0]
  const visible = root ? extractActiveDescription(document.text(root)) : null
  requireProof(visible && visible === extractActiveDescription(value), 'hidden or incomplete role criteria')
  return visible
}
const validateRow = (raw, review = reviewed) => {
  if (review.version) requireProof(Array.isArray(raw.postingLocations) && raw.postingLocations.length === 0, 'unreviewed native posting location alternatives')
  requireProof(keysAre(raw, Object.keys(review.observedRowFieldTypes)), 'native role fields changed')
  for (const [key, allowed] of Object.entries(review.observedRowFieldTypes)) {
    const type = raw[key] === null ? 'null' : Array.isArray(raw[key]) ? 'array' : typeof raw[key]
    requireProof(allowed.includes(type), 'native field type changed: ' + key)
  }
  requireProof(keysAre(raw.sectionLabels, Object.keys(raw.sectionLabels)) && Object.keys(raw.sectionLabels).every(k => [...sections, 'payTransparencySalary'].includes(k) && typeof raw.sectionLabels[k] === 'string'), 'section label criteria changed')
  requireProof(countries.has(raw.country), 'unresolved typed native country')
  requireProof(!countries.has(raw.site) || countries.get(raw.site) === countries.get(raw.country), 'native site country conflict')
  requireProof(['publishedAt', 'validThrough', 'closingDate'].every(k => calendar(raw[k])), 'native calendar date invalid')
  const nativeSections = Object.fromEntries(sections.map(k => [k, visibleSection(raw[k])]))
  requireProof(nativeSections.description, 'full description missing')
  // Country-only scalar validation cannot rule out new location alternatives
  // embedded in employer criteria. Bind the entire reviewed original record;
  // never remove description/date/geo fields to make a changed role qualify.
  requireProof(review.forms[raw.id]?.fullRawRoleCriteriaSha256 === hash(stable(raw)), 'unreviewed complete native role criteria or location alternatives')
  return {jobId: raw.id, countryCode: countries.get(raw.country), rawCountry: raw.country, rawSite: raw.site, nativeSections}
}
const validateForm = (payload, raw, row, review = reviewed) => {
  const pin = review.forms[raw.id], data = payload?.data, job = data?.jobAd
  requireProof(pin && keysAre(payload, ['metadata', 'data']) && keysAre(data, ['jobAd', 'companyLists', 'agency', 'supportedFileTypes']), 'unreviewed role application schema')
  requireProof(hash(stable(payload.metadata)) === pin.metadataSha256, 'unreviewed nested application metadata')
  requireProof(hash(stable(Object.fromEntries(Object.entries(data).filter(([k]) => k !== 'jobAd')))) === pin.otherDataSha256, 'unreviewed application supporting criteria')
  if (review.version) requireProof(Array.isArray(job?.postingLocations) && job.postingLocations.length === 0
    && stable(job.postingLocations) === stable(raw.postingLocations), 'unreviewed application posting location alternatives')
  requireProof(keysAre(job, ['applicationForm', 'jobDescription', 'type', 'title', 'site', 'languageCode', 'employmentType', 'workspaceType', ...(review.version ? ['postingLocations'] : [])]) && job.type === 'api'
    && job.title === raw.title && job.site === raw.site + ', ' + raw.country && job.languageCode === raw.language
    && job.employmentType === raw.employmentType && job.workspaceType === raw.workspaceType, 'native role/application identity conflict')
  requireProof(hash(stable(job.applicationForm)) === pin.applicationFormSha256, 'unreviewed application mandatory fields/questions')
  const allowed = [...sections, ...compensation, 'sectionLabels'], prefix = '/jobAd/descriptionId./jobDescription/'
  requireProof(job.jobDescription && typeof job.jobDescription === 'object' && !Array.isArray(job.jobDescription)
    && Object.keys(job.jobDescription).every(k => allowed.some(a => k === prefix + a)), 'unknown nested role description criteria')
  for (const key of allowed) {
    const cell = job.jobDescription[prefix + key]
    requireProof(cell == null || keysAre(cell, ['value']), 'unknown nested criteria properties')
    requireProof(stable(cell?.value ?? null) === stable(raw[key] ?? null), 'raw native detail criteria mismatch: ' + key)
    if (sections.includes(key)) requireProof(visibleSection(cell?.value) === row.nativeSections[key], 'native visible detail criteria mismatch')
  }
  return payload
}

// The corporate redesign now publishes its own current role inventory. Its
// visible cards must agree with the complete native feed, including countries;
// a reviewed program or a subset of known records cannot prove that agreement.
const reconcileCorporateRoles = (html, rows) => {
  const document = readVisibleNativeDocument(html, {strict: true})
  const lists = document.nodes(n => n.tag === 'ul' && n.attrs.id === 'rlist')
  requireProof(lists.length === 1, 'current corporate role inventory missing or ambiguous')
  const descendants = node => node.children.filter(child => typeof child !== 'string').flatMap(child => [child, ...descendants(child)])
  const cards = lists[0].children.filter(child => typeof child !== 'string')
  requireProof(cards.length === rows.length, 'corporate/native inventory identity mismatch')
  const native = new Map(rows.map(row => [row.id, row])), ids = new Set()
  return cards.map(card => {
    const nodes = descendants(card), anchors = nodes.filter(n => n.tag === 'a')
    const match = anchors.length === 1 && anchors[0].attrs.href?.match(/^https:\/\/snowplow\.careers\.hibob\.com\/jobs\/([a-f0-9-]+)$/)
    const raw = match && native.get(match[1])
    requireProof(card.tag === 'li' && raw && !ids.has(raw.id), 'corporate/native role identity mismatch')
    ids.add(raw.id)
    const field = name => {
      const cells = nodes.filter(n => document.hasClass(n, name))
      requireProof(cells.length === 1, 'corporate role field missing or ambiguous')
      return document.text(cells[0])
    }
    const location = raw.site === raw.country ? raw.country : raw.site + ', ' + raw.country
    requireProof(field('rt') === raw.title && field('rd') === raw.department && field('rl') === location + ' · ' + raw.workspaceType
      && card.attrs['data-d'] === raw.department && card.attrs['data-l'] === location && card.attrs['data-t'] === raw.title.toLowerCase(), 'corporate/native role criteria or country mismatch')
    return {jobId: raw.id, title: raw.title, department: raw.department, location, country: raw.country}
  })
}

// Derived from the retained 2026-10-30 original filterGroups envelope.
// Provenance and original hashes: legacy-feed-scope-proof.json in the repair report.
const legacyFeedScopeSha256 = 'a6d4b75f6d60faf5294c16ab8c8d62040435bc274fec06c8cb8dfd05b08607bb'
const canonicalFeed = (feed, review) => stable(review.version
  ? {...feed, jobAdDetails: [...feed.jobAdDetails].sort((a, b) => a.id.localeCompare(b.id))} : feed)

// The original engine always receives the original responses. Archived proof
// supplements only its obsolete-client guard. The current deployment separately
// validates its new metadata/location schema before supplementing exactly those
// reviewed gaps. Resource bodies, MIME and redirects stay independently bound.
const createReviewedSnowplowScraper = (defaults = {}, mode = {}) => ({async run(options = {}) {
  const settings = {...defaults, ...options}, load = settings.fetchPage || defaultFetchPage, receipts = []
  let review = reviewed, employerDeployments = []
  const corporateGaps = []
  const inspectCorporate = (html, rows, phase) => {
    try { return reconcileCorporateRoles(html, rows) }
    catch (error) {
      // Only a mismatch already preserved in this exact reviewed deployment
      // can continue as an observation. It remains an unresolved scope gap.
      requireProof(review.preservedCorporateMismatch && error.message === 'Snowplow native proof: ' + review.preservedCorporateMismatch,
        'unreviewed corporate/native inventory disagreement: ' + error.message)
      corporateGaps.push(phase + '-corporate-scope-unresolved:' + error.message)
      return null
    }
  }
  const fetchPage = async (url, init) => {
    settings.signal?.throwIfAborted()
    const resource=review.resources.find(item=>item.url===url)
    let response = await load(url, init)
    settings.signal?.throwIfAborted()
    if(!mode.diagnostic&&resource?.finalUrl&&resource.finalUrl!==url&&[301,302,303,307,308].includes(response?.status)){
      requireProof(response.url===url&&response.redirected!==true,'original intermediate redirect identity changed')
      const location=response.headers?.location
      requireProof(typeof location==='string'&&location===location.trim()&&new URL(location,url).href===resource.finalUrl,'unreviewed publisher resource redirect')
      // The canonical target is the exact independently retained publisher
      // declaration. This second GET passes the same outer admission budget.
      response=await load(resource.finalUrl,init)
      settings.signal?.throwIfAborted()
    }
    receipts.push({url, response})
    if (!mode.diagnostic) {
      if (response?.status !== 200) throw Object.assign(failure('Snowplow public HTTP '+response?.status,'SNOWPLOW_HTTP_ERROR'),{status:response?.status??null,abortRetries:true,...([401,403,429,451].includes(response?.status)?{failureKind:'blocked_or_access_denied',softFailure:true,upstreamOutage:true}:{})})
      requireProof(response.url === (resource?.finalUrl||url) && typeof response.body === 'string' && Buffer.byteLength(response.body) <= MAX_BYTES && response.bodyComplete !== false,'original response identity/body availability changed')
      if(resource)requireProof(response.contentType===resource.contentType&&hash(response.body)===resource.sha256,'declared native renderer/style/program changed: '+url)
    }
    if (url === NATIVE_CONFIG.careers || url === NATIVE_CONFIG.board) {
      // Selection binds one complete independently reviewed deployment; never
      // mix an archived employer page with a current native renderer/cohort.
      if (url === NATIVE_CONFIG.careers && receipts.length === 1 && typeof response?.body === 'string') {
        employerDeployments = reviewedDeployments.filter(candidate => hash(response.body) === candidate.corporateBodySha256)
        review = employerDeployments[0] || reviewed
      }
      // One employer page can survive multiple native deployments. Select only
      // an exact reviewed employer/board pair, then bind that pair at closing.
      if (url === NATIVE_CONFIG.board && receipts.length === 2 && typeof response?.body === 'string') {
        review = employerDeployments.find(candidate => hash(response.body) === candidate.boardBodySha256) || review
      }
      const expected = url === NATIVE_CONFIG.careers ? review.corporateBodySha256 : review.boardBodySha256
      const accepted = response?.status === 200 && response.url === url && /^text\/html\b/i.test(response.contentType || '')
        && typeof response.body === 'string' && hash(response.body) === expected
      if (!accepted) {
        const reason = 'unreviewed complete raw employer/native DOM or activation'
        throw Object.assign(Error('Snowplow native proof: ' + reason), {code:'SNOWPLOW_NATIVE_UNREVIEWED',
          abortRetries:true,failureKind:'incomplete_listing',source:'snowplow',sourceListingComplete:false,sourceScopeComplete:false,
          status:response?.status??null,requestUrl:url,finalUrl:response?.url??null,retainedNativeResponses:receipts,
          inventoryEvidence:normalizeInventoryEvidence({status:'coverage-gap',surface:url,firstParty:true,listingComplete:false,
            pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason})})
      }
      if (url === NATIVE_CONFIG.careers) {
        const document = readVisibleNativeDocument(response.body, {strict: true})
        requireProof(document.nodes(n => n.tag === 'a' && n.attrs.href === NATIVE_CONFIG.board && document.text(n)).length > 0, 'visible first-party handoff missing')
        mode.onHome?.()
      }
    }
    if(!mode.diagnostic&&url===NATIVE_CONFIG.board+'api/career-site'){
      requireProof(/^application\/json\b/i.test(response.contentType||'')&&hash(stable(parseNativeJSON(response.body)))===review.siteCanonicalSha256,'native site configuration or scope changed')
    }
    if(!mode.diagnostic&&url===NATIVE_CONFIG.board+'api/job-ad'){
      const payload=parseNativeJSON(response.body)
      requireProof(Array.isArray(payload?.jobAdDetails),'invalid native feed rows')
      requireProof(/^application\/json\b/i.test(response.contentType||''),'native feed MIME changed')
      if(review.version)requireProof(keysAre(payload,['filterGroups','jobAdDetails','jobOpeningMetadata'])&&hash(stable({filterGroups:payload.filterGroups,jobOpeningMetadata:payload.jobOpeningMetadata}))===review.feedScopeSha256,'unreviewed native filter/opening metadata or geographic scope')
      else requireProof(keysAre(payload,['filterGroups','jobAdDetails'])&&hash(stable({filterGroups:payload.filterGroups}))===legacyFeedScopeSha256,'unreviewed legacy native feed envelope or scope')
      const rows=payload.jobAdDetails.map(raw=>validateRow(raw,review))
      mode.onFeed?.({payload,rows})
      if(review.version)inspectCorporate(receipts.find(r=>r.url===NATIVE_CONFIG.careers).response.body,payload.jobAdDetails,'native-read')
    }
    return response
  }
  const jobs = await createHiBobNativeInventory(NATIVE_CONFIG, {...settings, fetchPage}).run()
  const originalEngineEvidence = readInventoryEvidence(jobs), gaps = corporateGaps, detailProofs = [], countryProofs = []
  const audit = {originalEngineEvidence, nativeInventoryCount: null, canonicalCountryCounts: {}, countryProofs, detailProofs, gaps,
    rawOpeningFeed: null, rawClosingFeed: null, rawOpeningSite: null, rawClosingSite: null, receipts, sourceScopeComplete: false}
  const retainedNative = url => receipts.filter(r => r.url === url).map(r => JSON.parse(r.response.body))
  const feedUrl = NATIVE_CONFIG.board + 'api/job-ad', siteUrl = NATIVE_CONFIG.board + 'api/career-site'
  audit.rawOpeningFeed = retainedNative(feedUrl)[0]
  audit.rawClosingFeed = retainedNative(feedUrl).at(-1)
  audit.rawOpeningSite = retainedNative(siteUrl)[0]
  audit.rawClosingSite = retainedNative(siteUrl).at(-1)
  const get = async (url, kind, resource = null) => {
    const response = await fetchPage(url, {method: 'GET', headers: {Accept: kind === 'json' ? 'application/json' : '*/*', ...(kind === 'json' ? {companyIdentifier: 'snowplow'} : {}), ...resource?.requestHeaders},
      signal: settings.signal ? AbortSignal.any([settings.signal, AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000)})
    requireProof(response?.status === 200 && response.url === (resource?.finalUrl || url) && typeof response.body === 'string' && Buffer.byteLength(response.body) <= 8 * 1024 * 1024
      && (!resource || response.contentType === resource.contentType)
      && (kind === 'json' ? /^application\/json\b/i : kind === 'html' ? /^text\/html\b/i : /^(?:text|application)\/(?:javascript|css)\b/i).test(response.contentType || ''), 'public response status/identity/MIME/cap changed')
    return kind === 'json' ? parseNativeJSON(response.body) : response.body
  }
  const reconcileCorporate = (html, rows, phase) => { audit.corporateRoleProofs = inspectCorporate(html, rows, phase) }
  try {
    // Preserve the originals in receipts/audit, then validate every original
    // engine JSON response before any supplemental type, hash or pin claims.
    for (const receipt of receipts) if (receipt.url.startsWith(NATIVE_CONFIG.board + 'api/')) parseNativeJSON(receipt.response.body)
    const rawRows = audit.rawOpeningFeed.jobAdDetails
    if (review.version) {
      requireProof(keysAre(audit.rawOpeningFeed, ['filterGroups', 'jobAdDetails', 'jobOpeningMetadata'])
        && hash(stable({filterGroups: audit.rawOpeningFeed.filterGroups, jobOpeningMetadata: audit.rawOpeningFeed.jobOpeningMetadata})) === review.feedScopeSha256, 'unreviewed native filter/opening metadata or geographic scope')
      reconcileCorporate(receipts.find(r => r.url === NATIVE_CONFIG.careers).response.body, rawRows, 'opening')
      const expected = [...review.supplementedBaseEngineGaps, ...(review.preservedBaseEngineGaps || []), ...rawRows.map(raw => 'unverified-native-role-fields:' + raw.id)].sort()
      const actual = originalEngineEvidence?.reason?.startsWith('hibob-native-incomplete:')
        ? originalEngineEvidence.reason.slice('hibob-native-incomplete:'.length).split(';').sort() : null
      requireProof(stable(actual) === stable(expected), 'original engine has additional unresolved guards: ' + originalEngineEvidence?.reason)
      for (const reason of review.preservedBaseEngineGaps || []) gaps.push('base-engine-scope-unresolved:' + reason)
    } else requireProof(originalEngineEvidence?.reason === 'hibob-native-incomplete:public-client-contract-changed', 'original engine has additional unresolved guards: ' + originalEngineEvidence?.reason)
    for (const resource of review.resources) requireProof(hash(await get(resource.url, 'program', resource)) === resource.sha256, 'declared native renderer/style/program changed: ' + resource.url)
    // Retain every unresolved declaration from the reviewed deployment as a
    // gap. Data-only native inspection cannot certify this renderer or cleanup.
    for (const resource of review.unresolvedResources) gaps.push('unreviewed-declared-stylesheet:' + resource.url)
    requireProof(hash(stable(audit.rawOpeningSite)) === review.siteCanonicalSha256, 'native employer configuration/side channels changed')
    for (const group of Object.values(audit.rawOpeningFeed.filterGroups)) requireProof(Array.isArray(group)
      && group.every(item => keysAre(item, ['serverId', 'value']) && ['string', 'number'].includes(typeof item.serverId)
        && typeof item.value === 'string'), 'unknown nested filter identity/criteria')
    const rows = rawRows.map(raw => validateRow(raw, review))
    audit.nativeInventoryCount = rawRows.length
    for (const row of rows) { countryProofs.push(row); audit.canonicalCountryCounts[row.countryCode] = (audit.canonicalCountryCounts[row.countryCode] || 0) + 1 }
    for (const [index, raw] of rawRows.entries()) {
      const url = NATIVE_CONFIG.board + 'api/job-ad/' + raw.id + '/application-form'
      detailProofs.push({jobId: raw.id, url, rawOpening: validateForm(await get(url, 'json'), raw, rows[index], review), rawClosing: null})
    }
    await get(NATIVE_CONFIG.careers, 'html')
    await get(NATIVE_CONFIG.board, 'html')
    audit.rawClosingSite = await get(siteUrl, 'json')
    audit.rawClosingFeed = await get(feedUrl, 'json')
    requireProof(stable(audit.rawOpeningSite) === stable(audit.rawClosingSite) && canonicalFeed(audit.rawOpeningFeed, review) === canonicalFeed(audit.rawClosingFeed, review), 'full raw closing cohort/criteria changed')
    if (review.version) reconcileCorporate(receipts.filter(r => r.url === NATIVE_CONFIG.careers).at(-1).response.body, audit.rawClosingFeed.jobAdDetails, 'closing')
    for (const [index, proof] of detailProofs.entries()) {
      proof.rawClosing = validateForm(await get(proof.url, 'json'), rawRows[index], rows[index], review)
      requireProof(stable(proof.rawOpening) === stable(proof.rawClosing), 'full raw closing application criteria changed')
    }
    // Re-read the actual complete activated/reachable cohort, including the
    // unversioned typography alias. Version-looking URLs are not freshness proof.
    for (const resource of review.resources) requireProof(hash(await get(resource.url, 'program', resource)) === resource.sha256, 'closing declared native renderer/style/program changed: ' + resource.url)
    // Positive India jobs need the strongest engine's current application proof
    // plus a separately reviewed criteria projection before supplementing scope.
    if (rows.some(row => row.countryCode === 'IN')) gaps.push('India-application-criteria-projection-unreviewed')
  } catch (error) {
    settings.signal?.throwIfAborted()
    if(!mode.diagnostic)throw error
    gaps.push(error.message)
  }
  settings.signal?.throwIfAborted()
  const complete = gaps.length === 0 && audit.rawClosingFeed !== null
  audit.sourceScopeComplete = complete
  for (const job of jobs) if (!complete) Object.assign(job, {sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    sourceDetailComplete: false, sourceDetailFailureKind: 'snowplow-current-native-proof-incomplete'})
  await settings.onAudit?.(audit)
  settings.signal?.throwIfAborted()
  const result = attachInventoryEvidence(jobs, {...originalEngineEvidence, listingComplete: complete, status: complete ? audit.nativeInventoryCount ? 'complete-inventory' : 'verified-empty' : 'discovery-only',
    reportedTotal: complete ? audit.nativeInventoryCount : null, indiaFacetCount: complete ? jobs.length : null, pagesFetched: receipts.length,
    reason: complete ? 'snowplow-current-declared-client-and-full-native-cohort-reconciled' : 'snowplow-current-native-partial:' + gaps.join(';')})
  return audit.nativeInventoryCount == null ? result : attachSourceObservationEvidence(result, {source:'snowplow',recordKind:'vacancy-rows',
    observedRecordCount:audit.nativeInventoryCount,observedVacancyCount:audit.nativeInventoryCount,sourceScopeComplete:false})
}})


const errorValue=(error,key)=>{for(let item=error,depth=0;item&&typeof item==='object'&&depth<5;item=Object.getPrototypeOf(item),depth++){const field=Object.getOwnPropertyDescriptor(item,key);if(field)return field.value}}
const safeFailure=error=>({name:errorValue(error,'name')??null,code:errorValue(error,'code')??null,message:typeof errorValue(error,'message')==='string'?errorValue(error,'message').slice(0,500):typeof error==='string'?error.slice(0,500):null})
const inventory=(receipts,firstParty=false,reason='Snowplow native incomplete')=>normalizeInventoryEvidence({status:'coverage-gap',surface:NATIVE_CONFIG.careers,firstParty,listingComplete:false,pagesFetched:receipts.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:null,reason})
export const createCurrentSnowplowScraper=(defaults={})=>({async run(options={}){
 const settings=settingsFor(defaults,options),control=runtime(settings),receipts=[],attempts=[]
 let audit,result,firstError,failureObserved=false,feedFacts=null,homeQualified=false
 const fetchPage=async(url,init)=>{
  control.admit();attempts.push({url,method:'GET',redirect:'manual',credentials:'omit'})
  // One record per admitted GET. Native streaming updates this occurrence;
  // a caller reusing its response object cannot overwrite an earlier response.
  let receipt
  const retain=response=>{
   if(!response||typeof response!=='object')return
   if(!receipt){receipt={url,response:null};receipts.push(receipt)}
   const bytes=typeof response.body==='string'?Buffer.byteLength(response.body):null,oversized=bytes!==null&&bytes>MAX_BYTES
   receipt.response={...response,headers:response.headers?{...response.headers}:response.headers,body:oversized?null:response.body,bodyComplete:oversized?false:response.bodyComplete??typeof response.body==='string',receivedBodyBytes:Math.max(bytes??0,response.receivedBodyBytes??0),bodyBytes:oversized?null:response.bodyBytes??bytes,rawBodyBase64:oversized?null:response.rawBodyBase64??null,...(oversized?{bodyUnavailableReason:'Returned entity exceeded8MiB bound'}:{})}
   return receipt.response
  }
  const load=settings.fetchPage??nativeTransport({timeoutMs:settings.readTimeoutMs,onReceipt:retain})
  return control.read(async signal=>{const value=await load(url,{...init,method:'GET',redirect:'manual',credentials:'omit',signal});const snapshot=retain(value);if(typeof value?.body==='string'&&Buffer.byteLength(value.body)>MAX_BYTES)throw failure('Snowplow response exceeds8MiB','SNOWPLOW_BODY_LIMIT');return snapshot??value})
 }
 try{
  if(settings.maxJobs===0||settings.maxPages===0){audit={source:'snowplow',status:'skipped',nativeInventoryCount:null,receipts,attempts,gaps:[],sourceScopeComplete:false};result=attachInventoryEvidence([],inventory(receipts,false,'caller-zero-cap-no-source-observation'))}
  else result=await createReviewedSnowplowScraper({...settings,fetchPage,signal:control.signal,onAudit:value=>{audit=value},now:()=>{control.check();const value=(settings.now??(()=>new Date().toISOString()))();control.check();return value}},{onFeed:value=>{feedFacts=value},onHome:()=>{homeQualified=true}}).run()
 }catch(error){firstError=error;failureObserved=true}
 try{
  settings.signal?.throwIfAborted()
  audit??={source:'snowplow',status:'partial',nativeInventoryCount:feedFacts?.rows.length??null,rawOpeningFeed:feedFacts?.payload??null,countryProofs:feedFacts?.rows??[],gaps:failureObserved?[safeFailure(firstError)]:[],receipts,attempts,sourceScopeComplete:false}
  Object.assign(audit,{attempts,retainedNativeResponses:receipts,cleanupAllowed:false,sourceScopeComplete:false,requestCount:control.requests})
  if(settings.onAudit)try{await bounded(()=>settings.onAudit(structuredClone(audit)),{signal:control.signal,timeoutMs:settings.auditTimeoutMs,code:'SNOWPLOW_AUDIT_TIMEOUT'});control.check()}catch(error){settings.signal?.throwIfAborted();if(failureObserved)audit.auditSinkFailure=safeFailure(error);else{firstError=error;failureObserved=true}}
  if(failureObserved){
   const originalCode=errorValue(firstError,'code'),code=typeof originalCode==='string'&&originalCode.startsWith('SNOWPLOW_')&&originalCode!=='SNOWPLOW_NATIVE_UNREVIEWED'?originalCode:'SNOWPLOW_NATIVE_INCOMPLETE'
   const error=Object.assign(Error(safeFailure(firstError).message??'Snowplow native collection incomplete'),{name:'SnowplowNativeIncompleteError',code,cause:firstError,source:'snowplow',abortRetries:true,sourceScopeComplete:false,sourceListingComplete:false,retainedNativeResponses:receipts,nativeEvidence:audit,inventoryEvidence:inventory(receipts,homeQualified,'first-primary-failure;company-scope-unresolved')})
   for(const key of ['status','failureKind','softFailure','upstreamOutage']){const value=errorValue(firstError,key);if(value!==undefined)error[key]=value}
   const returnedStatus=receipts.at(-1)?.response.status
   if(error.status===undefined&&Number.isInteger(returnedStatus)&&returnedStatus!==200)error.status=returnedStatus
   if([401,403,429,451].includes(error.status))Object.assign(error,{failureKind:'blocked_or_access_denied',softFailure:true,upstreamOutage:true})
   throw error
  }
  return attachInventoryEvidence(result,{...readInventoryEvidence(result),pagesFetched:receipts.length})
 }finally{control.close()}
}})

// Data-only inspection of already-retained originals. No transport/callback
// input and no registered option can activate this diagnostic continuation.
export async function diagnoseArchivedSnowplow(packets){
 if(types.isProxy(packets)||!Array.isArray(packets)||packets.length>2048)throw Error('Bounded retained packet array required')
 let total=0
 const copies=[]
 for(let index=0;index<packets.length;index++){
  const entry=Object.getOwnPropertyDescriptor(packets,String(index))
  if(!entry||!Object.hasOwn(entry,'value'))throw Error('Data-only diagnostic rejects accessor input')
  const packet=entry.value
  if(!packet||typeof packet!=='object'||types.isProxy(packet))throw Error('Invalid retained data-only packet')
  const descriptors=Object.getOwnPropertyDescriptors(packet)
  if(Object.values(descriptors).some(d=>!Object.hasOwn(d,'value')||typeof d.value==='function'))throw Error('Data-only diagnostic rejects accessor or callable input')
  const data=Object.fromEntries(['requestUrl','status','url','contentType','body'].map(key=>[key,descriptors[key]?.value]))
  if(typeof data.requestUrl!=='string'||typeof data.url!=='string'||typeof data.contentType!=='string'||!Number.isSafeInteger(data.status)||data.status<100||data.status>599||typeof data.body!=='string'||Buffer.byteLength(data.body)>MAX_BYTES)throw Error('Invalid retained data-only packet')
  total+=Buffer.byteLength(data.body);if(total>256*1024*1024)throw Error('Retained diagnostic byte bound')
  copies.push(data)
 }
 const grouped=new Map(),cursors=new Map(),calls=[],requests=[]
 for(const p of copies){const values=grouped.get(p.requestUrl)??[];values.push(p);grouped.set(p.requestUrl,values)}
 let audit
 const jobs=await createReviewedSnowplowScraper({fetchPage:async(url,init)=>{calls.push(url);requests.push({url,init:{method:init.method,headers:{...init.headers}}});const values=grouped.get(url);if(!values)throw Error('No retained original for '+url);const at=cursors.get(url)??0;cursors.set(url,at+1);return{...values[Math.min(at,values.length-1)]}},onAudit:value=>{audit=value}},{diagnostic:true}).run()
 const modelEvidence={...readInventoryEvidence(jobs),firstParty:false,verifiedAt:null,diagnosticOnly:true}
 const evidence=inventory(audit?.receipts??[],false,'archived-data-only-diagnostic;no-live-source-or-zero-proof')
 attachInventoryEvidence(jobs,evidence)
 for(const job of jobs)Object.assign(job,{sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,diagnosticOnly:true})
 if(audit)Object.assign(audit,{diagnosticOnly:true,sourceScopeComplete:false,cleanupAllowed:false})
 return{diagnosticOnly:true,publicRequests:0,calls,requests,audit,evidence,modelEvidence,modelJobs:jobs,observedNativeRows:audit?.nativeInventoryCount??null}
}
