import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {runCurrentRexel} from './currentNative20261115.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url))))
const packets=new Map()
for(const packet of fixture.packets){const body=Buffer.from(packet.bodyBase64,'base64');assert.equal(createHash('sha256').update(body).digest('hex'),packet.bodySHA256);const url=packet.requestedURL||packet.url;if(!packets.has(url))packets.set(url,[]);packets.get(url).push({...packet,html:body.toString()})}
const INDIA='https://careers.rexel.com/india',ROLE='https://careers.rexel.com/job/sales-engineer-in-bengaluru-karnataka-india-india-jid-5539'
function replay(change=()=>{},options={}){
 const calls=[],visits=new Map()
 const result=runCurrentRexel({now:()=>fixture.capturedAt,...options,fetchImpl:options.fetchImpl||(async(value,init)=>{
  const url=String(value),index=visits.get(url)||0;visits.set(url,index+1);calls.push({url,init})
  const packet=structuredClone(packets.get(url)?.[index]);assert.ok(packet,'Current actual declared URL '+url+' '+index);change(packet,url,index)
  const response=new Response(packet.html,{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
 })})
 return{calls,result}
}
const editSchema=(html,change)=>html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(all,start,body,end)=>{const value=JSON.parse(body);change(value);return start+JSON.stringify(value)+end})
test('current Rexel own India card country options, full role criteria, native IDs and application links reconcile twice',async()=>{
 const reader=replay(),jobs=await reader.result
 assert.equal(jobs.length,10)
 for(const job of jobs){assert.equal(job.company,'Rexel');assert.equal(job.country,'India');assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.ok(job.jobDescription.length>1500);assert.ok(job.sourceNativeJobPosting.description.length>1500);assert.match(job.applyUrl,/^https:\/\/careers\.rexel\.com\/Workflow\?workflowId=[\da-f-]+&vacancyId=\d+$/);assert.equal(job.sourceNativeClosingReconciled,true);assert.equal(job.closingDate,null)}
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(new Set(jobs.map(job=>job.jobId)).size,10)
 assert.ok(reader.calls.every(({init})=>init.method==='GET'&&init.redirect==='manual'&&init.credentials==='omit'))
})
for(const [name,change]of[
 ['foreign employer',html=>editSchema(html,s=>{s.hiringOrganization.name='Another Company'})],
 ['foreign nested context',html=>editSchema(html,s=>{s.jobLocation[0].address['@context']='https://another.invalid/schema'})],
 ['explicit conflicting native country',html=>editSchema(html,s=>{s.jobLocation[0].address.addressCountry='US'})],
 ['new foreign place name',html=>editSchema(html,s=>{s.jobLocation[0].name='London, United Kingdom'})],
 ['new foreign street address',html=>editSchema(html,s=>{s.jobLocation[0].address.streetAddress='London, United Kingdom'})],
 ['wrong native reference',html=>editSchema(html,s=>{s.identifier.value='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'})],
 ['wrong canonical account',html=>html.replace('rel="canonical" href="https://careers.rexel.com/job/','rel="canonical" href="https://another.invalid/job/')],
 ['wrong application native ID',html=>html.replaceAll('vacancyId=5539','vacancyId=9999')],
 ['new native criterion',html=>editSchema(html,s=>{s.qualifications='A new mandatory qualification'})],
 ['hidden native benefit',html=>editSchema(html,s=>{s.jobBenefits='<p hidden>A current mandatory benefit criterion</p>'})],
 ['hidden authored criterion',html=>html.replace('aria-label="Job description"','hidden aria-label="Job description"')],
 ['additional hidden qualification',html=>html.replace('aria-label="Job description">','aria-label="Job description"><p hidden>Mandatory hidden licence</p>')],
 ['new unknown criteria widget',html=>html.replace('data-type="SalaryWidget"','data-type="AdditionalQualificationsWidget"')],
 ['duplicate decoded original field',html=>html.replace('"addressLocality":','"addressLocality":"Another Country","addressLocality":')],
 ['impossible native posted day',html=>editSchema(html,s=>{s.datePosted='2026-02-30T00:00:00Z'})],
 ['impossible native expiry day',html=>editSchema(html,s=>{s.validThrough='2027-02-30T00:00:00Z'})],
])test(name+' cannot certify the target native role',async()=>{
 const reader=replay((packet,url)=>{if(url===ROLE){const original=packet.html;packet.html=change(packet.html);assert.notEqual(packet.html,original)}})
 await assert.rejects(reader.result,/Rexel|duplicate|ambiguous/i)
})
for(const phase of ['opening','closing'])for(const notice of ['This position is currently unavailable.','This job is now filled.','This role is not available.'])test(phase+' active unavailable notice is rejected: '+notice,async()=>{
 await assert.rejects(replay((packet,url,index)=>{if(url===ROLE&&(phase==='opening'?index===0:index===1))packet.html=packet.html.replace('<div aria-label="Job description">','<p>'+notice+'</p><div aria-label="Job description">')}).result,/Rexel|unavailable|filled|closing/i)
})
for(const closingOnly of [false,true])test('explicit Applications are closed outside the criteria widget is rejected'+(closingOnly?' on closing only':''),async()=>{
 await assert.rejects(replay((packet,url,index)=>{if(url===ROLE&&(!closingOnly||index===1))packet.html=packet.html.replace(/(<body\b[^>]*>)/,'$1<p>Applications are closed.</p>')}).result,/closed|unavailable/i)
})
for(const closingOnly of [false,true])test('additional authored qualification beside the core JD cannot be dropped'+(closingOnly?' on closing only':''),async()=>{
 await assert.rejects(replay((packet,url,index)=>{if(url===ROLE&&(!closingOnly||index===1))packet.html=packet.html.replace('<div aria-label="Job description">','<section><h2>Additional mandatory qualifications</h2><p>A new mandatory PhD in cryptography.</p></section><div aria-label="Job description">')}).result,/criteria|criterion|changed/i)
})
test('a closing-only extra original qualification cannot reconcile',async()=>{
 await assert.rejects(replay((packet,url,index)=>{if(url===ROLE&&index===1)packet.html=editSchema(packet.html,s=>{s.qualifications='New closing mandatory qualification'})}).result,/Rexel|closing|criterion/i)
})
test('native benefits and compensation fields are preserved rather than omitted',async()=>{
 const jobs=await replay((packet,url)=>{if(url===ROLE)packet.html=editSchema(packet.html,s=>{s.jobBenefits='A current native benefit'})}).result
 assert.match(jobs.find(job=>job.sourceNativeAttraxID==='5539').jobDescription,/A current native benefit/)
 const wardha=jobs.find(job=>job.sourceNativeAttraxID==='4990')
 assert.equal(wardha.sourceNativeJobPosting.jobBenefits,'INR 8 - INR 12 / yearly')
 assert.match(wardha.jobDescription,/INR 8 - INR 12 \/ yearly/)
})
for(const example of ['<p hidden>This position is currently unavailable.</p>','<template><p>This job is now filled.</p></template>'])test('inert unavailability examples do not replace a current complete native role',async()=>{
 const jobs=await replay((packet,url)=>{if(url===ROLE)packet.html=packet.html.replace('<div aria-label="Job description">',example+'<div aria-label="Job description">')}).result
 assert.equal(jobs.length,10)
})
test('native India option drift or ambiguity cannot be inferred from city spelling',async()=>{
 await assert.rejects(replay((packet,url)=>{if(url===INDIA)packet.html=packet.html.replaceAll('attrax-vacancy-tile__option-location-valueset','unreviewed-location-valueset')}).result,/Rexel|country|Location/i)
})
test('new stylesheet declarations and changed whole bytes cannot qualify full role text',async t=>{
 for(const mode of ['declaration','bytes'])await t.test(mode,async()=>{await assert.rejects(replay((packet,url)=>{if(mode==='bytes'&&url.includes('style.attrax'))packet.html+='body{display:none}';if(mode==='declaration'&&url===INDIA)packet.html=packet.html.replace('</head>','<link rel="stylesheet" href="https://another.invalid/style.css"></head>')}).result,/Rexel|style/i)})
})
for(const reason of ['caller-stop',Object.freeze(Error('caller-stop'))])test('opaque caller cancellation is retained',async()=>{
 const controller=new AbortController();controller.abort(reason);const reader=replay(undefined,{signal:controller.signal});await assert.rejects(reader.result,error=>error===reason);assert.equal(reader.calls.length,0)
})
test('uncooperative native HTTP transport is bounded by the source deadline',async()=>{
 await assert.rejects(replay(undefined,{sourceDeadlineMs:25,fetchImpl:()=>new Promise(()=>{})}).result,/deadline|timeout/i)
})
