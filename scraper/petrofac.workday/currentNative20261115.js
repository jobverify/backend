import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { types } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import { boundedDeclaredPublicRead } from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const profile = JSON.parse(fs.readFileSync(new URL('./currentProfile20261115.json', import.meta.url), 'utf8'))
const sha = value => createHash('sha256').update(value).digest('hex')
const problem = message => Object.assign(Error('Petrofac current native: ' + message), { softFailure: true, abortRetries: true, failureKind: 'coverage_gap', sourceScopeComplete: false, lifecycleCleanupAllowed: false })
const need = (condition, message) => { if (!condition) throw problem(message) }
const one = (rows, label) => { need(rows.length === 1, 'missing or ambiguous ' + label); return rows[0] }
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const byteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), 'byteLength').get
const securityKeys = ['content-security-policy', 'content-security-policy-report-only', 'content-disposition', 'refresh', 'location', 'content-location', 'link', 'x-content-type-options', 'x-frame-options']

// These are fresh anonymous response bindings, never replayed as credentials.
// Their positions, field names, counts and all other original bytes stay pinned.
export function normalizeCurrentPetrofacDocument(html, url) {
  if (new URL(url).origin !== new URL(profile.board).origin) return html
  const sessions = [...html.matchAll(/"session_id":"([^"]*)"/g)].map(m => m[1])
  need(sessions.length === 2 && sessions[0] === sessions[1] && /^[0-9a-f]{64}\.petrofac\.lhrc1a-app-00[12]\.a\.lhrc\.oraclevcn\.com$/.test(sessions[0]), 'unreviewed anonymous guest session binding')
  const seeds = [...html.matchAll(/<input type = "hidden" name="tsstoken" id = "tsstoken" value ="([^"]*)"\/>/g)]
  need(seeds.length === 1 && /^[A-Za-z0-9+/]{43}=$/.test(seeds[0][1]), 'unreviewed exact hidden public CSRF field')
  const seed = Buffer.from(seeds[0][1], 'base64')
  need(seed.length === 32 && seed.toString('base64') === seeds[0][1], 'noncanonical hidden public CSRF bytes')
  return html.replace(/("session_id":")[0-9a-f]{64}\.petrofac\.lhrc1a-app-00[12]\.a\.lhrc\.oraclevcn\.com(")/g, '$1CURRENT_PUBLIC_GUEST_SESSION$2')
    .replace(/(<input type = "hidden" name="tsstoken" id = "tsstoken" value =")[A-Za-z0-9+/]{43}=("\/>)/g, '$1CURRENT_PUBLIC_CSRF_SEED$2')
}

function cards(html) {
  const doc = readNativeDocument(html)
  const rows = doc.nodes(n => doc.hasClass(n, 'job_list_row')).map(node => {
    const link = one(doc.nodes(n => n.tag === 'a' && doc.hasClass(n, 'job_link'), node), 'current featured native role link')
    need(new URL(link.attrs.href).origin === new URL(profile.board).origin, 'featured native employer origin changed')
    return { title: doc.text(link), url: link.attrs.href, nativeCardText: doc.text(node), originalNativeCard: structuredClone(node) }
  })
  need(rows.length === 4 && equal(rows, profile.cards), 'current full featured membership or criteria changed; no zero qualification')
  return rows
}

function role(html, model, card) {
  const doc = readNativeDocument(html), canonical = one(doc.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical'), 'own canonical role')
  const title = doc.text(one(doc.nodes(n => n.tag === 'h1'), 'full own native title'))
  const location = doc.text(one(doc.nodes(n => doc.hasClass(n, 'primary_location')), 'own original country')).replace(/^🔍\s*/, '')
  const criteria = doc.text(one(doc.nodes(n => doc.hasClass(n, 'job_description')), 'complete authored native criteria'))
  const id = one(doc.nodes(n => n.tag === 'input' && n.attrs.name === 'Job.id'), 'native role identifier').attrs.value
  const requisition = one(doc.nodes(n => n.tag === 'input' && n.attrs.name === 'Job.taleo_job_number'), 'native requisition').attrs.value
  const mode = one(doc.nodes(n => n.tag === 'input' && n.attrs.name === 'Job.special.apply_view'), 'current native application mode').attrs.value
  const button = one(doc.nodes(n => n.tag === 'button' && n.attrs.id === 'apply_btn'), 'own role Apply button')
  const metadata = doc.nodes(n => n.tag === 'dl').map(n => ({ attrs: n.attrs, text: doc.text(n) }))
  const program = one(doc.nodes(n => n.tag === 'script' && !n.attrs.src && /TVAPP\.property\s*=/.test(n.raw || '')), 'current employer/native role program').raw
  need(canonical.attrs.href === model.url && title === model.title && card.title === title && card.url === model.url, 'original canonical/card/title binding changed')
  need(location === model.location && location === 'Chennai, India' && card.nativeCardText.includes(location), 'same native card and role must explicitly publish India')
  need(id === model.nativeID && requisition === model.requisition && metadata.some(m => m.text.includes(requisition) && /Requisition #/.test(m.text)), 'native original identifier and published requisition disagree')
  need(program.includes(model.nativeRoleProgramFragment) && /client_name:\s*"Petrofac"/.test(program), 'native own employer, country or application role binding changed')
  need(mode === 'otac_17.4' && doc.text(button) === 'Apply for Job' && !Object.hasOwn(button.attrs, 'disabled') && button.attrs['aria-disabled'] !== 'true', 'native own Apply unavailable')
  need(criteria.length === model.criteriaCharacters && sha(criteria) === model.criteriaSHA256 && equal(metadata, model.nativeMetadata), 'full authored native criteria or hiring metadata changed')
  const description = title + '\n' + location + '\n' + metadata.map(m => m.text).join('\n') + '\n\n' + criteria
  return { title, location, url: model.url, id, requisition, criteria, description, metadata,
    originalOwnRoleHTML: html,
    originalOwnRoleMain: structuredClone(one(doc.nodes(n => n.attrs.id === 'job_details_content'), 'full native role context')),
    application: { url: model.url, label: doc.text(button), buttonAttributes: structuredClone(button.attrs), nativeRoleIdentifier: id, nativeApplicationMode: mode,
      nativeHandlerURL: new URL('/job_details.js?v=apptss.2026.PRD.1.5.10', profile.board).href, kind: 'current-own-role-button-and-declared-native-handler',
      actionMethod: 'POST', actionURL: new URL('/ajax/action/taleo/integration/tee/jobapplynoapplymodal', profile.board).href,
      actionRequested: false, externalDestination: null, submissionPerformed: false, renderedApplicationQualified: false } }
}

export async function runCurrentPetrofac(options = {}) {
  options.signal?.throwIfAborted()
  need(!(options.fetchText || options.fetchPage || options.fetchJson) || options.fetchImpl, 'original public HTTP metadata required')
  const duration = options.sourceDeadlineMs ?? 85000, interval = options.requestIntervalMs ?? 500
  need(Number.isSafeInteger(duration) && duration > 0 && duration <= 85000, 'invalid source deadline')
  need(Number.isSafeInteger(interval) && interval >= 0 && interval <= 60000 && (interval >= 500 || options.fetchImpl), 'invalid native pacing')
  const observedAt = typeof options.now === 'function' ? options.now() : new Date().toISOString()
  need(Number.isFinite(Date.parse(observedAt)), 'invalid native observation clock')
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(problem('source deadline exceeded')), duration)
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal
  const receipts = [], last = new Map(), gates = new Map()
  let allowed = new Set([profile.configuredHome]), reads = 0, total = 0
  const pace = async origin => {
    const previous = gates.get(origin) || Promise.resolve()
    let release
    const next = new Promise(resolve => { release = resolve }); gates.set(origin, next)
    try {
      await previous; signal.throwIfAborted()
      const wait = Math.max(0, interval - (performance.now() - (last.get(origin) ?? -Infinity)))
      if (wait) await delay(wait, undefined, { signal })
      signal.throwIfAborted(); last.set(origin, performance.now())
    } finally { release() }
  }
  const read = async url => {
    try {
      signal.throwIfAborted(); need(allowed.has(url) && Object.hasOwn(profile.originalPackets, url) && ++reads <= 120, 'unbound native URL or request cap')
      await pace(new URL(url).origin)
      const p = await boundedDeclaredPublicRead(url, { signal, timeoutMs: 15000, overflowError: problem('native streaming byte bound'), fetchImpl: async (value, init) => {
        const response = await (options.fetchImpl || globalThis.fetch)(value, { ...init, cache: 'no-store', credentials: 'omit',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify careers inventory check)', Accept: 'text/html,application/javascript,text/css,*/*;q=0.5' } })
        let size = 0
        return { status: response.status, url: response.url, headers: response.headers, body: response.body === null ? null : {
          cancel: reason => response.body.cancel(reason), getReader() { const reader = response.body.getReader(); return {
            async read() { const part = await reader.read(); if (!part.done) { need(types.isUint8Array(part.value), 'native source stream must contain original bytes'); const length = byteLength.call(part.value); need(length <= 4000000 - size && length <= 16000000 - total, 'native streaming byte bound'); size += length; total += length } return part },
            cancel: reason => reader.cancel(reason), releaseLock: () => reader.releaseLock(),
          } },
        } }
      } })
      const bytes = Buffer.from(p.bodyBase64, 'base64'), expected = profile.originalPackets[url]
      receipts.push({ requestedURL: url, ...p, bytes: bytes.length, sha256: sha(bytes) })
      need(p.status === expected.status && p.url === expected.finalURL, 'native public HTTP status or final URL changed')
      need((p.headers['content-type'] || '').trim().toLowerCase() === expected.mime, 'native original MIME or charset changed')
      need(equal(Object.fromEntries(securityKeys.map(k => [k, p.headers[k] ?? null])), expected.securityHeaders), 'native effective HTTP headers changed')
      let html = null
      if (profile.documents.includes(url)) {
        try { html = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) } catch { throw problem('original native UTF8 bytes unavailable') }
        need(bytes.length === expected.bytes && sha(normalizeCurrentPetrofacDocument(html, url)) === expected.normalizedDocumentSHA256, 'whole native publisher, criteria, controls or declarations changed')
      } else need((profile.reviewedWholeProgramVariants[url] || [expected]).some(v => bytes.length === v.bytes && sha(bytes) === v.sha256), 'whole current native program or stylesheet changed ' + url)
      signal.throwIfAborted(); return html
    } catch (error) { if (!signal.aborted) controller.abort(error); throw error }
  }
  const phase = async () => {
    allowed = new Set([profile.configuredHome])
    const home = await read(profile.configuredHome), hd = readNativeDocument(home)
    need(hd.nodes(n => n.tag === 'meta' && n.attrs.property === 'og:site_name' && n.attrs.content === 'Petrofac').length === 1, 'configured corporate employer identity missing')
    need(hd.nodes(n => n.tag === 'a' && n.attrs.href && [profile.careers, profile.careers + '/'].includes(new URL(n.attrs.href, profile.configuredHome).href)).length > 0, 'configured own careers handoff missing')
    allowed.add(profile.careers); const career = await read(profile.careers), cd = readNativeDocument(career)
    need(cd.nodes(n => n.tag === 'a' && n.attrs.href === profile.board).length > 0, 'current corporate exact native recruitment handoff missing')
    allowed.add(profile.board); const boardHTML = await read(profile.board), rows = cards(boardHTML), selected = []
    for (const model of profile.roleModels) {
      const card = one(rows.filter(c => c.url === model.url), 'current declared own role')
      allowed.add(card.url); selected.push(role(await read(card.url), model, card))
    }
    for (const url of profile.assetURLs) allowed.add(url)
    let cursor = 0
    const workers = Array.from({ length: 2 }, async () => {
      while (cursor < profile.assetURLs.length) { signal.throwIfAborted(); const index = cursor++; await read(profile.assetURLs[index]) }
    })
    const settled = await Promise.allSettled(workers)
    const failed = settled.find(r => r.status === 'rejected'); if (failed) throw failed.reason
    return { rows, selected, originalOwnBoardHTML: boardHTML }
  }
  try {
    const opening = await phase(), closing = await phase()
    const reconciled = state => ({ rows: state.rows, selected: state.selected.map(r => ({ ...r, originalOwnRoleHTML: normalizeCurrentPetrofacDocument(r.originalOwnRoleHTML, r.url) })), originalOwnBoardHTML: normalizeCurrentPetrofacDocument(state.originalOwnBoardHTML, profile.board) })
    need(equal(reconciled(opening), reconciled(closing)), 'full closing native employer, country, criteria, application or membership changed')
    signal.throwIfAborted()
    const jobs = opening.selected.map(r => ({ source: profile.source, company: profile.company, companyDomain: 'petrofac.com', companyCareerPage: profile.careers,
      title: r.title, jobId: r.id, sourceNativeIdentifier: r.id, requisitionId: r.requisition, sourceCanonicalRoleURL: r.url, sourceUrl: r.url, link: r.url, applyUrl: r.application.url,
      country: 'India', city: 'Chennai', location: r.location, employmentType: null, remoteStatus: null, jobDescription: r.description, sourceDescription: r.description,
      postingDate: null, firstEverPostedAt: null, closingDate: null, sourceNativeDateLabels: r.metadata.filter(m => /Post Date/.test(m.text)), sourceDateSemanticsUnresolved: true,
      nativeSourceRecord: { originalOwnRoleHTML: r.originalOwnRoleHTML, originalOwnRoleMain: r.originalOwnRoleMain, originalNativeFullCriteria: r.criteria, originalNativeMetadata: r.metadata, originalPublishedApplication: r.application },
      sourceNativeEmployerBinding: { configuredCorporateURL: profile.configuredHome, currentCareers: profile.careers, nativePortal: profile.board, exactNativeClientName: 'Petrofac', companyScopeQualified: false },
      sourceNativeCountryProof: { nativeCardText: one(opening.rows.filter(c => c.url === r.url), 'original role card').nativeCardText, ownRoleLocation: r.location, originalTypedCountryPublished: 'India', cityDictionaryUsed: false },
      sourceDetailComplete: true, sourceNativeClosingReconciled: true, sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false, sourceRenderedApplicationQualified: false, scrapedAt: observedAt }))
    attachSourceObservationEvidence(jobs, { source: profile.source, recordKind: 'vacancy-rows', observedRecordCount: opening.rows.length, observedVacancyCount: opening.rows.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
    Object.defineProperty(jobs, 'nativeCollectionEvidence', { configurable: true, value: { source: profile.source, originalResponses: receipts, nativeRows: opening.rows, closingNativeRows: closing.rows,
      originalOpeningBoardHTML: opening.originalOwnBoardHTML, originalClosingBoardHTML: closing.originalOwnBoardHTML,
      holds: opening.rows.filter(c => !profile.roleModels.some(r => r.url === c.url)).map(c => ({ ...c, reason: 'own-detail-not-qualified-within-current-selected-role-bound' })),
      currentFullClosingReconciled: true, sourceScopeComplete: false, lifecycleCleanupAllowed: false, companyGlobalTotal: null, companyIndiaTotal: null, applicationRequested: false, renderedApplicationQualified: false } })
    return attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: profile.board, firstParty: true, listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched: reads,
      reportedTotal: null, indiaFacetCount: null, verifiedAt: observedAt, reason: 'current-own-full-native-role-criteria+explicit-card-and-role-India+native-identifiers+full-document/program/style-closing-reconciled;partial-featured-observations;company-inventory-zero-and-application-operation-unqualified' })
  } catch (error) {
    if (!controller.signal.aborted) controller.abort(error)
    if (options.signal?.aborted) throw options.signal.reason
    if (error && typeof error === 'object' && Object.isExtensible(error)) try { Object.assign(error, { softFailure: true, abortRetries: true, failureKind: error.failureKind || 'coverage_gap', sourceScopeComplete: false, lifecycleCleanupAllowed: false, sourceAudit: { source: profile.source, originalResponses: receipts, sourceScopeComplete: false, lifecycleCleanupAllowed: false } }) } catch { /* Preserve the original native error. */ }
    throw error
  } finally { clearTimeout(timer) }
}
