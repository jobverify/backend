import { runApiPortalScraper } from '../apiPortal/engine.js'
import { expandApiPortalProviderTemplate } from '../providers/apiPortalTemplates.js'
import { attachInventoryEvidence, readInventoryEvidence } from './inventoryEvidence.js'
import { filterIndiaJobs } from './indiaLocationFilter.js'
import { validatePublicPostingScope, publicAtsInventoryError } from './publishingGapAts.js'
import { identifyPublicAtsBoard } from './publicAtsIdentity.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { readNativeDocument } from './activeNativeHtml.js'
import { hasNativeIndiaLocation } from './greenhouseLocations.js'
import { reconcileGreenhouseOfficeCountries, withGreenhouseOfficeCountries, greenhouseOfficeProofReason } from './greenhouseOfficeCountry.js'
import { greenhouseProspectPostIds, withGreenhousePostingKind, excludeGreenhouseProspects, greenhouseProspectReason } from './greenhouseProspects.js'

export const normalizeGreenhouseSourceRoleUrl = (value, { boardToken, jobId, companyCareerPage }) => {
  let url
  try { url = new URL(value) } catch { return null }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !/^\d+$/.test(String(jobId))) return null
  const board = identifyPublicAtsBoard(url.href)
  if (board?.atsPlatform === 'greenhouse' && board.boardToken === boardToken
    && url.pathname.replace(/\/+$/, '') === `/${boardToken}/jobs/${jobId}`) {
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`
  }
  const companyHost = new URL(companyCareerPage).hostname.replace(/^www\./i, '')
  return url.hostname.replace(/^www\./i, '') === companyHost
    && url.searchParams.getAll('gh_jid').length === 1
    && url.searchParams.get('gh_jid') === String(jobId) ? url.href : null
}

// Source-specific mappers may retain extra employer fields. Reconcile their
// output against the complete native feed instead of inventing evidence from
// an empty mapped array. This reuses the response already fetched by the source.
export const attachGreenhouseSourceEvidence = async (jobs, {
  source, companyName, companyCareerPage, boardToken, payload, signal, officialHtml,
}) => {
  if (publicAtsInventoryError(payload) || payload?.hasMore === true) {
    throw new Error(`[${source}] Failed or truncated Greenhouse inventory envelope`)
  }
  const provider = expandApiPortalProviderTemplate({ source, companyName,
    companyCareerPage, atsPlatform: 'greenhouse', boardToken, template: 'greenhouse',
    templateOptions: { boardToken } })
  provider.config.mapping.location = { strategy: 'greenhouse-location' }
  const prospectIds = Array.isArray(payload?.jobs) ? greenhouseProspectPostIds(payload.jobs, provider) : []
  const prospective = new Set(prospectIds)
  jobs = jobs.filter(job => !prospective.has(String(job.jobId)))
  excludeGreenhouseProspects(provider)
  const officeCountryScope = reconcileGreenhouseOfficeCountries(payload?.jobs, provider)
  const mappingPayload = Array.isArray(payload?.jobs) ? { ...payload,
    jobs: payload.jobs.map(record => withGreenhousePostingKind(withGreenhouseOfficeCountries(record, provider, officeCountryScope))),
  } : payload
  const mapped = await runApiPortalScraper({ provider, signal, fetchJson: async () => mappingPayload })
  const officeCountryProofs = []
  const nativeReasons = validatePublicPostingScope(payload.jobs, 'greenhouse', provider, { officeCountryScope, officeCountryProofs })
  for (const record of payload.jobs) {
    if (!normalizeGreenhouseSourceRoleUrl(record.absolute_url, { boardToken, jobId: record.id, companyCareerPage })) {
      throw new Error(`[${source}] Invalid Greenhouse board or role URL identity`)
    }
  }
  const evidence = readInventoryEvidence(mapped)
  const reasons = [...nativeReasons]
  if (officialHtml) {
    const rawIds = new Set(payload.jobs.map(record => String(record.id)))
    const links = readNativeDocument(officialHtml).nodes(node => node.tag === 'a' && node.attrs.href)
    for (const node of links) {
      let url
      try { url = new URL(node.attrs.href, companyCareerPage) } catch { continue }
      const board = identifyPublicAtsBoard(url.href)
      const advertisedId = board?.atsPlatform === 'greenhouse' && board.boardToken === boardToken
        ? url.pathname.match(/\/jobs\/(\d+)\/?$/)?.[1] : null
      if (advertisedId && !rawIds.has(advertisedId)) reasons.push('official-role-links-not-reconciled')
    }
  }
  if (!evidence.listingComplete) reasons.push(evidence.reason)
  const expectedIds = new Set(filterIndiaJobs(mapped).filter(job => hasNativeIndiaLocation(job.location)).map(job => String(job.jobId)))
  const selectedIds = new Set(jobs.map(job => String(job.jobId)))
  const mappingComplete = !(jobs.length !== selectedIds.size || selectedIds.size !== expectedIds.size
    || [...expectedIds].some(id => !selectedIds.has(id))
    || jobs.some(job => !hasNativeIndiaLocation(job.location)))
  if (!mappingComplete) reasons.push('source-india-mapping-not-reconciled')
  if (jobs.some(job => !hasSourceDescription(job))) reasons.push('selected-role-description-unavailable')
  const listingComplete = reasons.length === 0
  if (!listingComplete) for (const job of jobs) job.sourceListingComplete = false
  return attachInventoryEvidence(jobs, { ...evidence,
    status: listingComplete ? evidence.status : 'discovery-only', listingComplete,
    indiaFacetCount: nativeReasons.length || !mappingComplete ? null : jobs.length,
    reason: (listingComplete ? 'greenhouse-native-source-mapping-and-inventory-reconciled'
      : `greenhouse-source-incomplete:${[...new Set(reasons)].join(';')}`) + greenhouseOfficeProofReason(officeCountryProofs)
      + greenhouseProspectReason(prospectIds),
  })
}
