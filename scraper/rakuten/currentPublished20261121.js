import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { currentReader } from './currentRead20261121.js'
import { qualifyCurrentClient } from './currentClient20261121.js'
import { need, same, mergeObservation } from './currentFacts20261121.js'
import { HOME, PORTAL, PORTAL_CURRENT, readCurrentOwn, readCurrentPortal, readCurrentConfiguration, readCurrentInventory, inspectCurrentRole } from './currentModel20261121.js'
export { qualifyCurrentClient, HOME, PORTAL, PORTAL_CURRENT, readCurrentOwn, readCurrentPortal, readCurrentConfiguration, readCurrentInventory, inspectCurrentRole }

async function publicForm(params, url) {
  const form = new FormData()
  for (const [key, value] of Object.entries(params)) form.append(key, typeof value === 'object' ? JSON.stringify(value) : value)
  const request = new Request(url, { method: 'POST', body: form })
  return { method: 'POST', body: Buffer.from(await request.arrayBuffer()).toString('utf8'), contentType: request.headers.get('content-type') }
}
const identity = job => job.sourceNativeObservedRole.binding
export async function runCurrentRakuten(options = {}) {
  options.signal?.throwIfAborted()
  need(options.maxJobs == null || options.maxJobs === 0, 'positive current maxJobs cannot prove full configured observation')
  need(options.maxPages == null || options.maxPages === 0, 'positive current maxPages cannot prove full configured observation')
  need(!options.fetchListingPage && !options.fetchJobDetail && !options.fetchText && !options.fetchJson && !options.fetchPage, 'current original Responses are required')
  need(options.onAudit == null || typeof options.onAudit === 'function', 'current audit callback malformed')
  const at = (typeof options.now === 'function' ? options.now() : options.now) ?? new Date().toISOString()
  need(typeof at === 'string' && Number.isFinite(Date.parse(at)), 'current observation clock malformed')
  const io = currentReader([HOME], [new URL(HOME).origin, new URL(PORTAL).origin, 'https://apic2.zwayam.com'], options)
  const audit = { source: 'rakuten', observedAt: at, held: [], originalResponses: [], companyIndiaTotal: null, companyGlobalTotal: null, companyInventoryComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false, nativeProgramsExecuted: false, applicationsSubmitted: false, backendApplicationActivationVerified: false }
  const jobs = []
  const read = async (url, kind = 'html', request = { method: 'GET' }, navigation = false) => { io.allow(url, request); return io.read(url, { kind, request, navigation }) }
  const finish = async () => {
    io.check(); Object.assign(audit, io.stats(), { originalResponses: structuredClone(io.receipts), currentIndiaPublicationPartials: jobs.length })
    if (options.onAudit) await io.callback(options.onAudit, structuredClone(audit))
    io.check()
    attachSourceObservationEvidence(jobs, { source: 'rakuten', recordKind: 'vacancy-rows', observedRecordCount: audit.opening?.nativeConfiguredReportedCount ?? 0, observedVacancyCount: audit.opening?.nativeConfiguredReportedCount ?? 0, sourceScopeComplete: false, companyIndiaTotal: null, companyGlobalTotal: null })
    Object.defineProperty(jobs, 'nativeCollectionEvidence', { value: audit, configurable: true })
    return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: HOME, firstParty: io.receipts.length > 0, listingComplete: false, reportedTotal: null, indiaFacetCount: null, pagesFetched: io.receipts.length, verifiedAt: at, lifecycleCleanupAllowed: false, reason: 'current-own-declared-native-public-status1-India-publication-partials;legal-formal-requisition-company-facets-UI-backend-cleanup-held' })
  }
  const phase = async label => {
    const own = readCurrentOwn((await read(HOME)).text, { observedAt: at })
    const redirect = await read(own.portalURL, 'html', undefined, true)
    need(redirect.status === 301 && new URL(redirect.headers.location, PORTAL).href === PORTAL_CURRENT, 'current own-declared portal did not close its actual native redirect')
    const portal = readCurrentPortal((await read(PORTAL_CURRENT)).text, { observedAt: at })
    const client = qualifyCurrentClient((await read(portal.clientURL, 'program')).text)
    const company = readCurrentConfiguration((await read(client.configurationURL, 'json')).text, { observedAt: at })
    const params = structuredClone(client.searchDefaults); params.domain = client.domain; params.companyId = client.encodedCompanyId
    const inventory = readCurrentInventory((await read(client.listURL, 'json', await publicForm(params, client.listURL))).text, { observedAt: at, client })
    audit.held.push(...inventory.held.map(v => ({ ...v, phase: label })))
    const details = []
    for (const row of inventory.rows) {
      const request = { method: 'POST', contentType: 'application/json', body: JSON.stringify({ jobUrl: row.jobUrl, externalSource: client.defaultSource, campusUrl: 'empty', companyId: client.companyId, jobId: Number(row.id) }) }
      const response = await read(client.detailURL, 'json', request)
      try { details.push(inspectCurrentRole(response.text, row, { observedAt: at, client })) } catch (error) { audit.held.push({ id: row.id, phase: label, reason: error.message, originalListingRecord: row.originalRecord, originalDetailText: response.text }) }
    }
    return { label, own, portal, client, company, nativeConfiguredReportedCount: inventory.nativeConfiguredReportedCount, originalQueryCriteria: inventory.originalQueryCriteria, rows: inventory.rows, details }
  }
  try {
    if (options.maxJobs === 0 || options.maxPages === 0) { audit.callerZeroCap = true; return await finish() }
    const opening = await phase('opening'), closing = await phase('closing')
    audit.opening = opening; audit.closing = closing
    for (const job of opening.details) {
      const matches = closing.details.filter(v => v.jobId === job.jobId)
      if (matches.length !== 1 || !same(identity(job), identity(matches[0]))) { audit.held.push({ id: job.jobId, reason: 'Opening/closing exact native publication identity/workplace/application did not reconcile', originalOpening: job, originalClosing: matches }); continue }
      const current = mergeObservation(job, matches[0], 'closing')
      current.sourceNativeListingVersions = [{ phase: 'opening', record: job.sourceNativeRecord }, { phase: 'closing', record: matches[0].sourceNativeRecord }]
      current.sourceMissingCriteria = [{ kind: 'legal-employer-and-formal-requisition', reason: 'Exact display/account and labelled native ID/reference are public publication proof, not legal employer or formal requisition.' }, { kind: 'company-UI-and-application-backend', reason: 'Current selected careersite only; rendering, all application controls/backend and whole-company totals/cleanup remain unproven.' }]
      jobs.push(current)
    }
    return await finish()
  } finally { io.close() }
}
