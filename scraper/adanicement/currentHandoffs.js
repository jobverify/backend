import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { attachSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const BUSINESS_URL = 'https://www.adani.com/businesses/materials/cement'
const PORTAL_URL = 'https://careers.adani.com/'
const proof = (value, message) => { if (!value) throw new Error('Adani Cement current: ' + message) }
const trusted = new Map([
  ['https://www.ambujacement.com/', /Ambuja Cements Limited/],
  ['https://www.acclimited.com/', /ACC Limited/],
  ['https://orientcement.com/', /Orient Cement/],
])

export async function inspectCurrentCementHandoffs({ read, signal, onAudit, now = () => new Date().toISOString() }) {
  const html = await read(BUSINESS_URL), doc = document(html), body = doc.text(doc.root)
  proof(/Cement/.test(body) && /Ambuja/.test(body) && /ACC/.test(body) && /Orient/.test(body), 'corporate Cement subsidiary identity changed')
  const delegated = new Set(doc.nodes(node => node.tag === 'a' && trusted.has(node.attrs.href)).map(node => node.attrs.href))
  proof(delegated.size === trusted.size, 'corporate Cement subsidiary handoffs absent or changed')
  const subsidiaryHandoffs = []
  for (const url of delegated) {
    const page = await read(url), child = document(page)
    proof(trusted.get(url).test(child.text(child.root)), 'native subsidiary company identity changed')
    const links = [...new Set(child.nodes(node => node.tag === 'a' && /^Careers$/i.test(child.text(node))).map(node => new URL(node.attrs.href, url).href))]
    proof(links.every(link => link === PORTAL_URL), 'new subsidiary recruiting handoff requires a reviewed native employer collector')
    subsidiaryHandoffs.push({ companyUrl: url, careersUrl: links[0] || null, vacancyCount: null, sourceScopeComplete: false })
  }
  const portalHtml = await read(PORTAL_URL), portal = document(portalHtml)
  proof(/Adani Group/.test(portal.text(portal.root)), 'delegated native group employer identity changed')
  const groupHandoffs = [...new Set(portal.nodes(node => node.tag === 'a' && /^https:\/\/www\.adani\.com\/opportunity\/#en\/sites\/CX_\d+\/requisitions$/.test(node.attrs.href || '')).map(node => node.attrs.href))]
  proof(groupHandoffs.length, 'delegated group public recruiting routes absent')
  // These are group routes, not typed Cement vacancies. A business navigation
  // link and a shared tenant cannot assign the parent's jobs to its subsidiary.
  const jobs = [], evidence = { status: 'coverage-gap', surface: BUSINESS_URL, firstParty: true,
    listingComplete: false, reportedTotal: null, indiaFacetCount: null, pagesFetched: 6, verifiedAt: now(),
    reason: 'current-subsidiaries-delegate-to-group-recruiting-without-native-Cement-employer-inventory-binding;Orient-recruiting-handoff-not-published' }
  attachInventoryEvidence(jobs, evidence)
  attachSourceObservationEvidence(jobs, { source: 'adanicement', recordKind: 'hiring-signals',
    observedRecordCount: subsidiaryHandoffs.filter(row => row.careersUrl).length, observedVacancyCount: 0, sourceScopeComplete: false })
  await onAudit?.({ source: 'adanicement', subsidiaryHandoffs, delegatedGroupHandoffs: groupHandoffs,
    delegatedGroupIsCementInventory: false, inventoryEvidence: evidence, productionWrites: false })
  signal?.throwIfAborted()
  return jobs
}
