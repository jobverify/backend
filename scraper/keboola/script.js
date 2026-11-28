import path from 'node:path'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {createRuntimeVerifiedPublicAtsScraper} from '../../scraper-support/utils/publicAtsRuntimeInventory.js'
import {fetchJsonWithRetry, fetchTextWithRetry} from '../../scraper-support/utils/fetch.js'
import {attachInventoryEvidence, readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {extractActiveDescription, readNativeDocument, activeRecruitmentNavigationDeclarations} from '../../scraper-support/utils/activeNativeHtml.js'
import {composeLeverDescription} from '../../scraper-support/utils/leverDescription.js'
import {decodeHTML} from 'entities'
export const SOURCE = 'keboola'
export const COMPANY = 'Keboola'
export const CAREERS_URL = 'https://www.keboola.com/about/jobs'
export const DISPOSITION = 'runtime-verified-recruitment'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Each run verifies current employer binding and reconciles opening and closing complete native inventories.'
export const PROVIDER_METADATA = {source: SOURCE, companyName: COMPANY, companyCareerPage: CAREERS_URL,
  atsPlatform: 'lever', boardToken: 'keboola',
  runtimeInventoryVerification: {mode: 'role-links-exact', boardUrl: 'https://jobs.lever.co/keboola'},
}
const API_URL = 'https://api.lever.co/v0/postings/keboola?mode=json'
const fail = reason => { throw Object.assign(Error(`[${SOURCE}] ${reason}`), {
  softFailure: true, abortRetries: true, upstreamOutage: false, failureKind: 'coverage_gap',
}) }
const canonical = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object'
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
const records = payload => payload
const publisherProfile = JSON.parse(readFileSync(new URL('./publisherScope20261128.json', import.meta.url), 'utf8'))
const recruitingContext = /\b(?:jobs?|careers?|vacanc\w*|hiring|recruit\w*|apply|roles?|positions?|openings?|opportunit(?:y|ies)|employment|join[-_ /]+(?:us|(?:our|the)[-_ /]+team)|work[-_ /]+(?:with|for)[-_ /]+us)\b/i
const employerHost = host => host === 'keboola.com' || host.endsWith('.keboola.com')
const publisherScopeIssues = page => {
  const base = new URL(page.url)
  if (!employerHost(base.hostname)) return [] // The separately verified native case-alias page.
  const issues = []
  if (page.url !== publisherProfile.reviewedEmployerUrl) issues.push('unreviewed-employer-page-alias')
  const document = readNativeDocument(page.html)
  const reviewed = new Map(publisherProfile.ownRecruitmentAliases.map(item => [item.url, item.recruitingLabels]))
  for (const node of document.nodes(n => n.tag === 'a' && n.attrs.href)) {
    let url
    try { url = new URL(node.attrs.href, base) } catch { continue }
    if (!employerHost(url.hostname)) continue
    const label = document.text(node)
    let targetContext
    try { targetContext = decodeURIComponent(url.pathname + url.search + url.hash) }
    catch { issues.push('ambiguous-employer-link:' + url.href); continue }
    // A new marketing/blog link is not evidence of another hiring channel.
    // Recruiting paths, selectors, fragments and relabelled known URLs are.
    if (!recruitingContext.test(targetContext) && !recruitingContext.test(label)) continue
    const labels = reviewed.get(url.href)
    if (!labels || (recruitingContext.test(label) && !labels.includes(label))) issues.push('unreviewed-employer-link:' + url.href)
  }
  // The reviewed single email-subscription form is not a recruitment search or
  // application. Its complete control/attribute projection must stay unchanged.
  const forms = document.nodes(n => n.tag === 'form').map(node => ({
    attrs: node.attrs, text: document.text(node),
    controls: document.nodes(n => ['input', 'button', 'select', 'textarea'].includes(n.tag), node)
      .map(n => ({tag: n.tag, attrs: n.attrs})),
  }))
  if (canonical(forms) !== canonical(publisherProfile.forms)) issues.push('unreviewed-employer-form')
  const frames = node => node.activeFrame ? [node.attrs] : node.inert ? []
    : node.children.filter(child => typeof child !== 'string').flatMap(frames)
  // Include srcdoc owners: the shared iframe URL reader deliberately excludes
  // their fallback/inline document, which cannot prove absence of another scope.
  if (canonical(frames(document.nodes(n => n.tag === 'root')[0])) !== canonical(publisherProfile.frames)) issues.push('unreviewed-employer-iframe')
  if (readNativeDocument(page.html, {excludeObjectFallback: false}).nodes(n => ['object', 'embed'].includes(n.tag)).length) issues.push('unreviewed-employer-object-embed')
  if (canonical(activeRecruitmentNavigationDeclarations(page.html)) !== canonical(publisherProfile.scriptedNavigation)) issues.push('unreviewed-scripted-recruitment-navigation')
  // A navigation admission parser accepts only finite known statements; its
  // silence cannot prove that another inline handler has no recruiting action.
  if (document.nodes(n => Object.keys(n.attrs).some(key => /^on[a-z]+$/i.test(key))).length) issues.push('unreviewed-employer-inline-event')
  for (const node of document.nodes(n => n.tag === 'script' && n.attrs.src && !Object.hasOwn(n.attrs, 'nomodule'))) {
    let url
    try { url = new URL(node.attrs.src, base) } catch { continue }
    // Current first-party script URLs are framework assets, never an inspected
    // recruitment delegation. An added own widget requires a separate proof.
    if (employerHost(url.hostname) && (url.search || url.hash || !/^\/_next\/static\/(?:immutable\/)?chunks\/[a-z0-9/_%.\[\]-]+\.js$/i.test(url.pathname))) issues.push('unreviewed-employer-script-embed:' + url.href)
  }
  return [...new Set(issues)]
}
const state = payload => canonical([...payload].sort((a, b) => a.id.localeCompare(b.id)))
const text = value => typeof value === 'string' ? decodeHTML(extractActiveDescription(value) || '').replace(/\s+/g, ' ').trim() : ''
const criteriaComplete = row => {
  const fields = ['description', 'descriptionPlain', 'descriptionBody', 'descriptionBodyPlain', 'additional', 'additionalPlain', 'opening', 'openingPlain']
  if (fields.some(field => row[field] != null && typeof row[field] !== 'string')
    || (row.lists != null && !Array.isArray(row.lists))) fail('native criteria schema changed')
  if ((row.lists || []).some(section => !section || typeof section !== 'object'
    || typeof section.content !== 'string' || (section.text != null && typeof section.text !== 'string'))) fail('native criteria section changed')
  // This reviewed contract has no independent opening section. New authored
  // conditions remain unresolved until their full mapping is supported.
  if (text(row.opening) || text(row.openingPlain)) return false
  const description = text(row.descriptionPlain) || text(row.description)
  const body = text(row.descriptionBodyPlain) || text(row.descriptionBody)
  if (body && body !== description) return false
  if ((row.lists || []).some(section => !text(section.content))) return false
  return Boolean(text(composeLeverDescription(row)))
}
export const run = async (options = {}) => {
  const {signal} = options
  const loadPage = options.fetchPage || ((url, init) => fetchTextWithRetry(url, {...init,
    attempts: 1, timeoutMs: 20000, label: SOURCE, includeResponseMetadata: true}))
  const loadJson = options.fetchJson || (async (url, init) => {
    const response = await fetchJsonWithRetry(url, {...init,
      attempts: 1, timeoutMs: 20000, label: SOURCE, includeResponseMetadata: true})
    if (response.status !== 200 || response.url !== url) fail('native inventory response authority changed')
    return response.payload
  })
  const snapshot = async () => {
    signal?.throwIfAborted()
    let payload, fullCriteria = true
    const receipts = [], publisherIssues = []
    const jobs = await createRuntimeVerifiedPublicAtsScraper(PROVIDER_METADATA).run({signal,
      fetchPage: async (url, init) => {
        const page = await loadPage(url, init)
        if (typeof page?.html !== 'string' || Buffer.byteLength(page.html) > 3000000) fail('employer inventory unavailable or oversized')
        publisherIssues.push(...publisherScopeIssues(page))
        receipts.push({requestedUrl: url, url: page.url, status: page.status})
        return page
      },
      fetchJson: async (url, init) => {
        if (url !== API_URL || payload !== undefined) fail('unexpected native inventory request')
        payload = await loadJson(url, init)
        const rows = payload
        if (!Array.isArray(rows) || rows.length > 200) fail('invalid or oversized native inventory')
        const ids = new Set()
        for (const row of rows) {
          if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id)) fail('duplicate or invalid native identity')
          ids.add(row.id)
          for (const field of ['hostedUrl', 'applyUrl']) {
            let role
            try { role = new URL(row[field]) } catch { fail('invalid native role identity') }
            if (role.search || role.hash) fail('ambiguous native role identity')
          }
          if (!criteriaComplete(row)) fullCriteria = false
        }
        return payload
      },
    })
    signal?.throwIfAborted()
    return {jobs, payload: structuredClone(payload), receipts, fullCriteria, publisherIssues, evidence: readInventoryEvidence(jobs)}
  }
  const opening = await snapshot(), closing = await snapshot()
  signal?.throwIfAborted()
  const reasons = []
  if (!opening.evidence?.listingComplete) reasons.push(`opening:${opening.evidence?.reason || 'inventory-unavailable'}`)
  if (!closing.evidence?.listingComplete) reasons.push(`closing:${closing.evidence?.reason || 'inventory-unavailable'}`)
  if (!opening.fullCriteria || !closing.fullCriteria) reasons.push('full-native-role-criteria-unavailable')
  if (opening.publisherIssues.length || closing.publisherIssues.length) reasons.push('additional-or-unreviewed-employer-recruitment-channel')
  if (state(opening.payload) !== state(closing.payload)) reasons.push('closing-native-inventory-changed')
  const complete = reasons.length === 0, jobs = closing.jobs
  for (const job of jobs) Object.assign(job, {sourceListingComplete: complete,
    sourceScopeComplete: complete, lifecycleCleanupAllowed: complete})
  Object.defineProperty(jobs, 'nativeCollectionEvidence', {configurable: true, value: {
    ...jobs.nativeCollectionEvidence, source: SOURCE, sourceScopeComplete: complete,
    openingNativePayload: opening.payload, closingNativePayload: closing.payload,
    employerPageReceipts: [...opening.receipts, ...closing.receipts],
    publisherScopeIssues: [...new Set([...opening.publisherIssues, ...closing.publisherIssues])],
    observedListingCount: records(closing.payload).length, listingPaginationComplete: complete,
    lifecycleCleanupAllowed: complete, verifiedAt: new Date().toISOString(), reasons,
  }})
  return attachInventoryEvidence(jobs, {...closing.evidence,
    status: complete ? closing.evidence.status : 'coverage-gap', listingComplete: complete,
    lifecycleCleanupAllowed: complete, pagesFetched: (opening.evidence?.pagesFetched || 0) + (closing.evidence?.pagesFetched || 0),
    indiaFacetCount: complete ? closing.evidence.indiaFacetCount : null, verifiedAt: new Date().toISOString(),
    reason: complete ? 'current-employer-binding-and-paired-complete-lever-inventory'
      : `paired-employer-native-inventory-incomplete:${reasons.join(';')}`,
  })
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const {saveToDB, saveToFile} = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
