import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {activeCorporate,activePortal} from './nativeContract.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
const bytes=fs.readFileSync(new URL('./test-data/native-20261110.json.gz',import.meta.url)),packets=JSON.parse(gunzipSync(bytes)),manifest=JSON.parse(fs.readFileSync(new URL('./test-data/manifest.json',import.meta.url)))
const sha=b=>createHash('sha256').update(b).digest('hex'),firstId='5eecd62febce5'
const replay=(mutate=()=>{})=>{const rows=structuredClone(packets);mutate(rows);let listingRead=0;return {now:()=>packets[0].at,fetchText:async url=>{const r=rows.find(r=>r.requestedURL===url&&r.method==='GET');assert.ok(r,'Unexpected read '+url);return r.body},fetchJson:async(url,init)=>{const matches=rows.filter(r=>r.requestedURL===url&&r.requestBody===init.body),r=matches.length===2?matches[listingRead++]:matches[0];assert.ok(r,'Unexpected service read '+url+' '+init.body);assert.equal(init.method,'POST');assert.equal(init.headers['Content-Type'],'application/json; charset=utf-8');return JSON.parse(r.body)}}}
const changeXML=(row,mutate)=>{const p=JSON.parse(row.body);p.d.Returnvalues=mutate(p.d.Returnvalues);row.body=JSON.stringify(p)}
const changeDetail=(rows,mutate)=>changeXML(rows.find(r=>r.bodyFile==='service-detail-'+firstId+'.json'),mutate)
const changeWorksite=(rows,value)=>{for(const row of rows.filter(r=>r.bodyFile==='service-list.json'||r.bodyFile==='closing.body'))changeXML(row,xml=>xml.replace(/<Joblocation>[^<]*<\/Joblocation>/,value===null?'':'<Joblocation>'+value+'</Joblocation>'))}
test('full genuine current Strides packets retain dated methods bodies and response SHA',()=>{
 assert.equal(packets.length,7);assert.equal(sha(bytes),manifest.sha256)
 for(const r of packets){assert.equal(sha(r.body),r.sha256);assert.equal(sha(Buffer.from(r.bodyBase64,'base64')),r.sha256);assert.equal(Buffer.byteLength(r.body),r.bodyBytes);assert.ok(Date.parse(r.at));assert.ok(Date.parse(r.completedAt)>=Date.parse(r.at))}
})
test('genuine raw native executable retains its single UTF-8 BOM without changing reviewed code',async()=>{
 const script=packets.find(r=>r.requestedURL.endsWith('/Communicator.js'))
 assert.equal(script.body.charCodeAt(0),0xfeff)
 assert.equal(sha(script.body.slice(1)),'a5243d5013b9b4e26f7cc95be56a2c74c7cfc21b936304b90a4efb0dacdbfcbd')
 assert.equal((await run(replay())).length,2)
 assert.equal((await run(replay(rows=>{rows[2].body=rows[2].body.slice(1)}))).length,2)
})
for(const prefix of ['\ufeff',' ','/*stale*/'])test('holds additional native program prefix beyond the reviewed optional BOM: '+JSON.stringify(prefix),async()=>{
 await assert.rejects(run(replay(rows=>{rows[2].body=prefix+rows[2].body})))
})
test('qualifies native own-row India worksites but holds both unpublished descriptions',async()=>{
 const jobs=await run(replay());assert.equal(jobs.length,2)
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceCountryScopeUnresolved===false&&j.sourceNativeWorksiteLabel.includes(', Karnataka, India (')))
 assert.ok(jobs.every(j=>j.sourceNativeLegalEmployer==='Strides Pharma Science Limited'&&j.title==='Executive.'))
 assert.ok(jobs.every(j=>j.sourceDetailComplete===false&&j.jobDescription===null&&j.sourceDetailFailureKind==='native-role-criteria-unpublished'))
 assert.equal(jobs.find(j=>j.jobId===firstId).sourceNativeDescription,'Please enter job description')
 assert.equal(extractionDetailHealth(jobs).missingDescriptions,2)
 const publicJobs=analyzePublishableJobs(jobs);assert.equal(publicJobs.indiaJobs.length,2)
 // The shared metric keeps incomplete content eligible for lastSeenAt refresh;
 // native detail completeness remains a separate, explicitly failed contract.
 assert.equal(publicJobs.eligibleJobs.length,2)
 assert.equal(readSourceObservationEvidence(jobs,'stridespharma').observedVacancyCount,2)
 const inventory=readInventoryEvidence(jobs);assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null);assert.equal(inventory.lifecycleCleanupAllowed,false)
 assert.ok(jobs.every(j=>j.sourceScopeComplete===false&&j.sourceListingComplete===false&&j.lifecycleCleanupAllowed===false&&j.postingDate===null&&j.closingDate===null))
})
for(const site of [null,'Bangalore','Strides-Bangalore-Corporate, Bangalore, Karnataka, Canada','Strides-Bangalore-Corporate, Bangalore, Karnataka, India / Toronto (Canada)','Strides-Bangalore-Corporate, Bangalore, Karnataka, India - Canada','Strides-Bangalore-Corporate, Bangalore, Karnataka, India (Canada)'])
test('holds missing or contradictory own worksite without guessing from Bangalore: '+site,async()=>{
 const jobs=await run(replay(rows=>changeWorksite(rows,site))),job=jobs.find(j=>j.jobId===firstId)
 assert.equal(job.country,null);assert.equal(job.sourceCountryScopeUnresolved,true);assert.equal(analyzePublishableJobs(jobs).indiaJobs.length,1)
 if(site===null)assert.equal(job.location,'Bangalore')
})
test('historical aggregate India totals never replace the two own native worksite tuples',async()=>{
 const jobs=await run(replay(rows=>{for(const row of rows.filter(r=>r.bodyFile==='service-list.json'||r.bodyFile==='closing.body'))changeXML(row,xml=>xml.replace('<c_Name>India</c_Name>','<c_Name>Canada</c_Name>').replace('<total_positions>9506</total_positions>','<total_positions>999999</total_positions>'))}))
 assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.country==='India'));assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
for(const[from,to]of[['<JobId>'+firstId+'</JobId>','<JobId>different</JobId>'],['<title>Executive.</title>','<title>Different Title</title>'],['<company>STRIDES PHARMA SCIENCE LTD</company>','<company>OTHER COMPANY</company>'],['<company_Name>Strides Pharma Science Limited</company_Name>','<company_Name>Different Employer Limited</company_Name>'],['<location_city>Bangalore</location_city>','<location_city>Toronto, Canada</location_city>']])
test('fails closed on own native identity/employer/geography conflict: '+to,async()=>{
 await assert.rejects(run(replay(rows=>changeDetail(rows,xml=>xml.replace(from,to)))),error=>error.recruitmentObservations?.nativeRecords===2)
})
test('does not promote card title, markup-only or inactive criteria into full job content',async()=>{
 for(const description of ['Executive.','&lt;template&gt;This is only inactive example content.&lt;/template&gt;','&lt;p&gt;&amp;nbsp;&lt;/p&gt;']){
  const jobs=await run(replay(rows=>changeDetail(rows,xml=>xml.replace('<description>Please enter job description</description>','<description>'+description+'</description>'))))
  assert.equal(jobs.find(j=>j.jobId===firstId).jobDescription,null);assert.equal(jobs.find(j=>j.jobId===firstId).sourceDetailComplete,false)
 }
})
for(const wrap of [s=>'<template>'+s+'</template>',s=>'<div hidden>'+s+'</div>',s=>'<noscript>'+s+'</noscript>'])test('requires active corporate delegation rather than inert shell text',async()=>{
 await assert.rejects(run(replay(rows=>{rows[0].body=wrap(rows[0].body)})))
})
for(const tag of ['blockquote','q','pre','code'])test('quoted '+tag+' publisher/delegation is not active proof',async()=>{
 const wrap=s=>'<'+tag+'>'+s+'</'+tag+'>'
 assert.equal(activeCorporate(wrap(packets[0].body),'https://portal.arcolab.com/careerportal/'),false)
 assert.equal(activePortal(wrap(packets[1].body)),false)
 await assert.rejects(run(replay(rows=>{rows[0].body=wrap(rows[0].body)})))
})
test('changed native executable cannot use a stale commented declaration',async()=>{
 await assert.rejects(run(replay(rows=>{const r=rows.find(r=>r.requestedURL.endsWith('/Communicator.js'));r.body=r.body.replaceAll('/GenericMethod','/Different')+'/* /GenericMethod */'})))
})
test('changed fresh closing own inventory remains a hold',async()=>{
 await assert.rejects(run(replay(rows=>changeXML(rows.at(-1),xml=>xml.replace(/(<Table6>[\s\S]*?<title>)Executive\.(<\/title>)/,'$1Different Closing Title$2')))),error=>error.recruitmentObservations?.nativeRecords===2)
})
test('honors caller cancellation and bounds a callback ignoring AbortSignal',async()=>{
 const c=new AbortController(),reason=Error('cancel Strides');c.abort(reason)
 await assert.rejects(run({...replay(),signal:c.signal}),e=>e===reason)
 await assert.rejects(run({...replay(),sourceTimeoutMs:20,fetchText:()=>new Promise(()=>{})}))
})
test('registered adapter preserves an unknown own worksite country and incomplete criteria',async()=>{
 const provider=getScraperCatalog().find(p=>p.source==='stridespharma'),adapter=createCatalogScraper(provider)
 const jobs=await adapter.run(replay(rows=>changeWorksite(rows,null)))
 assert.equal(jobs.length,2);assert.equal(jobs.find(j=>j.jobId===firstId).country,null)
 assert.equal(analyzePublishableJobs(jobs).indiaJobs.length,1)
 assert.ok(jobs.every(j=>j.sourceDetailComplete===false&&j.jobDescription===null))
})
test('a contradictory native country field cannot be ignored alongside an India worksite',async()=>{
 const jobs=await run(replay(rows=>changeDetail(rows,xml=>xml.replace('</Table>','<country>Canada</country></Table>'))))
 assert.equal(jobs.find(j=>j.jobId===firstId).country,null);assert.equal(analyzePublishableJobs(jobs).indiaJobs.length,1)
})
for(const site of ['Toronto (Canada)','Strides-Mumbai-Corporate, Mumbai, Maharashtra, India'])test('new own-detail worksite cannot contradict the complete listing tuple: '+site,async()=>{
 const jobs=await run(replay(rows=>changeDetail(rows,xml=>xml.replace('</Table>','<Joblocation>'+site+'</Joblocation></Table>'))))
 assert.equal(jobs.find(j=>j.jobId===firstId).country,null);assert.equal(jobs.find(j=>j.jobId===firstId).sourceCountryScopeUnresolved,true)
 assert.equal(analyzePublishableJobs(jobs).indiaJobs.length,1)
})
test('changed active portal company cannot recover its old declaration from comments',async()=>{
 await assert.rejects(run(replay(rows=>{rows[1].body=rows[1].body.replace('company: "Strides"','company: "Other"')+'<!--company: "Strides"-->'})))
})
for(const injected of ['<script>MAIN.company="Other";Communicator.GenericMethod=function(){return null}</script>','<script src="https://other.example/override.js"></script>','<div hidden><script>MAIN.company="Other"</script></div>','<img src="missing" onerror="MAIN.company=\'Other\'">'])test('holds additional native executable or handler: '+injected,async()=>{
 await assert.rejects(run(replay(rows=>{rows[1].body+=injected})))
})
test('repeated headings and quoted examples are not substantive full own criteria',async()=>{
 for(const value of ['&lt;h2&gt;Responsibilities and Qualifications&lt;/h2&gt;'.repeat(5),'&lt;blockquote&gt;Responsibilities include operating equipment, maintaining manufacturing records and reviewing production quality. Qualifications include relevant experience and training for the successful candidate in this position.&lt;/blockquote&gt;']){
  const jobs=await run(replay(rows=>changeDetail(rows,xml=>xml.replace('<description>Please enter job description</description>','<description>'+value+'</description>'))))
  assert.equal(jobs.find(j=>j.jobId===firstId).sourceDetailComplete,false);assert.equal(jobs.find(j=>j.jobId===firstId).jobDescription,null)
 }
})
for(const field of ['description','Job_desc'])for(const assignment of ['You will be employed by Other Corporation.','&lt;aside&gt;Employer: Other Corporation&lt;/aside&gt;','You are an employee of Other Corporation.'])test('holds active written employer contradiction in '+field+': '+assignment,async()=>{
 const substantive=assignment+' Responsibilities include operating equipment, maintaining manufacturing records and reviewing production quality. Qualifications include relevant experience and training for the successful candidate in this position.'
 await assert.rejects(run(replay(rows=>changeDetail(rows,xml=>xml.replace('<'+field+'>Please enter job description</'+field+'>','<'+field+'>'+substantive+'</'+field+'>')))),e=>e.recruitmentObservations?.nativeRecords===2)
})
const descriptionMutation=(rows,value,field='description')=>changeDetail(rows,xml=>xml.replace('<'+field+'>Please enter job description</'+field+'>','<'+field+'>'+value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')+'</'+field+'>'))
for(const markup of ['<p>Employer:</p><div>Other Corporation</div>','<table><tr><th>Employer:</th><td>Other Corporation</td></tr></table>','<dl><dt>Employer:</dt><dd>Other Corporation</dd></dl>','Overview<address>Employer: Other Corporation</address>','Employer: Other Corporation','<main>Employer: Other Corporation</main>','Your employer will be Other Corporation.','Strides Pharma Science Limited is not your employer.','Strides is not your employer.','You will not be employed by Strides Pharma Science Limited.','You are not employed by Strides Pharma Science Limited.','You won\'t be employed by Strides Pharma Science Limited.'])test('holds own active employer boundary or denial '+markup,async()=>{
 await assert.rejects(run(replay(rows=>descriptionMutation(rows,markup))),e=>e.recruitmentObservations?.nativeRecords===2)
})
for(const markup of ['<p>Work Location:</p><div>Toronto (Canada)</div>','<table><tr><th>Work Location:</th><td>Toronto - Canada</td></tr></table>','<dl><dt>Country:</dt><dd>Canada</dd></dl>','Overview<aside>Location: Toronto / Canada</aside>','<address>Country: Canada</address>','<main>Work Location: Toronto (Canada)</main>'])test('holds own active worksite boundary '+markup,async()=>{
 const jobs=await run(replay(rows=>descriptionMutation(rows,markup))),j=jobs.find(j=>j.jobId===firstId)
 assert.equal(j.country,null);assert.equal(j.sourceCountryScopeUnresolved,true);assert.equal(analyzePublishableJobs(jobs).indiaJobs.length,1)
})
for(const field of ['description','Job_desc'])for(const statement of ['This role is based in Toronto, Canada.','The position will be located in Toronto (Canada).','You will be based in Toronto / Canada.','The successful candidate will be located in Toronto - Canada.','<p>This role is based in</p><aside>Toronto, Canada.</aside>'])test('holds explicit own-role worksite statement in '+field+': '+statement,async()=>{
 const jobs=await run(replay(rows=>descriptionMutation(rows,statement,field))),j=jobs.find(j=>j.jobId===firstId)
 assert.equal(j.country,null);assert.equal(j.sourceCountryScopeUnresolved,true);assert.equal(analyzePublishableJobs(jobs).indiaJobs.length,1)
})
test('generic international team mentions and quoted own-role examples are not worksite assignments',async()=>{
 for(const statement of ['You will collaborate with teams based in Toronto, Canada.','Our global team is based in Toronto, Canada.','<blockquote>This role is based in Toronto, Canada.</blockquote>','<template>The position will be located in Toronto (Canada).</template>','This role is based in Bangalore, Karnataka, India.']){
  const jobs=await run(replay(rows=>descriptionMutation(rows,statement))),j=jobs.find(j=>j.jobId===firstId);assert.equal(j.country,'India');assert.equal(j.sourceCountryScopeUnresolved,false)
 }
})
test('inert or quoted negative prose is not an own employer or worksite contradiction',async()=>{
 for(const tag of ['blockquote','q','pre','code','template','noscript']){
  const jobs=await run(replay(rows=>descriptionMutation(rows,'<'+tag+'>Employer: Other Corporation. Work Location: Toronto, Canada. You will not be employed by Strides.</'+tag+'>')))
  const j=jobs.find(j=>j.jobId===firstId);assert.equal(j.country,'India');assert.equal(j.jobDescription,null)
 }
})
test('inert comment and template programs do not alter the current executable set',async()=>{
 for(const extra of ['<!--<script>MAIN.company="Other"</script>-->','<template><script src="https://other.example/override.js"></script></template>'])assert.equal((await run(replay(rows=>{rows[1].body+=extra}))).length,2)
})
test('quoted reviewed MAIN program cannot supply the affirmative native contract',async()=>{
 await assert.rejects(run(replay(rows=>{const body=rows[1].body,at=body.indexOf('var MAIN ='),start=body.lastIndexOf('<script',at),end=body.indexOf('</script>',at)+9;assert.ok(start>0&&end>at);rows[1].body=body.slice(0,start)+'<blockquote>'+body.slice(start,end)+'</blockquote>'+body.slice(end)})))
})
test('actual substantive own description with exact legal employer remains distinct from headings',async()=>{
 const value='<p>Employer: Strides Pharma Science Limited</p><h2>Responsibilities and Qualifications</h2><p>Responsibilities include operating equipment, maintaining manufacturing records and reviewing production quality. Qualifications include relevant experience and training for the successful candidate in this position.</p>'
 const jobs=await run(replay(rows=>descriptionMutation(rows,value)));assert.equal(jobs.find(j=>j.jobId===firstId).sourceDetailComplete,true)
})
const transportReplay=(mutate=()=>{})=>{let read=0;return {fetchImpl:async(url,init)=>{
 const packet=packets[read++];assert.ok(packet);assert.equal(url,packet.requestedURL);assert.equal(init.method,packet.method);assert.equal(init.body,packet.requestBody)
 const metadata={status:packet.status,url:packet.finalURL,mime:packet.contentType};mutate(metadata,read)
 const response=new Response(Buffer.from(packet.bodyBase64,'base64'),{status:metadata.status,headers:{'Content-Type':metadata.mime}});Object.defineProperty(response,'url',{value:metadata.url});return response
}}}
test('bounded real transport preserves all seven declared requests and full raw receipts',async()=>{
 const jobs=await run(transportReplay());assert.equal(jobs.length,2);assert.equal(readInventoryEvidence(jobs).firstParty,true)
 const receipts=jobs[0].nativeCollectionEvidence.retainedResponses;assert.equal(receipts.length,7)
 assert.equal(receipts[2].bodySHA256,manifest.communicatorSHA256)
 for(const r of receipts)assert.ok(Date.parse(r.completedAt)>=Date.parse(r.requestedAt))
})
for(const mutation of [r=>r.status=403,r=>r.mime='text/plain',r=>r.url='https://foreign.example/careerportal/'])test('holds changed native transport '+mutation,async()=>{
 await assert.rejects(run(transportReplay(mutation)))
})
test('detail transport failure retains both native observations rather than success-empty',async()=>{
 const options=replay(),fetchJson=options.fetchJson;options.fetchJson=(url,init)=>init.body.includes('300000100003')?Promise.reject(Error('HTTP403 native detail denied')):fetchJson(url,init)
 await assert.rejects(run(options),e=>e.recruitmentObservations.nativeRecords===2&&e.nativeCollectionEvidence.observedListingCount===2)
})
test('source deadline bounds synchronous injected work before accepting any success',async()=>{
 const options=replay(),fetchText=options.fetchText;options.sourceTimeoutMs=1;options.fetchText=(...args)=>{const until=performance.now()+20;while(performance.now()<until){/* Intentionally block the event loop to exercise the monotonic deadline guard. */}return fetchText(...args)}
 await assert.rejects(run(options),e=>e.name==='TimeoutError')
})
for(const mutate of [xml=>xml.replace('Strides Pharma Science Limited','Different Employer Limited'),xml=>xml.replace('<NewDataSet>','<!DOCTYPE NewDataSet><NewDataSet>')])test('holds changed native registry or unsafe XML',async()=>{
 await assert.rejects(run(replay(rows=>changeXML(rows[3],mutate))))
})
