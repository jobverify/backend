import fs from 'node:fs'
import { disposeResponseReader } from '../../scraper-support/shared/responseBodyDisposal.js'
import { createHash } from 'node:crypto'
import { types } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'
import { boundedDeclaredPublicRead } from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { parseBoundedProgram, parseRemoteLiteral } from '../../scraper-support/utils/remoteScriptData.js'
import { buildHttpError, isHttpAccessChallenge } from '../../scraper-support/utils/fetch.js'
import { classifyScraperError } from '../../scraper-support/utils/failureClassification.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const profile = JSON.parse(fs.readFileSync(new URL('./currentProfile20261115.json', import.meta.url), 'utf8'))
const criteriaModels = JSON.parse(fs.readFileSync(new URL('./reviewedCriteria20261121.json', import.meta.url), 'utf8')).models
const sha = value => createHash('sha256').update(value).digest('hex')
const problem = message => Object.assign(Error('Petrofac current native: ' + message), { softFailure: true, abortRetries: true, failureKind: 'coverage_gap', sourceScopeComplete: false, lifecycleCleanupAllowed: false })
const need = (condition, message) => { if (!condition) throw problem(message) }
const one = (rows, label) => { need(rows.length === 1, 'missing or ambiguous ' + label); return rows[0] }
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const byteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), 'byteLength').get
const settleTransport = async pending => {
  if (!pending) return
  let timer
  try { await Promise.race([pending.then(() => {}, () => {}), new Promise(resolve => { timer = setTimeout(resolve, 1000) })]) }
  finally { clearTimeout(timer) }
}
const securityKeys = ['content-security-policy', 'content-security-policy-report-only', 'content-disposition', 'refresh', 'location', 'content-location', 'link', 'x-content-type-options', 'x-frame-options']


export function petrofacSupplementalAuthority(doc) {
  const root = one(doc.nodes(n => n.tag === 'root'), 'native full document')
  const all = node => [node, ...node.children.filter(n => typeof n !== 'string').flatMap(all)]
  const properties = new Set(['jobLocation','addressCountry','hiringOrganization','qualifications','skills','educationRequirements','experienceRequirements','datePosted','validThrough','identifier','employmentType','baseSalary','applicantLocationRequirements'])
  return all(root).flatMap(node => {
    const attrs = node.attrs
    if (node.tag === 'script' && /^application\/ld\+json(?:\s*;[\s\S]*)?\s*$/i.test((attrs.type || '').trim()) && /JobPosting/.test(node.raw || '')) return [{ tag: node.tag, attrs, raw: node.raw }]
    if ((attrs.itemprop || '').split(/\s+/).some(p => properties.has(p)) || ['input','data'].includes(node.tag) && Object.hasOwn(attrs, 'required')) return [{ tag: node.tag, attrs, text: doc.text(node) }]
    if (/JobPosting/.test(attrs.itemtype || '')) return [{ tag: node.tag, attrs }]
    return []
  })
}

function nativeOwner(html) {
  const doc = readNativeDocument(html)
  const scripts = doc.nodes(n => n.tag === 'script' && !n.attrs.src && /TVAPP\.property\s*=/.test(n.raw || ''))
  const script = one(scripts, 'active own native publisher declaration')
  need(!script.inert && (!script.attrs.type || script.attrs.type === 'text/javascript'), 'inert native publisher declaration')
  let ast
  try { ast = parseBoundedProgram(script.raw) } catch { throw problem('unparseable native publisher programme') }
  const assignments = ast.body.filter(n => n.type === 'ExpressionStatement' && n.expression.type === 'AssignmentExpression' && n.expression.operator === '='
    && n.expression.left.type === 'MemberExpression' && !n.expression.left.computed && n.expression.left.object.name === 'TVAPP' && n.expression.left.property.name === 'property')
  const expression = one(assignments, 'top-level native publisher assignment').expression.right
  need(expression.type === 'ObjectExpression', 'native publisher must be a literal object')
  const fields = new Map()
  for (const p of expression.properties) {
    need(p.type === 'Property' && !p.computed && p.kind === 'init' && !p.method && !p.shorthand, 'unsupported native publisher field')
    const key = p.key.name ?? p.key.value
    need(typeof key === 'string' && !fields.has(key), 'duplicate native publisher field')
    fields.set(key, p.value)
  }
  const field = key => {
    const node = fields.get(key)
    need(node, 'missing native publisher ' + key)
    try { return parseRemoteLiteral(script.raw.slice(node.start, node.end)) } catch { throw problem('nonliteral native publisher ' + key) }
  }
  const result = Object.fromEntries(['client_name', 'client_base_domain', 'site_name', 'site_prefix', 'site_mode', 'site', 'client_domains', ...(fields.has('job') ? ['job'] : [])].map(key => [key, field(key)]))
  need(result.client_name === 'Petrofac' && result.client_base_domain === 'petrofac.referrals.selectminds.com'
    && result.site_name === 'https://petrofac.referrals.selectminds.com' && result.site_prefix === result.site_name && result.site_mode === '3'
    && equal(result.site, { id: '2', short_name: 'default2243' }) && result.client_domains === 'petrofac.com', 'exact native publisher/account/domain changed')
  return result
}
function cards(html) {
  nativeOwner(html)
  const doc = readNativeDocument(html)
  const rows = doc.nodes(n => doc.hasClass(n, 'job_list_row')).map(node => {
    const link = one(doc.nodes(n => n.tag === 'a' && doc.hasClass(n, 'job_link'), node), 'current featured native role link')
    const id = /^job_list_([0-9]+)$/.exec(node.attrs.id || '')?.[1]
    const url = new URL(link.attrs.href, profile.board)
    need(id && url.origin === new URL(profile.board).origin && !url.search && !url.hash && new RegExp('^/jobs/[a-z0-9-]+-' + id + '$').test(url.pathname), 'featured native role URL/DOM identifier disagree')
    const location = doc.text(one(doc.nodes(n => n.tag === 'a' && doc.hasClass(n, 'location'), node), 'native per-role location')).replace(/^\u{1f50d}\s*/u, '')
    const dateNode = one(doc.nodes(n => doc.hasClass(n, 'field_value') && doc.text(n) && doc.nodes(p => doc.hasClass(p, 'job_post_date'), node).some(p => doc.nodes(x => x === n, p).length), node), 'published card date')
    return { id, title: doc.text(link), url: url.href, location, publishedDateLabel: doc.text(dateNode), country: /,\s*India$/.test(location) ? 'India' : /,\s*United Arab Emirates$/.test(location) ? 'United Arab Emirates' : null,
      nativeCardText: doc.text(node), originalNativeCard: structuredClone(node) }
  })
  need(rows.length > 0 && rows.length <= 100 && new Set(rows.map(r => r.id)).size === rows.length && new Set(rows.map(r => r.url)).size === rows.length, 'missing/ambiguous current featured cohort; no zero qualification')
  return rows
}
function postedDate(metadata) {
  const values = metadata.filter(m => /Post Date/.test(m.text)).map(m => /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}), (\d{4})\b/.exec(m.text)).filter(Boolean)
  const m = one(values, 'explicit native Post Date'), months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const value = m[3] + '-' + String(months.indexOf(m[1]) + 1).padStart(2, '0') + '-' + m[2]
  need(Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value, 'invalid published native calendar date')
  return value
}

function role(html, model, card) {
  const owner = nativeOwner(html)
  const doc = readNativeDocument(html), canonical = one(doc.nodes(n => n.tag === 'link' && n.attrs.rel === 'canonical'), 'own canonical role')
  const title = doc.text(one(doc.nodes(n => n.tag === 'h1'), 'full own native title'))
  const location = doc.text(one(doc.nodes(n => doc.hasClass(n, 'primary_location')), 'own original country')).replace(/^🔍\s*/, '')
  need(sha(JSON.stringify(petrofacSupplementalAuthority(doc))) === criteriaModels[model.nativeID]?.supplementalAuthoritySHA256, 'new or changed supplemental native country/employer/criterion/application assertion')
  const criteriaNode = one(doc.nodes(n => doc.hasClass(n, 'job_description')), 'complete authored native criteria')
  const criteria = doc.text(criteriaNode)
  need(sha(JSON.stringify(criteriaNode)) === criteriaModels[model.nativeID]?.nativeCriteriaTreeSHA256, 'unreviewed complete rich/nontext criterion model')
  const id = one(doc.nodes(n => n.tag === 'input' && n.attrs.name === 'Job.id'), 'native role identifier').attrs.value
  const requisition = one(doc.nodes(n => n.tag === 'input' && n.attrs.name === 'Job.taleo_job_number'), 'native requisition').attrs.value
  const mode = one(doc.nodes(n => n.tag === 'input' && n.attrs.name === 'Job.special.apply_view'), 'current native application mode').attrs.value
  const button = one(doc.nodes(n => n.tag === 'button' && n.attrs.id === 'apply_btn'), 'own role Apply button')
  const metadata = doc.nodes(n => n.tag === 'dl').map(n => ({ attrs: n.attrs, text: doc.text(n) }))
  const program = one(doc.nodes(n => n.tag === 'script' && !n.attrs.src && /TVAPP\.property\s*=/.test(n.raw || '')), 'current employer/native role program').raw
  need(canonical.attrs.href === model.url && title === model.title && card.title === title && card.url === model.url, 'original canonical/card/title binding changed')
  need(location === model.location && location === 'Chennai, India' && card.location === location && card.country === 'India', 'same native card and role must explicitly publish India')
  need(id === model.nativeID && requisition === model.requisition && metadata.some(m => m.text.includes(requisition) && /Requisition #/.test(m.text)), 'native original identifier and published requisition disagree')
  need(program.includes(model.nativeRoleProgramFragment) && owner.job?.id === id && owner.job?.title === title && owner.job?.country?.name === 'India' && owner.job?.location?.name === location, 'native own employer, country or application role binding changed')
  need(mode === 'otac_17.4' && doc.text(button) === 'Apply for Job' && !Object.hasOwn(button.attrs, 'disabled') && (button.attrs['aria-disabled'] === undefined || button.attrs['aria-disabled'].trim().toLowerCase() === 'false'), 'native own Apply unavailable')
  need(criteria.length === model.criteriaCharacters && sha(criteria) === model.criteriaSHA256 && equal(metadata, model.nativeMetadata), 'full authored native criteria or hiring metadata changed')
  const postingDate = postedDate(metadata)
  if (/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{2}, \d{4}$/.test(card.publishedDateLabel)) need(postedDate([{ text: card.publishedDateLabel + ' Post Date' }]) === postingDate, 'conflicting native card/detail Post Date')
  const description = title + '\n' + location + '\n' + metadata.map(m => m.text).join('\n') + '\n\n' + criteria
  return { title, location, url: model.url, id, requisition, criteria, description, metadata, postingDate,
    originalOwnRoleHTML: html,
    originalOwnRoleMain: structuredClone(one(doc.nodes(n => n.attrs.id === 'job_details_content'), 'full native role context')),
    application: { url: model.url, label: doc.text(button), buttonAttributes: structuredClone(button.attrs), nativeRoleIdentifier: id, nativeApplicationMode: mode,
      nativeHandlerURL: null, kind: 'current-own-authored-role-apply-control-unexecuted',
      actionMethod: null, actionURL: null,
      actionRequested: false, externalDestination: null, submissionPerformed: false, renderedApplicationQualified: false } }
}

export async function runCurrentPetrofacPublication(options = {}) {
  options.signal?.throwIfAborted()
  need(!(options.fetchText || options.fetchPage || options.fetchJson) || options.fetchImpl, 'original public HTTP metadata required')
  const duration = options.sourceDeadlineMs ?? 85000, interval = options.requestIntervalMs ?? 500
  need(Number.isSafeInteger(duration) && duration > 0 && duration <= 85000, 'invalid source deadline')
  need(Number.isSafeInteger(interval) && interval >= 0 && interval <= 60000 && (interval >= 500 || options.fetchImpl), 'invalid native pacing')
  const observedAt = typeof options.now === 'function' ? options.now() : new Date().toISOString()
  need(Number.isFinite(Date.parse(observedAt)), 'invalid native observation clock')
  const started = performance.now(), deadline = Object.assign(new DOMException('Petrofac source deadline exceeded', 'TimeoutError'), { softFailure: true, abortRetries: true, failureKind: 'network_or_timeout', lifecycleCleanupAllowed: false })
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(deadline), duration)
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal
  const check = () => { options.signal?.throwIfAborted(); if (performance.now() - started >= duration && !controller.signal.aborted) controller.abort(deadline); signal.throwIfAborted() }
  const receipts = [], last = new Map(), gates = new Map()
  let opening, closing
  const acquiredPhases = []
  let allowed = new Set([profile.configuredHome]), reads = 0, total = 0
  const pace = async origin => {
    const previous = gates.get(origin) || Promise.resolve()
    let release
    const next = new Promise(resolve => { release = resolve }); gates.set(origin, next)
    try {
      await previous; check()
      const wait = Math.max(0, interval - (performance.now() - (last.get(origin) ?? -Infinity)))
      if (wait) try { await delay(wait, undefined, { signal }) } catch (error) { check(); throw error }
      check(); last.set(origin, performance.now())
    } finally { release() }
  }
  const read = async url => {
    let metadataFailure, response, pendingResponse, pendingRead, reader, cancellation
    let canceled = false, complete = false, handedOff = false
    const release = () => { try { reader?.releaseLock() } catch { /* Preserve primary transport outcome. */ } }
    const cancel = reason => {
      if (!canceled) {
        canceled = true
        cancellation = disposeResponseReader({ cancel: async () => {
          if (reader) return reader.cancel(reason)
          const acquired = response ?? await pendingResponse
          return acquired?.body?.cancel(reason)
        } }, { bestEffort: true }).finally(release)
      }
      return cancellation
    }
    try {
      check(); need(allowed.has(url) && profile.documents.includes(url) && ++reads <= 10, 'unbound native URL or request cap')
      await pace(new URL(url).origin)
      const p = await boundedDeclaredPublicRead(url, { signal, timeoutMs: 15000, overflowError: problem('native streaming byte bound'), fetchImpl: (value, init) => (pendingRead = (async () => {
        try {
          options.signal?.throwIfAborted(); init.signal?.throwIfAborted()
          response = await (pendingResponse = Promise.resolve((options.fetchImpl || globalThis.fetch)(value, { ...init, cache: 'no-store', credentials: 'omit',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify careers inventory check)', Accept: 'text/html' } })))
          const headers = Object.fromEntries(response.headers.entries()), expected = profile.originalPackets[url]
          let rejected
          if (response.url !== url) rejected = Object.assign(problem('foreign final response URL before entity read'), { status: response.status, httpStatus: response.status })
          else if ([401, 403, 429, 451].includes(response.status) || isHttpAccessChallenge(response)) {
            rejected = buildHttpError(response, url)
            Object.assign(rejected, classifyScraperError(rejected), { abortRetries: true, lifecycleCleanupAllowed: false })
          } else if (response.status !== 200 || (headers['content-type'] || '').trim().toLowerCase() !== expected.mime
            || !equal(Object.fromEntries(securityKeys.map(k => [k, headers[k] ?? null])), expected.securityHeaders)) {
            rejected = Object.assign(problem('native public HTTP metadata changed before entity read'), { status: response.status, httpStatus: response.status })
          }
          if (rejected) {
            metadataFailure = rejected
            receipts.push({ requestedURL: url, url: response.url, status: response.status, headers, bodyRead: false, acquisitionComplete: false, rejectionStage: 'http-metadata-before-body' })
            throw rejected
          }
          options.signal?.throwIfAborted(); check()
          let size = 0
          const wrapped = { status: response.status, url: response.url, headers: response.headers, body: response.body === null ? null : {
            cancel, getReader() {
              reader = response.body.getReader()
              return {
                async read() {
                  const part = await reader.read()
                  if (part.done) complete = true
                  else {
                    need(types.isUint8Array(part.value), 'native source stream must contain original bytes')
                    const length = byteLength.call(part.value)
                    need(length <= 4000000 - size && length <= 16000000 - total, 'native streaming byte bound')
                    size += length; total += length
                  }
                  return part
                },
                cancel, releaseLock: release,
              }
            },
          } }
          handedOff = true; return wrapped
        } finally {
          if (!handedOff) await cancel(init.signal?.reason)
          options.signal?.throwIfAborted()
        }
      })()) })
      const bytes = Buffer.from(p.bodyBase64, 'base64')
      receipts.push({ requestedURL: url, ...p, bytes: bytes.length, sha256: sha(bytes) })
      let html
      try { html = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes) } catch { throw problem('original native UTF8 bytes unavailable') }
      check(); return html
    } catch (error) {
      options.signal?.throwIfAborted()
      if (metadataFailure) throw metadataFailure
      if (!signal.aborted) controller.abort(error)
      throw error
    } finally {
      await Promise.all([!complete || canceled ? cancel(signal.reason) : undefined, settleTransport(pendingRead)])
      release(); options.signal?.throwIfAborted()
    }
  }
  const phase = async () => {
    allowed = new Set([profile.configuredHome])
    const home = await read(profile.configuredHome), hd = readNativeDocument(home)
    need(hd.nodes(n => n.tag === 'meta' && n.attrs.property === 'og:site_name' && n.attrs.content === 'Petrofac').length === 1, 'configured corporate employer identity missing')
    need(hd.nodes(n => n.tag === 'a' && n.attrs.href && [profile.careers, profile.careers + '/'].includes(new URL(n.attrs.href, profile.configuredHome).href)).length > 0, 'configured own careers handoff missing')
    allowed.add(profile.careers); const career = await read(profile.careers), cd = readNativeDocument(career)
    need(cd.nodes(n => n.tag === 'a' && n.attrs.href === profile.board).length > 0, 'current corporate exact native recruitment handoff missing')
    allowed.add(profile.board); const boardHTML = await read(profile.board), rows = cards(boardHTML), selected = []
    const state = { rows, selected, originalOwnBoardHTML: boardHTML, complete: false }; acquiredPhases.push(state)
    for (const model of profile.roleModels) {
      const card = one(rows.filter(c => c.url === model.url), 'current declared own role')
      allowed.add(card.url); selected.push(role(await read(card.url), model, card))
    }
    state.complete = true; return state
  }
  try {
    opening = await phase(); closing = await phase()
    const reconciled = state => ({ rows: state.rows, publisher: nativeOwner(state.originalOwnBoardHTML), selected: state.selected.map(r => { const copy = { ...r }; delete copy.originalOwnRoleHTML; return copy }) })
    need(equal(reconciled(opening), reconciled(closing)), 'full closing native employer, country, criteria, application or membership changed')
    signal.throwIfAborted()
    const jobs = opening.selected.map(r => ({ source: profile.source, company: profile.company, companyDomain: 'petrofac.com', companyCareerPage: profile.careers,
      title: r.title, jobId: r.id, sourceNativeIdentifier: r.id, requisitionId: r.requisition, sourceCanonicalRoleURL: r.url, sourceUrl: r.url, link: r.url, applyUrl: r.application.url,
      country: 'India', city: 'Chennai', location: r.location, employmentType: null, remoteStatus: null, jobDescription: r.description, sourceDescription: r.description,
      postingDate: r.postingDate, firstEverPostedAt: null, closingDate: null, sourceNativeDateLabels: r.metadata.filter(m => /Post Date/.test(m.text)), sourceDateSemanticsUnresolved: false,
      nativeSourceRecord: { originalOwnRoleHTML: r.originalOwnRoleHTML, originalOwnRoleMain: r.originalOwnRoleMain, originalNativeFullCriteria: r.criteria, originalNativeMetadata: r.metadata, originalPublishedApplication: r.application },
      sourceNativeEmployerBinding: { configuredCorporateURL: profile.configuredHome, currentCareers: profile.careers, nativePortal: profile.board, exactNativeClientName: 'Petrofac', companyScopeQualified: false },
      sourceNativeCountryProof: { nativeCardText: one(opening.rows.filter(c => c.url === r.url), 'original role card').nativeCardText, ownRoleLocation: r.location, originalTypedCountryPublished: 'India', cityDictionaryUsed: false },
      sourceDetailComplete: true, sourceNativeClosingReconciled: true, sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false, sourceRenderedApplicationQualified: false, scrapedAt: observedAt }))
    attachSourceObservationEvidence(jobs, { source: profile.source, recordKind: 'vacancy-rows', observedRecordCount: opening.rows.length, observedVacancyCount: opening.rows.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
    Object.defineProperty(jobs, 'nativeCollectionEvidence', { configurable: true, value: { source: profile.source, originalResponses: receipts, nativeRows: opening.rows, closingNativeRows: closing.rows,
      originalOpeningBoardHTML: opening.originalOwnBoardHTML, originalClosingBoardHTML: closing.originalOwnBoardHTML,
      holds: opening.rows.filter(c => !profile.roleModels.some(r => r.url === c.url)).map(c => ({ ...c, reason: c.country && c.country !== 'India' ? 'native-explicit-non-India-featured-location' : 'own-detail-not-qualified-within-current-selected-role-bound' })),
      currentFullClosingReconciled: true, closingReconciliationScope: 'all typed featured rows, native owner/account, selected full role main, full criteria, metadata and apply controls', originalWholeBoardBytesEqual: opening.originalOwnBoardHTML === closing.originalOwnBoardHTML, rawWholePageEqualityRequired: false, renderedVisibilityQualified: false, fullProgramExecutionQualified: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false, companyGlobalTotal: null, companyIndiaTotal: null, applicationRequested: false, renderedApplicationQualified: false } })
    attachInventoryEvidence(jobs, { status: 'coverage-gap', surface: profile.board, firstParty: true, listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched: reads,
      reportedTotal: null, indiaFacetCount: null, verifiedAt: observedAt, reason: 'current-own-authored-native-role-criteria+explicit-card-and-role-India+native-identifiers+full-native-facts-closing-reconciled;partial-featured-observations;company-inventory-zero-rendered-visibility-and-application-operation-unqualified' })
    check(); return jobs
  } catch (error) {
    if (!controller.signal.aborted) controller.abort(error)
    if (options.signal?.aborted) throw options.signal.reason
    if (error && typeof error === 'object' && Object.isExtensible(error)) try { Object.assign(error, { softFailure: true, abortRetries: true, failureKind: error.failureKind || 'coverage_gap', sourceScopeComplete: false, lifecycleCleanupAllowed: false, nativeEvidence: { source: profile.source, originalResponses: receipts, nativeRows: acquiredPhases[0]?.rows ?? null, acquiredPhases, opening, closing, currentFullClosingReconciled: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false } }) } catch { /* Preserve the original native error. */ }
    throw error
  } finally { clearTimeout(timer); controller.abort(); options.signal?.throwIfAborted() }
}
