import { countryName, plainHTML, normalizeText, postingDate, unknownGeography } from './jobPostingData.js'

export const readSmartCollection = async (io, initial, { fresh = false } = {}) => {
  const records = [], pages = [], seen = new Set()
  let url = initial, total = null, complete = true
  while (url && pages.length < 1000) {
    if (seen.has(url)) { complete = false;io.issue('native-API-pagination-loop', { url });break }
    seen.add(url)
    const page = await io.load(url, { kind: 'json', fresh }), data = io.json(page)
    pages.push(page)
    if (!Array.isArray(data?.content)) { complete = false;io.issue('native-API-content-unavailable', { url });break }
    records.push(...data.content)
    if (!Number.isSafeInteger(data.totalFound) || data.totalFound < 0 || total !== null && total !== data.totalFound) complete = false
    if (total === null && Number.isSafeInteger(data.totalFound)) total = data.totalFound
    if (total === null || records.length >= total) break
    if (!Number.isSafeInteger(data.offset) || !Number.isSafeInteger(data.limit) || data.limit < 1 || data.content.length < 1) {
      complete = false;io.issue('native-API-pagination-unqualified', { url });break
    }
    const next = new URL(initial);next.searchParams.set('offset', String(data.offset + data.limit));url = next.href
  }
  const ids = records.map(record => record?.id), duplicateIDs = ids.filter((id, index) => ids.indexOf(id) !== index)
  if (duplicateIDs.length) { complete = false;io.issue('native-API-duplicate-IDs', { ids: duplicateIDs }) }
  complete = complete && total !== null && records.length === total && pages.every(page => page?.transportQualified && page.usable)
  return { records, pagesFetched: pages.length, reportedNativeTotal: total, complete }
}

const countryFrom = record => {
  const rawCode = record?.location?.country, code = countryName(rawCode)
  const last = normalizeText(record?.location?.fullLocation).split(',').at(-1)?.trim()
  const literalName = /^(?:India|United States(?: of America)?|Canada|United Kingdom)$/i.test(last || '') ? countryName(last) : null
  if (rawCode && !code || code && literalName && code !== literalName) return null
  return code || literalName
}
export const smartObservation = async (io, index, { companyID, companyName, source, boardURL, fresh = false }) => {
  if (!index || !/^\d+$/.test(String(index.id || '')) || !normalizeText(index.name)) {
    io.issue('native-API-record-unqualified', { id: index?.id ?? null });return null
  }
  let detail = null
  if (typeof index.ref === 'string') {
    try {
      const ref = new URL(index.ref)
      if (ref.origin === 'https://api.smartrecruiters.com' && ref.pathname === `/v1/companies/${companyID}/postings/${index.id}` && !ref.search) detail = io.json(await io.load(ref.href, { kind: 'json', fresh }))
      else io.issue('native-API-detail-ref-unqualified', { id: index.id, ref: index.ref })
    } catch { io.issue('native-API-detail-ref-unqualified', { id: index.id, ref: index.ref }) }
  }
  const indexCompanyOK = !index.company?.identifier || index.company.identifier === companyID
  const detailOK = detail && String(detail.id) === String(index.id) && normalizeText(detail.name) === normalizeText(index.name)
    && (!detail.company?.identifier || detail.company.identifier === companyID) && indexCompanyOK
  const data = detailOK ? detail : index
  const descriptions = []
  if (detailOK && detail.jobAd?.sections && typeof detail.jobAd.sections === 'object') {
    for (const [name, section] of Object.entries(detail.jobAd.sections)) {
      if (typeof section?.text === 'string') {
        try { descriptions.push([normalizeText(section.title || name), plainHTML(section.text)].filter(Boolean).join(' ')) }
        catch { io.issue('native-API-criteria-section-unqualified', { id: index.id, section: name }) }
      }
    }
  }
  let country = indexCompanyOK ? countryFrom(data) : null
  const openingCountry = countryFrom(index)
  if (detail && !detailOK || openingCountry && country && openingCountry !== country) country = null
  const geo = country ? { country, city: normalizeText(data.location?.city) || null, state: normalizeText(data.location?.region) || null,
    location: normalizeText(data.location?.fullLocation) || [data.location?.city, data.location?.region, country].filter(Boolean).join(', '),
    countries: [country], unresolved: false } : unknownGeography()
  let roleURL = null, applyURL = null
  for (const [key, value] of [['role', data.postingUrl], ['apply', data.applyUrl]]) {
    try {
      const url = new URL(value)
      if (url.protocol === 'https:' && !url.username && !url.password && ['jobs.smartrecruiters.com', 'careers.smartrecruiters.com'].includes(url.hostname)) {
        if (key === 'role') roleURL = url.href;else applyURL = url.href
      }
    } catch {}
  }
  const description = descriptions.join(' ').trim() || null
  return { title: normalizeText(data.name), company: companyName, source, jobId: String(index.id), requisitionId: typeof data.refNumber === 'string' ? data.refNumber || null : null,
    sourceUrl: roleURL || boardURL, applyUrl: applyURL || roleURL || boardURL, applicationUrlIsGeneric: !applyURL && !roleURL,
    country: geo.country, city: geo.city, state: geo.state, location: geo.location, locations: geo.location ? [geo.location] : [],
    sourceNativeCountryCodes: geo.countries, sourceCountryScopeUnresolved: geo.unresolved,
    department: normalizeText(data.department?.label) || null, employmentType: normalizeText(data.typeOfEmployment?.label) || null,
    experienceRequired: normalizeText(data.experienceLevel?.label) || null, minimumQualification: null, preferredQualification: null, requiredSkills: [],
    postingDate: postingDate(data.releasedDate), closingDate: null, jobDescription: description, sourceDescription: description,
    sourceNativePlatform: 'smartrecruiters', sourceNativeAPIIndexRecord: index, sourceNativeJobPosting: detail ?? null,
    sourceNativeRoleDetail: { bound: Boolean(detailOK), issues: detailOK ? [] : ['native-detail-unqualified-or-unavailable'] },
    sourceNativeApplication: { activationVerified: false, allControlsQualified: false }, sourceCompanyScopeUnresolved: !indexCompanyOK,
    sourceDetailComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false }
}

// Retain every known positive across both snapshots. A missing closing record
// is not a withdrawal signal. New/changed records get a current observation;
// changed records must not reuse the opening detail cache. Both original
// collections and all original detail responses remain in the source audit.
export const reconcileSmartObservations = async (io, collection, observations, context, { fresh = false } = {}) => {
  for (const record of collection.records) {
    const at = observations.findIndex(job => job.sourceNativePlatform === 'smartrecruiters' && job.jobId === String(record?.id))
    if (at >= 0 && JSON.stringify(observations[at].sourceNativeAPIIndexRecord) === JSON.stringify(record)) continue
    const observation = await smartObservation(io, record, { ...context, fresh })
    if (observation) {
      if (at >= 0) observations[at] = observation
      else observations.push(observation)
    }
  }
}
