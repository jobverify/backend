import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { runVerifiedWorkdayBoardUnion } from '../../scraper-support/shared/workdayBoardUnion.js'
import { auditCurrentWorkdayRawScope, workdayCorporateExecutableSignature } from '../../scraper-support/shared/workdayCurrentSourceScope.js'
import { reconcileRetainedWorkdayRoleProof } from '../../scraper-support/shared/workdayRetainedRoleProof.js'
import { currentWorkdayBoardReceipt, WORKDAY_COUNTRY_INVENTORY_PROOF } from '../../scraper-support/myworkday/countryInventoryProof.js'
import { readNativeDocument, activeScripts, activeIframeSources, activeHead } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const directory = path.dirname(fileURLToPath(import.meta.url))
const OFFICIAL = 'https://www.lexmark.com/en_us/about-us/careers.html'
const BOARD = 'https://lexmark.wd1.myworkdayjobs.com/Lexmark'
const API = 'https://lexmark.wd1.myworkdayjobs.com/wday/cxs/lexmark/Lexmark/jobs'
const reviewedScope = JSON.parse(readFileSync(new URL('./reviewedNativeScope.json', import.meta.url), 'utf8'))
const RECRUITING = /(?:^|\.)(?:greenhouse\.io|ashbyhq\.com|lever\.co|myworkdayjobs\.com|myworkdaysite\.com|smartrecruiters\.com|workable\.com|icims\.com|successfactors\.com|successfactors\.eu|taleo\.net|jobs2web\.com|teamtailor\.com|personio\.com|bamboohr\.com|freshteam\.com|applytojob\.com|breezy\.hr|recruitee\.com|jobvite\.com|keka\.com|darwinbox\.com|darwinbox\.in)$/i
const normalize = value => value.replace(/\/$/, '')
const requireNative = (condition, reason) => { if (!condition) throw new Error(`Lexmark native inventory: ${reason}`) }

async function boardSnapshot(signal) {
  signal?.throwIfAborted()
  const response = await fetch(BOARD, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
    headers: { Accept: 'text/html' }, redirect: 'error' })
  const html = await response.text(), document = readNativeDocument(html)
  signal?.throwIfAborted()
  requireNative(response.status === 200 && response.url === BOARD && /^text\/html\b/i.test(response.headers.get('content-type') || '')
    && Buffer.byteLength(html) <= 3000000, 'invalid native board HTTP identity')
  requireNative(document.nodes(node => node.tag === 'meta' && node.attrs.property === 'og:title' && node.attrs.content === 'Lexmark Careers').length === 1
    && document.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical' && node.attrs.href === BOARD).length === 1
    && activeScripts(html).some(body => /tenant:\s*"lexmark"/.test(body) && /siteId:\s*"Lexmark"/.test(body)), 'native bootstrap employer/tenant/site identity changed')
  return { url: response.url, status: response.status, sha256: createHash('sha256').update(html).digest('hex') }
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
  const executableSignature = workdayCorporateExecutableSignature(html)
  if (executableSignature !== reviewedScope.corporateExecutableSignature) reasons.push('unreviewed-corporate-script-form-or-handler-surface')
  requireNative(head.titles.length === 1 && /^Lexmark(?: U\.S\.)? Careers$/i.test(head.titles[0]), 'corporate employer identity changed')
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
  return { receipt, reasons: [...new Set(reasons)], executableSignature,
    signature: createHash('sha256').update(JSON.stringify([hiring.sort(), executableSignature])).digest('hex') }
}

export async function runCurrentLexmarkInventory(options = {}) {
  const { signal, onAudit } = options
  signal?.throwIfAborted()
  requireNative(!options.fetchText && !options.fetchJson && !options.fetchImpl,
    'native HTTP response metadata is required; body-only transport overrides are unsupported')
  requireNative(options.maxJobs == null && options.maxPages == null, 'inventory caps and page limits are unsupported')
  const opening = await corporateSnapshot(signal)
  const openingBoard = await boardSnapshot(signal)
  const rawOpening = await auditCurrentWorkdayRawScope({ apiUrl: API, boardUrl: BOARD, schema: reviewedScope, signal,
    requestTimeoutMs: options.requestTimeoutMs })
  const rawJobs = await runVerifiedWorkdayBoardUnion({ source: 'lexmarkinternational', company: 'Lexmark International',
    boards: [{ tenant: 'lexmark', site: 'Lexmark', baseUrl: BOARD, scraperDir: directory }],
    employerPattern: /^Lexmark(?: International(?:,? Inc\.?)?| International Technology| India| Research)?$/i,
    completeSourceScope: opening.reasons.length === 0 && rawOpening.reasons.length === 0,
  }, options)
  const rawClosing = await auditCurrentWorkdayRawScope({ apiUrl: API, boardUrl: BOARD, schema: reviewedScope, signal,
    requestTimeoutMs: options.requestTimeoutMs })
  const closing = await corporateSnapshot(signal)
  const closingBoard = await boardSnapshot(signal)
  const reasons = [...opening.reasons, ...closing.reasons, ...rawOpening.reasons, ...rawClosing.reasons]
  if (opening.signature !== closing.signature) reasons.push('corporate-hiring-scope-changed')
  if (rawOpening.listingSignature !== rawClosing.listingSignature || rawOpening.detailSignature !== rawClosing.detailSignature)
    reasons.push('raw-native-inventory-or-details-changed')
  const nativeProof = rawJobs[WORKDAY_COUNTRY_INVENTORY_PROOF]
  if (nativeProof.boards.some(board => board.reconciliation?.initial.sha256 !== rawOpening.nativeIdentitySignature
    || board.reconciliation?.closing.sha256 !== rawClosing.nativeIdentitySignature)) reasons.push('raw-and-native-country-proof-inventories-disagree')
  if (nativeProof.boards.some(board => board.reportedTotal !== rawOpening.total || board.reportedTotal !== rawClosing.total)
    || rawJobs.some(job => !rawOpening.roleIds.includes(job.requisitionId) || !rawClosing.roleIds.includes(job.requisitionId)))
    reasons.push('raw-native-and-country-proof-inventories-disagree')
  const evidence = readInventoryEvidence(rawJobs)
  if (!evidence.listingComplete) reasons.push(evidence.reason)
  const checkedJobs = rawJobs.map(job => reconcileRetainedWorkdayRoleProof(job, rawOpening, rawClosing))
  if (checkedJobs.some(job => !job.sourceDetailComplete)) reasons.push('retained-native-role-detail-proof-incomplete')
  const complete = reasons.length === 0
  const jobs = checkedJobs.map(job => ({ ...job, company: 'Lexmark International', sourceListingComplete: complete,
    sourceScopeComplete: complete, lifecycleCleanupAllowed: complete }))
  const proof = { ...nativeProof, completeSourceScope: complete }
  Object.defineProperty(jobs, WORKDAY_COUNTRY_INVENTORY_PROOF, { value: proof })
  const audit = { source: 'lexmarkinternational', productionWrites: false, complete,
    reasons: [...new Set(reasons)], openingCorporate: opening, closingCorporate: closing, openingBoard, closingBoard,
    rawOpening, rawClosing, nativeBoards: proof.boards, nativeCount: proof.boards.reduce((sum, board) => sum + board.reportedTotal, 0),
    returnedIndiaJobs: jobs.length, nativeEmployers: [...new Set(jobs.map(job => job.nativeEmployer))],
  }
  onAudit?.(structuredClone(audit))
  signal?.throwIfAborted()
  return attachInventoryEvidence(jobs, { ...evidence, listingComplete: complete, status: complete ? evidence.status : 'coverage-gap',
    reportedTotal: complete ? evidence.reportedTotal : null, indiaFacetCount: complete ? jobs.length : null,
    reason: complete ? 'lexmark-current-employer-complete-global-workday-country-and-detail-proof' : `lexmark-source-incomplete:${audit.reasons.join(';')}` })
}
