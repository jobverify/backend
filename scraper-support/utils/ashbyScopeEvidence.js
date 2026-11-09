import { createHash } from 'node:crypto'
import { readNativeDocument } from './activeNativeHtml.js'
import { readAppData } from '../shared/ashbyPairNative20261027.js'

const text = value => typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
const us = value => /^(?:US|USA|United States(?: of America)?)$/i.test(text(value))
const postal = location => location?.address?.postalAddress || location?.address || {}
const remoteTier = value => /^Remote\s*-\s*Tier\s+\d+$/i.test(text(value))
const emptyPostalCountry = location => postal(location).addressCountry == null
  && Object.entries(postal(location)).every(([field, value]) => field === '@type' || value == null || value === '')
const sameLabels = (left, right) => Array.isArray(left) && Array.isArray(right)
  && left.length === right.length && JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
const readActiveAppData = document => {
  const scripts = document.nodes(node => node.tag === 'script' && !node.attrs.src && !Object.hasOwn(node.attrs, 'nomodule')
    && /^(?:|module|(?:text|application)\/javascript)$/i.test(node.attrs.type || '')
    && /window\.__appData\s*=/.test(node.raw || ''))
  if (scripts.length !== 1) throw new Error('native-role-app-data-unavailable')
  return readAppData(scripts[0].raw)
}

// Some Ashby remote compensation tiers omit secondary postal countries. A
// role-wide native applicant-location requirement can resolve those omissions;
// the primary country's presence alone cannot. This opt-in audit is US-only.
export const reconcileAshbyUsRemoteScope = async (payload, provider, { fetchPage, signal } = {}) => {
  const proofs = [], failures = []
  let pagesFetched = 0
  if (payload?.apiVersion !== '1' || !Array.isArray(payload.jobs)) return { payload, proofs, failures, pagesFetched }
  const records = [...payload.jobs]
  let checked = 0
  for (let index = 0; index < records.length; index++) {
    signal?.throwIfAborted()
    const row = records[index]
    if (!row || row.isListed !== true || row.workplaceType !== 'Remote' || !remoteTier(row.location)
      || !us(postal(row).addressCountry) || !Array.isArray(row.secondaryLocations) || !row.secondaryLocations.length
      || !row.secondaryLocations.some(location => postal(location).addressCountry == null)
      || row.secondaryLocations.some(location => !remoteTier(location?.location)
        || (postal(location).addressCountry != null ? !us(postal(location).addressCountry) : !emptyPostalCountry(location)))) continue
    if (checked >= 8) break
    const expectedUrl = `https://jobs.ashbyhq.com/${encodeURIComponent(provider.boardToken)}/${encodeURIComponent(row.id)}`
    if (typeof row.id !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,255}$/i.test(row.id)
      || row.jobUrl !== expectedUrl || row.applyUrl !== `${expectedUrl}/application`
      || !text(row.descriptionHtml)) continue
    checked++
    try {
      const response = await fetchPage(expectedUrl, { signal })
      signal?.throwIfAborted()
      pagesFetched++
      if (response?.status !== 200 || response.url !== expectedUrl || typeof response.html !== 'string'
        || Buffer.byteLength(response.html, 'utf8') > 3000000) throw new Error('native-role-response-unavailable')
      const document = readNativeDocument(response.html)
      const app = readActiveAppData(document)
      const posting = app?.posting
      if (app?.organization?.hostedJobsPageSlug !== provider.boardToken || posting?.id !== row.id
        || posting.isListed !== true || posting.isConfidential === true || posting.workplaceType !== 'Remote'
        || (posting.locationAddress != null && !us((posting.locationAddress.postalAddress || posting.locationAddress).addressCountry))
        || text(posting.title) !== text(row.title) || text(posting.locationName) !== text(row.location)
        || !sameLabels(posting.secondaryLocationNames, row.secondaryLocations.map(location => location.location))
        || text(posting.descriptionHtml) !== text(row.descriptionHtml)) throw new Error('native-role-state-not-reconciled')
      const schemas = document.nodes(node => node.tag === 'script' && !node.attrs.src
        && /^application\/ld\+json$/i.test(node.attrs.type || '')).flatMap(node => {
        const data = JSON.parse(node.raw || '')
        return Array.isArray(data) ? data : Array.isArray(data?.['@graph']) ? data['@graph'] : [data]
      }).filter(schema => schema?.['@type'] === 'JobPosting')
      if (schemas.length !== 1) throw new Error('native-role-schema-unavailable')
      const schema = schemas[0]
      const applicant = schema.applicantLocationRequirements
      const addresses = Array.isArray(schema.jobLocation) ? schema.jobLocation : [schema.jobLocation]
      if (schema.identifier?.value !== row.id || text(schema.title) !== text(row.title)
        || text(schema.description) !== text(row.descriptionHtml) || schema.jobLocationType !== 'TELECOMMUTE'
        || applicant?.['@type'] !== 'Country' || !us(applicant.name)
        || !addresses.length || addresses.some(location => location?.['@type'] !== 'Place'
          || !us(location.address?.addressCountry))) throw new Error('native-role-us-applicant-scope-unavailable')
      const proof = { jobId: row.id, url: expectedUrl, country: 'United States',
        method: 'native-remote-applicant-location-requirement', applicantCountry: applicant.name,
        sha256: createHash('sha256').update(response.html).digest('hex'), verifiedAt: new Date().toISOString(),
        originalSecondaryLocations: row.secondaryLocations }
      proofs.push(proof)
      records[index] = { ...row, secondaryLocations: row.secondaryLocations.map(location => {
        if (postal(location).addressCountry != null) return location
        return { ...location,
          address: { ...(location.address || {}), postalAddress: { ...postal(location), addressCountry: applicant.name } },
          countryScopeEvidence: { jobId: row.id, method: proof.method, url: expectedUrl, sha256: proof.sha256,
            originalAddressCountry: null },
        }
      }) }
    } catch (error) {
      signal?.throwIfAborted()
      failures.push({ jobId: row.id, reason: error.message })
    }
  }
  return { payload: { ...payload, jobs: records }, proofs, failures, pagesFetched }
}

// Only missing IDs advertised by a currently verified full-board handoff are
// eligible. A blank/error response is insufficient: require Ashby's own native
// unavailable application state at the exact advertised role URL.
export const verifyUnavailableAshbyRoles = async (ids, provider, { fetchPage, signal } = {}) => {
  const proofs = [], failures = []
  let pagesFetched = 0
  for (const jobId of ids.slice(0, 8)) {
    signal?.throwIfAborted()
    if (typeof jobId !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,255}$/i.test(jobId)) continue
    const url = `https://jobs.ashbyhq.com/${encodeURIComponent(provider.boardToken)}/${encodeURIComponent(jobId)}`
    try {
      const response = await fetchPage(url, { signal })
      signal?.throwIfAborted()
      pagesFetched++
      if (response?.status !== 404 || response.url !== url || typeof response.html !== 'string'
        || Buffer.byteLength(response.html, 'utf8') > 3000000
        || /verify you are human|checking your browser|access denied|cf-chl-/i.test(response.html)) {
        throw new Error('native-role-unavailability-not-established')
      }
      const document = readNativeDocument(response.html)
      const app = readActiveAppData(document)
      const nativeClient = document.nodes(node => node.tag === 'link' && node.attrs.id === 'vite-preload'
        && node.attrs.rel === 'preload' && node.attrs.as === 'fetch').some(node => {
        try {
          const target = new URL(node.attrs.href)
          return target.origin === 'https://cdn.ashbyprd.com' && !target.search && !target.hash
            && /^\/frontend_non_user\/[a-f0-9]{40}\/\.vite\/manifest\.json$/.test(target.pathname)
        } catch { return false }
      })
      if (!nativeClient || app.environment !== 'production' || app.maintenanceMode !== false
        || app.schedulingMaintenanceMode !== false || app.organization !== null || app.posting !== null
        || app.jobBoard !== null) throw new Error('native-role-unavailable-state-unverified')
      proofs.push({ jobId, url, status: 404, method: 'native-ashby-unavailable-role-state',
        sha256: createHash('sha256').update(response.html).digest('hex'), verifiedAt: new Date().toISOString() })
    } catch (error) {
      signal?.throwIfAborted()
      failures.push({ jobId, reason: error.message })
    }
  }
  return { proofs, failures, pagesFetched }
}
