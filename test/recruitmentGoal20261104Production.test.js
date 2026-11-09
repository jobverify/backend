import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {WorkdayHostCircuitBreaker} from '../scraper-support/myworkday/engine.js'
import {withRecordedWorkdayClock} from './helpers/workdayRecordedClock.js'
import {nativePackets as currentDoverBindingPackets} from '../scraper/dovercorporation.workday/nativeReplayFixture.js'
import {readAecomOriginalResponses} from '../scraper/aecom.workday/nativeCurrent.js'
import {readCortevaOriginalResponses} from '../scraper/corteva.workday/nativeCurrent.js'
import {readGreatLearningOriginalResponses} from '../scraper/greatlearning/nativeCurrent.js'
import {readStantecOriginalResponses} from '../scraper/stantec.workday/nativeCurrent.js'
import {assertSpecializedBatchExtraction} from './helpers/replaySpecializedRecruitmentBatch.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261104/native-production.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex')
const key=(url,init={})=>(init.method||'GET')+':'+url+':'+(init.body||'')
const proof=job=>({id:String(job.jobId||job.requisitionId||job.nativeObservationKey||job.sourceUrl),title:job.title,country:job.country,location:job.location,
 descriptionSHA256:sha(job.sourceDescription||job.jobDescription),postingDate:job.postingDate||null,sourceUrl:job.sourceUrl,applyUrl:job.applyUrl,
 nativeRecordSHA256:sha(JSON.stringify(job.nativeSourceRecord||job.sourceNativeRecord)),nativeEmployer:job.nativeHiringOrganization||null,
 sourceScopeComplete:job.sourceScopeComplete,lifecycleCleanupAllowed:job.lifecycleCleanupAllowed})

test('the archived goal proof retains 63 registrations, 1911 India registration records and intact original response bytes',()=>{
 assert.equal(fixture.sources.length,63)
 assert.equal(fixture.sources.reduce((n,s)=>n+s.expected.proofs.length,0),1911)
 for(const source of fixture.sources){
  assert.equal(source.countryEvidence.length,source.expected.proofs.length)
  for(const r of source.requests)if(r.text!==undefined||r.bodyBase64!==undefined){
   assert.equal(r.replayed,false)
   assert.equal(sha(typeof r.bodyBase64==='string'?Buffer.from(r.bodyBase64,'base64'):r.text),r.bodySHA256)
  }
 }
})
for(const capture of fixture.sources)test(capture.source+': current registered route preserves its native identity, employer, country, full description and incomplete scope',async t=>{
 const provider=getScraperCatalog().find(p=>p.source===capture.source),pending=new Map()
 assert.ok(provider)
 // The archived one-role Moody's HTML path predates the current TalentBrew
 // inventory. Its original receipt hashes stay checked above; exercise the
 // current 44-role opening/detail/closing contract with its genuine captures.
 if(capture.source==='moodys'||capture.source==='moodyscorporation'||capture.source==='evonik'){
  const {jobs,calls}=await assertSpecializedBatchExtraction(t,provider)
  assert.equal(jobs.length,capture.source==='evonik'?7:44);assert.equal(calls.length,capture.source==='evonik'?38:104)
  return
 }
 // Dover's archived native role bytes use the separately captured current
 // careers-host redirect; the untouched original archive hashes above remain checked.
 const requests=capture.source==='dovercorporation'?currentDoverBindingPackets(capture.requests):capture.requests
 for(const r of requests){const id=key(r.requestedURL,{method:r.method,body:r.body}),rows=pending.get(id)||[];rows.push(r);pending.set(id,rows)}
 const original=globalThis.fetch
 globalThis.fetch=async(url,init={})=>{
  const rows=pending.get(key(String(url),init));assert.ok(rows?.length,'Uncaptured HTTP request: '+url)
  const r=rows.shift()
  if(r.error)throw Object.assign(Error(r.error),{abortRetries:true})
  const response=new Response([204,205,304].includes(r.status)?null:typeof r.bodyBase64==='string'?Buffer.from(r.bodyBase64,'base64'):r.text,{status:r.status,headers:r.headers||{'content-type':r.contentType}})
  Object.defineProperty(response,'url',{value:r.finalURL})
  return response
 }
 let jobs
 const run=()=>createCatalogScraper(provider).run({now:()=>capture.completedAt,
  ...(capture.source==='cocacola'?{requestScheduler:{acquire:async()=>()=>{},recordRateLimit(){}},retryBaseDelayMs:0,
   circuitBreaker:new WorkdayHostCircuitBreaker(),detailCircuitBreaker:new WorkdayHostCircuitBreaker()}:{}),
  ...(['britannia','navi','monocept','byteridge','dovercorporation','telstra','aspentechnology','amberstudent','digitalwebsolutions'].includes(capture.source)?{requestIntervalMs:0,fetchImpl:(...args)=>globalThis.fetch(...args)}:{}),
  ...(['teradata','lyrahealth','lakechemicalspvtltd','cdot','cyfuture','velaninfoservices','unosecur','logelite','adidas','mannhummel','kkr','easemytrip','condenast'].includes(capture.source)?{minIntervalMs:0,fetchImpl:(...args)=>globalThis.fetch(...args)}:{})})
 try{jobs=await(capture.source==='cocacola'?withRecordedWorkdayClock(capture.startedAt,run):run())}finally{globalThis.fetch=original}
 if(capture.expected.globalNativeRecords){
  assert.equal(provider.countryFilter,'Global')
  assert.deepEqual(jobs.map(job=>({...proof(job),sourceClosingQualified:job.sourceClosingQualified,
   sourceCountryScopeUnresolved:job.sourceCountryScopeUnresolved})),capture.expected.globalNativeRecords)
  assert.equal(jobs.length,5)
  assert.deepEqual(jobs.filter(j=>j.country===null).map(j=>j.jobId),['524','512','511','498'])
  assert.ok(jobs.filter(j=>j.country===null).every(j=>j.city===null&&j.location===null&&j.sourceCountryScopeUnresolved))
 }
 const verifiedIndiaJobs=capture.expected.globalNativeRecords?jobs.filter(job=>job.country==='India'):jobs
 if(capture.source==='byteridge'){
  const id='d417cd9e-fb63-4401-9df5-352786f05336',recovered=jobs.find(j=>j.jobId===id)
  // The same original archive already retains the full role twice. The
  // repaired reader can now qualify its Remote (India) description together
  // with its own typed schema despite the unchanged empty DTO projection.
  assert.equal(jobs.length,5);assert.ok(recovered)
  assert.deepEqual(verifiedIndiaJobs.filter(j=>j.jobId!==id).map(proof),capture.expected.proofs)
  assert.deepEqual(proof(recovered),{
   id,title:'Senior Talent Acquisition Executive',country:'India',location:'Remote, India',
   descriptionSHA256:'47c76a080b1af62cc489588c1c6259bdf73f9d94763f9fcdcb5a0bf92c6f163a',
   postingDate:'2026-11-02T05:56:52.7480751Z',
   sourceUrl:'https://byteridge.turbohire.co/job/publicjobs/'+id+'?utm_source=CareerPage',
   applyUrl:'https://byteridge.turbohire.co/job/publicjobs/'+id+'?utm_source=CareerPage',
   nativeRecordSHA256:'db932f5eda6b1331f5cafcece1470a1a0301125c1e6a07a358d8a861da34c193',
   nativeEmployer:{'@type':'Organization',name:'Byteridge Software Private Limited',sameAs:'http://byteridge.com/'},
   sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  })
  const originals=capture.requests.filter(r=>r.requestedURL.includes('/api/publicjobs/'+id))
  assert.equal(originals.length,2)
  assert.ok(originals.every(r=>r.bodySHA256==='86990e2fca60a1a13a02a6a8a2a4e8cc1a3cbca181d5d248fec45bb5ae1ffe83'))
  assert.equal(recovered.nativeSourceRecord.nativeDetail.Location,'[{}]')
  assert.equal(recovered.nativeCountryEvidence.method,'same-role-visible-remote-india-and-typed-schema')
  assert.equal(recovered.nativeRoleClosingReconciled,true)
  assert.match(recovered.sourceDescription,/Remote \(India\)/)
  assert.match(recovered.sourceDescription,/MBA\/PGDM in Human Resources/)
  assert.ok([...pending.values()].every(rows=>rows.length===0),'Every retained Byteridge request must be replayed')
 }else if(capture.source==='veriskanalytics'){
  // The current Oracle reader retains the role's published corporate and
  // organization sections alongside its original three criteria fields.
  // The immutable archive still proves the old criteria digest and every
  // native record/proof field; the additional text must be exact original data.
  assert.equal(verifiedIndiaJobs.length,capture.expected.proofs.length)
  for(let i=0;i<verifiedIndiaJobs.length;i++){
   const job=verifiedIndiaJobs[i],old=capture.expected.proofs[i],detail=job.nativeSourceRecord.detail
   const criteriaFields=['ExternalDescriptionStr','ExternalResponsibilitiesStr','ExternalQualificationsStr']
   const publicFields=[...criteriaFields,'CorporateDescriptionStr','OrganizationDescriptionStr']
   const join=fields=>fields.map(field=>detail[field]).filter(value=>typeof value==='string'&&value.trim()).join('\n')
   const criteria=join(criteriaFields),complete=join(publicFields)
   assert.equal(sha(criteria),old.descriptionSHA256)
   assert.equal(job.sourceDescription,complete);assert.equal(job.jobDescription,complete)
   assert.ok(complete.length>criteria.length&&complete.startsWith(criteria+'\n'))
   assert.ok(complete.includes(detail.CorporateDescriptionStr))
   assert.equal(sha(JSON.stringify(job.nativeSourceRecord)),old.nativeRecordSHA256)
   assert.deepEqual({...proof(job),descriptionSHA256:sha(criteria)},old)
  }
 }else if(capture.source==='pepsico'){
  // A separate current Jibe scope repair now honors this archived publisher's
  // declared main context. Preserve every archived proof field and prove that
  // only its public role route changed; the complete native record still has
  // exactly the old digest when the two contextual URLs are restored.
  assert.ok(capture.requests.some(r=>{const text=typeof r.bodyBase64==='string'?Buffer.from(r.bodyBase64,'base64').toString('utf8'):r.text||'';return /["']currentContext["']\s*:\s*["']main["']/.test(text)}))
  assert.equal(verifiedIndiaJobs.length,capture.expected.proofs.length)
  for(let i=0;i<verifiedIndiaJobs.length;i++){
   const job=verifiedIndiaJobs[i],old=capture.expected.proofs[i],record=structuredClone(job.nativeSourceRecord),detail=record.detail
   assert.equal(String(job.jobId),old.id)
   const current='https://www.pepsicojobs.com/main/jobs/'+encodeURIComponent(detail.slug)+'?lang='+encodeURIComponent(detail.language)
   assert.equal(job.sourceUrl,current);assert.equal(record.publicRoleURL,current)
   assert.equal(record.nativeAccount.searchPageURL,'https://www.pepsicojobs.com/main/jobs?keywords=India')
   assert.ok(capture.requests.some(r=>r.requestedURL===record.nativeAccount.searchPageURL&&r.status===200))
   assert.ok(capture.requests.some(r=>r.requestedURL==='https://www.pepsicojobs.com/india/jobs'))
   record.publicRoleURL=old.sourceUrl;record.nativeAccount.searchPageURL='https://www.pepsicojobs.com/india/jobs'
   assert.equal(sha(JSON.stringify(record)),old.nativeRecordSHA256)
   assert.deepEqual({...proof(job),sourceUrl:old.sourceUrl,nativeRecordSHA256:old.nativeRecordSHA256},old)
  }
 }else assert.deepEqual(verifiedIndiaJobs.map(proof),capture.expected.proofs)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,capture.expected.inventoryEvidence.listingComplete)
 assert.ok(verifiedIndiaJobs.every(j=>j.country==='India'))
 assert.ok(jobs.every(j=>j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
 if(capture.source==='greatlearning'){
  assert.equal(jobs.length,4);assert.equal(capture.requests.length,14)
  const originals=readGreatLearningOriginalResponses(jobs);assert.equal(originals.length,14)
  assert.deepEqual(originals.map(p=>[p.requestedURL,p.bodySHA256]),capture.requests.map(p=>[p.requestedURL,p.bodySHA256]))
  assert.equal(jobs.filter(j=>j.sourceWorksiteCountryProof.roleAddressCountryLiteral).length,2)
  assert.equal(jobs.filter(j=>j.nativeSourceRecord.jobPosting.jobLocation.address===null).length,2)
  for(const j of jobs){
   for(const field of ['jobId','requisitionId','canonicalRoleURL','postingDate','postedAt','closingDate','firstEverPublication','legalEmployer','remoteStatus','workplaceType'])assert.equal(j[field],null)
   assert.equal(j.nativeIdentity.kind,'published-role-url');assert.equal(j.nativeIdentity.url,j.sourceUrl)
   assert.equal(j.nativeHiringOrganization.name,'Great Learning');assert.deepEqual(j.nativeSourceRecord,j.nativeClosingRecord)
   assert.equal(j.sourceDescription,j.nativeSourceRecord.roleModel.bodyHTML);assert.equal(j.jobDescription,j.nativeSourceRecord.roleModel.description)
   assert.ok(j.nativeCriteriaComplete&&j.nativeGeographyQualified&&j.nativeRoleClosingReconciled&&j.sourceDetailComplete)
   assert.equal(j.applicationVisited,false);assert.equal(j.activeApplyVerified,false)
   assert.equal(j.sourceWorksiteCountryProof.cityDictionaryUsed,false);assert.equal(j.sourceWorksiteCountryProof.headquartersCountryDefaultUsed,false)
   assert.equal(j.sourceWorksiteCountryProof.exactWorksiteAddressVerified,false)
   if(j.nativeSourceRecord.jobPosting.jobLocation.address===null){assert.equal(j.city,null);assert.equal(j.state,null);assert.equal(j.sourceWorksiteCountryProof.contextURL,'https://www.mygreatlearning.com/careers');assert.equal(j.sourceWorksiteCountryProof.officeBindings.length,2)}
  }
  assert.match(jobs.find(j=>j.title==='Spanish Sales Consultant').jobDescription,/Minimum B2 level certification in Spanish is required/)
  assert.ok([...pending.values()].every(rows=>rows.length===0),'Every retained Great Learning request must be replayed')
 }
 if(capture.source==='stantec'){
  assert.equal(jobs.length,capture.expected.proofs.length)
  assert.equal(readStantecOriginalResponses(jobs).length,capture.requests.length)
  const audit=jobs.nativeCollectionEvidence
  assert.equal(audit.nativeIndiaRecords,capture.expected.nativeIndiaRecords)
  assert.equal(audit.qualifiedVacancies,jobs.length)
  assert.deepEqual(audit.heldRecords.map(h=>h.model.guid).sort(),[...capture.expected.prospectiveIDs].sort())
  assert.ok(audit.heldRecords.every(h=>h.reason==='prospective-talent-pool'&&!jobs.some(j=>j.jobId===h.model.guid)))
  for(const j of jobs){
   assert.equal(j.nativeSourceRecord.detail.guid,j.jobId);assert.equal(j.sourceDescription,j.nativeSourceRecord.detail.html_description)
   assert.equal(j.nativeClosingRecord.detail.guid,j.jobId);assert.equal(j.canonicalRoleURL,null)
   assert.equal(j.postingDate,null);assert.equal(j.legalEmployer,null);assert.equal(j.applicationVisited,false);assert.equal(j.activeApplyVerified,false)
   assert.equal(j.nativeCriteriaComplete,true);assert.equal(j.nativeRoleClosingReconciled,true)
   assert.equal(j.sourceWorksiteCountryProof.requestCountryUsed,false)
   if(j.nativeMultipleWorksites){assert.equal(j.location,'India');assert.equal(j.city,null);assert.equal(j.workplaceType,null)}
  }
  assert.ok([...pending.values()].every(rows=>rows.length===0),'Every retained Stantec request must be replayed')
 }
 if(capture.source==='corteva'){
  assert.equal(jobs.length,2);assert.equal(capture.requests.length,26)
  assert.ok(capture.requests.every(r=>r.method==='GET'&&r.requestedURL===r.finalURL&&r.status===(r.requestedURL==='https://apply.corteva.com/'?302:200)))
  assert.equal(readCortevaOriginalResponses(jobs).length,26)
  for(const j of jobs){
   assert.equal(j.nativeHiringOrganization.name,'Corteva Agriscience');assert.equal(j.nativeSourceRecord.canonical.jobPosting.jobLocation.address.addressCountry.name,'IN')
   assert.equal(j.sourceDescription,j.nativeSourceRecord.detail.data.jobDescription);assert.deepEqual(j.nativeSourceRecord.detail,j.nativeClosingRecord.detail)
   assert.deepEqual(j.nativeSourceRecord.canonical,j.nativeClosingRecord.canonical);assert.equal(j.canonicalRoleURL,j.sourceUrl)
   assert.equal(j.sourceDetailComplete,true);assert.equal(j.nativeCriteriaComplete,true);assert.equal(j.nativeRoleClosingReconciled,true)
   assert.equal(j.legalEmployer,null);assert.equal(j.firstEverPublication,null);assert.equal(j.employmentType,null);assert.equal(j.nativeValidThroughTimezone,null);assert.equal(j.applicationVisited,false);assert.equal(j.activeApplyVerified,false)
  }
  assert.ok([...pending.values()].every(rows=>rows.length===0),'Every retained Corteva request must be replayed')
 }
 if(['aecom','aecomindia'].includes(capture.source)){
  assert.equal(jobs.length,380);assert.equal(capture.requests.length,845)
  assert.ok(capture.requests.every(r=>r.method==='GET'&&r.status===200&&r.requestedURL===r.finalURL))
  assert.equal(capture.sameNativeBoard,'https://aecom.jobs/');assert.equal(capture.canonicalIndividualRoleURLsQualified,false)
  assert.equal(capture.registrationAliasOf,capture.source==='aecomindia'?'aecom':null)
  if(capture.source==='aecomindia')assert.equal(provider.aliasOfSource,'aecom')
  const originals=readAecomOriginalResponses(jobs);assert.equal(originals.length,845)
  for(const p of originals){assert.equal(p.originalBodyComplete,true);assert.equal(sha(Buffer.from(p.bodyBase64,'base64')),p.bodySHA256)}
  for(const j of jobs){
   assert.equal(j.companyName,'AECOM');assert.equal(j.country,'India');assert.equal(j.nativeCriteriaComplete,true);assert.equal(j.nativeGeographyQualified,true);assert.equal(j.sourceDetailComplete,true)
   assert.equal(j.canonicalRoleURL,null);assert.equal(j.legalEmployer,null);assert.equal(j.firstEverPublication,null);assert.equal(j.applicationVisited,false)
   assert.equal(j.sourceDescription,j.nativeSourceRecord.detail.html_description);assert.equal(j.nativeClosingRecord.detail.guid,j.jobId);assert.equal(j.requisitionId,j.nativeSourceRecord.detail.reqid)
   assert.equal(j.nativeSourceRecord.detail.is_posted,false);assert.equal(j.nativePublicationEvidence.indexPostedFlagMeaning,null)
   assert.equal(j.sourceWorksiteCountryProof.requestCountryUsed,false);assert.equal(j.sourceWorksiteCountryProof.cityDictionaryUsed,false)
  }
  assert.ok([...pending.values()].every(rows=>rows.length===0),'Every retained native request must be replayed')
  const other=fixture.sources.find(s=>s.source===(capture.source==='aecom'?'aecomindia':'aecom'))
  assert.deepEqual(capture.expected.proofs.map(p=>p.id).sort(),other.expected.proofs.map(p=>p.id).sort(),'Existing alias registrations share the same 380 roles')
 }
 if(capture.source==='syrmasgs'){
  assert.deepEqual(jobs.map(j=>j.jobId),['22188','19964','19963','19962'])
  assert.equal(capture.requests.length,22);assert.ok(capture.requests.every(r=>r.method==='GET'&&r.status===200))
  for(const j of jobs){
   assert.equal(j.nativeContentId,j.jobId);assert.equal(j.requisitionId,null);assert.equal(j.nativePostingId,null);assert.equal(j.legalEmployer,null)
   assert.equal(j.sourceDetailComplete,true);assert.equal(j.nativeRoleClosingReconciled,true)
   assert.deepEqual(j.nativeSourceRecord,j.nativeClosingRecord);assert.equal(j.nativeCanonicalRoleURL,j.sourceUrl)
   assert.equal(j.sourceWorksiteCountryProof.cityDictionaryUsed,false);assert.ok(['CHENNAI','MANESAR'].includes(j.sourceWorksiteCountryProof.officeHeading))
   assert.match(j.postingDate,/\+00:00$/);assert.equal(j.applicationVisited,false);assert.equal(j.activeApplyVerified,false)
  }
 }
 if(capture.source==='specindia'){
  assert.equal(jobs.length,5);assert.equal(capture.requests.length,18)
  assert.equal(capture.requests.filter(r=>r.method==='POST').length,2)
  assert.equal(jobs.reduce((n,j)=>n+j.numberOfOpenings,0),19)
  for(const j of jobs){
   assert.equal(j.nativeRoleClosingReconciled,true);assert.equal(j.nativeRoleCriteriaReconciled,true)
   assert.equal(j.nativePublishedClosedNotice,false);assert.equal(j.nativeClosingPublicationState.closed,false)
   assert.equal(j.nativeClosingPublicationState.criteriaReconciled,true)
   assert.equal(j.nativeCanonicalRoleURL,null);assert.equal(j.jobId,null);assert.equal(j.requisitionId,null)
   assert.equal(j.postingDate,null);assert.equal(j.closingDate,null);assert.equal(j.city,null)
   assert.equal(j.sourceWorksiteCountryProof.countryHeading,'India');assert.equal(j.sourceWorksiteCountryProof.cityDictionaryUsed,false)
   assert.equal(j.activeApplyVerified,false);assert.equal(j.applicationVisited,false)
   assert.equal(j.applyUrl,j.sourceUrl);assert.ok(j.sourceDescription.includes(j.nativeWholeCriteriaText))
   assert.ok(j.nativeSourceRecord.role.criteria&&j.nativeClosingRecord.role.criteria)
  }
 }
 if(capture.source==='condenast'){
  assert.equal(jobs.length,7);assert.equal(capture.requests.length,26);assert.equal(jobs[0].sourceNativeRetainedResponses.length,26)
  assert.equal(jobs[0].sourceNativeCollectionAudit.heldNativeRows.length,0)
  for(const j of jobs){assert.equal(j.sourceDetailComplete,true);assert.equal(j.nativeRoleClosingReconciled,true);assert.equal(j.country,'India');assert.equal(j.sourceWorksiteCountryProof.nativeWorksiteCountryCode,'IN');assert.equal(j.sourceWorksiteCountryProof.cityDictionaryUsed,false);assert.deepEqual(j.nativeSourceRecord.detail,j.nativeClosingRecord.detail);assert.equal(j.sourceDescription,j.jobDescription);assert.equal(j.nativeCanonicalRoleURL,null);assert.equal(j.nativePublishedApplyURL,null);assert.equal(j.activeApplyVerified,false);assert.equal(j.postedAt,null);assert.equal(j.publicationTimezone,null);assert.equal(j.nativeSourceRecord.publisher.publisherProgramsExecuted,false);assert.equal(j.nativeSourceRecord.publisher.initialSSRVisible,false)}
 }
 if(capture.source==='easemytrip'){
  assert.equal(jobs.length,10);assert.equal(capture.requests.length,6)
  const audit=jobs[0].sourceNativeCollectionAudit;assert.equal(audit.nativeRecords,12);assert.equal(audit.nativeRoleClosingReconciled,10);assert.equal(audit.excludedNativeRows.length,2);assert.ok(audit.excludedNativeRows.every(r=>r.record.loc==='Remote'&&r.countryNotClassified));assert.equal(jobs[0].sourceNativeRetainedResponses.length,6)
  assert.equal(new Set(jobs.map(j=>j.nativeObservationKey)).size,10)
  for(const j of jobs){
   assert.equal(j.sourceDetailComplete,true);assert.equal(j.nativeRoleClosingReconciled,true);assert.equal(j.sourceWorksiteCountryProof.countryHeading,'Our Offices Within India');assert.equal(j.sourceWorksiteCountryProof.nativeOfficeLabel,j.nativeLocationLabel);assert.equal(j.sourceWorksiteCountryProof.cityDictionaryUsed,false);assert.equal(j.sourceWorksiteCountryProof.exactCampusEstablished,false)
   assert.deepEqual(j.nativeSourceRecord.role,j.nativeClosingRecord.role);assert.ok(j.sourceDescription.includes('Interview process'));assert.ok(j.sourceDescription.includes('Minimum experience'));assert.equal(j.sourceDescription,j.jobDescription);assert.equal(j.employmentType,'Full-time')
   assert.equal(j.sourceURLIsSharedCareersPage,true);assert.equal(j.applicationUrlIsGeneric,true);assert.equal(j.applicationVisited,false);assert.equal(j.applicationFormSubmitted,false);assert.equal(j.activeApplyVerified,false);assert.equal(j.nativeSourceRecord.careers.publisherProgramsExecuted,false)
   for(const k of ['jobId','requisitionId','nativePostingID','nativeCanonicalRoleURL','nativePublishedRoleURL','postingDate','postedAt','closingDate','firstEverPublication','legalEmployer','numberOfOpenings','remoteStatus','nativeApplicationsOpen'])assert.equal(j[k],null,k)
  }
 }
 if(capture.source==='kkr'){
  assert.equal(jobs.length,19);assert.equal(capture.requests.length,10)
  assert.equal(jobs[0].sourceNativeCollectionAudit.nativeRecords,136);assert.equal(jobs[0].sourceNativeCollectionAudit.nativeRoleClosingReconciled,19)
  assert.equal(jobs[0].sourceNativeCollectionAudit.excludedNativeRows.length,117)
  assert.equal(jobs[0].sourceNativeRetainedResponses.length,10)
  for(const j of jobs){
   assert.equal(j.city,'Gurugram');assert.equal(j.state,null);assert.equal(j.sourceDetailComplete,true);assert.equal(j.nativeRoleClosingReconciled,true)
   assert.equal(j.nativePublishingCompanyName,'Careers at KKR');assert.equal(j.nativeHiringOrganization.name,'KKR');assert.equal(j.nativeCanonicalRoleURL,null);assert.equal(j.employmentType,null);assert.equal(j.nativeEducationApplicationSetting,'education_required')
   assert.equal(j.sourceWorksiteCountryProof.method,'own-office-label-to-current-publisher-office-country');assert.equal(j.sourceWorksiteCountryProof.literalRoleCountry,false);assert.equal(j.sourceWorksiteCountryProof.cityDictionaryUsed,false);assert.ok(j.sourceWorksiteCountryProof.contextStatement.includes('second office in India'))
   assert.deepEqual(j.nativeSourceRecord.job,j.nativeClosingRecord.job);assert.ok(j.nativeSourceRecord.office.countryContext);assert.ok(j.nativeClosingRecord.office.countryContext)
   assert.equal(j.sourceDescription,j.jobDescription);assert.ok(j.sourceDescription.includes('KKR is an equal opportunity employer.'));assert.equal(j.firstEverPublication,null)
  }
 }
 if(capture.source==='mannhummel'){
  assert.equal(jobs.length,13);assert.equal(capture.requests.length,32)
  assert.equal(jobs[0].sourceNativeCollectionAudit.nativeRecords,13);assert.equal(jobs[0].sourceNativeCollectionAudit.nativeRoleClosingReconciled,13)
  for(const j of jobs){
   assert.equal(j.sourceWorksiteCountryProof.method,'own-rmk-country-property-and-labelled-native-tile');assert.equal(j.nativeCountryLabel,'IN');assert.equal(j.sourceWorksiteCountryProof.nativeListingCountryLabel,'Country/Region');assert.equal(j.sourceWorksiteCountryProof.literalEnglishCountryName,false)
   assert.equal(j.sourceDetailComplete,true);assert.equal(j.nativeRoleClosingReconciled,true);assert.equal(j.nativeHiringOrganization.name,'Mann+Hummel GmbH')
   assert.equal(j.sourceDescription,j.nativeSourceRecord.role.criteriaText);assert.ok(j.sourceDescription.includes(j.nativeJobDescription));assert.deepEqual(j.nativeSourceRecord.role,j.nativeClosingRecord.role)
   for(const k of ['jobId','requisitionId','legalEmployer','numberOfOpenings','firstEverPublication','employmentType','nativeApplicationsOpen'])assert.equal(j[k],null,k)
   assert.equal(j.publicationTimezone,'UTC');assert.equal(j.sourceDatePrecision,'second');assert.match(j.postedAt,/Z$/);assert.match(j.closingDate,/Z$/);assert.equal(j.applicationVisited,false);assert.equal(j.activeApplyVerified,false)
   for(const p of ['source','sourceClosing'])for(const s of ['Corporate','Board','Listing','Role'])assert.equal(sha(j[p+'RawNative'+s]),j[p+'RawNative'+s+'SHA256'])
  }
  assert.ok(jobs[0].sourceDescription.includes('Ability to travel 50%'))
  for(const id of ['1447599233','1433806933','1451119933'])assert.equal(jobs.find(j=>j.nativePublicPageID===id).city,null)
 }
 if(capture.source==='adidas'){
  assert.equal(jobs.length,9);assert.equal(capture.requests.length,28);assert.ok(jobs.every(j=>!j.title.includes('Talent Pool')))
  assert.equal(jobs[0].sourceNativeCollectionAudit.talentPoolRecords,1);assert.equal(jobs[0].sourceNativeCollectionAudit.nativeRecords,10)
  for(const j of jobs){
   assert.equal(j.sourceWorksiteCountryProof.method,'own-rmk-country-region-label');assert.equal(j.sourceWorksiteCountryProof.nativeCountryLabel,'IN');assert.equal(j.sourceWorksiteCountryProof.literalRoleCountry,true)
   assert.equal(j.sourceDetailComplete,true);assert.equal(j.nativeRoleClosingReconciled,true);assert.equal(j.nativeHiringOrganization.name,'adidas');assert.ok(j.nativeHiringOrganization.employees.includes('our employees'))
   assert.equal(j.sourceDescription,j.nativeSourceRecord.role.criteriaText);assert.ok(j.sourceDescription.includes(j.nativeJobDescription));assert.ok(j.sourceDescription.includes('Culture Starts With People'))
   for(const k of ['jobId','requisitionId','legalEmployer','numberOfOpenings','postingDate','postedAt','firstEverPublication','closingDate','publicationTimezone','nativeApplicationsOpen'])assert.equal(j[k],null,k)
   assert.notEqual(j.nativePublicPageID,j.nativeAdvertisementNumber);assert.match(j.nativeDateCalendar,/^2026-10-\d{2}$/);assert.equal(j.applicationVisited,false);assert.equal(j.activeApplyVerified,false)
   for(const p of ['source','sourceClosing'])for(const s of ['Publisher','Index','Client','Listing','Role'])assert.equal(sha(j[p+'RawNative'+s]),j[p+'RawNative'+s+'SHA256'])
  }
  const countryOnly=jobs.find(j=>j.nativeAdvertisementNumber==='548541');assert.equal(countryOnly.city,null);assert.equal(countryOnly.state,null);assert.equal(countryOnly.location,'India')
 }
 if(capture.source==='logelite'){
  assert.equal(jobs.length,6);assert.equal(capture.requests.length,26);assert.equal(jobs.reduce((n,j)=>n+j.numberOfOpenings,0),19)
  assert.equal(jobs.reduce((n,j)=>n+j.nativeSourceRecord.pdf.pages.length,0),12)
  assert.equal(jobs[1].employmentType,'Full Time (Rotational Shift)');assert.equal(jobs[3].nativeExperienceLabel,'1/2 to 1 Year')
  assert.ok(jobs[3].sourceDescription.includes('6 months to 1 year'))
  for(const j of jobs){
   assert.equal(j.sourceWorksiteCountryProof.method,'declared-own-role-pdf-literal-work-location')
   assert.equal(j.sourceWorksiteCountryProof.literalRoleCountry,true);assert.equal(j.sourceWorksiteCountryProof.exactCampusEstablished,false)
   assert.equal(j.city,'Lucknow');assert.equal(j.location,'Lucknow, India');assert.equal(j.sourceDetailComplete,true);assert.equal(j.nativeRoleClosingReconciled,true)
   assert.equal(j.nativeCanonicalRoleURL,j.sourceUrl);assert.ok(j.sourceDescription.endsWith(j.nativeSourceRecord.pdf.text));assert.ok(j.sourceDescription.length>2500)
   for(const key of ['jobId','requisitionId','postingDate','postedAt','closingDate','firstEverPublication','legalEmployer','state','minimumQualification','experienceRequired','remoteStatus'])assert.equal(j[key],null,key)
   assert.match(j.nativeContentDocumentID,/^\d+$/);assert.equal(j.applicationUrlIsGeneric,true);assert.equal(j.applicationVisited,false);assert.equal(j.applicationFormSubmitted,false);assert.equal(j.activeApplyVerified,false)
   for(const prefix of ['source','sourceClosing']){
    for(const key of ['RawNativeHTML','RawNativeCareersHTML'])assert.equal(sha(j[prefix+key]),j[prefix+key+'SHA256'])
    assert.equal(sha(Buffer.from(j[prefix+'RawNativePDFBase64'],'base64')),j[prefix+'RawNativePDFSHA256']);assert.ok(j[prefix+'NativePDFRendererAliases'].fonts.length>0)
   }
  }
  assert.equal(jobs[0].sourceNativeCollectionAudit.responses.length,26)
 }
 if(capture.source==='unosecur'){
  assert.equal(jobs.length,3);assert.equal(capture.requests.length,16)
  assert.deepEqual(jobs.map(j=>j.jobId),['3140','3099','3056'])
  assert.equal(jobs[0].title,'Software Development Engineer II');assert.equal(jobs[0].nativeInternalRequisitionTitle,'UI Developer')
  assert.equal(jobs[1].nativeCorporateTitle,'Solutions Engineer (Sales)');assert.equal(jobs[1].title,'Solution Engineer Sales')
  assert.equal(jobs[0].nativeApplicationRequirements.videoApplicationMode,'required')
  assert.equal(jobs.reduce((n,j)=>n+j.nativeApplicationRequirements.screeningQuestions.length,0),12)
  for(const j of jobs){
   assert.equal(j.sourceWorksiteCountryProof.method,'declared-reczee-jobposting-and-native-api-location')
   assert.equal(j.sourceWorksiteCountryProof.literalRoleCountry,true);assert.equal(j.sourceWorksiteCountryProof.exactCampusEstablished,false)
   assert.equal(j.city,'Bengaluru');assert.equal(j.nativeRoleLocations[0].country,'India');assert.equal(j.nativeRoleLocations[0].country_code,'IN')
   assert.equal(j.sourceDetailComplete,true);assert.equal(j.nativeRoleClosingReconciled,true);assert.equal(j.sourceListingComplete,false)
   assert.equal(j.sourceDescription,j.nativeSourceRecord.api.data.requisition.job_description);assert.ok(j.sourceDescription.length>2500)
   assert.equal(j.postingDate,j.nativeSourceRecord.role.jobPosting.datePosted);assert.equal(j.postedAt,j.postingDate);assert.equal(j.publicationTimezone,'UTC')
   for(const key of ['state','requisitionId','legalEmployer','firstEverPublication','closingDate','numberOfOpenings','minimumQualification','nativeApplicationsOpen'])assert.equal(j[key],null,key)
   assert.equal(j.nativeApplicationHandoff.publicRolePageRead,true);assert.equal(j.nativeApplicationHandoff.formInteractedWith,false)
   assert.equal(j.applicationVisited,false);assert.equal(j.applicationFormSubmitted,false);assert.equal(j.activeApplyVerified,false)
   for(const key of ['sourceRawNativeHTML','sourceClosingRawNativeHTML','sourceRawNativeCareersHTML','sourceClosingRawNativeCareersHTML','sourceRawNativeClientJS','sourceClosingRawNativeClientJS','sourceRawNativeAPIJSON','sourceClosingRawNativeAPIJSON'])assert.equal(sha(j[key]),j[key+'SHA256'])
  }
  assert.equal(jobs[0].sourceNativeCollectionAudit.responses.length,16)
 }
 if(capture.source==='velaninfoservices'){
  assert.equal(jobs.length,12);assert.equal(capture.requests.length,30)
  assert.equal(jobs.reduce((n,j)=>n+j.numberOfOpenings,0),22)
  for(const j of jobs){
   assert.equal(j.sourceWorksiteCountryProof.method,'role-location-to-publisher-delivery-center-country')
   assert.equal(j.sourceWorksiteCountryProof.contextualBinding,true);assert.equal(j.sourceWorksiteCountryProof.literalRoleCountry,false)
   assert.equal(j.sourceWorksiteCountryProof.exactCampusEstablished,false);assert.equal(j.sourceWorksiteCountryProof.interviewAddressAloneUsed,false)
   assert.equal(j.sourceWorksiteCountryProof.matchingWorksites.length,2)
   assert.ok(j.sourceWorksiteCountryProof.matchingWorksites.every(s=>s.heading==='Delivery Center'&&s.countryLabel==='INDIA'))
   assert.equal(j.sourceDetailComplete,true);assert.equal(j.nativeRoleClosingReconciled,true);assert.equal(j.sourceListingComplete,false)
   assert.equal(j.nativeCanonicalRoleURL,j.sourceUrl);assert.ok(j.sourceDescription.length>700);assert.ok(j.nativeSourceRecord.role.region)
   assert.equal(j.sourceDatePrecision,'calendar-date');assert.match(j.postingDate,/^\d{4}-\d{2}-\d{2}$/)
   for(const key of ['city','state','requisitionId','legalEmployer','employmentType','postedAt','closingDate','firstEverPublication','publicationTimezone'])assert.equal(j[key],null,key)
   assert.equal(j.nativeApplicationHandoff.publicRolePageRead,true);assert.equal(j.nativeApplicationHandoff.formInteractedWith,false)
   assert.equal(j.applicationVisited,false);assert.equal(j.applicationFormSubmitted,false);assert.equal(j.activeApplyVerified,false)
   for(const key of ['sourceRawNativeHTML','sourceClosingRawNativeHTML','sourceRawNativeCareersHTML','sourceClosingRawNativeCareersHTML','sourceRawNativeIndexHTML','sourceClosingRawNativeIndexHTML','sourceRawNativeOfficeHTML','sourceClosingRawNativeOfficeHTML'])assert.equal(sha(j[key]),j[key+'SHA256'])
  }
  assert.equal(jobs[0].sourceNativeCollectionAudit.responses.length,30)
  assert.equal(jobs[0].nativeSourceRecord.offices.candidates.length,4)
 }
 if(capture.source==='cyfuture'){
  assert.equal(jobs.length,10);assert.equal(capture.requests.length,24)
  assert.deepEqual(jobs.map(j=>j.jobId),['146','143','116','91','126','101','98','70','94','93'])
  assert.equal(jobs.reduce((n,j)=>n+j.numberOfOpenings,0),331)
  for(const j of jobs){
   assert.equal(j.sourceWorksiteCountryProof.method,'role-location-to-publisher-office-country-group')
   assert.equal(j.sourceWorksiteCountryProof.contextualBinding,true);assert.equal(j.sourceWorksiteCountryProof.literalRoleCountry,false)
   assert.equal(j.sourceWorksiteCountryProof.exactCampusEstablished,false);assert.equal(j.sourceWorksiteCountryProof.countryLabel,'INDIA')
   assert.equal(j.sourceDetailComplete,true);assert.equal(j.nativeRoleClosingReconciled,true);assert.equal(j.sourceListingComplete,false)
   assert.equal(j.nativeCanonicalRoleURL,j.sourceUrl);assert.ok(j.sourceDescription.length>500)
   for(const key of ['city','state','requisitionId','legalEmployer','postingDate','postedAt','closingDate','firstEverPublication'])assert.equal(j[key],null,key)
   assert.equal(j.applicationUrlIsGeneric,true);assert.equal(j.applicationVisited,false);assert.equal(j.activeApplyVerified,false)
  }
  assert.equal(jobs[0].sourceNativeCollectionAudit.responses.length,24)
  assert.equal(jobs[0].nativeSourceRecord.offices.groups.flatMap(g=>g.offices).length,13)
  assert.equal(jobs[0].nativeSourceRecord.offices.unassignedOffices.length,0)
 }
 if(capture.source==='cdot'){
  assert.equal(jobs.length,1);const job=jobs[0]
  assert.equal(job.numberOfOpenings,5);assert.equal(job.nativeWorkplace,'Delhi');assert.equal(job.location,'Delhi')
  assert.equal(job.sourceWorksiteCountryProof.method,'advertisement-national-deployment-context')
  assert.equal(job.sourceWorksiteCountryProof.contextualBinding,true);assert.equal(job.sourceWorksiteCountryProof.literalRoleCountry,false)
  assert.equal(job.sourceDetailComplete,true);assert.equal(job.nativeRoleClosingReconciled,true)
  assert.equal(job.nativeSourceRecord.pdf.pages.length,17);assert.deepEqual(job.sourceDescriptionPages,[1,2,3,4,5,6,7])
  for(const key of ['requisitionId','nativeCanonicalRoleURL','postingDate','postedAt','firstEverPublication','legalEmployer','applicationDateTimezone'])assert.equal(job[key],null,key)
  assert.equal(job.applicationOpeningDate,'2026-10-07');assert.equal(job.closingDate,'2026-11-08')
  assert.equal(job.applicationUrlIsGeneric,true);assert.equal(job.applicationVisited,false);assert.equal(job.activeApplyVerified,false)
 }
 if(capture.source==='wspindia'){
  assert.equal(jobs.length,444)
  assert.ok(jobs.every(job=>job.companyDomain==='wsp.com'&&job.sourceDetailComplete===true&&job.nativeListingEnumerationComplete===true))
  const audit=jobs[0].sourceNativeCollectionAudit
  assert.equal(audit.distinctAdvertisedRoles,445)
  assert.equal(audit.pagesFetched,23)
  assert.deepEqual(audit.heldNativeRoles.map(row=>row.id),['94515'])
 }
 if(capture.source==='mintifi'){
  assert.equal(jobs[0].locations.length,3)
  assert.equal(jobs[0].city,null)
  assert.equal(jobs[0].requisitionId,null)
  assert.deepEqual(jobs[0].nativeCountryLocations,jobs[0].nativeSourceRecord.jobLocations)
 }
 if(capture.source==='airasiamove'){
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].nativeEmployerBinding.method,'explicit-native-role-company-brand')
  assert.equal(jobs[0].nativeSourceRecord.companyBrand,'MOVE')
  assert.equal(jobs[0].nativeHiringOrganization.name,'AirAsia Technology Center India Private Limited')
 }
 if(capture.source==='samsungelectronics'){
  assert.equal(jobs.length,20)
  assert.ok(jobs.every(job=>job.nativeHiringOrganization.name==='Samsung R&D Institute India - Bangalore'))
 }
 if(capture.source==='zebratechnologies'){
  assert.equal(jobs.length,29)
  assert.ok(jobs.every(job=>job.sourceDescription===job.nativeSourceRecord.jobPostingInfo.jobDescription
   &&job.nativeHiringOrganization.name===job.nativeSourceRecord.hiringOrganization.name))
 }
 if(capture.source==='primenumberstechnologies'){
  assert.equal(jobs.length,3)
  assert.ok(jobs.every(job=>job.sourceDescription===job.nativeSourceRecord.description&&job.postingDatePrecision==='calendar-date'
   &&job.firstEverPostedAt===null&&job.applicationVisited===false))
 }
 if(capture.source==='slb'){
  assert.equal(jobs.length,43)
  assert.equal(jobs.filter(job=>job.nativeCurrentPostingId.startsWith('WD')).length,1)
  assert.equal(jobs.filter(job=>job.nativeCurrentPostingId.startsWith('EF')).length,42)
  assert.ok(jobs.every(job=>job.nativeRoleClosingReconciled===true&&job.nativeEmployerBinding.publisher==='SLB'
   &&job.nativeEmployerBinding.legalEmployer===null&&job.firstEverPostedAt===null&&job.applicationVisited===false))
 }
 if(capture.source==='teradata'){
  assert.equal(jobs.length,86)
  assert.ok(jobs.every(job=>job.nativeRoleClosingReconciled&&job.sourceDetailComplete&&job.applicationVisited===false
   &&job.sourceDescription===job.nativeSourceRecord.posting.descriptionHTML
   &&job.sourceDescription===job.nativeSourceRecord.jobPosting.description
   &&job.postingDate===job.nativeSourceRecord.posting.postedOn&&job.sourceDatePrecision==='millisecond'
   &&job.requisitionId===null&&job.legalEmployer===null&&job.firstEverPublication===null))
  assert.deepEqual(jobs.find(j=>j.jobId==='220747').locations.map(p=>p.country),['India','Mexico','Czechia','Poland'])
  assert.equal(jobs.find(j=>j.jobId==='220835').city,null)
  assert.deepEqual(capture.requests.filter(p=>p.method==='POST').map(p=>JSON.parse(p.body).variables.start),[0,100,0,100])
 }
 if(capture.source==='lyrahealth'){
  assert.equal(jobs.length,7)
  assert.equal(jobs.filter(job=>job.legalEmployer==='Lyra Clinical Associates').length,4)
  assert.ok(jobs.every(job=>job.nativeSourceRecord.posting.country==='IN'&&job.nativeRoleClosingReconciled&&job.sourceDetailComplete
   &&job.applicationVisited===false&&job.postingDate===job.nativeSourceRecord.jobPosting.datePosted&&job.sourceDatePrecision==='day'
   &&job.requisitionId===null&&job.firstEverPublication===null&&job.nativeHiringOrganization.name==='Lyra Health'
   &&job.sourceDescription===job.nativeSourceRecord.jobPosting.description))
  const intake=jobs.find(job=>job.jobId==='0c4e320a-afda-4355-b56a-d4ba6fa9d35e')
  assert.equal(intake.nativeSourceRecord.posting.description,'');assert.match(intake.jobDescription,/Clinical Intake & Triage/)
  assert.ok(jobs.filter(job=>job.location==='India').every(job=>job.city===null))
  assert.equal(capture.requests.length,42)
 }
 if(capture.source==='lakechemicalspvtltd'){
  assert.equal(jobs.length,6)
  assert.ok(jobs.every(j=>j.requisitionId===null&&j.nativeCanonicalRoleURL===null&&j.applicationUrlIsGeneric===true
   &&j.sourceWorksiteCountryProof?.method==='role-assigned-named-worksite-to-current-employer-address'
   &&j.nativeRoleClosingReconciled===true&&j.sourceDetailComplete===true&&j.sourceListingComplete===false
   &&j.applicationVisited===false&&j.legalEmployer===null&&j.postingDate===null&&j.closingDate===null))
  assert.equal(new Set(jobs.map(j=>j.jobId)).size,6)
  assert.equal(new Set(jobs.map(j=>j.sourceUrl)).size,1)
  assert.equal(capture.requests.length,4)
 }
 assert.equal([...pending.values()].reduce((n,rows)=>n+rows.length,0),0,'All recorded requests must be reconciled')
})
