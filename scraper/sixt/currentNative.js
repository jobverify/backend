import { activeHead } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { recruitmentJobPostings } from '../../scraper-support/utils/verifiedRecruitment.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const origin = 'https://www.sixt.jobs'
const listUrl = origin + '/in/jobs?q=&country=IN'
const insist = (condition, reason) => {
  if (!condition) throw Object.assign(new Error('SIXT current ' + reason), { abortRetries: true })
}
const key = value => String(value).normalize('NFKC').replace(/\s/g, '')
const roleUrl = (value, id, apply = false) => {
  try {
    const url = new URL(value, origin)
    return url.origin === origin && !url.username && !url.password && !url.search && !url.hash
      && new RegExp('^/(?:in|en)/jobs/' + id + (apply ? '/apply' : '') + '/?$').test(url.pathname)
      ? url.href : null
  } catch { return null }
}

export function readCurrentSixtRole(page, listing, observedAt) {
  const doc = readVisibleNativeDocument(page.html, { strict: true })
  const postings = recruitmentJobPostings(doc)
  if (!postings.length) return null
  insist(postings.length === 1, 'native role declaration is ambiguous')
  const row = postings[0], headings = doc.nodes(node => node.tag === 'h1').map(doc.text)
  const address = row.jobLocation?.address
  insist(page.status === 200 && roleUrl(page.url, listing.jobId) && roleUrl(row.url, listing.jobId)
    && row.title === listing.title && headings.length === 1 && headings[0] === row.title
    && activeHead(page.html).titles[0] === row.title + ' | SIXT Jobs', 'native page or role identity changed')
  insist(row.hiringOrganization?.name === 'SIXT India' && row.identifier?.name === 'SIXT India'
    && /^REF\d+[A-Z]$/.test(row.identifier?.value || '') && row.directApply === true,
  'native employer or requisition identity changed')
  insist(!Array.isArray(row.jobLocation) && address && /^(?:India|IN)$/i.test(address.addressCountry)
    && typeof address.addressLocality === 'string' && address.addressLocality.trim(), 'native country scope is unverified')
  const root = doc.nodes(node => node.tag === 'root')[0]
  insist(typeof row.description === 'string' && row.description.length >= 1000
    && key(doc.text(root)).includes(key(row.description)), 'full native criteria are missing or not visible')
  insist(typeof row.datePosted === 'string' && Number.isFinite(Date.parse(row.datePosted))
    && typeof row.employmentType === 'string' && row.employmentType.trim(), 'native date or employment type is unavailable')
  insist(!row.validThrough || Number.isFinite(Date.parse(row.validThrough))
    && Date.parse(row.validThrough) >= Date.parse(observedAt), 'native role has expired or invalid closing date')
  for (const canonical of doc.nodes(node => node.tag === 'link' && (node.attrs.rel || '').split(/\s+/).includes('canonical'))) {
    insist(roleUrl(canonical.attrs.href, listing.jobId), 'native canonical authority changed')
  }
  const apply = [...new Set(doc.nodes(node => node.tag === 'a' && /^Apply now$/i.test(doc.text(node)))
    .map(node => roleUrl(node.attrs.href, listing.jobId, true)).filter(Boolean))]
  insist(apply.length === 1, 'active native application handoff changed')
  return {
    title: row.title, company: 'Sixt', source: 'sixt', jobId: listing.jobId, requisitionId: row.identifier.value,
    location: [address.addressLocality, address.addressRegion, 'India'].filter(Boolean).join(', '),
    city: address.addressLocality, state: address.addressRegion || null, country: 'India',
    sourceUrl: listing.sourceUrl, applyUrl: apply[0], link: apply[0],
    jobDescription: row.description, employmentType: row.employmentType === 'FULL_TIME' ? 'Full-time' : row.employmentType,
    sourceNativeEmploymentType: row.employmentType, postingDate: row.datePosted, closingDate: row.validThrough || null,
    minimumQualification: null, preferredQualification: null, requiredSkills: [], experienceRequired: null,
    sourceDetailComplete: true, sourceScopeComplete: false, lifecycleCleanupAllowed: false, scrapedAt: observedAt,
  }
}

function readListing(page) {
  insist(page.status === 200 && page.url === listUrl
    && activeHead(page.html).titles[0] === 'All Jobs | SIXT Jobs', 'India list authority changed')
  const doc = readVisibleNativeDocument(page.html, { strict: true }), rows = new Map()
  for (const node of doc.nodes(node => node.tag === 'a' && node.attrs.href)) {
    let url
    try { url = new URL(node.attrs.href, listUrl) } catch { continue }
    const id = url.origin === origin && !url.search && !url.hash
      && url.pathname.match(/^\/in\/jobs\/([a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12})$/i)?.[1]
    const title = doc.text(node)
    if (!id || !title || /^View$/i.test(title)) continue
    insist(!rows.has(id) || rows.get(id).title === title, 'native list role identity is contradictory')
    rows.set(id, { jobId: id, title, sourceUrl: url.href })
  }
  const counts = doc.nodes(node => node.tag === 'h2').map(doc.text)
    .map(value => value.match(/^(\d+) jobs? located in India\.?$/i)).filter(Boolean)
  insist(rows.size > 0 && rows.size <= 200 && counts.length === 1
    && Number.isSafeInteger(Number(counts[0][1])) && Number(counts[0][1]) >= rows.size,
  'native India count or listing contract changed')
  return { rows: [...rows.values()], total: Number(counts[0][1]),
    signature: JSON.stringify([...rows.values()].map(row => [row.jobId, row.title]).sort((a, b) => a[0].localeCompare(b[0]))) }
}

export async function collectCurrentSixt({ listPage, firstPage, readPage, maxJobs, now, signal }) {
  const opening = readListing(listPage), observedAt = now()
  const capped = Number.isInteger(maxJobs) && maxJobs >= 0 && maxJobs < opening.rows.length
  const selected = capped ? opening.rows.slice(0, maxJobs) : opening.rows, jobs = []
  for (const listing of selected) {
    signal?.throwIfAborted()
    const page = listing.sourceUrl === firstPage.url ? firstPage : await readPage(listing.sourceUrl)
    const job = readCurrentSixtRole(page, listing, observedAt)
    insist(job, 'native structured role is missing')
    jobs.push(job)
  }
  const closing = readListing(await readPage(listUrl))
  insist(closing.signature === opening.signature && closing.total === opening.total, 'closing India inventory changed')
  signal?.throwIfAborted()
  const complete = !capped && opening.total === opening.rows.length
  for (const job of jobs) job.sourceListingComplete = complete
  return attachInventoryEvidence(jobs, {
    status: complete ? 'complete-inventory' : 'discovery-only', firstParty: true, listingComplete: complete,
    surface: listUrl, pagesFetched: 2 + selected.length, reportedTotal: opening.total,
    indiaFacetCount: opening.total, verifiedAt: observedAt,
    reason: complete ? 'sixt-current-native-india-count-full-role-criteria-and-closing-list'
      : capped ? 'sixt-current-native-india-inventory:source-job-limit' : 'sixt-current-native-pagination-unqualified',
  })
}
