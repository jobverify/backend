import { createHash } from 'node:crypto'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { currentWorkdayBoardReceipt, workdayInventoryIdentity } from '../../scraper-support/myworkday/countryInventoryProof.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'

const CAREERS = 'https://www.aptos.com/careers'
const BOARD = 'https://aptos.wd108.myworkdayjobs.com/Aptos'
const API = 'https://aptos.wd108.myworkdayjobs.com/wday/cxs/aptos/Aptos/jobs'
const INDIA = 'c4f78be1a8f14da0ab49ce1162348a5e'
const USA = 'bc33aa3152ec42d4995f4791a106ed09'
const offices = new Map([['IN Bangalore Office', 'IN'], ['US Atlanta Office', 'US'], ['US Remote', 'US']])
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const requireProof = (value, reason) => { if (!value) throw new Error(reason) }
const fields = (object, allowed) => object && typeof object === 'object' && !Array.isArray(object)
  && Object.keys(object).every(key => allowed.includes(key))
const listingFields = ['title', 'externalPath', 'locationsText', 'postedOn', 'bulletFields']
const detailFields = ['id', 'title', 'jobDescription', 'location', 'postedOn', 'startDate', 'endDate', 'timeType',
  'jobReqId', 'jobPostingId', 'jobPostingSiteId', 'country', 'videoInfo', 'logoImage', 'canApply', 'posted',
  'includeResumeParsing', 'jobRequisitionLocation', 'remoteType', 'externalUrl', 'questionnaireId']
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value

const country = value => {
  requireProof(fields(value, ['descriptor', 'id', 'alpha2Code']), 'unreviewed-native-country')
  if (value.id === INDIA && value.descriptor === 'India' && (value.alpha2Code == null || value.alpha2Code === 'IN')) return 'IN'
  if (value.id === USA && value.descriptor === 'United States of America' && (value.alpha2Code == null || value.alpha2Code === 'US')) return 'US'
  throw new Error('unreviewed-or-conflicting-native-country')
}
const rowIdentity = row => {
  requireProof(fields(row, listingFields) && typeof row.title === 'string' && row.title.trim()
    && typeof row.externalPath === 'string' && /^\/job\/[^/?#]+\/[^/?#]+$/.test(row.externalPath)
    && typeof row.locationsText === 'string' && Array.isArray(row.bulletFields)
    && row.bulletFields.every(value => typeof value === 'string'), 'invalid-raw-listing')
  const ids = row.bulletFields.filter(value => /^JR\d+(?:-\d+)?$/.test(value))
  requireProof(ids.length === 1 && row.externalPath.endsWith('_' + ids[0]), 'native-requisition-identity-mismatch')
  return ids[0]
}
const validPage = (payload, offset, total = payload?.total) => {
  requireProof(fields(payload, ['total', 'jobPostings', 'facets', 'userAuthenticated'])
    && payload.userAuthenticated !== true && Number.isSafeInteger(total) && total >= 0 && total <= 10000
    && payload.total === total && Array.isArray(payload.jobPostings)
    && payload.jobPostings.length === Math.min(20, total - offset), 'native-pagination-not-reconciled')
}
const receipt = page => {
  const proof = currentWorkdayBoardReceipt({ officialCareersUrl: CAREERS, boardUrl: BOARD,
    response: { ok: page.status === 200, status: page.status, url: page.url,
      headers: new Headers({ 'content-type': page.contentType || '' }) }, html: page.html })
  const document = readVisibleNativeDocument(page.html, { strict: true })
  const informationalSearch = 'https://www.linkedin.com/jobs/search/?keywords=aptos%20retail'
  for (const node of document.nodes(node => node.tag === 'a' && node.attrs.href)) {
    const url = new URL(node.attrs.href, CAREERS), text = document.text(node)
    // The retained corporate social footer links an uncurated keyword search;
    // it is not another employer application board and cannot prove coverage.
    if (url.href === informationalSearch && !text.trim()) continue
    if (!/job|career|apply|recruit|talent|myworkday|workable|greenhouse|lever\.co|ashby|smartrecruiters/i.test(node.attrs.href + ' ' + text)) continue
    requireProof([BOARD, 'https://aptos.wd108.myworkdayjobs.com/en-US/Aptos', CAREERS,
      'https://www.aptos.com/recruitment-scams'].includes(url.href), 'unreviewed-corporate-hiring-route')
  }
  requireProof(!document.frames().length, 'unreviewed-corporate-hiring-frame')
  requireProof(document.nodes(node => node.tag === 'form').every(node => node.attrs.action === '/search'), 'unreviewed-corporate-form')
  requireProof(!document.nodes(node => node.tag !== 'a' && Object.entries(node.attrs).some(([key, value]) =>
    /job|career|apply|recruit/i.test(key) && /https?:|^\//i.test(value))).length, 'unreviewed-corporate-hiring-control')
  return { ...proof, scope: 'official-native-workday-board', informationalSearch }
}

export const readAptosNativeJson = async (url, body, { signal } = {}) => {
  signal?.throwIfAborted()
  const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000)
  const response = await fetch(url, { method: body ? 'POST' : 'GET', redirect: 'error', signal: deadline,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' }, ...(body ? { body } : {}) })
  const text = await response.text()
  requireProof(Buffer.byteLength(text) <= 3 * 1024 * 1024, 'native-response-exceeds-bound')
  deadline.throwIfAborted()
  return { status: response.status, url: response.url, contentType: response.headers.get('content-type'), payload: JSON.parse(text) }
}

// This producer is Aptos-only. The location facet discovers candidates; full
// native country/worksite models prove scope for every included/excluded role.
// Reviewed video/logo fields are presentation data and cannot prove scope.
// Their media access URLs rotate independently of actual role criteria. A
// nonempty recommendation set stays unreviewed until its roles are reconciled.
export async function qualifyAptosInventory({ jobs, initialPayload, filteredPayloads, careersPage, fetchPage,
  fetchNativeJson = readAptosNativeJson, maxPages = Infinity, now = () => new Date().toISOString(), signal }) {
  let pagesFetched = 0, firstParty = false
  const audit = { complete: false, reason: null, rawRoles: null, indiaRoles: null, foreignRoles: null }
  const finish = (result, complete, reason) => {
    Object.assign(audit, { complete, reason })
    Object.defineProperty(result, 'nativeCollectionEvidence', { configurable: true, value: audit })
    return attachInventoryEvidence(result, { status: complete ? 'complete-inventory' : 'discovery-only', surface: API,
      firstParty, listingComplete: complete, lifecycleCleanupAllowed: complete, pagesFetched,
      reportedTotal: audit.rawRoles, indiaFacetCount: audit.indiaRoles, verifiedAt: now(), reason })
  }
  try {
    signal?.throwIfAborted()
    requireProof(maxPages === Infinity || Number.isSafeInteger(maxPages) && maxPages > 0, 'native-page-limit-reached')
    validPage(initialPayload, 0)
    requireProof(filteredPayloads.length > 0 && jobs.length > 0, 'no-qualified-india-inventory')
    audit.openingCorporate = receipt(careersPage); firstParty = true
    const read = async (url, body) => {
      signal?.throwIfAborted()
      const packet = await fetchNativeJson(url, body, { signal })
      signal?.throwIfAborted()
      requireProof(packet?.status === 200 && packet.url === url && /^application\/json(?:\s*;|$)/i.test(packet.contentType || ''), 'native-http-metadata-not-reconciled')
      return packet.payload
    }
    const enumerate = async () => {
      const rows = [], ids = new Set(), paths = new Set(); let total
      for (let page = 0; ; page++) {
        requireProof(page < Math.min(maxPages, 500), 'native-page-limit-reached')
        const payload = await read(API, JSON.stringify({ appliedFacets: {}, limit: 20, offset: rows.length, searchText: '' }))
        validPage(payload, rows.length, total === undefined ? payload?.total : total)
        total ??= payload.total; pagesFetched++
        for (const row of payload.jobPostings) {
          const id = rowIdentity(row)
          requireProof(!ids.has(id) && !paths.has(row.externalPath), 'duplicate-native-role')
          ids.add(id); paths.add(row.externalPath); rows.push(row)
        }
        if (rows.length === total) break
      }
      return { rows, total }
    }
    const model = (payload, row) => {
      requireProof(fields(payload, ['jobPostingInfo', 'hiringOrganization', 'similarJobs', 'userAuthenticated'])
        && payload.userAuthenticated !== true && Array.isArray(payload.similarJobs) && payload.similarJobs.length === 0, 'unreviewed-detail-envelope-or-recommendations')
      const info = payload.jobPostingInfo, id = rowIdentity(row)
      requireProof(fields(info, detailFields) && info.title === row.title && info.jobReqId === id
        && /^[a-f0-9]{32}$/.test(info.id) && info.jobPostingSiteId === 'Aptos'
        && info.jobPostingId === row.externalPath.split('/').at(-1)
        && info.externalUrl === BOARD + row.externalPath && info.posted === true && info.canApply === true, 'native-role-identity-or-state-mismatch')
      const code = country(info.country)
      requireProof(info.remoteType == null || info.remoteType === 'Remote' && info.location === 'US Remote', 'unreviewed-native-remote-scope')
      requireProof(fields(info.jobRequisitionLocation, ['descriptor', 'country'])
        && country(info.jobRequisitionLocation.country) === code
        && info.location === row.locationsText && info.jobRequisitionLocation.descriptor === row.locationsText
        && offices.get(row.locationsText) === code, 'native-worksite-scope-not-reconciled')
      const employer = code === 'IN' ? 'Aptos India Private Limited' : 'Aptos LLC'
      requireProof(fields(payload.hiringOrganization, ['name', 'url']) && payload.hiringOrganization.name === employer
        && payload.hiringOrganization.url === '', 'native-employer-not-reconciled')
      requireProof(date(info.startDate) && (info.endDate == null || date(info.endDate)), 'native-role-dates-not-reconciled')
      requireProof(typeof info.jobDescription === 'string', 'native-description-missing')
      const document = readVisibleNativeDocument(info.jobDescription, { strict: true })
      const text = document.nodes(node => node.tag === 'root').map(node => document.text(node)).join(' ').trim()
      const intro = 'Unified Commerce revolution.', footer = 'We offer a competitive total rewards package'
      const start = text.indexOf(intro), end = text.indexOf(footer)
      const criteria = start >= 0 && end > start ? text.slice(start + intro.length, end).trim() : ''
      requireProof(criteria.length >= 200 && criteria.split(/\s+/).length >= 30, 'native-description-missing-or-truncated')
      if (code === 'IN') {
        const responsibilities = criteria.indexOf('Key Responsibilities')
        const qualification = /Skills:|Required Qualifications/.exec(criteria)
        requireProof(responsibilities === 0 && qualification && qualification.index > responsibilities
          && criteria.slice(qualification.index + qualification[0].length).trim().split(/\s+/).length >= 20,
        'native-role-responsibilities-or-qualifications-missing')
      }
      return { id, path: row.externalPath, code, employer, info: Object.fromEntries(detailFields
        .filter(key => !['videoInfo', 'logoImage', 'questionnaireId', 'includeResumeParsing', 'postedOn'].includes(key))
        .filter(key => info[key] !== undefined).map(key => [key, info[key]])), listing: row }
    }
    const hydrate = async census => {
      const models = [], uids = new Set()
      for (const row of census.rows) {
        const native = model(await read(API.replace(/\/jobs$/, '') + row.externalPath), row)
        requireProof(!uids.has(native.info.id), 'duplicate-native-posting-uid')
        uids.add(native.info.id); models.push(native)
      }
      return models.sort((a, b) => a.id.localeCompare(b.id))
    }
    const opening = await enumerate()
    requireProof(hash(initialPayload.jobPostings.map(workdayInventoryIdentity)) === hash(opening.rows.slice(0, 20).map(workdayInventoryIdentity))
      && initialPayload.total === opening.total, 'initial-native-inventory-changed')
    const models = await hydrate(opening), india = models.filter(row => row.code === 'IN')
    Object.assign(audit, { rawRoles: models.length, indiaRoles: india.length, foreignRoles: models.length - india.length })
    const filteredRows = [], filteredIds = new Set(); let filteredTotal
    for (const payload of filteredPayloads) {
      validPage(payload, filteredRows.length, filteredTotal === undefined ? payload?.total : filteredTotal)
      filteredTotal ??= payload.total
      for (const row of payload.jobPostings) {
        const id = rowIdentity(row); requireProof(!filteredIds.has(id), 'duplicate-filtered-native-role')
        filteredIds.add(id); filteredRows.push(row)
      }
    }
    const keys = rows => rows.map(workdayInventoryIdentity).sort()
    requireProof(filteredRows.length === filteredTotal && hash(keys(filteredRows)) === hash(keys(india.map(row => row.listing)))
      && jobs.length === india.length && new Set(jobs.map(job => job.requisitionId)).size === india.length
      && jobs.every(job => india.some(row => row.id === job.requisitionId && row.info.externalUrl === job.link)), 'india-filtered-inventory-not-reconciled')
    const closing = await enumerate(), closedModels = await hydrate(closing)
    requireProof(opening.total === closing.total && hash(models) === hash(closedModels), 'closing-native-inventory-or-criteria-changed')
    audit.closingCorporate = receipt(await fetchPage(CAREERS, { signal }))
    signal?.throwIfAborted()
    const qualified = jobs.map(job => {
      const native = models.find(row => row.id === job.requisitionId), info = native.info
      return { ...job, title: info.title, country: 'India', sourceUrl: info.externalUrl, nativeEmployer: native.employer,
        sourceDescription: info.jobDescription, jobDescription: info.jobDescription, postedAt: info.startDate,
        closingDate: info.endDate || null, sourceListingComplete: true, sourceScopeComplete: true,
        sourceDetailComplete: true, lifecycleCleanupAllowed: true,
        nativeBoardProvenance: [{ board: BOARD, site: info.jobPostingSiteId, nativePostingUid: info.id,
          country: info.country, worksite: info.jobRequisitionLocation, rawLocation: info.location }] }
    })
    audit.inventorySignature = hash(models)
    return finish(qualified, true, 'native-inventory-and-role-criteria-reconciled')
  } catch (error) {
    signal?.throwIfAborted()
    return finish(jobs, false, 'aptos-native-proof-unavailable:' + error.message)
  }
}
