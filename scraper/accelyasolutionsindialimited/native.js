import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { runVerifiedWorkdayBoardUnion } from '../../scraper-support/shared/workdayBoardUnion.js'
import { auditCurrentWorkdayRawScope, workdayCorporateExecutableSignature } from '../../scraper-support/shared/workdayCurrentSourceScope.js'
import { reconcileRetainedWorkdayRoleProof } from '../../scraper-support/shared/workdayRetainedRoleProof.js'
import { normalizeAccelyaCorporateScript } from './corporateScriptConfig.js'
import { captureActiveHiringScope } from '../../scraper-support/shared/kekaCurrentSourceScope.js'
import { currentWorkdayBoardReceipt, WORKDAY_COUNTRY_INVENTORY_PROOF } from '../../scraper-support/myworkday/countryInventoryProof.js'
import { readNativeDocument, activeScripts, activeIframeSources, activeHead } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const directory = path.dirname(fileURLToPath(import.meta.url))
const OFFICIAL = 'https://w3.accelya.com/careers/'
const BOARD = 'https://accelya.wd103.myworkdayjobs.com/Careers'
const API = 'https://accelya.wd103.myworkdayjobs.com/wday/cxs/accelya/Careers/jobs'
const reviewedScope = JSON.parse(readFileSync(new URL('./reviewedNativeScope.json', import.meta.url), 'utf8'))
const reviewedConsumers = JSON.parse(readFileSync(new URL('./reviewedCorporateConsumers.json', import.meta.url), 'utf8'))
const RECRUITING = /(?:^|\.)(?:greenhouse\.io|ashbyhq\.com|lever\.co|myworkdayjobs\.com|myworkdaysite\.com|smartrecruiters\.com|workable\.com|icims\.com|successfactors\.com|successfactors\.eu|taleo\.net|jobs2web\.com|teamtailor\.com|personio\.com|bamboohr\.com|freshteam\.com|applytojob\.com|breezy\.hr|recruitee\.com|jobvite\.com|keka\.com|darwinbox\.com|darwinbox\.in)$/i
const normalize = value => value.replace(/\/$/, '')
const requireNative = (condition, reason) => { if (!condition) throw new Error(`Accelya native inventory: ${reason}`) }
const sha256 = body => createHash('sha256').update(body).digest('hex')

// The appBk.bk literal is unused only within the reviewed declared programs.
// Keep this source-local: do not let a fresh program inherit that conclusion.
// These are ordinary GETs of explicit script URLs, never publisher execution.
async function corporateConsumerProof(document, signal) {
  const reasons = [], receipts = []
  const declarations = document.nodes(node => node.tag === 'script' && node.attrs.src).map(node => {
    let url
    try { url = new URL(node.attrs.src, OFFICIAL).href } catch { url = node.attrs.src }
    return { url, id: node.attrs.id || '', type: node.attrs.type || '' }
  })
  const expected = reviewedConsumers.programs.map(({ url, id, type }) => ({ url, id, type }))
  const sorted = values => [...values].sort((a, b) => a.url.localeCompare(b.url))
  if (JSON.stringify(sorted(declarations)) !== JSON.stringify(sorted(expected))) reasons.push('unreviewed-corporate-consumer-declaration-set-or-type')
  for (const program of reviewedConsumers.programs) {
    if (declarations.filter(row => row.url === program.url && row.id === program.id && row.type === program.type).length !== 1) continue
    signal?.throwIfAborted()
    const deadline = signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000)
    const receipt = { url: program.url, method: 'GET', observedAt: new Date().toISOString() }
    try {
      const response = await fetch(program.url, { method: 'GET', redirect: 'error', signal: deadline,
        headers: { Accept: 'application/javascript,text/javascript', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)' } })
      receipt.status = response.status
      receipt.responseUrl = response.url
      receipt.contentType = response.headers.get('content-type')
      // Preserve native Response.text decoding. Raw bytes remain separately
      // retained and hashed; Buffer.toString is not a substitute for text().
      const raw = Buffer.from(await response.clone().arrayBuffer()), body = await response.text()
      Object.assign(receipt, { sha256: sha256(raw), bytes: raw.length, rawBodyBase64: raw.toString('base64'),
        programSha256: sha256(body), bodyEncoding: 'base64-original-response-bytes' })
      deadline.throwIfAborted()
      if (response.status !== 200 || response.url !== program.url || raw.length > 3000000
        || receipt.contentType?.split(';')[0].trim().toLowerCase() !== program.contentType.toLowerCase()
        || receipt.programSha256 !== program.programSha256) reasons.push(`unreviewed-corporate-consumer-response:${program.url}`)
    } catch (error) {
      signal?.throwIfAborted()
      receipt.error = error.message
      reasons.push(`unavailable-corporate-consumer:${program.url}`)
    }
    receipts.push(receipt)
  }
  const signature = sha256(JSON.stringify({ declarations, programs: receipts.map(row => ({ url: row.url, status: row.status,
    responseUrl: row.responseUrl, contentType: row.contentType, programSha256: row.programSha256, error: row.error })) }))
  return { declarations, receipts, reasons: [...new Set(reasons)], signature }
}

async function corporateSnapshot(signal) {
  signal?.throwIfAborted()
  const response = await fetch(OFFICIAL, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
    headers: { Accept: 'text/html,application/xhtml+xml', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)' }, redirect: 'error' })
  const html = await response.text()
  signal?.throwIfAborted()
  requireNative(response.status === 200 && Buffer.byteLength(html) <= 3000000, 'invalid corporate HTTP response')
  const receipt = currentWorkdayBoardReceipt({ officialCareersUrl: OFFICIAL, boardUrl: BOARD, response, html })
  const head = activeHead(html), document = readNativeDocument(html), reasons = []
  const executableSignature = workdayCorporateExecutableSignature(html, { normalizeScript: normalizeAccelyaCorporateScript })
  if (!reviewedScope.corporateExecutableSignatures.includes(executableSignature)) reasons.push('unreviewed-corporate-script-form-or-handler-surface')
  // The shared Workday executable signature intentionally does not sign CSS.
  // Retain every complete inline style here, including inert styles and its
  // exact DOM position/attributes. No selector or unknown CSS syntax is ignored.
  const inlineStyles = captureActiveHiringScope(html, OFFICIAL).styles
  const inlineStyleSignature = sha256(JSON.stringify(inlineStyles))
  if (!reviewedScope.corporateInlineStyleSignatures.includes(inlineStyleSignature)) reasons.push('unreviewed-corporate-inline-style-surface')
  requireNative(head.titles.length === 1 && /^Careers at Accelya\b/i.test(head.titles[0]), 'corporate employer identity changed')
  const hiring = []
  for (const node of document.nodes(node => node.tag === 'a' && node.attrs.href)) {
    let url
    try { url = new URL(node.attrs.href, OFFICIAL) } catch { continue }
    const text = document.text(node)
    if (!RECRUITING.test(url.hostname) && !/career|jobs?|apply|resume|recruit|vacanc|open (?:roles?|positions?)/i.test(`${url.pathname} ${text}`)) continue
    hiring.push(url.href)
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.search) {
      if (normalize(url.href.split('#')[0]) === normalize(OFFICIAL) || normalize(url.href) === BOARD) continue
      const nativePath = url.pathname.replace(/^\/[a-z]{2}-[A-Z]{2}\//, '/')
      if (url.origin === new URL(BOARD).origin && nativePath === '/Careers/introduceYourself'
        && !url.hash && /updates|talent/i.test(text)) continue
    }
    reasons.push('additional-advertised-hiring-inventory')
  }
  for (const value of activeIframeSources(html)) {
    let url
    try { url = new URL(value, OFFICIAL) } catch { reasons.push('unreviewed-corporate-frame'); continue }
    if (!['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com'].includes(url.hostname)) reasons.push('unreviewed-corporate-frame')
  }
  if (activeScripts(html).some(body => /["']@type["']\s*:\s*(?:["']JobPosting["']|\[[^\]]*["']JobPosting["'])/i.test(body))) reasons.push('unreconciled-corporate-posting')
  const consumerProof = await corporateConsumerProof(document, signal)
  reasons.push(...consumerProof.reasons)
  return { receipt, reasons: [...new Set(reasons)], executableSignature, inlineStyleSignature, inlineStyles,
    consumerProof, signature: createHash('sha256').update(JSON.stringify([hiring.sort(), executableSignature, inlineStyleSignature, consumerProof.signature])).digest('hex') }
}

export async function runCurrentAccelyaInventory(options = {}) {
  const { signal, onAudit } = options
  signal?.throwIfAborted()
  requireNative(!options.fetchText && !options.fetchJson && !options.fetchImpl,
    'native HTTP response metadata is required; body-only transport overrides are unsupported')
  requireNative(options.maxJobs == null && options.maxPages == null, 'inventory caps and page limits are unsupported')
  const opening = await corporateSnapshot(signal)
  const rawOpening = await auditCurrentWorkdayRawScope({ apiUrl: API, boardUrl: BOARD, schema: reviewedScope, signal,
    requestTimeoutMs: options.requestTimeoutMs })
  const rawJobs = await runVerifiedWorkdayBoardUnion({ source: 'accelyasolutionsindialimited', company: 'Accelya Solutions India Limited',
    boards: [{ tenant: 'accelya', site: 'Careers', baseUrl: BOARD, scraperDir: directory }],
    employerPattern: /^Accelya (?:Solutions India Limited|Services India Private Limited)$/,
    completeSourceScope: opening.reasons.length === 0 && rawOpening.reasons.length === 0,
  }, options)
  const rawClosing = await auditCurrentWorkdayRawScope({ apiUrl: API, boardUrl: BOARD, schema: reviewedScope, signal,
    requestTimeoutMs: options.requestTimeoutMs })
  const closing = await corporateSnapshot(signal)
  const reasons = [...opening.reasons, ...closing.reasons, ...rawOpening.reasons, ...rawClosing.reasons]
  if (opening.signature !== closing.signature) reasons.push('corporate-hiring-scope-changed')
  if (rawOpening.listingSignature !== rawClosing.listingSignature || rawOpening.detailSignature !== rawClosing.detailSignature)
    reasons.push('raw-native-inventory-or-details-changed')
  const nativeProof = rawJobs[WORKDAY_COUNTRY_INVENTORY_PROOF]
  if (nativeProof.boards.some(board => board.reconciliation?.initial.sha256 !== rawOpening.nativeIdentitySignature
    || board.reconciliation?.closing.sha256 !== rawClosing.nativeIdentitySignature)) reasons.push('raw-and-native-country-proof-inventories-disagree')
  const evidence = readInventoryEvidence(rawJobs)
  if (!evidence.listingComplete) reasons.push(evidence.reason)
  const checkedJobs = rawJobs.map(job => reconcileRetainedWorkdayRoleProof(job, rawOpening, rawClosing))
  if (checkedJobs.some(job => !job.sourceDetailComplete)) reasons.push('retained-native-role-detail-proof-incomplete')
  const complete = reasons.length === 0
  const jobs = checkedJobs.map(job => ({ ...job, company: job.nativeEmployer, sourceListingComplete: complete,
    sourceScopeComplete: complete, lifecycleCleanupAllowed: complete }))
  const proof = { ...rawJobs[WORKDAY_COUNTRY_INVENTORY_PROOF], completeSourceScope: complete }
  Object.defineProperty(jobs, WORKDAY_COUNTRY_INVENTORY_PROOF, { value: proof })
  const audit = { source: 'accelyasolutionsindialimited', productionWrites: false, complete,
    reasons: [...new Set(reasons)], openingCorporate: opening, closingCorporate: closing,
    rawOpening, rawClosing, nativeBoards: proof.boards, nativeCount: proof.boards.reduce((sum, board) => sum + board.reportedTotal, 0),
    returnedIndiaJobs: jobs.length, nativeEmployers: [...new Set(jobs.map(job => job.nativeEmployer))],
  }
  onAudit?.(structuredClone(audit))
  signal?.throwIfAborted()
  return attachInventoryEvidence(jobs, { ...evidence, listingComplete: complete, status: complete ? evidence.status : 'coverage-gap',
    reportedTotal: complete ? evidence.reportedTotal : null, indiaFacetCount: complete ? jobs.length : null,
    reason: complete ? 'accelya-current-employer-complete-global-workday-country-and-detail-proof' : `accelya-source-incomplete:${audit.reasons.join(';')}` })
}
