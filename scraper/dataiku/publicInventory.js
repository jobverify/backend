import { createHash } from 'node:crypto'
import { runCurrentGreenhouseSource, inspectNativeRecordShape, readNativeCriteria } from './currentNative.js'
import config from './currentConfig.json' with { type: 'json' }
import { captureCurrentPublicScope } from './publicScope.js'
import { reconcileOfficeScope } from './officeScope.js'
import { createDataikuPublicRead, HOME, JOBS, OFFICES } from './publicRead.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { createPublishingGapAtsScraper } from '../../scraper-support/utils/publishingGapAts.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { rawElementNodes } from '../biofourmis/scriptExecution.js'

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value
const fingerprint = value => hash(stable(value))
const same = (a, b) => fingerprint(a) === fingerprint(b)
const recoverableScopeReasons = new Set(['unreviewed-active-corporate-hiring-scope', 'corporate-hiring-scope-changed',
  'public-ats-runtime-incomplete:greenhouse-public-posting-api-incomplete:native-location-scope-unresolved'])
const softError = message => Object.assign(new Error('[dataiku] ' + message), {
  softFailure: true, abortRetries: true, failureKind: 'source_identity_unverified',
})
const checkBinding = page => {
  const raw = rawElementNodes(page.text)
  const document = readVisibleNativeDocument(page.text, { strict: true })
  const visible = document.nodes(node => node.tag === 'a' && node.attrs.href === 'https://job-boards.greenhouse.io/dataiku'
    && document.text(node).trim())
  if (page.status !== 200 || page.finalUrl !== HOME || !document.nodes(node => node.tag === 'title' && /Dataiku/.test(node.raw || '')).length
    || !visible.length || !visible.every(node => raw.some(candidate => candidate.tag === 'a' && same(candidate.attrs, node.attrs)))) {
    throw softError('Current visible employer handoff not established')
  }
}
const json = page => JSON.parse(page.text)

export async function run(options = {}) {
  const { signal, onAudit, now } = options
  signal?.throwIfAborted()
  if (options.maxJobs != null || options.maxPages != null) throw softError('Inventory caps unsupported')
  if (options.fetchJson || options.fetchText || options.fetchPage) throw softError('Observed HTTP fetchImpl required')
  const io = createDataikuPublicRead(options), reasons = [], originalNativeObservations = []
  let openingHome, openingOffices, closingOffices, baseAudit, baseJobs, nativeError, openingPayload, finalPayload
  try {
    openingHome = await io.read(HOME)
    checkBinding(openingHome)
    try { openingOffices = json(await io.read(OFFICES)) }
    catch (error) { signal?.throwIfAborted(); reasons.push('opening-office-protocol-unavailable') }
    let firstHome = true
    try {
      baseJobs = await runCurrentGreenhouseSource(config, { ...options, signal: io.sourceSignal,
        fetchImpl: async (url, init) => {
          if (url === HOME && firstHome) { firstHome = false; return io.asResponse(openingHome) }
          return io.asResponse(await io.read(url, init))
        }, onAudit: audit => { baseAudit = audit },
      })
    } catch (error) { signal?.throwIfAborted(); nativeError = error; reasons.push('native-full-detail-cohort-incomplete') }
    await io.settle()
    const openingPage = io.pages.get(JOBS)?.find(page => page.status === 200 && page.finalUrl === JOBS)
    if (openingPage) { try { openingPayload = json(openingPage) } catch {} }
    if (!openingPayload) throw nativeError || softError('Current native opening inventory unavailable')
    const openingCountryProof = reconcileOfficeScope(openingPayload, openingOffices)
    if (!openingCountryProof.complete) reasons.push(...openingCountryProof.reasons)
    const openingScope = captureCurrentPublicScope(openingHome.text)
    if (!openingScope.qualified) reasons.push('current-public-employer-scope-unreviewed')
    if (baseAudit) {
      originalNativeObservations.push(baseAudit)
      reasons.push(...baseAudit.scopeReasons.filter(reason => !recoverableScopeReasons.has(reason)))
    }
    // Preserve a fully paired India detail even if later native closing fails.
    if (!baseJobs) {
      const mapped = await createPublishingGapAtsScraper({ source: 'dataiku', companyName: 'Dataiku', atsPlatform: 'greenhouse',
        boardToken: 'dataiku', companyCareerPage: HOME, sourceScopeComplete: false }).run({
        signal, fetchJson: async () => openingPayload,
      })
      baseJobs = mapped.flatMap(job => {
        const row = openingPayload.jobs.find(record => String(record.id) === String(job.jobId))
        const detailPage = io.pages.get(`https://boards-api.greenhouse.io/v1/boards/dataiku/jobs/${row.id}?content=true`)
          ?.find(page => page.status === 200 && page.finalUrl === page.url)
        if (!detailPage) return []
        const detail = json(detailPage)
        if (!same(detail, row)) return []
        const criteria = readNativeCriteria(row.content), shapeReasons = inspectNativeRecordShape(row, config)
        return [{ ...job, company: row.company_name, sourceDescription: row.content, jobDescription: criteria.visible,
          sourceNativePayload: row, sourceNativeDetailPayload: detail,
          sourceDetailComplete: !criteria.reasons.length && !shapeReasons.length,
          ...((criteria.reasons.length || shapeReasons.length) ? { sourceDetailFailureKind: 'native-role-schema-or-criteria-unresolved' } : {}) }]
      })
      if (nativeError && !baseJobs.length) throw nativeError
    }
    const indiaIds = new Set(openingCountryProof.indiaRoleIds)
    const jobs = baseJobs.filter(job => indiaIds.has(String(job.jobId)))
    if (jobs.length !== indiaIds.size || jobs.some(job => job.sourceDetailComplete !== true)) reasons.push('selected-native-india-details-incomplete')
    let closingScope, closingCountryProof, verifiedAt = null
    try {
      closingOffices = json(await io.read(OFFICES))
      finalPayload = json(await io.read(JOBS))
      const finalHome = await io.read(HOME)
      checkBinding(finalHome)
      closingScope = captureCurrentPublicScope(finalHome.text)
      closingCountryProof = reconcileOfficeScope(finalPayload, closingOffices)
      if (!closingCountryProof.complete) reasons.push(...closingCountryProof.reasons)
      if (!same(openingOffices, closingOffices)) reasons.push('native-office-hierarchy-or-job-assignments-changed')
      if (!same(openingPayload, finalPayload)) reasons.push('post-office-native-inventory-changed')
      if (!closingScope.qualified || closingScope.fingerprint !== openingScope.fingerprint) reasons.push('closing-current-public-employer-scope-changed')
      const value = now ? now() : finalHome.completedAt, date = new Date(value)
      if (value == null || !Number.isFinite(+date) || +date <= 0) reasons.push('invalid-proof-clock')
      else verifiedAt = date.toISOString()
    } catch (error) { signal?.throwIfAborted(); reasons.push('post-office-closing-proof-unavailable') }
    if (io.receipts.some(receipt => !receipt.contentTypeQualified)) reasons.push('observed-native-content-type-unqualified')
    const complete = reasons.length === 0
    const unreviewedOfficeDetails = new Set([...openingCountryProof.unreviewedOfficeRoleIds,
      ...(closingCountryProof?.unreviewedOfficeRoleIds || [])])
    for (const job of jobs) {
      Object.assign(job, { sourceListingComplete: complete, sourceScopeComplete: complete, lifecycleCleanupAllowed: complete })
      if (unreviewedOfficeDetails.has(String(job.jobId))) Object.assign(job, { sourceDetailComplete: false,
        sourceDetailFailureKind: 'native-office-schema-or-criteria-unresolved',
        sourceDetailFailureReasons: [...(job.sourceDetailFailureReasons || []), 'unreviewed-native-office-role-criteria'] })
    }
    const lastPage = url => io.pages.get(url)?.at(-1)
    const lastPayload = (() => {
      const page = lastPage(JOBS)
      if (!page || page.status !== 200 || page.finalUrl !== JOBS) return null
      try { return json(page) } catch { return null }
    })()
    const fallbackAudit = baseAudit || { source: 'dataiku', openingPayload,
      closingPayload: lastPayload,
      openingRecords: openingPayload.jobs, closingRecords: lastPayload?.jobs || null,
      details: openingPayload.jobs.flatMap(row => {
        const page = lastPage(`https://boards-api.greenhouse.io/v1/boards/dataiku/jobs/${row.id}?content=true`)
        if (!page || page.status !== 200) return []
        try { return [json(page)] } catch { return [] }
      }), openingEmployerHtml: openingHome.text, closingEmployerHtml: lastPage(HOME)?.text || null,
      scopeReasons: ['native-full-detail-cohort-incomplete'],
    }
    const audit = { ...fallbackAudit, source: 'dataiku', originalNativeObservations,
      publicInventoryScope: { complete, reasons: [...new Set(reasons)], openingScope, closingScope,
        openingCountryProof, closingCountryProof, openingOffices, closingOffices, finalPayload,
        nativeError: nativeError ? { message: nativeError.message, failureKind: nativeError.failureKind } : null,
        transport: io.audit, wholeCompanyScope: null, privateApplicationActivation: null,
        verifiedAt: complete ? verifiedAt : null },
    }
    if (jobs.length) jobs[0].nativeCurrentInventoryAudit = audit
    await onAudit?.(structuredClone(audit))
    signal?.throwIfAborted()
    return attachInventoryEvidence(jobs, { status: complete ? openingPayload.jobs.length ? 'complete-inventory' : 'verified-empty' : 'coverage-gap',
      surface: JOBS, firstParty: true, listingComplete: complete, pagesFetched: io.receipts.length,
      reportedTotal: complete ? openingPayload.meta.total : null, indiaFacetCount: complete ? jobs.length : null,
      verifiedAt: complete ? verifiedAt : null,
      reason: complete ? 'dataiku-current-public-employer-model;all-native-details;office-country-tree-and-assignments;post-office-closing-reconciled'
        : `dataiku-current-public-inventory-incomplete:${[...new Set(reasons)].join(';')}` })
  } finally { await io.settle(); io.dispose() }
}
