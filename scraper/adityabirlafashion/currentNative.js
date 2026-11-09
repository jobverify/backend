import { createHash } from 'node:crypto'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { publicPayloads, mapBirlaRole } from '../adityabirlagroup/nativeJobs.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const ORIGIN = 'https://careers.adityabirla.com'
const proof = (value, message) => { if (!value) throw new Error('ABFRL native: ' + message) }
const signature = rows => createHash('sha256').update(JSON.stringify(rows)).digest('hex')
const binding = row => [row.legalEmployer, row.legalEmployerName, row.companyName].some(value =>
  typeof value === 'string' && /^(?:ABFRL|Aditya Birla Fashion (?:and|&) Retail (?:Limited|Ltd\.?))$/i.test(value.trim()))

export async function readFashionNative({ read, searchHtml, sectorHtml, storeManagerStatus, signal, now = () => new Date().toISOString(), maxJobs = Infinity, onAudit }) {
  const tokens = new Set(publicPayloads(searchHtml).flatMap(value => [...value.matchAll(/"token":"([\w.-]{32,4096})"/g)].map(match => match[1])))
  proof(tokens.size === 1, 'current anonymous public recruiting protocol unavailable; an SSR zero is not vacancy evidence')
  const doc = document(sectorHtml), clients = doc.nodes(node => node.tag === 'script' && /^\/_next\/static\/chunks\/app\/(?:%5Bbusiness%5D|\[business\])\/page-[\w-]+\.js$/.test(node.attrs.src || ''))
  proof(clients.length === 1, 'current anonymous public recruiting client missing or ambiguous')
  const client = await read(new URL(clients[0].attrs.src, ORIGIN).href)
  proof(['/api/v3/jobs?orgunit=', 'encodeURIComponent(e.content.apiKey)', '&offset=', '&limit=', 'totalJobs', 'Authorization:"Bearer "'].every(value => client.includes(value)), 'current public sector pagination protocol changed')
  proof(publicPayloads(sectorHtml).some(value => /"apiKey":"Fashion (?:&|\\u0026) Retail"/.test(value)), 'native sector key does not bind Fashion and Retail')
  const options = { headers: { Authorization: 'Bearer ' + [...tokens][0] } }
  let pagesFetched = 0
  const traverse = async () => {
    const records = [], seen = new Set(); let total = null
    for (let page = 0; page <= 5000; page++) {
      const url = ORIGIN + '/api/v3/jobs?orgunit=Fashion+%26+Retail&offset=' + page + '&limit=20'
      const body = JSON.parse(await read(url, options)); pagesFetched++
      proof(body?.status === 200 && Number.isSafeInteger(body.totalJobs) && body.totalJobs >= 0 && body.totalJobs <= 100000
        && Array.isArray(body.data) && body.count === body.data.length, 'native sector page count or envelope changed')
      if (total == null) total = body.totalJobs
      proof(body.totalJobs === total && body.data.length === Math.max(0, Math.min(20, total - page * 20)), 'native sector page count or reported total changed')
      for (const row of body.data) {
        proof(/^ABG\d+$/.test(row.jobCode || '') && !seen.has(row.jobCode) && row.organizationUnit === 'Fashion & Retail'
          && typeof row.organizationUnitComplete === 'string' && typeof row.jobDescription === 'string', 'native sector role or business identity changed')
        seen.add(row.jobCode); records.push(row)
      }
      if (body.data.length === 0) { proof(records.length === total, 'native sector terminal count changed'); return records }
    }
    throw new Error('ABFRL native: sector pagination exceeded bound')
  }
  const records = await traverse(), closing = await traverse(), closingMatches = signature(records) === signature(closing)
  const bound = records.filter(binding), unbound = records.filter(row => !binding(row))
  const mapped = bound.map(row => ({ ...mapBirlaRole(row), source: 'adityabirlafashion', company: 'Aditya Birla Fashion', companyDomain: 'abfrl.com',
    companyCareerPage: 'https://www.abfrl.com/careers/', legalEmployer: row.legalEmployer || row.legalEmployerName || row.companyName }))
  const jobs = mapped.filter(row => row.country === 'India' && row.sourceDetailComplete).slice(0, maxJobs)
  const reasons = ['current-sector-label-does-not-prove-whole-ABFRL-employer-inventory']
  if (unbound.length) reasons.push('native-sector-employer-unbound-including-transferred-brand-hierarchies')
  if (storeManagerStatus === 404) reasons.push('separately-published-store-manager-handoff-unavailable-404')
  if (!closingMatches) reasons.push('closing-sector-records-or-criteria-changed')
  if (mapped.some(row => !row.sourceDetailComplete)) reasons.push('native-public-criteria-rendering-incomplete')
  if (mapped.some(row => !row.country)) reasons.push('native-country-unresolved')
  const stamp = now(), evidence = { status: 'coverage-gap', surface: ORIGIN + '/fashion-retail', firstParty: true,
    listingComplete: false, reportedTotal: null, indiaFacetCount: null, pagesFetched: pagesFetched + 4, verifiedAt: stamp, reason: reasons.join(';') }
  for (const job of jobs) job.scrapedAt = stamp
  attachInventoryEvidence(jobs, evidence)
  attachSourceObservationEvidence(jobs, { source: 'adityabirlafashion', recordKind: bound.length ? 'mixed' : 'hiring-signals',
    observedRecordCount: bound.length + 2, observedVacancyCount: bound.length, sourceScopeComplete: false })
  await onAudit?.({ source: 'adityabirlafashion', delegatedSectorRecords: records, delegatedSectorTotal: records.length,
    delegatedSectorIsCompanyInventory: false, unboundEmployerIds: unbound.map(row => row.jobCode), nativeBoundRecords: bound,
    storeManagerStatus, closingMatches, inventoryEvidence: evidence, productionWrites: false })
  signal?.throwIfAborted()
  return jobs
}
