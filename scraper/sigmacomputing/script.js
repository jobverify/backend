import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { normalizeGreenhouseSourceRoleUrl } from '../../scraper-support/utils/greenhouseSourceEvidence.js'
import { hasNativeIndiaLocation, selectGreenhouseLocation } from '../../scraper-support/utils/greenhouseLocations.js'

import { SIGMA_COMPUTING_CATALOG } from './catalog.js'
import {retainSigmaNativeRecords} from './nativeRecords.js'
import {createPublishingGapAtsScraper} from '../../scraper-support/utils/publishingGapAts.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {hydrateSigmaNativeDetails,sigmaNativeCountryIssues} from './nativeDetails.js'
import {composeAbortSignals} from '../../scraper-support/utils/fetch.js'
import {projectSigmaWorksiteCountries,SIGMA_OFFICES_URL} from './worksiteCountry.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SIGMA_COMPUTING_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY_NAME = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage
export const GREENHOUSE_BOARD_URL = PROVIDER_METADATA.greenhouseBoardUrl
export const GREENHOUSE_JOBS_API_URL = PROVIDER_METADATA.greenhouseJobsApiUrl
export const extractNativeJobsFromGreenhousePayload = retainSigmaNativeRecords

const USER_AGENT = 'Mozilla/5.0 (compatible; Jobverify scraper)'

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;|&#8217;/gi, "'")
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const decodeHtml = (value) => normalizeWhitespace(value)
const advertisedRoleIds = html => {
  const document = readNativeDocument(html)
  return [...new Set(document.nodes(node => node.tag === 'a' && node.attrs.href).flatMap(node => {
    try { const url = new URL(node.attrs.href, CAREERS_URL); return url.origin === 'https://job-boards.greenhouse.io' ? url.pathname.match(/^\/sigmacomputing\/jobs\/(\d+)\/?$/)?.slice(1) || [] : [] } catch { return [] }
  }))].sort()
}

const collectLocationValues = (job = {}) => [
  normalizeWhitespace(job?.location?.name),
  ...(Array.isArray(job?.offices)
    ? job.offices.map((office) => normalizeWhitespace(office?.location || office?.name))
    : []),
  ...(Array.isArray(job?.metadata)
    ? job.metadata.map((entry) => normalizeWhitespace(entry?.value))
    : []),
].filter(Boolean)

const hasIndiaMarker = (value) => /\bindia\b/i.test(String(value ?? ''))

const inferCity = (location) => {
  const firstToken = normalizeWhitespace(location)?.split(',')[0]?.trim()
  if (!firstToken || /^india$/i.test(firstToken)) return null
  return firstToken
}

const defaultFetchText = (url, { signal } = {}) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  },
  label: SOURCE,
  attempts: 1,
  timeoutMs: 15000,
  signal,
})

const defaultFetchJson = (url, { signal } = {}) => fetchJsonWithRetry(url, {
  method: 'GET',
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'application/json,text/plain,*/*',
    Referer: CAREERS_URL,
  },
  label: SOURCE,
  attempts: 1,
  timeoutMs: 15000,
  signal,
})

export const buildGreenhouseJobsApiUrl = () => `${GREENHOUSE_JOBS_API_URL}?content=true`

export const normalizeGreenhouseJobUrl = (value, jobId) => {
  return normalizeGreenhouseSourceRoleUrl(value, { jobId, boardToken: 'sigmacomputing', companyCareerPage: CAREERS_URL })
}

export const hasOfficialCareersPageSignal = (html = '') => {
  const page = String(html ?? '')
  const normalized = normalizeWhitespace(page) || ''

  return /<title>\s*Careers and Open Positions\s*\|\s*Sigma\s*<\/title>/i.test(page)
    && normalized.includes('Careers at Sigma')
    && normalized.includes('View open positions')
    && /job-boards\.greenhouse\.io\/sigmacomputing\/jobs\//i.test(page)
}

export const extractIndiaJobsFromGreenhousePayload = (payload,{scrapedAt=new Date().toISOString()}={}) =>
  retainSigmaNativeRecords(payload,{scrapedAt}).flatMap(job=>{
    const raw=job.sourceNativeRecord,location=selectGreenhouseLocation(raw)
    if(!hasNativeIndiaLocation(location))return []
    return [{...job,location,city:inferCity(location),country:'India',requisitionId:normalizeWhitespace(raw.requisition_id),department:normalizeWhitespace(raw.departments?.[0]?.name),experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],closingDate:null}]
  })

export const createSigmaComputingScraper = () => ({
  async run({
    fetchText = defaultFetchText,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
    signal,
    onAudit,
    maxJobs = null,
    totalBudgetMs = 180000,
    requestTimeoutMs = 15000,
  } = {}) {
    signal?.throwIfAborted()
    if(!Number.isFinite(totalBudgetMs)||totalBudgetMs<=0||!Number.isFinite(requestTimeoutMs)||requestTimeoutMs<=0)throw Error('Sigma native detail finite budgets required')
    signal=composeAbortSignals(signal,AbortSignal.timeout(totalBudgetMs))
    const wait=(operation,boundary=signal)=>new Promise((resolve,reject)=>{const abort=()=>{boundary.removeEventListener('abort',abort);reject(signal.aborted?signal.reason:boundary.reason)};if(boundary.aborted){abort();return}boundary.addEventListener('abort',abort,{once:true});Promise.resolve().then(operation).then(value=>{boundary.removeEventListener('abort',abort);boundary.aborted?abort():resolve(value)},error=>{boundary.removeEventListener('abort',abort);boundary.aborted?abort():reject(error)})})
    const textReader=fetchText,jsonReader=fetchJson,deniedHosts=new Map()
    const read=async(reader,url,options)=>{const host=new URL(url).host;if(deniedHosts.has(host))throw deniedHosts.get(host);const boundary=composeAbortSignals(signal,AbortSignal.timeout(requestTimeoutMs));try{return await wait(()=>reader(url,{...options,signal:boundary}),boundary)}catch(error){signal.throwIfAborted();if([401,403,429].includes(error?.status))deniedHosts.set(host,error);throw error}}
    fetchText=(url,options)=>read(textReader,url,options);fetchJson=(url,options)=>read(jsonReader,url,options)
    const careersHtml = await fetchText(CAREERS_URL, { signal })
    signal?.throwIfAborted()
    if (!hasOfficialCareersPageSignal(careersHtml)) {
      throw new Error('Sigma Computing verified official careers page no longer matches the trusted public surface')
    }

    const payload = await fetchJson(buildGreenhouseJobsApiUrl(), { signal })
    signal?.throwIfAborted()
    const nativeRecords=retainSigmaNativeRecords(payload,{scrapedAt:now()}),nativeById=new Map(nativeRecords.map(row=>[row.jobId,row]))
    // Preserve the previous source's advertised-role reconciliation diagnostic.
    // It does not prove that the publisher's scripts/styles/hiring scope closes.
    const document=readNativeDocument(careersHtml),employerAdvertisedRoleIds=[...new Set(document.nodes(node=>node.tag==='a'&&node.attrs.href).flatMap(node=>{
      try{const url=new URL(node.attrs.href,CAREERS_URL);return url.origin==='https://job-boards.greenhouse.io'?url.pathname.match(/^\/sigmacomputing\/jobs\/(\d+)\/?$/)?.slice(1)||[]:[]}catch{return []}
    }))].sort(),unreconciledEmployerRoleIds=employerAdvertisedRoleIds.filter(id=>!nativeById.has(id))
    // Pass the original COMPLETE envelope to the CURRENT strongest GH engine.
    // Enrichment never replaces its country/detail/identity/date/content proof.
    const strongFactory=createPublishingGapAtsScraper({...PROVIDER_METADATA,boardToken:'sigmacomputing',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
    const strong=await strongFactory.run({fetchJson:async url=>{if(url!==buildGreenhouseJobsApiUrl())throw Error('Unexpected Sigma native endpoint');return payload},signal})
    signal?.throwIfAborted()
    let nativeOfficePayload=null,officeFailure=null,boardProjection={records:payload.jobs,proofs:[],unreconciledDirectoryRoleIds:[]}
    try{nativeOfficePayload=await fetchJson(SIGMA_OFFICES_URL,{signal});boardProjection=projectSigmaWorksiteCountries(payload.jobs,nativeOfficePayload)}catch(error){signal.throwIfAborted();officeFailure=error.message}
    const nativeDetails=await hydrateSigmaNativeDetails(payload.jobs,{fetchJson,signal,requestTimeoutMs})
    // Each detail is the publisher's original response. Keep its richer native
    // office/country/application fields separate from the unchanged board.
    let selected=strong,detailedEngineEvidence=null,detailProjection={records:nativeDetails.records.map(r=>r.countryRecord),proofs:[],unreconciledDirectoryRoleIds:[]}
    if(nativeDetails.records.length===payload.jobs.length){
      if(nativeOfficePayload&&!officeFailure)detailProjection=projectSigmaWorksiteCountries(nativeDetails.records.map(r=>r.countryRecord),nativeOfficePayload)
      selected=await strongFactory.run({fetchJson:async()=>({...payload,jobs:detailProjection.records}),signal})
      detailedEngineEvidence=readInventoryEvidence(selected)
    }
    const strongestEngineEvidence=readInventoryEvidence(strong);let jobs=selected.filter(job=>nativeDetails.byId.has(String(job.jobId))&&nativeDetails.byId.get(String(job.jobId)).issues.length===0&&nativeById.get(String(job.jobId))?.sourceCriteriaSchemaKnown).map(job=>{
      const native=nativeById.get(String(job.jobId));if(!native)throw Error('Sigma strongest engine returned unknown native identity')
      const {sourceFirstPublished,sourceUpdatedAt,sourceNativeEducation,sourceNativeMetadata,sourceNativeRecord,sourceNativeContent,sourceNativeRequisitionId,sourceCriteriaIssues,sourceCriteriaSchemaKnown,sourcePublisher,legalHiringEmployer}=native
      const detail=nativeDetails.byId.get(String(job.jobId))
      return {...job,sourceFirstPublished,sourceUpdatedAt,sourceNativeEducation,sourceNativeMetadata,sourceNativeRecord,sourceNativeContent,sourceNativeRequisitionId,sourceCriteriaIssues,sourceCriteriaSchemaKnown,sourcePublisher,legalHiringEmployer,sourceNativeDetailRecord:detail.record,sourceNativeApplicationQuestions:detail.jobOwnedQuestions,sourceNativeWorksiteCountryProof:detailProjection.proofs.find(p=>p.jobId===String(job.jobId))??null,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
    })
    let closingNativePayload=null,finalNativePayload=null,closingInventoryStable=false,closingFailure=null,closingNativeDetails=null,nativeDetailsStable=false,closingNativeOfficePayload=null,closingOfficeFailure=null,closingWorksiteProjection=null,worksiteCountryProofsStable=false,changedWorksiteCountryRoleIds=[]
    try {
      const closingCareers=await fetchText(CAREERS_URL,{signal});signal?.throwIfAborted()
      if(!hasOfficialCareersPageSignal(closingCareers))throw Error('Sigma closing official handoff changed')
      closingNativePayload=await fetchJson(buildGreenhouseJobsApiUrl(),{signal});signal?.throwIfAborted()
      retainSigmaNativeRecords(closingNativePayload,{scrapedAt:now()})
      closingNativeDetails=await hydrateSigmaNativeDetails(closingNativePayload.jobs,{fetchJson,signal,requestTimeoutMs})
      nativeDetailsStable=nativeDetails.failures.length===0&&closingNativeDetails.failures.length===0&&nativeDetails.records.length===closingNativeDetails.records.length&&nativeDetails.records.every(row=>row.snapshot===closingNativeDetails.byId.get(String(row.record.id))?.snapshot)
      try{closingNativeOfficePayload=await fetchJson(SIGMA_OFFICES_URL,{signal});closingWorksiteProjection=projectSigmaWorksiteCountries(closingNativeDetails.records.map(r=>r.countryRecord),closingNativeOfficePayload);const current=new Map(closingWorksiteProjection.proofs.map(p=>[p.jobId,p.bindingSHA256]));changedWorksiteCountryRoleIds=detailProjection.proofs.filter(p=>current.get(p.jobId)!==p.bindingSHA256).map(p=>p.jobId);worksiteCountryProofsStable=!officeFailure&&changedWorksiteCountryRoleIds.length===0}catch(error){signal.throwIfAborted();closingOfficeFailure=error.message;changedWorksiteCountryRoleIds=detailProjection.proofs.map(p=>p.jobId)}
      // Recheck active membership after every full closing criterion read.
      finalNativePayload=await fetchJson(buildGreenhouseJobsApiUrl(),{signal});signal.throwIfAborted()
      retainSigmaNativeRecords(finalNativePayload,{scrapedAt:now()})
      await strongFactory.run({fetchJson:async()=>finalNativePayload,signal})
      closingInventoryStable=JSON.stringify(payload)===JSON.stringify(closingNativePayload)&&JSON.stringify(closingNativePayload)===JSON.stringify(finalNativePayload)&&JSON.stringify(employerAdvertisedRoleIds)===JSON.stringify(advertisedRoleIds(closingCareers))
      const current=new Map(finalNativePayload.jobs.map(row=>[String(row.id),row]))
      jobs=jobs.filter(job=>!changedWorksiteCountryRoleIds.includes(String(job.jobId))&&JSON.stringify(current.get(String(job.jobId)))===JSON.stringify(nativeById.get(String(job.jobId))?.sourceNativeRecord)&&nativeDetails.byId.get(String(job.jobId))?.snapshot===closingNativeDetails.byId.get(String(job.jobId))?.snapshot)
    }catch(error){signal?.throwIfAborted();closingFailure=error.message;jobs=[]}
    if(Number.isSafeInteger(maxJobs)&&maxJobs>0)jobs=jobs.slice(0,maxJobs)
    const nativeCriteriaIssues=[...nativeRecords.flatMap(row=>row.sourceCriteriaIssues.map(reason=>({id:row.jobId,reason}))),...nativeDetails.records.flatMap(row=>row.issues.map(reason=>({id:row.record.id,reason})))],nativeBoardCountryIssues=sigmaNativeCountryIssues(payload.jobs),nativeDetailCountryIssues=sigmaNativeCountryIssues(nativeDetails.records.map(row=>row.countryRecord)),projectedNativeBoardCountryIssues=sigmaNativeCountryIssues(boardProjection.records),projectedNativeDetailCountryIssues=sigmaNativeCountryIssues(detailProjection.records)
    const worksiteBindingRequired=detailProjection.proofs.length>0,worksiteBindingComplete=!worksiteBindingRequired||worksiteCountryProofsStable
    const configuredBoardComplete=!nativeCriteriaIssues.length&&!projectedNativeDetailCountryIssues.length&&!nativeDetails.failures.length&&nativeDetailsStable&&closingInventoryStable&&worksiteBindingComplete&&!unreconciledEmployerRoleIds.length&&!boardProjection.unreconciledDirectoryRoleIds.length&&!closingWorksiteProjection?.unreconciledDirectoryRoleIds.length
    const audit={source:SOURCE,productionWrites:false,currentLiveQualification:configuredBoardComplete,configuredBoardComplete,sourceScopeComplete:false,lifecycleCleanupAllowed:false,authoritativeSourceTotal:configuredBoardComplete?payload.jobs.length:null,authoritativeIndiaFacetCount:configuredBoardComplete?selected.length:null,observedNativeBoardCount:payload.jobs.length,originalNativePayload:structuredClone(payload),nativeRecords,nativeDetailRecords:nativeDetails.records,nativeDetailFailures:nativeDetails.failures,closingNativeDetailRecords:closingNativeDetails?.records||[],closingNativeDetailFailures:closingNativeDetails?.failures||[],nativeDetailsStable,nativeCriteriaIssues,nativeBoardCountryIssues,nativeDetailCountryIssues,projectedNativeBoardCountryIssues,projectedNativeDetailCountryIssues,nativeOfficePayload,closingNativeOfficePayload,officeFailure,closingOfficeFailure,worksiteCountryProofs:detailProjection.proofs,closingWorksiteCountryProofs:closingWorksiteProjection?.proofs||[],changedWorksiteCountryRoleIds,worksiteCountryProofsStable,unreconciledDirectoryRoleIds:boardProjection.unreconciledDirectoryRoleIds,strongestEngineEvidence,detailedEngineEvidence,employerAdvertisedRoleIds,unreconciledEmployerRoleIds,noClosingCaptureClaimed:false,closingInventoryStable,closingNativePayload,finalNativePayload,closingFailure,missingProofs:[...(unreconciledEmployerRoleIds.length||boardProjection.unreconciledDirectoryRoleIds.length?['current additional advertised employer roles']:[]),...(projectedNativeDetailCountryIssues.length?['all role-owned country alternatives']:[]),...(nativeCriteriaIssues.length?['unreviewed published native criteria']:[]),...(!nativeDetailsStable?['fresh opening/closing full native details changed or unavailable']:[]),...(!closingInventoryStable?['fresh opening/closing inventory changed or unavailable']:[]),...(!worksiteCountryProofsStable?['current complete native worksite country binding']:[])]}
    Object.defineProperty(jobs,'sourceAudit',{value:audit});if(onAudit)await wait(()=>onAudit(structuredClone(audit)));signal?.throwIfAborted()
    attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:nativeRecords.length,observedVacancyCount:nativeRecords.length,sourceScopeComplete:false})
    return attachInventoryEvidence(jobs,{...strongestEngineEvidence,status:configuredBoardComplete?'complete-inventory':'discovery-only',listingComplete:configuredBoardComplete,pagesFetched:(closingNativePayload?2:1)+(finalNativePayload?1:0)+(nativeOfficePayload?1:0)+(closingNativeOfficePayload?1:0),reportedTotal:configuredBoardComplete?payload.jobs.length:null,indiaFacetCount:configuredBoardComplete?selected.length:null,reason:'sigma-native-criteria-and-exact-worksite-evidence:'+strongestEngineEvidence.reason+(unreconciledEmployerRoleIds.length?';official-role-links-not-reconciled':'')+(!closingInventoryStable?';closing-inventory-unverified':'')+(!nativeDetailsStable?';full-native-detail-closing-unverified':'')+(nativeCriteriaIssues.length?';unreviewed-native-criteria':'')+(projectedNativeDetailCountryIssues.length?';unresolved-native-country-roles='+projectedNativeDetailCountryIssues.length:'')+(!worksiteCountryProofsStable?';current-worksite-binding-unverified':'')})
  },
})

export const run = async (options = {}) => createSigmaComputingScraper().run(options)

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
