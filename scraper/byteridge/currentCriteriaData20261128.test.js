import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {roleContract,nativePageContract,currentNativeCriteriaPageContract,sha256} from './nativeContract.js'
import {runNativeByteridge} from './nativeRun.js'
import {qualifyCurrentCriteriaPrograms,qualifyCurrentCriteriaReadService,currentCriteriaInitialScripts} from './currentCriteriaProjection20261128.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-criteria-20261128.json.gz',import.meta.url))))
const detail=JSON.parse(capture.first.detail.body)
const row=JSON.parse(capture.first.listing.body).Result.find(r=>r.JobId===detail.JobId)
const doc=readNativeDocument(capture.first.page.body)
const posting=JSON.parse(doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')[0].raw)
const native=()=>({posting:structuredClone(posting),countries:[...new Set([posting.jobLocation].flat().map(p=>p.address.addressCountry))],roleLinks:[],visibleClosure:false})
const inspect=({workplace='India',schemaCountry=workplace,changeCountry=false}={})=>{
 const full=structuredClone(detail),listing=structuredClone(row),page=native()
 if(changeCountry){
  assert.equal(JSON.parse(full.Location)[0].Address,'India')
  full.Location=listing.Location=JSON.stringify(JSON.parse(full.Location).map(place=>({...place,Address:workplace})))
  const relocate=value=>value.replaceAll('Remote (India). Occasional client-site travel may be required.',workplace).replaceAll('India',workplace)
  for(const field of ['JobDescription','JobDescriptionV2','RolesAndResponsibilities','RolesAndResponsibilitiesV2','Eligibility','EligibilityV2'])if(typeof full[field]==='string')full[field]=relocate(full[field])
  page.posting.description=relocate(page.posting.description)
  for(const place of [page.posting.jobLocation].flat()){
   place.address.addressCountry=schemaCountry
   if(place.address.addressLocality==='India')place.address.addressLocality=workplace
  }
  page.countries=[schemaCountry]
 }
 return roleContract(listing,full,page,null,capture.observedAt)
}

test('genuine current Byteridge country-only India workplace uses its own matching role and typed schema, with null city',()=>{
 const role=inspect()
 assert.equal(role.country,'India')
 assert.equal(role.job.city,null)
 assert.equal(role.job.location,'India')
 assert.deepEqual(role.job.nativeCountryEvidence.addresses,['India'])
 assert.deepEqual(role.job.nativeCountryEvidence.schemaCountries,['India'])
 assert.equal(role.job.nativeSourceRecord.nativeDetail.JobId,row.JobId)
 assert.ok(role.job.sourceDescription.includes('Occasional client-site travel may be required.'))
})

test('Byteridge literal foreign country remains foreign with no city inference',()=>{
 const role=inspect({workplace:'Germany',changeCountry:true})
 assert.equal(role.country,'Germany')
 assert.equal(role.job.city,null)
 assert.deepEqual(role.job.nativeCountryEvidence.schemaCountries,['Germany'])
})

for(const workplace of ['Atlantis','Hyderabad'])test('Byteridge country-only data rejects unknown workplace '+workplace,()=>{
 assert.throws(()=>inspect({workplace,changeCountry:true}),/unknown explicit native address country|unknown explicit role Location country/)
})

test('Byteridge explicit country-only label cannot override a contradictory own typed schema',()=>{
 assert.throws(()=>inspect({workplace:'India',schemaCountry:'Germany',changeCountry:true}),/native role\/schema country conflict/)
})

const replay=async(mutate,{packets=[...capture.phasePackets,...capture.programs],now=capture.observedAt}={})=>{
 const queues=new Map(),calls=[]
 for(const packet of packets){
  const key=packet.requestedUrl||packet.url
  // This token is a synthetic transport fixture, never a captured native fact.
  // The genuine session body is absent from the fixture's deduplicated bodies.
  if(packet.anonymousSession)assert.equal(capture.bodies[packet.sha256],undefined)
  const item={...packet,body:packet.anonymousSession?JSON.stringify({access_token:'fixture-public-anonymous-session',token_type:'Bearer',expires_in:3600,ShouldRedirect:false}):capture.bodies[packet.sha256]}
  if(!queues.has(key))queues.set(key,[])
  queues.get(key).push(item)
 }
 // Initial program capture precedes the independently captured closing graph.
 for(const queue of queues.values())queue.sort((a,b)=>(a.phase==='closing-program'?1:0)-(b.phase==='closing-program'?1:0))
 const jobs=await runNativeByteridge({now,requestIntervalMs:0,timeoutMs:300000,fetchImpl:async(url,init)=>{
  const queue=queues.get(url),packet=queue?.shift()
  assert.ok(packet,'unrecorded public read '+url)
  assert.equal(init.method,packet.method||'GET')
  if(init.method==='POST')assert.deepEqual(JSON.parse(init.body),JSON.parse(packet.requestBody))
  assert.equal(init.redirect,'manual')
  if(!url.startsWith('https://thapi-stage0.azurewebsites.net/'))assert.equal(init.headers.Authorization,undefined)
  else if(!url.endsWith('/api/token/noauth'))assert.equal(init.headers.Authorization,'Bearer fixture-public-anonymous-session')
  calls.push({url,method:init.method})
  const body=mutate?mutate({...packet},calls)??packet.body:packet.body
  assert.equal(typeof body,'string')
  return {status:packet.status,url,headers:{get:name=>packet.headers?.[name.toLowerCase()]||null},text:async()=>body}
 }})
 return {jobs,calls,queues}
}

test('genuine current public native DTOs recover criteria data while every rendering/application/full-detail and cleanup boundary stays held',async t=>{
 const {jobs,calls}=await replay()
 t.diagnostic(JSON.stringify({returned:jobs.map(j=>j.id),reasons:jobs.nativeInventoryEvidence.reasons}))
 assert.deepEqual(jobs.map(job=>job.id),['d884baa9-3629-477c-8bcf-238666787f4b','ddd3d264-ccda-4ae7-a35a-62188d68d473'])
 assert.equal(jobs.nativeInventoryEvidence.observedGlobalRecords,6)
 assert.equal(jobs.nativeInventoryEvidence.applicationPublicContextValidated,false)
 assert.equal(calls.length,67)
 assert.equal(calls.filter(call=>call.method==='POST').length,4)
 assert.ok(calls.every(call=>call.method==='GET'||/\/api\/careerpagev2\/filteredjobs\?|\/wp-json\/turbohire\/v1\/careerpagejobs$/.test(call.url)))
 for(const job of jobs){
  assert.equal(job.sourceDetailComplete,false)
  assert.equal(job.sourceDetailStatus,'partial')
  assert.equal(job.sourceDetailFailureKind,'current-native-criteria-data-rendering-and-application-unqualified')
  assert.equal(job.nativeCriteriaTextComplete,true)
  assert.equal(job.sourceRenderedCriteriaComplete,false)
  assert.equal(job.sourceApplicationQualificationComplete,false)
  assert.equal(job.sourceAvailabilityVerified,false)
  assert.equal(job.applicationPublicContextValidated,false)
  assert.equal(job.sourceListingComplete,false)
  assert.equal(job.sourceScopeComplete,false)
  assert.equal(job.lifecycleCleanupAllowed,false)
  assert.equal(job.nativeRoleClosingReconciled,true)
  assert.equal(job.nativeCriteriaDataRecord.CreatedByEmail,undefined)
  assert.equal(job.nativeCriteriaDataRecord.CreatedByName,undefined)
  assert.equal(job.nativeCriteriaDataRecord.CreatedById,undefined)
  assert.equal(job.nativeCriteriaDataRecord.OrgDetails,undefined)
 }
 assert.equal(jobs[0].nativeUnqualifiedProgramEvidence.length,7)
 for(const module of jobs[0].nativeUnqualifiedProgramEvidence){
  assert.equal(typeof module.source,'string')
  assert.ok(module.source.length>100)
  assert.equal(module.applicationQualified,false)
  assert.equal(module.renderingQualified,false)
  assert.equal(sha256(module.source),module.sha256)
 }
})

const replace=(body,from,to)=>{assert.ok(body.includes(from),'genuine mutation witness: '+from);const changed=body.replace(from,to);assert.notEqual(changed,body);return changed}
const firstId=detail.JobId
const firstDTO=packet=>packet.url.endsWith('/api/publicjobs/'+firstId)
const alterDTO=(packet,change)=>{const value=JSON.parse(packet.body);change(value);const changed=JSON.stringify(value);assert.notEqual(changed,packet.body);return changed}
const sourcePrograms=()=>new Map(capture.programs.map(packet=>[packet.url,capture.bodies[packet.sha256]]))
const mainProgram=()=>sourcePrograms().get(currentCriteriaInitialScripts.find(url=>url.includes('/main.')))

test('current read-service proof independently binds the unchanged native stage0 service and all seven complete method definitions',()=>{
 const proof=qualifyCurrentCriteriaReadService(mainProgram())
 assert.equal(proof.apiOrigin,'https://thapi-stage0.azurewebsites.net')
 assert.deepEqual(proof.readMethods,['getUnauthenticatedAccessToken','constructor','getUnAuthenticatedAccessToken','getOrgDetailsFromAccountName','getPublicOrgInfo','getPublicJobRefsForOrgFiltered','getJobInfo'])
})

for(const name of ['getUnauthenticatedAccessToken','getUnAuthenticatedAccessToken','getOrgDetailsFromAccountName','getPublicOrgInfo','getPublicJobRefsForOrgFiltered','getJobInfo'])test('independent static native read proof rejects disconnected '+name+' definition',()=>{
 const body=mainProgram(),pattern=new RegExp('\\b'+name+'\\([^)]*\\)\\{'),match=pattern.exec(body)
 assert.ok(match,'actual native method declaration exists')
 const changed=body.slice(0,match.index)+body.slice(match.index).replace(name,'reviewMutationDisconnected')
 assert.notEqual(changed,body)
 assert.throws(()=>qualifyCurrentCriteriaReadService(changed),/binding changed|anonymous read-session helper changed/)
})

test('independent static native read proof rejects a changed API origin without a whole-program hash shortcut',()=>{
 const body=replace(mainProgram(),'this.API_SERVER_BASE_URL="https://thapi-stage0.azurewebsites.net"','this.API_SERVER_BASE_URL="https://other.invalid"')
 assert.throws(()=>qualifyCurrentCriteriaReadService(body),/native read service origins changed/)
})

test('data-only page qualification does not change the ordinary full-program rejection',()=>{
 assert.throws(()=>nativePageContract(capture.first.page.body,row),/native public client version\/execution drift/)
 assert.equal(currentNativeCriteriaPageContract(capture.first.page.body,row).currentNativeCriteriaData,true)
})

for(const [name,from,to,error]of [
 ['future runtime','runtime-main.5580c07b07167ec174dd.js','runtime-main.unreviewed.js',/native public client version\/execution drift/],
 ['inert runtime','src="/runtime-main.5580c07b07167ec174dd.js"','type="application/json" src="/runtime-main.5580c07b07167ec174dd.js"',/native public client version\/execution drift/],
 ['employer','Byteridge Software Private Limited','Different Employer Private Limited',/native legal employer binding changed/],
 ['shadowed root','<div id="root">','<div id="root"></div><div id="root">',/missing or shadowed active public application root/],
])test('current data page rejects '+name,()=>{
 const firstChange=replace(capture.first.page.body,from,to)
 const html=name==='employer'?firstChange.replaceAll(from,to):firstChange
 assert.throws(()=>currentNativeCriteriaPageContract(html,row),error)
})

for(const target of ['runtime-main.','/main.','/40.','/62.'])test('unreviewed current program drift cannot qualify public data '+target,()=>{
 const programs=sourcePrograms(),url=[...programs.keys()].find(url=>url.includes(target))
 assert.ok(url)
 programs.set(url,programs.get(url)+'\n/* actual drift */')
 assert.throws(()=>qualifyCurrentCriteriaPrograms(programs),/unreviewed current public program bytes/)
})

test('a disconnected native full-role read method cannot qualify through the pinned whole program',()=>{
 const programs=sourcePrograms(),url=currentCriteriaInitialScripts.find(url=>url.includes('/main.'))
 const body=programs.get(url),changed=replace(body,'getJobInfo(','getUnboundJobInfo(')
 programs.set(url,changed)
 assert.throws(()=>qualifyCurrentCriteriaPrograms(programs),/unreviewed current public program bytes/)
})

test('current native graph must be complete and retain every unqualified changed module',()=>{
 const programs=sourcePrograms();programs.delete([...programs.keys()].find(url=>url.includes('/62.')))
 assert.throws(()=>qualifyCurrentCriteriaPrograms(programs),/incomplete current public graph/)
})

for(const [name,change,error]of [
 ['wrong OrgID',value=>{value.OrgID='00000000-0000-0000-0000-000000000001'},/public organization identity changed/],
 ['different employer name',value=>{value.OrgName='Other Company'},/public employer label changed/],
 ['different corporate website',value=>{value.OrgURL='https:\/\/other.invalid\/'},/public organization reciprocal website\/publication changed/],
 ['unpublished tenant',value=>{value.IsCareerPagePublished=false},/public organization reciprocal website\/publication changed/],
])test('current DTO data retains native organization guard: '+name,async()=>{
 let changed=false
 await assert.rejects(()=>replay(packet=>{
  if(packet.url.includes('/api/publicorganizations?accountName=byteridge')&&packet.phase==='opening'){
   changed=true;return alterDTO(packet,change)
  }
 }),error)
 assert.equal(changed,true)
})

for(const [name,change]of [
 ['missing complete criteria',value=>{value.JobDescription=value.JobDescriptionV2=''}],
 ['changed complete criteria',value=>{value.JobDescription=value.JobDescriptionV2=value.JobDescriptionV2+'<p>Additional mandatory qualification.</p>'}],
 ['closed native role',value=>{value.JobStatus='Closed'}],
 ['unpublished role',value=>{value.IsPublic=false}],
 ['different full-role identity',value=>{value.JobId='00000000-0000-0000-0000-000000000002'}],
 ['conflicting full-role employer',value=>{value.OrgDetails.OrgID='00000000-0000-0000-0000-000000000002'}],
 ['unknown DTO criterion',value=>{value.NewMandatoryEligibility='A new unsupported requirement'}],
])test('current native invalid '+name+' withholds that role and keeps company inventory held',async()=>{
 let mutations=0
 const {jobs}=await replay(packet=>{if(firstDTO(packet)){mutations++;return alterDTO(packet,change)}})
 assert.equal(mutations,2)
 assert.ok(jobs.every(job=>job.id!==firstId))
 assert.ok(jobs.nativeInventoryEvidence.reasons.some(reason=>reason.startsWith('unresolved-role:'+firstId)))
 assert.equal(jobs.nativeInventoryEvidence.sourceScopeComplete,false)
 assert.equal(jobs.nativeInventoryEvidence.lifecycleCleanupAllowed,false)
})

test('closing comparison includes public DTO fields outside the description projection',async()=>{
 let changed=false
 const {jobs}=await replay(packet=>{
  if(firstDTO(packet)&&packet.phase==='closing'){
   changed=true;return alterDTO(packet,value=>{value.ClientDescV2=(value.ClientDescV2||'')+'<p>New native client requirement.</p>'})
  }
 })
 assert.equal(changed,true)
 assert.ok(jobs.every(job=>job.id!==firstId))
 assert.ok(jobs.nativeInventoryEvidence.reasons.includes('role-changed-during-closing:'+firstId))
})

test('closing program drift aborts the collection without qualifying application code',async()=>{
 let changed=false
 await assert.rejects(()=>replay(packet=>{
  if(packet.phase==='closing-program'&&packet.url.includes('/62.')){changed=true;return packet.body+'\n/* changed after data read */'}
 }),/closing current native client bytes changed/)
 assert.equal(changed,true)
})

test('an arbitrary extra country qualifier cannot reuse the reviewed exact Remote India travel sentence',()=>{
 const full=structuredClone(detail),page=native()
 const modify=value=>replace(value,'Occasional client-site travel may be required.','Only candidates in Germany may apply.')
 full.JobDescriptionV2=modify(full.JobDescriptionV2)
 if(full.JobDescription)full.JobDescription=modify(full.JobDescription)
 page.posting.description=modify(page.posting.description)
 assert.throws(()=>roleContract(row,full,page,null,capture.observedAt),/unknown explicit role Location country/)
})

const registeredTarget='c3dd22b9-ccfe-41c8-bfc2-6d79572bcf20'
const registeredPackets=capture.registeredCapture.packets
const registeredOptions={packets:registeredPackets,now:capture.registeredCapture.outcome.startedAt}
const registeredPosting=JSON.parse(readNativeDocument(capture.bodies[registeredPackets.find(p=>p.url.includes('/job/publicjobs/'+registeredTarget+'?')).sha256]).nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')[0].raw)
const registeredDTO=JSON.parse(capture.bodies[registeredPackets.find(p=>p.url.endsWith('/api/publicjobs/'+registeredTarget)).sha256])
const editRegisteredPosting=(packet,edit)=>{
 const carrier=readNativeDocument(packet.body).nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')[0]
 const value=JSON.parse(carrier.raw),before=JSON.stringify(value)
 edit(value)
 assert.notEqual(JSON.stringify(value),before,'actual native schema mutation must occur')
 return replace(packet.body,carrier.raw,JSON.stringify(value))
}

test('separately captured registered67-packet replay retains the one legitimate held India data row and consumes every recorded read',async()=>{
 const {jobs,calls,queues}=await replay(undefined,registeredOptions)
 assert.equal(calls.length,67)
 assert.equal([...queues.values()].flat().length,0)
 assert.deepEqual(jobs.map(job=>job.id),[registeredTarget])
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].sourceDetailComplete,false)
 assert.equal(jobs[0].sourceAvailabilityVerified,false)
 assert.equal(jobs[0].applicationPublicContextValidated,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})

const schemaMutations=[
 ['foreign applicant eligibility',p=>{p.applicantLocationRequirements={'@type':'Country',name:'Germany'}}],
 ['new domestic applicant eligibility',p=>{p.applicantLocationRequirements={'@type':'Country',name:'India'}}],
 ['new job location type',p=>{p.jobLocationType='TELECOMMUTE'}],
 ['unknown eligibility condition',p=>{p.additionalEligibility='Applicants must reside in Germany'}],
 ['unknown Place country',p=>{[p.jobLocation].flat()[0].additionalCountry='Germany'}],
 ['new address region',p=>{[p.jobLocation].flat()[0].address.addressRegion='Germany'}],
 ['unknown address country',p=>{[p.jobLocation].flat()[0].address.additionalCountry='Germany'}],
 ['typed object country',p=>{[p.jobLocation].flat()[0].address.addressCountry={'@type':'Country',name:'India'}}],
 ['changed Place type',p=>{[p.jobLocation].flat()[0]['@type']='Country'}],
 ['changed address type',p=>{[p.jobLocation].flat()[0].address['@type']='Country'}],
 ['unreviewed employer geography',p=>{p.hiringOrganization.address={addressCountry:'Germany'}}],
 ['different typed schema skills',p=>{p.skills=['A new mandatory applicant qualification']}],
]
for(const [name,edit]of schemaMutations)test('registered current data holds '+name+' and preserves both complete unqualified schema/criteria records',async()=>{
 let mutations=0
 const expected=structuredClone(registeredPosting);edit(expected)
 const {jobs,calls,queues}=await replay(packet=>{
  if(packet.url.includes('/job/publicjobs/'+registeredTarget+'?')){mutations++;return editRegisteredPosting(packet,edit)}
 },registeredOptions)
 assert.equal(mutations,2)
 assert.equal(calls.length,67)
 assert.equal([...queues.values()].flat().length,0)
 assert.ok(jobs.every(job=>job.id!==registeredTarget))
 assert.equal(jobs.nativeInventoryEvidence.sourceScopeComplete,false)
 assert.equal(jobs.nativeInventoryEvidence.lifecycleCleanupAllowed,false)
 assert.equal(jobs.nativeInventoryEvidence.applicationPublicContextValidated,false)
 assert.equal(jobs.nativeUnqualifiedProgramEvidence.length,7)
 const held=jobs.nativeInventoryEvidence.heldNativeCriteriaRecords
 for(const phase of ['opening','closing']){
  const record=held[phase].find(value=>value.jobId===registeredTarget)
  assert.ok(record,'unqualified role model retained at '+phase)
  assert.deepEqual(record.nativeJobPosting,expected)
  assert.deepEqual(record.nativeCriteriaDataRecord,Object.fromEntries(Object.entries(registeredDTO).filter(([key])=>!['CreatedByName','CreatedByEmail','CreatedById','OrgDetails'].includes(key))))
  assert.equal(record.nativeCriteriaDataRecord.CreatedByEmail,undefined)
  assert.equal(record.sourceDetailComplete,false)
  assert.equal(record.sourceAvailabilityVerified,false)
  assert.equal(record.applicationPublicContextValidated,false)
  assert.equal(record.lifecycleCleanupAllowed,false)
 }
})

test('registered current data still preserves and presents an explicitly supported structured qualification',async()=>{
 let mutations=0
 const {jobs,calls,queues}=await replay(packet=>{
  if(packet.url.includes('/job/publicjobs/'+registeredTarget+'?')){mutations++;return editRegisteredPosting(packet,p=>{p.qualifications='A supported native structured qualification.'})}
 },registeredOptions)
 assert.equal(mutations,2)
 assert.equal(calls.length,67)
 assert.equal([...queues.values()].flat().length,0)
 assert.deepEqual(jobs.map(job=>job.id),[registeredTarget])
 assert.equal(jobs[0].nativeStructuredCriteria.qualifications,'A supported native structured qualification.')
 assert.ok(jobs[0].sourceDescription.includes('A supported native structured qualification.'))
 assert.equal(jobs[0].sourceDetailComplete,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
