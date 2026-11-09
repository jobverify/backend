import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const root=new URL('./test-data-20261107/discovery/',import.meta.url)
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root)))
const sha=b=>createHash('sha256').update(b).digest('hex')
const packets=manifest.packets.map(p=>{const bytes=gunzipSync(fs.readFileSync(new URL(p.filename,root)));assert.equal(bytes.length,p.bodyBytes);assert.equal(sha(bytes),p.bodySHA256);return {...p,bytes}})
const now='2026-11-06T22:30:00.000Z'
const globalFetch=globalThis.fetch
test.before(()=>{globalThis.fetch=()=>{throw Error('NCS offline network tripwire')}})
test.after(()=>{globalThis.fetch=globalFetch})

function replay(mutate=()=>{}){
 const calls=[],counts=new Map()
 const fetchImpl=async(url,init={})=>{
  assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
  assert.equal(new Headers(init.headers).get('user-agent'),'Mozilla/5.0 (compatible; Jobverify careers inventory check)')
  let parameters
  if(init.body instanceof FormData)parameters=Object.fromEntries([...init.body].map(([k,v])=>[k,k==='filterCri'?JSON.parse(v):v]))
  else if(init.body)parameters=JSON.parse(init.body)
  const p=packets.find(p=>(p.requestedURL??p.url)===String(url)&&(p.method??'GET')===(init.method??'GET')&&(!parameters||JSON.stringify(p.parameters??(p.body?JSON.parse(p.body):null))===JSON.stringify(parameters)))
  assert.ok(p,'Unexpected native read '+url+' '+JSON.stringify(parameters))
  const count=(counts.get(String(url))??0)+1;counts.set(String(url),count)
  const row={url:String(url),init,parameters,count,packet:p};calls.push(row)
  let bytes=Buffer.from(p.bytes),status=p.status,type=p.contentType??p.responseHeaders?.['content-type'],finalURL=p.finalURL
  const altered=mutate({row,bytes,status,type,finalURL})??{};({bytes,status,type,finalURL}={bytes,status,type,finalURL,...altered})
  const response=new Response(bytes,{status,headers:{'content-type':type}});Object.defineProperty(response,'url',{value:finalURL});return response
 }
 return {fetchImpl,calls}
}

test('actual declared India channel observes forty full native roles and holds the genuine department contradiction',async()=>{
 const fixture=replay(),jobs=await run({fetchImpl:fixture.fetchImpl,now:()=>now})
 assert.equal(jobs.length,39,JSON.stringify(jobs.nativeCollectionEvidence.heldNativeRows.map(o=>({id:o.id,issues:o.qualificationIssues}))))
 assert.equal(new Set(jobs.map(j=>j.jobId)).size,39)
 assert.deepEqual(jobs.nativeCollectionEvidence.heldNativeRows.map(o=>o.id),['950039'])
 assert.equal(jobs.nativeCollectionEvidence.heldNativeRows[0].nativeOpeningRow._source.departmentName,'All Departments')
 assert.equal(jobs.nativeCollectionEvidence.heldNativeRows[0].nativeOpeningRecord.departmentName,'Corporate')
 const old=jobs.find(j=>j.jobId==='941245'),fresh=jobs.find(j=>j.jobId==='1206870')
 assert.equal(old.datePosted,'2026-05-13');assert.equal(fresh.datePosted,'2026-11-05')
 assert.match(fresh.description,/Good analytical and troubleshooting skills/)
 assert.equal(old.nativeLegalHiringOrganization,null)
 assert.equal(old.nativeSourceRecord.departmentName,'Singtel Group IT')
 assert.equal(old.companyName,'NCS')
 assert.equal(jobs.filter(j=>j.structuredCountryMissing).length,16)
 assert.ok(jobs.every(j=>j.country==='India'&&j.location==='Pune, Maharashtra, India'&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false&&j.applicationVisited===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readSourceObservationEvidence(jobs,'ncs').observedVacancyCount,40)
 assert.equal(jobs.nativeCollectionEvidence.observations.length,40)
 assert.ok(jobs.nativeCollectionEvidence.wholeObservedNativeBoardClosingReconciled)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 assert.ok(fixture.calls.length<=192)
 assert.ok(fixture.calls.every(x=>!String(x.row?.url??x.url).includes('applyJob')))
})

const target='1206870',unstructured='1167830'
function changeJSON(control){return ({row,bytes})=>{if(!(row.packet.contentType??row.packet.responseHeaders?.['content-type'])?.startsWith('application/json'))return;const value=JSON.parse(bytes.toString('utf8'));control(value,row);return {bytes:Buffer.from(JSON.stringify(value))}}}
function changeRole(control,id=target){return changeJSON((value,row)=>{if(row.parameters?.jobId===Number(id))control(value,row)})}
function changeListing(control,id=target){return changeJSON((value,row)=>{if(row.url==='https://public.zwayam.com/jobs/search'){const record=value.data.data.find(r=>r._id===id);if(record)control(record._source,record,row)}})}
async function held(mutate,id=target){const fixture=replay(mutate),jobs=await run({fetchImpl:fixture.fetchImpl,now:()=>now});assert.equal(jobs.length,38);assert.equal(jobs.some(j=>j.jobId===id),false);const o=jobs.nativeCollectionEvidence.observations.find(o=>o.id===id);assert.ok(o.qualificationIssues.length);assert.ok(o.nativeOpeningRow&&o.nativeClosingRow);assert.equal(jobs.nativeCollectionEvidence.observations.length,40);assert.equal(readSourceObservationEvidence(jobs,'ncs').observedVacancyCount,40);assert.equal(readInventoryEvidence(jobs).listingComplete,false);return {jobs,o,fixture}}

for(const [label,control] of [
 ['city-only country inference',d=>{d.location='Pune'}],
 ['Indiana substring',d=>{d.location='Pune, Maharashtra, Indiana'}],
 ['foreign terminal country',d=>{d.location='Pune, Maharashtra, United States'}],
 ['two displayed worksites',d=>{d.location='Pune, Maharashtra, India / Singapore'}],
 ['unknown typed countryCode',d=>{d.countryCode='US'}],
 ['unknown nested address',d=>{d.address={addressCountry:'US'}}],
 ['unknown nested employer',d=>{d.hiringOrganization={name:'Singtel'}}],
 ['known alternate workplace field',d=>{d.officeLocation={country:'US',city:'Pune'}}],
 ['alternate domain URL',d=>{d.domainUrl='https://example.org/'}],
 ['alternate apply redirection',d=>{d.careersiteRedirectionUrl='https://example.org/apply'}],
 ['cross-tenant role',d=>{d.companyId=15956}],
 ['legal employer alias',d=>{d.companyName='Singtel Group IT'}],
 ['cross-tenant department',d=>{d.department.companyId=15956}],
 ['nested department country',d=>{d.department.country={name:'United States',code:'US'}}],
 ['closed status',d=>{d.status=0}],
 ['private share',d=>{d.privateJobShare='Y'}],
 ['changed visibility',d=>{d.jobVisibiltyLevel='X'}],
 ['different requisition',d=>{d.id=999999}],
 ['different jobCode',d=>{d.jobCode=999999}],
 ['different full title',d=>{d.jobTitle='Different role'}],
 ['different literal native URL',d=>{d.jobUrl='different-role'}],
 ['blank full description',d=>{d.longDescription='';d.jobConfigurationData.Description=''}],
 ['hidden full description',d=>{d.longDescription='<div hidden>Actual native technical criteria are not visible</div>';d.jobConfigurationData.Description=d.longDescription}],
 ['description/config contradiction',d=>{d.jobConfigurationData.Description='Changed full description'}],
 ['extra object advertised criteria',d=>{d.jobConfigurationData.mandatoryRequirements={must:'Do not drop this criterion'}}],
 ['extra object root criteria',d=>{d.mandatoryRequirements={must:'Do not drop this criterion'}}],
 ['criteria workplace contradiction',d=>{d.jobConfigurationData.Location='Singapore'}],
 ['criteria skill contradiction',d=>{d.jobConfigurationData['Skills Required']='Different skills'}],
 ['publication refresh using modified date',d=>{d.createdDate=d.modifiedDate;d.jobConfigurationData['Posted On']=String(d.modifiedDate)}],
 ['invalid publication label calendar',d=>{d.createDate='31-Feb-2026'}],
 ['future publication',d=>{d.createdDate=Date.parse('2099-01-01');d.jobConfigurationData['Posted On']=String(d.createdDate)}],
 ['modified-date rendering enabled',d=>{d.modifiedDateConfiguredForCareerSiteView=true}],
 ['new expiry semantics',d=>{d.endtDate=Date.parse('2026-10-01')}],
 ['experience contradiction',d=>{d.minYrsOfExperience='1'}],
 ['department contradiction against native listing',d=>{d.departmentName='Other department';d.department.departmentName='Other department';d.jobConfigurationData.Department='Other department'}],
])test('holds full raw role on '+label,async()=>{const {o}=await held(changeRole(control));assert.ok(o.nativeOpeningRecord);assert.ok(o.nativeClosingRecord)})

for(const id of [target,unstructured])for(const [label,control]of [
 ['unreviewed countryCode',s=>{s.countryCode='US'}],
 ['unreviewed addressCountry',s=>{s.addressCountry='IN'}],
 ['nested foreign address',s=>{s.address={country:{name:'United States',code:'US'}}}],
 ['explicit displayed city-only',s=>{s.location='Pune'}],
 ['displayed Indiana',s=>{s.location='Pune, Maharashtra, Indiana'}],
 ['typed country contradiction',s=>{s.jobLocationRecord=[{jobId:s.id,companyId:15955,country:'United States',city:'Pune',state:'Maharashtra',location:'Pune, Maharashtra, India',formattedLocation:'Pune, Maharashtra, India',id:1881008}]}],
 ['multiple structured locations',s=>{s.jobLocationRecord=[{jobId:s.id,companyId:15955,country:'India',city:'Pune',state:'Maharashtra',location:'Pune, Maharashtra, India',formattedLocation:'Pune, Maharashtra, India',id:1881008},{jobId:s.id,companyId:15955,country:'India',city:'Pune',state:'Maharashtra',location:'Pune, Maharashtra, India',formattedLocation:'Pune, Maharashtra, India',id:1881009}]}],
])test('holds '+id+' listing on '+label,async()=>{const{o,fixture}=await held(changeListing(control,id),id);assert.equal(o.nativeOpeningRecord,undefined);assert.equal(fixture.calls.some(c=>c.parameters?.jobId===Number(id)),false)})

for(const[label,control]of [
 ['identity mismatch',s=>{s.id=987654}],
 ['blank title',s=>{s.jobTitle=''}],
 ['URL traversal',s=>{s.jobUrl='../foreign'}],
 ['cross tenant',s=>{s.companyId=1}],
 ['foreign authority',s=>{s.careerSiteUrl='example.org'}],
 ['closed native list status',s=>{s.displayStatus='Closed'}],
 ['private native list status',s=>{s.privateJobShare='Y'}],
])test('holds native listing '+label+' before any unsafe detail request',async()=>{const{o,fixture}=await held(changeListing(control));assert.equal(o.nativeOpeningRecord,undefined);assert.equal(fixture.calls.some(c=>c.parameters?.jobId===Number(target)),false)})

test('preserves additional flat advertised/custom criteria without inventing or dropping text',async()=>{
 const fixture=replay(changeJSON((value,row)=>{if(row.parameters?.jobId===Number(target))value.jobConfigurationData['Mandatory native criterion']='Explicit synthetic current-renderer guard criterion';if(row.url.endsWith('/'+target+'/15955'))value.reponseObject.customDetails['Additional criterion']='A second complete native criterion'})),jobs=await run({fetchImpl:fixture.fetchImpl,now:()=>now}),job=jobs.find(j=>j.jobId===target)
 assert.equal(jobs.length,39);assert.match(job.description,/Explicit synthetic current-renderer guard criterion/);assert.match(job.description,/A second complete native criterion/);assert.equal(job.nativeCustomCriteria.reponseObject.customDetails['Additional criterion'],'A second complete native criterion')
})
test('empty optional unknown fields remain raw without asserting additional authority',async()=>{const fixture=replay(changeRole(d=>{d.countryCode='';d.address=null;d.hiringOrganization=null})),jobs=await run({fetchImpl:fixture.fetchImpl,now:()=>now});assert.equal(jobs.length,39);assert.equal(jobs.find(j=>j.jobId===target).nativeSourceRecord.address,null)})

for(const[label,mutate]of [
 ['duplicate board IDs',changeJSON((v,r)=>{if(r.url.endsWith('/jobs/search'))v.data.data[1]=structuredClone(v.data.data[0])})],
 ['unreviewed native country facet',changeJSON((v,r)=>{if(r.url.endsWith('/jobs/search'))v.data.facets.Country=[{key:'India',doc_count:40}]})],
 ['changed company config',changeJSON((v,r)=>{if(r.url.includes('careersite-configurations'))v.reponseObject.company.website='https://www.singtel.com/'})],
 ['unknown nested company authority',changeJSON((v,r)=>{if(r.url.includes('careersite-configurations'))v.reponseObject.company.address={addressCountry:'IN'}})],
 ['changed public query criteria',changeJSON((v,r)=>{if(r.url.endsWith('/jobs/search'))v.data.facetedSearchConfig.queryCriteria.careersite.or[0].fieldValues=['Singapore']})],
 ['changed closing board full row',changeJSON((v,r)=>{if(r.url.endsWith('/jobs/search')&&r.count>4&&v.data.data.some(x=>x._id===target))v.data.data.find(x=>x._id===target)._source.tags='closing change'})],
 ['changed closing full detail',changeRole((v,r)=>{if(r.count>40)v.tags='closing change'})],
 ['changed closing advertised custom criterion',changeJSON((v,r)=>{if(r.url.endsWith('/'+target+'/15955')&&r.count>1)v.reponseObject.customDetails.New='closing criterion'})],
])test('fails closed on '+label,async()=>{const fixture=replay(mutate);await assert.rejects(run({fetchImpl:fixture.fetchImpl,now:()=>now}));assert.ok(fixture.calls.length<=192)})

test('holds full raw role when the required custom-criteria renderer reports failure',async()=>{const{o}=await held(changeJSON((v,r)=>{if(r.url.endsWith('/'+target+'/15955'))v.responseStatus='FAILURE'}));assert.equal(o.nativeOpeningCustomCriteria.responseStatus,'FAILURE');assert.ok(o.qualificationIssues.includes('detail:custom-criteria-renderability-unproven'))})

for(const[label,mutate]of [
 ['missing active corporate India region',({row,bytes})=>row.url==='https://www.ncs.co/careers/'?{bytes:Buffer.from(bytes.toString().replaceAll('data-countryurl="/en-in/"','data-countryurl="/en-us/"'))}:undefined],
 ['changed declared public client',({row,bytes})=>row.url.endsWith('.js')?{bytes:Buffer.concat([bytes,Buffer.from(' ')])}:undefined],
 ['wrong JSON MIME',({row})=>row.url.endsWith('/jobs/search')?{type:'text/html'}:undefined],
 ['wrong final authority',({row})=>row.url.endsWith('/jobs/search')?{finalURL:'https://example.org/jobs'}:undefined],
])test('rejects '+label,async()=>{const fixture=replay(mutate);await assert.rejects(run({fetchImpl:fixture.fetchImpl,now:()=>now}))})

test('preserves primary HTTP403 and original body evidence without a false empty inventory',async()=>{const fixture=replay(()=>({status:403}));await assert.rejects(run({fetchImpl:fixture.fetchImpl,now:()=>now}),e=>{assert.equal(e.status,403);assert.equal(e.cause.status,403);assert.equal(e.recruitmentObservations.receipts.length,1);assert.equal(e.recruitmentObservations.receipts[0].status,403);assert.ok(e.recruitmentObservations.receipts[0].bodySHA256);return true});assert.equal(fixture.calls.length,1)})
test('preserves primary HTTP403 when the denied body errors',async()=>{await assert.rejects(run({fetchImpl:async()=>{const response=new Response(new ReadableStream({start(c){c.error(Error('denied body failure'))}}),{status:403});Object.defineProperty(response,'url',{value:'https://www.ncs.co/careers/'});return response},now:()=>now}),e=>{assert.equal(e.status,403);assert.equal(e.recruitmentObservations.receipts[0].status,403);return true})})
test('prelaunch abort returns exact frozen caller reason and launches zero reads',async()=>{const caller=new AbortController(),reason=Object.freeze({abort:'caller'});let reads=0;const pending=run({signal:caller.signal,fetchImpl:()=>{reads++;throw Error('must not fetch')},now:()=>now});caller.abort(reason);await assert.rejects(pending,e=>e===reason);assert.equal(reads,0)})
test('pending headers abort preserves opaque caller Symbol and disposes late response',async()=>{const caller=new AbortController(),reason=Symbol('opaque');let resolve,reads=0,cancel=0;const pending=run({signal:caller.signal,fetchImpl:()=>{reads++;return new Promise(r=>{resolve=r})},now:()=>now});await new Promise(setImmediate);caller.abort(reason);await assert.rejects(pending,e=>e===reason);const response=new Response(new ReadableStream({cancel(){cancel++}}));resolve(response);await new Promise(setImmediate);assert.equal(reads,1);assert.equal(cancel,1)})
test('pending body abort disposes body and retains exact frozen caller reason',async()=>{const caller=new AbortController(),reason=Object.freeze({body:'caller'});let cancel=0;const pending=run({signal:caller.signal,fetchImpl:async()=>{const response=new Response(new ReadableStream({cancel(){cancel++}}),{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:'https://www.ncs.co/careers/'});return response},now:()=>now});await new Promise(setImmediate);caller.abort(reason);await assert.rejects(pending,e=>e===reason);assert.equal(cancel,1)})
test('aggregate deadline stops pending headers and launches no later native reads',async()=>{let reads=0;await assert.rejects(run({timeoutMs:5,fetchImpl:()=>{reads++;return new Promise(()=>{})},now:()=>now}),/NCS aggregate request deadline exceeded/);assert.equal(reads,1)})
for(const phase of ['headers','body'])test('unchanged fifteen-second per-read deadline bounds pending '+phase+' without later reads',async()=>{const original=setTimeout;let reads=0,cancel=0,readBudgets=0;globalThis.setTimeout=(callback,ms,...args)=>{if(ms===15000)readBudgets++;return original(callback,ms===15000?5:ms,...args)};try{await assert.rejects(run({fetchImpl:()=>{reads++;if(phase==='headers')return new Promise(()=>{});const response=new Response(new ReadableStream({cancel(){cancel++}}),{headers:{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:'https://www.ncs.co/careers/'});return response},now:()=>now}),/NCS native request deadline exceeded/);assert.equal(reads,1);assert.equal(readBudgets,1);if(phase==='body')assert.equal(cancel,1)}finally{globalThis.setTimeout=original}})
test('rejects a request to increase the aggregate deadline',async()=>{await assert.rejects(run({timeoutMs:90001,fetchImpl:()=>{throw Error('must not fetch')}}),/Invalid bounded clock\/deadline/)})
test('does not accept read caps as complete native inventory',async()=>{await assert.rejects(run({maxJobs:1,fetchImpl:()=>{throw Error('must not fetch')}}),/Native truncation is not permitted/)})

