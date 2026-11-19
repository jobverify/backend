import { createHash } from 'node:crypto'
import { boundedDeclaredPublicGet } from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import { firstPartyFailure } from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import { qualifiedFirstPartyHTML, retained, authoredNativeLines, clean } from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const SOURCE = 'sparxitsolutions', ROOT = 'https://www.sparxitsolutions.com/career.shtml'
const APPLY = 'mailto:talent@sparxitsolutions.com'
const CLIENT = 'https://www.sparxitsolutions.com/assets-style/js/custom.js'
const PROGRAMS = new Map([
  ['https://www.sparxitsolutions.com/assets-style/js/jquery-3.5.1.min.js', '6150a35c0f486c46cadf0e230e2aa159c7c23ecfbb5611b64ee3f25fcbff341f'],
  [CLIENT, '30038101db2d121023cd1e377edd78a22030c8325fe220b403b073e6c69e43e0'],
])
// Exact whole native labels only. The official Noida authority's NIC GIS
// independently identifies this municipality as Uttar Pradesh, India. This
// finite qualification never borrows a company office/footer as a role scope.
const NOIDA_LABELS = new Set(['Noida (Sector 63)', 'Noida (Onsite, 5 days a week)', 'Noida, Sector 63 (Onsite, 5 days a week)'])
const GEOGRAPHY = { authority: 'New Okhla Industrial Development Authority / National Informatics Centre',
  url: 'https://onemapup.nic.in/noida/', country: 'India', state: 'Uttar Pradesh', city: 'Noida',
  checkedAt: '2026-11-19T03:09:14.670Z', sha256: 'b10e41b70df43cd9a4779ea1c4d4fb8d54a0b568418178cdfd1a63274ad1cc80' }
const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
const failure = message => firstPartyFailure(SOURCE, message, { failureKind: 'coverage_gap', nativeAuthorityFailure: true })
const need = (ok, message) => { if (!ok) throw failure(message) }
const sha = value => createHash('sha256').update(value).digest('hex')
const cls = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const children = node => node.children.filter(child => typeof child !== 'string')
const label = node => clean(authoredNativeLines(node).join(' '))
const unsafe = node => Object.hasOwn(node.attrs, 'hidden') || Object.hasOwn(node.attrs, 'inert') || Object.hasOwn(node.attrs, 'disabled')
  || ['true', '1'].includes(String(node.attrs['aria-disabled'] || '').trim().toLowerCase())
  || String(node.attrs['aria-hidden'] || '').trim().toLowerCase() === 'true'
const unreviewedHidden = node => unsafe(node)
  || /(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:\s*hidden)/i.test((node.attrs.style || '').replace(/\/\*[\s\S]*?\*\//g, ''))
  || children(node).some(unreviewedHidden)
const allNodes = node => [node, ...children(node).flatMap(allNodes)]

export const hasCurrentSparxClient = html => String(html).includes(CLIENT)

function inspect(html) {
  const page = qualifiedFirstPartyHTML(html, ROOT, failure)
  need(page.title === 'Job Openings with Sparx IT Solutions', 'Native publisher employer changed')
  const executable = page.raw.nodes(node => node.tag === 'script' && node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
    && /^(?:|module|(?:text|application)\/(?:java|ecma)script)$/i.test(node.attrs.type || ''))
  const indices = [...PROGRAMS.keys()].map(url => {
    const matches = executable.filter(node => node.attrs.src === url)
    need(matches.length === 1, 'Current native renderer program declaration changed')
    return executable.indexOf(matches[0])
  })
  need(indices[0] < indices[1], 'Native renderer dependency order changed')
  const wrappers = page.raw.nodes(node => cls(node, 'accordion-wrapper'))
  need(wrappers.length === 1, 'Missing or ambiguous native accordion owner')
  const blocks = children(wrappers[0]).filter(node => cls(node, 'accordion'))
  need(blocks.length > 0 && blocks.length <= 100, 'No qualified positive native listing; empty scope unverified')
  const ids = new Set()
  const records = blocks.map(block => {
    const direct = children(block), header = direct[0], panel = direct[1]
    need(header?.tag === 'div' && cls(header, 'acc-question') && !header.inert && !unsafe(header)
      && panel?.tag === 'div' && cls(panel, 'accordion-content') && !unsafe(block), 'Native role header/detail adjacency changed')
    const titles = page.raw.nodes(node => cls(node, 'que'), header)
    need(titles.length === 1 && /^Profile:\s*\S/.test(label(titles[0])), 'Native role identity missing')
    const title = label(titles[0]).replace(/^Profile:\s*/, ''), id = title.toLowerCase().replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    need(id && !ids.has(id), 'Duplicate native role identity')
    ids.add(id)
    const field = name => { const values = page.raw.nodes(node => cls(node, name), header)
      return values.length === 1 ? label(values[0]) : null }
    return { id, title, originalHeader: structuredClone(header), originalCriteria: structuredClone(panel),
      originalBlock: structuredClone(block), location: field('job-loaction')?.replace(/^Location:\s*/, '') ?? null,
      positions: field('post-pos'), experience: field('post-exp'), education: field('certification') }
  })
  return { html, records }
}

function qualify(row) {
  need(NOIDA_LABELS.has(row.location), 'Unknown, missing, remote or mixed native country/locality')
  need(/^Positions?\s*:\s*0*[1-9]\d*$/i.test(row.positions || '') && /^Experience:\s*\S/.test(row.experience || '')
    && /^Eligibility Criteria \(Educational\):\s*\S/.test(row.education || ''), 'Native role eligibility or active opening count missing')
  const panel = row.originalCriteria
  // Only this adjacent panel's reviewed initial display state may be opened by
  // the exact current click handler. Other dormant/inert content stays held.
  need(/^\s*display\s*:\s*none\s*;?\s*$/i.test(panel.attrs.style || '') && !unsafe(panel)
    && children(panel).every(node => !unreviewedHidden(node)), 'Native criteria contains unreviewed hidden content')
  const lines = authoredNativeLines(panel), criteria = lines.join('\n')
  need(criteria.length >= 100 && /summary|responsibilit|skills|requirements/i.test(criteria), 'Native full criteria unavailable')
  need(!/no longer (?:available|accepting)|(?:position|vacancy|job|role) (?:is |has been )?(?:filled|closed|expired)/i.test(criteria), 'Native role closed')
  for (const location of lines.flatMap(line => [...line.matchAll(/(?:^|\b)(?:(?:job|work)\s+)?location\s*:\s*(.+)$/gi)].map(match => clean(match[1])))) {
    need(NOIDA_LABELS.has(location), 'Native detail geography conflicts with the header')
  }
  need(!/(?:this (?:role|position)|work (?:mode|arrangement))[^\n.]{0,70}\bremote\b/i.test(criteria), 'Native detail remote scope is unqualified')
  const actions = retained(panel, node => node.tag === 'a' && cls(node, 'btn-apply'))
  need(actions.length === 1 && actions[0].attrs.href === APPLY && label(actions[0]) === 'Apply' && !unsafe(actions[0]),
    'Native own role application binding changed')
  need(allNodes(panel).filter(node => node.tag === 'a' && cls(node, 'btn-apply')).length === 1, 'Native application binding ambiguous')
  return [...authoredNativeLines(row.originalHeader), ...lines].join('\n')
}

export async function runCurrentSparx(options = {}) {
  options.signal?.throwIfAborted()
  const signal = AbortSignal.any([AbortSignal.timeout(120000), ...(options.signal ? [options.signal] : [])])
  const audit = { source: SOURCE, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    receipts: [], failures: [], unqualifiedRoleIds: [], geography: GEOGRAPHY }
  const allowed = new Set([ROOT, ...PROGRAMS.keys()])
  let requests = 0, aggregate = 0
  const read = async (url, type) => {
    signal.throwIfAborted(); need(allowed.has(url) && ++requests <= 8, 'Unbound native public read or request budget')
    const response = await boundedDeclaredPublicGet(url, { signal, overflowError: failure('Native entity exceeds byte limit'),
      fetchImpl: (requested, init) => (options.fetchImpl || globalThis.fetch)(requested, { ...init, credentials: 'omit', cache: 'no-store',
        headers: { ...init.headers, 'User-Agent': chrome } }) })
    const bytes = Buffer.from(response.bodyBase64, 'base64'); aggregate += bytes.length
    audit.receipts.push({ requestedURL: url, finalURL: response.url, status: response.status, bytes: bytes.length, sha256: sha(bytes) })
    need(aggregate <= 8e6 && response.status === 200 && response.url === url, 'Native response authority, status or byte budget changed')
    need((type === 'js' ? /(?:text|application)\/(?:java|ecma)script/i : /text\/html/i).test(response.headers['content-type'] || ''), 'Native MIME changed')
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  }
  const collect = async () => {
    const snapshot = inspect(await read(ROOT, 'html'))
    for (const [url, hash] of PROGRAMS) need(sha(await read(url, 'js')) === hash, 'Current native executable program requires review')
    return snapshot
  }
  try {
    const opening = await collect(), jobs = []
    Object.assign(audit, { originalPublisherHTML: opening.html, originalRecords: opening.records })
    const scrapedAt = typeof options.now === 'function' ? options.now() : new Date().toISOString()
    for (const row of opening.records) {
      try {
        const description = qualify(row)
        jobs.push({ source: SOURCE, company: 'SPARX IT Solutions', title: row.title, jobId: row.id,
          requisitionId: null, sourceNativeJobId: null, location: row.location + ', Uttar Pradesh, India',
          sourceLocation: row.location, country: 'India', city: 'Noida', state: 'Uttar Pradesh',
          countryEvidence: { ...GEOGRAPHY, nativeLabel: row.location, method: 'finite-exact-native-locality' },
          sourceUrl: ROOT, applyUrl: APPLY, link: APPLY, experienceRequired: row.experience.replace(/^Experience:\s*/, ''),
          minimumQualification: row.education.replace(/^Eligibility Criteria \(Educational\):\s*/, ''),
          jobDescription: description, sourceDescription: description, sourceNativeJobRecord: row,
          sourceDetailComplete: true, sourceDetailStatus: 'complete-current-native-criteria-and-bound-mail-application',
          sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false, scrapedAt })
      } catch (error) { signal.throwIfAborted(); audit.unqualifiedRoleIds.push(row.id); audit.failures.push({ id: row.id, message: error.message }) }
    }
    const closing = await collect()
    need(JSON.stringify(opening.records) === JSON.stringify(closing.records), 'Closing native inventory or full criteria changed')
    audit.closingPublisherHTML = closing.html; audit.closingReconciled = true
    const limit = options.maxJobs ?? null
    need(limit === null || limit === Infinity || Number.isSafeInteger(limit) && limit >= 0, 'Invalid caller output cap')
    const selected = limit === null || limit === Infinity ? jobs : jobs.slice(0, limit)
    attachSourceObservationEvidence(selected, { source: SOURCE, recordKind: 'vacancy-rows', observedRecordCount: opening.records.length,
      observedVacancyCount: opening.records.length, sourceScopeComplete: false, companyGlobalTotal: null, companyIndiaTotal: null })
    Object.defineProperty(selected, 'nativeCollectionEvidence', { value: audit, configurable: true })
    options.signal?.throwIfAborted()
    return attachInventoryEvidence(selected, { status: selected.length ? 'discovery-only' : 'coverage-gap', surface: ROOT,
      firstParty: true, listingComplete: false, lifecycleCleanupAllowed: false, pagesFetched: requests,
      reportedTotal: opening.records.length, indiaFacetCount: null, verifiedAt: null,
      reason: 'current-native-accordion-full-criteria-and-bound-applications-reconciled-at-closing;finite-government-qualified-native-localities;whole-company-scope-unqualified;cleanup-forbidden' })
  } catch (error) { options.signal?.throwIfAborted(); error.sourceAudit = audit; throw error }
}
