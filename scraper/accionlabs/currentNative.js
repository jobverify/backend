import { createHash } from 'node:crypto'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { nativeCountryName } from '../../scraper-support/shared/nativeJobPosting.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { projectNativeCriteria } from '../adani/nativeCriteriaHtml.js'

const ORIGIN = 'https://www.accionlabs.com'
const proof = (value, message) => { if (!value) throw new Error('Accion current native: ' + message) }
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

function opportunityLinks(html) {
  const doc = document(html), links = new Map()
  for (const node of doc.nodes(node => node.tag === 'a' && /^(?:US|Prague) Opportunities$/i.test(doc.text(node)))) {
    const url = new URL(node.attrs.href, ORIGIN)
    proof(url.origin === ORIGIN && !url.search && !url.hash, 'unreviewed employer recruiting handoff')
    links.set(url.href, doc.text(node))
  }
  return links
}

function parseNativeRole(html, url, scope) {
  const doc = document(html), canonical = doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')
  proof(canonical.length === 1 && canonical[0].attrs.href === url, 'role canonical identity changed')
  const mains = doc.nodes(node => node.tag === 'main'), titles = doc.nodes(node => node.tag === 'h1')
  proof(mains.length === 1 && titles.length === 1 && doc.text(titles[0]), 'native role title or main absent')
  const position = doc.nodes(node => doc.hasClass(node, 'job-position-card'), mains[0])
  proof(position.length === 1, 'typed native position card missing')
  const fields = new Map()
  for (const row of doc.nodes(node => doc.hasClass(node, 'job-detail-row'), position[0])) {
    const labels = doc.nodes(node => doc.hasClass(node, 'job-detail-label'), row)
    const values = doc.nodes(node => doc.hasClass(node, 'job-detail-value'), row)
    proof(labels.length === 1 && values.length === 1 && !fields.has(doc.text(labels[0])), 'typed native role field ambiguous')
    fields.set(doc.text(labels[0]), doc.text(values[0]))
  }
  proof(/^Accion Labs(?: US)?,? Inc\.?$/i.test(fields.get('Company') || ''), 'typed native employer does not bind Accion Labs')
  proof(fields.get('Location'), 'typed native role location absent')
  const blocks = doc.nodes(node => node.tag === 'span' && node.attrs['data-hs-cos-type'] === 'rich_text', mains[0])
    .filter(node => !doc.nodes(child => doc.hasClass(child, 'job-sidebar'), node).length)
  proof(blocks.length && blocks.some(node => /Duties and Responsibilities/.test(doc.text(node)))
    && blocks.some(node => /Requirements/.test(doc.text(node))), 'native full responsibilities or requirements absent')
  const projections = blocks.map(node => projectNativeCriteria(doc.inner(node))), criteria = projections.map(value => value.text).filter(Boolean).join('\n\n')
  const links = doc.nodes(node => node.tag === 'a' && /^mailto:[\w.+-]+@accionlabs\.com$/i.test(node.attrs.href || ''), mains[0])
  proof(links.length === 1, 'native same-company application identity absent or ambiguous')
  const country = nativeCountryName(fields.get('Country'))
  const description = [criteria, ...[...fields].map(([key, value]) => key + ': ' + value)].join('\n\n')
  const complete = projections.every(value => value.complete) && hasSourceDescription({ jobDescription: criteria })
  return { source: 'accionlabs', company: 'Accion Labs', companyDomain: 'accionlabs.com', title: doc.text(titles[0]),
    legalEmployer: fields.get('Company'), jobId: null, requisitionId: null, sourceUrl: url, link: url, applyUrl: url,
    nativeApplicationUrl: links[0].attrs.href, nativeCountryScope: scope, country,
    sourceCountryEvidence: country ? { field: 'position-card.Country', raw: fields.get('Country'), country, inference: false } : null,
    location: fields.get('Location'), city: null, employmentType: fields.get('Employment type') || null,
    jobDescription: description, sourceDescription: description, nativeCriteriaHtml: blocks.map(node => doc.inner(node)),
    sourceAdditionalCriteria: Object.fromEntries(fields), postingDate: null, postedAt: null, closingDate: null,
    sourceDetailComplete: complete, sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false }
}

export async function readCurrentAccionRoles({ careersHtml, read, signal, now = () => new Date().toISOString(), onAudit }) {
  const links = opportunityLinks(careersHtml), native = [...links].filter(([url]) => !['/us-opportunities', '/prague-engineering-center'].includes(new URL(url).pathname))
  if (!native.length) return null
  const records = []
  for (const [url, scope] of native) {
    const page = await read(url)
    proof(page.status === 200 && (page.finalUrl || page.url) === url, 'current role response identity changed')
    records.push(parseNativeRole(page.text, url, scope))
  }
  const prague = await read(ORIGIN + '/prague-engineering-center')
  proof(prague.status === 200 && (prague.finalUrl || prague.url) === ORIGIN + '/prague-engineering-center'
    && /Prague Engineering Center/.test(prague.text), 'current Prague scope changed')
  const closing = await read(ORIGIN + '/careers')
  proof(closing.status === 200 && (closing.finalUrl || closing.url) === ORIGIN + '/careers', 'closing employer response identity changed')
  const reasons = ['published-native-roles-and-cv-intake-do-not-prove-whole-company-inventory']
  if (sha([...opportunityLinks(closing.text)]) !== sha([...links])) reasons.push('closing-recruiting-handoffs-changed')
  for (let index = 0; index < records.length; index++) {
    const [url, scope] = native[index], page = await read(url)
    proof(page.status === 200 && (page.finalUrl || page.url) === url, 'closing role response identity changed')
    if (sha(parseNativeRole(page.text, url, scope)) !== sha(records[index])) reasons.push('closing-native-criteria-changed')
  }
  if (records.some(row => !row.country)) reasons.push('native-role-country-not-typed')
  if (records.some(row => !row.sourceDetailComplete)) reasons.push('native-public-criteria-rendering-incomplete')
  const jobs = records.filter(row => row.country === 'India' && row.sourceDetailComplete)
  const stamp = now(), evidence = { status: 'coverage-gap', surface: ORIGIN + '/careers', firstParty: true,
    listingComplete: false, reportedTotal: null, indiaFacetCount: null, pagesFetched: 4 + records.length * 2,
    verifiedAt: stamp, reason: [...new Set(reasons)].join(';') }
  for (const job of jobs) job.scrapedAt = stamp
  attachInventoryEvidence(jobs, evidence)
  attachSourceObservationEvidence(jobs, { source: 'accionlabs', recordKind: 'vacancy-rows', observedRecordCount: records.length,
    observedVacancyCount: records.length, sourceScopeComplete: false })
  await onAudit?.({ source: 'accionlabs', nativeRecords: records, pragueObservationKind: 'role-areas-and-spontaneous-application',
    sourceScopeComplete: false, inventoryEvidence: evidence, productionWrites: false })
  signal?.throwIfAborted()
  return jobs
}
