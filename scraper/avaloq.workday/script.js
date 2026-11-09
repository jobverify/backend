import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchSmartRecruitersDetail } from '../../scraper-support/apiPortal/smartRecruitersDetail.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "avaloq"
export const COMPANY = "Avaloq"
export const CAREERS_URL = 'https://www.avaloq.com/careers'
export const NATIVE_LISTING_URL = 'https://api.smartrecruiters.com/v1/companies/Avaloq1/postings'
const requireNative = (value, message) => { if (!value) throw new Error(`Avaloq native contract: ${message}`) }
const text = value => typeof value === 'string' ? value.trim() : ''
const regions = new Intl.DisplayNames(['en'], { type: 'region' })
const validPayload = p => p && typeof p === 'object' && !Array.isArray(p) && !p.error && p.success !== false && !(Array.isArray(p.errors) && p.errors.length)

function indiaScope(location) {
  requireNative(location && typeof location === 'object' && !Array.isArray(location), 'location missing')
  for (const key of ['country', 'city', 'fullLocation']) requireNative(typeof location[key] === 'string' && text(location[key]), 'native location text missing')
  const code = text(location.country).toUpperCase()
  requireNative(/^[A-Z]{2}$/.test(code) && !['ZZ', 'EU', 'UN', 'XA', 'XB', 'QO'].includes(code) && regions.of(code) !== code, 'unknown native country')
  if (code === 'IN') requireNative(/,\s*India$/i.test(location.fullLocation) && text(location.fullLocation.split(',')[0]) === text(location.city), 'India location conflict')
  else requireNative(!/,\s*India$/i.test(location.fullLocation), 'foreign location conflict')
  return code === 'IN'
}

function publicUrl(value, id) {
  let url
  try { url = new URL(value) } catch { requireNative(false, 'public URL missing') }
  requireNative(url.origin === 'https://jobs.smartrecruiters.com' && !url.username && !url.password && !url.hash
    && new RegExp(`^/Avaloq1/${id}(?:-[^/]+)?/?$`).test(url.pathname), 'native public URL identity mismatch')
  return url.href
}

export async function run({ fetchJson, signal } = {}) {
  const get = fetchJson || (async url => {
    const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) })
    requireNative(response.ok && response.url === url, 'native HTTP failure or unexpected redirect')
    return response.json()
  })
  const records = [], seen = new Set()
  let total = null, pages = 0
  while (total == null || records.length < total) {
    signal?.throwIfAborted()
    const offset = records.length
    const payload = await get(`${NATIVE_LISTING_URL}?limit=100&offset=${offset}`)
    requireNative(validPayload(payload) && Array.isArray(payload.content), 'upstream listing error')
    requireNative(Number.isSafeInteger(payload.totalFound) && payload.totalFound >= 0 && payload.totalFound <= 10000
      && payload.offset === offset && payload.limit === 100, 'native count/page metadata unavailable')
    if (total == null) total = payload.totalFound
    requireNative(total === payload.totalFound && payload.content.length === Math.min(100, total - offset), 'unstable total or incomplete page')
    for (const row of payload.content) {
      requireNative(typeof row?.id === 'string' && /^[1-9]\d*$/.test(row.id) && Number.isSafeInteger(Number(row.id)) && !seen.has(row.id) && text(row.name)
        && row.company?.identifier === 'Avaloq1' && row.company.name === 'Avaloq', 'native listing identity mismatch')
      requireNative(row.ref === `${NATIVE_LISTING_URL}/${row.id}`, 'native detail reference mismatch')
      requireNative(['PUBLIC', 'PRIVATE', 'INTERNAL'].includes(row.visibility), 'unknown public status')
      indiaScope(row.location)
      seen.add(row.id); records.push(row)
    }
    pages++
    if (!total) break
  }
  const selected = records.filter(row => row.visibility === 'PUBLIC' && indiaScope(row.location))
  const jobs = new Array(selected.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(4, selected.length) }, async () => {
    for (;;) {
      const index = next++; if (index >= selected.length) return
      signal?.throwIfAborted()
      const row = selected[index], detail = await get(row.ref)
      requireNative(validPayload(detail) && detail.id === row.id && text(detail.name) === text(row.name)
        && detail.company?.identifier === 'Avaloq1' && detail.company.name === 'Avaloq' && detail.visibility === 'PUBLIC', 'native detail identity mismatch')
      requireNative(indiaScope(detail.location) && text(detail.location.city) === text(row.location.city)
        && text(detail.location.fullLocation) === text(row.location.fullLocation), 'native detail geography mismatch')
      const sourceUrl = publicUrl(detail.postingUrl, row.id), applyUrl = publicUrl(detail.applyUrl, row.id)
      const contentAvailable = hasSourceDescription({ jobDescription: detail.jobAd?.sections?.jobDescription?.text })
      // Reuse native identity/geography/content validation without another GET.
      // Empty content stays explicit after the detail identity has been checked.
      const content = contentAvailable ? await fetchSmartRecruitersDetail({ publicUrl: sourceUrl, expectedCompany: 'Avaloq1',
        expectedCountry: 'in', expectedLocation: row.location.city, fetchJson: async url => {
          requireNative(url === row.ref, 'detail replay reference mismatch'); return detail
        } }) : { jobDescription: null, minimumQualification: null }
      requireNative(typeof row.releasedDate === 'string' && Number.isFinite(Date.parse(row.releasedDate)), 'native posting date missing')
      jobs[index] = { title: text(row.name), company: COMPANY, source: SOURCE, jobId: row.id,
        requisitionId: text(row.refNumber) || row.id, location: row.location.fullLocation, city: row.location.city, country: 'India',
        sourceUrl, applyUrl, department: text(row.department?.label) || null, employmentType: text(row.typeOfEmployment?.label) || null,
        postingDate: new Date(row.releasedDate).toISOString(), closingDate: null, ...content,
        sourceDetailComplete: contentAvailable, ...(!contentAvailable ? { sourceDetailFailureKind: 'missing-content' } : {}) }
    }
  }))
  const complete = jobs.every(job => job.sourceDetailComplete)
  if (!complete) for (const job of jobs) job.sourceListingComplete = false
  return attachInventoryEvidence(jobs, { status: complete ? total === 0 ? 'verified-empty' : 'complete-inventory' : 'coverage-gap',
    firstParty: true, listingComplete: complete, surface: NATIVE_LISTING_URL, reportedTotal: total,
    indiaFacetCount: jobs.length, pagesFetched: pages, verifiedAt: new Date().toISOString(),
    reason: complete ? 'native-smartrecruiters-stable-total-all-pages' : 'native-smartrecruiters-required-descriptions-incomplete' })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
